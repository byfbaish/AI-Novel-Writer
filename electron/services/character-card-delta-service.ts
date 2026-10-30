import { createHash } from 'node:crypto'

import type Database from 'better-sqlite3'

import { applyCardDelta, parsePersonalityCard, type CardDeltaInput } from '../../src/shared/character-card-format'
import type { FinalizedCharacterCardDelta } from '../../src/shared/finalized-continuity'
import {
  CharacterRosterRepository,
  commitCharacterIdentities,
  refreshCharacterIdentityProjection,
  type CharacterIdentityCommitRequest,
} from '../repositories/character-roster-repository'

/**
 * 把一条卡片增量落到角色卡上。
 *
 * ## 为什么必须走 `commitCharacterIdentities` + `refreshCharacterIdentityProjection`
 *
 * 直接 `UPDATE characters SET personality=?` 会让 `deriveRosterStatus` 判 inconsistent
 * （`projection_hash` / `fact_hash` / `characters_arch` 三者对不上），接着
 * `character-roster-author` 抛 `CHARACTER_AUTHOR_ROSTER_NOT_READY` —— **整个角色面板锁死，
 * 架构生成的角色步也进不去**。这是本机制唯一「一写错就全局崩」的点。
 *
 * `commitCharacterIdentities` 自己**不刷新投影**（它止于身份与别名的写入），
 * 作者保存路径与提案采纳路径都是在外面补一次，这里照做。
 *
 * ## 幂等
 *
 * 同一份增量重放时 `applyCardDelta` 是 no-op（同名软肋不重复登记、同名筹码不重复添加），
 * 返回文本与原文相同，本函数直接返回不开事务 —— 所以「先写卡、后标记」的重试是安全的。
 *
 * ## legacy 卡直接拒绝
 *
 * 旧四层卡里没有【禁区】段。往它里面插半套新结构，既解析不出来，也会覆盖作者原文。
 */

export interface AcceptCardDeltaInput {
  readonly characterId: string
  readonly delta: FinalizedCharacterCardDelta
  readonly projectId: string
  readonly epoch: string
  /** 幂等键：同一条增量重复确认时用同一个 operationId。 */
  readonly operationId: string
}

export interface AcceptCardDeltaResult {
  /** 应用后的 personality 文本。 */
  readonly personality: string
  /** 卡面没有变化（同一条增量重复确认，或增量的效果已经在卡上）。 */
  readonly unchanged: boolean
}

export function acceptCharacterCardDelta(db: Database.Database, input: AcceptCardDeltaInput): AcceptCardDeltaResult {
  const delta = input.delta
  if (delta.kind === 'hit') {
    // 顶撞只是记账，不写卡 —— 走到这里说明上层把两个通道接错了。
    throw new Error('CARD_DELTA_HIT_IS_LEDGER_ONLY')
  }

  return db.transaction(() => {
    const roster = CharacterRosterRepository.read(db)
    if (!['ready', 'empty'].includes(roster.status)) throw new Error('CHARACTER_AUTHOR_ROSTER_NOT_READY')
    // 身份版本是 CAS 的基准，缺了就没法安全写入 —— 宁可拒绝，不要拿 undefined 去比。
    const identityRevision = roster.identityRevision
    if (identityRevision === undefined) throw new Error('CHARACTER_ROSTER_REVISION_MISSING')
    const entry = roster.entries.find(item => item.characterId === input.characterId)
    if (!entry) throw new Error('CHARACTER_CARD_NOT_FOUND')

    const card = parsePersonalityCard(entry.personality)
    if (card.format !== 'v3') throw new Error('CARD_FORMAT_LEGACY')

    const applied = applyCardDelta(entry.personality, toCardDeltaInput(delta))
    if (applied.dropped) throw new Error(`CARD_DELTA_DROPPED:${applied.dropped}`)
    if (applied.personality === entry.personality) {
      return { personality: entry.personality, unchanged: true }
    }

    const contentHash = createHash('sha256').update(applied.personality, 'utf8').digest('hex')
    const request: CharacterIdentityCommitRequest = {
      approval: {
        operationId: input.operationId,
        expectedRevision: identityRevision,
        action: 'author-edit',
        source: {
          kind: 'author',
          source: {
            projectId: input.projectId,
            epoch: input.epoch,
            sourceId: input.operationId,
            revision: identityRevision,
            contentHash,
          },
        },
      },
      changes: [{ characterId: input.characterId, fields: { personality: applied.personality } }],
      creations: [],
      retireIds: [],
      relationships: [],
      resolutions: [],
    }
    commitCharacterIdentities(db, request, () => true)
    refreshCharacterIdentityProjection(db)
    return { personality: applied.personality, unchanged: false }
  }).immediate()
}

function toCardDeltaInput(delta: FinalizedCharacterCardDelta): CardDeltaInput {
  if (delta.kind === 'soft-spot') return { kind: 'soft-spot', name: delta.name, text: delta.text }
  return {
    kind: 'chip',
    name: delta.name,
    text: delta.text,
    change: delta.change ?? 'add',
    ...(delta.replaces ? { replaces: delta.replaces } : {}),
  }
}
