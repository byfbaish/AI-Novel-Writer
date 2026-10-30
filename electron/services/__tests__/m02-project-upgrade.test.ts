import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { verifyM02CharacterIdentity } from '../../migrations/m02-character-identity'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { migrateSchema } from '../../migrations/runner'
import { createMigrationRegistry } from '../../migrations/registry'
import { backupProjectSqlite, probeProjectSqlite, upgradeProjectSqlite, verifyProjectSqlite } from '../sqlite-project-migration'
const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const base = path.resolve('.runtime/.cache/novel-quality-modernization/s08-lane'); fs.mkdirSync(base, { recursive: true })
  const root = fs.mkdtempSync(path.join(base, 'project-')); roots.push(root)
  const file = path.join(root, 'project.db'), db = new Database(file)
  db.pragma('foreign_keys=ON'); db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 2)
  const raw = ' 作者原文\r\n“保留标点”。', provenance = '{ "location" : { "kind" : "legacy" } }'
  db.prepare('INSERT INTO contents(body) VALUES(?)').run(raw)
  db.prepare('INSERT INTO characters(name,relationships,cs_provenance) VALUES(?,?,?)').run('角色', '自由文本，尚未确定身份。', provenance)
  db.prepare('INSERT INTO blueprints(chapter_number,characters) VALUES(1,?)').run('[ "角色" ]')
  db.close()
  return { root, file, raw, provenance }
}
describe('M02 real SQLite source projection and admission', () => {
  it('upgrades schema2 preserving all prior fields while retaining the full new domain and stable IDs', () => {
    const f = fixture(), before = probeProjectSqlite({ databasePath: f.file })
    const after = upgradeProjectSqlite({ databasePath: f.file })
    expect(before.schemaVersion).toBe(2); expect(after.schemaVersion).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
    // 只比行数，不比 hash：`preIdentityDomain` 是在**当前版本**上算的（`domainColumns(db, true)` 用
    // 当时实际的列清单），所以任何一版迁移往核心表加列都会改 hash（M25 给 `blueprints` 加
    // `source_ref` 就是最近一次）。真正的「作者内容没被动过」由 `upgradeProjectSqlite` 自己证明：
    // 它先捕获迁移前的列清单（`columnsBefore`），迁移后用同一清单重算并逐字节比对
    // （sqlite-project-migration.ts:287，失败即 PROJECT_MIGRATION_SQLITE_CONTENT_CHANGED）；
    // 该保护是否真的会触发由下面第三例专测。
    expect(after.preIdentityDomain?.tableCounts).toEqual(before.domain.tableCounts)
    expect(after.domain).not.toEqual(before.domain)
    expect(verifyProjectSqlite({ databasePath: f.file })).toEqual(after)
    const db = new Database(f.file)
    const id = db.prepare('SELECT character_id FROM characters').pluck().get()
    expect(db.prepare('SELECT cs_provenance FROM characters').pluck().get()).toBe(f.provenance)
    expect(db.prepare('SELECT body FROM contents').pluck().get()).toBe(f.raw); db.close()
    expect(upgradeProjectSqlite({ databasePath: f.file })).toEqual(after)
    const reopened = new Database(f.file); expect(reopened.prepare('SELECT character_id FROM characters').pluck().get()).toBe(id); reopened.close()
  })
  it('backs up active WAL without changing DB/WAL/SHM source bytes and verifies the exact old-column projection', async () => {
    const f = fixture(), db = new Database(f.file); db.pragma('journal_mode=WAL'); db.pragma('wal_autocheckpoint=0')
    db.prepare('INSERT INTO contents(body) VALUES(?)').run('仅在WAL的作者正文')
    const bytes = ['','-wal','-shm'].map(suffix => fs.readFileSync(f.file + suffix))
    try {
      const before = probeProjectSqlite({ databasePath: f.file }), target = path.join(f.root, 'copy.db')
      const result = await backupProjectSqlite({ sourceDatabasePath: f.file, targetDatabasePath: target })
      expect(result.schemaVersion).toBe(CURRENT_DESKTOP_SCHEMA_VERSION); expect(result.preIdentityDomain?.tableCounts).toEqual(before.domain.tableCounts)
      expect(verifyProjectSqlite({ databasePath: target })).toEqual(result)
      expect(['','-wal','-shm'].map(suffix => fs.readFileSync(f.file + suffix))).toEqual(bytes)
    } finally { db.close() }
  })
  it('rolls back a structurally valid migration that changes non-character author facts', () => {
    const f = fixture(), registry = getDesktopMigrationRegistry(), bytes = fs.readFileSync(f.file)
    const bad = createMigrationRegistry(registry.implementations.map(step => step.id === 'M02' ? { ...step, migrate(adapter) { step.migrate(adapter); (adapter as SqliteSchemaAdapter).database.exec("UPDATE contents SET body='changed'") } } : step), registry.recognizedSchemas)
    expect(() => upgradeProjectSqlite({ databasePath: f.file, registry: bad })).toThrow('PROJECT_MIGRATION_SQLITE_CONTENT_CHANGED')
    expect(fs.readFileSync(f.file)).toEqual(bytes); expect(probeProjectSqlite({ databasePath: f.file }).schemaVersion).toBe(2)
  })
  it('refuses unknown schema2 columns at admission and M02 rejects invalid alias domain evidence', () => {
    const f = fixture(), db = new Database(f.file); db.exec('ALTER TABLE contents ADD COLUMN foreign_variant TEXT'); db.close()
    const bytes = fs.readFileSync(f.file)
    expect(() => upgradeProjectSqlite({ databasePath: f.file })).toThrow('UNRECOGNIZED_SCHEMA')
    expect(fs.readFileSync(f.file)).toEqual(bytes)
    const other = fixture(); upgradeProjectSqlite({ databasePath: other.file })
    const bad = new Database(other.file)
    // 先证明这条 alias 真的存在：M02 会给每个有名字的角色建一条。为空时 UPDATE 影响 0 行，
    // 断言会变成"什么都没改也算过"（这条用例此前就是靠"表不存在 ⇒ UPDATE 抛错"蹭过的）。
    expect(bad.prepare('SELECT COUNT(*) FROM character_aliases').pluck().get()).toBeGreaterThan(0)
    // 直测 M02 的校验函数：`verifySchema(…, CURRENT)` 只执行 `step.to === CURRENT` 那一步的 verify，
    // 停在 26 的库根本不会跑 M02.verify ⇒ 拿 verifyProjectSqlite 断言这里只能是空过。
    bad.exec('UPDATE character_aliases SET valid_from=0.5')
    expect(verifyM02CharacterIdentity(bad)).toBe(false)
    bad.close()
  })
})
