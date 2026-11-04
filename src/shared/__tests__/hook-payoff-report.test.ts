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

describe('C5 蹭线提示文案（C5-name-graze）', () => {
  /** 蹭线命中：过线段整体是地名，C5-unplanted 因此不报。 */
  function grazeFindings() {
    return auditDraftHook({
      hookText: '第三段废料区那页抄件，最后会被谁先翻到',
      draft: '他把车推过第三段废料区，风把灰吹到脸上。',
      nameGraze: { properNouns: ['第三段废料区'] },
    })
  }

  it('蹭线 finding 走 C5 的 summarize，不串到 C3', () => {
    const findings = grazeFindings()
    expect(findings.some(item => item.code === 'C5-name-graze')).toBe(true)

    const c5 = summarizeDraftPayoffFindings(findings, zh)
    expect(c5).not.toBeNull()
    expect(c5).toContain('C5')
    expect(c5).toContain('蹭线')
    expect(c5).toContain('第三段废料区')
    expect(c5).toContain('已定稿')

    // 关键：C3 那条线一个字都不能动，也不能被这条提示带出来。
    expect(summarizeDraftCopyFindings(findings, zh)).toBeNull()
  })

  it('两种 C5 finding 同时存在时各占一句（未落地 + 蹭线）', () => {
    // 构造输入：算法上两者互斥（同一 run 不可能既 <3 字又 ≥3 字），
    // 所以这里直接给 findings 数组，验的是**文案拼装**不打架。
    const text = summarizeDraftPayoffFindings([
      ...unplantedFindings(),
      ...grazeFindings(),
    ], zh)
    expect(text).not.toBeNull()
    expect(text).toContain('钩子未落地体检（C5）')
    expect(text).toContain('未落地')
    expect(text).toContain('蹭线')
    // 两句各自带引导语，不混成一句：
    expect(text!.indexOf('未落地')).toBeLessThan(text!.indexOf('蹭线'))
  })
})
