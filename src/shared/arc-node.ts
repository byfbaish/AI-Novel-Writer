import { isTurnField, minorRanges, parseArcStructure, scaledBoundaries } from './arc-position'

/**
 * 弧光结构位（P12-0a）。
 *
 * ## 为什么需要它
 *
 * 弧光块里早就写着硬规则「后续中弧的 goal / attempts / turning point 不得在本批出现」
 * （`arc-position.ts` 注入的【本批所处弧位】），但**不可判**：一条硬规则如果没有可引用的
 * 名字，就无法被检查、无法被记录、也无法被对账。
 *
 * 实测代价（2026-10-18 审计）：中弧 2（约 27–52 章）的「尝试 2：记事本笔谈」落在第 2 章、
 * 「转折：设计一次引导 → 代价落鲁传福头上」落在第 4 章 —— 提前约 25 章消耗掉。规则在，
 * 只是没人能证明它被违反了。到第 27 章真正该兑现时，只剩「重复」或「失效」。
 *
 * ## 关键设计：ID 由「位置」派生，不改任何数据
 *
 * 弧光结构是严格格式的自由文本，`parseArcStructure` 早已解析出 `majors[] → mids[] → fields[]`，
 * `scaledBoundaries` 早已处理「自报章数 ≠ 全书章数」的等比折算。所以结构位坐标可以直接由
 * 位置算出来：
 *
 * | 层 | ID | 例 |
 * |---|---|---|
 * | 大弧 | `M<大弧序号>` | `M1` |
 * | 中弧 | `M<大弧>-<弧内中弧序号>` | `M1-2` |
 * | 结构位 | `M<大弧>-<弧内中弧序号>/<字段名>` | `M1-2/转折` |
 * | 小弧 | `M<大弧>-<弧内中弧序号>/小弧:<小弧名>` | `M1-1/小弧:纸门牌` |
 *
 * ## 可声明的两类节点，语义并不相同（P12-3 / P12-4）
 *
 * - **转折** = **一次性额度**。一个中弧只有一个转折，只能被一章声明；两章都声明 ⇒
 *   超额兑现（INV-2）。
 * - **小弧** = **归属**。一个小弧天然跨 8–9 章（`M1-1/小弧:错位门牌 [1,8]`），这 8 章里
 *   每一章都属于它、都该声明它。**重复声明是常态，不是错误** —— 把它当一次性额度，会逼出
 *   「第 1–7 章写『覆盖：无』、只有第 8 章写 ID」这种结果：5 章里 4 章空白，声明失去信息量，
 *   而且第 3 章就声明（提前 5 章收束）反而看不出问题。
 *
 * 归属语义的副产品正是想要的信号：若第 4 章的内容已经推进到下一个小弧，模型会去声明
 * `M1-1/小弧:第一页报告 [9,16]` ⇒ **INV-1 直接报「提前 5 章」**。不需要另设「进度」规则。
 *
 * ## 与「整段规格」的边界
 *
 * 中弧的 因果 / 时序 / 目标 / 动机 / 路径 / 尝试 N 区间等于整个中弧，声明它们永远
 * 「不越界」，因而完全不产生信息。实测第 6 章用 `M1-1/时序`（= 本中弧起点，第 1 章
 * 就已发生）认领第 6 章，任何判定都不触发。
 *
 * 所以 `isClaimableArcNode()` 只认「转折」与「小弧」；`auditArcCovers` 的漏覆盖统计也只
 * 统计它们，否则「因果未声明」「时序未声明」会变成永远无法消除的噪音。
 *
 * ⚠️ 中弧用的是**本大弧内**的序号（与 `ArcSpan.midIndex` 同语义），**不是**原文里跨大弧
 * 连续编的「中弧 3」。原文 `### 中弧 3：沉默的报价` 在本表里是 `M2-1`。报告与 UI 必须
 * 同时给出 `midName`，否则人工核对会换算错。
 *
 * 因此**现有项目零改动、不需要重跑弧光**。这是本模块与 P11（要加 schema 列）最大的成本差异。
 *
 * ## 已知限制（P12-4 才解决）
 *
 * ID 依赖**位置**：作者若在中途插入/删除一个大弧或中弧，后续 ID 全部漂移，已写下的
 * `covers` 会指向错位。检测办法是给每个节点附文本指纹，指纹不匹配即提示复核。
 * 一期不做——先让结构位可见，比先保证它永不移位更有价值。
 *
 * @see docs/design/architecture/p12-arc-node-anchoring-design.md
 */

export type ArcNodeKind = 'major' | 'mid' | 'field' | 'minor'

export interface ArcNode {
  /** 稳定 ID：`M1` | `M1-2` | `M1-2/转折` | `M1-1/小弧:纸门牌`。 */
  id: string
  kind: ArcNodeKind
  /** 折算后的章号区间（闭区间，含两端）。 */
  range: readonly [number, number]
  /** 1-based 大弧序号。 */
  majorIndex: number
  /** 1-based 中弧序号（`kind === 'major'` 时为 undefined）。 */
  midIndex?: number
  majorName: string
  midName?: string
  /** 字段名（`kind === 'field'` 时有值），如「转折」「尝试 2」。 */
  field?: string
  /** 小弧名（`kind === 'minor'` 时有值），如「纸门牌」。 */
  minorName?: string
  /** 该结构位的原文：大弧/中弧是名称，字段是字段值，小弧是小弧名。 */
  text: string
}

export interface ArcCoverViolation {
  code: 'INV-1-OUT_OF_RANGE' | 'INV-2-DUPLICATE' | 'INV-3-UNCOVERED' | 'UNKNOWN_NODE' | 'COARSE_NODE' | 'NOT_CLAIMABLE'
  /** 触发违规的结构位 ID。 */
  id: string
  chapterNumber: number
  /** 期望区间（`UNKNOWN_NODE` 时无值）。 */
  range?: readonly [number, number]
  message: string
}

/**
 * 把弧光结构摊平成结构位清单（大弧 → 中弧 → 字段，按原文顺序）。
 *
 * 结构不可解析（没有可用的章数标注）或全书章数非法时返回空数组 —— 调用方据此
 * 跳过校验，与 `parseArcStructure` 的 fail-open 语义一致。
 */
export function listArcNodes(plan: string | null | undefined, totalChapters: number): ArcNode[] {
  if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return []
  const parsed = parseArcStructure(plan)
  if (!parsed) return []

  const nodes: ArcNode[] = []
  const majorBounds = scaledBoundaries(parsed.majors.map(item => item.chapters), totalChapters)

  parsed.majors.forEach((major, majorOffset) => {
    const majorIndex = majorOffset + 1
    const majorRange: readonly [number, number] = [majorBounds[majorOffset]! + 1, majorBounds[majorOffset + 1]!]
    nodes.push(Object.freeze({
      id: `M${majorIndex}`,
      kind: 'major' as const,
      range: majorRange,
      majorIndex,
      majorName: major.name,
      text: major.name,
    }))

    // 中弧的章数是**在本大弧跨度内**的相对刻度，必须用大弧长度做 total 再折算一次。
    const midBounds = scaledBoundaries(major.mids.map(item => item.chapters), majorRange[1] - majorRange[0] + 1)
    major.mids.forEach((mid, midOffset) => {
      const midIndex = midOffset + 1
      const midRange: readonly [number, number] = [
        majorRange[0] + midBounds[midOffset]!,
        majorRange[0] + midBounds[midOffset + 1]! - 1,
      ]
      nodes.push(Object.freeze({
        id: `M${majorIndex}-${midIndex}`,
        kind: 'mid' as const,
        range: midRange,
        majorIndex,
        midIndex,
        majorName: major.name,
        midName: mid.name,
        text: mid.name,
      }))

      // 结构位继承所属中弧的区间：`M1-2/转折` 的含义是「这一格属于 27–52 章」。
      for (const [field, value] of mid.fields) {
        nodes.push(Object.freeze({
          id: `M${majorIndex}-${midIndex}/${field}`,
          kind: 'field' as const,
          range: midRange,
          majorIndex,
          midIndex,
          majorName: major.name,
          midName: mid.name,
          field,
          text: value,
        }))
      }

      // 小弧（P12-3）：自带章数，在本中弧区间内**再折算一次** —— 这是整条链上唯一
      // 能落到「第 10–18 章」这种精度的层级，也是唯一能证明「某格被提前了 25 章」的单位。
      // 折算走 `minorRanges`（与渲染注入块共用），两处各算一份必然漂移。
      for (const minor of minorRanges(mid.minors, midRange)) {
        nodes.push(Object.freeze({
          id: `M${majorIndex}-${midIndex}/小弧:${minor.name}`,
          kind: 'minor' as const,
          range: minor.range,
          majorIndex,
          midIndex,
          majorName: major.name,
          midName: mid.name,
          minorName: minor.name,
          text: minor.name,
        }))
      }
    })
  })

  return nodes
}

export function findArcNode(nodes: readonly ArcNode[], id: string): ArcNode | undefined {
  return nodes.find(node => node.id === id)
}

/**
 * 该节点能否出现在一章的「覆盖：」声明里。
 *
 * 只有两类：中弧的「转折」、中弧下的各小弧。
 *
 * 不参与判断的是中弧的 因果 / 时序 / 目标 / 动机 / 路径 / 尝试 N：它们是**整段规格**，
 * 区间等于整个中弧，声明它们永远「不越界」，因而完全不产生信息。实测第 6 章
 * 用 `M1-1/时序`（= 本中弧起点，第 1 章就已发生）认领第 6 章，任何判定都不触发。
 *
 * 判定的单一真源是 `isTurnField`（与渲染「本批可声明的结构位」清单共用），
 * 两处各写一份正则必然漂移 —— 提示词允许声明什么、审计认可什么，必须同源。
 */
export function isClaimableArcNode(node: ArcNode): boolean {
  if (node.kind === 'minor') return true
  return node.kind === 'field' && isTurnField(node.field ?? '')
}

/**
 * 该节点是否是**一次性额度** —— 同一格只能被一章声明（INV-2 只对它生效）。
 *
 * 只有「转折」：一个中弧只有一个转折，两章都声明就是超额兑现。
 * **小弧不在此列**：一个小弧天然跨 8–9 章，区间内每章都该声明它（见文件头注释）。
 */
export function isOneShotArcNode(node: ArcNode): boolean {
  return node.kind === 'field' && isTurnField(node.field ?? '')
}

/**
 * 本章所处的中弧，以及该中弧下的全部结构位（含大弧节点）。
 *
 * 用途：让「这一章可以兑现哪些结构位」在 prompt / 报告里可列举，而不是只有一句
 * 「你在中弧 2」。**不做越界判断** —— 那是 `validateArcCovers` 的事。
 */
export function arcNodesForChapter(nodes: readonly ArcNode[], chapterNumber: number): ArcNode[] {
  if (!Number.isSafeInteger(chapterNumber)) return []
  const mid = nodes.find(node => node.kind === 'mid'
    && chapterNumber >= node.range[0] && chapterNumber <= node.range[1])
  if (!mid) return []
  return nodes.filter(node => (
    (node.kind === 'major' && node.id === `M${mid.majorIndex}`)
    || (node.kind === 'mid' && node.id === mid.id)
    || ((node.kind === 'field' || node.kind === 'minor')
      && node.majorIndex === mid.majorIndex && node.midIndex === mid.midIndex)
  ))
}

/**
 * 校验一章声明的 `covers`（P12-2 会接进预检；此处只提供纯函数）。
 *
 * INV-1：声明了某结构位，本章章号就必须落在它的区间内 —— 否则就是「提前使用后续结构位」。
 * INV-2（同一结构位被两章消费）需要跨章台账，不在本函数射程内。
 *
 * 缺失 `covers`（空数组）返回空 —— fail-open，与 `attacks` 一致。
 */
export function validateArcCovers(  nodes: readonly ArcNode[],
  covers: readonly string[],
  chapterNumber: number,
): ArcCoverViolation[] {
  if (!Number.isSafeInteger(chapterNumber) || covers.length === 0) return []
  const violations: ArcCoverViolation[] = []

  for (const rawId of covers) {
    const id = rawId.trim()
    if (!id) continue
    const node = findArcNode(nodes, id)
    if (!node) {
      violations.push({
        code: 'UNKNOWN_NODE',
        id,
        chapterNumber,
        message: `第 ${chapterNumber} 章声明了未知结构位「${id}」——弧光结构里没有这一格（可能拼写错误，或弧光已重排）。`,
      })
      continue
    }
    if (chapterNumber < node.range[0] || chapterNumber > node.range[1]) {
      violations.push({
        code: 'INV-1-OUT_OF_RANGE',
        id,
        chapterNumber,
        range: node.range,
        message: `第 ${chapterNumber} 章声明了结构位「${id}」，但该格属于第 ${node.range[0]}–${node.range[1]} 章 —— 提前了 ${node.range[0] - chapterNumber} 章消耗后续弧光。`,
      })
      continue
    }
    // 中弧/大弧粒度太粗，无法阻止「同一中弧被两章重复兑现」，提示细化但不拦。
    if (node.kind === 'major' || node.kind === 'mid') {
      violations.push({
        code: 'COARSE_NODE',
        id,
        chapterNumber,
        range: node.range,
        message: `第 ${chapterNumber} 章声明的「${id}」是${node.kind === 'major' ? '大弧' : '中弧'}粒度；建议细化到具体结构位（如「${id}/转折」或「${id}/小弧:<小弧名>」），否则无法检测重复兑现。`,
      })
      continue
    }
    // 中弧的 因果/时序/目标/动机/路径/尝试 N 是整段规格，声明它们永远「不越界、不重复」。
    if (!isClaimableArcNode(node)) {
      violations.push({
        code: 'NOT_CLAIMABLE',
        id,
        chapterNumber,
        range: node.range,
        message: `第 ${chapterNumber} 章声明了「${id}」，但它是覆盖整个 ${node.range[0]}–${node.range[1]} 章的**整段规格**，不是一次性节点 —— 声明它既不产生信息，也无法被重复消费检测。请改声明「转折」或一个小弧。`,
      })
    }
  }

  return violations
}

// ============================================================
// P12-1：大纲里的「覆盖：<ID>」声明
// ============================================================

/** `## 第12章：标题` / `## Chapter 12: Title`（允许 `#`~`####`、全角冒号、无分隔符）。 */
const CHAPTER_HEADING = /^#{1,4}[\t ]*(?:第[\t ]*([0-9]+)[\t ]*章|Chapter[\t ]+([0-9]+))[\t ]*[：:、.·\-—]?[\t ]*(.*)$/iu
/** `覆盖：M1-1/转折` / `**Covers:** M1-1/转折`。 */
const COVER_LINE = /^[*_\s]*(?:覆盖|Covers)[*_\s]*[\t ]*[：:][\t ]*(.+?)[\t ]*$/iu
/** 声明「本章不兑现任何结构位」的写法。 */
const COVER_NONE = new Set(['无', '沒有', '没有', 'none', 'n/a', 'na', '—', '-'])
/** 多 ID 分隔符。**不按 `/` 切** —— `/` 是 ID 内部的层级分隔。 */
const COVER_SEPARATOR = /[、,，;；]/u

export interface ChapterArcCover {
  chapterNumber: number
  /** 大纲里该章的章名（`## 第N章：` 之后的部分，可能为空）。 */
  title: string
  /** 声明的结构位 ID；写「无」或未声明时为空数组。 */
  covers: string[]
  /** `覆盖：` 行在第几行（1-based），便于报告定位；未找到为 null。 */
  coverLine: number | null
}

function splitCoverValue(raw: string): string[] {
  const value = raw.replace(/\*\*/gu, '').trim()
  if (!value) return []
  if (COVER_NONE.has(value.toLowerCase())) return []
  return value
    .split(COVER_SEPARATOR)
    .map(item => item.trim())
    .filter(item => item.length > 0 && !COVER_NONE.has(item.toLowerCase()))
}

/**
 * 从情节大纲文本里解析每章声明的结构位（P12-1）。
 *
 * ## 为什么声明要写在标题正下方
 *
 * 解析器必须能**确定地**把一行 `覆盖：` 归到某一章。写在章标题正下方是唯一无歧义的
 * 位置；写在章末会与下一章标题竞争，写在正文中间则无法与叙事里的「覆盖」一词区分。
 *
 * 宽容度：章标题与 `覆盖：` 行之间允许空行；同一章出现多行 `覆盖：` 时**只取第一行**
 * （后续行往往是正文里复述 ID），不合并 —— 合并会让「一章声明两格」这种违约悄无声息。
 *
 * 无章标题（例如作者用的是枚举故事结构、或大纲是自由散文）时返回空数组，调用方据此
 * 跳过校验（fail-open，与 `parseArcStructure` 一致）。
 */
export function parseChapterArcCovers(synopsis: string | null | undefined): ChapterArcCover[] {
  if (!synopsis?.trim()) return []
  const result: ChapterArcCover[] = []
  let current: ChapterArcCover | null = null

  const lines = synopsis.split(/\r?\n/u)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim()
    const heading = CHAPTER_HEADING.exec(line)
    if (heading) {
      const chapterNumber = Number(heading[1] ?? heading[2])
      if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) {
        current = null
        continue
      }
      current = { chapterNumber, title: (heading[3] ?? '').trim(), covers: [], coverLine: null }
      result.push(current)
      continue
    }
    if (!current || current.coverLine !== null) continue
    const cover = COVER_LINE.exec(line)
    if (!cover) continue
    current.coverLine = index + 1
    current.covers = splitCoverValue(cover[1] ?? '')
  }

  return result
}

export interface ArcCoverAudit {
  chapters: readonly ChapterArcCover[]
  violations: readonly ArcCoverViolation[]
  /** 本批区间内、从未被任何一章声明的结构位（仅作提示，不拦）。 */
  uncovered: readonly ArcNode[]
  /** 写了「覆盖：」行的章节数（含「覆盖：无」—— 那是明确声明，不是漏写）。 */
  declaredChapters: number
}

/**
 * 对一份大纲做结构位对账（P12-1 的落点）。
 *
 * - **INV-1**：声明了某格但本章不在其区间内 ⇒ error（`INV-1-OUT_OF_RANGE`）。
 * - **INV-2**：同一**一次性**节点（转折）被两章声明 ⇒ error（`INV-2-DUPLICATE`）。
 *   小弧不参与这条 —— 它是**归属**：`M1-1/小弧:错位门牌 [1,8]` 的 8 章都该声明它。
 * - **INV-3**：有**可声明**格子从未被声明 ⇒ warning（`INV-3-UNCOVERED`）。判据按节点类型分两种。
 *
 * `uncovered` 的纳入条件（`isUncoveredCandidate`）：
 * ① 不算本批之外 —— 否则全书尚未写到的格子会全部报成漏覆盖，信噪比归零；
 * ② 不算整段规格字段（因果/时序/目标/动机…），否则「M1-1/因果未声明」这类
 *    永远无法消除的噪音会淹没真信号（见 `isClaimableArcNode`）；
 * ③ **小弧只要求「有交集」**：它是归属，区间内的每一章都属于它，本批落在区间里却没写
 *    ⇒ 真漏；
 * ④ **转折要求「本批已写到该中弧末尾」**：转折是一次性额度，在 [1,26] 里第 5 章没花掉
 *    完全正常 —— 它本来就该在中弧后段发生。只有整条中弧都写完了、转折还没出现，才是
 *    真漏。否则每批都会固定报一条「M1-1/转折 未声明」，而它永远消不掉（实测 ch1–5 就是
 *    这个形态）。**额度没花完不是错，额度过期才是。**
 */
/**
 * 该节点是否应被纳入「本批漏覆盖」统计。
 *
 * 两类节点的判据不同（见 `auditArcCovers` 的注释）：
 * - **小弧**：区间与本批有交集即可。它是归属，落在区间内的章本该声明它。
 * - **转折**：必须本批已写到该中弧的末尾。它是**一次性额度**，在 26 章的窗口里第 5 章
 *   还没花掉是正常的；只有额度**过期**（中弧写完仍未出现）才是漏。
 *
 * 写成独立函数是因为「什么算漏」和「怎么报」会一起漂移 —— 实测 ch1–5 恒定报一条
 * `M1-1/转折 未声明`，每批都报、永远消不掉，等于把整条 INV-3 的信噪比拖到 0。
 */
export function isUncoveredCandidate(node: ArcNode, options: { from: number; to: number }): boolean {
  if (!isClaimableArcNode(node)) return false
  // 与本批区间无交集 ⇒ 不在本批，不判。
  if (node.range[0] > options.to || node.range[1] < options.from) return false
  if (node.kind === 'minor') return true
  // 转折：额度过期才算漏（本批已写到该中弧末尾）。
  return options.to >= node.range[1]
}

export function auditArcCovers(
  nodes: readonly ArcNode[],
  chapters: readonly ChapterArcCover[],
  options: { from: number; to: number },
): ArcCoverAudit {
  const violations: ArcCoverViolation[] = []
  /** 每个 ID 的**首次**声明章号。小弧会被多次写入，但只记第一次（用于判断是否被认领）。 */
  const seen = new Map<string, number>()

  for (const chapter of chapters) {
    violations.push(...validateArcCovers(nodes, chapter.covers, chapter.chapterNumber))
    for (const id of chapter.covers) {
      const previous = seen.get(id)
      const node = findArcNode(nodes, id)
      // 只有「转折」是一次性额度；小弧跨 8–9 章，区间内每章都该声明它。
      // 把两者混为一谈会让正常写法（第 1–8 章都写同一个 ID）被报成超额兑现。
      if (previous !== undefined && previous !== chapter.chapterNumber && node && isOneShotArcNode(node)) {
        violations.push({
          code: 'INV-2-DUPLICATE',
          id,
          chapterNumber: chapter.chapterNumber,
          message: `结构位「${id}」在第 ${previous} 章已被声明过 —— 转折是一次性额度，同一格不能被两章兑现。`,
        })
      }
      if (previous === undefined) seen.set(id, chapter.chapterNumber)
    }
  }

  const inBatch = nodes.filter(node => isUncoveredCandidate(node, options))
  const uncovered = inBatch.filter(node => !seen.has(node.id))
  for (const node of uncovered) {
    violations.push({
      code: 'INV-3-UNCOVERED',
      id: node.id,
      chapterNumber: options.from,
      range: node.range,
      message: node.kind === 'minor'
        ? `本批落在小弧「${node.id}」（第 ${node.range[0]}–${node.range[1]} 章）的区间内，却没有一章写它 —— 归属缺失，说明这一段的落脚点没被认出来。`
        : `结构位「${node.id}」是一次性额度，而本批已写到它所属的中点（第 ${node.range[1]} 章）仍未出现 —— 这一格被整体跳过了。`,
    })
  }

  return {
    chapters,
    violations,
    uncovered,
    // 认「写了「覆盖：」行」，不认「写了一个 ID」—— 「覆盖：无」是**明确的声明**
    // （本章不兑现任何结构位），不是漏写。否则「大多数章节应当写覆盖：无」这条规矩
    // 一落地，报告立刻开始喊「N 章没有写声明」，自相矛盾。
    declaredChapters: chapters.filter(chapter => chapter.coverLine !== null).length,
  }
}
