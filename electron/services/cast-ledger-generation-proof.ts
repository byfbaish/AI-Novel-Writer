import type Database from 'better-sqlite3'
import type { CharacterProposalItem, CharacterProposalSource } from '../../src/shared/character-proposal'
import { canonicalCastLedgerNames, parseCastLedgerCompletion } from '../../src/shared/cast-ledger-completion'
import type { MainGenerationRunHandle } from '../../src/services/generation/generation-runtime'
import { GenerationRunRepository, textHash } from '../repositories/generation-run-repository'
import type { CharacterProposalProof } from './character-proposal-service'

/** ②补全段的主进程操作名：run 的 sourceManifest.operation 必须逐字等于它。 */
export const CAST_LEDGER_COMPLETION_OPERATION = 'cast-ledger-character-completion'
/** authorInputs 里每个待补全名字的输入键前缀：`cast-ledger:name:<index>`。 */
export const CAST_LEDGER_NAME_INPUT_PREFIX = 'cast-ledger:name:'

export type CastLedgerProposalSource = Extract<CharacterProposalSource, { kind: 'cast-ledger' }>
/** 单条产物引用（与 source.artifacts 同一形状）。 */
export interface CastLedgerArtifactReference { artifactId: string; revision: number; textHash: string }

export interface CastLedgerGenerationProof {
  proof: CharacterProposalProof
  currentHandle: MainGenerationRunHandle
  /** 规范化后的 source：names 已排序去重、artifacts 按 artifactId 排序、handle.epoch 归到 run.binding.epoch。
   *  `stage` 必须用它算 proposalBatchId 并原样封存，否则 readEnvelope 重算的 source 与封存值不等。 */
  source: CastLedgerProposalSource
  /** 规范化后的名字（排序），供 pending 冲突检查与 UI 用。 */
  names: string[]
  /** 证明用到的产物文本，按规范化后的 artifacts 顺序。 */
  artifactTexts: string[]
}

const sourceInvalid = () => new Error('CHARACTER_CAST_LEDGER_SOURCE_INVALID')
const artifactInvalid = () => new Error('CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
const namesRequired = () => new Error('CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
const namesMismatch = () => new Error('CHARACTER_CAST_LEDGER_NAMES_MISMATCH')

const MAX_NAMES = 64
const MAX_ARTIFACTS = 64
const HANDLE_KEYS = ['projectId', 'epoch', 'rootActionId', 'runId']
const SOURCE_KEYS = ['kind', 'names', 'handle', 'artifacts']
const ARTIFACT_KEYS = ['artifactId', 'revision', 'textHash']

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const hasForeignKeys = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(value).some(key => !allowed.includes(key))
const setOf = (values: readonly string[]) => new Set(values)

/**
 * 校验 source 形状并取出 1..64 个非空、去重后的名字。
 * 空/重复/超限都属于「调用方给的名单不合法」⇒ NAMES_REQUIRED（与解析器同一语义）。
 */
function readNames(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_NAMES) throw namesRequired()
  const names: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) throw namesRequired()
    names.push(item.trim())
  }
  if (new Set(names).size !== names.length) throw namesRequired()
  return names
}

function readHandle(value: unknown): MainGenerationRunHandle {
  if (!isRecord(value) || hasForeignKeys(value, HANDLE_KEYS)) throw sourceInvalid()
  if (!HANDLE_KEYS.every(key => typeof value[key] === 'string' && (value[key] as string).trim())) throw sourceInvalid()
  return { projectId: value.projectId as string, epoch: value.epoch as string,
    rootActionId: value.rootActionId as string, runId: value.runId as string }
}

function readArtifactReferences(value: unknown): CastLedgerArtifactReference[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ARTIFACTS) throw artifactInvalid()
  const references = value.map(reference => {
    if (!isRecord(reference) || hasForeignKeys(reference, ARTIFACT_KEYS)) throw artifactInvalid()
    const { artifactId, revision, textHash: hash } = reference
    if (typeof artifactId !== 'string' || !artifactId.trim()) throw artifactInvalid()
    if (!Number.isSafeInteger(revision) || (revision as number) < 0) throw artifactInvalid()
    if (typeof hash !== 'string' || !hash) throw artifactInvalid()
    return { artifactId, revision: revision as number, textHash: hash }
  })
  if (new Set(references.map(reference => reference.artifactId)).size !== references.length) throw artifactInvalid()
  // artifactId 排序：source 会进 proposalBatchId，调用方传参顺序不应改变批次身份。
  return references.sort((left, right) => left.artifactId.localeCompare(right.artifactId))
}

/**
 * 从归位表补全运行的冻结产物重算角色提议，并证明 source 与当前库一致。
 *
 * 与 legacy 名单证明同构，区别只有三点：
 *  1. 没有 legacy 的 context 模块 —— 补全运行只有 `run.binding` 这一个 epoch 来源；
 *  2. 名字集合必须与 authorInputs 的 `cast-ledger:name:<index>` 集合相等（模型只被允许为这些名字补全）；
 *  3. sourceHash = textHash([{kind, names}, items])：canonicalSource 只含 kind 与排序后的名字，
 *     产物 id/哈希的变化不会伪造出「资料变了」的结论（资料变没变由 items 决定）。
 */
export function readCastLedgerGenerationProof(db: Database.Database, runs: GenerationRunRepository, projectId: string,
  source: unknown): CastLedgerGenerationProof {
  if (!isRecord(source) || source.kind !== 'cast-ledger' || hasForeignKeys(source, SOURCE_KEYS)) throw sourceInvalid()
  const names = readNames(source.names)
  const requestedHandle = readHandle(source.handle)
  const requestedReferences = readArtifactReferences(source.artifacts)

  const run = runs.get(requestedHandle.runId)
  if (requestedHandle.projectId !== projectId || run.binding.projectId !== projectId
    || requestedHandle.rootActionId !== run.rootActionId || requestedHandle.epoch !== run.binding.epoch) throw sourceInvalid()
  const manifest = run.binding.sourceManifest
  if (manifest.operation !== CAST_LEDGER_COMPLETION_OPERATION) throw sourceInvalid()

  // 名字集合必须与本次运行的作者输入一致：authorInputs 是「允许补全哪些名字」的冻结证据。
  const authorInputs = manifest.authorInputs
  if (!Array.isArray(authorInputs)) throw sourceInvalid()
  const requestedNames = setOf(authorInputs.flatMap((input: unknown) =>
    isRecord(input) && typeof input.id === 'string' && input.id.startsWith(CAST_LEDGER_NAME_INPUT_PREFIX)
      && typeof input.text === 'string' ? [input.text.trim()] : []))
  const namesMatch = requestedNames.size === names.length && names.every(name => requestedNames.has(name))
  if (!namesMatch) throw namesMismatch()

  const artifactTexts = requestedReferences.map(reference => {
    const row = db.prepare('SELECT run_id,attempt_id,status FROM generation_artifacts WHERE artifact_id=?')
      .get(reference.artifactId) as { run_id: string; attempt_id: string; status: string } | undefined
    if (!row || row.run_id !== run.runId || row.status === 'discarded') throw artifactInvalid()
    const receipt = runs.receipt(row.attempt_id), artifact = receipt.artifact
    if (!artifact || artifact.revision !== reference.revision || artifact.textHash !== reference.textHash
      || textHash(artifact.text) !== reference.textHash || receipt.failureCode
      || !['settled', 'unknown'].includes(receipt.attempt.status) || receipt.result?.finishReason !== 'stop') throw artifactInvalid()
    return artifact.text
  })

  const parsed = parseCastLedgerCompletion(artifactTexts, names)
  const parsedNames = setOf(parsed.names)
  if (parsedNames.size !== names.length || !names.every(name => parsedNames.has(name))) throw namesMismatch()
  const canonicalNames = canonicalCastLedgerNames(names)
  const items: Omit<CharacterProposalItem, 'resolution'>[] = parsed.items.map(item => ({ ...item, fields: structuredClone(item.fields) }))
  const model = manifest.modelReceipt as { modelRevision?: string } | undefined
  if (!model?.modelRevision) throw sourceInvalid()
  const currentHandle: MainGenerationRunHandle = { projectId, epoch: run.binding.epoch,
    rootActionId: run.rootActionId, runId: run.runId }
  const canonicalSource = { kind: 'cast-ledger' as const, names: canonicalNames }
  const sourceHash = textHash(JSON.stringify([canonicalSource, items]))
  const proof: CharacterProposalProof = { items, sourceHash, provenance: { kind: 'generated',
    modelRevision: model.modelRevision,
    source: { projectId, epoch: run.binding.epoch, sourceId: run.runId, revision: 0, contentHash: sourceHash } } }
  return { proof, currentHandle, names: canonicalNames, artifactTexts,
    source: { kind: 'cast-ledger', names: canonicalNames, handle: currentHandle,
      artifacts: requestedReferences.map(reference => structuredClone(reference)) } }
}
