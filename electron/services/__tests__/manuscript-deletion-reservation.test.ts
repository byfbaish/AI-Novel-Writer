import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  listReservedManuscriptTargets,
  publishManuscript,
  readManuscriptDeletionReservation,
  removePublishedManuscript,
  reserveManuscriptDeletionTarget,
  resolveManuscriptTarget,
  serializeManuscript,
} from '../manuscript-publisher'

const roots: string[] = []

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-manuscript-reservation-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

const targetFileName = '第1章 起点.txt'
const chapter = { chapterNumber: 1, chapterTitle: '起点' } as const

function targetPath(projectRoot: string): string {
  return path.join(projectRoot, targetFileName)
}

async function publishOldManuscript(projectRoot: string): Promise<string> {
  const published = serializeManuscript({ ...chapter, content: '旧正文' })
  await publishManuscript({ projectRoot, targetFileName, ...chapter, content: '旧正文' })
  expect(fs.readFileSync(targetPath(projectRoot), 'utf8')).toBe(published)
  return published
}

function reserveOldManuscript(projectRoot: string, content: string | null = '旧正文'): void {
  const created = reserveManuscriptDeletionTarget({
    projectRoot,
    targetFileName,
    finalizationId: 'finalization-old',
    ...chapter,
    content,
  })
  expect(created).toBe(true)
  expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).not.toBeNull()
}

describe('manuscript deletion reservation (C2 recycle placeholder)', () => {
  it('keeps the restored same-name manuscript and only clears the receipt when cleanup resumes', async () => {
    const projectRoot = makeRoot()
    await publishOldManuscript(projectRoot)
    reserveOldManuscript(projectRoot)

    // 删除收据还没清完，作者把「同名新稿」放回了原位置。
    const restored = serializeManuscript({ ...chapter, content: '续跑后重写的新正文' })
    fs.writeFileSync(targetPath(projectRoot), restored, 'utf8')

    await removePublishedManuscript(projectRoot, targetFileName)

    expect(fs.existsSync(targetPath(projectRoot))).toBe(true)
    expect(fs.readFileSync(targetPath(projectRoot), 'utf8')).toBe(restored)
    expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).toBeNull()
    expect(listReservedManuscriptTargets(projectRoot).size).toBe(0)
  })

  it('removes the manuscript the receipt owns and clears the receipt', async () => {
    const projectRoot = makeRoot()
    await publishOldManuscript(projectRoot)
    reserveOldManuscript(projectRoot)

    await removePublishedManuscript(projectRoot, targetFileName)

    expect(fs.existsSync(targetPath(projectRoot))).toBe(false)
    expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).toBeNull()
    expect(listReservedManuscriptTargets(projectRoot).size).toBe(0)
  })

  it('treats an already removed manuscript as a completed projection and still clears the receipt', async () => {
    const projectRoot = makeRoot()
    await publishOldManuscript(projectRoot)
    reserveOldManuscript(projectRoot)
    fs.rmSync(targetPath(projectRoot), { force: true })

    await expect(removePublishedManuscript(projectRoot, targetFileName)).resolves.toBeUndefined()

    expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).toBeNull()
  })

  it('keeps an unknown-ownership file when the receipt could not record its digest', async () => {
    const projectRoot = makeRoot()
    const stranger = serializeManuscript({ ...chapter, content: '作者自己的另一份稿' })
    fs.writeFileSync(targetPath(projectRoot), stranger, 'utf8')
    reserveOldManuscript(projectRoot, null)

    await removePublishedManuscript(projectRoot, targetFileName)

    expect(fs.readFileSync(targetPath(projectRoot), 'utf8')).toBe(stranger)
    expect(readManuscriptDeletionReservation(projectRoot, targetFileName)).toBeNull()
  })

  it('keeps the legacy by-name removal for receipts without any reservation', async () => {
    const projectRoot = makeRoot()
    await publishOldManuscript(projectRoot)

    await removePublishedManuscript(projectRoot, targetFileName)

    expect(fs.existsSync(targetPath(projectRoot))).toBe(false)
  })

  it('never reuses a reserved file name even when the old manuscript is already gone', () => {
    const projectRoot = makeRoot()
    const preferred = resolveManuscriptTarget({
      projectRoot,
      ...chapter,
      finalizationId: 'finalization-old',
      reserved: listReservedManuscriptTargets(projectRoot),
    })
    reserveManuscriptDeletionTarget({
      projectRoot,
      targetFileName: preferred.fileName,
      finalizationId: 'finalization-old',
      ...chapter,
      content: '旧正文',
    })

    const next = resolveManuscriptTarget({
      projectRoot,
      ...chapter,
      finalizationId: 'finalization-new',
      reserved: listReservedManuscriptTargets(projectRoot),
    })

    expect(preferred.fileName).toBe(targetFileName)
    expect(fs.existsSync(preferred.absolutePath)).toBe(false)
    expect(next.fileName).not.toBe(preferred.fileName)
    expect(next.fileName).toContain(' (finalization)')
  })

  it('honours an explicit reserved set handed in by the caller', () => {
    const projectRoot = makeRoot()
    const next = resolveManuscriptTarget({
      projectRoot,
      ...chapter,
      finalizationId: 'finalization-new',
      reserved: new Set([targetFileName.toLowerCase()]),
    })

    expect(next.fileName).not.toBe(targetFileName)
  })
})
