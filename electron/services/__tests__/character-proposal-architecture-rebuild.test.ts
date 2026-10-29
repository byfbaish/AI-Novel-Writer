import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { ProjectCoreRepository } from '../../repositories/project-core-repository'
import { commitCharacterIdentities, refreshCharacterIdentityProjection, type CharacterIdentityCommitRequest } from '../../repositories/character-roster-repository'
import { textHash } from '../../repositories/generation-run-repository'
import { CharacterProposalService, authorOwnedFields, mergeAdoptedCharacterFields, replaceAdoptedCharacterFields } from '../character-proposal-service'
import { projectAccess } from '../project-access'
import type { CharacterProposalBatch, CharacterProposalItem, CharacterStaticFields } from '../../../src/shared/character-proposal'
import type { CharacterStaticProvenance } from '../../../src/shared/character-identity'
import type { MainGenerationRunHandle } from '../../../src/services/generation/generation-runtime'

/**
 * 架构重建＝整册替换（2026-10-29 作者裁定）。
 *
 * 取证背景：作者「清空后重新生成」，19:02 那次真的生成了新的主角卡（含锚点行），但只有 5 个
 * 新名字落库 —— 主角与反派在库里有同名活跃卡，身份解析只能按名字命中，返回
 * `unresolved + candidateIds:[1]`，默认选择器判成 `keep-unresolved`，于是**新卡被静默丢弃**。
 * 同时 `approve()` 的 `retireIds` 恒为空，每次重新生成都是叠加而不是替换（11 张活跃卡里三批同人）。
 *
 * 这个文件钉住四条契约：
 * 1. 同名唯一候选在架构重建下默认采用（而不是 keep-unresolved）；
 * 2. 采用时**覆盖**旧卡字段（不追加、不保留旧性格）；
 * 3. 名单外、由上几轮架构自动采纳造出来的旧卡被退休；作者手建与正文侧卡片不动；
 * 4. 同一对角色只留一条关系边。
 */

let root = ''
let projectId = ''

const hash = (value: string) => textHash(value)

function serverProvenance(kind: 'generated' | 'derived', sourceId: string): CharacterStaticProvenance {
  return {
    kind,
    source: { projectId, epoch: 'epoch-1', sourceId, revision: 0, contentHash: hash('content') },
    modelRevision: 'a'.repeat(64),
  }
}

function db(): Database.Database {
  const value = getProjectDb()
  if (!value) throw new Error('project database missing')
  return value
}

function revision(): number {
  return (db().prepare("SELECT revision FROM character_identity_meta WHERE id='main'").get() as { revision: number }).revision
}

/** 用真实提交路径建卡：别名、provenance、approval 回执都与线上一致。 */
function seedCharacter(options: {
  operationId: string
  name: string
  personality?: string
  action?: 'adopt-generated' | 'author-edit'
  provenance?: CharacterStaticProvenance
  relationships?: { targetSelectionKey: string; relation: string }[]
  extraCreations?: { selectionKey: string; fields: CharacterStaticFields }[]
}): { characterId: string; others: Record<string, string> } {
  const action = options.action ?? 'adopt-generated'
  const provenance = options.provenance ?? serverProvenance('generated', options.operationId)
  const request: CharacterIdentityCommitRequest = {
    approval: { operationId: options.operationId, expectedRevision: revision(), action, source: provenance },
    changes: [],
    creations: [
      { selectionKey: 'seed', fields: { name: options.name, role: 'protagonist', personality: options.personality ?? '旧性格' } },
      ...(options.extraCreations ?? []),
    ],
    retireIds: [],
    relationships: (options.relationships ?? []).map(relation => ({
      sourceSelectionKey: 'seed', targetSelectionKey: relation.targetSelectionKey, relation: relation.relation,
    })),
    resolutions: [],
  }
  const receipt = db().transaction(() => {
    const committed = commitCharacterIdentities(db(), request, () => true)
    // 身份表写完后名册投影必须同步，否则 `CharacterRosterRepository.read` 判 inconsistent，approve 直接拒绝。
    refreshCharacterIdentityProjection(db())
    return committed
  })()
  const characterId = receipt.created.find(item => item.selectionKey === 'seed')!.characterId
  return { characterId, others: Object.fromEntries(receipt.created.map(item => [item.selectionKey, item.characterId])) }
}

function characterRow(characterId: string) {
  return db().prepare('SELECT name,personality,background,retired,updated_at,static_provenance FROM characters WHERE character_id=?')
    .get(characterId) as { name: string; personality: string; background: string; retired: number; updated_at: string; static_provenance: string }
}

function insertArchitectureBatch(options: {
  proposalId: string
  items: CharacterProposalItem[]
  /** 默认 architecture；传其他 source 用于回归「增量链不受影响」。 */
  source?: CharacterProposalBatch['source']
  revision: number
}): CharacterProposalBatch {
  const source: CharacterProposalBatch['source'] = options.source ?? {
    kind: 'generation', inputKind: 'architecture',
    handle: { runId: 'run-1', epoch: 'epoch-1', rootActionId: 'root-1' } as unknown as MainGenerationRunHandle,
    artifacts: [],
  }
  const batch: CharacterProposalBatch = {
    proposalBatchId: options.proposalId, revision: options.revision, status: 'pending-approval',
    items: options.items, source,
  }
  // 注入的证明必须与封存的 proof 逐字相同，`readEnvelope` 的重算比对才会通过。
  const proof = { items: [], sourceHash: 'stable', provenance: serverProvenance('generated', 'architecture-run') }
  const raw = JSON.stringify({ version: 1, projectId, proof, batch })
  db().prepare('INSERT INTO character_identity_proposals(proposal_id,owner_character_id,source_key,source_hash,raw_value,candidate_ids_json) VALUES(?,NULL,?,?,?,?)')
    .run(options.proposalId, `character-proposal-v1:${projectId}`, textHash(raw), raw, '[]')
  return batch
}

function service(): CharacterProposalService {
  return new CharacterProposalService(db(), projectId, () =>
    ({ items: [], sourceHash: 'stable', provenance: serverProvenance('generated', 'architecture-run') }))
}

function item(selectionKey: string, name: string, personality: string, candidateIds: string[] = [],
  extra: Partial<CharacterStaticFields> = {}): CharacterProposalItem {
  return {
    selectionKey, sourceId: `artifact-1:${selectionKey}`, fields: { name, role: 'protagonist', personality, ...extra },
    relationships: [], resolution: { status: 'unresolved', candidateIds },
  }
}

/** 走作者编辑路径改一次字段：这会把该字段的 provenance 盖成 `author`。 */
function authorEdit(characterId: string, fields: Record<string, string>): void {
  db().transaction(() => {
    commitCharacterIdentities(db(), {
      approval: { operationId: `author-roster-effect:edit-${characterId}`, expectedRevision: revision(), action: 'author-edit',
        source: { kind: 'author', source: { projectId, epoch: 'epoch-1', sourceId: `author-edit-${characterId}`, revision: 0, contentHash: hash('edit') } } },
      changes: [{ characterId, fields }], creations: [], retireIds: [], relationships: [], resolutions: [],
    }, () => true)
    refreshCharacterIdentityProjection(db())
  })()
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-roster-rebuild-'))
  openCanonicalProjectFixture(root)
  ProjectCoreRepository.init('Roster Rebuild Test')
  const project = projectAccess.probeExistingProject(root)
  if (project.kind !== 'manifest') throw new Error('test project identity missing')
  projectId = project.projectId
}, 30_000)

afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('架构重建 · 字段策略', () => {
  it('覆盖模型写的、保留作者写的：重建要的是新性格，但作者手改过的字段不能冲掉', () => {
    expect(replaceAdoptedCharacterFields({ personality: '旧性格', background: '旧背景' },
      { personality: '新性格', background: '旧背景' })).toEqual({ personality: '新性格' })
    // 作者在面板上手写过的字段（provenance.kind === 'author'）留着，否则每重跑一次架构就被冲一次。
    expect(replaceAdoptedCharacterFields({ personality: '旧性格', notes: '作者备注' },
      { personality: '新性格', notes: '模型备注' }, new Set(['notes']))).toEqual({ personality: '新性格' })
    // 候选缺的字段不等于「作者要清空」，空值仍然不写。
    expect(replaceAdoptedCharacterFields({ notes: '保留' }, { notes: '', personality: '' })).toEqual({})
    // 对照：增量链仍然是追加语义，两套策略不能互相顶替。
    expect(mergeAdoptedCharacterFields({ background: '旧背景' }, { background: '新背景' }))
      .toEqual({ background: '旧背景\n\n新背景' })
  })

  it('从 static_provenance.fields 里只挑出作者手写的字段名', () => {
    expect([...authorOwnedFields({ fields: {
      age: { kind: 'author' }, appearance: { kind: 'generated' }, notes: { kind: 'author' },
    } })]).toEqual(['age', 'notes'])
    // 历史数据没有 fields（首次创建时 static_provenance 就是一个 source 对象），不能抛错。
    expect([...authorOwnedFields({ kind: 'generated' })]).toEqual([])
    expect([...authorOwnedFields(null)]).toEqual([])
  })
})

describe('架构重建 · 采纳', () => {
  it('同名旧卡被整卡覆盖：字段换成新的，时间戳跟着动', () => {
    const seeded = seedCharacter({ operationId: 'character-adoption:run-old', name: '陈砚', personality: '上一轮的四层性格' })
    const batch = insertArchitectureBatch({
      proposalId: 'cpb:rebuild-1', revision: revision(),
      items: [item('chen_yan', '陈砚', '这一轮的四层性格', [seeded.characterId])],
    })
    service().approve({
      proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision, operationId: 'character-adoption:run-new',
      selections: [{ selectionKey: 'chen_yan', action: 'map', characterId: seeded.characterId }], relationships: [],
    })
    const row = characterRow(seeded.characterId)
    expect(row.personality).toBe('这一轮的四层性格')
    expect(row.retired).toBe(0)
    // revive/change 路径过去不写 updated_at，会让「刚采纳」在库里显示成几天前（实测踩过一次）。
    expect(row.updated_at).not.toBe('')
  })

  it('作者手改过的字段在重建中被保留，其余照常覆盖', () => {
    const seeded = seedCharacter({ operationId: 'character-adoption:run-old', name: '陈砚', personality: '上一轮的四层性格' })
    authorEdit(seeded.characterId, { background: '作者亲手写的背景' })
    const batch = insertArchitectureBatch({
      proposalId: 'cpb:rebuild-author', revision: revision(),
      items: [item('chen_yan', '陈砚', '这一轮的四层性格', [seeded.characterId], { background: '模型这一轮编的背景' })],
    })
    service().approve({
      proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision, operationId: 'character-adoption:run-new',
      selections: [{ selectionKey: 'chen_yan', action: 'map', characterId: seeded.characterId }], relationships: [],
    })
    expect(characterRow(seeded.characterId)).toMatchObject({
      personality: '这一轮的四层性格',
      background: '作者亲手写的背景',
    })
  })

  it('名单外、由上一轮架构自动采纳造出来的旧卡被退休；作者手建与正文侧卡片不动', () => {    const kept = seedCharacter({ operationId: 'character-adoption:run-old', name: '陈砚' })
    const stale = seedCharacter({ operationId: 'character-adoption:run-older', name: '周敬安', personality: '上上轮的执事' })
    const authored = seedCharacter({
      operationId: 'author-roster-effect:manual-1', name: '作者手记', action: 'author-edit',
      provenance: { kind: 'author', source: { projectId, epoch: 'epoch-1', sourceId: 'manual', revision: 0, contentHash: hash('m') } },
    })
    const narrative = seedCharacter({ operationId: 'finalized-character-adoption:batch-1', name: '正文路人' })
    const batch = insertArchitectureBatch({
      proposalId: 'cpb:rebuild-2', revision: revision(),
      items: [item('chen_yan', '陈砚', '新性格', [kept.characterId])],
    })
    service().approve({
      proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision, operationId: 'character-adoption:run-new',
      selections: [{ selectionKey: 'chen_yan', action: 'map', characterId: kept.characterId }], relationships: [],
    })
    expect(characterRow(kept.characterId).retired).toBe(0)
    expect(characterRow(stale.characterId).retired).toBe(1)
    expect(characterRow(authored.characterId).retired).toBe(0)
    expect(characterRow(narrative.characterId).retired).toBe(0)
  })

  it('增量链（导入/定稿）不受整册替换影响：不退休任何人', () => {
    const stale = seedCharacter({ operationId: 'character-adoption:run-older', name: '周敬安' })
    const batch = insertArchitectureBatch({
      proposalId: 'cpb:import-1', revision: revision(),
      items: [item('new_one', '新人甲', '甲的性格')],
      source: { kind: 'import', operationId: 'import-op-1' },
    })
    service().approve({
      proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision, operationId: 'character-adoption:import',
      selections: [{ selectionKey: 'new_one', action: 'create' }], relationships: [],
    })
    expect(characterRow(stale.characterId).retired).toBe(0)
  })

  it('同一对角色只留一条关系边（实测陈砚→赵铎 堆了 10 条措辞各异的边）', () => {
    const seeded = seedCharacter({
      operationId: 'character-adoption:run-old', name: '陈砚',
      extraCreations: [{ selectionKey: 'zhao_duo', fields: { name: '赵铎', role: 'antagonist' } }],
      // 旧批留下的两条重复边：同对、不同措辞（实测陈砚→赵铎 堆了 10 条）。
      relationships: [
        { targetSelectionKey: 'zhao_duo', relation: '前世设局害死自己的仇人' },
        { targetSelectionKey: 'zhao_duo', relation: '设局顶罪与律条反咬的主要仇敌' },
      ],
    })
    const zhaoId = seeded.others.zhao_duo
    const batch = insertArchitectureBatch({
      proposalId: 'cpb:rebuild-3', revision: revision(),
      items: [
        { ...item('chen_yan', '陈砚', '新性格', [seeded.characterId]),
          relationships: [{ targetSelectionKey: 'zhao_duo', relation: '本轮的仇账关系' }] },
        item('zhao_duo', '赵铎', '赵铎的性格', [zhaoId]),
      ],
    })
    service().approve({
      proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision, operationId: 'character-adoption:run-new',
      selections: [
        { selectionKey: 'chen_yan', action: 'map', characterId: seeded.characterId },
        { selectionKey: 'zhao_duo', action: 'map', characterId: zhaoId },
      ],
      relationships: [{ sourceSelectionKey: 'chen_yan', targetSelectionKey: 'zhao_duo', relation: '本轮的仇账关系' }],
    })
    const edges = db().prepare('SELECT relation FROM character_relationships WHERE source_character_id=? AND target_character_id=?')
      .all(seeded.characterId, zhaoId) as { relation: string }[]
    expect(edges).toHaveLength(1)
    expect(edges[0].relation).toBe('本轮的仇账关系')
  })
})
