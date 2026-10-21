/**
 * 归位表（W4a）：把「系统已经说出口的名字」对账到落点。
 *
 * 为什么需要它：正文之外有三条链各自会提到人名 —— 审稿的 `stateDelta`、定稿后处理的
 * 候选、蓝图的人物清单。任何一条提到一个名字，后续都要做「这个名字对应哪张卡」的判断；
 * 判断不出来就**静默跳过**（W3 的边界，见设计稿 §16.8）。跳过本身是对的（不猜），
 * 但**没人统计过跳过了什么**，于是「小郑出现 29 次、老张头 15 次、老赵 5 次却没有卡」
 * 这种事实只能靠人工 grep 才能发现。
 *
 * ★ **本模块刻意不从正文里抽名字。**
 * 中文人名没有形态学标记，「他走进药铺」和「王德发走进药铺」在字符层面同构。用规则或
 * 词表去抽，抽错一次就制造一批假孤儿，而假孤儿会直接变成作者要一条条处理的待办 ——
 * 那正是判据 CX 要防的形态。所以只对账**已经被模型点名过的名字**：这些名字本身就是
 * 证据，只是缺落点。
 *
 * ★ **本模块刻意不持久化。**
 * 归位表是「当前状态」，不是「历史记录」。存一份下来，作者建完卡它也还在，就变成永远
 * 无法应用的项（判据 CX）。每次从三处输入现算，解决掉就自动消失。
 */

/** 名字被哪条链提到过。 */
export type CastLedgerMentionSource =
  /** 审稿报告 v3 的 `stateDelta[].characterName` */
  | 'review-state-delta'
  /** 定稿后处理的角色状态候选 */
  | 'finalized-proposal'
  /** 蓝图 / 章节大纲的人物清单 */
  | 'blueprint'

export interface CastLedgerMention {
  name: string
  source: CastLedgerMentionSource
  /** 提及发生在第几章；未知则不给。 */
  chapterNumber?: number
}

/** 归位表的一档状态。四档而不是三档，见下面各自的注释。 */
export type CastLedgerStatus =
  /** 恰好命中一张未退休的卡。可写。 */
  | 'carded'
  /** 命中多张卡 —— 恰恰是归位表要报出来的真问题：写不知道写谁。 */
  | 'ambiguous'
  /** 作者已判为锚点人物（`character_cast_decisions` 的 `register`）：有意不建卡。 */
  | 'anchored'
  /** 提到过，但既无卡也未判定 —— 唯一的待办。 */
  | 'orphan'

export interface CastLedgerCharacter {
  characterId: string
  /** 当前显示名。 */
  name: string
  /** 曾用名 / 别名。 */
  aliases?: readonly string[]
  /** 退休卡不参与归位：`characters.retired=1` 的卡是建卡→补全→退休的正常产物。 */
  retired?: boolean
}

export interface CastLedgerAnchor {
  name: string
  anchorRole: string
}

export interface CastLedgerEntry {
  name: string
  status: CastLedgerStatus
  /** `carded` / `ambiguous` 时为命中的卡；其余为空。 */
  characterIds: string[]
  /** 仅 `anchored`：作者登记时写的角色定位。 */
  anchorRole?: string
  /** 提及来源，去重且按首次出现顺序；有界。 */
  mentions: CastLedgerMention[]
}

/** 每个名字最多保留几条提及 —— 归位表是清单不是日志，够判断「确实出现过」即可。 */
const MAX_MENTIONS_PER_NAME = 5

function normalizeName(name: string): string {
  return name.trim()
}

/**
 * 名字 → 卡集合。**别名与显示名等价**：作者给一张卡加过旧名，说明这两个字符串指的是
 * 同一个人；不映射会让改过名的卡被报成孤儿，作者照着建第二张卡，才是真造出重名。
 */
function indexCharacters(characters: readonly CastLedgerCharacter[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const character of characters) {
    // 退休卡不参与：它不是「没人管」，是「已经管过并退休」。参与进去会让状态从 orphan
    // 变成 carded，然后写回时才发现卡不能写。
    if (character.retired) continue
    const labels = [character.name, ...(character.aliases ?? [])]
    for (const label of labels) {
      const key = normalizeName(label)
      if (!key) continue
      const ids = index.get(key) ?? []
      if (!ids.includes(character.characterId)) ids.push(character.characterId)
      index.set(key, ids)
    }
  }
  return index
}

function statusOf(ids: string[] | undefined, anchored: boolean): CastLedgerStatus {
  if (ids && ids.length === 1) return 'carded'
  // 多张卡命中：不猜，也不当孤儿。它需要的是作者指定是哪一张，动作和「建卡」不一样。
  if (ids && ids.length > 1) return 'ambiguous'
  // 有卡在先，「已判锚点」不该覆盖它 —— 先建的卡比后补的判定更具体。
  return anchored ? 'anchored' : 'orphan'
}

/**
 * 对账并产出归位表。
 *
 * 输入三处，输出按「待办优先」排序：`orphan` → `ambiguous` → `anchored` → `carded`。
 * 顺序不是美观：作者打开这张表是为了处理问题，路径最短的那批要排在最上面。
 */
export function buildCastLedger(
  characters: readonly CastLedgerCharacter[],
  anchors: readonly CastLedgerAnchor[],
  mentions: readonly CastLedgerMention[],
): CastLedgerEntry[] {
  const characterIndex = indexCharacters(characters)
  const anchorIndex = new Map<string, string>()
  for (const anchor of anchors) {
    const key = normalizeName(anchor.name)
    if (key && !anchorIndex.has(key)) anchorIndex.set(key, anchor.anchorRole)
  }

  const byName = new Map<string, CastLedgerMention[]>()
  for (const mention of mentions) {
    const key = normalizeName(mention.name)
    if (!key) continue
    const list = byName.get(key) ?? []
    // 同一条链在同一章只说一次；重复只说明多条链都提到了它，那由 source 去重体现。
    if (list.some(item => item.source === mention.source && item.chapterNumber === mention.chapterNumber)) continue
    if (list.length < MAX_MENTIONS_PER_NAME) list.push({ ...mention, name: key })
    byName.set(key, list)
  }

  const entries: CastLedgerEntry[] = []
  for (const [name, nameMentions] of byName) {
    const ids = characterIndex.get(name) ?? []
    const anchorRole = anchorIndex.get(name)
    const status = statusOf(ids, anchorRole !== undefined)
    entries.push({
      name,
      status,
      characterIds: ids,
      ...(status === 'anchored' && anchorRole ? { anchorRole } : {}),
      mentions: nameMentions,
    })
  }

  const rank: Record<CastLedgerStatus, number> = { orphan: 0, ambiguous: 1, anchored: 2, carded: 3 }
  return entries.sort((left, right) => rank[left.status] - rank[right.status]
    || left.name.localeCompare(right.name, 'zh-Hans-CN'))
}

/** 只要待办：作者打开归位表时最先关心的那一批。 */
export function castLedgerTodos(entries: readonly CastLedgerEntry[]): CastLedgerEntry[] {
  return entries.filter(entry => entry.status === 'orphan' || entry.status === 'ambiguous')
}
