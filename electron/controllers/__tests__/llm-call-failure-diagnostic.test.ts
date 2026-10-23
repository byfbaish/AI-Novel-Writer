import { describe, expect, it } from 'vitest'

import { describeCallFailure } from '../llm-controller'

/**
 * 2026-10-23 排查资源提案连失 5 次：库里只剩 `finish:error`，真实原因（provider 回的
 * `API 调用失败 (400): …`）被三元覆盖掉，只能回现场重跑。这组用例钉住「两者都要留」。
 */
describe('失败调用的诊断串', () => {
  it('结束原因与真实错误并存', () => {
    expect(describeCallFailure({
      success: false,
      finishReason: 'error',
      error: 'API 调用失败 (400): {"error":{"message":"response_format is not supported"}}',
    })).toBe(
      'finish:error | API 调用失败 (400): {"error":{"message":"response_format is not supported"}}',
    )
  })

  it('只有结束原因时不编造错误', () => {
    expect(describeCallFailure({ success: false, finishReason: 'length' })).toBe('finish:length')
  })

  it('只有错误时原样保留（没有结束原因可拼）', () => {
    expect(describeCallFailure({ success: false, error: '未找到模型配置' })).toBe('未找到模型配置')
  })

  it('成功调用不产生诊断串', () => {
    expect(describeCallFailure({ success: true, finishReason: 'stop' })).toBeUndefined()
  })

  it('超长错误被截断，不把整段响应体写进库', () => {
    const long = 'x'.repeat(1000)
    const result = describeCallFailure({ success: false, finishReason: 'error', error: long })
    expect(result?.startsWith('finish:error | ')).toBe(true)
    expect(result?.length).toBeLessThan(340)
  })
})
