import type { PromptTemplate } from '../prompt-templates'
import {
  appendRequiredPromptContext,
  composePromptSystemRole,
  getBuiltinPromptTemplate,
  pruneEmptyOptionalPromptSections,
} from '../prompt-templates'
import type { WritingLanguage } from '../../shared/writing-language'
import { recordFragments } from './prompt-trace'

/**
 * 基础抽象 Prompt 建造者
 * 用于安全地拼装 LLM 生成所需的不可变上下文片段，避免漏传变量。
 */
export class BasePromptBuilder {
  protected template: PromptTemplate;
  protected variables: Record<string, string> = {};
  /**
   * 渲染期替换内置 `systemSuffix`。
   *
   * **只在拼 prompt 时生效，不改模板对象** —— `synopsisInputsFingerprint` 对模板整体
   * 做 `JSON.stringify`，内置 suffix 在里面。直接改内置会让所有已存在的大纲检查点
   * 判成「源事实已变化」。需要按结构命名换一套输出合同时走这里。
   *
   * 传**字符串** = 整段换掉（两级结构版合同走这条）；
   * 传**函数** = 在内置原文上做增量改写（只补一节、不复制整段），
   * 这样内置 suffix 改一个字的措辞都不会让这里静默失效。
   */
  protected systemSuffixOverride?: string | ((builtin: string) => string);

  constructor(template: PromptTemplate, private readonly writingLanguage: WritingLanguage) {
    this.template = template;
  }

  /** 替换本次渲染的输出合同（见 `systemSuffixOverride` 的说明）。 */
  public withSystemSuffixOverride(text: string | ((builtin: string) => string)): this {
    this.systemSuffixOverride = text;
    return this;
  }

  /** 本次渲染实际使用的输出合同：内置原文 → 覆盖（字符串整段替换 / 函数增量改写）。 */
  private resolveSystemSuffix(): string | undefined {
    const builtin = getBuiltinPromptTemplate(this.template.key, this.writingLanguage)?.systemSuffix;
    const override = this.systemSuffixOverride;
    if (override === undefined) return builtin;
    if (typeof override === 'string') return override;
    // 函数形态：没有内置原文时以空串为底，函数自己负责补全。
    return override(builtin ?? '');
  }

  /** 获取模板定义的 system role（LLM system message 角色定位） */
  public getSystemRole(): string {
    return composePromptSystemRole(this.template, this.writingLanguage)
  }

  /** 按当前变量渲染一段模板文本（未知变量原样保留，交由调用方 / 防御性校验处理）。 */
  private renderVariables(section: string, variables: Record<string, string>): string {
    let rendered = section
    for (const [key, value] of Object.entries(variables)) {
      // 使用 replaceAll 避免正则注入风险，安全替换所有匹配项
      rendered = rendered.replaceAll(`{{${key}}}`, value)
    }
    return rendered
  }

  /**
   * 渲染「本步生成规则」：作者的 taskGuidance + 内置 systemSuffix，**不含模板正文**。
   *
   * 为什么需要它：模板正文装的是**材料**（设定池 / 本章信息 / 全局要求），
   * 而 taskGuidance 与 systemSuffix 装的是**规则**（风格、篇幅、去 AI 腔、输出格式）。
   * 续写 / 压缩这类"从已有正文接着写"的请求不走 build()，历史上只复刻了材料、
   * 丢了规则 —— 于是任何写在规则区的约束在"首稿失败 → 续写重写"的路径上静默失效。
   *
   * `omitVariables` 用于剔除已由别的块承载的变量（目前只有 `user_guidance`：
   * 续写轮的蓝图 JSON 已含该字段，再渲染一次就违反"同一轮内作者字段各只出现一次"）。
   */
  public buildStepRules(options: { omitVariables?: readonly string[] } = {}): string {
    const variables: Record<string, string> = { ...this.variables }
    for (const key of options.omitVariables ?? []) variables[key] = ''

    const parts: string[] = []
    if (this.template.taskGuidance?.trim()) {
      const heading = this.writingLanguage === 'en-US'
        ? '[User-defined creative guidance]'
        : '【用户自定义创作指导】'
      parts.push(`${heading}\n${this.renderVariables(this.template.taskGuidance, variables).trim()}`)
    }

    // 始终从内置模板取 systemSuffix，与 build() 行为对齐（项目覆盖改不到这一段）。
    const suffix = this.resolveSystemSuffix()
    if (suffix) parts.push(this.renderVariables(suffix, variables))

    // 与 build() 同一套空变量段落裁剪：被清空的变量连带其标题一起消失。
    return pruneEmptyOptionalPromptSections(parts.join('\n\n'))
  }

  /** 打包输出最终经过所有合法性替换的字符串 */
  public build(): string {
    const variables: Record<string, string> = {}
    for (const [key, value] of Object.entries(this.variables)) variables[key] = value || ''
    let result = this.renderVariables(this.template.content, variables)

    if (this.template.taskGuidance?.trim()) {
      const heading = this.writingLanguage === 'en-US'
        ? '[User-defined creative guidance]'
        : '【用户自定义创作指导】'
      result += `\n\n${heading}\n${this.renderVariables(this.template.taskGuidance, variables).trim()}`
    }

    // 自动追加 systemSuffix（始终从内置模板获取，与 renderPrompt 行为对齐）
    const suffix = this.resolveSystemSuffix()
    if (suffix) {
      result = result + '\n\n' + this.renderVariables(suffix, variables)
    }

    result = appendRequiredPromptContext(result, this.template, this.variables, this.writingLanguage)

    // 空变量段落裁剪：与 renderPrompt 保持同一套规则。
    result = pruneEmptyOptionalPromptSections(result)

    // 防御性校验：检查是否有未处理的模板占位符
    const missing = result.match(/\{\{.*?\}\}/g)
    if (missing) {
      console.warn(`[PromptBuilder] 警告：模板 "${this.template.name}" 中有未赋值的变量残留:`, missing)
    }

    // Prompt 片段追踪（P1）：在合并之前逐块归因，供调优定位来源。
    // 关闭时首行即短路，零开销；不改本方法的返回值。
    recordFragments({
      template: this.template,
      variables: this.variables,
      built: result,
      writingLanguage: this.writingLanguage,
    })

    return result
  }
}

/**
 * 章节生成专用 Builder
 * 提供全链条上下文强类型注入，拒绝 raw Record<string,string> 的 "盲打模式"
 */
export class ChapterPromptBuilder extends BasePromptBuilder {
  
  withArchitecture(architecture: string) {
    this.variables.architecture = architecture;
    return this;
  }

  withGlobalSummary(globalSummary: string) {
    this.variables.global_summary = globalSummary;
    return this;
  }

  withCharacterStates(characterStates: string) {
    this.variables.character_states = characterStates;
    return this;
  }

  withShortSummary(shortSummary: string) {
    this.variables.short_summary = shortSummary;
    return this;
  }

  withPreviousEnding(previousEnding: string) {
    this.variables.previous_ending = previousEnding;
    return this;
  }

  withChapterInfo(chapterInfo: string | object) {
    this.variables.chapter_info = typeof chapterInfo === 'string' 
      ? chapterInfo 
      : JSON.stringify(chapterInfo, null, 2);
    return this;
  }

  withFutureBlueprints(futureBlueprints: string) {
    this.variables.future_blueprints = futureBlueprints;
    return this;
  }

  withUserGuidance(userGuidance: string) {
    this.variables.user_guidance = userGuidance;
    return this;
  }

  withFilteredContext(filteredContext: string) {
    this.variables.filtered_context = filteredContext;
    return this;
  }

  withGlobalGuidance(globalGuidance: string) {
    this.variables.global_guidance = globalGuidance;
    return this;
  }

  withNovelConfig(novelConfig: string | object) {
    this.variables.novel_config = typeof novelConfig === 'string' 
      ? novelConfig 
      : JSON.stringify(novelConfig, null, 2);
    return this;
  }

  withWordNumber(wordNumber: number | string) {
    this.variables.word_number = String(wordNumber);
    return this;
  }

  withDraftContent(draftContent: string) {
    this.variables.draft_content = draftContent;
    return this;
  }

  withUserRefinePrompt(userRefinePrompt: string) {
    this.variables.user_refine_prompt = userRefinePrompt;
    return this;
  }

  withReviewReport(reviewReport: string) {
    this.variables.review_report = reviewReport;
    return this;
  }

  /** 文风描述（注入写稿/修稿 Prompt） */
  withWritingStyle(style: string) {
    this.variables.writing_style = style;
    return this;
  }

  /**
   * 参考作品（注入写稿 Prompt）。
   * 与架构阶段同名语义：只借鉴调性与节奏，不是必须兑现的作者事实。
   */
  withReferenceWorks(works: string) {
    this.variables.reference_works = works;
    return this;
  }

  /**
   * 本章结尾钩子（悬置点）。
   *
   * 与 `chapter_info` JSON 内的同名字段**并存**，不是重复：JSON 里的是结构化投影，
   * 单独成块是为了给它一个显眼位置 —— 钩子排在 `keyEvents` 之后，埋进 JSON 里
   * 容易被当作元数据忽略，而它恰恰决定结尾的悬念感。
   */
  withSuspenseHook(hook: string) {
    this.variables.suspense_hook = hook;
    return this;
  }

  /** 用户指定的知识库检索关键词（追加到向量搜索 query） */
  withKnowledgeQueryHint(hint: string) {
    this.variables.knowledge_query_hint = hint;
    return this;
  }
}

/**
 * 审稿/审查专用 Builder
 */
export class ReviewPromptBuilder extends BasePromptBuilder {
  withChapterContent(content: string) {
    this.variables.chapter_content = content;
    return this;
  }

  withCharacterStates(states: string) {
    this.variables.character_states = states;
    return this;
  }

  withGlobalSummary(summary: string) {
    this.variables.global_summary = summary;
    return this;
  }

  withWorldBuilding(world: string) {
    this.variables.world_building = world;
    return this;
  }

  /** 审稿维度侧重点（角色一致性/世界观合理性/剧情逻辑等） */
  withReviewFocus(focus: string) {
    this.variables.review_focus = focus;
    return this;
  }
}

/**
 * 定稿后处理专项 Builder
 */
export class PostProcessPromptBuilder extends BasePromptBuilder {
  withChapterContent(content: string) {
    this.variables.chapter_content = content;
    return this;
  }

  withChapterNumber(num: string | number) {
    this.variables.chapter_number = String(num);
    return this;
  }

  withChapterTitle(title: string) {
    this.variables.chapter_title = title;
    return this;
  }

  withExistingCardsJson(json: string | object) {
    this.variables.existing_cards_json = typeof json === 'string'
      ? json
      : JSON.stringify(json, null, 2);
    return this;
  }

  /**
   * 资源清单（W6b）：**只喂名字与单位**。
   *
   * 类型上就只收这两个字段是一种刻意设计：`earn_note` / `cost_note` / `anchor_value`
   * 一旦进了提示词，模型会顺手拿费率算出「本章应该拿多少」，那是判据 DK 明确禁止的
   * 「模型做算术」—— 而且它算错的数会看起来和正文一样可信。
   */
  withResourcesJson(resources: string | ReadonlyArray<{ name: string; unit: string }>) {
    this.variables.resources_json = typeof resources === 'string'
      ? resources
      : JSON.stringify(resources.map(({ name, unit }) => ({ name, unit })), null, 2);
    return this;
  }
}

/**
 * 架构生成与逆向推演 Builders
 */
export class ArchitecturePromptBuilder extends BasePromptBuilder {
  withGenre(genre: string) {
    this.variables.genre = genre;
    return this;
  }
  
  withSubGenre(subGenre: string) {
    this.variables.sub_genre = subGenre;
    return this;
  }

  withTopic(topic: string) {
    this.variables.topic = topic;
    return this;
  }

  withTargetAudience(audience: string) {
    this.variables.target_audience = audience;
    return this;
  }

  withNumberOfChapters(num: string | number) {
    this.variables.number_of_chapters = String(num);
    return this;
  }

  withWordNumber(num: string | number) {
    this.variables.word_number = String(num);
    return this;
  }

  withCoreSetting(setting: string) {
    this.variables.core_setting = setting;
    return this;
  }

  withGoldenFinger(finger: string) {
    this.variables.golden_finger = finger;
    return this;
  }

  withProtagonistProfile(profile: string) {
    this.variables.protagonist_profile = profile;
    return this;
  }

  withGlobalGuidance(guidance: string) {
    this.variables.global_guidance = guidance;
    return this;
  }

  withCoreSeed(seed: string) {
    this.variables.premise = seed;
    return this;
  }

  withCharacterDynamics(dynamics: string) {
    this.variables.character_dynamics = dynamics;
    return this;
  }

  withWorldBuilding(world: string) {
    this.variables.world_building = world;
    return this;
  }

  withPlotStructureGuide(guide: string) {
    this.variables.plot_structure_guide = guide;
    return this;
  }

  /** 平台节奏画像（v7 弧光层）。空串 = 中性，模板里的【节奏推荐】整段会被裁掉。 */
  withRhythmProfile(profile: string) {
    this.variables.rhythm_profile = profile;
    return this;
  }

  withNarrativePov(pov: string) {
    this.variables.narrative_pov = pov;
    return this;
  }
  
  withUserIdea(idea: string) {
    this.variables.user_idea = idea;
    return this;
  }

  /** 逐步指导（每步可选的补充说明） */
  withStepGuidance(guidance: string) {
    this.variables.step_guidance = guidance;
    return this;
  }

  /** 参考作品 */
  withReferenceWorks(works: string) {
    this.variables.reference_works = works;
    return this;
  }
}

/**
 * 目录细纲生成 Builders
 */
export class DirectoryPromptBuilder extends BasePromptBuilder {
  withNovelArchitecture(arch: string) {
    this.variables.novel_architecture = arch;
    return this;
  }

  withNumberOfChapters(num: string | number) {
    this.variables.number_of_chapters = String(num);
    return this;
  }

  withGlobalGuidance(guidance: string) {
    this.variables.global_guidance = guidance;
    return this;
  }

  withGenre(genre: string) {
    this.variables.genre = genre;
    return this;
  }

  withChapterList(list: string) {
    this.variables.chapter_list = list;
    return this;
  }

  withN(n: string | number) {
    this.variables.n = String(n);
    return this;
  }

  withM(m: string | number) {
    this.variables.m = String(m);
    return this;
  }

  /** 节奏/风格指导（如"前30章快节奏，每章一爽点"） */
  withPacingGuidance(guidance: string) {
    this.variables.pacing_guidance = guidance;
    return this;
  }
}

/**
 * 导入小说专用 Builder
 * 用于逆向推演（向量采样增强版配置推演 & 单章蓝图推演）
 */
export class ImportPromptBuilder extends BasePromptBuilder {
  /** 向量检索：世界观与力量体系片段 */
  withSampledWorldview(content: string) {
    this.variables.sampled_worldview = content;
    return this;
  }

  /** 向量检索：主角设定与金手指片段 */
  withSampledProtagonist(content: string) {
    this.variables.sampled_protagonist = content;
    return this;
  }

  /** 向量检索：核心矛盾与敌对势力片段 */
  withSampledConflict(content: string) {
    this.variables.sampled_conflict = content;
    return this;
  }

  /** 向量检索：写作风格与叙事视角片段 */
  withSampledStyle(content: string) {
    this.variables.sampled_style = content;
    return this;
  }

  /** 第一章正文 */
  withFirstChapter(content: string) {
    this.variables.first_chapter = content;
    return this;
  }

  /** 最新一章正文 */
  withLatestChapter(content: string) {
    this.variables.latest_chapter = content;
    return this;
  }

  /** 已有总章数 */
  withTotalChapters(num: number | string) {
    this.variables.total_chapters = String(num);
    return this;
  }

  /** 本章正文全文（单章蓝图推演用） */
  withChapterContent(content: string) {
    this.variables.chapter_content = content;
    return this;
  }

  /** 章节序号 */
  withChapterNumber(num: number | string) {
    this.variables.chapter_number = String(num);
    return this;
  }

  /** 章节标题 */
  withChapterTitle(title: string) {
    this.variables.chapter_title = title;
    return this;
  }

  /** 全局配置脱水版 */
  withNovelConfigSummary(summary: string) {
    this.variables.novel_config_summary = summary;
    return this;
  }

  /** 旧版兼容：sample_content（infer_novel_config 原始 Prompt 用） */
  withSampleContent(content: string) {
    this.variables.sample_content = content;
    return this;
  }
}
