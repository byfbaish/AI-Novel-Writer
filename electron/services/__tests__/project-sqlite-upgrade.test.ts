import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { upgradeProjectSqlite } from '../sqlite-project-migration'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * 规范库升级白名单（lane 六步第 5 步）。
 *
 * 2026-10-19 实测踩过：加 M09 时漏了这一处，v9 老项目一打开就
 * `CANONICAL_SCHEMA_UPGRADE_UNSUPPORTED`。这个用例就是那条路径的回归钉子 ——
 * 以后再加 M10/M11，漏改白名单会在这里红，而不是等用户打不开项目。
 */
describe('canonical upgrade whitelist', () => {
  it('v9 → v10：白名单放行、rhythm_profile 补空串、作者正文逐字不变', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'canonical-v9-'))
    const file = path.join(root, 'project.db')
    try {
      const db = new Database(file)
      db.pragma('foreign_keys=ON')
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), 9)
      db.prepare('INSERT INTO contents(body) VALUES(?)').run('v9 作者正文')
      db.close()

      const evidence = upgradeProjectSqlite({ databasePath: file })
      expect(evidence.schemaVersion).toBe(10)

      const reopened = new Database(file, { readonly: true })
      try {
        const column = (reopened.prepare('PRAGMA table_info(project_core)').all() as Array<{
          name: string; notnull: number; dflt_value: string | null
        }>).find(item => item.name === 'rhythm_profile')
        expect(column?.notnull).toBe(1)
        // 空 = 中性：老项目升级后不能凭空得到一个平台节奏。
        expect(column?.dflt_value).toBe("''")
        expect(reopened.prepare('SELECT body FROM contents').pluck().get()).toBe('v9 作者正文')
      } finally { reopened.close() }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
