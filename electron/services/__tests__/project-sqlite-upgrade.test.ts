import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { createMigrationRegistry } from '../../migrations/registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { isSupportedUpgradeOrigin, upgradeProjectSqlite } from '../sqlite-project-migration'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

function legacyDatabaseAt(version: number): { root: string; file: string } {
  const root = mkdtempSync(path.join(tmpdir(), `canonical-v${version}-`))
  const file = path.join(root, 'project.db')
  const db = new Database(file)
  try {
    db.pragma('foreign_keys=ON')
    db.transaction(() => initializeLegacyBaselineSchema(db))()
    migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), version)
    db.prepare('INSERT INTO contents(body) VALUES(?)').run(`v${version} 作者正文`)
  } finally { db.close() }
  return { root, file }
}

/**
 * 规范库升级白名单（lane 六步第 5 步）。
 *
 * 这是全仓最容易漏的一处，而且漏了不报编译错、不报测试错，**只表现为用户打不开项目**：
 * - 2026-10-19：加 M09 漏了这一处，v9 老项目一打开就 `CANONICAL_SCHEMA_UPGRADE_UNSUPPORTED`；
 * - 2026-10-22：加 M10/M11 又漏了 —— 那次作者手上所有项目都停在 v11，M11 一落地就**全部**打不开。
 *
 * 第一次的钉子只写了「v9 → v10」一条 hardcoded 用例，所以 M10/M11 漏改时它没红。
 * 现在白名单改成从 registry 派生（见 `isSupportedUpgradeOrigin`），这两条用例改为钉住
 * 「每一档都放行」这个性质 —— 以后再加 lane，漏登记会在这里红。
 */
describe('canonical upgrade whitelist', () => {
  it(`白名单覆盖 v1..v${CURRENT_DESKTOP_SCHEMA_VERSION - 1} 每一档，v0 与当前及更高版本不放行`, () => {
    const registry = getDesktopMigrationRegistry()
    for (let version = 1; version < CURRENT_DESKTOP_SCHEMA_VERSION; version++) {
      expect(isSupportedUpgradeOrigin(registry, version), `v${version} 应可升级`).toBe(true)
    }
    // v0 是未版本化的 legacy 库，走 legacy 合格源路径而不是升级路径。
    expect(isSupportedUpgradeOrigin(registry, 0)).toBe(false)
    expect(isSupportedUpgradeOrigin(registry, CURRENT_DESKTOP_SCHEMA_VERSION)).toBe(false)
    expect(isSupportedUpgradeOrigin(registry, CURRENT_DESKTOP_SCHEMA_VERSION + 1)).toBe(false)
  })

  // 判定必须有牙齿：少装 M11 一档，凡是必须经过它的起点都得变成「上不去」。
  // 没有这条，前一条用例可能被一个恒真的实现蒙混过关。
  it('lane 少装一档时，需要经过它的起点全线不放行（证明判定不是恒真）', () => {
    const registry = getDesktopMigrationRegistry()
    const withoutM11 = createMigrationRegistry(
      registry.implementations.filter(step => step.id !== 'M11'), registry.recognizedSchemas)
    // M11 是 11→12：v1..v11 都必须经过它，所以全部不放行。
    for (let version = 1; version <= 11; version++) {
      expect(isSupportedUpgradeOrigin(withoutM11, version), `v${version} 不该被放行`).toBe(false)
    }
    // v12 起已经不经过 M11（M12/M13/M14 各自有槽位），仍然可以升级 —— 这不是漏洞：
    // 「能否升级」只取决于**从这个起点出发**是否连续，不取决于更早的档有没有装。
    for (let version = 12; version < CURRENT_DESKTOP_SCHEMA_VERSION; version++) {
      expect(isSupportedUpgradeOrigin(withoutM11, version), `v${version} 不经过 M11，应可升级`).toBe(true)
    }
    expect(isSupportedUpgradeOrigin(registry, CURRENT_DESKTOP_SCHEMA_VERSION - 1)).toBe(true)
  })

  // v9 之后每一档都是真实存在的旧项目状态：M10 升过的库停在 v11，M11 升过的库停在 v12。
  it.each([9, 10, 11])('v%s 老项目打开即升到当前版本，正文逐字不变、资源两表补齐', { timeout: 20_000 }, version => {
    const { root, file } = legacyDatabaseAt(version)
    try {
      const evidence = upgradeProjectSqlite({ databasePath: file })
      expect(evidence.schemaVersion).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)

      const reopened = new Database(file, { readonly: true })
      try {
        expect(reopened.pragma('user_version', { simple: true })).toBe(CURRENT_DESKTOP_SCHEMA_VERSION)
        expect(reopened.prepare('SELECT body FROM contents').pluck().get()).toBe(`v${version} 作者正文`)
        for (const table of ['resources', 'resource_movements']) {
          const count = reopened.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?").pluck().get(table)
          expect(count, `${table} 应存在`).toBe(1)
        }
        // 空 = 中性：老项目升级后不能凭空得到一个平台节奏。
        const column = (reopened.prepare('PRAGMA table_info(project_core)').all() as Array<{
          name: string; notnull: number; dflt_value: string | null
        }>).find(item => item.name === 'rhythm_profile')
        expect(column?.notnull).toBe(1)
        expect(column?.dflt_value).toBe("''")
      } finally { reopened.close() }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
