import { describe, expect, it } from 'vitest'
import { HOOK_PLANTED_MIN_RUN } from '../hook-payoff-audit'
import {
  detectNameOnlyGraze,
  longestCommonRunText,
  NAME_GRAZE_MIN_RUN,
  trimEdgeNoise,
} from '../hook-name-graze'

describe('detectNameOnlyGraze：过线段整体落在专名上', () => {
  it('地名整体命中 ⇒ 返回 { run, noun }', () => {
    // 口径来源：第 11 章靠「第三段废料区」6 字过线，悬念核（第三页中间 / 被谁先翻到）0 落地。
    const hook = '第三段废料区那页抄件，最后会被谁先翻到'
    const draft = '他把车推过第三段废料区，风把灰吹到脸上。'
    const hit = detectNameOnlyGraze(hook, draft, ['第三段废料区', '陈砚'])
    expect(hit).not.toBeNull()
    expect(hit!.run).toBe('第三段废料区')
    expect(hit!.noun).toBe('第三段废料区')
  })

  it('人名 + 句读 ⇒ 命中（**口径**：片段去首尾标点后整段就是人名，标点不算"超出专名"的内容）', () => {
    const hook = '这页抄件最后被谁先翻到，陈砚'
    const draft = '灯芯爆了一下，陈砚把布条扎紧了，系上死扣。'
    // 先钉住这段的最长公共片段确实是「，陈砚」而不是别的地方：
    expect(longestCommonRunText(hook, draft)).toBe('，陈砚')
    expect(trimEdgeNoise('，陈砚')).toBe('陈砚')

    const hit = detectNameOnlyGraze(hook, draft, ['陈砚'])
    expect(hit).not.toBeNull()
    // run 保留原文（含那个逗号，便于作者核对"判定的是哪一段"）；判定用的是剔标点后的形态。
    expect(hit!.run).toBe('，陈砚')
    expect(hit!.noun).toBe('陈砚')
  })

  it('片段只是通用词、不在 properNouns ⇒ null（哪怕 ≥3 字）', () => {
    const hook = '他把账本压在灯下，等着门外的脚步声'
    const draft = '账本还压在灯下，屋里没人。'
    expect(longestCommonRunText(hook, draft)).toBe('压在灯下，')
    // 尾部那个逗号被剔掉后仍是通用词，不被任何专名包含 ⇒ 不算蹭线。
    expect(trimEdgeNoise('压在灯下，')).toBe('压在灯下')
    expect(detectNameOnlyGraze(hook, draft, ['陈砚', '第三段废料区'])).toBeNull()
  })

  it('片段跨出专名（人名 + 动作）⇒ null（不是"整体落在专名上"）', () => {
    const hook = '陈砚把布条扎紧'
    const draft = '陈砚把布条扎紧了，系上死扣。'
    expect(longestCommonRunText(hook, draft)).toBe('陈砚把布条扎紧')
    expect(detectNameOnlyGraze(hook, draft, ['陈砚'])).toBeNull()
  })

  it('片段 <3 字 ⇒ null（哪怕整段就是人名，交给 C5 未落地那条去判）', () => {
    const hook = '赵铎的尸骨停在半空'
    const draft = '赵铎在院子里站着，什么也没说。'
    expect(longestCommonRunText(hook, draft)).toBe('赵铎')
    expect(detectNameOnlyGraze(hook, draft, ['赵铎'])).toBeNull()
  })

  it('空 properNouns ⇒ null（fail-open，不抛错）', () => {
    const hook = '第三段废料区那页抄件'
    const draft = '他把车推过第三段废料区。'
    expect(detectNameOnlyGraze(hook, draft, [])).toBeNull()
  })

  it('专名表里的空串 / 纯空白条目被跳过，不影响后面的命中', () => {
    const hook = '第三段废料区那页抄件'
    const draft = '他把车推过第三段废料区。'
    const hit = detectNameOnlyGraze(hook, draft, ['', '   ', '第三段废料区'])
    expect(hit?.noun).toBe('第三段废料区')
  })

  it('钩子或正文为空 ⇒ null', () => {
    expect(detectNameOnlyGraze('', '正文里有第三段废料区', ['第三段废料区'])).toBeNull()
    expect(detectNameOnlyGraze('第三段废料区那页', '   \n ', ['第三段废料区'])).toBeNull()
  })

  it('3 字线两处常量同值（改一处不够，两处都要改）', () => {
    expect(NAME_GRAZE_MIN_RUN).toBe(HOOK_PLANTED_MIN_RUN)
  })
})
