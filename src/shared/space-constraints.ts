import type { WritingLanguage } from './writing-language'

/**
 * 空间约束摘录（2026-10-14；2026-10-22 增加 markdown 表格形态）。
 *
 * ## 为什么需要它
 *
 * 世界观里已经**写清了**空间的准入与时段规则（实测：「老陈记早餐摊…关键规则：7:00—10:00 营业」），
 * 大纲 / 蓝图的请求里也**确实带着**它 —— 但它是 6,000+ 字散文里的一段，与另外七八个空间
 * 并列排在一起。实测后果：大纲第 1 章写出「下午两点……冲去老陈记买早饭」，直接越过该窗口。
 *
 * 注意这不是「没喂」而是「喂了没看见」：规则在请求里，只是不显著。
 * 因此本模块不做任何**语义判断** —— 只是把散文中已经存在的「空间名 + 关键规则」
 * **原样摘录**成一张短清单，独立成节地放在世界观正文之后。
 *
 * ## 支持的三种书写形态
 *
 * 1. `**名称**` 独占行 + 紧随的 `关键规则：…`（内置模板的产出形态）
 * 2. **markdown 表格**：`| **名称** | 一句话描述 | 关键规则 |`（作者手写或模型表格式产出）
 * 3. `- **名称**：描述…`（en 模板声明的单行形态，仅在前两种都摘不到时兜底）
 *
 * 形态 2 是 2026-10-22 补的：作者第 4 维写成三列表格，实测原实现**摘到 0 条**（表格行不是
 * `**名称**` 独占行，也不是 `- **名称**：…`）⇒ 整维规则一条都没进 prompt，属于静默失效。
 *
 * ## 边界（与 §6.1「框架边界判据」一致）
 *
 * 本模块**不解析**规则的含义：不识别钟点、不做区间推断、不判断「下午两点」是否越界，
 * 也**不解析**世界观末尾的 `名称｜hours=…｜entry=…` 机读行。
 * 它只做「按标题切段 + 按字段摘录」这类**结构对结构**的事；判定交给模型。
 * 同理，它也不做「上午 / 下午」的归一化 —— 那是 B′ 双写（由模型在生成设定时给出规范形式）的职责。
 *
 * ## fail-open
 *
 * 任何一步不成立（找不到段、字段形状不符、产出为空）都返回**原文**，不注入、不告警、不中止生成。
 */

export interface SpaceConstraint {
  /** 空间名（已去掉 markdown 强调符号） */
  name: string
  /** 该空间的「关键规则」原文摘录；可能为空（只有定位时） */
  rule: string
}

/** 单条规则摘录的上限字数（宁短勿长：清单要一眼扫完） */
const MAX_RULE_CHARS = 90
/** 摘录条数上限 */
const MAX_ENTRIES = 12

const SECTION_PATTERNS: readonly RegExp[] = [
  // zh: `### 4.【空间结构（地图与区域）】` / `## 空间结构`
  /^#{1,6}\s*(?:\d+[.、)]\s*)?(?:【)?[^【】\n]*空间结构[^【】\n]*(?:】)?\s*$/u,
  // en: `### 4. Spatial structure (map and regions)`
  /^#{1,6}\s*(?:\d+[.、)]\s*)?[^\n]*\bspatial structure\b[^\n]*$/iu,
]

const ANY_HEADING = /^(?:#{1,6}\s|【)/u

/** 块标题（zh / en）—— 幂等判定与「是否已注入」的判据 */
const BLOCK_MARKERS: readonly string[] = ['★【空间约束（硬）】', '★ [Space constraints (hard)]']

const RULE_LABELS: readonly RegExp[] = [
  /^关键规则[：:]\s*/u,
  /^key rules?[：:]\s*/iu,
]

/** 去掉 markdown 强调与列表符号，压缩空白。 */
function cleanName(raw: string): string {
  return raw
    .replace(/^\s*[-*+]\s*/u, '')
    .replace(/^\*\*(.+?)\*\*\s*$/u, '$1')
    .replace(/[*_`]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length > MAX_RULE_CHARS ? `${flat.slice(0, MAX_RULE_CHARS)}…` : flat
}

/**
 * 从世界观正文里摘录「空间名 + 关键规则」。
 * 找不到或形状不符时返回空数组（调用方据此决定不注入）。
 */
export function extractSpaceConstraints(worldbuilding: string | null | undefined): SpaceConstraint[] {
  if (!worldbuilding) return []
  const lines = worldbuilding.replace(/\r\n?/gu, '\n').split('\n')

  // 1) 定位「空间结构」段：从该标题之后，到下一个同级或更高级标题为止。
  let start = -1
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (SECTION_PATTERNS.some(pattern => pattern.test(line))) { start = index + 1; break }
  }
  if (start < 0) return []

  const section: string[] = []
  for (let index = start; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (index > start && ANY_HEADING.test(trimmed)) break
    section.push(lines[index])
  }

  // 2) 显式结构：`**名称**` 独占行 + 关键规则，以及 markdown 表格。
  //    两者合并（而不是「有 bold 就不看表格」）：一份世界观里两种写法可能并存，
  //    少了表格那一段就等于静默漏掉半维规则。小节标题（如「长期舞台」）后面没有
  //    关键规则，会被自然丢弃。
  const explicit = mergeEntries([
    ...collect(section, 'bold'),
    ...collectFromTable(section),
  ])
  if (explicit.length > 0) return explicit.slice(0, MAX_ENTRIES)

  // 3) 兜底：模型整体用 `Name: role + rule` 单行形态时（en 模板声明的形状），
  //    才退到 inline 解析。之所以要求「前两种都为空」：zh 的「一次性与低频场景」也用
  //    `- **名称**：描述` 列表，但那**不是**约束 —— 混进来只会稀释清单（宁漏勿误）。
  return collect(section, 'inline').slice(0, MAX_ENTRIES)
}

/**
 * markdown 表格里的空间：
 *
 *     | 空间定位 | 一句话描述 | 关键规则 |
 *     |---------|-----------|---------|
 *     | **青阳山·杂役处** | 底层修士居住区 | 每日06:00-06:30 需签到 |
 *
 * 只认「首列是 `**粗体**`」的行（表头与 `|---|` 分隔行天然不匹配），规则取**最后一列**。
 * 不做列名匹配：列名由模型自由书写（「关键规则」/「规则」/「限制」都见过），
 * 靠列名匹配等于给自己制造解析失败。
 */
function collectFromTable(section: readonly string[]): SpaceConstraint[] {
  const entries: SpaceConstraint[] = []
  for (const raw of section) {
    const line = raw.trim()
    if (!line.startsWith('|') || !line.endsWith('|')) continue
    const cells = line.slice(1, -1).split('|').map(cell => cell.trim())
    if (cells.length < 2) continue
    const bold = /^\*\*(.+?)\*\*$/u.exec(cells[0] ?? '')
    if (!bold) continue
    const rule = truncate(cells[cells.length - 1] ?? '')
    if (!rule || /^[-:\s]+$/u.test(rule)) continue
    const name = cleanName(bold[1])
    if (name) entries.push({ name, rule })
  }
  return entries.filter(entry => entry.name && entry.rule)
}

/** 同名去重，保留先出现的（bold 形态优先于表格）。 */
function mergeEntries(entries: readonly SpaceConstraint[]): SpaceConstraint[] {
  const seen = new Set<string>()
  const merged: SpaceConstraint[] = []
  for (const entry of entries) {
    const key = entry.name.replace(/\s+/gu, '')
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(entry)
  }
  return merged
}

function collect(
  section: readonly string[],
  mode: 'bold' | 'inline',
): SpaceConstraint[] {
  const entries: SpaceConstraint[] = []
  let current: SpaceConstraint | null = null
  const flush = () => {
    if (current && current.rule) entries.push(current)
    current = null
  }
  for (const raw of section) {
    const line = raw.trim()
    if (!line) continue
    if (mode === 'bold') {
      const boldOnly = /^\*\*(.+?)\*\*\s*$/u.exec(line)
      if (boldOnly) {
        flush()
        current = { name: cleanName(boldOnly[1]), rule: '' }
        continue
      }
      const label = RULE_LABELS.find(pattern => pattern.test(line))
      if (label && current) {
        current.rule = truncate(line.replace(label, ''))
        flush()
        continue
      }
    } else {
      const inline = /^\s*(?:[-*+]\s*)?\*\*(.+?)\*\*\s*[:：]\s*(.+)$/u.exec(line)
      if (inline) {
        flush()
        entries.push({ name: cleanName(inline[1]), rule: truncate(inline[2]) })
      }
    }
  }
  flush()
  return entries.filter(entry => entry.name && entry.rule)
}

/**
 * 渲染【空间约束（硬）】块；无条件不成立时返回空串。
 */
export function renderSpaceConstraintsBlock(
  worldbuilding: string | null | undefined,
  writingLanguage: WritingLanguage,
): string {
  const entries = extractSpaceConstraints(worldbuilding)
  if (entries.length === 0) return ''
  const en = writingLanguage === 'en-US'
  const heading = en
    ? `${BLOCK_MARKERS[1]} — excerpted from the world-building "Spatial structure" section`
    : `${BLOCK_MARKERS[0]}——摘自世界观「空间结构」`
  const lead = en
    ? 'Whenever this batch places an event in one of these spaces, that event must satisfy the space\u2019s time window and entry conditions. Do not ignore a declared limit for plot convenience.'
    : '本批若在下列空间内安排事件，必须满足该空间的时段与准入条件；不得为了剧情方便而忽略已声明的限制。'
  const body = entries.map(entry => `- ${entry.name}：${entry.rule}`).join('\n')
  return `${heading}\n${lead}\n${body}`
}

/**
 * 与 `withProjectedArcGuide` 同构的**唯一注入入口**：把摘录块追加到世界观正文之后。
 *
 * 为什么追加在**变量值**里、而不是新增模板变量：作者全局覆盖版会静默遮蔽内置模板（红线 3），
 * 新增 `requiredContextVariables` 对未引用它的覆盖版只会追加到正文末尾（红线 16）。
 * 改写变量值则对内置与覆盖版**同样生效**，位置也紧贴世界观正文。
 *
 * fail-open：摘录不到任何条目时原样返回。
 */
export function withSpaceConstraints(
  worldbuilding: string | null | undefined,
  writingLanguage: WritingLanguage,
): string {
  const source = worldbuilding ?? ''
  // 幂等：同一份世界观若在链路上被装配两次，重复注入会让清单翻倍。
  if (source.includes(BLOCK_MARKERS[0]) || source.includes(BLOCK_MARKERS[1])) return source
  const block = renderSpaceConstraintsBlock(source, writingLanguage)
  return block ? `${source.trimEnd()}\n\n${block}` : source
}
