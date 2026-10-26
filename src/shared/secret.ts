/**
 * 秘密宿体（secrets）—— P20-2（2026-10-26，作者裁定「新表 + 审稿守卫」）。
 *
 * ## 它回答什么问题
 *
 * 「这本书里有哪几个秘密、谁在捂、谁还不知道、计划第几章穿。」世界观第 3 维【隐喻与深层危机】
 * 写的就是这些（谁在隐瞒什么 / 真相揭开会颠覆什么），但它**是纯散文**：没有表格、没有列定义、
 * 没有机读行 ⇒ 没有可抽的源。所以本期只建**宿体 + 登记 + 守卫**，「抽取」要另立一项
 * （先给第 3 维加机读行，那是改 prompt，撞判据 AO）。
 *
 * ## 为什么不是 M16 的第二种键（裁定 A 的理由，逐条可核）
 *
 * M16 `knowledge_states` 的四道硬约束，每一条都与「秘密」的语义相反：
 *
 * | M16 | 秘密 | 结果 |
 * |---|---|---|
 * | `fact_chapter INTEGER NOT NULL CHECK(>0)` | 揭穿前**没有章号** | 必须放宽 CHECK，封闭默认被拆 |
 * | `fact_evidence` + hash 均 NOT NULL | 第 3 维是散文，**无定稿引文可挂** | 列永远填不满 |
 * | `UNIQUE(character_id, fact_key)` | 一个秘密 N 个知情者 | 分裂成 N 行（判据 DE 同型） |
 * | `REFERENCES characters` NOT NULL | 隐瞒者可能是**势力**不是具名角色 | 第 2 维的势力放不下 |
 *
 * 更根本的区别是问题不同：M16 问「他在第几章知道的」，秘密问「**谁还不知道**、第几章会穿」。
 * 「隐瞒者」与「知情者」不是同一个集合（隐瞒者知道，但他不会说；被骗者不知道），
 * 把两者塞进一个 `character_id` 列就再也分不开了。
 *
 * ## ★ 真相本体绝不进正文提示词（判据 DP 同族）
 *
 * 第 3 维在正文链里是**整维跳过**的（`worldbuilding-rules.ts:193-194`，判据 DP 防剧透）。
 * 秘密的 `detail`（真相本体）比第 3 维原文更直白 —— 一旦注入正文，模型会当场把谜底写出来。
 *
 * 所以本模块的渲染函数**只有一个消费者：审稿链**。
 * `renderSecretReviewSection` 的用途是让审稿员**检查正文有没有提前泄密**，
 * 不是给正文模型做提示。`generate-draft` 那条链从不 import 本文件（有测试钉住）。
 *
 * ## 状态不落表
 *
 * 「已揭穿 / 未揭穿」由 `revealChapter` 与被审章号**推导**，不存 `status` 列。
 * 存一份冗余状态就有两个真相：改了揭穿章忘了改状态，审稿员会按旧状态判。
 *
 * `revealChapter === null` 的语义是「作者还没决定第几章穿」，不是「永不揭穿」——
 * 这种秘密在**任何**一章都按「未揭穿」对待（保守方向：宁可多拦，不可漏放）。
 */
import type { WritingLanguage } from './writing-language'

/** 来源：本期只有作者登记；留 `derived` 是为了以后从第 3 维抽取时不改表。 */
export type SecretSource = 'author' | 'derived'

/** 一条秘密。 */
export interface SecretDefinition {
  secretId: string
  /** 秘密名（一句话，作者读得懂；也是 UNIQUE 键）。 */
  title: string
  /** **真相本体**。只在登记页与审稿链可见，**绝不进正文提示词**。 */
  detail: string
  /** 隐瞒者（谁在捂）。存名字不存 id，理由见文件头与 `SecretInput` 注释。 */
  holders: string[]
  /** 尚不知情者（被骗的一方）。空数组 = 作者没填，**不等于「没有人不知道」**。 */
  unaware: string[]
  /** 计划第几章揭穿；`null` = 还没决定（按「未揭穿」保守对待）。 */
  revealChapter: number | null
  /** 出处：第 3 维原文的逐字引文（可空，只在登记页可见）。 */
  evidence: string
  source: SecretSource
  createdAt: string
  updatedAt: string
}

/**
 * 写入入参。
 *
 * **隐瞒者 / 尚不知情者存名字，不存 `character_id`**（与 M16 的有意差异）：
 * ① 第 2 维的势力（宗门、商会）不是 `characters` 行；
 * ② 写世界观时角色卡常常还没建，强制外键会让作者填不进去；
 * ③ 一个秘密的知情面常是「一群人」，逐个建卡是过度建模。
 * 代价是改名后脱钩 —— 将来若要做跨实体一致性检查，再加 `holder_ids` 列，不动现有列。
 */
export interface SecretInput {
  secretId?: string
  title: string
  detail: string
  holders?: string[]
  unaware?: string[]
  revealChapter?: number | null
  evidence?: string
}

export interface SecretWriteResult {
  success: boolean
  secretId?: string
  error?: string
}

export interface SecretDeleteResult {
  success: boolean
  error?: string
}

/** 秘密名 / 隐瞒者名字 / 出处的长度上限（与其它登记页 200 同口径）。 */
export const SECRET_TEXT_MAX = 200
/** 真相本体的长度上限：它比名字长，但仍须是「一句话真相」而不是原文段落。 */
export const SECRET_DETAIL_MAX = 600
/** 一次最多登记多少条秘密（一节审稿清单的合理上限）。 */
export const SECRET_MAX_ITEMS = 8
/** 守卫节正文总字数上限（不含节标题与说明句）。 */
export const SECRET_MAX_CHARS = 720

/** 一条秘密在某一章的状态（推导，不落表）。 */
export type SecretChapterState = 'undecided' | 'pending' | 'revealed-now' | 'already-revealed'

/**
 * 这条秘密在被审的章里处于什么状态。
 *
 * - `undecided`：作者没填揭穿章 ⇒ 任何章都按未揭穿处理（保守方向）；
 * - `pending`：揭穿章在本章之后 ⇒ 本章**不得**写出真相；
 * - `revealed-now`：揭穿章就是本章 ⇒ 本章允许写，且应当写；
 * - `already-revealed`：揭穿章已过 ⇒ 不再是秘密，不参与守卫（否则每章都在提醒作者「别泄密」，
 *   而它早就穿过了 —— 那会把守卫节变成噪音，作者会开始忽略它）。
 */
export function secretChapterState(
  secret: Pick<SecretDefinition, 'revealChapter'>,
  chapterNumber: number,
): SecretChapterState {
  if (secret.revealChapter === null || !Number.isSafeInteger(secret.revealChapter)) return 'undecided'
  if (secret.revealChapter === chapterNumber) return 'revealed-now'
  return secret.revealChapter > chapterNumber ? 'pending' : 'already-revealed'
}

/** 这一章是否需要用这条秘密做守卫（`already-revealed` 之外都要）。 */
export function secretGuardsChapter(
  secret: Pick<SecretDefinition, 'revealChapter'>,
  chapterNumber: number,
): boolean {
  return secretChapterState(secret, chapterNumber) !== 'already-revealed'
}

/**
 * 压掉换行。
 *
 * 调用方（`review-continuity-bible` 的 `collapseNewlines`）会压**顶层字符串**，但压不到
 * 名字数组里的元素 —— 一条登记的名字里带换行，就能在提示词里伪造出一行 `- ` 条目。
 * 所以渲染入口自己再压一遍，不依赖调用方有没有做。
 */
function flatten(value: string): string {
  return value.replace(/\r?\n/gu, ' ').trim()
}

/** 把「未填」和「填了空」区分开：空数组在渲染时显式写成「未填」，不写成「没有人」。 */
function namesLine(names: readonly string[], isEn: boolean, labelZh: string, labelEn: string): string {
  const filled = names.map(name => flatten(name)).filter(Boolean)
  const value = filled.length > 0 ? filled.join(isEn ? ', ' : '、') : (isEn ? 'not filled in' : '未填')
  // 冒号必须跟语言走：英文用半角，否则 `hiders：x` 中英混排。
  return `${isEn ? labelEn : labelZh}${isEn ? ': ' : '：'}${value}`
}

/**
 * 一条秘密在审稿清单里的**唯一**渲染入口（与 `renderKnowledgeLine` 同族纪律：一种写法，不分叉）。
 *
 * 这一行**含 `detail`（真相本体）** —— 所以它只能进审稿链。正文链若调用它，
 * 等于把谜底直接塞给写手模型。文件头写了这条，测试也钉了。
 */
export function renderSecretReviewLine(
  secret: SecretDefinition,
  chapterNumber: number,
  writingLanguage: WritingLanguage,
): string {
  const isEn = writingLanguage === 'en-US'
  const state = secretChapterState(secret, chapterNumber)
  const reveal = secret.revealChapter === null
    ? (isEn ? 'reveal chapter not decided' : '揭穿章未定')
    : (isEn ? `planned reveal: Chapter ${secret.revealChapter}` : `计划揭穿：第${secret.revealChapter}章`)
  const head = isEn
    ? `- Secret: ${flatten(secret.title)} | truth: ${flatten(secret.detail)}`
    : `- 秘密：${flatten(secret.title)}｜真相：${flatten(secret.detail)}`
  const tail = [
    namesLine(secret.holders, isEn, '隐瞒者', 'hiders'),
    namesLine(secret.unaware, isEn, '尚不知情', 'unaware'),
    reveal,
  ]
  // 揭穿章就是本章时必须明说：审稿员不能把「本章该揭穿」判成「本章泄密」。
  const flag = state === 'revealed-now'
    ? (isEn ? 'this is the planned reveal chapter' : '本章就是计划揭穿章')
    : ''
  return [head, ...tail, flag].filter(Boolean).join(isEn ? '; ' : '；')
}

const ZH_LEAD = [
  '以下是本书尚未揭穿的秘密（作者登记）。**判定依据：正文若在被审章写出了「真相」栏的内容，判为提前泄密。**',
  '只写到「有人在遮掩 / 暗示 / 回避」不算泄密；行尾标注「本章就是计划揭穿章」的那条不算泄密（那正是它该穿的时候）。',
  '写不出真相、但让角色知道了不该知道的事，按知情格判。',
  '「尚不知情」栏为「未填」时，只说明作者没登记，**不得据此推断没有任何人不知道**。',
].join('')
const EN_LEAD = [
  'Secrets of this book that are not yet revealed (author-registered). ',
  '**Rule: if the reviewed chapter states the truth shown in the "truth" field, that is a premature reveal.** ',
  'Hints, avoidance, or someone being evasive are not leaks; a line flagged "this is the planned reveal chapter" is not a leak either (that is exactly when it should come out). ',
  'A character learning something they should not know is judged by the knowledge-state grid instead. ',
  'When "unaware" reads "not filled in", it only means the author did not register it; never infer that nobody is unaware.',
].join('')

/**
 * 渲染【秘密守卫（未揭穿的真相）】整节；没有可守卫的条目就返回**空串**（不产只有标题的空节）。
 *
 * @param chapterNumber 被审的章号。守卫与章号强相关：同一份登记在第 5 章和第 40 章
 *   结论不同，所以章号是必填参数，没有默认值 —— 给默认值就等于允许调用方不思考期界。
 * @param maxChars 正文行总字数上限；预算外**整条丢弃**（不截半行：半行真相会被读成另一件事）。
 */
export function renderSecretReviewSection(
  entries: readonly SecretDefinition[],
  chapterNumber: number,
  writingLanguage: WritingLanguage,
  maxChars: number = SECRET_MAX_CHARS,
): string {
  const isEn = writingLanguage === 'en-US'
  const usable = entries
    .filter(entry => entry.title.trim() && entry.detail.trim())
    .filter(entry => secretGuardsChapter(entry, chapterNumber))
    // 揭穿章越近越该看一眼；未定揭穿章的排后面（它们最不确定）。
    .sort((left, right) => {
      const rank = (secret: SecretDefinition) => secret.revealChapter ?? Number.MAX_SAFE_INTEGER
      return rank(left) - rank(right)
        || (left.title < right.title ? -1 : left.title > right.title ? 1 : 0)
    })
  const lines: string[] = []
  let used = 0
  for (const entry of usable.slice(0, SECRET_MAX_ITEMS)) {
    const line = renderSecretReviewLine(entry, chapterNumber, writingLanguage)
    const next = line.length + (lines.length > 0 ? 1 : 0)
    if (used + next > maxChars) break
    lines.push(line)
    used += next
  }
  if (lines.length === 0) return ''
  const heading = isEn ? '[Secret guard (truth not yet revealed)]' : '【秘密守卫（未揭穿的真相）】'
  return `${heading}\n${isEn ? EN_LEAD : ZH_LEAD}\n${lines.join('\n')}`
}
