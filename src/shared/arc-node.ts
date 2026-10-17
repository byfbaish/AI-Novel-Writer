import { parseArcStructure, scaledBoundaries } from './arc-position'

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
 * | 结构位 | `M<大弧>-<弧内中弧序号>/<字段名>` | `M1-2/转折`、`M1-2/尝试 2` |
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

export type ArcNodeKind = 'major' | 'mid' | 'field'

export interface ArcNode {
  /** 稳定 ID：`M1` | `M1-2` | `M1-2/转折`。 */
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
  /** 该结构位的原文：大弧/中弧是名称，字段是字段值。 */
  text: string
}

export interface ArcCoverViolation {
  code: 'INV-1-OUT_OF_RANGE' | 'UNKNOWN_NODE' | 'COARSE_NODE'
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
    })
  })

  return nodes
}

export function findArcNode(nodes: readonly ArcNode[], id: string): ArcNode | undefined {
  return nodes.find(node => node.id === id)
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
    || (node.kind === 'field' && node.majorIndex === mid.majorIndex && node.midIndex === mid.midIndex)
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
export function validateArcCovers(
  nodes: readonly ArcNode[],
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
    if (node.kind !== 'field') {
      violations.push({
        code: 'COARSE_NODE',
        id,
        chapterNumber,
        range: node.range,
        message: `第 ${chapterNumber} 章声明的「${id}」是${node.kind === 'major' ? '大弧' : '中弧'}粒度；建议细化到具体结构位（如「${id}/转折」），否则无法检测重复兑现。`,
      })
    }
  }

  return violations
}
