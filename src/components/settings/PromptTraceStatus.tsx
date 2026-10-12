import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, CircleSlash, FolderOpen } from 'lucide-react'
import {
  lastTraceFlushOutcome,
  subscribeTraceFlushOutcome,
  traceCapturedCount,
  type TraceFlushOutcome,
} from '../../services/prompts/prompt-trace-writer'
import { useDebugStore } from '../../stores/debug-store'
import { useLocaleStore } from '../../stores/locale-store'

/** 相对时间：只在面板可见时用，精度到秒/分即可。 */
function relativeTime(at: number, now: number): { zh: string; en: string } {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 5) return { zh: '刚刚', en: 'just now' }
  if (seconds < 60) return { zh: `${seconds} 秒前`, en: `${seconds}s ago` }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return { zh: `${minutes} 分钟前`, en: `${minutes}m ago` }
  return { zh: `${Math.floor(minutes / 60)} 小时前`, en: `${Math.floor(minutes / 60)}h ago` }
}

interface StatusView {
  tone: 'idle' | 'ok' | 'warn' | 'error'
  titleZh: string
  titleEn: string
  detailZh: string
  detailEn: string
  files?: string[]
}

function deriveStatus(
  outcome: TraceFlushOutcome | null,
  captured: number,
  now: number,
): StatusView {
  if (captured === 0 && !outcome) {
    return {
      tone: 'idle',
      titleZh: '等待第一次生成',
      titleEn: 'Waiting for the first generation',
      detailZh: '开关已就绪。跑一次走主链路的生成（架构 / 正文 / 精修）后，这里会显示结果。',
      detailEn: 'Ready. Run a generation that goes through the main chain (architecture, drafting, or refinement) and the result will appear here.',
    }
  }

  if (!outcome) {
    return {
      tone: 'idle',
      titleZh: `已捕获 ${captured} 块，等待落盘`,
      titleEn: `${captured} fragment(s) captured, waiting to be written`,
      detailZh: '片段已捕获，文件将在本次任务收尾时写出。',
      detailEn: 'Fragments captured; the file is written when this task settles.',
    }
  }

  const time = relativeTime(outcome.at, now)
  const stampZh = `（${time.zh}）`
  const stampEn = ` (${time.en})`

  if (outcome.status === 'ok') {
    return {
      tone: 'ok',
      titleZh: `已写出 ${outcome.files?.length ?? 0} 份文件${stampZh}`,
      titleEn: `${outcome.files?.length ?? 0} file(s) written${stampEn}`,
      detailZh: '落盘正常。打开下方路径即可查看。',
      detailEn: 'Tracing is working. Open the folder below to inspect it.',
      ...(outcome.files ? { files: outcome.files } : {}),
    }
  }

  if (outcome.status === 'failed') {
    return {
      tone: 'error',
      titleZh: `落盘失败${stampZh}`,
      titleEn: `Write failed${stampEn}`,
      detailZh: outcome.reason ?? '未知原因',
      detailEn: outcome.reason ?? 'Unknown reason',
    }
  }

  return {
    tone: 'warn',
    titleZh: `本次未写出文件${stampZh}`,
    titleEn: `Nothing written this time${stampEn}`,
    detailZh: outcome.reason ?? '条件不满足',
    detailEn: outcome.reason ?? 'Precondition not met',
  }
}

const TONE_ICON = {
  idle: CircleSlash,
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: AlertTriangle,
} as const

const TONE_COLOR = {
  idle: 'var(--color-text-muted)',
  ok: 'var(--color-success, #16a34a)',
  warn: 'var(--color-warning, #d97706)',
  error: 'var(--color-danger, #dc2626)',
} as const

/**
 * 追踪状态回显。
 *
 * 存在的理由：落盘是**旁路**——失败时绝不能打断生成，但也不能像以前那样只把原因
 * 写进控制台。调 prompt 的人需要在面板上直接判断「这一轮到底抓到没有、写到哪了」。
 */
export default function PromptTraceStatus() {
  const text = useLocaleStore((s) => s.text)
  const promptTraceEnabled = useDebugStore((s) => s.promptTraceEnabled)
  const [outcome, setOutcome] = useState<TraceFlushOutcome | null>(() => lastTraceFlushOutcome())
  const [captured, setCaptured] = useState(() => traceCapturedCount())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const unsubscribe = subscribeTraceFlushOutcome(setOutcome)
    return unsubscribe
  }, [])

  // 落盘结果与捕获计数不是同一个事件源：轮询一下计数，并在有待显示时间时刷新相对时间。
  useEffect(() => {
    if (!promptTraceEnabled) return
    const timer = window.setInterval(() => {
      setCaptured(traceCapturedCount())
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [promptTraceEnabled])

  if (!promptTraceEnabled) return null

  const view = deriveStatus(outcome, captured, now)
  const Icon = TONE_ICON[view.tone]
  const color = TONE_COLOR[view.tone]

  return (
    <div
      className="rounded-lg p-3 space-y-1.5"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-panel)' }}
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color }}>
        <Icon size={13} />
        {text(view.titleZh, view.titleEn)}
      </p>
      <p className="text-[0.68rem]" style={{ color: 'var(--color-text-muted)' }}>
        {text(view.detailZh, view.detailEn)}
      </p>
      {view.files && view.files.length > 0 && (
        <ul className="text-[0.65rem] space-y-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {view.files.map((file) => (
            <li key={file} className="flex items-start gap-1">
              <FolderOpen size={11} className="flex-shrink-0 mt-0.5" />
              <code className="break-all" style={{ fontFamily: 'ui-monospace, monospace' }}>{file}</code>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.65rem] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
        <Activity size={11} />
        {text(
          `开启后累计捕获 ${captured} 块提示词片段`,
          `${captured} prompt fragment(s) captured since enabling`,
        )}
      </p>
    </div>
  )
}
