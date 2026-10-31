import { createRequire } from 'node:module'
import { createMigrationRegistry, type MigrationRegistry, type SchemaReader } from './registry'
import { createM01Migration, M01_GENERATION_SQL } from './m01-generation-runs'
import { applyM02CharacterIdentity, createM02Migration, verifyM02CharacterIdentity } from './m02-character-identity'
import { applyM03ReviewCycle, applyM06ReviewCycleMerge, createM03Migration, createM06Migration,
  verifyM03ReviewCycle } from './m03-review-cycle'
import { applyM04ImportEffectLedger, createM04Migration } from './m04-import-effect-ledger'
import { applyM05CharacterAssets, createM05Migration } from './m05-character-assets'
import { createM00Migration } from './m00-baseline'
import { applyM07PlotStructurePlan, createM07Migration, verifyM07PlotStructurePlan } from './m07-plot-structure-plan'
import { applyM08StructuredRefsAndCastDecisions, createM08Migration, verifyM08StructuredRefsAndCastDecisions } from './m08-structured-refs-and-cast-decisions'
import { applyM09RhythmProfile, createM09Migration, verifyM09RhythmProfile } from './m09-rhythm-profile'
import { applyM10StoryDay, createM10Migration, verifyM10StoryDay } from './m10-story-day'
import { applyM11ResourceLedger, createM11Migration, verifyM11ResourceLedger } from './m11-resource-ledger'
import { applyM12ChapterStalenessAck, createM12Migration, verifyM12ChapterStalenessAck } from './m12-chapter-staleness-ack'
import { applyM13ContinuityChangeLog, createM13Migration, verifyM13ContinuityChangeLog } from './m13-continuity-change-log'
import { applyM14KeyItems, createM14Migration, verifyM14KeyItems } from './m14-key-items'
import { applyM15InstitutionCadences, createM15Migration, verifyM15InstitutionCadences } from './m15-institution-cadences'
import { applyM16KnowledgeStates, createM16Migration, verifyM16KnowledgeStates } from './m16-knowledge-states'
import { applyM17PowerAbilities, createM17Migration, verifyM17PowerAbilities } from './m17-power-abilities'
import { applyM18VolumeHandoffs, createM18Migration, verifyM18VolumeHandoffs } from './m18-volume-handoffs'
import { applyM19VolumeStructure, createM19Migration, verifyM19VolumeStructure } from './m19-volume-structure'
import { applyM20ReviewClass, createM20Migration, verifyM20ReviewClass } from './m20-review-class'
import { applyM21Secrets, createM21Migration, verifyM21Secrets } from './m21-secrets'
import { applyM22KnowledgeCandidates, createM22Migration, verifyM22KnowledgeCandidates } from './m22-knowledge-candidates'
import { applyM23DeletionKeepDraft, createM23Migration, verifyM23DeletionKeepDraft } from './m23-deletion-keep-draft'
import { applyM24UpstreamRevisions, createM24Migration, verifyM24UpstreamRevisions } from './m24-upstream-revisions'
import { applyM25DerivedSourceRef, createM25Migration, verifyM25DerivedSourceRef } from './m25-derived-source-ref'
import { applyM26SynopsisSourceRef, createM26Migration, verifyM26SynopsisSourceRef } from './m26-synopsis-source-ref'
import { initializeLegacyBaselineSchema, applyBaselineTables } from './baseline-schema'
import { ensureBaselineBlueprintTables } from './baseline-blueprint-schema'
import { SqliteSchemaAdapter, sqliteSchemaFingerprint } from './sqlite-schema-adapter'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')
export const CURRENT_DESKTOP_SCHEMA_VERSION = 27
let installed: MigrationRegistry | undefined

function installKnownDonorAvatarColumn(db: import('better-sqlite3').Database): void {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='characters'").get() as { sql: string }
  const marker = "      cs_location TEXT DEFAULT '',"
  if (!row.sql.includes(marker)) throw new Error('DONOR_CHARACTER_SCHEMA_MARKER_MISSING')
  const donorSql = row.sql.replace(marker, "      avatar TEXT NOT NULL DEFAULT '',\n" + marker)
  db.exec('ALTER TABLE characters RENAME TO characters_without_avatar')
  db.exec(donorSql)
  db.exec('DROP TABLE characters_without_avatar')
}

/** Single installed desktop lane. Its source catalog is generated solely from
 * the checked-in baseline DDL in an empty in-memory DB, never from author files.
 * S04 recognizes the current baseline with/without the two legacy lazy tables.
 * Historical binaries and other schema variants require their own qualification.
 */
export function getDesktopMigrationRegistry(): MigrationRegistry {
  if (installed) return installed
  const reference = new Database(':memory:'), donor = new Database(':memory:')
  try {
    const references = [reference, donor]
    for (const db of references) { db.pragma('foreign_keys = ON'); initializeLegacyBaselineSchema(db) }
    installKnownDonorAvatarColumn(donor)
    const schemas = (version: number) => references.map(db => ({ version, fingerprint: sqliteSchemaFingerprint(db) }))
    const sourceSchemas = schemas(0)
    for (const db of references) ensureBaselineBlueprintTables(db)
    const baselineSchemas = schemas(1), baselineFingerprints = new Set(baselineSchemas.map(item => item.fingerprint))
    const native = (db: SchemaReader) => {
      if (!(db instanceof SqliteSchemaAdapter)) throw new Error('SQLITE_SCHEMA_ADAPTER_REQUIRED')
      return db.database
    }
    const m00 = createM00Migration({
      applyKnownBaseline(db) {
        applyBaselineTables(native(db))
        ensureBaselineBlueprintTables(native(db))
      },
      verifyKnownBaseline(db) { return baselineFingerprints.has(sqliteSchemaFingerprint(native(db))) },
    })
    for (const db of references) db.exec(M01_GENERATION_SQL)
    const generationSchemas = schemas(2), generationFingerprints = new Set(generationSchemas.map(item => item.fingerprint))
    const m01 = createM01Migration(db => generationFingerprints.has(sqliteSchemaFingerprint(native(db))))
    for (const db of references) db.transaction(() => applyM02CharacterIdentity(db))()
    const identitySchemas = schemas(3), identityFingerprints = new Set(identitySchemas.map(item => item.fingerprint))
    const m02 = createM02Migration({ database: native, verifyKnownSchema: db => identityFingerprints.has(sqliteSchemaFingerprint(native(db))) })
    for (const db of references) db.transaction(() => applyM03ReviewCycle(db))()
    const reviewCycleSchemas = schemas(4), reviewCycleFingerprints = new Set(reviewCycleSchemas.map(item => item.fingerprint))
    const m03 = createM03Migration({ database: native,
      verifyKnownSchema: db => reviewCycleFingerprints.has(sqliteSchemaFingerprint(native(db))) && verifyM02CharacterIdentity(native(db)) })
    for (const db of references) db.transaction(() => applyM04ImportEffectLedger(db))()
    const importEffectSchemas = schemas(5), importEffectFingerprints = new Set(importEffectSchemas.map(item => item.fingerprint))
    const m04 = createM04Migration({ database: native,
      verifyKnownSchema: db => importEffectFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM02CharacterIdentity(native(db)) && verifyM03ReviewCycle(native(db)) })
    for (const db of references) db.transaction(() => applyM05CharacterAssets(db))()
    const characterAssetSchemas = schemas(6), characterAssetFingerprints = new Set(characterAssetSchemas.map(item => item.fingerprint))
    const m05 = createM05Migration({ database: native,
      verifyKnownSchema: db => characterAssetFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM02CharacterIdentity(native(db)) && verifyM03ReviewCycle(native(db)) })
    for (const db of references) db.transaction(() => applyM06ReviewCycleMerge(db))()
    const mergeSnapshotSchemas = schemas(7), mergeSnapshotFingerprints = new Set(mergeSnapshotSchemas.map(item => item.fingerprint))
    const m06 = createM06Migration({ database: native,
      verifyKnownSchema: db => mergeSnapshotFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM02CharacterIdentity(native(db)) })
    for (const db of references) db.transaction(() => applyM07PlotStructurePlan(db))()
    const plotPlanSchemas = schemas(8), plotPlanFingerprints = new Set(plotPlanSchemas.map(item => item.fingerprint))
    const m07 = createM07Migration({ database: native,
      verifyKnownSchema: db => plotPlanFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM07PlotStructurePlan(native(db)) })
    for (const db of references) db.transaction(() => applyM08StructuredRefsAndCastDecisions(db))()
    const structuredRefsSchemas = schemas(9), structuredRefsFingerprints = new Set(structuredRefsSchemas.map(item => item.fingerprint))
    const m08 = createM08Migration({ database: native,
      verifyKnownSchema: db => structuredRefsFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM08StructuredRefsAndCastDecisions(native(db)) })
    for (const db of references) db.transaction(() => applyM09RhythmProfile(db))()
    const rhythmProfileSchemas = schemas(10), rhythmProfileFingerprints = new Set(rhythmProfileSchemas.map(item => item.fingerprint))
    const m09 = createM09Migration({ database: native,
      verifyKnownSchema: db => rhythmProfileFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM09RhythmProfile(native(db)) })
    for (const db of references) db.transaction(() => applyM10StoryDay(db))()
    const storyDaySchemas = schemas(11), storyDayFingerprints = new Set(storyDaySchemas.map(item => item.fingerprint))
    const m10 = createM10Migration({ database: native,
      verifyKnownSchema: db => storyDayFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM10StoryDay(native(db)) })
    for (const db of references) db.transaction(() => applyM11ResourceLedger(db))()
    const resourceLedgerSchemas = schemas(12), resourceLedgerFingerprints = new Set(resourceLedgerSchemas.map(item => item.fingerprint))
    const m11 = createM11Migration({ database: native,
      verifyKnownSchema: db => resourceLedgerFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM11ResourceLedger(native(db)) })
    for (const db of references) db.transaction(() => applyM12ChapterStalenessAck(db))()
    const stalenessAckSchemas = schemas(13), stalenessAckFingerprints = new Set(stalenessAckSchemas.map(item => item.fingerprint))
    const m12 = createM12Migration({ database: native,
      verifyKnownSchema: db => stalenessAckFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM12ChapterStalenessAck(native(db)) })
    for (const db of references) db.transaction(() => applyM13ContinuityChangeLog(db))()
    const changeLogSchemas = schemas(14), changeLogFingerprints = new Set(changeLogSchemas.map(item => item.fingerprint))
    const m13 = createM13Migration({ database: native,
      verifyKnownSchema: db => changeLogFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM13ContinuityChangeLog(native(db)) })
    for (const db of references) db.transaction(() => applyM14KeyItems(db))()
    const keyItemSchemas = schemas(15), keyItemFingerprints = new Set(keyItemSchemas.map(item => item.fingerprint))
    const m14 = createM14Migration({ database: native,
      verifyKnownSchema: db => keyItemFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM14KeyItems(native(db)) })
    for (const db of references) db.transaction(() => applyM15InstitutionCadences(db))()
    const cadenceSchemas = schemas(16), cadenceFingerprints = new Set(cadenceSchemas.map(item => item.fingerprint))
    const m15 = createM15Migration({ database: native,
      verifyKnownSchema: db => cadenceFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM15InstitutionCadences(native(db)) })
    for (const db of references) db.transaction(() => applyM16KnowledgeStates(db))()
    const knowledgeSchemas = schemas(17), knowledgeFingerprints = new Set(knowledgeSchemas.map(item => item.fingerprint))
    const m16 = createM16Migration({ database: native,
      verifyKnownSchema: db => knowledgeFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM16KnowledgeStates(native(db)) })
    for (const db of references) db.transaction(() => applyM17PowerAbilities(db))()
    const powerAbilitySchemas = schemas(18), powerAbilityFingerprints = new Set(powerAbilitySchemas.map(item => item.fingerprint))
    const m17 = createM17Migration({ database: native,
      verifyKnownSchema: db => powerAbilityFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM17PowerAbilities(native(db)) })
    for (const db of references) db.transaction(() => applyM18VolumeHandoffs(db))()
    const volumeHandoffSchemas = schemas(19), volumeHandoffFingerprints = new Set(volumeHandoffSchemas.map(item => item.fingerprint))
    const m18 = createM18Migration({ database: native,
      verifyKnownSchema: db => volumeHandoffFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM18VolumeHandoffs(native(db)) })
    // M19 会重建 `volume_handoffs`（13 列 → 11 列 + 外键），所以 v19 的指纹必须在它之前算。
    for (const db of references) db.transaction(() => applyM19VolumeStructure(db))()
    const volumeStructureSchemas = schemas(20), volumeStructureFingerprints = new Set(volumeStructureSchemas.map(item => item.fingerprint))
    const m19 = createM19Migration({ database: native,
      verifyKnownSchema: db => volumeStructureFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM19VolumeStructure(native(db)) })
    for (const db of references) db.transaction(() => applyM20ReviewClass(db))()
    const reviewClassSchemas = schemas(21), reviewClassFingerprints = new Set(reviewClassSchemas.map(item => item.fingerprint))
    const m20 = createM20Migration({ database: native,
      verifyKnownSchema: db => reviewClassFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM20ReviewClass(native(db)) })
    for (const db of references) db.transaction(() => applyM21Secrets(db))()
    const secretSchemas = schemas(22), secretFingerprints = new Set(secretSchemas.map(item => item.fingerprint))
    const m21 = createM21Migration({ database: native,
      verifyKnownSchema: db => secretFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM21Secrets(native(db)) })
    for (const db of references) db.transaction(() => applyM22KnowledgeCandidates(db))()
    const knowledgeCandidateSchemas = schemas(23), knowledgeCandidateFingerprints = new Set(knowledgeCandidateSchemas.map(item => item.fingerprint))
    const m22 = createM22Migration({ database: native,
      verifyKnownSchema: db => knowledgeCandidateFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM22KnowledgeCandidates(native(db)) })
    for (const db of references) db.transaction(() => applyM23DeletionKeepDraft(db))()
    const deletionKeepDraftSchemas = schemas(24), deletionKeepDraftFingerprints = new Set(deletionKeepDraftSchemas.map(item => item.fingerprint))
    const m23 = createM23Migration({ database: native,
      verifyKnownSchema: db => deletionKeepDraftFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM23DeletionKeepDraft(native(db)) })
    for (const db of references) db.transaction(() => applyM24UpstreamRevisions(db))()
    const upstreamRevisionSchemas = schemas(25), upstreamRevisionFingerprints = new Set(upstreamRevisionSchemas.map(item => item.fingerprint))
    const m24 = createM24Migration({ database: native,
      verifyKnownSchema: db => upstreamRevisionFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM24UpstreamRevisions(native(db)) })
    for (const db of references) db.transaction(() => applyM25DerivedSourceRef(db))()
    const derivedSourceRefSchemas = schemas(26), derivedSourceRefFingerprints = new Set(derivedSourceRefSchemas.map(item => item.fingerprint))
    const m25 = createM25Migration({ database: native,
      verifyKnownSchema: db => derivedSourceRefFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM25DerivedSourceRef(native(db)) })
    for (const db of references) db.transaction(() => applyM26SynopsisSourceRef(db))()
    const synopsisSourceRefSchemas = schemas(27), synopsisSourceRefFingerprints = new Set(synopsisSourceRefSchemas.map(item => item.fingerprint))
    const m26 = createM26Migration({ database: native,
      verifyKnownSchema: db => synopsisSourceRefFingerprints.has(sqliteSchemaFingerprint(native(db)))
        && verifyM26SynopsisSourceRef(native(db)) })
    installed = createMigrationRegistry([m00, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19, m20, m21, m22, m23, m24, m25, m26], [
      ...sourceSchemas, ...baselineSchemas.map(schema => ({ ...schema, version: 0 })),
      ...baselineSchemas, ...generationSchemas, ...identitySchemas,
      ...reviewCycleSchemas, ...importEffectSchemas, ...characterAssetSchemas, ...mergeSnapshotSchemas,
      // 基线保持冻结态，v0~v11 的指纹与历史库天然一致，旧项目无需额外登记即可被
      // probeSchema 识别，再由 M11 升到 v12。
      ...plotPlanSchemas, ...structuredRefsSchemas, ...rhythmProfileSchemas, ...storyDaySchemas,
      ...resourceLedgerSchemas, ...stalenessAckSchemas, ...changeLogSchemas, ...keyItemSchemas,
      ...cadenceSchemas,
      ...knowledgeSchemas,
      ...powerAbilitySchemas,
      ...volumeHandoffSchemas,
      ...volumeStructureSchemas,
      ...reviewClassSchemas,
      ...secretSchemas,
      ...knowledgeCandidateSchemas,
      ...deletionKeepDraftSchemas,
      ...upstreamRevisionSchemas,
      ...derivedSourceRefSchemas,
      ...synopsisSourceRefSchemas,
    ])
    return installed
  } finally { reference.close(); donor.close() }
}
