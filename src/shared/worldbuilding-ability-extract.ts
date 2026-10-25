/**
 * 能力候选抽取（P20-1a，2026-10-26）。
 *
 * ## 这一期是什么
 *
 * ① **P20-1a**：把世界观第 1 维【核心规则与体系漏洞】里那张四列等级表
 * （等级名｜相邻差距｜卡点｜升级代价）解析成**候选**，作者逐条勾选后才登记。
 * **零模型**：本文件是确定性解析，没有任何 LLM / prompt 参与，产物是作者自己写在世界观里的表格行。
 *
 * ② **候选不写库、不进 prompt**。只有面板上的「采纳所选」才会走既有 `db:abilities-upsert`。
 * 抽取即写库会把「模型提议」伪装成「作者登记」，那是 P20-3 风险最高的形态，本期不许开这个口子。
 *
 * ③ **第 2 列「相邻差距」故意不抽**（作者 2026-10-26 裁定）。等级表四列里只有首列（等级名）、
 * 第 3 列（卡点）、第 4 列（升级代价）在能力登记里有对应字段；「相邻差距」是**两行之间的关系**，
 * 一行一个格子装不下，硬塞进 `costNote` 会让一个字段承载两种语义（`costNote` 是「用一次付什么」）。
 * 它只随 `evidence` 全行保留 —— 作者采纳时看得到整行原文，不丢信息。
 *
 * ## 与先例 `worldbuilding-resource-extract.ts` 的关系
 *
 * 形状照抄它：类型命名、`dropped` 逐条计数并重名丢弃、引文必须逐字命中原文、超上限也计入 `dropped`。
 *
 * 有一处**刻意不同**：`filterResourceCandidates` 用 `localeCompare('zh-CN')` 排序，
 * 这里**禁止排序**。等级表的行序就是阶梯顺序（练气 → 筑基 → 金丹），排完会变成字典序，
 * 「谁高谁低」这一信息当场丢失。资源名之间没有这种顺序语义，所以那边能排、这边不能。
 *
 * ## 抽不到就是抽不到
 *
 * 抽不到 ⇒ 空集。不补占位行、不编内容、不截断字段（截断 = 改写原文，
 * 会让作者看到的引文与世界观里的原句对不上）。
 */

import { locateWorldBuildingSections } from './worldbuilding-completeness'
import {
  ABILITY_EVIDENCE_MAX,
  ABILITY_TEXT_MAX,
  type PowerAbilityInput,
} from './power-ability'

/** 一条能力候选。**作者勾选后才登记**，抽取阶段不写库。 */
export interface AbilityCandidate {
  /** 等级名（表格首列，已去 markdown 装饰）。 */
  name: string
  /** 卡点（表格第 3 列）；列数不为 4 时为空串。 */
  hardLimit: string
  /** 升级代价（表格末列）。 */
  costNote: string
  /** 表格行原文（trim 后，未 flatten）——必须能在世界观原文里逐字命中。 */
  evidence: string
  /** 恒为 'worldbuilding'。 */
  evidenceScope: 'worldbuilding'
}

export interface AbilityCandidateSet {
  candidates: AbilityCandidate[]
  /** 是否识别到第 1 维标题。false ⇒ 多半是覆盖版模板改了标题文字。 */
  dimensionFound: boolean
  /** 被丢弃的条数（字段超长 / 引文未命中 / 重名 / 超上限）。 */
  dropped: number
}

/** 一次最多给多少条候选。**不要**复用 ABILITY_MAX_ITEMS(5)——那是正文注入上限，不是候选上限。 */
export const MAX_ABILITY_CANDIDATES = 12

/** markdown 表格的分隔行：`| --- | --- | --- | --- |`（允许冒号对齐符）。 */
const SEPARATOR_ROW = /^\|(\s*:?-{1,}:?\s*\|)+$/u

/** 等级表的四列形状。列数不为 4 ⇒ 不是等级表（价格表、多列表都落在这里）。 */
const LADDER_COLUMNS = 4

/**
 * 去 markdown 装饰并压平空白。
 *
 * 与 `worldbuilding-rules.ts` 的 `flatten` 同族但**不共用**：本文件只允许 import
 * `locateWorldBuildingSections`（纪律：维度定位只有一处实现，装饰清洗可以按各段的需要自定）。
 */
function squash(value: string): string {
  return value.replace(/[*_`>]/gu, '').replace(/\s+/gu, ' ').trim()
}

/** 这一行是不是「以 `|` 开头且以 `|` 结尾」。表头与分隔行也满足，由后续判定分开处理。 */
function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|')
}

/** 切单元格：与 `worldbuilding-rules.ts:157` 同口径。 */
function splitCells(line: string): string[] {
  return line.slice(1, -1).split('|').map(cell => cell.trim())
}

/**
 * 解析世界观第 1 维的等级表 → 能力候选。
 *
 * 纯函数：零 IO、不抛错。空文本 / 没识别到第 1 维 ⇒ 空集。
 * **保持原文行序返回，禁止任何排序**（理由见文件头）。
 */
export function extractAbilityCandidates(
  worldbuilding: string | null | undefined,
): AbilityCandidateSet {
  const text = String(worldbuilding ?? '')
  if (!text.trim()) return { candidates: [], dimensionFound: false, dropped: 0 }

  const section = locateWorldBuildingSections(text).find(entry => entry.dimension === 1)
  if (!section) return { candidates: [], dimensionFound: false, dropped: 0 }

  const body = section.body
  const candidates: AbilityCandidate[] = []
  const seen = new Set<string>()
  let dropped = 0

  // 需要看下一行判表头 ⇒ 索引 for 循环，不能 for-of。
  for (let index = 0; index < body.length; index += 1) {
    const line = (body[index] ?? '').trim()
    if (!isTableRow(line)) continue

    // 下一行是分隔行 ⇒ 当前行是表头，不是数据。
    const next = (body[index + 1] ?? '').trim()
    if (SEPARATOR_ROW.test(next)) continue
    // 当前行自身就是分隔行。
    if (SEPARATOR_ROW.test(line)) continue

    const cells = splitCells(line)
    // 列数不对 ⇒ 不是等级表。**不计 dropped**：价格表、多列表本来就不该抽，不是「丢了」。
    if (cells.length !== LADDER_COLUMNS) continue

    const name = squash(cells[0] ?? '')
    // 首列空 ⇒ 不是数据行（续行 / 空单元格），不计 dropped。
    if (!name) continue

    const hardLimit = squash(cells[2] ?? '')
    const costNote = squash(cells[3] ?? '')

    // 超长一律**整条丢弃**，不截断：截断等于改写原文，引文就不再是原句。
    if (name.length > ABILITY_TEXT_MAX
      || hardLimit.length > ABILITY_TEXT_MAX
      || costNote.length > ABILITY_TEXT_MAX) {
      dropped += 1
      continue
    }

    // 引文取整行原文（未 squash），必须能在世界观里逐字命中。
    const evidence = line
    if (evidence.length > ABILITY_EVIDENCE_MAX || !text.includes(evidence)) {
      dropped += 1
      continue
    }

    if (seen.has(name)) { dropped += 1; continue }
    seen.add(name)

    if (candidates.length >= MAX_ABILITY_CANDIDATES) {
      // 超上限也要计入 dropped，否则「丢了 N 条」会说谎（与先例 worldbuilding-resource-extract.ts:174-177 同口径）。
      dropped += 1
      continue
    }

    candidates.push({ name, hardLimit, costNote, evidence, evidenceScope: 'worldbuilding' })
  }

  return { candidates, dimensionFound: true, dropped }
}

/**
 * 候选 → 写入入参。采纳时面板必须走它，不许在组件里手拼对象。
 *
 * **不得**出现 `source` 字段：仓储把它硬编码成 `'author'`
 * （`electron/repositories/power-ability-repository.ts:135`），前端传不进去也不该传 ——
 * 本期是确定性解析，产物是作者自己写的表格行，零模型参与，不属于「模型提议」。
 */
export function abilityCandidateToInput(candidate: AbilityCandidate): PowerAbilityInput {
  return {
    name: candidate.name,
    hardLimit: candidate.hardLimit,
    costNote: candidate.costNote,
    evidence: candidate.evidence,
    evidenceScope: 'worldbuilding',
    // 世界观没有章号 ⇒ undated，渲染成「作者登记，未标章号」。
    stageChapter: null,
    form: '',
    weakness: '',
    stageNote: '',
  }
}
