import { afterEach, describe, expect, it } from 'vitest'

import { useProjectStore } from '../../../stores/project-store'
import { workflowResourceKey } from '../../../stores/workflow-store'
import { createCastLedgerCompletionWorkflow } from '../cast-ledger-completion-workflow'

const projectPath = 'C:\\novels\\A'
const projectSession = { projectId: 'project-1', leaseId: 'lease-1', projectPath }

function arrangeCurrentProject(overrides: { sessionLease?: string; path?: string } = {}) {
  useProjectStore.setState({
    currentProject: {
      id: projectSession.projectId,
      name: 'A',
      path: overrides.path ?? projectPath,
      sessionLease: overrides.sessionLease ?? projectSession.leaseId,
      novelConfig: { writingLanguage: 'zh-CN' },
    } as never,
  })
}

afterEach(() => {
  useProjectStore.setState({ currentProject: null })
})

describe('createCastLedgerCompletionWorkflow', () => {
  it('拒绝项目会话已切换的定义', () => {
    arrangeCurrentProject({ sessionLease: 'lease-2' })
    expect(() => createCastLedgerCompletionWorkflow({
      projectSession,
      names: ['叶知秋'],
      generationModelId: 'deepseek-v4-flash',
    }, 'zh-CN')).toThrow('当前项目已切换')
  })

  it('缺少已确认模型时拒绝创建', () => {
    arrangeCurrentProject()
    expect(() => createCastLedgerCompletionWorkflow({
      projectSession,
      names: ['叶知秋'],
      generationModelId: '   ',
    }, 'zh-CN')).toThrow('缺少已确认的生成模型')
  })

  it('名单去空后为空时拒绝创建', () => {
    arrangeCurrentProject()
    expect(() => createCastLedgerCompletionWorkflow({
      projectSession,
      names: ['   ', ''],
      generationModelId: 'deepseek-v4-flash',
    }, 'zh-CN')).toThrow('归位表里没有需要补全的名字')
  })

  it('返回两段式 post_process 定义，第二步要求确认', () => {
    arrangeCurrentProject()
    const definition = createCastLedgerCompletionWorkflow({
      projectSession,
      names: [' 叶知秋 ', '叶知秋', '沈砚', ''],
      generationModelId: '  deepseek-v4-flash  ',
    }, 'zh-CN')

    expect(definition.type).toBe('post_process')
    expect(definition.title).toBe('补齐归位表角色卡')
    expect(definition.projectPath).toBe(projectPath)
    expect(definition.projectSession).toEqual(projectSession)
    // 冻结的是副本：后续调用方改 params.projectSession 不会改到已提交的运行。
    expect(definition.projectSession).not.toBe(projectSession)
    expect(definition.generationModelId).toBe('deepseek-v4-flash')
    expect(definition.uiLocale).toBe('zh-CN')
    expect(definition.resourceKeys).toEqual([workflowResourceKey('character-roster')])
    expect(definition.readResourceKeys).toEqual([workflowResourceKey('blueprints')])
    expect(definition.steps).toHaveLength(2)
    expect(definition.steps[0]?.name).toBe('补全缺失角色资料')
    expect(definition.steps[1]?.name).toBe('确认并写入角色卡')
    expect(definition.steps[1]?.requiresConfirmation).toBe(true)
    expect(definition.steps[0]?.requiresConfirmation).toBeUndefined()
    expect(definition.onComplete).toEqual({ mode: 'silent', message: '归位表角色卡已更新' })
  })

  it('en-US 下给出英文文案', () => {
    arrangeCurrentProject()
    const definition = createCastLedgerCompletionWorkflow({
      projectSession,
      names: ['叶知秋'],
      generationModelId: 'deepseek-v4-flash',
    }, 'en-US')
    expect(definition.title).toBe('Fill in cast-ledger cards')
    expect(definition.steps[1]?.name).toBe('Confirm and write character cards')
  })
})
