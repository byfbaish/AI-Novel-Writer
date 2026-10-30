/**
 * ProjectCoreRepository — 项目主台账 (project_core 表)
 *
 * 合并 NovelConfig + 架构四大件的统一读写。
 * 始终只有一行数据 (id = 'main')。
 */
import { getProjectDb } from '../database'
import { CREATIVE_STRATEGIES, type CreativeStrategy } from '../../src/shared/reasoning-types'
import { expandChapterRange, type UpstreamDomain } from '../../src/shared/upstream-revisions'
import { UpstreamRevisionRepository } from './upstream-revision-repository'
import {
    DEFAULT_WRITING_LANGUAGE,
    resolveWritingLanguage,
    type WritingLanguage,
} from '../../src/shared/writing-language'
import { resolveNarrativeThreadDormantThreshold } from '../../src/shared/narrative-thread'

/** project_core 表行类型 */
export interface ProjectCoreRow {
    id: string
    project_name: string
    genre: string
    sub_genre: string
    target_audience: string
    total_chapters: number
    words_per_chapter: number
    writing_language: string
    creative_strategy: string
    narrative_thread_dormant_threshold: number
    plot_structure: string
    narrative_pov: string
    writing_style: string
    reference_works: string
    global_guidance: string
    golden_finger: string
    core_outline: string
    world_setting: string
    protagonist_profile: string
    premise: string
    worldbuilding: string
    characters_arch: string
    plot_structure_plan: string
    /** 平台节奏画像（v7 弧光层）；空 = 中性，不回退到任何平台。 */
    rhythm_profile: string
    synopsis: string
    character_states: string
    created_at: string
    updated_at: string
}

/** 前端使用的驼峰命名接口 */
export interface ProjectCoreData {
    projectName: string
    genre: string
    subGenre: string
    targetAudience: string
    totalChapters: number
    wordsPerChapter: number
    writingLanguage: WritingLanguage
    creativeStrategy: CreativeStrategy
    narrativeThreadDormantChapterThreshold: number
    plotStructure: string
    narrativePov: string
    writingStyle: string
    referenceWorks: string
    globalGuidance: string
    goldenFinger: string
    coreOutline: string
    worldSetting: string
    protagonistProfile: string
    premise: string
    worldbuilding: string
    charactersArch: string
    /** 第五层「弧光结构 / 自由弧」全文；空则消费点回退到 plotStructure 枚举模板。 */
    plotStructurePlan: string
    /** 平台节奏画像（起点向 / 番茄向 / 自定义）；空 = 中性，不给模型任何节奏推荐。 */
    rhythmProfile: string
    synopsis: string
    characterStates: string
}

export type ProjectCoreSynopsisExpected = Pick<ProjectCoreData,
    | 'synopsis'
    | 'premise'
    | 'charactersArch'
    | 'worldbuilding'
    | 'plotStructurePlan'
    | 'genre'
    | 'totalChapters'
    | 'wordsPerChapter'
    | 'writingLanguage'
    | 'plotStructure'
    | 'narrativePov'
    | 'globalGuidance'
>

export interface ProjectCoreSynopsisCommitRequest {
    synopsis: string
    expected: ProjectCoreSynopsisExpected
    generationRunHandle?: import('../../src/services/generation/generation-runtime').MainGenerationRunHandle
    authorRecovery?: import('../../src/shared/plot-outline-contract').PlotOutlineAuthorEdit
}

/** 数据库行 → 前端数据 */
function rowToData(row: ProjectCoreRow): ProjectCoreData {
    return {
        projectName: row.project_name,
        genre: row.genre,
        subGenre: row.sub_genre,
        targetAudience: row.target_audience,
        totalChapters: row.total_chapters,
        wordsPerChapter: row.words_per_chapter,
        writingLanguage: resolveWritingLanguage(row.writing_language),
        creativeStrategy: (
            CREATIVE_STRATEGIES.includes(row.creative_strategy as CreativeStrategy)
                ? row.creative_strategy
                : 'auto'
        ) as CreativeStrategy,
        narrativeThreadDormantChapterThreshold: resolveNarrativeThreadDormantThreshold(
            row.narrative_thread_dormant_threshold,
        ),
        plotStructure: row.plot_structure,
        narrativePov: row.narrative_pov,
        writingStyle: row.writing_style,
        referenceWorks: row.reference_works,
        globalGuidance: row.global_guidance,
        goldenFinger: row.golden_finger,
        coreOutline: row.core_outline,
        worldSetting: row.world_setting,
        protagonistProfile: row.protagonist_profile,
        premise: row.premise,
        worldbuilding: row.worldbuilding,
        charactersArch: row.characters_arch,
        plotStructurePlan: row.plot_structure_plan,
        rhythmProfile: row.rhythm_profile ?? '',
        synopsis: row.synopsis,
        characterStates: row.character_states,
    }
}

export class ProjectCoreRepository {
    /** 获取项目配置（不存在则返回 null） */
    static get(db = getProjectDb()): ProjectCoreData | null {
        if (!db) return null

        const row = db.prepare(
            'SELECT * FROM project_core WHERE id = ?'
        ).get('main') as ProjectCoreRow | undefined

        return row ? rowToData(row) : null
    }

    /** 初始化项目配置（创建项目时调用） */
    static init(
        projectName: string,
        writingLanguage: WritingLanguage = DEFAULT_WRITING_LANGUAGE,
    ): void {
        const db = getProjectDb()
        if (!db) return

        db.prepare(`
      INSERT OR IGNORE INTO project_core (id, project_name, writing_language)
      VALUES ('main', ?, ?)
    `).run(projectName, writingLanguage)
    }

    /** 更新项目配置（传入部分字段即可） */
    static update(data: Partial<ProjectCoreData>, db = getProjectDb()): void {
        if (!db) throw new Error('项目数据库未打开')
        if (Object.hasOwn(data, 'charactersArch')) {
            throw new Error('角色图谱由角色名单自动生成；请通过角色管理修改角色资料')
        }

        // 构建动态 SET 子句，只更新传入的字段
        const fieldMap: Record<string, string> = {
            projectName: 'project_name',
            genre: 'genre',
            subGenre: 'sub_genre',
            targetAudience: 'target_audience',
            totalChapters: 'total_chapters',
            wordsPerChapter: 'words_per_chapter',
            writingLanguage: 'writing_language',
            creativeStrategy: 'creative_strategy',
            narrativeThreadDormantChapterThreshold: 'narrative_thread_dormant_threshold',
            plotStructure: 'plot_structure',
            narrativePov: 'narrative_pov',
            writingStyle: 'writing_style',
            referenceWorks: 'reference_works',
            globalGuidance: 'global_guidance',
            goldenFinger: 'golden_finger',
            coreOutline: 'core_outline',
            worldSetting: 'world_setting',
            protagonistProfile: 'protagonist_profile',
            premise: 'premise',
            worldbuilding: 'worldbuilding',
            plotStructurePlan: 'plot_structure_plan',
            rhythmProfile: 'rhythm_profile',
            synopsis: 'synopsis',
            characterStates: 'character_states',
        }

        const setClauses: string[] = []
        const values: unknown[] = []

        for (const [camel, col] of Object.entries(fieldMap)) {
            if (camel in data) {
                setClauses.push(`${col} = ?`)
                const value = (data as Record<string, unknown>)[camel]
                values.push(camel === 'narrativeThreadDormantChapterThreshold'
                    ? resolveNarrativeThreadDormantThreshold(value)
                    : value)
            }
        }

        if (setClauses.length === 0) return

        // 追加 updated_at
        setClauses.push("updated_at = datetime('now')")
        values.push('main')

        // P2-2：内容写入与上游版本 +1 必须原子（M24，2026-10-30）。
        //
        // 分三条独立语句跑的话，「内容改了、版本没加」是会发生的 —— 那一刻下游派生
        // 仍被判 valid，而它基于的东西已经变了，正是这套机制要消灭的静默消费。
        // 反过来（版本加了、内容没改）只是多算一次脏，代价可接受，所以方向取得保守。
        //
        // 按**实际传入的字段**分派域，不按「调了一次接口」：一次 update 可能同时改
        // 世界观与弧光（设置面板批量保存），只 bump 一个域就会漏另一个。
        //
        // 只记「会改变下游生成前提」的四个字段，不记全部 —— `worldSetting`（作者配的
        // 世界设定）、`coreOutline`、`goldenFinger` 是**给模型的配料**，它们的最终消费
        // 者是架构生成，而架构生成落盘时又会写 `worldbuilding` / `synopsis`，在那条
        // 路径上自然 bump。把配料也算进来只会制造「改了一个不影响的字段，全库标脏」。
        db.transaction(() => {
            db.prepare(`
      UPDATE project_core SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values)

            const touched: UpstreamDomain[] = []
            // `premise` 与 `worldbuilding` 同属「这个世界是什么」：前提一变，世界观与
            // 卷纲的依据就变了，下游不该还认为自己有效。
            if ('worldbuilding' in data || 'premise' in data) touched.push('worldbuilding')
            if ('plotStructurePlan' in data) touched.push('arc')
            // `synopsis` 的主路径是 `commitSynopsis`（带 CAS 与作者手改记录），但设置面板
            // 也可能直接写它。漏了这条，「作者在设置里改了大纲」就完全不留痕。
            if ('synopsis' in data) touched.push('outline')
            for (const domain of touched) UpstreamRevisionRepository.bump({ domain }, db)
        })()
    }

    static commitSynopsis(request: ProjectCoreSynopsisCommitRequest, db = getProjectDb()): boolean {
        if (!db) throw new Error('项目数据库未打开')
        const { expected } = request
        const result = db.prepare(`
          UPDATE project_core
          SET synopsis = ?, updated_at = datetime('now')
          WHERE id = 'main'
            AND synopsis = ?
            AND premise = ?
            AND characters_arch = ?
            AND worldbuilding = ?
            AND plot_structure_plan = ?
            AND genre = ?
            AND total_chapters = ?
            AND words_per_chapter = ?
            AND CASE WHEN writing_language = 'en-US' THEN 'en-US' ELSE 'zh-CN' END = ?
            AND plot_structure = ?
            AND narrative_pov = ?
            AND global_guidance = ?
        `).run(
            request.synopsis,
            expected.synopsis,
            expected.premise,
            expected.charactersArch,
            expected.worldbuilding,
            expected.plotStructurePlan,
            expected.genre,
            expected.totalChapters,
            expected.wordsPerChapter,
            expected.writingLanguage,
            expected.plotStructure,
            expected.narrativePov,
            expected.globalGuidance,
        )
        if (result.changes !== 1) return false
        // P2-2：大纲落盘 = 上游 +1（M24）。CAS 成功才 bump —— 版本必须描述
        // **真的发生了**的那次写入，不是"尝试过的那次"。失败分支不 bump。
        //
        // scope 记 `book`：这一条写的是整本 `synopsis` 文本，粒度就是全书。
        // 单元级（`outline:<unitId>`）由 E3 逐单元生成落盘时另记，期 2 接。
        //
        // `changed_chapters` 取作者这次提交覆盖的章区间展开：**期 1 只落数据不消费**，
        // 判定侧收窄要等派生侧开始记 `source_ref`（期 2）之后才有意义。
        UpstreamRevisionRepository.bump({
            domain: 'outline',
            changedChapters: request.authorRecovery
                ? expandChapterRange(request.authorRecovery.committedRange)
                : [],
        }, db)
        return true
    }

    /** 清空由架构/导入/AI 分析生成的创作字段，保留项目名、章节规模与基础偏好 */
    static resetCreativeFields(): void {
        ProjectCoreRepository.update({
            writingStyle: '',
            referenceWorks: '',
            globalGuidance: '',
            goldenFinger: '',
            coreOutline: '',
            worldSetting: '',
            protagonistProfile: '',
            premise: '',
            worldbuilding: '',
            plotStructurePlan: '',
            synopsis: '',
            characterStates: '',
        })
    }
}
