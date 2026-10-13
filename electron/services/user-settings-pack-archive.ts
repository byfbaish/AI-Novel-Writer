import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import * as yauzl from 'yauzl'

import {
  USER_SETTINGS_PACK_LIMITS,
  UserSettingsPackError,
  fail,
  parseUserSettingsPackManifest,
  type UserSettingsPackLimits,
  type UserSettingsPackManifest,
} from './user-settings-pack-format'

/**
 * `.vela-pack` 的容器读写（store-only zip）。
 *
 * 为什么不复用 `portable-project-archive`：那里的 manifest 被 `exactKeys` 冻结在项目存档的
 * 12 个字段上（`parsePortableProjectManifest`），且写入器面向"从磁盘大文件流式拷贝 + TOCTOU 身份复核"。
 * 创作资产包是 <16 MiB 的小包，语义也不同，因此这里用同一套 zip 编码规则独立实现，
 * 但保留相同的安全姿态：**临时文件 + 无覆盖硬链接发布**、逐文件 sha256 复核、未知形状一律失败。
 *
 * fd 归属：`yauzl.fromFd` 在 `autoClose` 下自行管理描述符（fd-slicer 引用计数归零即关闭），
 * 因此字节必须在**遍历过程中**取完，且交给 yauzl 之后绝不再手动关闭，避免二次 close。
 */

const MANIFEST_PATH = 'manifest.json'
const ZIP_LOCAL = 0x04034b50
const ZIP_CENTRAL = 0x02014b50
const ZIP_END = 0x06054b50
const UTF8_FLAG = 0x0800
const UNIX_REGULAR_MODE = 0o100600

const CRC_TABLE = new Uint32Array(256)
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  CRC_TABLE[index] = value >>> 0
}

type RawEntry = yauzl.Entry & { fileName: Buffer; fileComment: Buffer }

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function normalizeRealPath(value: string): string {
  const normalized = path.normalize(value).replace(/^\\\\\?\\/u, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

/** 每个路径段都必须是同一个真实目录（不跟随符号链接/联接点）。 */
function assertSafeDirectory(directory: string): void {
  const absolute = path.resolve(directory)
  let cursor = path.parse(absolute).root
  for (const segment of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment)
    let info: fs.Stats
    try {
      info = fs.lstatSync(cursor)
    } catch {
      fail('USER_PACK_SOURCE_UNSAFE')
    }
    if (!info.isDirectory() || info.isSymbolicLink()
      || normalizeRealPath(fs.realpathSync.native(cursor)) !== normalizeRealPath(cursor)) {
      fail('USER_PACK_SOURCE_UNSAFE')
    }
  }
}

function assertRegularFile(filePath: string): fs.BigIntStats {
  const absolute = path.resolve(filePath)
  try {
    const info = fs.lstatSync(absolute, { bigint: true })
    if (!info.isFile() || info.isSymbolicLink()
      || normalizeRealPath(fs.realpathSync.native(absolute)) !== normalizeRealPath(absolute)) {
      fail('USER_PACK_SOURCE_UNSAFE')
    }
    return info
  } catch (error) {
    if (error instanceof UserSettingsPackError) throw error
    fail('USER_PACK_SOURCE_UNSAFE')
  }
}

function localHeader(name: Buffer, size: number, checksum: number): Buffer {
  const header = Buffer.alloc(30)
  header.writeUInt32LE(ZIP_LOCAL, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(UTF8_FLAG, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt32LE(checksum, 14)
  header.writeUInt32LE(size, 18)
  header.writeUInt32LE(size, 22)
  header.writeUInt16LE(name.length, 26)
  header.writeUInt16LE(0, 28)
  return Buffer.concat([header, name])
}

function centralHeader(name: Buffer, size: number, checksum: number, offset: number): Buffer {
  const header = Buffer.alloc(46)
  header.writeUInt32LE(ZIP_CENTRAL, 0)
  header.writeUInt16LE((3 << 8) | 20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(UTF8_FLAG, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt32LE(checksum, 16)
  header.writeUInt32LE(size, 20)
  header.writeUInt32LE(size, 24)
  header.writeUInt16LE(name.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(((UNIX_REGULAR_MODE << 16) >>> 0), 38)
  header.writeUInt32LE(offset, 42)
  return Buffer.concat([header, name])
}

function zipEnd(entryCount: number, centralSize: number, centralOffset: number): Buffer {
  const end = Buffer.alloc(22)
  end.writeUInt32LE(ZIP_END, 0)
  end.writeUInt16LE(entryCount, 8)
  end.writeUInt16LE(entryCount, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralOffset, 16)
  return end
}

export interface WriteUserSettingsPackInput {
  manifest: UserSettingsPackManifest
  /** 与 `manifest.entries` 一一对应，顺序必须一致。 */
  files: ReadonlyArray<{ path: string; bytes: Buffer }>
  targetPath: string
  /** @internal 仅供信任边界竞态测试注入。 */
  __testHooks?: {
    beforePublish?(temporaryPath: string, targetPath: string): void
  }
}

export interface WriteUserSettingsPackReceipt {
  archiveBytes: number
  manifestSha256: string
}

export async function writeUserSettingsPackArchive(
  input: WriteUserSettingsPackInput,
): Promise<WriteUserSettingsPackReceipt> {
  const manifest = parseUserSettingsPackManifest(input.manifest)
  if (input.files.length !== manifest.entries.length) fail('USER_PACK_INVALID')
  const ordered = manifest.entries.map((entry, index) => {
    const file = input.files[index]!
    if (file.path !== entry.path || file.bytes.length !== entry.byteSize || sha256(file.bytes) !== entry.sha256) {
      fail('USER_PACK_INVALID')
    }
    return { entry, bytes: file.bytes }
  })

  const target = path.resolve(input.targetPath)
  const targetParent = path.dirname(target)
  assertSafeDirectory(targetParent)
  try {
    fs.lstatSync(target)
    fail('USER_PACK_TARGET_EXISTS')
  } catch (error) {
    if (error instanceof UserSettingsPackError) throw error
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const temporary = path.join(targetParent, `.vela-pack-${randomUUID()}.tmp`)
  let handle: fs.promises.FileHandle
  try {
    handle = await fs.promises.open(temporary, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') fail('USER_PACK_TARGET_EXISTS')
    throw error
  }
  try {
    const manifestBytes = Buffer.from(JSON.stringify(manifest), 'utf8')
    const manifestName = Buffer.from(MANIFEST_PATH, 'utf8')
    const parts: Buffer[] = []
    const central: Buffer[] = []
    let offset = 0

    const pushEntry = (name: Buffer, bytes: Buffer): void => {
      const checksum = crc32(bytes)
      const local = localHeader(name, bytes.length, checksum)
      central.push(centralHeader(name, bytes.length, checksum, offset))
      parts.push(local, bytes)
      offset += local.length + bytes.length
    }

    pushEntry(manifestName, manifestBytes)
    for (const item of ordered) pushEntry(Buffer.from(item.entry.path, 'utf8'), item.bytes)

    const centralOffset = offset
    const centralBytes = Buffer.concat(central)
    const tail = zipEnd(manifest.entries.length + 1, centralBytes.length, centralOffset)
    const payload = Buffer.concat([...parts, centralBytes, tail])

    await handle.writeFile(payload)
    await handle.sync()
    const before = await handle.stat({ bigint: true })
    input.__testHooks?.beforePublish?.(temporary, target)
    const after = fs.lstatSync(temporary, { bigint: true })
    if (!before.isFile() || after.isSymbolicLink() || before.ino !== after.ino || before.size !== after.size
      || normalizeRealPath(fs.realpathSync.native(temporary)) !== normalizeRealPath(temporary)) {
      fail('USER_PACK_SOURCE_UNSAFE')
    }
    try {
      fs.linkSync(temporary, target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') fail('USER_PACK_TARGET_EXISTS')
      fail('USER_PACK_INVALID')
    }
    return { archiveBytes: payload.length, manifestSha256: sha256(manifestBytes) }
  } finally {
    let cleanup: fs.BigIntStats | undefined
    try { cleanup = await handle.stat({ bigint: true }) } catch { /* 保留现场 */ }
    await handle.close()
    try {
      const actual = fs.lstatSync(temporary, { bigint: true })
      if (cleanup && actual.isFile() && !actual.isSymbolicLink() && cleanup.ino === actual.ino
        && normalizeRealPath(fs.realpathSync.native(temporary)) === normalizeRealPath(temporary)) {
        fs.unlinkSync(temporary)
      }
    } catch { /* 不删除已被替换或未知的路径 */ }
  }
}

export interface ReadUserSettingsPackInput {
  archivePath: string
  limits?: Partial<UserSettingsPackLimits>
}

export interface ReadUserSettingsPackResult {
  manifest: UserSettingsPackManifest
  /** key = manifest entry path（保持原始大小写）。 */
  files: Map<string, Buffer>
  archiveBytes: number
  manifestSha256: string
}

function openArchive(fd: number): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromFd(fd, {
      autoClose: true,
      lazyEntries: true,
      decodeStrings: false,
      validateEntrySizes: true,
    }, (error, zip) => error || !zip ? reject(error ?? new Error('missing zip')) : resolve(zip))
  })
}

function decodeName(entry: RawEntry): string {
  if ((entry.generalPurposeBitFlag & UTF8_FLAG) === 0) fail('USER_PACK_INVALID')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(entry.fileName)
  } catch {
    fail('USER_PACK_INVALID')
  }
}

function assertEntryMetadata(entry: RawEntry, limits: UserSettingsPackLimits): void {
  if (entry.isEncrypted() || entry.compressionMethod !== 0
    || (entry.generalPurposeBitFlag & ~UTF8_FLAG) !== 0
    || entry.fileComment.length !== 0 || entry.internalFileAttributes !== 0
    || (entry.externalFileAttributes & 0x10) !== 0 || (entry.externalFileAttributes & 0x400) !== 0) {
    fail('USER_PACK_INVALID')
  }
  if (entry.fileName.length === 0 || entry.fileName.length > limits.maxPathBytes) fail('USER_PACK_INVALID')
  if (entry.uncompressedSize > limits.maxEntryBytes) fail('USER_PACK_LIMIT_EXCEEDED')
}

interface ArchiveEntry {
  name: string
  bytes: Buffer
}

/** 边遍历边取字节：yauzl 在读完中央目录后可能自行关闭描述符，因此不能在遍历结束后再取流。 */
function readArchiveEntries(zip: yauzl.ZipFile, limits: UserSettingsPackLimits): Promise<ArchiveEntry[]> {
  return new Promise((resolve, reject) => {
    const results: ArchiveEntry[] = []
    let total = 0
    let settled = false
    const abort = (error: unknown): void => {
      if (settled) return
      settled = true
      try { zip.close() } catch { /* 已关闭 */ }
      reject(error)
    }
    zip.once('error', () => abort(new UserSettingsPackError('USER_PACK_INVALID')))
    zip.on('entry', raw => {
      if (settled) return
      const entry = raw as RawEntry
      let name: string
      try {
        assertEntryMetadata(entry, limits)
        if (results.length >= limits.maxEntries) fail('USER_PACK_LIMIT_EXCEEDED')
        total += entry.uncompressedSize
        if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) fail('USER_PACK_LIMIT_EXCEEDED')
        name = decodeName(entry)
      } catch (error) {
        abort(error)
        return
      }
      zip.openReadStream(entry, (error, stream) => {
        if (settled) {
          stream?.destroy()
          return
        }
        if (error || !stream) {
          abort(new UserSettingsPackError('USER_PACK_INVALID'))
          return
        }
        const chunks: Buffer[] = []
        let read = 0
        stream.on('data', chunk => {
          if (settled) return
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          read += bytes.length
          if (read > limits.maxEntryBytes) {
            stream.destroy()
            abort(new UserSettingsPackError('USER_PACK_LIMIT_EXCEEDED'))
            return
          }
          chunks.push(bytes)
        })
        stream.once('error', () => abort(new UserSettingsPackError('USER_PACK_INVALID')))
        stream.once('end', () => {
          if (settled) return
          const bytes = Buffer.concat(chunks, read)
          if (bytes.length !== entry.uncompressedSize || crc32(bytes) !== entry.crc32) {
            abort(new UserSettingsPackError('USER_PACK_INVALID'))
            return
          }
          results.push({ name, bytes })
          zip.readEntry()
        })
      })
    })
    zip.once('end', () => {
      if (settled) return
      settled = true
      resolve(results)
    })
    zip.readEntry()
  })
}

export async function readUserSettingsPackArchive(
  input: ReadUserSettingsPackInput,
): Promise<ReadUserSettingsPackResult> {
  const limits = { ...USER_SETTINGS_PACK_LIMITS, ...input.limits }
  const archivePath = path.resolve(input.archivePath)
  const before = assertRegularFile(archivePath)
  const descriptor = fs.openSync(archivePath, 'r')
  let zip: yauzl.ZipFile | undefined
  let handedToYauzl = false
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true })
    if (opened.ino !== before.ino || opened.size !== before.size) fail('USER_PACK_SOURCE_UNSAFE')
    zip = await openArchive(descriptor)
    handedToYauzl = true

    const entries = await readArchiveEntries(zip, limits)
    if (entries.length < 2 || entries[0]!.name !== MANIFEST_PATH) fail('USER_PACK_INVALID')
    if (entries.slice(1).some(entry => entry.name === MANIFEST_PATH)) fail('USER_PACK_INVALID')

    const manifestBytes = entries[0]!.bytes
    let manifestValue: unknown
    try {
      manifestValue = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes))
    } catch {
      fail('USER_PACK_INVALID')
    }
    const manifest = parseUserSettingsPackManifest(manifestValue, limits)
    if (entries.length - 1 !== manifest.entries.length) fail('USER_PACK_INVALID')

    const files = new Map<string, Buffer>()
    for (const [index, entry] of entries.slice(1).entries()) {
      const expected = manifest.entries[index]!
      if (entry.name !== expected.path || entry.bytes.length !== expected.byteSize) fail('USER_PACK_INVALID')
      if (sha256(entry.bytes) !== expected.sha256) fail('USER_PACK_INVALID')
      files.set(expected.path, entry.bytes)
    }

    const afterPath = assertRegularFile(archivePath)
    if (afterPath.ino !== before.ino || afterPath.size !== before.size) fail('USER_PACK_SOURCE_UNSAFE')
    return {
      manifest,
      files,
      archiveBytes: Number(before.size),
      manifestSha256: sha256(manifestBytes),
    }
  } catch (error) {
    if (error instanceof UserSettingsPackError) throw error
    throw new UserSettingsPackError('USER_PACK_INVALID')
  } finally {
    try { zip?.close() } catch { /* 已关闭 */ }
    if (!handedToYauzl) {
      try { fs.closeSync(descriptor) } catch { /* 已被底层释放 */ }
    }
  }
}
