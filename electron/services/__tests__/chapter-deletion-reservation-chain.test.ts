import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { closeConnection } from '../../vector-store'
import { DraftRepository } from '../../repositories/draft-repository'
import { FinalizationRepository } from '../../repositories/finalization-repository'
import { projectAccess } from '../../services/project-access'
import { ChapterDeletionService } from '../../services/chapter-deletion-service'
import {
  publishManuscript,
  readManuscriptDeletionReservation,
  removePublishedManuscript,
  serializeManuscript,
} from '../../services/manuscript-publisher'

/**
 * 全链路证据（卡 d9117e48 判据 1）：删除收据未清完 ＋ 盘上刚放回同名稿，
 * **跑真实的 `ChapterDeletionService.retry`** 之后 —— 新稿仍在、收据被清。
 * 只在这一层才验证得到 `markProjection('manuscript','completed')`。
 */
describe('chapter deletion · manuscript deletion reservation chain', () => {
  let parentDirectory: string
  let projectRoot: string
  let draftId: number
  let targetFileName: string

  beforeEach(async () => {
    parentDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-manuscript-reservation-chain-'))
    const project = projectAccess.createProject(parentDirectory, 'novel')
    const lease = projectAccess.beginSession(project)
    projectRoot = lease.rootPath
    openCanonicalProjectFixture(projectRoot)

    draftId = DraftRepository.create({
      chapterNumber: 1,
      source: 'write',
      content: '目标章节独有关键字',
      wordCount: 9,
    })
    const finalization = FinalizationRepository.commit({
      finalizationId: 'finalization-1',
      draftId,
      chapterNumber: 1,
      chapterTitle: '同名',
      content: '目标章节独有关键字',
      contentHash: 'target-hash',
      contentRevision: 1,
      targetFileName: '第1章 同名.txt',
    })
    targetFileName = finalization.targetFileName
    FinalizationRepository.linkKnowledgeDocument(draftId, 'finalized-document')
    await publishManuscript({
      projectRoot,
      targetFileName,
      chapterNumber: 1,
      chapterTitle: '同名',
      content: '目标章节独有关键字',
    })
    FinalizationRepository.markPublished(finalization.finalizationId)
  })

  afterEach(() => {
    closeProjectDatabase()
    projectAccess.invalidateCurrentSession()
    closeConnection(projectRoot)
    fs.rmSync(parentDirectory, { recursive: true, force: true })
  })

  it('keeps the restored same-name manuscript and clears the receipt when cleanup resumes', async () => {
    let manuscriptOutage = true
    const service = new ChapterDeletionService({
      createOperationId: () => 'reservation-chain-1',
      cleaner: {
        async removeManuscript(root, name) {
          if (manuscriptOutage) {
            manuscriptOutage = false
            throw new Error('simulated manuscript cleanup outage')
          }
          await removePublishedManuscript(root, name)
        },
        async removeKnowledgeDocument() {
          // 本用例只关心实体稿投影，知识库清理按成功处理。
        },
      },
    })

    const first = await service.delete(projectRoot, { draftId, chapterNumber: 1 })
    expect(first.operation?.manuscriptStatus).toBe('failed')
    expect(fs.existsSync(path.join(projectRoot, targetFileName))).toBe(true)
    expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).not.toBeNull()

    // 收据还没清完，作者把同名新稿放回了原位置。
    const restored = serializeManuscript({
      chapterNumber: 1,
      chapterTitle: '同名',
      content: '续跑后重写的新正文',
    })
    fs.writeFileSync(path.join(projectRoot, targetFileName), restored, 'utf8')

    const retried = await service.retry(projectRoot, 'reservation-chain-1')
    expect(retried).toMatchObject({ success: true, committed: true, operation: { status: 'completed' } })
    expect(retried.operation?.manuscriptStatus).toBe('completed')
    expect(fs.readFileSync(path.join(projectRoot, targetFileName), 'utf8')).toBe(restored)
    expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).toBeNull()
  })
})
