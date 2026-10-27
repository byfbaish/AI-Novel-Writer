import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'

import {
  ABILITY_FORM_HINTS,
  ABILITY_TEXT_MAX,
  abilityNameCandidates,
  type AbilityEvidenceScope,
  type PowerAbilityDefinition,
  type PowerAbilityInput,
} from '../../shared/power-ability'
import {
  abilityCandidateToInput,
  extractAbilityCandidates,
  type AbilityCandidate,
} from '../../shared/worldbuilding-ability-extract'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P1-1 能力登记面板（作者侧唯一写入口）。
 *
 * ## 一行 = 一条**本书级**能力规则
 *
 * 不是一个人的技能：角色技能在角色卡里（`characters.abilities`），已经随卡进正文。
 * 这里登的是「没有角色归属、属于这本书」的规则 —— 金手指、体系漏洞、宝物权限。
 *
 * ## 名字必须能一键从金手指原文取
 *
 * 三本取样书里只有 1 本有现成名字，1 本只有引号短语，1 本通篇没有名字。`name` 又是唯一
 * 必填项，所以每行给「首行标题 / 引号短语」两个候选按钮（只填候选，作者可改）。
 *
 * ## 空字段留空，不给提示词添字
 *
 * 三类限制（硬限制 / 弱点 / 代价）都空着时，行尾给一条黄条：**它只在本页可见**，
 * 不会写进提示词 —— 注入「限制未登记」会被读成「没有限制」，比不写更糟。
 *
 * ## 保存前不落库、重名整批不提交、删除要确认
 *
 * 与知情、制度、物品登记同一纪律：本地校验通过才逐行提交；一个重名就让整批留在本地
 * （一行失败不该让别的行偷偷落库）。
 *
 * ## 候选区（P20-1a）：只做「展示 + 勾选」，不做行内编辑
 *
 * 候选是**零模型确定性解析**的结果（第 1 维等级表的四列），因此现算于本面板、不落
 * `partial_arch.json`，也不写库 —— 只有作者勾选后点「采纳所选」才走 `db:abilities-upsert`。
 *
 * 候选区刻意**不做行内编辑**：要改字段就先采纳，再到下方表格里改。理由是可编辑的候选会
 * 变成第二套草稿状态（`DraftRow` 已经有一套），两套草稿谁覆盖谁说不清。
 */
type LocaleText = (zh: string, en: string) => string

interface DraftRow {
  key: string
  abilityId?: string
  name: string
  form: string
  hardLimit: string
  weakness: string
  costNote: string
  stageChapter: string
  stageNote: string
  evidence: string
  evidenceScope: AbilityEvidenceScope | ''
  removing: boolean
  confirmingRemove: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    name: '',
    form: '',
    hardLimit: '',
    weakness: '',
    costNote: '',
    stageChapter: '',
    stageNote: '',
    evidence: '',
    evidenceScope: '',
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

function rowFromDefinition(ability: PowerAbilityDefinition): DraftRow {
  return {
    key: ability.abilityId,
    abilityId: ability.abilityId,
    name: ability.name,
    form: ability.form,
    hardLimit: ability.hardLimit,
    weakness: ability.weakness,
    costNote: ability.costNote,
    stageChapter: ability.stageChapter === null ? '' : String(ability.stageChapter),
    stageNote: ability.stageNote,
    evidence: ability.evidence,
    evidenceScope: ability.evidenceScope ?? '',
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

const POSITIVE = /^[1-9]\d*$/u

/**
 * 能力表的**阅读顺序**（只影响界面，不改后端 SQL、不改提示词里那一份）。
 *
 * ## 为什么后端那份顺序不能直接用
 *
 * `listPowerAbilities` 是 `ORDER BY name`（码元序），注释写明理由是「与提示词里的排序同一口径」。
 * 那个理由对**模型**成立（缓存友好、顺序稳定），对**作者**不成立：码元序把一整套体系打散了。
 * 本项目实测 13 条其实是两拨——「因果纹」7 条（0 / 1–8 / 9–17 / 18–26 / 27 / 28–35 / 36 道）
 * 与「境界」6 条（引气→合道）——按汉字码元序排出来是
 * 倒计纹、催收线、催纹、凝丹、化神、合道……，既不是纹的递进，也不是境界的递进。
 *
 * ## 三档，各用**已有的**信息排，一个新字段都不加
 *
 * 1. **在等级表里出现过**（`ladderOrder`，即第 1 维四列表的首列顺序）⇒ 按表序。
 *    这是境界递进的权威来源：作者写等级表时本来就把引气排在前、合道排在后。
 * 2. **不在表里、但 `hardLimit` 以数字开头**（如「28—35道」）⇒ 按起始数升序。
 * 3. **其余** ⇒ 保持后端顺序（码元序），即「排不出来就不装成排得出来」。
 *
 * 三档的先后也是按信息强度排的：体系主干在最前，有刻度的碎片其次，排不动的垫底。
 */
export function orderAbilityRows<T extends { name: string; hardLimit: string }>(
  rows: readonly T[],
  ladderOrder: readonly string[] = [],
): T[] {
  const ladderRank = new Map<string, number>()
  for (const [index, raw] of ladderOrder.entries()) {
    const name = raw.trim()
    // 同名只认第一次出现：等级表里重复的等级名不该让位次来回跳。
    if (name && !ladderRank.has(name)) ladderRank.set(name, index)
  }
  const leadingNumber = (value: string): number | null => {
    const match = /^\s*(\d+)/u.exec(value)
    if (!match) return null
    const parsed = Number(match[1])
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  const keyed = rows.map((row, index) => {
    const rank = ladderRank.get(row.name.trim())
    const start = leadingNumber(row.hardLimit)
    return { row, index, rank: rank ?? null, start, tier: rank !== undefined ? 0 : start !== null ? 1 : 2 }
  })
  keyed.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    if (a.tier === 0 && a.rank !== b.rank) return (a.rank ?? 0) - (b.rank ?? 0)
    if (a.tier === 1 && a.start !== b.start) return (a.start ?? 0) - (b.start ?? 0)
    // 同档内：保持后端给的码元序（`index` 即读回来的顺序）。
    return a.index - b.index
  })
  return keyed.map(item => item.row)
}

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'ABILITY_NAME_DUPLICATED': return text('这个能力名已经登记过了', 'That ability name is already registered')
    case 'ABILITY_SCHEMA_MISSING': return text('这个项目的数据库还没有能力表，无法保存', 'This project database has no ability table yet')
    case 'ABILITY_NOT_FOUND': return text('这条能力已经不在了，刷新列表即可', 'That entry is gone; reload the list')
    case 'PROJECT_NOT_OPEN': return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('ABILITY_INVALID:')) {
        return text(`有一个字段不合法（${error.slice('ABILITY_INVALID:'.length)}），没有保存`, 'A field is invalid, nothing was saved')
      }
      return text(`保存失败（${error ?? '未知原因'}）`, `Save failed (${error ?? 'unknown'})`)
  }
}

export function AbilityRegistryPanel({ projectKey, worldbuilding }: { projectKey: string; worldbuilding: string }) {
  const text = useLocaleStore(state => state.text)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [goldenFinger, setGoldenFinger] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const [selectedNames, setSelectedNames] = useState<readonly string[]>([])
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setRows([])
      setGoldenFinger('')
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    const [listed, golden] = await Promise.all([
      ipc.invokeWithProjectSession(projectSession, 'db:abilities-list', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:golden-finger-read', projectSession.projectPath),
    ])
    if (!isProjectSessionCurrent(projectSession)) return
    setLoading(false)
    // 金手指读不到只影响「取名字」按钮，不挡住整页手填。
    setGoldenFinger(golden?.success ? golden.goldenFinger ?? '' : '')
    if (!listed.success) { setLoadError(writeErrorLabel(listed.error, text)); return }
    setLoadError('')
    setRows((listed.abilities ?? []).map(rowFromDefinition))
  }, [projectKey, text])

  useEffect(() => {
    // 挂载即读；不轮询 —— 本页只服务作者手工登记。
    queueMicrotask(() => void load())
  }, [load])

  const candidates = abilityNameCandidates(goldenFinger)

  /**
   * P20-1a：世界观第 1 维等级表 → 能力候选。
   *
   * 纯函数、现算于本面板：**不落 `partial_arch.json`、不写库、不进 prompt**。
   * 零模型解析拿到世界观就能算，多一个存储来源就多一处「两份候选打架」的可能。
   */
  const ladderSet = useMemo(() => extractAbilityCandidates(worldbuilding), [worldbuilding])

  /**
   * 界面阅读顺序（见 `orderAbilityRows`）。**用等级表的首列名序当境界顺序** ——
   * 这是作者写第 1 维时已经给过的权威位次，不必再加一个序位字段。
   * 只影响渲染，`rows` 本身仍是后端顺序，保存/删除都按 `key` 走，不受影响。
   */
  const orderedRows = useMemo(
    () => orderAbilityRows(rows, ladderSet.candidates.map(candidate => candidate.name)),
    [rows, ladderSet],
  )

  /** 已登记的能力名：同名候选不给重复勾选（`name` 是 UNIQUE，后端会报 ABILITY_NAME_DUPLICATED）。 */
  const registeredNames = useMemo(
    () => new Set(rows.filter(row => !row.removing).map(row => row.name.trim()).filter(Boolean)),
    [rows],
  )

  const selectable = ladderSet.candidates.filter(candidate => !registeredNames.has(candidate.name))
  const chosen: AbilityCandidate[] = selectable.filter(candidate => selectedNames.includes(candidate.name))

  const toggleCandidate = (name: string) => {
    setSelectedNames(previous => (
      previous.includes(name) ? previous.filter(item => item !== name) : [...previous, name]
    ))
  }

  /** 逐条采纳：一条失败不阻断其余，但错误要可见（重名由 `writeErrorLabel` 翻译）。 */
  const adoptSelected = async () => {
    if (busyRef.current || chosen.length === 0) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    busyRef.current = true
    setBusy(true)
    let saved = 0
    let failure = ''
    for (const candidate of chosen) {
      const result = await ipc.invokeWithProjectSession(
        projectSession,
        'db:abilities-upsert',
        abilityCandidateToInput(candidate),
        projectSession.projectPath,
      )
      if (result.success) { saved += 1; continue }
      if (!failure) failure = writeErrorLabel(result.error, text)
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    setSelectedNames([])
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已登记 ${saved} 条候选`, `${saved} candidate(s) registered`))
    if (failure) parts.push(failure)
    setStatus(parts.join('；'))
    // 立刻重载：新登记的名字要让对应候选行当场变成「已登记」。
    void load()
  }

  const applyField = (key: string, field: keyof DraftRow, value: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, [field]: value, error: '' } : row)))
  }

  const addRow = () => { setRows(previous => [...previous, emptyRow()]); setStatus('') }

  const removeRow = (key: string) => {
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.abilityId) return previous.filter(row => row.key !== key)
      return previous.map(row => (row.key === key ? { ...row, confirmingRemove: true, error: '' } : row))
    })
  }

  const undoRemove = (key: string) => {
    setRows(previous => previous.map(row => (
      row.key === key ? { ...row, removing: false, confirmingRemove: false, error: '' } : row)))
  }

  const confirmRemove = (key: string) => {
    setRows(previous => previous.map(row => (
      row.key === key ? { ...row, removing: true, confirmingRemove: false, error: '' } : row)))
  }

  /** 本地校验：重名整批拦下，章号只能是正整数 —— 不等数据库报 UNIQUE。 */
  const validateRows = (current: readonly DraftRow[]): Map<string, string> => {
    const problems = new Map<string, string>()
    const seen = new Set<string>()
    for (const row of current) {
      if (row.removing) continue
      const name = row.name.trim()
      if (!name) {
        problems.set(row.key, text('能力名是必填项', 'Ability name is required'))
        continue
      }
      if (name.length > ABILITY_TEXT_MAX) {
        problems.set(row.key, text('能力名过长', 'Ability name is too long'))
        continue
      }
      if (seen.has(name)) {
        problems.set(row.key, text('这个能力名在本页重复了', 'This ability name is used twice on this page'))
        continue
      }
      seen.add(name)
      if (row.stageChapter.trim() && !POSITIVE.test(row.stageChapter.trim())) {
        problems.set(row.key, text('「从第几章起」只能填正整数，或留空', 'Start chapter must be a positive integer, or empty'))
        continue
      }
      for (const [label, value] of [
        [text('形态', 'Form'), row.form],
        [text('硬限制', 'Hard limit'), row.hardLimit],
        [text('弱点', 'Weakness'), row.weakness],
        [text('代价', 'Cost'), row.costNote],
        [text('阶段描述', 'Stage note'), row.stageNote],
      ] as const) {
        if (value.trim().length > ABILITY_TEXT_MAX) {
          problems.set(row.key, text(`${label}过长`, `${label} is too long`))
          break
        }
      }
    }
    return problems
  }

  const save = async () => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    const current = rows
    const problems = validateRows(current)
    if (problems.size > 0) {
      // 校验不通过就整批不提交：一行重名不该让别的行偷偷落库。
      setRows(previous => previous.map(row => problems.has(row.key) ? { ...row, error: problems.get(row.key) ?? '' } : row))
      setStatus(text(`有 ${problems.size} 行还需要修改，本次没有提交`, `${problems.size} row(s) need fixing; nothing was saved`))
      return
    }
    busyRef.current = true
    setBusy(true)
    let saved = 0
    let removed = 0
    const kept: DraftRow[] = []
    for (const row of current) {
      if (row.removing) {
        const result = await ipc.invokeWithProjectSession(projectSession, 'db:abilities-delete', row.abilityId!, projectSession.projectPath)
        if (result.success) { removed += 1; continue }
        kept.push({ ...row, removing: false, error: writeErrorLabel(result.error, text) })
        continue
      }
      const input: PowerAbilityInput = {
        ...(row.abilityId ? { abilityId: row.abilityId } : {}),
        name: row.name.trim(),
        form: row.form.trim(),
        hardLimit: row.hardLimit.trim(),
        weakness: row.weakness.trim(),
        costNote: row.costNote.trim(),
        stageChapter: row.stageChapter.trim() ? Number(row.stageChapter.trim()) : null,
        stageNote: row.stageNote.trim(),
        evidence: row.evidence.trim(),
        evidenceScope: row.evidenceScope === '' ? null : row.evidenceScope,
      }
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:abilities-upsert', input, projectSession.projectPath)
      if (!result.success) { kept.push({ ...row, error: writeErrorLabel(result.error, text) }); continue }
      // 用后端回的 id 改写本地行：不重载，作者的光标不会跳。
      saved += 1
      kept.push({ ...row, key: result.abilityId ?? row.key, abilityId: result.abilityId ?? row.abilityId, error: '' })
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    setRows(kept)
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已保存 ${saved} 条能力`, `${saved} ability rule(s) saved`))
    if (removed > 0) parts.push(text(`已删除 ${removed} 条`, `${removed} removed`))
    if (kept.some(row => row.error)) parts.push(text('有行保存失败，看每行下方提示', 'some rows failed; see the row messages'))
    setStatus(parts.join('；') || text('没有需要保存的改动', 'Nothing to save'))
    if (saved > 0) void load()
  }

  return (
    <div className="space-y-3" data-testid="ability-registry-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={addRow} disabled={busy}>
          <Plus size={13} />{text('新增一条', 'Add entry')}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy || loading}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {text('保存', 'Save')}
        </Button>
        {status && <span role="status" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>

      {/* P20-1a 候选区：展示 + 勾选，不做行内编辑（理由见文件头注释）。 */}
      <div data-testid="ability-candidate-zone" className="space-y-1.5">
        {ladderSet.candidates.length > 0
          ? (
            <>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                {text('从世界观第 1 维的等级表抽出的候选（勾选后才会登记）', 'Candidates from the dimension-1 ladder table (registered only after you select them)')}
              </p>
              {ladderSet.candidates.map(candidate => {
                const registered = registeredNames.has(candidate.name)
                return (
                  <div key={candidate.name} data-testid="ability-candidate-row" className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-field="candidate-select"
                      aria-label={candidate.name}
                      checked={!registered && selectedNames.includes(candidate.name)}
                      disabled={registered || busy}
                      onChange={() => toggleCandidate(candidate.name)}
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span data-field="candidate-name" className="font-medium" style={{ color: 'var(--color-text)' }}>
                          {candidate.name}
                        </span>
                        {registered && (
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                            {text('已登记：改上面那一行', 'Already registered: change the row above')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {candidate.hardLimit && (
                          <span data-field="candidate-hard-limit">{candidate.hardLimit}</span>
                        )}
                        {candidate.costNote && (
                          <span data-field="candidate-cost">{candidate.costNote}</span>
                        )}
                      </div>
                      <span data-testid="candidate-evidence" title={candidate.evidence} className="block truncate text-[10px]"
                        style={{ color: 'var(--color-text-muted)' }}>
                        {candidate.evidence}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => void adoptSelected()} disabled={busy || chosen.length === 0}>
                  {text(`采纳所选（${chosen.length}）`, `Adopt selected (${chosen.length})`)}
                </Button>
              </div>
              {ladderSet.dropped > 0 && (
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {text(`已丢弃 ${ladderSet.dropped} 条（重名 / 字段超长 / 超出上限）`, `${ladderSet.dropped} discarded (duplicate / too long / over the limit)`)}
                </p>
              )}
            </>
          )
          : (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {!worldbuilding.trim()
                ? text('还没有世界观内容，先生成或填写世界观再回来抽取。', 'No worldbuilding yet: generate or write it first, then come back to extract.')
                : !ladderSet.dimensionFound
                  ? text('没识别到第 1 维【核心规则与体系漏洞】标题，无法抽取（若用了覆盖版模板，请确认标题文字未被改动）。', 'Dimension 1 [Core rules and exploitable asymmetry] heading not recognized; cannot extract (if you use an override template, check that its heading text is unchanged).')
                  : ladderSet.mismatchedColumnCounts.length > 0
                    // 源文本里**有表格**，只是列数不对 ⇒ 必须说「找到表格」，不能说「没找到表格」（判据 DN 同型）。
                    ? text(
                      `第 1 维里找到表格，但列数是 ${ladderSet.mismatchedColumnCounts.join(' / ')}（等级表需要 4 列：等级名｜相邻差距｜卡点｜升级代价）。`,
                      `A table was found in dimension 1, but it has ${ladderSet.mismatchedColumnCounts.join(' / ')} column(s) (the ladder table needs 4: name | gap | hard limit | upgrade cost).`,
                    )
                    : text('世界观第 1 维里没找到四列等级表（等级名｜相邻差距｜卡点｜升级代价）。', 'No four-column ladder table found in dimension 1 (name | gap | hard limit | upgrade cost).')}
            </p>
          )}
      </div>

      {loadError && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{loadError}</p>}

      <datalist id="ability-form-hints">
        {ABILITY_FORM_HINTS.map(hint => <option key={hint} value={hint} />)}
      </datalist>

      {loading
        ? <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text('读取中…', 'Loading…')}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {[
                    [text('名称', 'Name'), '10rem', true],
                    [text('形态', 'Form'), '7rem', false],
                    [text('硬限制', 'Hard limit'), '12rem', false],
                    [text('弱点', 'Weakness'), '10rem', false],
                    [text('代价', 'Cost'), '10rem', false],
                    [text('阶段', 'Stage'), '9rem', false],
                    [text('出处', 'Evidence'), '11rem', false],
                    [text('', '') , '5rem', false],
                  ].map(([label, width, required], index) => (
                    <th key={index} className="px-1 py-1 text-left align-bottom font-normal"
                      style={{ color: 'var(--color-text-muted)', width: width as string }}>
                      {label as string}{required ? ' *' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row, index) => {
                  const limitsEmpty = !row.hardLimit.trim() && !row.weakness.trim() && !row.costNote.trim()
                  return (
                    <tr key={row.key} data-testid="ability-row" style={{ opacity: row.removing ? 0.5 : 1 }}>
                      <td className="px-1 py-0.5 align-top space-y-1">
                        <input
                          data-field="name"
                          aria-label={`${text('名称', 'Name')} ${index + 1}`}
                          aria-invalid={row.error ? true : undefined}
                          value={row.name}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'name', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                        <div className="flex flex-wrap gap-1">
                          {candidates.title && (
                            <Button size="sm" variant="ghost" disabled={row.removing || busy}
                              onClick={() => applyField(row.key, 'name', candidates.title)}>
                              {text('取首行标题', 'Use first line')}
                            </Button>
                          )}
                          {candidates.quoted && (
                            <Button size="sm" variant="ghost" disabled={row.removing || busy}
                              onClick={() => applyField(row.key, 'name', candidates.quoted)}>
                              {text('取引号短语', 'Use quoted phrase')}
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        <input
                          data-field="form"
                          list="ability-form-hints"
                          aria-label={`${text('形态', 'Form')} ${index + 1}`}
                          value={row.form}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'form', event.target.value)}
                          placeholder={text('可自由输入', 'free text')}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        <textarea
                          data-field="hardLimit"
                          aria-label={`${text('硬限制', 'Hard limit')} ${index + 1}`}
                          value={row.hardLimit}
                          rows={2}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'hardLimit', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        <textarea
                          data-field="weakness"
                          aria-label={`${text('弱点', 'Weakness')} ${index + 1}`}
                          value={row.weakness}
                          rows={2}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'weakness', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        <textarea
                          data-field="costNote"
                          aria-label={`${text('代价', 'Cost')} ${index + 1}`}
                          value={row.costNote}
                          rows={2}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'costNote', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top space-y-1">
                        <input
                          data-field="stageChapter"
                          aria-label={`${text('从第几章起', 'From chapter')} ${index + 1}`}
                          value={row.stageChapter}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'stageChapter', event.target.value)}
                          placeholder={text('留空 = 未标章号', 'empty = no chapter')}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                        <input
                          data-field="stageNote"
                          aria-label={`${text('阶段描述', 'Stage note')} ${index + 1}`}
                          value={row.stageNote}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'stageNote', event.target.value)}
                          placeholder={text('开局 / 中期 / 境界名', 'early / mid / realm name')}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top space-y-1">
                        <input
                          data-field="evidence"
                          aria-label={`${text('出处引文', 'Evidence quote')} ${index + 1}`}
                          value={row.evidence}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'evidence', event.target.value)}
                          placeholder={text('逐字引文', 'verbatim quote')}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                        <select
                          data-field="evidenceScope"
                          aria-label={`${text('出处域', 'Evidence scope')} ${index + 1}`}
                          value={row.evidenceScope}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'evidenceScope', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        >
                          <option value="">{text('（不标出处域）', '(no scope)')}</option>
                          <option value="golden-finger">{text('金手指原文', 'Golden-finger text')}</option>
                          <option value="worldbuilding">{text('世界观', 'Worldbuilding')}</option>
                          <option value="chapter">{text('正文某章', 'A chapter')}</option>
                        </select>
                      </td>
                      <td className="px-1 py-0.5 align-top space-y-1">
                        {limitsEmpty && (
                          <span data-testid="ability-empty-limits" className="block text-[10px] leading-tight"
                            style={{ color: 'var(--color-warning, #b45309)' }}>
                            <AlertTriangle size={11} className="inline" />{' '}
                            {text('三类限制都空着：这条只有名字，不会带任何约束进提示词', 'All three limits are empty: only the name is saved, nothing constrains the prompt')}
                          </span>
                        )}
                        {row.removing
                          ? (
                            <Button size="sm" variant="ghost" onClick={() => undoRemove(row.key)} disabled={busy}>
                              <Undo2 size={13} />{text('撤销', 'Undo')}
                            </Button>
                          )
                          : row.confirmingRemove
                            ? (
                              <Button size="sm" variant="ghost" onClick={() => confirmRemove(row.key)} disabled={busy}>
                                <Trash2 size={13} />{text('确认删除', 'Confirm delete')}
                              </Button>
                            )
                            : (
                              <Button size="sm" variant="ghost" onClick={() => removeRow(row.key)} disabled={busy}>
                                <Trash2 size={13} />{text('删除', 'Delete')}
                              </Button>
                            )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {text(
                  '还没有登记任何能力规则。金手指现在只是一段自由文本 —— 写第 N 章时模型看不到「这条能力要付什么代价」。',
                  'No ability rules registered yet. Your golden finger is still a free-text paragraph; the model never sees what the power costs.',
                )}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {text(
                '只登记「本书级」能力规则（金手指 / 体系漏洞 / 宝物权限）；角色技能留在角色卡里。三类限制留空就不进提示词，黄条只在本页可见。',
                'Only book-level ability rules belong here (golden finger / system loopholes / artifact permissions); character skills stay on character cards. Empty limits produce no prompt text; the warning is registry-only.',
              )}
            </p>
            {rows.filter(row => row.error).map(row => (
              <p key={row.key} role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {row.name.trim() || text('新行', 'new row')}：{row.error}
              </p>
            ))}
          </div>
        )}
    </div>
  )
}
