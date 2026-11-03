import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M29：`generation_runs` 的执行租约三列（D2 方案甲，2026-11-04）。
 *
 * ## 为什么需要这三列
 *
 * 方案乙（M28 同期，2026-11-02）已经把**正常收尾**的终态收敛到渲染层一处：工作流
 * 跑完 / 失败 / 取消时，由 `generation:seal` 写 run 终态。但乙有个管不到的路径 ——
 * **工作流没了**（进程崩溃、关窗、渲染层静默中断）。那时没有调用方可以执行收口，
 * run 就一直是 `running`，直到下次启动被 `recoverInterrupted()` 抹成 `paused`。
 *
 * `paused` 承载不了「这一批已经中止」这个语义：它同时是「上次进程没了」和「等作者
 * 继续」的写法。于是「这批到底结束了没有」在库里没有答案 —— 这正是 D2 的主症状。
 *
 * 加租约之后，「主人是否还活着」变成可判的：认领时写到期时刻，运行期续租，启动时
 * fence 掉「持有者不是当前会话」或「租约已过期」的 run，落成明确的 `aborted`。
 *
 * ## 为什么与 `import_runs` 同名同义
 *
 * `import_runs` 早就有这三列（`baseline-schema.ts:645-647`）：导入批次有「主人还活着吗」
 * 的判据，生成批次没有。同名同义意味着两处的 fence 逻辑可以互相参照，将来排查的人
 * 不用记两套术语。
 *
 * ## 为什么默认 `''` / `0` 而不是 NULL
 *
 * `lease_expires_at = 0` 是一个**不可能成立的到期时刻**（1970），语义明确是「无人持有」。
 * 用 NULL 会要求每个读取侧自己兜一层 `?? 0`，漏兜的那一处会把 NULL 当「永不过期」，
 * 于是一个崩溃批次永远不会被 fence —— 静默失效，跟没加这一列一样。
 *
 * `execution_owner = ''` 同理。`NOT NULL` 保持，是为了让「没写」和「写空」不会变成两种状态。
 *
 * ## 为什么不回填历史行
 *
 * 老库里那些 `running` / `paused` 的 run，它们当时**确实没有租约**（那时还没有这个概念）。
 * 回填一个 `now + TTL` 等于声称「它现在活着」，会让本该被判死的历史批次多活一个 TTL；
 * 回填 `0` 则是如实说「无人持有」—— 下次启动的 fence 会立刻判它 `aborted`。
 * 这与 M27/M28 那条纪律一致：**迁移不伪造证据**。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以走新 lane。
 */
export const M29_GENERATION_RUN_LEASE_COLUMNS = [
  ['execution_owner', "TEXT NOT NULL DEFAULT ''"],
  ['execution_epoch', 'INTEGER NOT NULL DEFAULT 0'],
  ['lease_expires_at', 'INTEGER NOT NULL DEFAULT 0'],
] as const

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare('PRAGMA table_info(generation_runs)').all() as ColumnInfo[]
}

/** 幂等：列已在就跳过（`ALTER TABLE ADD COLUMN` 重复执行会抛 duplicate column）。 */
export function applyM29GenerationRunLease(db: Database.Database): void {
  const existing = new Set(columnsOf(db).map(item => item.name))
  for (const [name, definition] of M29_GENERATION_RUN_LEASE_COLUMNS) {
    if (existing.has(name)) continue
    db.exec(`ALTER TABLE generation_runs ADD COLUMN ${name} ${definition}`)
    existing.add(name)
  }
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言三件，每件都对应一种「不报错但会静默失效」的写法：
 * - **列在**：缺 `lease_expires_at`，fence 的 WHERE 会抛在运行时，而不是迁移时；
 * - **`NOT NULL`**：可空会让「没记」与「记成 0」变成两种状态，读取侧迟早只处理一种；
 * - **默认 `0`**：默认值写成别的（比如某个正数）会让**每一条老数据**一上来就「持有租约」，
 *   于是崩溃批次永远等不到 fence —— 这不会报错，只会让 D2 原样复发。
 */
export function verifyM29GenerationRunLease(db: Database.Database): boolean {
  try {
    const columns = columnsOf(db)
    for (const [name, definition] of M29_GENERATION_RUN_LEASE_COLUMNS) {
      const column = columns.find(item => item.name === name)
      if (!column) return false
      if (column.notnull !== 1) return false
      // definition 形如 "TEXT NOT NULL DEFAULT ''" / "INTEGER NOT NULL DEFAULT 0"
      const expectedDefault = definition.slice(definition.indexOf('DEFAULT') + 'DEFAULT'.length).trim()
      if ((column.dflt_value ?? '') !== expectedDefault) return false
    }
    return true
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM29Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M29', from: 29, to: 30, owner: 'D2',
    migrate: reader => applyM29GenerationRunLease(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM29GenerationRunLease(deps.database(reader)) }
}
