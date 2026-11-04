import { describe, expect, it } from 'vitest'

import { summarizeHookAuditFindings } from '../architecture.command'

/**
 * `summarizeHookAuditFindings` 的职责边界：**只把已判定的钩子行问题翻译成人话，并挑出本批范围**。
 * 判定本身在 `auditOutlineHooks` / `auditChapterHook`（`src/shared/__tests__/hook-line-audit.test.ts` 已覆盖），
 * 这里只断言「哪些情况会说话、说什么、什么时候闭嘴」。
 *
 * 接线第一轮的关键约束：**C1 虽然是 accident 档，也只报不重跑**（设计稿 §11.2 接线顺序）。
 */
const zh = (_zh: string, _en: string) => _zh

const CLEAN_BODY = [
  '## 第1章：封喉',
  '覆盖：无',
  '陈砚把残简收回袖里，门外脚步声停在门槛外。',
  '钩子：悬念截断 — 陈砚把残简收回袖里，门外脚步声停在门槛外｜种在：末尾那句脚步声',
].join('\n')

describe('summarizeHookAuditFindings', () => {
  it('全部合规时闭嘴（返回 null）', () => {
    expect(summarizeHookAuditFindings(CLEAN_BODY, 1, 1, zh)).toBeNull()
  })

  it('只报本批范围内的问题（范围外的章不写进提示）', () => {
    const body = [
      '## 第1章：封喉',
      '陈砚把残简收回袖里。',
      '钩子：悬念截断 — 陈砚会怎么选？｜种在：开头',
      '## 第2章：查账',
      '陈砚把账册翻到第三页。',
      '钩子：信息炸弹 — 账册第三页被谁撕走了？｜种在：第三页',
    ].join('\n')
    const note = summarizeHookAuditFindings(body, 2, 2, zh)!
    expect(note).toContain('第 2 章')
    expect(note).not.toContain('第 1 章')
  })

  it('C1b 版式偏离（问号）只提示、不重跑', () => {
    const body = CLEAN_BODY.replace('陈砚把残简收回袖里，门外脚步声停在门槛外｜', '陈砚会怎么选？｜')
    const note = summarizeHookAuditFindings(body, 1, 1, zh)!
    expect(note).toContain('问号')
    expect(note).toContain('不重跑')
  })

  it('C1 结构事故缺「种在：」也只报不重跑（本轮不给 C1 重跑权限）', () => {
    const body = CLEAN_BODY.replace('｜种在：末尾那句脚步声', '')
    const note = summarizeHookAuditFindings(body, 1, 1, zh)!
    expect(note).toContain('缺「种在：」')
    expect(note).toContain('本轮只报不重跑')
    expect(note).not.toContain('重跑该单元')
  })

  it('旧名「收尾：」不逼新格式 —— 不报结构事故', () => {
    const body = [
      '## 第1章：封喉',
      '陈砚把残简收回袖里，门外脚步声停在门槛外。',
      '收尾：陈砚把残简收回袖里，门外脚步声停在门槛外。',
    ].join('\n')
    expect(summarizeHookAuditFindings(body, 1, 1, zh)).toBeNull()
  })

  it('C2 断点与本章没有任何共享实词时报出来（不判空钩/外挂）', () => {
    const body = CLEAN_BODY.replace(
      '陈砚把残简收回袖里，门外脚步声停在门槛外｜种在：末尾那句脚步声',
      '周师弟在碑坪按手印｜种在：碑坪',
    )
    const note = summarizeHookAuditFindings(body, 1, 1, zh)!
    expect(note).toContain('没有任何共享实词')
    expect(note).toContain('机器分不清')
  })

  it('多章问题按条数封顶，超出部分只报总数', () => {
    const body = [1, 2].map(chapter => [
      `## 第${chapter}章：标题`,
      '陈砚把残简收回袖里。',
      '钩子：悬念截断 — 陈砚会怎么选？｜种在：开头',
    ].join('\n')).join('\n')
    const note = summarizeHookAuditFindings(body, 1, 2, zh)!
    expect(note).toContain('钩子行体检')
    expect(note).toContain('第 2 章')
  })
})
