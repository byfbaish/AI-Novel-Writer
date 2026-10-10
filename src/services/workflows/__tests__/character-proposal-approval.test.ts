import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterProposalBatch } from '../../../shared/character-proposal'
import type { WorkflowContext, StepCallbacks } from '../../../stores/workflow-store'
import { useProjectStore } from '../../../stores/project-store'
import { createCharacterProposalChoices, toApproveCharacterProposalRequest } from '../../character-proposal-choices'
import { defaultCharacterProposalRelationships, defaultCharacterProposalSelections, formatCharacterProposalPreview } from '../character-proposal-preview'
import { AdoptGeneratedCharactersCommand } from '../commands/architecture.command'
import { createArchitectureWorkflow } from '../architecture-workflow'
import { createPlanningMaterialCharacterExtractionWorkflow } from '../planning-material-workflow'
const session = { projectId: 'project', leaseId: 'epoch', projectPath: 'C:/synthetic/project' }
function batch(): CharacterProposalBatch {
  return { proposalBatchId: 'batch', revision: 7, status: 'pending-approval', source: { kind: 'directory', operationId: 'source' },
    items: [
      { selectionKey: 'new', sourceId: 'one', fields: { name: '同名' }, resolution: { status: 'unresolved', candidateIds: [] }, relationships: [{ targetSelectionKey: 'known', relation: '朋友' }, { targetName: '同名', relation: '未知身份' }] },
      { selectionKey: 'known', sourceId: 'two', fields: { name: '已确定' }, resolution: { status: 'resolved', characterId: 'identity' }, relationships: [] },
      { selectionKey: 'ambiguous', sourceId: 'three', fields: { name: '同名' }, resolution: { status: 'ambiguous', candidateIds: ['a', 'b'] }, relationships: [{ targetSelectionKey: 'known', relation: '不明确' }] },
      { selectionKey: 'name-match', sourceId: 'four', fields: { name: '仅名称命中' }, resolution: { status: 'unresolved', candidateIds: ['a'] }, relationships: [] },
    ] }
}
const callbacks: StepCallbacks = { log: vi.fn(), appendText: vi.fn(), setProgress: vi.fn() }
function context(): WorkflowContext { return { runId: 'run', projectPath: session.projectPath, projectSession: session, data: { characterProposalBatch: batch() }, cancelled: false, uiLocale: 'zh-CN', writingLanguage: 'zh-CN' } as WorkflowContext }
beforeEach(() => useProjectStore.setState({ currentProject: { id: session.projectId, sessionLease: session.leaseId, path: session.projectPath, novelConfig: {} } as never }))
afterEach(() => { vi.unstubAllGlobals(); useProjectStore.setState({ currentProject: null }) })
describe('explicit character proposal adoption', () => {
  it('never promotes a name match or ambiguity and only proposes declared identity endpoints', () => {
    expect(defaultCharacterProposalSelections(batch())).toEqual([
      { selectionKey: 'new', action: 'create' }, { selectionKey: 'known', action: 'map', characterId: 'identity' },
      { selectionKey: 'ambiguous', action: 'keep-unresolved' }, { selectionKey: 'name-match', action: 'keep-unresolved' },
    ])
    expect(defaultCharacterProposalRelationships(batch())).toEqual([{ sourceSelectionKey: 'new', targetSelectionKey: 'known', relation: '朋友' }])
    const preview = formatCharacterProposalPreview(batch(), zh => zh)
    expect(preview).toContain('尚未写入正式角色'); expect(preview).toContain('暂不采用'); expect(preview).toContain('未知身份')
  })
  it('submits only the previewed batch revision and decisions and avoids repeating a successful adoption', async () => {
    const state = context(), original = state.data.characterProposalBatch as CharacterProposalBatch
    const invoke = vi.fn(async () => ({ batch: { ...original, status: 'approved', revision: 8 }, created: [] }))
    vi.stubGlobal('window', { aiNovelAPI: { invoke } })
    const command = new AdoptGeneratedCharactersCommand()
    expect(await command.execute({ step: {}, context: state, callbacks })).toContain('采用决策已保存')
    await command.execute({ step: {}, context: state, callbacks })
    expect(invoke).toHaveBeenCalledOnce()
    expect(invoke).toHaveBeenCalledWith('character-proposal:approve', { proposalBatchId: 'batch', expectedRevision: 7,
      operationId: 'character-adoption:run', selections: defaultCharacterProposalSelections(original), relationships: defaultCharacterProposalRelationships(original) }, session)
  })
  it('cancel leaves the proposal readable and performs zero approval calls', async () => {
    const state = context(); state.cancelled = true
    const invoke = vi.fn(); vi.stubGlobal('window', { aiNovelAPI: { invoke } })
    await expect(new AdoptGeneratedCharactersCommand().execute({ step: {}, context: state, callbacks })).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
    expect(state.data.characterProposalBatch).toEqual(batch())
  })
  it('a stale approval refusal keeps the exact shown candidate for copy or later inspection', async () => {
    const state = context(), original = state.data.characterProposalBatch
    const invoke = vi.fn(async () => { throw new Error('CHARACTER_PROPOSAL_REVISION_CONFLICT') }); vi.stubGlobal('window', { aiNovelAPI: { invoke } })
    await expect(new AdoptGeneratedCharactersCommand().execute({ step: {}, context: state, callbacks })).rejects.toThrow('CHARACTER_PROPOSAL_REVISION_CONFLICT')
    expect(state.data.characterProposalBatch).toBe(original)
  })
  it('both planning workflows require explicit confirmation before adoption even in automatic mode', () => {
    const architecture = createArchitectureWorkflow({ projectPath: session.projectPath, projectSession: session, selectedSteps: ['characters'] })
    expect(architecture.steps).toHaveLength(2)
    expect(architecture.steps[0].requiresConfirmation).not.toBe(true)
    expect(architecture.steps[1].requiresConfirmation).toBe(true)
    const material = createPlanningMaterialCharacterExtractionWorkflow({ projectSession: session, generationModelId: 'model', materials: [{ fileName: '人物.md', text: '作者资料' }] })
    expect(material.steps[1].requiresConfirmation).toBe(true)
  })
  it('sends an existing-source outgoing edge as sourceCharacterId and keeps the edge off by default', () => {
    const choices = createCharacterProposalChoices(batch())
    expect(choices.relationships.every(relation => relation.sourceCharacterId === undefined)).toBe(true)
    const request = toApproveCharacterProposalRequest({ ...choices,
      relationships: [...choices.relationships, { sourceCharacterId: 'existing-card', targetCharacterId: 'identity', relation: '旧识' }] }, 'op')
    expect(request.relationships).toEqual([
      { sourceSelectionKey: 'new', targetSelectionKey: 'known', relation: '朋友' },
      { sourceCharacterId: 'existing-card', targetCharacterId: 'identity', relation: '旧识' },
    ])
  })
  it('collapses an edge whose source is a candidate of this same batch back onto its selection key', () => {
    // The candidate has no id until the commit runs, so the panel echoes the id it will get after
    // mapping; sending it verbatim would fail the storage endpoint resolution.
    const choices = createCharacterProposalChoices(batch())
    const request = toApproveCharacterProposalRequest({ ...choices,
      relationships: [...choices.relationships,
        { sourceCharacterId: 'identity', targetSelectionKey: 'new', relation: '同行' }] }, 'op')
    expect(request.relationships).toEqual([
      { sourceSelectionKey: 'new', targetSelectionKey: 'known', relation: '朋友' },
      { sourceSelectionKey: 'known', targetSelectionKey: 'new', relation: '同行' },
    ])
  })
  it('never invents an edge for a row that has no source at all', () => {
    const choices = createCharacterProposalChoices(batch())
    const request = toApproveCharacterProposalRequest({ ...choices, relationships: [{ relation: '凭空' }] }, 'op')
    expect(request.relationships).toEqual([])
  })
  it('defaults every proposed edge to not-adopted, never auto-binding a suggested target', () => {
    // A suggestion is a suggestion: the default set may contain the edge only because both
    // endpoints are adopted candidates, and nothing about it is silently pointed at a real id.
    const choices = createCharacterProposalChoices(batch())
    for (const relation of choices.relationships) {
      expect(relation.targetCharacterId).toBeUndefined()
      expect(relation.sourceCharacterId).toBeUndefined()
    }
    expect(choices.blueprintPendingRelations ?? []).toEqual([])
  })
  it('keeps blueprint-pending markers out of the approve request', () => {
    // "the blueprint will build them later" is intent, not an edge: there is no card to point at,
    // so it must not reach the storage layer at all.
    const choices = createCharacterProposalChoices(batch())
    const request = toApproveCharacterProposalRequest({ ...choices,
      blueprintPendingRelations: [{ sourceSelectionKey: 'new', targetName: '陆危楼' }] }, 'op')
    expect(JSON.stringify(request)).not.toContain('陆危楼')
    expect(Object.keys(request)).not.toContain('blueprintPendingRelations')
  })
  it('binds an unresolved proposal target to whichever existing card the author picks', () => {
    const choices = createCharacterProposalChoices(batch())
    const request = toApproveCharacterProposalRequest({ ...choices,
      relationships: [...choices.relationships,
        { sourceSelectionKey: 'new', targetCharacterId: 'picked-card', relation: '旧识' }] }, 'op')
    expect(request.relationships).toEqual([
      { sourceSelectionKey: 'new', targetSelectionKey: 'known', relation: '朋友' },
      { sourceSelectionKey: 'new', targetCharacterId: 'picked-card', relation: '旧识' },
    ])
  })
})
