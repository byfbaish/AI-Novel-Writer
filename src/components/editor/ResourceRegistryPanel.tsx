import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, Undo2 } from 'lucide-react'

import type { ResourceDefinition, ResourceDefinitionInput } from '../../shared/resource-ledger'
import { isQuotePresent } from '../../shared/worldbuilding-self-review'
import {
  describeResourceCandidates,
  filterResourceCandidates,
  parseResourceCandidates,
  type ResourceCandidate,
} from '../../shared/worldbuilding-resource-extract'
import { resolveWritingLanguage, type WritingLanguage } from '../../shared/writing-language'
import { composePromptSystemRole } from '../../services/builtin-prompt-templates'
import { renderPrompt, resolvePromptTemplate } from '../../services/prompt-templates'
import { ipc } from '../../services/ipc-client'
import { generateStructuredJson } from '../../services/structured-json-call'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * W6a-0 资源登记 —— 作者侧的资源定义 SSoT 入口。
 *
 * 三件事只在这里发生：
 * 1. **定义**，不是余额：余额/中断判定属于 W6c 与纯函数层，这块面板不显示任何数字汇总。
 * 2. **保存前不落库**：编辑全在本地草稿行里，点「保存」才一次性提交。
 * 3. **`scarcity_note` 只展示**（判据 DL）：标签写成「设计意图」，并明写不参与任何计算。
 *
 * ## W6a-4：提案通道的「本书」这一路
 *
 * 设计稿 §3.4 写了「模型只能提议，落库前必须确认」，这一块就是那个确认面。
 * 候选有三个来源（共用同一套展示与闸门）：
 * 1. 「从世界观抽取候选」按钮（本书，手动）；
 * 2. `storedCandidates`（下一本，生成侧写进检查点的那份）；
 * 3. 两者都只进内存 state，**不落盘** —— 重开面板再点一次即可（§4.6.3）。
 *
 * 候选进表前**必须**过 `filterResourceCandidates`：引文要能在当前世界观正文里逐字命中。
 * 检查点是生成时的快照，作者事后改过正文时旧引文一条都不成立 —— 直接展示等于把
 * 陈引文当成有效依据（与自审的 `readStoredSelfReview` 同一个道理）。
 */
type LocaleText = (zh: string, en: string) => string

/** 十个可编辑列。顺序即表头顺序。 */
type DraftField =
  | 'name'
  | 'familyId'
  | 'tier'
  | 'unit'
  | 'period'
  | 'anchorValue'
  | 'earnNote'
  | 'costNote'
  | 'scarcityNote'
  | 'anchorNote'

interface Column {
  field: DraftField
  labelZh: string
  labelEn: string
  /** 必填列在表头加星号。 */
  required?: boolean
  /** 表头小字：只解释语义，不参与校验。 */
  hintZh?: string
  hintEn?: string
  width: string
}

const COLUMNS: readonly Column[] = [
  { field: 'name', labelZh: '名称', labelEn: 'Name', required: true, width: '9rem' },
  { field: 'familyId', labelZh: '资源族', labelEn: 'Family', width: '7rem' },
  { field: 'tier', labelZh: '品阶', labelEn: 'Tier', width: '4rem' },
  { field: 'unit', labelZh: '单位', labelEn: 'Unit', required: true, width: '5rem' },
  { field: 'period', labelZh: '口径（周期）', labelEn: 'Period', required: true, width: '7rem' },
  {
    field: 'anchorValue',
    labelZh: '换算锚',
    labelEn: 'Anchor',
    hintZh: '留空 = 不可通兑',
    hintEn: 'Blank = not convertible',
    width: '6rem',
  },
  { field: 'earnNote', labelZh: '收入说明', labelEn: 'Earned by', width: '9rem' },
  { field: 'costNote', labelZh: '支出说明', labelEn: 'Spent on', width: '9rem' },
  {
    field: 'scarcityNote',
    labelZh: '设计意图',
    labelEn: 'Design intent',
    hintZh: '仅展示，不参与任何计算',
    hintEn: 'Display only, never used in any calculation',
    width: '10rem',
  },
  { field: 'anchorNote', labelZh: '换算说明', labelEn: 'Anchor note', width: '9rem' },
]

interface DraftRow {
  /** 渲染 key；已落库行直接用 `resourceId`，新行用本地随机串。 */
  key: string
  resourceId?: string
  name: string
  familyId: string
  tier: string
  unit: string
  period: string
  anchorValue: string
  earnNote: string
  costNote: string
  scarcityNote: string
  anchorNote: string
  /** 已有账本记录的删除只是打标记，保存时才真的调 `db:resources-delete`。 */
  removing: boolean
  /** 本行就地错误（校验 / 后端拒绝原因）。 */
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    name: '',
    familyId: '',
    tier: '0',
    unit: '',
    period: '',
    anchorValue: '',
    earnNote: '',
    costNote: '',
    scarcityNote: '',
    anchorNote: '',
    removing: false,
    error: '',
  }
}

function rowFromDefinition(resource: ResourceDefinition): DraftRow {
  return {
    key: resource.resourceId,
    resourceId: resource.resourceId,
    name: resource.name,
    familyId: resource.familyId ?? '',
    tier: String(resource.tier ?? 0),
    unit: resource.unit,
    period: resource.period,
    // null 渲染成空串：空 = 不可通兑；渲染成 0 会被读成「免费兑换」。
    anchorValue: resource.anchorValue === null ? '' : String(resource.anchorValue),
    earnNote: resource.earnNote ?? '',
    costNote: resource.costNote ?? '',
    scarcityNote: resource.scarcityNote ?? '',
    anchorNote: resource.anchorNote ?? '',
    removing: false,
    error: '',
  }
}

/**
 * 本地校验：名称非空且不重复、单位非空、口径非空、换算锚只能空或正数。
 *
 * `0` 必须拦在这里：仓储把它读成「1 单位 = 0 基准值」，等价于免费兑换，
 * 而作者想表达的是「不可通兑」——那是留空，不是 0。
 */
function validateRows(
  rows: readonly DraftRow[],
  text: LocaleText,
): Map<string, string> {
  const problems = new Map<string, string[]>()
  const push = (key: string, message: string) => {
    const list = problems.get(key)
    if (list) list.push(message)
    else problems.set(key, [message])
  }
  const seenNames = new Set<string>()
  for (const row of rows) {
    if (row.removing) continue
    const name = row.name.trim()
    const firstOwner = seenNames.has(name)
    if (!name) push(row.key, text('名称不能为空', 'Name is required'))
    else if (firstOwner) push(row.key, text(`名称与上面的行重复：${name}`, `Duplicate name above: ${name}`))
    if (name) seenNames.add(name)
    if (!row.unit.trim()) push(row.key, text('单位不能为空', 'Unit is required'))
    if (!row.period.trim()) push(row.key, text('口径（周期）不能为空', 'Accounting period is required'))
    const tier = row.tier.trim()
    if (tier && (!Number.isSafeInteger(Number(tier)) || Number(tier) < 0)) {
      push(row.key, text('品阶只能是不小于 0 的整数', 'Tier must be an integer of 0 or more'))
    }
    const anchor = row.anchorValue.trim()
    if (anchor) {
      const value = Number(anchor)
      if (!Number.isFinite(value) || value <= 0) {
        push(row.key, text(
          '换算锚只能留空或填正数：0 会被读成「免费兑换」，不可通兑请留空',
          'Anchor must be blank or positive: 0 reads as a free exchange; leave it blank when not convertible',
        ))
      }
    }
  }
  return new Map([...problems].map(([key, messages]) => [key, messages.join('；')]))
}

function toInput(row: DraftRow): ResourceDefinitionInput {
  const anchor = row.anchorValue.trim()
  const tier = row.tier.trim()
  return {
    ...(row.resourceId ? { resourceId: row.resourceId } : {}),
    familyId: row.familyId.trim() || null,
    name: row.name.trim(),
    tier: tier ? Number(tier) : 0,
    unit: row.unit.trim(),
    anchorValue: anchor ? Number(anchor) : null,
    period: row.period.trim(),
    earnNote: row.earnNote.trim(),
    costNote: row.costNote.trim(),
    scarcityNote: row.scarcityNote.trim(),
    anchorNote: row.anchorNote.trim(),
  }
}

/**
 * 口径词根：`period` 必须说明"多久结算一次"。
 *
 * 只收单字词根，靠"结尾是不是它"判定，误报最低。
 * 代价是 `三天一副`（费率描述）算通过 —— 它至少以量词结尾；
 * 这条提示只负责抓**形态明显不对**的那一类（`永久兑换`、`100`）。
 */
const PERIOD_ROOTS = new Set(['日', '天', '周', '月', '季', '年', '章', '次', '副', '回', '轮', '单', '笔', '夜', '刻', '更'])

/**
 * 建议级提示（W6a-7）：**只提示、不阻断**（判据 DL 同源）。
 *
 * 为什么要有：实机见三处登记口径填错 —— `unit=100`（把金额填进单位）、
 * `period=永久兑换`（不是周期）、`unit=枚` 而正文写「副」。
 * 前两类是**形态**问题，面板自己就能看出来；第三类是**语义**问题，
 * 面板不知道正文，只能交给 `unit-mismatch` 冲突机制（已工作）。
 *
 * 所以这里只做能确定的判断，措辞一律是"看起来/建议"，不给结论（判据 CJ）。
 */
function reviewRows(rows: readonly DraftRow[], text: LocaleText): Map<string, string> {
  const hints = new Map<string, string>()
  for (const row of rows) {
    if (row.removing) continue
    const unit = row.unit.trim()
    const period = row.period.trim()
    const messages: string[] = []

    if (unit) {
      if (/^\d+(?:\.\d+)?$/u.test(unit)) {
        messages.push(text(
          `单位填成了数字 ${unit} —— 看起来是把金额写进了单位列，单位应是量词（枚/株/间）`,
          `Unit looks like a number (${unit}); the unit column expects a counter such as pieces or plants`,
        ))
      } else if (unit.length > 6) {
        messages.push(text(
          '单位这一列通常是短量词；这段更像一句说明',
          'The unit column expects a short counter; this reads like a sentence',
        ))
      }
    }

    if (period) {
      const tail = period.slice(-1)
      if (!PERIOD_ROOTS.has(tail)) {
        messages.push(text(
          `口径（周期）应说明多久结算一次（日/月/副/次），「${period}」看起来不是口径`,
          `The period should say how often it settles (day/month/dose/time); “${period}” does not look like one`,
        ))
      }
    }

    if (messages.length > 0) hints.set(row.key, messages.join('；'))
  }
  return hints
}

/** 写库失败的可见文案。后端回的是错误码，不是给人看的话。 */
function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'RESOURCE_NAME_DUPLICATED':
      return text('名称已存在，请换一个名字', 'That name already exists')
    case 'RESOURCE_LEDGER_SCHEMA_MISSING':
      return text(
        '这个项目的数据库还没有资源账本表，无法保存',
        'This project database has no resource ledger tables yet',
      )
    case 'PROJECT_NOT_OPEN':
      return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('RESOURCE_INVALID:')) {
        return text(
          `有一个字段不合法（${error.slice('RESOURCE_INVALID:'.length)}），没有保存`,
          `One field is invalid (${error.slice('RESOURCE_INVALID:'.length)}) and was not saved`,
        )
      }
      return text(
        `保存失败（${error ?? '未知原因'}）`,
        `Could not save (${error ?? 'unknown reason'})`,
      )
  }
}

function deleteErrorLabel(
  error: string | undefined,
  movementCount: number | undefined,
  text: LocaleText,
): string {
  if (error === 'RESOURCE_HAS_MOVEMENTS') {
    // 这不是「偶发失败」，重试一万次也不会成功，所以只解释原因、不给重试入口。
    return movementCount === undefined
      ? text(
          '该资源已有账本记录，删定义会丢掉历史',
          'This resource already has ledger entries; deleting the definition would lose that history',
        )
      : text(
          `该资源已有 ${movementCount} 条账本记录，删定义会丢掉历史`,
          `This resource already has ${movementCount} ledger entries; deleting the definition would lose that history`,
        )
  }
  if (error === 'RESOURCE_NOT_FOUND') {
    return text('这条资源已经不在了，刷新列表即可', 'This resource no longer exists; refresh the list')
  }
  return writeErrorLabel(error, text)
}

/**
 * 候选确认区的一行。
 *
 * `unit` / `period` 是**草稿**而不是候选原值：模型没抽到单位时（§4.6.4 的常见情形），
 * 作者必须能就地补一个 —— 否则「缺单位请补一个」这条提示没有可执行落点。
 */
interface CandidateRow {
  key: string
  candidate: ResourceCandidate
  unit: string
  period: string
  selected: boolean
  /** 本行就地错误（闸门原因 / 后端拒绝原因）。 */
  error: string
}

function toCandidateRow(candidate: ResourceCandidate): CandidateRow {
  // 候选名已由 `parseResourceCandidates` 去重，可直接当 key；加前缀避免与草稿行撞。
  return {
    key: `candidate:${candidate.name}`,
    candidate,
    unit: candidate.unit ?? '',
    period: candidate.period ?? '',
    selected: false,
    error: '',
  }
}

/**
 * 这条候选现在能不能落库。空串 = 可以。
 *
 * 三道闸门，顺序即作者看到的那个原因（一次只说最该先解决的那条）：
 * 重名 → 缺单位 → 缺口径。后两条在后端都会失败（`NOT NULL`），
 * 但在这里拦住的差别是**不发 IPC、原因说得更清楚**。
 */
function candidateBlockReason(
  row: CandidateRow,
  registeredNames: ReadonlySet<string>,
  text: LocaleText,
): string {
  if (registeredNames.has(row.candidate.name.trim())) {
    return text(
      '已登记：同名资源已在表里，要改请改上面那一行',
      'Already registered: change the existing row above instead',
    )
  }
  if (!row.unit.trim()) {
    return text(
      '缺单位，请补一个，例如「枚」「元」—— 单位错了会让以后每一笔记账都对不上',
      'Unit is missing; add one (e.g. pieces, yuan) — a wrong unit makes every later ledger entry mismatch',
    )
  }
  if (!row.period.trim()) {
    return text(
      '缺口径（周期），请补一个，例如「日」「月」—— 日结与月结会差 30 倍',
      'Period is missing; add one (e.g. day, month) — daily versus monthly differs by 30x',
    )
  }
  return ''
}

/**
 * 候选 → 落库入参。
 *
 * `anchorValue` 原样传：`null` 的语义是「不可通兑」（可用状态），**绝不能填 0** ——
 * 0 会被读成「免费兑换」，与不可通兑正好相反（判据 DN / CS）。
 */
function candidateToInput(row: CandidateRow): ResourceDefinitionInput {
  const { candidate } = row
  return {
    familyId: candidate.familyId,
    name: candidate.name.trim(),
    tier: candidate.tier,
    unit: row.unit.trim(),
    anchorValue: candidate.anchorValue,
    period: row.period.trim(),
    earnNote: candidate.earnNote ?? '',
    costNote: candidate.costNote ?? '',
    scarcityNote: candidate.scarcityNote ?? '',
    anchorNote: candidate.anchorNote ?? '',
  }
}

/** 候选卡上的可空列：null 一律显示「—」，绝不显示 0。 */
function candidateCell(value: string | number | null): string {
  if (value === null) return '—'
  if (typeof value === 'number') return String(value)
  const trimmed = value.trim()
  return trimmed ? trimmed : '—'
}

export function ResourceRegistryPanel({
  projectKey,
  worldbuilding,
  storedCandidates,
  writingLanguage,
}: {
  projectKey: string
  /** 世界观全文：抽取候选的唯一输入（不扫已定稿正文，§4.6.5）。 */
  worldbuilding?: string
  /** 检查点里的候选 JSON（下一本那一路）；进面板后仍按当前正文重验引文。 */
  storedCandidates?: string
  /** 提示词语言；缺省跟随项目配置。 */
  writingLanguage?: WritingLanguage
}) {
  const currentProject = useProjectStore(state => state.currentProject)
  const text = useLocaleStore(state => state.text)
  const locale = useLocaleStore(state => state.locale)
  const language = resolveWritingLanguage(writingLanguage ?? currentProject?.novelConfig?.writingLanguage)
  /** 候选提示语跟随界面语言（`describeResourceCandidates` 只认这两种）。 */
  const noticeLanguage = locale === 'en-US' ? 'en-US' : 'zh-CN'
  const [rows, setRows] = useState<DraftRow[]>([])
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [candidateNotice, setCandidateNotice] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [loadError, setLoadError] = useState('')
  /** 保存中禁止重复提交；state 更新滞后一拍，挡不住连点。 */
  const busyRef = useRef(false)
  /** 抽取中禁止重复点击。 */
  const extractingRef = useRef(false)
  /** 上一次已应用的 `storedCandidates`，防止编辑器每次 loadStatus 抹掉手工抽取/刚补的单位。 */
  const appliedStoredCandidates = useRef<string | null>(null)

  const applyField = useCallback((key: string, field: DraftField, value: string) => {
    setRows(previous => previous.map(row => (
      row.key === key ? { ...row, [field]: value, error: '' } : row
    )))
    setStatus('')
  }, [])

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setRows([])
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await ipc.invokeWithProjectSession(
        projectSession,
        'db:resources-list',
        projectSession.projectPath,
      )
      if (!isProjectSessionCurrent(projectSession)) return
      if (!result.success) {
        setLoadError(writeErrorLabel(result.error, text))
        return
      }
      setLoadError('')
      setRows((result.resources ?? []).map(rowFromDefinition))
    } catch {
      if (isProjectSessionCurrent(projectSession)) {
        setLoadError(text('无法读取资源清单', 'Could not read the resource list'))
      }
    } finally {
      if (isProjectSessionCurrent(projectSession)) setLoading(false)
    }
  }, [projectKey, text])

  useEffect(() => {
    // 延到微任务再读：effect 体内同步 setState 会触发级联渲染（react-hooks/set-state-in-effect）。
    queueMicrotask(() => { void load() })
  }, [load, currentProject?.sessionLease])

  /**
   * 检查点里的候选（下一本那一路）进面板。
   *
   * 三条约束，少一条都会静默出错：
   * 1. **必须重验引文**（`filterResourceCandidates`）：正文被作者改过之后，旧引文一条都不成立。
   * 2. 世界观正文还没读到（空串）时**不应用** —— 那会把每一条都判成「引文命不中」而全丢，
   *    于是编辑器哪怕只是重载一次，候选就永久消失了。等正文到位再应用。
   * 3. 只在 prop **真的变了**时覆盖：否则任何一次 `loadStatus` 都会抹掉作者刚手工抽取、
   *    或刚补了一半单位的结果。
   */
  const applyStoredCandidates = useCallback(() => {
    if (!storedCandidates || !worldbuilding?.trim()) return
    if (appliedStoredCandidates.current === storedCandidates) return
    appliedStoredCandidates.current = storedCandidates
    const set = filterResourceCandidates(parseResourceCandidates(storedCandidates), worldbuilding)
    if (set.unreadable) {
      setCandidateNotice(describeResourceCandidates(set, noticeLanguage) ?? '')
      return
    }
    if (set.candidates.length === 0) {
      setCandidateNotice(set.dropped > 0
        ? text(
            '检查点里的候选依据在当前世界观里已经找不到了（正文被改过），已全部丢弃。',
            'The stored proposals no longer match the current worldbuilding (the text changed), so all were discarded.',
          )
        : '')
      return
    }
    setCandidates(set.candidates.map(toCandidateRow))
    setCandidateNotice(describeResourceCandidates(set, noticeLanguage) ?? '')
  }, [storedCandidates, worldbuilding, noticeLanguage, text])

  useEffect(() => {
    queueMicrotask(applyStoredCandidates)
  }, [applyStoredCandidates])

  /**
   * 正文被改过之后，**已展示的**候选也要重验一遍。
   *
   * 只丢引文已经不存在的那几行（依据没了，勾了也是无据可查），保留其余行的
   * 单位/周期草稿 —— 作者补到一半的内容不该因为别处改了一句设定就整批消失。
   */
  useEffect(() => {
    queueMicrotask(() => {
      const world = worldbuilding ?? ''
      if (!world.trim()) return
      setCandidates(previous => previous.filter(row => (
        isQuotePresent(row.candidate.quote, world) && isQuotePresent(row.candidate.name, world)
      )))
    })
  }, [worldbuilding])

  const toggleCandidate = (key: string) => {
    setCandidateNotice('')
    setCandidates(previous => previous.map(row => (
      row.key === key ? { ...row, selected: !row.selected, error: '' } : row
    )))
  }

  const applyCandidateField = (key: string, field: 'unit' | 'period', value: string) => {
    setCandidateNotice('')
    setCandidates(previous => previous.map(row => (
      row.key === key ? { ...row, [field]: value, error: '' } : row
    )))
  }

  /**
   * 「从世界观抽取候选」：本书这一路。
   *
   * 与定稿后处理里的账本抽取同一档一次性调用（非流式、非持久化），
   * 失败**永不改表格、永不弹窗、永不写库** —— 它产出的只是提案。
   */
  const extractCandidates = async () => {
    if (extractingRef.current) return
    const world = (worldbuilding ?? '').trim()
    if (!world) {
      setCandidateNotice(text(
        '世界观还没有内容，先完成世界观生成再抽取。',
        'The worldbuilding is still empty; generate it before extracting proposals.',
      ))
      return
    }
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setCandidateNotice(text('项目会话已切换，请重新打开这个页面', 'The project session changed; reopen this page'))
      return
    }
    /**
     * 三种「没拿到」共用一句文案：调用失败 / 模板缺失 / 坏 JSON 对作者是同一件事
     * （本次没有结果），但它们与「这本书没有资源」是**相反**的含义，不能合并。
     *
     * `reason` 是 provider 的真实原因摘要（已脱敏裁剪）。2026-10-23 那次连失 5 次，
     * 界面只说「没拿到结果」，而库里只剩 `finish:error` —— 作者无从判断是模型不认
     * `response_format`、还是没额度，只能猜。所以这里必须把原因带出来。
     */
    const unusable = (reason?: string) => {
      const base = describeResourceCandidates({ candidates: [], unreadable: true, dropped: 0 }, noticeLanguage) ?? ''
      setCandidateNotice(reason ? `${base}${text('原因：', 'Reason: ')}${reason}` : base)
    }

    extractingRef.current = true
    setExtracting(true)
    setCandidateNotice('')
    try {
      const template = await resolvePromptTemplate('world_building_resource_extract', projectSession, language)
      if (!isProjectSessionCurrent(projectSession)) return
      if (!template) { unusable(); return }

      // 服务端不认 `response_format` 时由这层降级重试一次（解析端本来就能剥围栏）。
      const outcome = await generateStructuredJson({
        messages: [
          { role: 'system', content: composePromptSystemRole(template, language) },
          { role: 'user', content: renderPrompt(template, { world_building: world }, language) },
        ],
        purpose: 'world-building-resource-extract',
        reasoningStage: 'planning',
        projectSession,
      })
      // 项目切了就丢弃结果：它是上一个项目的提案，写进这个项目的 state 就是串项目。
      if (!isProjectSessionCurrent(projectSession) || !isProjectSessionPath(projectSession, projectKey)) return
      if (!outcome.ok) { unusable(outcome.error); return }

      const set = filterResourceCandidates(parseResourceCandidates(outcome.content), world)
      if (set.unreadable) { unusable(); return }
      if (set.candidates.length === 0) {
        setCandidateNotice(text(
          '世界观里没有找到可登记的资源 —— 这份设定可能还没写到具体数额与结算周期。',
          'No registrable resource was found: this worldbuilding may not state amounts or settlement periods yet.',
        ))
        return
      }
      setCandidates(set.candidates.map(toCandidateRow))
      const summary = describeResourceCandidates(set, noticeLanguage) ?? ''
      setCandidateNotice(outcome.degraded
        ? `${summary}${text(
            '（服务端不接受结构化输出，本次已按普通补全重试成功）',
            ' (The service rejected structured output, so this run fell back to plain completion.)',
          )}`
        : summary)
    } catch (error) {
      if (isProjectSessionCurrent(projectSession)) {
        unusable(error instanceof Error ? error.message : String(error))
      }
    } finally {
      extractingRef.current = false
      setExtracting(false)
    }
  }

  const addRow = () => {
    setRows(previous => [...previous, emptyRow()])
    setStatus('')
  }

  const removeRow = (key: string) => {
    setStatus('')
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.resourceId) return previous.filter(row => row.key !== key)
      return previous.map(row => (row.key === key ? { ...row, removing: true, error: '' } : row))
    })
  }

  const undoRemove = (key: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, removing: false, error: '' } : row)))
  }

  const save = async () => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setStatus(text('项目会话已切换，请重新打开这个页面', 'The project session changed; reopen this page'))
      return
    }
    const current = rows
    const problems = validateRows(current, text)
    if (problems.size > 0) {
      // 校验不通过就整批不提交：一行重名不该让别的行偷偷落库。
      setRows(previous => previous.map(row => (
        problems.has(row.key) ? { ...row, error: problems.get(row.key) ?? '' } : row
      )))
      setStatus(text(
        `有 ${problems.size} 行还需要修改，本次没有提交`,
        `${problems.size} row(s) need changes; nothing was submitted`,
      ))
      return
    }

    busyRef.current = true
    setBusy(true)
    setStatus('')
    try {
      const kept: DraftRow[] = []
      let saved = 0
      let failed = 0
      for (const row of current) {
        if (!isProjectSessionCurrent(projectSession)) return
        if (row.removing) {
          if (!row.resourceId) continue
          const result = await ipc.invokeWithProjectSession(
            projectSession,
            'db:resources-delete',
            row.resourceId,
            projectSession.projectPath,
          )
          if (result.success) continue
          failed += 1
          // 删不掉就把行留着，原因写在这一行下面 —— 历史不能被静默丢掉。
          kept.push({
            ...row,
            removing: false,
            error: deleteErrorLabel(result.error, result.movementCount, text),
          })
          continue
        }
        const input = toInput(row)
        const result = await ipc.invokeWithProjectSession(
          projectSession,
          'db:resources-upsert',
          input,
          projectSession.projectPath,
        )
        if (result.success && result.resourceId) {
          saved += 1
          kept.push({
            ...row,
            key: result.resourceId,
            resourceId: result.resourceId,
            name: input.name,
            familyId: input.familyId ?? '',
            unit: input.unit,
            period: input.period,
            tier: String(input.tier ?? 0),
            anchorValue: input.anchorValue === null || input.anchorValue === undefined
              ? ''
              : String(input.anchorValue),
            error: '',
          })
        } else {
          failed += 1
          kept.push({ ...row, error: writeErrorLabel(result.error, text) })
        }
      }
      if (!isProjectSessionCurrent(projectSession)) return
      setRows(kept)
      setStatus(failed === 0
        ? text(`已保存 ${saved} 条资源定义`, `Saved ${saved} resource definition(s)`)
        : text(
            `已保存 ${saved} 条，${failed} 条没有保存（原因见对应行）`,
            `Saved ${saved}; ${failed} not saved (see the affected rows)`,
          ))
    } catch {
      if (isProjectSessionCurrent(projectSession)) {
        setStatus(text('保存失败，请查看下方各行的提示', 'Saving failed; see the per-row messages'))
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /**
   * 勾选确认后逐条登记。
   *
   * 三条纪律：
   * 1. **逐条**提交，失败的留着、其余继续 —— 一条重名不该让另外九条白填。
   * 2. 落库成功后**只 append 进表格，不重读清单**：`rows` 里可能有作者没保存的草稿，
   *    `load()` 会把它们静默冲掉。
   * 3. 成功且全绿时补一句「去补扫」—— 登记完不补扫，账本仍然是空的，
   *    作者会以为这一整轮没生效（先登记、后补扫，顺序不能反）。
   */
  const commitCandidates = async () => {
    if (busyRef.current) return
    if (!candidates.some(row => row.selected)) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setCandidateNotice(text('项目会话已切换，请重新打开这个页面', 'The project session changed; reopen this page'))
      return
    }
    busyRef.current = true
    setBusy(true)
    setCandidateNotice('')
    try {
      const registered = new Set(
        rows.filter(row => !row.removing).map(row => row.name.trim()).filter(Boolean),
      )
      const kept: CandidateRow[] = []
      const appended: DraftRow[] = []
      let saved = 0
      let failed = 0

      for (const row of candidates) {
        if (!isProjectSessionCurrent(projectSession)) return
        if (!row.selected) { kept.push(row); continue }

        // 双保险：UI 已禁用复选框，这里再拦一次 —— 缺单位落库等于埋一颗静默的雷。
        const blocked = candidateBlockReason(row, registered, text)
        if (blocked) { failed += 1; kept.push({ ...row, selected: false, error: blocked }); continue }

        const input = candidateToInput(row)
        const result = await ipc.invokeWithProjectSession(
          projectSession,
          'db:resources-upsert',
          input,
          projectSession.projectPath,
        )
        if (result.success && result.resourceId) {
          saved += 1
          registered.add(input.name)
          appended.push(rowFromDefinition({
            resourceId: result.resourceId,
            familyId: input.familyId ?? null,
            name: input.name,
            tier: input.tier ?? 0,
            unit: input.unit,
            anchorValue: input.anchorValue ?? null,
            period: input.period,
            earnNote: input.earnNote ?? '',
            costNote: input.costNote ?? '',
            scarcityNote: input.scarcityNote ?? '',
            anchorNote: input.anchorNote ?? '',
            createdAt: '',
            updatedAt: '',
          }))
        } else {
          failed += 1
          kept.push({ ...row, selected: false, error: writeErrorLabel(result.error, text) })
        }
      }

      if (!isProjectSessionCurrent(projectSession)) return
      setCandidates(kept)
      if (appended.length > 0) setRows(previous => [...previous, ...appended])
      if (saved > 0 && failed === 0) {
        setStatus(text(
          `已登记 ${saved} 条资源定义。接着去「世界状态 → 资源」的「账本回填」点「补扫第 1–N 章」，第 1 章起的变动才会进账本。`,
          `Registered ${saved} resource definition(s). Next, open World state -> Resources and run "Ledger backfill" so movements from existing chapters are extracted.`,
        ))
      } else {
        setStatus(text(
          `已登记 ${saved} 条，${failed} 条没有登记（原因见对应行）`,
          `Registered ${saved}; ${failed} not registered (see the affected rows)`,
        ))
      }
    } catch {
      if (isProjectSessionCurrent(projectSession)) {
        setCandidateNotice(text('登记失败，请查看候选行上的提示', 'Registration failed; see the messages on the proposal rows'))
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /** 已登记的名字：候选撞它就不给勾（别让它撞 UNIQUE，也别让作者登记出两份同名定义）。 */
  const registeredNames = new Set(
    rows.filter(row => !row.removing).map(row => row.name.trim()).filter(Boolean),
  )
  const selectedCandidateCount = candidates.filter(row => row.selected).length
  /** 建议级提示：不阻断保存，所以每次渲染实时算（不进 state，避免与草稿不同步）。 */
  const rowHints = reviewRows(rows, text)
  const canExtract = !extracting && !busy && Boolean(worldbuilding?.trim())

  return (
    <section
      data-testid="resource-registry-panel"
      aria-label={text('资源登记', 'Resource registry')}
      className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-panel)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {text('资源登记', 'Resource registry')}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '这里登记的是资源定义（名称、单位、口径、换算关系），不是余额。改完点「保存」一次性提交。',
              'These are resource definitions (name, unit, period, conversion), not balances. Edits are submitted together when you save.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => void load()} title={text('刷新', 'Refresh')} disabled={busy}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} disabled={busy}>
            <Plus size={12} />
            {text('增行', 'Add row')}
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={busy || loading || rows.length === 0}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {busy ? text('保存中...', 'Saving...') : text('保存', 'Save')}
          </Button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-xs" style={{ color: 'var(--color-error-text)' }}>{loadError}</p>
      )}
      {status && (
        <p role="status" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{status}</p>
      )}

      {/* W6a-4：提案 → 确认。模型只能提议，勾选后才进下面那张表（设计稿 §3.4 / §4.6）。 */}
      <div
        data-testid="resource-candidate-zone"
        className="rounded-md px-2.5 py-2 space-y-2"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              {text('从世界观抽取候选', 'Extract resource proposals')}
            </div>
            <div className="text-[0.62rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {text(
                '只读世界观全文提出候选，每条都附原文依据。勾选后才会写进下表 —— 模型不能直接落库。缺单位/缺口径的行必须先补齐。',
                'Proposals are read from the worldbuilding only, and each one carries its verbatim evidence. Nothing is registered until you tick it. Rows missing a unit or period must be completed first.',
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 flex-shrink-0 px-2 text-[0.65rem]"
            disabled={!canExtract}
            title={worldbuilding?.trim()
              ? text('读世界观全文，提出资源登记候选', 'Read the worldbuilding and propose resource entries')
              : text('世界观还没有内容，先完成世界观生成', 'The worldbuilding is empty; generate it first')}
            onClick={() => void extractCandidates()}
          >
            {extracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {extracting
              ? text('抽取中...', 'Extracting...')
              : text('从世界观抽取候选', 'Extract proposals')}
          </Button>
        </div>

        {candidateNotice && (
          <p role="status" className="text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {candidateNotice}
          </p>
        )}

        {candidates.length > 0 && (
          <div className="overflow-x-auto space-y-1">
            <table className="w-full text-xs border-collapse" style={{ color: 'var(--color-text)' }}>
              <thead>
                <tr style={{ color: 'var(--color-text-secondary)' }}>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">
                    {text('选择', 'Select')}
                  </th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('名称', 'Name')}</th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('资源族', 'Family')}</th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('品阶', 'Tier')}</th>
                  <th
                    scope="col"
                    className="text-left px-1 pb-1 font-medium whitespace-nowrap"
                    style={{ minWidth: '5rem' }}
                  >
                    {text('单位', 'Unit')}<span aria-hidden="true"> *</span>
                  </th>
                  <th
                    scope="col"
                    className="text-left px-1 pb-1 font-medium whitespace-nowrap"
                    style={{ minWidth: '6rem' }}
                  >
                    {text('口径（周期）', 'Period')}<span aria-hidden="true"> *</span>
                  </th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('换算锚', 'Anchor')}</th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('收入说明', 'Earned by')}</th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('支出说明', 'Spent on')}</th>
                  <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">{text('设计意图', 'Design intent')}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(row => {
                  const blocked = candidateBlockReason(row, registeredNames, text)
                  return (
                    <Fragment key={row.key}>
                      <tr data-testid="resource-candidate" data-blocked={blocked ? 'true' : 'false'}>
                        <td className="px-1 py-0.5 align-top">
                          <input
                            type="checkbox"
                            data-field="candidate-select"
                            aria-label={text(`选择 ${row.candidate.name}`, `Select ${row.candidate.name}`)}
                            checked={row.selected}
                            // 有拦路原因就不给勾：不提供「强行落库」的口子（§4.6.4）。
                            disabled={Boolean(blocked) || busy}
                            onChange={() => toggleCandidate(row.key)}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-top whitespace-nowrap">{row.candidate.name}</td>
                        <td className="px-1 py-0.5 align-top whitespace-nowrap">{candidateCell(row.candidate.familyId)}</td>
                        <td className="px-1 py-0.5 align-top whitespace-nowrap">{row.candidate.tier}</td>
                        <td className="px-1 py-0.5 align-top">
                          <input
                            data-field="candidate-unit"
                            aria-label={text(`单位 ${row.candidate.name}`, `Unit for ${row.candidate.name}`)}
                            className="w-full h-6 px-1.5 rounded text-xs"
                            style={{
                              backgroundColor: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text)',
                            }}
                            placeholder={text('必填', 'required')}
                            value={row.unit}
                            disabled={busy}
                            onChange={event => applyCandidateField(row.key, 'unit', event.target.value)}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-top">
                          <input
                            data-field="candidate-period"
                            aria-label={text(`口径 ${row.candidate.name}`, `Period for ${row.candidate.name}`)}
                            className="w-full h-6 px-1.5 rounded text-xs"
                            style={{
                              backgroundColor: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text)',
                            }}
                            placeholder={text('必填', 'required')}
                            value={row.period}
                            disabled={busy}
                            onChange={event => applyCandidateField(row.key, 'period', event.target.value)}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-top whitespace-nowrap">{candidateCell(row.candidate.anchorValue)}</td>
                        <td className="px-1 py-0.5 align-top">{candidateCell(row.candidate.earnNote)}</td>
                        <td className="px-1 py-0.5 align-top">{candidateCell(row.candidate.costNote)}</td>
                        <td className="px-1 py-0.5 align-top">{candidateCell(row.candidate.scarcityNote)}</td>
                      </tr>
                      <tr>
                        <td colSpan={10} className="px-1 pb-1.5 align-top">
                          <div className="text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                            {/* 原文依据是作者敢不敢勾的唯一依据，必须逐字展示。 */}
                            <span>{text('原文依据：', 'Evidence: ')}</span>
                            <span data-testid="candidate-quote" style={{ color: 'var(--color-text-secondary)' }}>
                              「{row.candidate.quote}」
                            </span>
                          </div>
                          {row.candidate.anchorQuote !== null && (
                            <div className="text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                              <span>{text('换算锚依据：', 'Anchor evidence: ')}</span>
                              <span data-testid="candidate-anchor-quote" style={{ color: 'var(--color-text-secondary)' }}>
                                「{row.candidate.anchorQuote}」
                              </span>
                            </div>
                          )}
                          {blocked && (
                            <div
                              role="status"
                              className="text-[0.65rem] leading-relaxed"
                              style={{ color: 'var(--color-warning-text)' }}
                            >
                              {blocked}
                            </div>
                          )}
                          {row.error && (
                            <div role="alert" className="text-[0.65rem] leading-relaxed" style={{ color: 'var(--color-error-text)' }}>
                              {row.error}
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-end gap-2">
              <span className="text-[0.65rem]" style={{ color: 'var(--color-text-muted)' }}>
                {text(`已选 ${selectedCandidateCount} 条`, `${selectedCandidateCount} selected`)}
              </span>
              <Button
                size="sm"
                disabled={busy || selectedCandidateCount === 0}
                onClick={() => void commitCandidates()}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {text('登记选中', 'Register selected')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '先登记本书的资源：灵石分品阶就填同一个资源族，涨跌各自的货币各占一行。',
            "Register this book's resources first: tiered spirit stones share one family, and each currency that rises or falls gets its own row.",
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ color: 'var(--color-text)' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-secondary)' }}>
                {COLUMNS.map(column => (
                  <th
                    key={column.field}
                    scope="col"
                    className="text-left align-bottom px-1 pb-1 font-medium whitespace-nowrap"
                    style={{ minWidth: column.width }}
                  >
                    {text(column.labelZh, column.labelEn)}
                    {column.required && <span aria-hidden="true"> *</span>}
                    {column.hintZh && column.hintEn && (
                      <span className="block text-[0.65rem] font-normal" style={{ color: 'var(--color-text-muted)' }}>
                        {text(column.hintZh, column.hintEn)}
                      </span>
                    )}
                  </th>
                ))}
                <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">
                  {text('操作', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <Fragment key={row.key}>
                  <tr
                    data-testid="resource-row"
                    data-removing={row.removing ? 'true' : 'false'}
                    style={{ opacity: row.removing ? 0.5 : 1 }}
                  >
                    {COLUMNS.map(column => {
                      const label = `${text(column.labelZh, column.labelEn)} ${index + 1}`
                      return (
                        <td key={column.field} className="px-1 py-0.5 align-top">
                          <input
                            data-field={column.field}
                            aria-label={label}
                            aria-invalid={row.error ? true : undefined}
                            className="w-full h-6 px-1.5 rounded text-xs"
                            style={{
                              backgroundColor: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text)',
                              textDecoration: row.removing ? 'line-through' : undefined,
                            }}
                            inputMode={
                              column.field === 'tier' ? 'numeric'
                                : column.field === 'anchorValue' ? 'decimal'
                                  : undefined
                            }
                            // 0 不是一个「没填」的占位值，它就是「基础品阶 / 单例资源」。
                            // 不写这句的话，作者会以为留空等于「未分品阶」，而库里存的是 0。
                            placeholder={
                              column.field === 'tier' ? text('0=基础', '0=base')
                                : column.field === 'anchorValue' ? text('空=不通兑', 'blank=no exchange')
                                  : undefined
                            }
                            value={row[column.field]}
                            disabled={row.removing || busy}
                            onChange={event => applyField(row.key, column.field, event.target.value)}
                          />
                        </td>
                      )
                    })}
                    <td className="px-1 py-0.5 align-top whitespace-nowrap">
                      {row.removing ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => undoRemove(row.key)}
                          title={text('撤销删除', 'Undo delete')}
                        >
                          <Undo2 size={12} />
                          {text('撤销', 'Undo')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => removeRow(row.key)}
                          title={text('删除这一行', 'Delete this row')}
                        >
                          <Trash2 size={12} />
                          {text('删除', 'Delete')}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {row.error ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-1 pb-1">
                        <span role="alert" className="text-xs" style={{ color: 'var(--color-error-text)' }}>
                          {row.error}
                        </span>
                      </td>
                    </tr>
                  ) : rowHints.has(row.key) && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-1 pb-1">
                        {/* 建议级：用 status 不用 alert，也不阻断保存（判据 DL） */}
                        <span
                          role="status"
                          data-testid="resource-row-hint"
                          className="text-xs"
                          style={{ color: 'var(--color-warning-text)' }}
                        >
                          {rowHints.get(row.key)}
                        </span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ResourceRegistryPanel
