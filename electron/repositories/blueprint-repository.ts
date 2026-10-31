/**
 * BlueprintRepository — 章节蓝图 (blueprints 表)
 *
 * 取代旧的 chapter-repository.ts，管理章节的规划元数据。
 */
import { createHash } from 'node:crypto'

import { getProjectDb } from '../database'
import { ensureBaselineBlueprintTables } from '../migrations/baseline-blueprint-schema'
import { CharacterRosterRepository } from './character-roster-repository'
import { hasCharacterIdentitySchema } from './character-repository'
import { findCharacterProposalEvidence } from '../services/character-proposal-service'
import { proveCharacterProposal } from '../services/generation-character-proposal-proof'
import { GenerationRunRepository } from './generation-run-repository'
import { UpstreamRevisionRepository } from './upstream-revision-repository'
import { currentSourceRefValue, hasColumn, parseSourceRefValue } from './derived-source-ref'
import { blueprintCharacterSyncFactError } from '../../src/shared/blueprint-character-sync-evidence'
import { normalizeKeyEvents, type BlueprintKeyEvent } from '../../src/shared/blueprint-key-events'
import { normalizeBlueprintSpaceRefs, type BlueprintSpaceRefRaw } from '../../src/shared/space-time-consistency'
import type { BlueprintNewCharacterCandidate } from '../../src/shared/blueprint-semantic-contract'
import type { DerivedSourceRef, DerivedValidity } from '../../src/shared/upstream-revisions'

/** 蓝图行类型（DB 蛇形命名） */
export interface BlueprintRow {
    chapter_number: number
    title: string
    role: string
    purpose: string
    key_events: string
    /**
     * B′ 双写的机读伴随字段（M08 新增列，默认空串）。
     * 未升级到 v9 的库没有这一列，`SELECT *` 下取到 `undefined` —— 读路径按空处理。
     */
    structured_refs?: string
    characters: string
    suspense_hook: string
    user_guidance: string
    notes: string
    notes_updated_at: string
    created_at: string
    updated_at: string
}

/** 前端使用的驼峰接口 */
export interface BlueprintData {
    chapterNumber: number
    title: string
    role: string
    purpose: string
    /**
     * 结构化事件清单。库中 `key_events` 是 `TEXT`，存 `JSON.stringify` 后的数组
     * （与同表 `characters` 同一惯用法）；读写两侧都过 `normalizeKeyEvents`，
     * 因此旧库的自由文本会被按原规则切成多条，且**永不出现两种格式混存**。
     */
    keyEvents: BlueprintKeyEvent[]
    /**
     * B′ 双写的空间引用清单（`blueprints.structured_refs`，M08 新增列）。
     *
     * 与 `keyEvents` 同一惯用法：库中 `TEXT` 存 `JSON.stringify` 后的数组，读写两侧都过
     * `normalizeBlueprintSpaceRefs`。**可选伴随字段**：没有空间/钟点时为 `[]`，
     * 旧库（无该列）读回也是 `[]` —— 绝不因为缺这个字段而让蓝图不可用（fail-open）。
     */
    structuredRefs?: BlueprintSpaceRefRaw[]
    characters: string[]
    /** Important recurring characters first introduced by this blueprint. */
    newCharacterCandidates?: BlueprintNewCharacterCandidate[]
    /**
     * Relationship payload from the just-generated blueprint. It is not part
     * of the editable blueprints table; an atomic range commit retains it in
     * the immutable operation receipt so character sync can be replayed.
     */
    relationshipHints?: unknown
    suspenseHook: string
    userGuidance: string
    notes: string
    notesUpdatedAt: string
    /**
     * 读取侧挂的判定结果（P2-2 期 2）。**它不是数据**：
     * `normalizeBlueprintForWrite` 会在落库前把它剥掉，所以它进不了
     * `commitPayloadHash`、进不了 `samePersistedBlueprint` 的逐字段比对、
     * 也进不了冻结的 `character_sync_input`。
     *
     * 为什么允许它挂在这个接口上而不是包一层 `{ blueprint, validity }`：
     * 读蓝图有 20 多处调用点，其中绝大多数只关心蓝图本身；包一层会让 20 处
     * 都做一次无意义的解包，且 `['return'][number]`（被共享层的图谱生成引用）
     * 会直接断掉。字段式挂载让「信息能到消费点」这个目标达成，破坏面只剩类型。
     */
    validity?: DerivedValidity
}

export type BlueprintRangeCommitMode = 'full' | 'replace-range'

export interface BlueprintRangeCommitRequest {
    authorRecovery?: { sourceHandle: import('../../src/services/generation/generation-runtime').MainGenerationRunHandle; leaseEpoch: string }
    /** Optional while legacy import consumers await S06D/S12; generated planning supplies it. */
    generationRunHandle?: import('../../src/services/generation/generation-runtime').MainGenerationRunHandle
    generationRequestedRange?: { startChapter: number; endChapter: number }
    mode: BlueprintRangeCommitMode
    operationId: string
    startChapter: number
    endChapter: number
    blueprints: BlueprintData[]
}

export interface BlueprintRangeCommitReceipt {
    authorEdit?: import('../../src/shared/generation-owner-contract').BlueprintAuthorEditReceipt
    generationProgress?: import('../../src/shared/generation-owner-contract').DirectoryGenerationProgress
    mode: BlueprintRangeCommitMode
    operationId: string
    payloadHash: string
    idempotent: boolean
    startChapter: number
    endChapter: number
    chapterNumbers: number[]
    snapshot: BlueprintData[]
    /** Frozen generation facts required to replay character-candidate sync. */
    characterSyncInput: BlueprintData[]
    /** Durable post-commit work item; it survives renderer/app restarts. */
    characterSyncOperation: BlueprintCharacterSyncOperation
}

export interface BlueprintCharacterSyncCompletionReceipt {
    blueprintCommitOperationId: string
    operationId: string
    status: 'committed' | 'already-satisfied' | 'proposal-staged'
    proposalReceipt?: import('../../src/shared/character-proposal').CharacterProposalStageEvidence
    /** Hash/revision evidence only; the authoritative roster snapshot stays in its fact tables. */
    rosterReceipt?: {
        operationId: string
        payloadHash: string
        revision: number
        idempotent: boolean
    }
}

export interface BlueprintCharacterSyncOperation {
    operationId: string
    blueprintCommitOperationId: string
    blueprintCommitPayloadHash: string
    status: 'pending' | 'completed'
    startChapter: number
    endChapter: number
    characterSyncInput: BlueprintData[]
    completionReceipt?: BlueprintCharacterSyncCompletionReceipt
    createdAt: string
    updatedAt: string
    completedAt?: string
}

interface BlueprintCommitOperationRow {
    operation_id: string
    payload_hash: string
    mode: BlueprintRangeCommitMode
    start_chapter: number
    end_chapter: number
    character_sync_input: string
}

interface BlueprintCharacterSyncOperationRow {
    operation_id: string
    blueprint_commit_operation_id: string
    blueprint_commit_payload_hash: string
    status: 'pending' | 'completed'
    start_chapter: number
    end_chapter: number
    character_sync_input: string
    completion_receipt: string | null
    created_at: string
    updated_at: string
    completed_at: string | null
}

interface CharacterRosterOperationEvidenceRow {
    operation_id: string
    payload_hash: string
    committed_revision: number
    projection_hash: string
}

const SHA256_HEX = /^[a-f0-9]{64}$/u

function rowToData(row: BlueprintRow): BlueprintData {
    let chars: string[] = []
    try { chars = JSON.parse(row.characters) } catch { /* 容错 */ }
    const structuredRefs = normalizeBlueprintSpaceRefs(row.structured_refs)
    return {
        chapterNumber: row.chapter_number,
        title: row.title,
        role: row.role,
        purpose: row.purpose,
        keyEvents: normalizeKeyEvents(row.key_events, { chapterNumber: row.chapter_number }),
        // 空则**不出现**这个键：既保持既有蓝图对象的逐键形状不变（回读比对、payload 哈希、
        // character_sync_input 全部照旧），也与同接口 newCharacterCandidates /
        // relationshipHints 的「可选伴随字段」惯例一致。
        ...(structuredRefs.length ? { structuredRefs } : {}),
        characters: chars,
        suspenseHook: row.suspense_hook,
        userGuidance: row.user_guidance,
        notes: row.notes,
        notesUpdatedAt: row.notes_updated_at,
    }
}

function requireProjectDb(): NonNullable<ReturnType<typeof getProjectDb>> {
    const db = getProjectDb()
    if (!db) throw new Error('项目数据库未打开')
    return db
}

function ensureBlueprintCommitSchema(db: NonNullable<ReturnType<typeof getProjectDb>>): void {
    ensureBaselineBlueprintTables(db)
    db.exec(`
      INSERT OR IGNORE INTO blueprint_character_sync_operations (
        operation_id,
        blueprint_commit_operation_id,
        blueprint_commit_payload_hash,
        start_chapter,
        end_chapter,
        character_sync_input
      )
      SELECT
        'blueprint-sync-' || operation_id,
        operation_id,
        payload_hash,
        start_chapter,
        end_chapter,
        character_sync_input
      FROM blueprint_commit_operations;
    `)
}

/** Caller owns the surrounding transaction when composing a multi-fact project clear. */
export function clearBlueprintFactsWithinTransaction(
    db: NonNullable<ReturnType<typeof getProjectDb>>,
): void {
    ensureBlueprintCommitSchema(db)
    db.prepare('DELETE FROM blueprint_character_sync_operations').run()
    db.prepare('DELETE FROM blueprint_commit_operations').run()
    db.prepare('DELETE FROM blueprints').run()
    // 蓝图进度标记（generation_attempts.usage_receipt_json.directoryProgress）与作者保存收据
    // （generation_runs.binding_json.$runEffects.blueprintAuthorEdit）都以
    // blueprint_commit_operations 为权威，并且会在读取时回查那一行做指纹校验。
    // 权威行已被本函数删除，派生引用必须同事务一并删除：否则它们变成悬空引用，
    // 会把项目永久判成「进度账本损坏」，后续每一次蓝图生成都在派发前被拦死
    // （2026-10-11 实机踩到：清空蓝图 → 全量重生成 → generationAttempts=none）。
    // 清理项目生成内容时同样走这条路径，因此两种清空入口不会各留一半。
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='generation_attempts'").get()) {
        db.prepare(`UPDATE generation_attempts SET usage_receipt_json=json_remove(usage_receipt_json,'$.directoryProgress')
            WHERE json_extract(usage_receipt_json,'$.directoryProgress') IS NOT NULL`).run()
        db.prepare(`UPDATE generation_runs SET binding_json=json_remove(binding_json,'$."$runEffects".blueprintAuthorEdit')
            WHERE json_extract(binding_json,'$."$runEffects".blueprintAuthorEdit') IS NOT NULL`).run()
    }
}

function characterSyncOperationId(blueprintCommitOperationId: string): string {
    return `blueprint-sync-${blueprintCommitOperationId}`
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
            .map(([key, entry]) => [key, canonicalize(entry)]),
    )
}

function commitPayloadHash(request: BlueprintRangeCommitRequest): string {
    return createHash('sha256').update(JSON.stringify(canonicalize({
        mode: request.mode,
        startChapter: request.startChapter,
        endChapter: request.endChapter,
        blueprints: request.blueprints,
    }))).digest('hex')
}

function assertExactRange(request: BlueprintRangeCommitRequest): void {
    const { operationId, startChapter, endChapter, blueprints } = request
    if (!operationId.trim()) throw new Error('蓝图提交缺少操作 ID')
    if (request.mode !== 'full' && request.mode !== 'replace-range') {
        throw new Error('蓝图提交模式无效')
    }
    if (
        !Number.isInteger(startChapter)
        || !Number.isInteger(endChapter)
        || startChapter < 1
        || endChapter < startChapter
    ) {
        throw new Error('蓝图提交范围无效')
    }
    if (request.mode === 'full' && startChapter !== 1) {
        throw new Error('全量蓝图提交必须从第 1 章开始')
    }

    const expectedNumbers = Array.from(
        { length: endChapter - startChapter + 1 },
        (_, index) => startChapter + index,
    )
    const actualNumbers = blueprints.map(item => item.chapterNumber)
    if (
        actualNumbers.length !== expectedNumbers.length
        || new Set(actualNumbers).size !== actualNumbers.length
        || expectedNumbers.some(chapterNumber => !actualNumbers.includes(chapterNumber))
    ) {
        throw new Error(`蓝图提交必须完整且唯一地覆盖第 ${startChapter}–${endChapter} 章`)
    }
}

function readExactRange(
    db: NonNullable<ReturnType<typeof getProjectDb>>,
    request: Pick<BlueprintRangeCommitRequest, 'mode' | 'operationId' | 'startChapter' | 'endChapter'>,
): BlueprintData[] {
    const rows = db.prepare(`
      SELECT * FROM blueprints
      WHERE chapter_number BETWEEN ? AND ?
      ORDER BY chapter_number ASC
    `).all(request.startChapter, request.endChapter) as BlueprintRow[]
    const snapshot = rows.map(rowToData)
    assertExactRange({ ...request, blueprints: snapshot })
    return snapshot
}

function readCharacterSyncInput(row: BlueprintCommitOperationRow): BlueprintData[] {
    let parsed: unknown
    try {
        parsed = JSON.parse(row.character_sync_input)
    } catch {
        throw new Error('蓝图提交幂等回执损坏')
    }
    if (!Array.isArray(parsed)) throw new Error('蓝图提交幂等回执格式无效')
    return parsed as BlueprintData[]
}

function parseCharacterSyncInput(serialized: string): BlueprintData[] {
    let parsed: unknown
    try {
        parsed = JSON.parse(serialized)
    } catch {
        throw new Error('蓝图角色同步操作的冻结输入已损坏')
    }
    if (!Array.isArray(parsed)) throw new Error('蓝图角色同步操作的冻结输入格式无效')
    return parsed as BlueprintData[]
}

function parseCompletionReceipt(
    serialized: string | null,
): BlueprintCharacterSyncCompletionReceipt | undefined {
    if (serialized === null) return undefined
    let parsed: unknown
    try {
        parsed = JSON.parse(serialized)
    } catch {
        throw new Error('蓝图角色同步完成回执已损坏')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('蓝图角色同步完成回执格式无效')
    }
    return parsed as BlueprintCharacterSyncCompletionReceipt
}

function rowToCharacterSyncOperation(
    row: BlueprintCharacterSyncOperationRow,
): BlueprintCharacterSyncOperation {
    const completionReceipt = parseCompletionReceipt(row.completion_receipt)
    if (row.status === 'pending' && completionReceipt) {
        throw new Error('待处理蓝图角色同步操作不应包含完成回执')
    }
    if (row.status === 'completed' && !completionReceipt) {
        throw new Error('已完成蓝图角色同步操作缺少完成回执')
    }
    return {
        operationId: row.operation_id,
        blueprintCommitOperationId: row.blueprint_commit_operation_id,
        blueprintCommitPayloadHash: row.blueprint_commit_payload_hash,
        status: row.status,
        startChapter: row.start_chapter,
        endChapter: row.end_chapter,
        characterSyncInput: parseCharacterSyncInput(row.character_sync_input),
        ...(completionReceipt ? { completionReceipt } : {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    }
}

function readCharacterSyncOperation(
    db: NonNullable<ReturnType<typeof getProjectDb>>,
    operationId: string,
): BlueprintCharacterSyncOperation | null {
    const row = db.prepare(`
      SELECT
        operation_id,
        blueprint_commit_operation_id,
        blueprint_commit_payload_hash,
        status,
        start_chapter,
        end_chapter,
        character_sync_input,
        completion_receipt,
        created_at,
        updated_at,
        completed_at
      FROM blueprint_character_sync_operations
      WHERE operation_id = ?
    `).get(operationId) as BlueprintCharacterSyncOperationRow | undefined
    return row ? rowToCharacterSyncOperation(row) : null
}

function authoritativeCharacterSyncCompletionReceipt(
    db: NonNullable<ReturnType<typeof getProjectDb>>,
    operation: BlueprintCharacterSyncOperation,
): BlueprintCharacterSyncCompletionReceipt {
    if (hasCharacterIdentitySchema(db)) {
        const proposalReceipt = findCharacterProposalEvidence(db, { kind: 'directory', operationId: operation.operationId },
          (projectId, source) => proveCharacterProposal(db, new GenerationRunRepository(() => db), projectId, source, false, () => {}))
        return { blueprintCommitOperationId: operation.blueprintCommitOperationId, operationId: operation.operationId, status: 'proposal-staged', proposalReceipt }
    }
    const roster = CharacterRosterRepository.read()
    if (roster.status !== 'ready' && roster.status !== 'empty') {
        throw new Error('角色名单当前不可验证，已拒绝完成蓝图角色同步')
    }
    const factError = blueprintCharacterSyncFactError(operation.characterSyncInput, roster.entries)
    if (factError) throw new Error(`${factError}，已拒绝完成蓝图角色同步`)

    const rosterOperation = db.prepare(`
      SELECT operation_id, payload_hash, committed_revision, projection_hash
      FROM character_roster_operations
      WHERE operation_id = ?
    `).get(operation.operationId) as CharacterRosterOperationEvidenceRow | undefined
    if (!rosterOperation) {
        return {
            blueprintCommitOperationId: operation.blueprintCommitOperationId,
            operationId: operation.operationId,
            status: 'already-satisfied',
        }
    }
    if (
        rosterOperation.operation_id !== operation.operationId
        || rosterOperation.committed_revision < 1
        || rosterOperation.committed_revision > roster.revision
        || !SHA256_HEX.test(rosterOperation.payload_hash)
        || !SHA256_HEX.test(rosterOperation.projection_hash)
        || (
            rosterOperation.committed_revision === roster.revision
            && rosterOperation.projection_hash !== roster.projectionHash
        )
    ) {
        throw new Error('角色名单操作证据与当前事实不匹配，已拒绝完成蓝图角色同步')
    }
    return {
        blueprintCommitOperationId: operation.blueprintCommitOperationId,
        operationId: operation.operationId,
        status: 'committed',
        rosterReceipt: {
            operationId: rosterOperation.operation_id,
            payloadHash: rosterOperation.payload_hash,
            revision: rosterOperation.committed_revision,
            idempotent: false,
        },
    }
}

function assertAuthoritativeCharacterSyncCompletion(
    db: NonNullable<ReturnType<typeof getProjectDb>>,
    operation: BlueprintCharacterSyncOperation,
): void {
    if (operation.status !== 'completed' || !operation.completionReceipt) return
    const authoritative = authoritativeCharacterSyncCompletionReceipt(db, operation)
    if (
        JSON.stringify(canonicalize(operation.completionReceipt))
        !== JSON.stringify(canonicalize(authoritative))
    ) {
        throw new Error('蓝图角色同步完成回执与角色名单事实不匹配')
    }
}

function snapshotWithCharacterSyncFacts(
    persisted: readonly BlueprintData[],
    characterSyncInput: readonly BlueprintData[],
): BlueprintData[] {
    const inputByChapter = new Map(
        characterSyncInput.map(blueprint => [blueprint.chapterNumber, blueprint] as const),
    )
    return persisted.map((blueprint) => {
        const input = inputByChapter.get(blueprint.chapterNumber)
        if (!input) return blueprint
        return {
            ...blueprint,
            ...(input.relationshipHints === undefined ? {} : { relationshipHints: input.relationshipHints }),
            ...(input.newCharacterCandidates === undefined
                ? {}
                : { newCharacterCandidates: input.newCharacterCandidates }),
        }
    })
}

function samePersistedBlueprint(left: BlueprintData, right: BlueprintData): boolean {
    return left.chapterNumber === right.chapterNumber
        && left.title === right.title
        && left.role === right.role
        && left.purpose === right.purpose
        && JSON.stringify(left.keyEvents) === JSON.stringify(right.keyEvents)
        && JSON.stringify(left.structuredRefs ?? []) === JSON.stringify(right.structuredRefs ?? [])
        && JSON.stringify(left.characters) === JSON.stringify(right.characters)
        && left.suspenseHook === right.suspenseHook
        && left.userGuidance === right.userGuidance
        && left.notes === right.notes
        && left.notesUpdatedAt === right.notesUpdatedAt
}

/**
 * 唯一的写入归一化点：任何来源（模型 / 编辑器 Textarea / agent 提案 / 导入）都先过
 * `normalizeKeyEvents` / `normalizeBlueprintSpaceRefs` 再落库，因此这两列里永远只有
 * JSON 数组一种形态。
 */
function normalizeBlueprintForWrite(blueprint: BlueprintData): BlueprintData {
    // 语义项的字段名是模型侧的 `spaceRefs`（与提示词同字），存储列叫 `structured_refs`。
    // `ChapterBlueprint = BlueprintData` 的别名 + `persistedBlueprint` 的展开会让语义项
    // 带 `spaceRefs` 抵达这里（例如 `commitBlueprintAuthorEdit` 的 author 路径），因此在这个
    // **唯一写入归一化点**上同时接受两个名字 —— 否则就得在每个调用点各写一次换名。
    // `validity` 是读取侧挂的判定结果，**必须剥掉**：它若跟着数据对象走，
    // 同一个操作在不同时刻重放会算出不同的 `commitPayloadHash`（幂等重放会被判
    // 「操作 ID 已被用于不同的蓝图提交」），也会污染冻结的 `character_sync_input`。
    const { structuredRefs: stored, spaceRefs: alias, validity: _readOnly, ...rest } =
        blueprint as BlueprintData & { spaceRefs?: unknown }
    const fromStored = normalizeBlueprintSpaceRefs(stored)
    const structuredRefs = fromStored.length ? fromStored : normalizeBlueprintSpaceRefs(alias)
    return {
        ...rest,
        keyEvents: normalizeKeyEvents(blueprint.keyEvents, { chapterNumber: blueprint.chapterNumber }),
        // 稀疏：没有空间引用时**不写这个键**，否则每个既有蓝图都会多出一个 `structuredRefs: []`，
        // 从而改变 commitPayloadHash / character_sync_input 的字节形态（幂等重放与冻结事实的基准）。
        ...(structuredRefs.length ? { structuredRefs } : {}),
    }
}

/**
 * `structured_refs` 是 M08 新增列、`source_ref` 是 M25 新增列。**未升级的库**
 * （以及只建基线表的测试夹具）没有它们，此时不能写 —— 否则整个蓝图提交会因
 * `no such column` 失败。
 *
 * 两列来自**同一次** `PRAGMA table_info(blueprints)`，所以合并成一个探针：
 * 分开探就是白跑一遍系统目录查询。批量入口（`upsertMany` / `commitRange`）
 * 把结果在循环外算好传下来，一段 10 章的保存因此只探 1 次。
 */
export interface BlueprintWriteColumns {
    structuredRefs: boolean
    sourceRef: boolean
}

export function probeBlueprintWriteColumns(
    db: NonNullable<ReturnType<typeof getProjectDb>>,
): BlueprintWriteColumns {
    const names = new Set(
        (db.prepare('PRAGMA table_info(blueprints)').all() as Array<{ name: string }>)
            .map(column => column.name),
    )
    return { structuredRefs: names.has('structured_refs'), sourceRef: names.has('source_ref') }
}

export class BlueprintRepository {
    /**
     * 一次读出全部蓝图的来源快照（`章号 → 快照`），给读取侧逐行判定用。
     *
     * 一条 SQL 取完，不在逐行循环里查：`get-all` 可能返回上千行，每行再查一次
     * 就是上千次往返（设计稿 §5.6）。列不在（未升到 v26 / 只建基线表的夹具）
     * ⇒ 空 Map ⇒ 调用方查不到就判 `legacy`，与「这一行确实没记过来源」同解。
     */
    static readSourceRefs(db = requireProjectDb()): Map<number, DerivedSourceRef | null> {
        const map = new Map<number, DerivedSourceRef | null>()
        if (!hasColumn(db, 'blueprints', 'source_ref')) return map
        const rows = db.prepare(
            'SELECT chapter_number, source_ref FROM blueprints',
        ).all() as Array<{ chapter_number: number; source_ref: string }>
        for (const row of rows) map.set(row.chapter_number, parseSourceRefValue(row.source_ref))
        return map
    }

    /** 单章来源快照。行不存在 / 列不存在 / 解析失败一律 `null`（⇒ `legacy`）。 */
    static readSourceRef(chapterNumber: number, db = requireProjectDb()): DerivedSourceRef | null {
        if (!hasColumn(db, 'blueprints', 'source_ref')) return null
        const raw = db.prepare(
            'SELECT source_ref FROM blueprints WHERE chapter_number = ?',
        ).pluck().get(chapterNumber)
        return parseSourceRefValue(raw)
    }

    /** 获取所有蓝图（按章节号排序） */
    static getAll(db = requireProjectDb()): BlueprintData[] {

        const rows = db.prepare(
            'SELECT * FROM blueprints ORDER BY chapter_number ASC'
        ).all() as BlueprintRow[]

        return rows.map(rowToData)
    }

    /** 获取单个蓝图 */
    static getByChapter(chapterNumber: number): BlueprintData | null {
        const db = requireProjectDb()

        const row = db.prepare(
            'SELECT * FROM blueprints WHERE chapter_number = ?'
        ).get(chapterNumber) as BlueprintRow | undefined

        return row ? rowToData(row) : null
    }

    /** 获取蓝图总数 */
    static count(): number {
        const db = requireProjectDb()

        const row = db.prepare(
            'SELECT COUNT(*) as cnt FROM blueprints'
        ).get() as { cnt: number }

        return row.cnt
    }

    /**
     * 插入或更新蓝图。
     *
     * `options.sourceRev` 是**本次改动**把大纲推到的那一版（`bump` 的返回值）。
     * 不给（或给 `null`）⇒ **不碰 `source_ref` 列**，库里已有值原样保留 ——
     * 导入、迁移、以及"只补一个字段"的写入都不该抹掉既有来源。
     *
     * 为什么来源不放进 `BlueprintData`：数据对象有三个字节基准
     * （`commitPayloadHash` 对 `blueprints` 做 sha256、`samePersistedBlueprint`
     * 逐字段回读比对、`character_sync_input` 冻结整批），塞进去会同时改掉三个。
     * 详见设计稿 §四.3。
     */
    static upsert(
        data: BlueprintData,
        db = requireProjectDb(),
        options?: {
            sourceRev?: number | null
            columns?: BlueprintWriteColumns
            bumpOutline?: boolean
        },
    ): void {

        if (options?.bumpOutline) {
            // 「单章卡保存 = 改上游」的唯一入口（`db:blueprint-upsert`）。
            //
            // 事务边界放在这里而不是 handler：handler 那一层的守卫是**项目上下文**
            // （`assertRequiredExpectedProjectPath`），库是否就绪由 `requireProjectDb()`
            // 判。两处各判一次会出现两个错误码表达同一件事，而仓储是唯一知道
            // 「版本 +1 必须与内容写入原子」的地方（见 `upstream-revision-repository`
            // 文件头「为什么 bump 不自己开事务」）。
            db.transaction(() => {
                const outlineRev = UpstreamRevisionRepository.bump(
                    { domain: 'outline', changedChapters: [data.chapterNumber] },
                    db,
                )
                BlueprintRepository.upsert(data, db, {
                    sourceRev: outlineRev,
                    columns: probeBlueprintWriteColumns(db),
                })
            }).immediate()
            return
        }

        const blueprint = normalizeBlueprintForWrite(data)
        // 列集在一处生成，避免"INSERT 有这列、UPDATE SET 漏了它"的静默不同步。
        const writeColumns = options?.columns ?? probeBlueprintWriteColumns(db)
        const withStructuredRefs = writeColumns.structuredRefs
        // `bump` 返回 `null` = 这张库还没有版本表（未升到 v26）⇒ 不写来源列，
        // 派生留空判 `legacy`。写成 0 会把"库未升级"伪装成"最新"（G6）。
        const sourceRev = options?.sourceRev
        const writeSourceRef = typeof sourceRev === 'number'
            && Number.isSafeInteger(sourceRev)
            && writeColumns.sourceRef
        const columns = ['chapter_number', 'title', 'role', 'purpose', 'key_events',
            ...(withStructuredRefs ? ['structured_refs'] : []), 'characters',
            'suspense_hook', 'user_guidance', 'notes', 'notes_updated_at',
            ...(writeSourceRef ? ['source_ref'] : [])]
        const values = [
            blueprint.chapterNumber,
            blueprint.title,
            blueprint.role,
            blueprint.purpose,
            JSON.stringify(blueprint.keyEvents),
            ...(withStructuredRefs ? [JSON.stringify(blueprint.structuredRefs ?? [])] : []),
            JSON.stringify(blueprint.characters),
            blueprint.suspenseHook,
            blueprint.userGuidance,
            blueprint.notes,
            blueprint.notesUpdatedAt,
            ...(writeSourceRef ? [currentSourceRefValue(db, 'chapter-plan', sourceRev)] : []),
        ]
        db.prepare(`
      INSERT INTO blueprints (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})
      ON CONFLICT(chapter_number) DO UPDATE SET
        ${columns.filter(column => column !== 'chapter_number')
            .map(column => `${column} = excluded.${column}`).join(',\n        ')},
        updated_at = datetime('now')
    `).run(...values)
    }

    /**
     * 批量插入/更新蓝图（事务）。
     *
     * **版本只 bump 一次**（整段章号作为章集），循环内每行只写来源不 bump ——
     * 否则一次「保存全部」会推进 N 版，`changed_chapters` 立刻长到溢出。
     */
    static upsertMany(items: BlueprintData[]): void {
        const db = requireProjectDb()

        const tx = db.transaction(() => {
            const chapters = items
                .map(item => item.chapterNumber)
                .filter(chapter => Number.isSafeInteger(chapter) && chapter > 0)
            const outlineRev = UpstreamRevisionRepository.bump(
                { domain: 'outline', changedChapters: chapters },
                db,
            )
            const columns = probeBlueprintWriteColumns(db)
            for (const item of items) {
                // **每一行**都要写这次的新 rev，不是只有第一行：只写第一行会让
                // 其余行判 `(旧,新]` ∩ 本行 ≠ ∅ ⇒ 刚保存的卡立刻被拒绝。
                BlueprintRepository.upsert(item, db, { sourceRev: outlineRev, columns })
            }
        })
        tx()
    }

    /** Pure read-back of the operation ledger and its currently bound range/sync evidence. */
    static getCommittedRangeOperation(operationId: string, db = requireProjectDb()): BlueprintRangeCommitReceipt | null {
        if (!operationId.trim()) throw new Error('蓝图提交缺少操作 ID')
        ensureBlueprintCommitSchema(db)
        const operation = db.prepare(`
          SELECT operation_id, payload_hash, mode, start_chapter, end_chapter, character_sync_input
          FROM blueprint_commit_operations
          WHERE operation_id = ?
        `).get(operationId) as BlueprintCommitOperationRow | undefined
        if (!operation) return null
        const characterSyncInput = readCharacterSyncInput(operation)
        const persisted = readExactRange(db, {
            mode: operation.mode,
            operationId: operation.operation_id,
            startChapter: operation.start_chapter,
            endChapter: operation.end_chapter,
        })
        const snapshot = snapshotWithCharacterSyncFacts(persisted, characterSyncInput)
        const characterSyncOperation = readCharacterSyncOperation(
            db,
            characterSyncOperationId(operation.operation_id),
        )
        if (!characterSyncOperation) throw new Error('蓝图提交缺少可恢复的角色同步操作')
        assertAuthoritativeCharacterSyncCompletion(db, characterSyncOperation)
        return {
            mode: operation.mode,
            operationId: operation.operation_id,
            payloadHash: operation.payload_hash,
            idempotent: false,
            startChapter: operation.start_chapter,
            endChapter: operation.end_chapter,
            chapterNumbers: snapshot.map(blueprint => blueprint.chapterNumber),
            snapshot,
            characterSyncInput,
            characterSyncOperation,
        }
    }

    /** 完整逻辑范围只提交一次，并在同一事务内回读验证后返回收据。 */
    static commitRange(request: BlueprintRangeCommitRequest, assertGenerationSources?: () => void, db = requireProjectDb()): BlueprintRangeCommitReceipt {
        // 提交前统一归一化：payload 哈希、落库、回读比对、冻结的 character_sync_input
        // 全部基于同一形态，否则旧调用方传入的字符串 keyEvents 会与回读的数组不等。
        const normalizedRequest: BlueprintRangeCommitRequest = {
            ...request,
            blueprints: request.blueprints.map(normalizeBlueprintForWrite),
        }
        assertExactRange(normalizedRequest)
        ensureBlueprintCommitSchema(db)
        const payloadHash = commitPayloadHash(normalizedRequest)
        const tx = db.transaction(() => {
            const existingOperation = db.prepare(`
              SELECT operation_id, payload_hash, mode, start_chapter, end_chapter, character_sync_input
              FROM blueprint_commit_operations
              WHERE operation_id = ?
            `).get(request.operationId) as BlueprintCommitOperationRow | undefined
            if (existingOperation) {
                if (existingOperation.payload_hash !== payloadHash) {
                    throw new Error('操作 ID 已被用于不同的蓝图提交，已拒绝覆盖')
                }
                const characterSyncInput = readCharacterSyncInput(existingOperation)
                const persisted = readExactRange(db, {
                    mode: existingOperation.mode,
                    operationId: existingOperation.operation_id,
                    startChapter: existingOperation.start_chapter,
                    endChapter: existingOperation.end_chapter,
                })
                const snapshot = snapshotWithCharacterSyncFacts(persisted, characterSyncInput)
                const characterSyncOperation = readCharacterSyncOperation(
                    db,
                    characterSyncOperationId(existingOperation.operation_id),
                )
                if (!characterSyncOperation) throw new Error('蓝图提交缺少可恢复的角色同步操作')
                assertAuthoritativeCharacterSyncCompletion(db, characterSyncOperation)
                return {
                    mode: existingOperation.mode,
                    operationId: existingOperation.operation_id,
                    payloadHash,
                    idempotent: true,
                    startChapter: existingOperation.start_chapter,
                    endChapter: existingOperation.end_chapter,
                    chapterNumbers: snapshot.map(blueprint => blueprint.chapterNumber),
                    snapshot,
                    characterSyncInput,
                    characterSyncOperation,
                }
            }

            // An acknowledged operation is read-only on replay. New effects must
            // revalidate frozen sources inside this same write transaction.
            assertGenerationSources?.()
            if (normalizedRequest.mode === 'full') {
                db.prepare(
                    'DELETE FROM blueprints WHERE chapter_number < ? OR chapter_number > ?',
                ).run(normalizedRequest.startChapter, normalizedRequest.endChapter)
            }
            // 「手改蓝图 = 改上游」：两条语义（模型整批 / 作者恢复）共用这根管道，
            // 都在这里一次 bump。幂等重放分支在上面就返回了、不写行也不 bump ——
            // 重放没有产生新内容，版本不该动。
            //
            // `full` 必须用 `replace`（整列清空 = 全部章都算改过），**不能用本批章号
            // 收窄**：上面那条 DELETE 会把区间外的旧蓝图删掉，而那些章若还留着派生
            // （正文草稿、剧情树），它们依赖的蓝图已经不存在了，却会因为
            // `(have, need]` ∩ 自己的章号 = ∅ 被判 valid —— 静默消费已删数据。
            const outlineRev = UpstreamRevisionRepository.bump(
                {
                    domain: 'outline',
                    changedChapters: normalizedRequest.blueprints.map(item => item.chapterNumber),
                    ...(normalizedRequest.mode === 'full' ? { mode: 'replace' as const } : {}),
                },
                db,
            )
            const columns = probeBlueprintWriteColumns(db)
            for (const blueprint of normalizedRequest.blueprints) {
                BlueprintRepository.upsert(blueprint, db, { sourceRev: outlineRev, columns })
            }

            const persisted = readExactRange(db, normalizedRequest)

            const expectedByChapter = new Map(
                normalizedRequest.blueprints.map(blueprint => [blueprint.chapterNumber, blueprint] as const),
            )
            for (const saved of persisted) {
                const expected = expectedByChapter.get(saved.chapterNumber)
                if (!expected || !samePersistedBlueprint(saved, expected)) {
                    throw new Error(`蓝图提交回读不一致：第 ${saved.chapterNumber} 章`)
                }
            }

            const characterSyncInput = normalizedRequest.blueprints.map(blueprint => ({ ...blueprint }))
            db.prepare(`
              INSERT INTO blueprint_commit_operations (
                operation_id, payload_hash, mode, start_chapter, end_chapter, character_sync_input
              ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                normalizedRequest.operationId,
                payloadHash,
                normalizedRequest.mode,
                normalizedRequest.startChapter,
                normalizedRequest.endChapter,
                JSON.stringify(characterSyncInput),
            )
            const syncOperationId = characterSyncOperationId(normalizedRequest.operationId)
            db.prepare(`
              INSERT INTO blueprint_character_sync_operations (
                operation_id,
                blueprint_commit_operation_id,
                blueprint_commit_payload_hash,
                start_chapter,
                end_chapter,
                character_sync_input
              ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                syncOperationId,
                normalizedRequest.operationId,
                payloadHash,
                normalizedRequest.startChapter,
                normalizedRequest.endChapter,
                JSON.stringify(characterSyncInput),
            )
            const snapshot = snapshotWithCharacterSyncFacts(persisted, characterSyncInput)
            const characterSyncOperation = readCharacterSyncOperation(db, syncOperationId)
            if (!characterSyncOperation) throw new Error('蓝图提交未创建可恢复的角色同步操作')

            return {
                mode: normalizedRequest.mode,
                operationId: normalizedRequest.operationId,
                payloadHash,
                idempotent: false,
                startChapter: normalizedRequest.startChapter,
                endChapter: normalizedRequest.endChapter,
                chapterNumbers: snapshot.map(blueprint => blueprint.chapterNumber),
                snapshot,
                characterSyncInput,
                characterSyncOperation,
            }
        })
        return tx.immediate()
    }

    /** Lists durable post-commit work that can be resumed after an app restart. */
    static listPendingCharacterSyncOperations(): BlueprintCharacterSyncOperation[] {
        const db = requireProjectDb()
        ensureBlueprintCommitSchema(db)
        const rows = db.prepare(`
          SELECT
            operation_id,
            blueprint_commit_operation_id,
            blueprint_commit_payload_hash,
            status,
            start_chapter,
            end_chapter,
            character_sync_input,
            completion_receipt,
            created_at,
            updated_at,
            completed_at
          FROM blueprint_character_sync_operations
          WHERE status = 'pending'
          ORDER BY created_at ASC, operation_id ASC
        `).all() as BlueprintCharacterSyncOperationRow[]
        return rows.map(rowToCharacterSyncOperation)
    }

    /**
     * 全量列举，含已完成的操作。`completion` 只说明"提议已暂存过"，不说明"作者已处理"——
     * 蓝图冻结输入里声明的候选在作者给出结论（建卡 / 功能配角）之前始终是待办事实，
     * 「AI 生成角色卡」的提取必须看到它们，否则批次一旦暂存过，该入口就永久失效。
     */
    static listAllCharacterSyncOperations(): BlueprintCharacterSyncOperation[] {
        const db = requireProjectDb()
        ensureBlueprintCommitSchema(db)
        const rows = db.prepare(`
          SELECT
            operation_id,
            blueprint_commit_operation_id,
            blueprint_commit_payload_hash,
            status,
            start_chapter,
            end_chapter,
            character_sync_input,
            completion_receipt,
            created_at,
            updated_at,
            completed_at
          FROM blueprint_character_sync_operations
          ORDER BY created_at ASC, operation_id ASC
        `).all() as BlueprintCharacterSyncOperationRow[]
        return rows.map(rowToCharacterSyncOperation)
    }

    static getCharacterSyncOperation(operationId: string): BlueprintCharacterSyncOperation | null {
        if (!operationId.trim()) throw new Error('蓝图角色同步操作 ID 不能为空')
        const db = requireProjectDb()
        ensureBlueprintCommitSchema(db)
        const operation = readCharacterSyncOperation(db, operationId)
        if (operation) assertAuthoritativeCharacterSyncCompletion(db, operation)
        return operation
    }

    static completeCharacterSyncOperation(
        operationId: string,
    ): BlueprintCharacterSyncOperation {
        if (!operationId.trim()) throw new Error('蓝图角色同步操作 ID 不能为空')
        const db = requireProjectDb()
        ensureBlueprintCommitSchema(db)
        const tx = db.transaction(() => {
            const operation = readCharacterSyncOperation(db, operationId)
            if (!operation) throw new Error('待处理蓝图角色同步操作不存在')
            if (operation.status === 'completed') {
                assertAuthoritativeCharacterSyncCompletion(db, operation)
                return operation
            }
            const completionReceipt = authoritativeCharacterSyncCompletionReceipt(db, operation)
            const result = db.prepare(`
              UPDATE blueprint_character_sync_operations
              SET
                status = 'completed',
                completion_receipt = ?,
                completed_at = datetime('now'),
                updated_at = datetime('now')
              WHERE operation_id = ? AND status = 'pending'
            `).run(JSON.stringify(canonicalize(completionReceipt)), operationId)
            if (result.changes !== 1) throw new Error('蓝图角色同步完成状态更新失败')
            const completed = readCharacterSyncOperation(db, operationId)
            if (!completed || completed.status !== 'completed' || !completed.completionReceipt) {
                throw new Error('蓝图角色同步完成回执回读失败')
            }
            assertAuthoritativeCharacterSyncCompletion(db, completed)
            return completed
        })
        return tx()
    }

    /** 删除蓝图 */
    static delete(chapterNumber: number): void {
        const db = requireProjectDb()

        db.prepare('DELETE FROM blueprints WHERE chapter_number = ?').run(chapterNumber)
    }

    /** 删除所有章节蓝图 */
    static clearAll(): void {
        const db = requireProjectDb()
        const tx = db.transaction(() => {
            clearBlueprintFactsWithinTransaction(db)
        })
        tx()
    }

    /** 仅更新 notes 字段 */
    static updateNotes(chapterNumber: number, notes: string, db = requireProjectDb()): boolean {

        const result = db.prepare(`
      UPDATE blueprints
      SET notes = ?, notes_updated_at = datetime('now'), updated_at = datetime('now')
      WHERE chapter_number = ?
    `).run(notes, chapterNumber)
        return result.changes > 0
    }
}
