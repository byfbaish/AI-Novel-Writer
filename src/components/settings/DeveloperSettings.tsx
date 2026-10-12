import { useState } from 'react'
import { Bug, FolderOpen, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useDebugStore } from '../../stores/debug-store'
import { useLocaleStore } from '../../stores/locale-store'
import { Switch } from '../ui/Switch'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Button } from '../ui/Button'
import {
  reloadGlobalCustomPrompts,
  reloadProjectCustomPrompts,
} from '../../services/prompt-templates'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'

/**
 * 开发者设置面板（P0 骨架）。
 *
 * 当前承载两件事：
 * 1. Prompt 追踪开关 + 落盘目录（追踪记录器尚未接线，开关先就位）。
 * 2. 提示词热重载入口（与设置页「提示词模板」顶部、状态栏的是同一动作）。
 *
 * 定位：这是给「调 prompt 的人」用的，不是给普通作者用的，所以单列一个分类，
 * 不混进日常设置里。
 */
export default function DeveloperSettings() {
  const text = useLocaleStore((s) => s.text)
  const promptTraceEnabled = useDebugStore((s) => s.promptTraceEnabled)
  const traceRoot = useDebugStore((s) => s.traceRoot)
  const setPromptTraceEnabled = useDebugStore((s) => s.setPromptTraceEnabled)
  const setTraceRoot = useDebugStore((s) => s.setTraceRoot)
  const [reloading, setReloading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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
              '打开后，每次生成会把「组装前的提示词片段（含来源）+ 组装后原文 + 模型输出」写到外部文件夹，供定位调优。追踪记录器尚未接线，开关先就位。',
              'When on, each generation writes the pre-assembly prompt fragments (with sources), the assembled prompt, and the model output to an external folder for tuning. The recorder is not wired yet; the switch is in place.',
            )}
          </p>
        </div>
        <Switch
          checked={promptTraceEnabled}
          onCheckedChange={setPromptTraceEnabled}
          aria-label={text('Prompt 追踪', 'Prompt trace')}
        />
      </div>

      {/* 落盘目录 */}
      {promptTraceEnabled && (
        <div className="space-y-1.5">
          <Label>{text('追踪落盘目录（留空用默认）', 'Trace output directory (empty = default)')}</Label>
          <Input
            value={traceRoot ?? ''}
            onChange={(e) => setTraceRoot(e.target.value || null)}
            placeholder={text('留空：写到项目数据根目录下的 debug 文件夹', 'Empty: writes to the debug folder under the project data root')}
          />
        </div>
      )}

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
