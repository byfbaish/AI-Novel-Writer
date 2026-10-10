import type { CharacterProposalBatch, CharacterProposalHistoryEntry } from '../shared/character-proposal'
import type { ProjectSessionContext } from '../shared/ipc-channels'
import { ipc } from './ipc-client'

/** Read-only history listing. Grouped by source semantics because the ledger has no timestamp. */
export async function listCharacterProposalHistory(
  projectSession: ProjectSessionContext,
): Promise<CharacterProposalHistoryEntry[]> {
  return ipc.invokeWithProjectSession(projectSession, 'character-proposal:list-history')
}

export async function readCharacterProposalBatch(
  projectSession: ProjectSessionContext,
  proposalBatchId: string,
): Promise<CharacterProposalBatch> {
  return ipc.invokeWithProjectSession(projectSession, 'character-proposal:read', { proposalBatchId })
}

/**
 * Re-stage an earlier entry so the author can adopt it again.
 *
 * This re-runs `stage` with the entry's own recorded source. Staging is idempotent on
 * `proposalBatchId` (derived from the source), so:
 *  - if the batch is still present, this returns it unchanged — nothing is mutated, and the
 *    frozen envelope keeps whatever status it already had;
 *  - if the batch no longer exists, it is re-derived from its source on the spot.
 *
 * It deliberately does **not** re-invoke the model: an earlier generation is a recorded artifact,
 * not a seed for a new idea. Re-running the source is what "让旧版生效" means here.
 */
export async function restageCharacterProposalBatch(
  projectSession: ProjectSessionContext,
  source: CharacterProposalHistoryEntry['source'],
): Promise<CharacterProposalBatch> {
  return ipc.invokeWithProjectSession(projectSession, 'character-proposal:stage', { source })
}

export const CHARACTER_PROPOSAL_SOURCE_GROUP_ORDER = [
  'architecture',
  'planning-material',
  'directory',
  'import',
  'finalized-generation',
  'legacy-roster-generation',
] as const

const GROUP_LABELS: Record<CharacterProposalHistoryEntry['sourceGroup'], [string, string]> = {
  architecture: ['来自前提 + 配置', 'From premise + config'],
  'planning-material': ['来自创作资料', 'From planning material'],
  directory: ['来自章节蓝图', 'From chapter blueprints'],
  import: ['来自导入', 'From import'],
  'finalized-generation': ['来自定稿正文', 'From finalized prose'],
  'legacy-roster-generation': ['来自旧角色名单', 'From legacy roster'],
}

/** Stable grouping without inventing a time order the ledger cannot prove. */
export function groupCharacterProposalHistory(
  entries: readonly CharacterProposalHistoryEntry[],
  text: (zh: string, en: string) => string,
): { group: CharacterProposalHistoryEntry['sourceGroup']; label: string; entries: CharacterProposalHistoryEntry[] }[] {
  return CHARACTER_PROPOSAL_SOURCE_GROUP_ORDER.flatMap(group => {
    const grouped = entries.filter(entry => entry.sourceGroup === group)
    if (!grouped.length) return []
    return [{ group, label: text(...GROUP_LABELS[group]), entries: grouped }]
  })
}

export function characterProposalStatusLabel(
  status: CharacterProposalHistoryEntry['status'],
  text: (zh: string, en: string) => string,
): string {
  return status === 'pending-approval' ? text('待确认', 'Awaiting confirmation')
    : status === 'approved' ? text('已采用', 'Adopted')
      : text('已取消', 'Cancelled')
}
