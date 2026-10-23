/**
 * 结构化 JSON 调用（W6a-6，2026-10-23）。
 *
 * ## 为什么需要它
 *
 * 资源提案抽取连失 5 次（`llm_calls` 全 `finish:error`，2026-10-23 实机），根因是
 * 第三方中转/本地模型不认 `response_format: { type: 'json_object' }`，直接 400。
 * 而解析端本来就有容错（`parseResourceCandidates` 会剥 ```json 围栏、坏 JSON 判
 * `unreadable`）—— 也就是说**不发这个字段也能拿到可用结果**，没必要因为服务端
 * 少支持一个可选项就整条通道作废。
 *
 * ## 只做一件事：形状被拒时降级重试一次
 *
 * - 首发带 `json_object`；
 * - 失败且错误像「请求形状不被接受」（400/422 / response_format / unsupported / invalid）
 *   ⇒ 去掉该字段重试**一次**；
 * - 认证、额度、超时、网络一律**不重试**：换个输出格式救不回来，重试只是双倍计费。
 *
 * 判据落在 `shouldRetryWithoutJsonMode`，纯函数，可单测。
 */
import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { GenerationReasoningStage } from '../shared/reasoning-types'
import { useLLMStore } from '../stores/llm-store'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface StructuredJsonRequest {
  messages: ChatMessage[]
  purpose: string
  projectSession?: ProjectSessionContext
  reasoningStage?: GenerationReasoningStage
  modelId?: string
}

export interface StructuredJsonOutcome {
  ok: boolean
  content: string
  /** 是否降级重试过（服务端不接受结构化输出）。界面要明示，否则作者以为一切正常。 */
  degraded: boolean
  /** 失败摘要（已脱敏裁剪），可直接展示给作者。 */
  error?: string
}

/** 诊断摘要上限：够看清状态码与首句说明，又不至于把整段响应体塞进界面。 */
const MAX_ERROR_SUMMARY_CHARS = 160

/** 「请求形状不被接受」这一类错误 —— 换掉 `response_format` 可能就过了。 */
const SHAPE_REJECTION = /(?:response_format|json_object|json mode|unsupported|not supported|invalid[_ ]request|\b40[04]\b|\b422\b)/iu

/** 换格式也没用的错误：认证 / 额度 / 限流 / 超时 / 网络。 */
const UNRECOVERABLE = /(?:\b401\b|\b403\b|\b429\b|quota|rate[_ ]?limit|insufficient|unauthorized|forbidden|timeout|timed out|ECONN|ENOTFOUND|socket hang up)/iu

/**
 * 值得去掉 `response_format` 重试一次吗。
 *
 * **先排除不可恢复类**：错误文案里同时出现 `400` 与 `unauthorized` 时，正确的判断是
 * 「别重试」—— 宁可少试一次，也不要把一次失败变成两次。
 */
export function shouldRetryWithoutJsonMode(error: string | undefined): boolean {
  const text = error?.trim()
  if (!text) return false
  if (UNRECOVERABLE.test(text)) return false
  return SHAPE_REJECTION.test(text)
}

/**
 * 失败摘要：抹掉可能的凭据形态，压成一行，再截断。
 *
 * provider 回的错误体常带请求回显，直接贴进界面有把 key 亮出来的风险；
 * 这里只保留能定位问题的那一段。
 */
export function summarizeCallError(error: string | undefined, max = MAX_ERROR_SUMMARY_CHARS): string | undefined {
  const text = error?.trim()
  if (!text) return undefined
  const cleaned = text
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gu, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, 'sk-***')
    .replace(/[a-f0-9]{32,}/giu, '***')
    .replace(/\s+/gu, ' ')
    .trim()
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max)}…`
}

async function attempt(
  request: StructuredJsonRequest,
  withJsonMode: boolean,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  try {
    const response = await useLLMStore.getState().generate(request.messages, request.modelId, {
      ...(withJsonMode ? { responseFormat: { type: 'json_object' } } : {}),
      purpose: request.purpose,
      reasoningStage: request.reasoningStage,
      projectSession: request.projectSession,
    })
    if (!response.success || response.finishReason !== 'stop') {
      return {
        ok: false,
        error: response.error?.trim()
          || `finish:${response.finishReason ?? 'unknown'}`,
      }
    }
    return { ok: true, content: response.content }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 先按结构化输出要一次；服务端不认这个字段时降级重试一次。 */
export async function generateStructuredJson(request: StructuredJsonRequest): Promise<StructuredJsonOutcome> {
  const first = await attempt(request, true)
  if (first.ok) return { ok: true, content: first.content, degraded: false }
  if (!shouldRetryWithoutJsonMode(first.error)) {
    return { ok: false, content: '', degraded: false, error: summarizeCallError(first.error) }
  }
  const second = await attempt(request, false)
  if (second.ok) return { ok: true, content: second.content, degraded: true }
  return { ok: false, content: '', degraded: true, error: summarizeCallError(second.error) }
}
