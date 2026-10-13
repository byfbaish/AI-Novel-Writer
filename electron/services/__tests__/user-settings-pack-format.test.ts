import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  USER_SETTINGS_PACK_LIMITS,
  UserSettingsPackError,
  parseUserSettingsPackManifest,
} from '../user-settings-pack-format'

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

const promptBytes = Buffer.from(JSON.stringify({ key: 'premise', writingLanguage: 'zh-CN', content: 'x' }), 'utf8')
const skillBytes = Buffer.from('---\nname: style-guide\n---\n# guide\n', 'utf8')

function validManifest() {
  return {
    formatVersion: 1,
    kind: 'creative-assets',
    createdAt: new Date('2026-10-13T02:30:00.000Z').toISOString(),
    appVersion: '1.0.0',
    entryCount: 2,
    declaredUncompressedBytes: promptBytes.length + skillBytes.length,
    promptFileNames: ['premise.zh-CN.json'],
    skillNames: ['style-guide'],
    entries: [
      { path: 'prompts/premise.zh-CN.json', byteSize: promptBytes.length, sha256: sha(promptBytes) },
      { path: 'skills/style-guide/SKILL.md', byteSize: skillBytes.length, sha256: sha(skillBytes) },
    ],
  }
}

function codeOf(callback: () => unknown): string {
  try {
    callback()
  } catch (error) {
    if (error instanceof UserSettingsPackError) return error.code
    throw error
  }
  return 'NO_THROW'
}

describe('user settings pack manifest', () => {
  it('接受形状完整且自洽的创作资产包 manifest', () => {
    const manifest = parseUserSettingsPackManifest(validManifest())
    expect(manifest.kind).toBe('creative-assets')
    expect(manifest.entries).toHaveLength(2)
    expect(manifest.declaredUncompressedBytes).toBe(promptBytes.length + skillBytes.length)
  })

  it('未知字段一律失败，而不是被忽略', () => {
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), extra: true }))).toBe('USER_PACK_INVALID')
    const withExtraEntryKey = validManifest()
    withExtraEntryKey.entries[0] = { ...withExtraEntryKey.entries[0]!, mode: 'x' } as never
    expect(codeOf(() => parseUserSettingsPackManifest(withExtraEntryKey))).toBe('USER_PACK_INVALID')
  })

  it('语言版本不受支持时给出专用错误码', () => {
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), formatVersion: 2 })))
      .toBe('USER_PACK_VERSION_UNSUPPORTED')
  })

  it('拒绝目录穿越与白名单之外的条目路径', () => {
    const traversal = validManifest()
    traversal.entries[0] = { ...traversal.entries[0]!, path: 'prompts/../escape.json' }
    expect(codeOf(() => parseUserSettingsPackManifest(traversal))).toBe('USER_PACK_INVALID')

    const foreign = validManifest()
    foreign.entries[1] = { ...foreign.entries[1]!, path: 'models.json' }
    foreign.skillNames = []
    foreign.entryCount = 2
    expect(codeOf(() => parseUserSettingsPackManifest(foreign))).toBe('USER_PACK_INVALID')

    const backslash = validManifest()
    backslash.entries[0] = { ...backslash.entries[0]!, path: 'prompts\\premise.zh-CN.json' }
    expect(codeOf(() => parseUserSettingsPackManifest(backslash))).toBe('USER_PACK_INVALID')
  })

  it('拒绝 declaredUncompressedBytes、entryCount 与实际条目不符', () => {
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), declaredUncompressedBytes: 1 })))
      .toBe('USER_PACK_LIMIT_EXCEEDED')
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), entryCount: 1 })))
      .toBe('USER_PACK_INVALID')
  })

  it('declaredUncompressedBytes 超上限时拒绝', () => {
    const oversized = validManifest()
    oversized.declaredUncompressedBytes = USER_SETTINGS_PACK_LIMITS.maxTotalBytes + 1
    expect(codeOf(() => parseUserSettingsPackManifest(oversized))).toBe('USER_PACK_LIMIT_EXCEEDED')
  })

  it('拒绝 promptFileNames 与实际条目不一致（防清单与内容错配）', () => {
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), promptFileNames: ['premise.en-US.json'] })))
      .toBe('USER_PACK_INVALID')
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), skillNames: [] })))
      .toBe('USER_PACK_INVALID')
  })

  it('拒绝大小写不同的重复路径（Windows 语义下会互相覆盖）', () => {
    const duplicated = validManifest()
    duplicated.entries[1] = {
      path: 'prompts/PREMISE.zh-CN.json',
      byteSize: skillBytes.length,
      sha256: sha(skillBytes),
    }
    duplicated.skillNames = []
    duplicated.declaredUncompressedBytes = promptBytes.length + skillBytes.length
    expect(codeOf(() => parseUserSettingsPackManifest(duplicated))).toBe('USER_PACK_INVALID')
  })

  it('拒绝非 ISO 时间与非法 sha256', () => {
    expect(codeOf(() => parseUserSettingsPackManifest({ ...validManifest(), createdAt: '2026-10-13' })))
      .toBe('USER_PACK_INVALID')
    const badHash = validManifest()
    badHash.entries[0] = { ...badHash.entries[0]!, sha256: 'not-a-hash' }
    expect(codeOf(() => parseUserSettingsPackManifest(badHash))).toBe('USER_PACK_INVALID')
  })
})
