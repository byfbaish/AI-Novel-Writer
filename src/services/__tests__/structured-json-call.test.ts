import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  generateStructuredJson,
  shouldRetryWithoutJsonMode,
  summarizeCallError,
} from '../structured-json-call'

const generate = vi.fn()

vi.mock('../../stores/llm-store', () => ({
  useLLMStore: { getState: () => ({ generate: (...args: unknown[]) => generate(...args) }) },
}))

const request = {
  messages: [{ role: 'user' as const, content: '世界观原文' }],
  purpose: 'world-building-resource-extract',
}

const ok = (content: string) => ({ success: true, content, finishReason: 'stop' })

beforeEach(() => {
  generate.mockReset()
})

describe('什么时候值得去掉 JSON 模式重试', () => {
  it('请求形状被拒（4xx + response_format/不支持）⇒ 重试', () => {
    expect(shouldRetryWithoutJsonMode('API 调用失败 (400): response_format is not supported')).toBe(true)
    expect(shouldRetryWithoutJsonMode('API 调用失败 (422): invalid request')).toBe(true)
    expect(shouldRetryWithoutJsonMode('json_object unsupported by this model')).toBe(true)
  })

  it('认证 / 额度 / 限流 / 超时 ⇒ 不重试（换格式也救不回来）', () => {
    expect(shouldRetryWithoutJsonMode('API 调用失败 (401): unauthorized')).toBe(false)
    expect(shouldRetryWithoutJsonMode('API 调用失败 (403): forbidden')).toBe(false)
    expect(shouldRetryWithoutJsonMode('429 rate limit exceeded')).toBe(false)
    expect(shouldRetryWithoutJsonMode('request timeout')).toBe(false)
    expect(shouldRetryWithoutJsonMode('')).toBe(false)
  })

  it('同时出现 400 与 unauthorized 时按不可恢复处理（宁可少试一次）', () => {
    expect(shouldRetryWithoutJsonMode('API 调用失败 (400): unauthorized')).toBe(false)
  })
})

describe('失败摘要', () => {
  it('抹掉凭据形态并压成一行', () => {
    const summary = summarizeCallError('Bearer abcdef123456 失败 sk-live-1234567890 key=0123456789abcdef0123456789abcdef\n下一行')
    expect(summary).not.toContain('abcdef123456')
    expect(summary).not.toContain('sk-live')
    expect(summary).not.toContain('0123456789abcdef0123456789abcdef')
    expect(summary).toContain('下一行')
  })
})

describe('结构化 JSON 调用', () => {
  it('一次成功就不重试，也不标降级', async () => {
    generate.mockResolvedValueOnce(ok('{"candidates":[]}'))
    const outcome = await generateStructuredJson(request)
    expect(outcome).toEqual({ ok: true, content: '{"candidates":[]}', degraded: false })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0][2]).toMatchObject({ responseFormat: { type: 'json_object' } })
  })

  it('服务端不认 JSON 模式 ⇒ 去掉该字段重试一次并标降级', async () => {
    generate
      .mockRejectedValueOnce(new Error('API 调用失败 (400): response_format is not supported'))
      .mockResolvedValueOnce(ok('```json\n{"candidates":[]}\n```'))
    const outcome = await generateStructuredJson(request)
    expect(outcome).toEqual({ ok: true, content: '```json\n{"candidates":[]}\n```', degraded: true })
    expect(generate).toHaveBeenCalledTimes(2)
    // 第二次调用不带 responseFormat —— 这才是「降级」的实际含义。
    expect(generate.mock.calls[1][2]).not.toHaveProperty('responseFormat')
  })

  it('认证失败不重试，直接把原因带回去', async () => {
    generate.mockRejectedValueOnce(new Error('API 调用失败 (401): unauthorized'))
    const outcome = await generateStructuredJson(request)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(outcome.ok).toBe(false)
    expect(outcome.degraded).toBe(false)
    expect(outcome.error).toContain('401')
  })

  it('降级后仍失败 ⇒ 两个标志都如实反映', async () => {
    generate
      .mockRejectedValueOnce(new Error('400 response_format unsupported'))
      .mockResolvedValueOnce({ success: false, content: '', finishReason: 'error', error: 'quota exceeded' })
    const outcome = await generateStructuredJson(request)
    expect(outcome.ok).toBe(false)
    expect(outcome.degraded).toBe(true)
    expect(outcome.error).toContain('quota')
  })
})
