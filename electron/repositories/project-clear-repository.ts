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
import { CHARACTER_ROSTER_SCHEMA_VERSION } from '../../src/shared/character-roster'

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

        try {
            const tx = db.transaction(() => {
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
                    // P1-2 期 1b：`plot_structure_plan` 已置空，卷/单元结构成了悬空引用。
                    // 顺序必须是 handoffs → units → volumes（外键依赖）。
                    if (hasTable(db, 'volume_handoffs')) db.prepare('DELETE FROM volume_handoffs').run()
                    if (hasTable(db, 'volume_units')) db.prepare('DELETE FROM volume_units').run()
                    if (hasTable(db, 'volumes')) db.prepare('DELETE FROM volumes').run()
                    cleared.push('creativeFields')
                }
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
        return { cleared, physicalFilesDeleted }
    }
}
