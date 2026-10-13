import { useState } from 'react'
import { AlertTriangle, Download, PackageOpen, Upload } from 'lucide-react'

import { ipc } from '../../services/ipc-client'
import type {
  UserSettingsPackConflictStrategy,
  UserSettingsPackImportReceipt,
  UserSettingsPackInspectReceipt,
  UserSettingsPackSummary,
} from '../../shared/user-settings-pack'
import { useLocaleStore } from '../../stores/locale-store'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import { NativeSelect } from '../ui/NativeSelect'

type Notice = { kind: 'error' | 'success' | 'info'; text: string } | null

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 创作资产包面板：导出/导入**可跨项目复用、可分享**的提示词覆盖与写作 Skill。
 * 与项目存档不同，本面板不要求打开项目——备份用户设置时通常没有项目可开。
 */
export default function UserSettingsPackPanel() {
  const text = useLocaleStore(state => state.text)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [exportSummary, setExportSummary] = useState<UserSettingsPackSummary | null>(null)
  const [inspected, setInspected] = useState<UserSettingsPackInspectReceipt | null>(null)
  const [strategy, setStrategy] = useState<UserSettingsPackConflictStrategy>('skip')
  const [importPrompts, setImportPrompts] = useState(true)
  const [importSkills, setImportSkills] = useState(true)
  const [importReceipt, setImportReceipt] = useState<UserSettingsPackImportReceipt | null>(null)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (error) {
      setNotice({ kind: 'error', text: errorText(error) })
    } finally {
      setBusy(false)
    }
  }

  const exportPack = () => run(async () => {
    const grant = await ipc.invoke('dialog:select-settings-pack-export', 'creative-assets')
    if (!grant) return
    const result = await ipc.invoke('settings-pack:export', { targetGrantId: grant.grantId })
    if (!result.success) throw new Error(result.errorCode || result.error)
    setExportSummary(result.receipt.summary)
    setNotice({
      kind: 'success',
      text: text(
        `已导出创作资产包：${result.receipt.summary.prompts.length} 个提示词、${result.receipt.summary.skills.length} 个写作 Skill（${formatBytes(result.receipt.targetByteSize)}）。`,
        `Creative assets exported: ${result.receipt.summary.prompts.length} prompts and ${result.receipt.summary.skills.length} writing skills (${formatBytes(result.receipt.targetByteSize)}).`,
      ),
    })
  })

  const inspectPack = () => run(async () => {
    setImportReceipt(null)
    const grant = await ipc.invoke('dialog:select-settings-pack-import')
    if (!grant) return
    const result = await ipc.invoke('settings-pack:inspect', { archiveGrantId: grant.grantId })
    if (!result.success) throw new Error(result.errorCode || result.error)
    setInspected(result.receipt)
    setStrategy(result.receipt.conflicts.prompts.length || result.receipt.conflicts.skills.length ? 'skip' : 'overwrite')
    setNotice({
      kind: 'info',
      text: text(
        `已读取资产包，请核对内容后再导入。`,
        `Package loaded. Review it before importing.`,
      ),
    })
  })

  const importPack = () => run(async () => {
    if (!inspected) return
    const result = await ipc.invoke('settings-pack:import', {
      inspectId: inspected.inspectId,
      conflictStrategy: strategy,
      importPrompts,
      importSkills,
    })
    if (!result.success) throw new Error(result.errorCode || result.error)
    setImportReceipt(result.receipt)
    setInspected(null)
    setNotice({
      kind: 'success',
      text: text(
        `导入完成：提示词 ${result.receipt.importedPrompts} 个、写作 Skill ${result.receipt.importedSkills} 个。`,
        `Import complete: ${result.receipt.importedPrompts} prompts and ${result.receipt.importedSkills} writing skills.`,
      ),
    })
  })

  const conflictCount = inspected
    ? inspected.conflicts.prompts.length + inspected.conflicts.skills.length
    : 0

  return (
    <div className="space-y-5" data-testid="user-settings-pack-panel">
      <section className="space-y-3 rounded-lg border border-[var(--color-border)] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Upload size={16} />{text('创作资产包', 'Creative assets pack')}</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          {text(
            '打包可跨项目复用、可分享的创作资产：提示词模板覆盖与写作 Skill。不包含模型密钥、界面配置与最近项目列表。',
            'Pack reusable, shareable creative assets: prompt template overrides and writing skills. Model keys, interface settings, and recent projects are never included.',
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void exportPack()} disabled={busy}><PackageOpen size={14} />{text('导出创作资产包', 'Export creative assets')}</Button>
        </div>
        {exportSummary && (
          <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-secondary)]">
            <p>{text(`提示词 ${exportSummary.prompts.length} 个`, `${exportSummary.prompts.length} prompts`)}·{text(`写作 Skill ${exportSummary.skills.length} 个`, `${exportSummary.skills.length} writing skills`)}·{formatBytes(exportSummary.totalBytes)}</p>
            {exportSummary.prompts.length > 0 && (
              <p className="mt-1 break-all">{exportSummary.prompts.map(item => item.fileName).join('、')}</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--color-border)] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Download size={16} />{text('导入创作资产包', 'Import creative assets')}</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          {text(
            '导入的提示词会成为用户级覆盖，按 项目 > 用户 > 内置 的优先级生效——它会遮蔽同名内置模板。',
            'Imported prompts become user-level overrides and take effect by the project > user > built-in order, shadowing built-in templates with the same key.',
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void inspectPack()} disabled={busy}>{text('选择资产包并检查', 'Choose a pack and inspect')}</Button>
        </div>

        {inspected && (
          <div className="space-y-3 rounded border border-[var(--color-border)] p-3 text-xs">
            <p className="text-[var(--color-text)]">
              {text(
                `包内共 ${inspected.summary.prompts.length} 个提示词、${inspected.summary.skills.length} 个写作 Skill（${formatBytes(inspected.summary.totalBytes)}）。`,
                `The pack contains ${inspected.summary.prompts.length} prompts and ${inspected.summary.skills.length} writing skills (${formatBytes(inspected.summary.totalBytes)}).`,
              )}
            </p>
            {conflictCount > 0 && (
              <p className="flex items-start gap-1.5 text-[var(--color-warning-text)]">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  {text(
                    `与本地同名的 ${conflictCount} 项：${[...inspected.conflicts.prompts, ...inspected.conflicts.skills].join('、')}`,
                    `${conflictCount} items share a name with local assets: ${[...inspected.conflicts.prompts, ...inspected.conflicts.skills].join(', ')}`,
                  )}
                </span>
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="pack-conflict-strategy">{text('同名处理', 'Conflict handling')}</Label>
                <NativeSelect
                  id="pack-conflict-strategy"
                  value={strategy}
                  onChange={event => setStrategy(event.target.value as UserSettingsPackConflictStrategy)}
                >
                  <option value="skip">{text('跳过（保留本地）', 'Skip (keep local)')}</option>
                  <option value="overwrite">{text('覆盖（先备份本地）', 'Overwrite (back up local first)')}</option>
                  <option value="rename">{text('并存（重命名导入）', 'Keep both (rename the imported one)')}</option>
                </NativeSelect>
              </div>
              <div className="space-y-1 pt-5">
                <label className="flex items-center gap-2"><input type="checkbox" checked={importPrompts} onChange={event => setImportPrompts(event.target.checked)} />{text('导入提示词模板', 'Import prompt templates')}</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={importSkills} onChange={event => setImportSkills(event.target.checked)} />{text('导入写作 Skill', 'Import writing skills')}</label>
              </div>
            </div>
            <Button type="button" onClick={() => void importPack()} disabled={busy || (!importPrompts && !importSkills)}>{text('确认导入', 'Confirm import')}</Button>
          </div>
        )}

        {importReceipt && (
          <div className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-secondary)]">
            <p>{text(
              `新增提示词 ${importReceipt.importedPrompts}、覆盖 ${importReceipt.overwrittenPrompts}、重命名 ${importReceipt.renamedPrompts}、跳过 ${importReceipt.skippedPrompts}`,
              `Prompts: ${importReceipt.importedPrompts} added, ${importReceipt.overwrittenPrompts} overwritten, ${importReceipt.renamedPrompts} renamed, ${importReceipt.skippedPrompts} skipped`,
            )}</p>
            <p>{text(
              `写作 Skill：新增 ${importReceipt.importedSkills}、覆盖 ${importReceipt.overwrittenSkills}、重命名 ${importReceipt.renamedSkills}、跳过 ${importReceipt.skippedSkills}`,
              `Writing skills: ${importReceipt.importedSkills} added, ${importReceipt.overwrittenSkills} overwritten, ${importReceipt.renamedSkills} renamed, ${importReceipt.skippedSkills} skipped`,
            )}</p>
            {importReceipt.backupDirectories.length > 0 && (
              <p className="mt-1">{text(`已留备份：${importReceipt.backupDirectories.join('、')}`, `Backups: ${importReceipt.backupDirectories.join(', ')}`)}</p>
            )}
            {importReceipt.shadowedPromptKeys.length > 0 && (
              <p className="mt-1">{text(`已生效的用户级覆盖：${importReceipt.shadowedPromptKeys.join('、')}`, `Active user-level overrides: ${importReceipt.shadowedPromptKeys.join(', ')}`)}</p>
            )}
            {importReceipt.warnings.map(warning => (
              <p key={warning} className="mt-1 text-[var(--color-warning-text)]">{warning}</p>
            ))}
          </div>
        )}
      </section>

      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} className="text-sm" style={{ color: notice.kind === 'error' ? 'var(--color-error-text)' : notice.kind === 'success' ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>{notice.text}</p>}
    </div>
  )
}
