/**
 * 蓝图关键事件的结构化表示。
 *
 * 设计依据：`docs/design/architecture/blueprint-key-events-structuring-design.md`（§3 契约 / §3.1 归一化规则）。
 *
 * 背景：`keyEvents` 原先是一段自由文本 —— 无法编号、无法对账、算不出停止点。
 * 本模块是它的**唯一归一化入口**：读写两侧都过 `normalizeKeyEvents`，
 * 因此库中永远只存数组，不存在"新旧格式混存"的兼容窗口。
 */

/** 一条本章关键事件。 */
export interface BlueprintKeyEvent {
  /** 稳定编号 `ch{N}:E{i}`，供跨步骤对账（短细纲 / 续写停止点 / 覆盖账目）。 */
  id: string
  /** 事件本身（一句话到一小段）。 */
  event: string
  /** 该事件的篇幅预估（汉字数）。未声明时为 0。 */
  estimatedUnits: number
  /**
   * 该事件要**作废/证伪的那一格**（P11-1）。
   *
   * 为什么必须有这个字段：`spaceRefs.timeRef` 记录的是**动作发生的时间**，而
   * 「废掉晚九点那一格」需要的是**被攻击目标的时间**——两者经常不同（第 3 章可以
   * 在白天准备、晚上动手，也可能反过来）。只有先声明攻击目标，才谈得上判断
   * 「这个目标是否还存在」（第 2 章已把那一格兑付掉，第 3 章仍当未结算目标在打）。
   *
   * 缺失即 fail-open：不是每个事件都在攻击某一格。
   */
  attacks?: BlueprintSlotAttack
}

/** `attacks` 目前只支持「攻击一个作息表格子」。`thread` 等待定，届时扩 `kind`。 */
export interface BlueprintSlotAttack {
  kind: 'slot'
  /** 被攻击的那一格所在空间（逐字复制世界观第 4 维登记的空间名）。 */
  space: string
  /** **被攻击那一格**的钟点，24 小时制 `HH:MM` —— 不是动手的钟点。 */
  hour: string
  /** 一句话说明为什么这个动作能破坏该格（可选）。 */
  rationale?: string
}

/**
 * 旧字符串的切分规则。
 *
 * ★ 必须与 `chapter-goal-review.ts` 原先的 `split(/\r?\n|[；;]/u)` **逐字一致** ——
 * 否则旧数据的目标核对项数会变（即行为变化）。
 */
const LEGACY_EVENT_SEPARATOR = /\r?\n|[；;]/u

/** `ch{N}:E{i}`：章号 + 章内序号（1 起），跨章唯一。 */
export function keyEventId(chapterNumber: number, index: number): string {
  return `ch${chapterNumber}:E${index + 1}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 存储列（`TEXT`）的取值可能是三种形态，统一在这里收敛：
 * ① 新数据 = `JSON.stringify(BlueprintKeyEvent[])`；
 * ② 旧数据 = 自由文本（可能含 `；` / 换行）；
 * ③ 空串 / 空白。
 *
 * 只有「以 `[` 开头且能 `JSON.parse` 成数组」才按数组处理；
 * 其余字符串**原样**返回，交给下面的旧文本切分规则（不猜测语义、不抛错）。
 */
function storedCell(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[')) return raw
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : raw
  } catch {
    return raw
  }
}

/** 数组元素或字符串 ⇒ 事件正文；非字符串一律丢弃（不推测语义）。 */
function eventTextOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (isRecord(value) && typeof value.event === 'string') return value.event.trim()
  return ''
}

/** 数组元素自带的预估值；非法值一律视为"未声明"（0）。 */
function declaredUnits(value: unknown): number {
  if (!isRecord(value)) return 0
  const raw = value.estimatedUnits
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0
}

/** `HH:MM` / `H:MM` / `HH：MM`（全角冒号）⇒ `HH:MM`；非法值返回 null。 */
function normalizedHour(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const match = /^([0-9]{1,2})[：:]([0-9]{2})$/u.exec(raw.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isSafeInteger(hour) || hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * 元素自带的 `attacks`（P11-1）。
 *
 * 严格归一化：`space` 与 `hour` 缺一不可，`kind` 只认 `slot`。任何一项不合格就整条丢弃
 * （返回 undefined），**不做部分保留** —— 一个只有 space 没有钟点的攻击目标无法对账，
 * 留着比丢掉更危险（会让人以为已经声明过了）。
 */
function declaredAttack(value: unknown): BlueprintSlotAttack | undefined {
  if (!isRecord(value)) return undefined
  const raw = value.attacks
  if (!isRecord(raw)) return undefined
  const kind = raw.kind ?? 'slot'
  if (kind !== 'slot') return undefined
  const space = typeof raw.space === 'string' ? raw.space.trim() : ''
  const hour = normalizedHour(raw.hour)
  if (!space || !hour) return undefined
  const rationale = typeof raw.rationale === 'string' ? raw.rationale.trim() : ''
  return rationale ? { kind: 'slot', space, hour, rationale } : { kind: 'slot', space, hour }
}

export interface NormalizeKeyEventsOptions {
  /** 章号，用于生成 `ch{N}:E{i}`。缺省 0（无章上下文场景）。 */
  chapterNumber?: number
  /**
   * 本章字数目标。提供时，**未声明 `estimatedUnits` 的条目**按条数均分该值；
   * 未提供（或 ≤0）则保持 0，由调用方决定后续处理。
   */
  targetUnits?: number
}

/**
 * 归一化规则（设计稿 §3.1，三条）：
 *
 * | 输入 | 输出 |
 * |---|---|
 * | `string`（旧数据 / 编辑器 Textarea / **阶段 1 的模型产出**） | 按 `LEGACY_EVENT_SEPARATOR` 切分、去空白、去空 ⇒ 多条 |
 * | `string`（`JSON.stringify` 过的数组，即**改造后的存储列**） | 解析为数组，走下面那条 |
 * | 数组 | 取每项 `event`（对象）或字符串本身；`id` **按序号重算**（覆盖模型自报值） |
 * | 其他（`undefined` / `null` / 数字 / 非法 JSON） | `[]` |
 *
 * 不抛错、不写库（守"绝不自动执行副作用"）。
 */
export function normalizeKeyEvents(raw: unknown, options: NormalizeKeyEventsOptions = {}): BlueprintKeyEvent[] {
  const chapterNumber = typeof options.chapterNumber === 'number'
    && Number.isSafeInteger(options.chapterNumber) && options.chapterNumber >= 0
    ? options.chapterNumber
    : 0
  const source = storedCell(raw)
  const isArray = Array.isArray(source)
  // ⚠️ 这里必须**先保留条目、再过滤空事件**：旧实现先 map 成字符串数组再 filter，
  //   一旦某条 event 为空，后面按 index 取 `estimatedUnits` / `attacks` 就会整体错位。
  const entries: { event: string; units: number; attacks?: BlueprintSlotAttack }[] = isArray
    ? (source as unknown[]).flatMap(item => {
        const event = eventTextOf(item)
        if (!event) return []
        const attacks = declaredAttack(item)
        return [{ event, units: declaredUnits(item), ...(attacks ? { attacks } : {}) }]
      })
    : typeof source === 'string'
      ? source.split(LEGACY_EVENT_SEPARATOR)
          .map(part => part.trim())
          .filter(Boolean)
          .map(event => ({ event, units: 0 }))
      : []
  const target = typeof options.targetUnits === 'number'
    && Number.isFinite(options.targetUnits) && options.targetUnits > 0
    ? options.targetUnits
    : 0
  const fallbackUnits = entries.length > 0 && target > 0 ? Math.round(target / entries.length) : 0
  return entries.map((entry, index) => ({
    id: keyEventId(chapterNumber, index),
    event: entry.event,
    estimatedUnits: entry.units || fallbackUnits,
    ...(entry.attacks ? { attacks: entry.attacks } : {}),
  }))
}

/**
 * 事件清单的**文本呈现**（prompt / 检索 / 边界清单统一走这里）。
 *
 * 两种输入都要接：
 * - **数组**（阶段 1 之后的主形态）：按行连接，与 `chapter-goal-review` 切分后再聚合的形态一致；
 * - **字符串**（旧数据 / 续写恢复链路读回的 `draft:chapter-info`）：**逐字返回**，
 *   不按 `；`/换行重新切分再拼 —— 那会把作者原文改写掉，而 `【作者资料（保留原文）】`
 *   块承诺的正是原文保留；且续写恢复路径上传的就是字符串，这里若不接会直接抛
 *   `TypeError: (events ?? []).map is not a function`。
 */
export function keyEventsText(events: readonly BlueprintKeyEvent[] | string | null | undefined): string {
  if (typeof events === 'string') return events.trim()
  return (events ?? []).map(event => event.event.trim()).filter(Boolean).join('\n')
}
