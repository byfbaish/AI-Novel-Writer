import { describe, expect, it } from 'vitest'
import { auditDraftHook } from '../hook-payoff-audit'
import { summarizeDraftCopyFindings, summarizeDraftPayoffFindings } from '../hook-payoff-report'

const zh = (_zh: string, _en: string) => _zh

/** C3 命中：正文末段把钩子整句搬走。 */
function copyFindings() {
  const hookText = '他把账本压在灯下，等着门外的脚步声先开口，那串动静压得比心跳还低。'
  const draft = `门开了又合上。\n${hookText}`
  return auditDraftHook({ hookText, draft })
}

/** C5 命中：钩子里的东西正文一处没写。 */
function unplantedFindings() {
  return auditDraftHook({
    hookText: '第一道因果纹灼烧皮肤，寿元透支的代价已经无法逆转。',
    draft: '今天天气很好，院子里的鸡在啄米。',
  })
}

describe('C3 照抄体检文案', () => {
  it('无 C3 finding 时闭嘴', () => {
    expect(summarizeDraftCopyFindings([], zh)).toBeNull()
    expect(summarizeDraftCopyFindings(unplantedFindings(), zh)).toBeNull()
  })

  it('命中时说明「草稿已保存、只提示不改稿」', () => {
    const text = summarizeDraftCopyFindings(copyFindings(), zh)
    expect(text).toContain('C3')
    expect(text).toContain('照抄')
    expect(text).toContain('草稿已保存')
    expect(text).toContain('不阻断')
  })
})

describe('C5 未落地体检文案', () => {
  it('无 C5 finding 时闭嘴', () => {
    expect(summarizeDraftPayoffFindings([], zh)).toBeNull()
    expect(summarizeDraftPayoffFindings(copyFindings(), zh)).toBeNull()
  })

  it('命中时说明「正文已定稿、只提示不改稿」', () => {
    const text = summarizeDraftPayoffFindings(unplantedFindings(), zh)
    expect(text).toContain('C5')
    expect(text).toContain('未落地')
    expect(text).toContain('已定稿')
    expect(text).toContain('不改稿')
  })
})
