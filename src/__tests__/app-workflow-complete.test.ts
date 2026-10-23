import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

it('preserves complete workflow titles in Chinese and English completion notifications', () => {
  const source = ts.createSourceFile('App.tsx', readFileSync(resolve('src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let handler: ts.Expression | undefined
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)
      && node.expression.getText(source) === 'globalEventBus.on'
      && node.arguments[0]?.getText(source) === "'WORKFLOW_COMPLETE'"
      // WORKFLOW_COMPLETE 有多个订阅者（toast 通知 / 蓝图角色提示 / 大纲角色提醒 / 单元链步进），
      // 无判据时「最后一个匹配胜出」会撞上 TS 注解/as 断言导致 VM SyntaxError。
      // 本测试只关心「工作流标题 toast」⇒ 按 handler 体内的 toast 文案认领
      // （蓝图角色提示虽然也调 actionToast.workflowComplete，但文案是「待建卡角色」，不含 completedRun.title）。
      && node.arguments[1]?.getText(source).includes('actionToast.workflowComplete')
      && node.arguments[1]?.getText(source).includes('completedRun.title')) {
      handler = node.arguments[1]
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  expect(handler).toBeDefined()
  const workflowComplete = vi.fn()
  const completedRun = { id: 'run-1', title: '' }
  let english = false
  // Execute the actual App event handler without mounting unrelated application panels.
  const notify = runInNewContext(`(${handler!.getText(source)})`, {
    sameProjectSessionContext: () => true,
    projectSessionContextFromProject: () => ({}),
    useProjectStore: { getState: () => ({ currentProject: {} }) },
    useWorkflowStore: { getState: () => ({ activeRuns: [], history: [completedRun] }) },
    useLocaleStore: { getState: () => ({ text: (zh: string, en: string) => english ? en : zh }) },
    actionToast: { workflowComplete },
  })

  for (const title of [
    '续写章节蓝图（从第 1 章）',
    'AI 生成小说配置',
    '第 1 章 · 写稿',
    'Continue chapter blueprints (from chapter 1)',
    'Chapter 2 · Apply review',
  ]) {
    completedRun.title = title
    for (english of [false, true]) {
      notify({ projectSession: {}, runId: completedRun.id })
      expect(workflowComplete).toHaveBeenLastCalledWith(
        english ? `“${title}” completed` : `「${title}」已完成`,
        expect.any(Function),
      )
    }
  }
})
