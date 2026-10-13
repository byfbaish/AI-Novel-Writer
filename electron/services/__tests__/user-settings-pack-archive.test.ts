import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'

import {
  readUserSettingsPackArchive,
  writeUserSettingsPackArchive,
} from '../user-settings-pack-archive'
import { UserSettingsPackError, parseUserSettingsPackManifest } from '../user-settings-pack-format'

const roots: string[] = []
const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vela-pack-test-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  CRC_TABLE[index] = value >>> 0
}
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}

/** 手工构造 store-only zip，用于验证读取侧的拒绝路径（写入器自身不做非法形状）。 */
function storedZip(entries: Array<{ name: string; bytes: Buffer }>): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const item of entries) {
    const name = Buffer.from(item.name, 'utf8')
    const checksum = crc32(item.bytes)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(item.bytes.length, 18)
    local.writeUInt32LE(item.bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    central.push((() => {
      const header = Buffer.alloc(46)
      header.writeUInt32LE(0x02014b50, 0)
      header.writeUInt16LE((3 << 8) | 20, 4)
      header.writeUInt16LE(20, 6)
      header.writeUInt16LE(0x0800, 8)
      header.writeUInt32LE(checksum, 16)
      header.writeUInt32LE(item.bytes.length, 20)
      header.writeUInt32LE(item.bytes.length, 24)
      header.writeUInt16LE(name.length, 28)
      header.writeUInt32LE(((0o100600 << 16) >>> 0), 38)
      header.writeUInt32LE(offset, 42)
      return Buffer.concat([header, name])
    })())
    parts.push(local, name, item.bytes)
    offset += local.length + name.length + item.bytes.length
  }
  const centralBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBytes, end])
}

const promptBytes = Buffer.from(JSON.stringify({ key: 'premise', writingLanguage: 'zh-CN', content: '番茄文风' }), 'utf8')
const skillBytes = Buffer.from('---\nname: style-guide\n---\n# 番茄叙事\n', 'utf8')

function packManifest(files: Array<{ path: string; bytes: Buffer }>) {
  const entries = files.map(file => ({ path: file.path, byteSize: file.bytes.length, sha256: sha(file.bytes) }))
  return parseUserSettingsPackManifest({
    formatVersion: 1,
    kind: 'creative-assets',
    createdAt: new Date('2026-10-13T02:30:00.000Z').toISOString(),
    appVersion: '1.0.0',
    entryCount: entries.length,
    declaredUncompressedBytes: entries.reduce((sum, entry) => sum + entry.byteSize, 0),
    promptFileNames: files.filter(file => file.path.startsWith('prompts/')).map(file => file.path.slice('prompts/'.length)),
    skillNames: files.filter(file => file.path.startsWith('skills/')).map(file => file.path.split('/')[1]!),
    entries,
  })
}

async function codeOfAsync(callback: () => Promise<unknown>): Promise<string> {
  try {
    await callback()
  } catch (error) {
    if (error instanceof UserSettingsPackError) return error.code
    throw error
  }
  return 'NO_THROW'
}

describe('user settings pack archive', () => {
  it('往返保留中文内容、路径与 manifest 指纹', async () => {
    const root = workspace()
    const files = [
      { path: 'prompts/premise.zh-CN.json', bytes: promptBytes },
      { path: 'skills/style-guide/SKILL.md', bytes: skillBytes },
    ]
    const target = path.join(root, 'assets.vela-pack')
    const written = await writeUserSettingsPackArchive({ manifest: packManifest(files), files, targetPath: target })
    expect(written.archiveBytes).toBe(fs.statSync(target).size)

    const read = await readUserSettingsPackArchive({ archivePath: target })
    expect(read.manifest.promptFileNames).toEqual(['premise.zh-CN.json'])
    expect(read.files.get('prompts/premise.zh-CN.json')!.toString('utf8')).toContain('番茄文风')
    expect(read.files.get('skills/style-guide/SKILL.md')!.toString('utf8')).toContain('番茄叙事')
    expect(read.manifestSha256).toBe(written.manifestSha256)
  })

  it('目标文件已存在时拒绝覆盖', async () => {
    const root = workspace()
    const files = [{ path: 'prompts/premise.zh-CN.json', bytes: promptBytes }]
    const manifest = parseUserSettingsPackManifest({
      formatVersion: 1,
      kind: 'creative-assets',
      createdAt: new Date('2026-10-13T02:30:00.000Z').toISOString(),
      appVersion: null,
      entryCount: 1,
      declaredUncompressedBytes: promptBytes.length,
      promptFileNames: ['premise.zh-CN.json'],
      skillNames: [],
      entries: [{ path: 'prompts/premise.zh-CN.json', byteSize: promptBytes.length, sha256: sha(promptBytes) }],
    })
    const target = path.join(root, 'exists.vela-pack')
    fs.writeFileSync(target, 'occupied')
    expect(await codeOfAsync(() => writeUserSettingsPackArchive({ manifest, files, targetPath: target })))
      .toBe('USER_PACK_TARGET_EXISTS')
  })

  it('payload 与 manifest 声明不符时拒绝（sha256 逐文件复核）', async () => {
    const root = workspace()
    const manifest = packManifest([
      { path: 'prompts/premise.zh-CN.json', bytes: promptBytes },
      { path: 'skills/style-guide/SKILL.md', bytes: skillBytes },
    ])
    // manifest 声明 A 内容，zip 里放的是被替换过的 B 内容。
    const tampered = storedZip([
      { name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest), 'utf8') },
      { name: 'prompts/premise.zh-CN.json', bytes: Buffer.from(JSON.stringify({ key: 'premise', writingLanguage: 'zh-CN', content: '被改写' }), 'utf8') },
      { name: 'skills/style-guide/SKILL.md', bytes: skillBytes },
    ])
    const target = path.join(root, 'tampered.vela-pack')
    fs.writeFileSync(target, tampered)
    expect(await codeOfAsync(() => readUserSettingsPackArchive({ archivePath: target }))).toBe('USER_PACK_INVALID')
  })

  it('manifest 不是第一个条目时拒绝', async () => {
    const root = workspace()
    const manifest = packManifest([{ path: 'prompts/premise.zh-CN.json', bytes: promptBytes }])
    const target = path.join(root, 'reordered.vela-pack')
    fs.writeFileSync(target, storedZip([
      { name: 'prompts/premise.zh-CN.json', bytes: promptBytes },
      { name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest), 'utf8') },
    ]))
    expect(await codeOfAsync(() => readUserSettingsPackArchive({ archivePath: target }))).toBe('USER_PACK_INVALID')
  })

  it('zip 内条目带目录穿越路径时拒绝', async () => {
    const root = workspace()
    const escaped = { path: 'prompts/premise.zh-CN.json', byteSize: promptBytes.length, sha256: sha(promptBytes) }
    const manifest = {
      formatVersion: 1,
      kind: 'creative-assets',
      createdAt: new Date('2026-10-13T02:30:00.000Z').toISOString(),
      appVersion: null,
      entryCount: 1,
      declaredUncompressedBytes: promptBytes.length,
      promptFileNames: ['premise.zh-CN.json'],
      skillNames: [],
      entries: [escaped],
    }
    const target = path.join(root, 'traversal.vela-pack')
    fs.writeFileSync(target, storedZip([
      { name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest), 'utf8') },
      { name: 'prompts/../../escape.json', bytes: promptBytes },
    ]))
    expect(await codeOfAsync(() => readUserSettingsPackArchive({ archivePath: target }))).toBe('USER_PACK_INVALID')
  })

  it('非 zip 内容直接拒绝', async () => {
    const root = workspace()
    const target = path.join(root, 'not-zip.vela-pack')
    fs.writeFileSync(target, 'definitely not a zip archive')
    expect(await codeOfAsync(() => readUserSettingsPackArchive({ archivePath: target }))).toBe('USER_PACK_INVALID')
  })
})
