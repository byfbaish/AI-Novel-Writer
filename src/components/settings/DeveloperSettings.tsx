import { useEffect, useState } from 'react'
import { Bug, FolderOpen, RefreshCw, CheckCircle2, AlertTriangle, Gauge } from 'lucide-react'
import { useDebugStore } from '../../stores/debug-store'
import { useLocaleStore } from '../../stores/locale-store'
import { Switch } from '../ui/Switch'
import { Label } from '../ui/Label'
import { Button } from '../ui/Button'
import { reloadGlobalCustomPrompts, reloadProjectCustomPrompts } from '../../services/prompt-templates'
import { promptTraceRelativeDir, resetTraceCaptureCount } from '../../services/prompts/prompt-trace-writer'
import PromptTraceStatus from './PromptTraceStatus'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import {
  isMemoryProbeSupported,
  memoryProbeReport,
  resetMemoryProbe,
  subscribeMemoryProbe,
  type MemoryProbeReport,
} from '../../services/debug/memory-probe'

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

/**
 * 开发者设置面板。
 *
 * 承载两件事：
 * 1. Prompt 追踪开关（P2 已接线：取片段 + 真实请求 IO，落盘到项目内 debug/prompt-trace）。
 * 2. 提示词热重载入口（与设置页「提示词模板」顶部、状态栏的是同一动作）。
 *
 * 定位：这是给「调 prompt 的人」用的，不是给普通作者用的，所以单列一个分类，
 * 不混进日常设置里。
 */
export default function DeveloperSettings() {
  const text = useLocaleStore((s) => s.text)
  const promptTraceEnabled = useDebugStore((s) => s.promptTraceEnabled)
  const setPromptTraceEnabled = useDebugStore((s) => s.setPromptTraceEnabled)
  const [reloading, setReloading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const memoryProbeEnabled = useDebugStore((s) => s.memoryProbeEnabled)
  const setMemoryProbeEnabled = useDebugStore((s) => s.setMemoryProbeEnabled)
  const [memoryReport, setMemoryReport] = useState<MemoryProbeReport | null>(null)

  // 打点面板只在自己开着时刷新；250ms 足够看清峰值爬升，又不至于自己变成负担。
  useEffect(() => {
    if (!memoryProbeEnabled) {
      setMemoryReport(null)
      return
    }
    setMemoryReport(memoryProbeReport())
    const timer = window.setInterval(() => setMemoryReport(memoryProbeReport()), 250)
    const unsubscribe = subscribeMemoryProbe(() => setMemoryReport(memoryProbeReport()))
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [memoryProbeEnabled])

  /** 每次开启都从零计数，这样面板上的「累计捕获」就等于「这一轮抓到多少」。 */
  const handleToggleTrace = (enabled: boolean) => {
    if (enabled) resetTraceCaptureCount()
    setPromptTraceEnabled(enabled)
  }

  /** 内存打点开关：开启即清零，让"这一轮峰值"从零开始。 */
  const handleToggleMemoryProbe = (enabled: boolean) => {
    if (enabled) resetMemoryProbe()
    setMemoryProbeEnabled(enabled)
  }

  const handleReload = async () => {
    setReloading(true)
    setNotice(null)
    try {
      const globalCount = await reloadGlobalCustomPrompts()
      let projectCount = 0
      const project = useProjectStore.getState().currentProject
      const session = project?.id && project.path && project.sessionLease
        ? captureProjectSession({ id: project.id, path: project.path, sessionLease: project.sessionLease })
        : null
      if (session && isProjectSessionCurrent(session)) {
        const loaded = await reloadProjectCustomPrompts(session)
        if (loaded) projectCount = 1
      }
      setNotice(text(
        `已重载：全局覆盖 ${globalCount} 项${projectCount ? '、当前项目覆盖已刷新' : ''}。下一次生成即用最新内容。`,
        `Reloaded: ${globalCount} global override(s)${projectCount ? ', project overrides refreshed' : ''}. The next generation uses the latest content.`,
      ))
    } catch {
      setNotice(text('重载失败，请检查提示词目录后重试。', 'Reload failed. Check the prompts directory and retry.'))
    } finally {
      setReloading(false)
      window.setTimeout(() => setNotice(null), 4000)
    }
  }

  return (
    <div className="max-w-[560px] space-y-5">
      {/* Prompt 追踪开关 */}
      <div
        className="flex items-start justify-between gap-4 rounded-xl p-4"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-panel)' }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <Bug size={13} style={{ color: 'var(--color-accent)' }} />
            {text('Prompt 追踪（输入 / 输出落盘）', 'Prompt trace (dump input / output)')}
          </p>
          <p className="text-[0.68rem] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '打开后，每次生成会把「组装前的提示词片段（含来源）+ 组装后原文 + 实际发出的请求与模型输出」写到当前项目的 debug/prompt-trace 文件夹，供定位调优。',
              'When on, each generation writes the pre-assembly prompt fragments (with sources), the assembled prompt, and the actual request plus model output to the project debug/prompt-trace folder for tuning.',
            )}
          </p>
        </div>
        <Switch
          checked={promptTraceEnabled}
          onCheckedChange={handleToggleTrace}
          aria-label={text('Prompt 追踪', 'Prompt trace')}
        />
      </div>

      {/* 落盘位置（固定在项目内，受既有文件沙箱保护） */}
      {promptTraceEnabled && (
        <div className="space-y-1.5">
          <Label>{text('追踪落盘位置', 'Trace output location')}</Label>
          <p className="text-[0.68rem]" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '固定写到当前项目根目录下：',
              'Always written under the current project root: ',
            )}
            <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-hover)', fontFamily: 'ui-monospace, monospace' }}>
              {promptTraceRelativeDir()}/
            </code>
            {text(
              '（每次生成一枚 .md 便于阅读 + 一枚 .json 便于脚本处理）',
              ' (one readable .md and one scriptable .json per generation)',
            )}
          </p>
        </div>
      )}

      {/* 实时状态回显：区分「没跑过」「跑过但没抓到」「抓到了但写失败」 */}
      <PromptTraceStatus />

      {/* 内存打点开关：定位精修这类重活的渲染层内存峰值 */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-panel)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
              <Gauge size={13} style={{ color: 'var(--color-accent)' }} />
              {text('内存打点（渲染层峰值诊断）', 'Memory probe (renderer peak diagnosis)')}
            </p>
            <p className="text-[0.68rem] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {text(
                '打开后在「提示词装配 / 追踪落盘 / 模型调用面板轮询」三处记录堆用量与峰值。跑一轮精修即可看出内存是随调用次数线性涨，还是某一次调用暴涨。关闭时零开销。',
                'When on, records heap usage and peaks at prompt assembly, trace flushing, and the model-call panel polling. After one refine run you can tell whether memory grows per call or spikes in a single call. Zero overhead when off.',
              )}
            </p>
          </div>
          <Switch
            checked={memoryProbeEnabled}
            onCheckedChange={handleToggleMemoryProbe}
            aria-label={text('内存打点', 'Memory probe')}
          />
        </div>
        {memoryProbeEnabled && (
          <div className="space-y-1.5 pt-1">
            {!isMemoryProbeSupported() && (
              <p className="text-[0.68rem]" style={{ color: 'var(--color-text-muted)' }}>
                {text('当前运行时没有堆读数（仅 Chromium 系支持）。', 'This runtime exposes no heap readings (Chromium only).')}
              </p>
            )}
            {memoryReport && memoryReport.supported && (
              <>
                <p className="text-[0.68rem] font-mono" style={{ color: 'var(--color-text)' }}>
                  {text('当前', 'Now')} {megabytes(memoryReport.current)}MB
                  {' · '}
                  {text('峰值', 'Peak')} {megabytes(memoryReport.peak)}MB
                  {memoryReport.peakLabel ? ` (${memoryReport.peakLabel}${memoryReport.peakDetail ? `/${memoryReport.peakDetail}` : ''})` : ''}
                  {memoryReport.baseline !== null ? ` · ${text('基线', 'Base')} ${megabytes(memoryReport.baseline)}MB` : ''}
                  {` · ${memoryReport.samples} ${text('次采样', 'samples')}`}
                </p>
                {memoryReport.topLabels.length > 0 && (
                  <div className="text-[0.66rem] font-mono space-y-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {memoryReport.topLabels.slice(0, 4).map((entry) => (
                      <div key={entry.label} className="flex items-center justify-between gap-3">
                        <span className="truncate">{entry.label}</span>
                        <span className="shrink-0">
                          {`max +${megabytes(entry.maxDelta)}MB · ${entry.count} 次`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[0.66rem]" style={{ color: 'var(--color-text-muted)' }}>
                  {text(
                    '也可以在控制台用 __memoryProbe.report() 查看明细。',
                    'You can also run __memoryProbe.report() in the console for details.',
                  )}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 提示词热重载 */}
      <div
        className="flex items-start justify-between gap-4 rounded-xl p-4"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-panel)' }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            <FolderOpen size={13} style={{ color: 'var(--color-accent)' }} />
            {text('提示词热重载', 'Prompt hot reload')}
          </p>
          <p className="text-[0.68rem] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '在 IDE / 记事本 / 脚本里直接改了提示词文件后，点这里免重启加载。面板内保存本就会立即生效。',
              'After editing prompt files directly in an IDE, notepad, or a script, reload here instead of restarting. Saving in the panel already applies immediately.',
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleReload()}
          disabled={reloading}
          className="flex-shrink-0"
        >
          <RefreshCw size={12} className={reloading ? 'animate-spin' : undefined} />
          {reloading ? text('加载中...', 'Reloading...') : text('重新加载', 'Reload')}
        </Button>
      </div>
      {notice && (
        <div
          className="px-3 py-2 rounded-lg text-xs flex items-start gap-1.5"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-secondary)' }}
        >
          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div
        className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
        style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-muted)' }}
      >
        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          {text(
            '这些是调试工具，不影响正常创作流程。关闭追踪后不产生任何额外开销。',
            'These are debugging tools and do not affect normal writing. With tracing off, there is no extra overhead.',
          )}
        </span>
      </div>
    </div>
  )
}
