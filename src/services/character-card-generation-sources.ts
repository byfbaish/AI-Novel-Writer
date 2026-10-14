import type { BlueprintCharacterSyncOperation } from '../../electron/repositories/blueprint-repository'
import { characterRosterIdentityKey } from '../shared/character-roster'

export type CharacterCardGenerationSource = 'blueprint' | 'premise' | 'material' | 'character'

export interface CharacterCardGenerationSourceSelection {
  blueprint: boolean
  premise: boolean
  material: boolean
  character: boolean
}

export interface BlueprintPendingCandidate {
  chapterNumber: number
  name: string
  role: string
}

/**
 * Derive the still-unbuilt candidate set from durable sync operations.
 *
 * Only `newCharacterCandidates` declared by a committed blueprint qualify: a
 * name that merely appears in `characters` is chapter-scoped scenery and must
 * never be silently promoted into a card. Candidates already present in the
 * roster are dropped, so "pending" means exactly "declared but not yet built".
 *
 * `declinedNames` are the names the author explicitly registered as anchored
 * supporting roles without a card. They are settled decisions too: without them
 * this derived list can never be emptied, because such a character stays absent
 * from the roster by design.
 */
export function pendingBlueprintCandidates(
  operations: readonly BlueprintCharacterSyncOperation[],
  rosterNames: readonly string[],
  declinedNames: readonly string[] = [],
): BlueprintPendingCandidate[] {
  const built = new Set([...rosterNames, ...declinedNames].map(characterRosterIdentityKey).filter(Boolean))
  // A character declared in several chapters is introduced once: keep the
  // earliest chapter so provenance points at the first appearance, not a repeat.
  const byName = new Map<string, BlueprintPendingCandidate>()
  for (const operation of operations) {
    for (const blueprint of operation.characterSyncInput) {
      for (const candidate of blueprint.newCharacterCandidates ?? []) {
        const key = characterRosterIdentityKey(candidate.name)
        if (!key || built.has(key)) continue
        const existing = byName.get(key)
        if (!existing || blueprint.chapterNumber < existing.chapterNumber) {
          byName.set(key, { chapterNumber: blueprint.chapterNumber, name: candidate.name.trim(), role: candidate.role })
        }
      }
    }
  }
  return [...byName.values()].sort((left, right) => left.chapterNumber - right.chapterNumber || left.name.localeCompare(right.name, 'zh-Hans-CN'))
}

/** Author-facing provenance note. Names come from the blueprint, so the chapter must travel with them. */
export function blueprintCandidateNote(chapterNumber: number): string {
  return `来源：第 ${chapterNumber} 章蓝图`
}

export function selectedCharacterCardSources(selection: CharacterCardGenerationSourceSelection): CharacterCardGenerationSource[] {
  return (['blueprint', 'premise', 'material', 'character'] as const).filter(source => selection[source])
}

/**
 * The model that will actually receive the text. Surfaced before sending so the
 * author never has to infer the endpoint from settings.
 */
export function classifyCharacterCardGenerationModels<T extends { id: string; name: string; modelName: string; baseUrl: string }>(
  models: readonly T[],
  defaultModelId: string | null,
): { default: T | null; available: readonly T[] } {
  return { default: models.find(model => model.id === defaultModelId) ?? null, available: models }
}
