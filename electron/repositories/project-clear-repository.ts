import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

import { getCurrentProjectPath, getProjectDb } from '../database'
import { clearBlueprintFactsWithinTransaction } from './blueprint-repository'
import { getProjectDataRoot } from '../services/project-data-locator'
import { commitAuthorCharacterRoster } from '../services/character-roster-author'
import { adoptLegacyCards, readLegacyRosterSource } from '../services/legacy-roster-source'
import { hasCharacterIdentitySchema } from './character-repository'
import { CharacterRosterRepository, clearLegacyCharacterArchitecture } from './character-roster-repository'
import { hasColumn } from './derived-source-ref'
import { CHARACTER_ROSTER_SCHEMA_VERSION } from '../../src/shared/character-roster'
import type { ProjectClearCounts } from '../../src/shared/ipc-channels'

/**
 * P1-2 期 1b 的三张卷表可能不存在（v20 之前 / 未建过）。
 * 清库不能因为「表还没建」就整步失败 —— 那会让作者连正文都清不掉。
 */
function hasTable(db: BetterSqlite3.Database, name: string): boolean {
    return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

export type ProjectClearScope = 'creativeFields' | 'blueprints' | 'generatedText'

export interface ProjectClearOptions {
    creativeFields?: boolean
    blueprints?: boolean
    generatedText?: boolean
}

export interface ProjectClearResult {
    cleared: ProjectClearScope[]
    physicalFilesDeleted: number
    /** D10：三档各清了几类、多少条（与 DB 删除计数同源）。 */
    counts: ProjectClearCounts
}

/**
 * D10 回执按档归属的表（**不重叠**：同一张表只归一档，避免重复计数）。
 * `volume_handoffs` 归正文层（缺陷稿/注释：交接单属于正文层），`volumes` 归架构层
 * （正文层只 UPDATE `actual_last`，不清行）。
 */
const CLEAR_COUNT_TABLES: Record<ProjectClearScope, readonly string[]> = {
    generatedText: ['finalized_draft_import_operations', 'post_process_steps', 'post_process_runs', 'reviews', 'revisions', 'drafts', 'contents', 'summary_snapshots', 'volume_handoffs'],
    blueprints: ['blueprint_character_sync_operations', 'blueprint_commit_operations', 'blueprints'],
    creativeFields: ['characters', 'upstream_revisions', 'upstream_revision_log', 'volume_units', 'volumes'],
}

type ClearCountSnapshot = Record<string, number>

function emptyCounts(): ProjectClearCounts {
    return {
        creativeFields: { categories: 0, rows: 0 },
        blueprints: { categories: 0, rows: 0 },
        generatedText: { categories: 0, rows: 0 },
    }
}

/**
 * 逐表 COUNT(*) 快照。用 `.get()` 取 `AS count`（而非 `.pluck()`），
 * 字段缺失 / 老库读不到数字时按 0 —— 既有 mock db 的 `prepare()` 只实现
 * `get`，这样不会打坏原来的 repository 测试。
 */
function snapshotClearCounts(db: BetterSqlite3.Database): ClearCountSnapshot {
    const snapshot: ClearCountSnapshot = {}
    for (const tables of Object.values(CLEAR_COUNT_TABLES)) {
        for (const table of tables) {
            if (!hasTable(db, table)) continue
            const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: unknown } | undefined
            const raw = row?.count
            snapshot[table] = typeof raw === 'number' ? raw : 0
        }
    }
    return snapshot
}

/** 事务前后行数差 = 实际删除条数；有记录被清掉的表算一「类」。 */
function diffClearCounts(before: ClearCountSnapshot, after: ClearCountSnapshot): ProjectClearCounts {
    const counts = emptyCounts()
    for (const scope of Object.keys(CLEAR_COUNT_TABLES) as ProjectClearScope[]) {
        for (const table of CLEAR_COUNT_TABLES[scope]) {
            const delta = (before[table] ?? 0) - (after[table] ?? 0)
            if (delta > 0) {
                counts[scope].rows += delta
                counts[scope].categories += 1
            }
        }
    }
    return counts
}

interface MovedFile {
    from: string
    to: string
}

const FINALIZED_CHAPTER_FILE_RE = /^第\d+章(?: .*)?\.txt$/u

function listGeneratedChapterFiles(projectPath: string): string[] {
    if (!fs.existsSync(projectPath)) return []
    return fs.readdirSync(projectPath, { withFileTypes: true })
        .filter(entry => entry.isFile() && FINALIZED_CHAPTER_FILE_RE.test(entry.name))
        .map(entry => path.join(projectPath, entry.name))
}

function moveGeneratedFilesToTrash(projectPath: string): MovedFile[] {
    const files = listGeneratedChapterFiles(projectPath)
    if (files.length === 0) return []

    const trashDir = path.join(
        getProjectDataRoot(projectPath),
        'trash',
        `clear-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    )
    fs.mkdirSync(trashDir, { recursive: true })

    const moved: MovedFile[] = []
    try {
        for (const file of files) {
            const target = path.join(trashDir, path.basename(file))
            fs.renameSync(file, target)
            moved.push({ from: file, to: target })
        }
        return moved
    } catch (error) {
        restoreMovedFiles(moved)
        throw error
    }
}

function restoreMovedFiles(moved: MovedFile[]): void {
    for (const item of [...moved].reverse()) {
        if (fs.existsSync(item.to) && !fs.existsSync(item.from)) {
            fs.renameSync(item.to, item.from)
        }
    }
}

function removeMovedFiles(moved: MovedFile[]): void {
    const dirs = new Set<string>()
    for (const item of moved) {
        dirs.add(path.dirname(item.to))
    }

    for (const dir of dirs) {
        fs.rmSync(dir, { recursive: true, force: true })
    }
}

export class ProjectClearRepository {
    /** session 是清空角色卡所需的作者身份；角色走与作者删除相同的退休路径，历史身份记录保留。 */
    static clearGeneratedData(options: ProjectClearOptions, session?: { projectId: string; epoch: string }): ProjectClearResult {
        const db = getProjectDb()
        if (!db) throw new Error('项目数据库未打开')

        const projectPath = getCurrentProjectPath()
        if (options.generatedText && !projectPath) throw new Error('项目路径未初始化')

        const movedFiles = options.generatedText && projectPath
            ? moveGeneratedFilesToTrash(projectPath)
            : []
        const cleared: ProjectClearScope[] = []
        // D10：回执计数在事务回调内取「删除前后逐表行数差」，与 DB 删除计数同源。
        let counts: ProjectClearCounts = emptyCounts()

        try {
            const tx = db.transaction(() => {
                const before = snapshotClearCounts(db)
                if (options.generatedText) {
                    db.prepare('DELETE FROM finalized_draft_import_operations').run()
                    db.prepare('DELETE FROM post_process_steps').run()
                    db.prepare('DELETE FROM post_process_runs').run()
                    db.prepare('DELETE FROM reviews').run()
                    db.prepare('DELETE FROM revisions').run()
                    db.prepare('DELETE FROM drafts').run()
                    db.prepare('DELETE FROM contents').run()
                    db.prepare('DELETE FROM summary_snapshots').run()
                    // P1-2 期 1b：交接单属于正文层（讲的是「这一卷写完时」的状态）。
                    // 卷结构本身留着 —— 它是从大纲物化的，清正文不该顺带删掉结构；
                    // 但 `actual_last` 是「已定稿章的最大章号」，正文没了它就不成立。
                    if (hasTable(db, 'volume_handoffs')) db.prepare('DELETE FROM volume_handoffs').run()
                    if (hasTable(db, 'volumes')) {
                        db.prepare('UPDATE volumes SET actual_last = NULL, actual_source = NULL, updated_at = ?')
                            .run(new Date().toISOString())
                    }
                    cleared.push('generatedText')
                }

                if (options.blueprints) {
                    clearBlueprintFactsWithinTransaction(db)
                    cleared.push('blueprints')
                }

                if (options.creativeFields) {
                    if (hasCharacterIdentitySchema(db)) {
                        const operationId = `project-clear:${randomUUID()}`
                        // 升级后尚未修复的旧角色卡先按既有入口采用，才能走作者退休路径。
                        if (CharacterRosterRepository.read(db).migrationState === 'legacy_cards_preserved') {
                            const source = readLegacyRosterSource(db)
                            adoptLegacyCards(db, { operationId, expectedRevision: source.snapshot.revision, expectedLegacyHash: source.legacyHash,
                                expectedIdentityRevision: source.identityRevision, expectedFactsHash: source.factsHash })
                        }
                        const roster = CharacterRosterRepository.read(db)
                        if (roster.entries.length > 0) {
                            if (!session) throw new Error('CHARACTER_AUTHOR_SCOPE_REQUIRED')
                            commitAuthorCharacterRoster(db, { operationId, schemaVersion: CHARACTER_ROSTER_SCHEMA_VERSION, intent: 'manual_edit',
                                expectedRevision: roster.revision, expectedIdentityRevision: roster.identityRevision!, entries: [] }, session, () => {})
                        }
                        clearLegacyCharacterArchitecture(db)
                    }
                    // E4i（2026-10-19）：**弧光结构必须一起清**。
                    //
                    // 此前这一句漏了 `plot_structure_plan`：作者点「清除全部」后前提/世界观/
                    // 大纲都没了，弧光却还在——而弧光里点名的人物、空间已经不存在，
                    // 是**悬空引用**，比不清更糟（设计稿 §8.1.7）。
                    //
                    // `plot_tree_snapshot` 也一并置空：它是从大纲/蓝图派生的快照，
                    // 弧光与大纲都清了，它必然 stale（ADR 0014 定性为可重建的只读派生快照）。
                    db.prepare(`
                        UPDATE project_core
                        SET writing_style = '',
                            reference_works = '',
                            global_guidance = '',
                            golden_finger = '',
                            premise = '',
                            worldbuilding = '',
                            synopsis = '',
                            character_states = '',
                            plot_structure_plan = '',
                            plot_tree_snapshot = '',
                            updated_at = datetime('now')
                        WHERE id = 'main'
                    `).run()
                    // P2-2 期 2（设计稿 §十一 R11）：**版本账随被描述的世界一起归零**。
                    //
                    // 不清有三条后果，最重的一条是「导入更早备份后永久脏」：
                    // `upstream_revisions` 是 D 类、整行覆盖 ⇒ rev 会回退 ⇒ 按不变量 2
                    // 全部判 `stale` ⇒ 该包里所有派生永久脏，除非整本再生成一次。
                    // 另外 `changed_chapters` 会留着清除前的章号（那些章已不存在），
                    // 按章收窄于是永远认为"这些章变过"，噪声永久累积。
                    if (hasTable(db, 'upstream_revisions')) db.prepare('DELETE FROM upstream_revisions').run()
                    // S6c / M27：**流水一起归零**。留着上一世的版本史，作者下次清除后
                    // 看「为什么旧」会读到已经不存在的那几版（时间、原因都对不上当前库）。
                    if (hasTable(db, 'upstream_revision_log')) db.prepare('DELETE FROM upstream_revision_log').run()
                    // 剧情树快照刚被置空 ⇒ 它的来源也跟着清，否则徽标继续指向一份
                    // 已经不存在的派生。（列可能存在之前建的库上，先探再写。）
                    if (hasColumn(db, 'project_core', 'plot_tree_source_ref')) {
                        db.prepare("UPDATE project_core SET plot_tree_source_ref = '' WHERE id = 'main'").run()
                    }
                    // P2-3 期 3b / M26：大纲自己的来源也归零。`synopsis` 刚被清空、
                    // `upstream_revisions` 刚被整表删 ⇒ 若留着这串 JSON，作者重新生成大纲后
                    // 取到的是「写于 rev5」而新版本账从 rev0 起算，按不变量 2 直接判 stale ——
                    // 一份**刚生成**的大纲被判旧，与清除前那条坑同型。
                    if (hasColumn(db, 'project_core', 'synopsis_source_ref')) {
                        db.prepare("UPDATE project_core SET synopsis_source_ref = '' WHERE id = 'main'").run()
                    }
                    // P1-2 期 1b：`plot_structure_plan` 已置空，卷/单元结构成了悬空引用。
                    // 顺序必须是 handoffs → units → volumes（外键依赖）。
                    if (hasTable(db, 'volume_handoffs')) db.prepare('DELETE FROM volume_handoffs').run()
                    if (hasTable(db, 'volume_units')) db.prepare('DELETE FROM volume_units').run()
                    if (hasTable(db, 'volumes')) db.prepare('DELETE FROM volumes').run()
                    cleared.push('creativeFields')
                }
                const after = snapshotClearCounts(db)
                counts = diffClearCounts(before, after)
            })

            tx()
        } catch (error) {
            restoreMovedFiles(movedFiles)
            throw error
        }
        let physicalFilesDeleted = 0
        try {
            removeMovedFiles(movedFiles)
            physicalFilesDeleted = movedFiles.length
        } catch (error) {
            // The database is committed; restoring files or reporting failure would misstate the project state.
            console.warn('[ProjectClear] 已清除项目数据，但废纸篓文件未能完全删除:', error)
        }
        return { cleared, physicalFilesDeleted, counts }
    }
}
