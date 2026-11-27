import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { CANONICAL_PROJECT_DIRECTORY } from '../../src/shared/project-format'

const WINDOWS_ILLEGAL_FILE_NAME_CHARS = /[<>:"/\\|?*]/g
/**
 * 删除收据占位目录：放在项目私有存储区的 `trash/` 下，随项目一起备份/恢复，
 * 不进作者可见的稿件区。**不能新开 `.ai-novel` 顶层名**：便携项目导出按顶层名
 * 白名单校验（只认 `CANONICAL_RAW_PROJECT_ASSETS` 与既有的 omitted 名单），
 * 多一个顶层目录会让导出直接 `PORTABLE_ASSET_UNSAFE`。
 */
const MANUSCRIPT_DELETION_RESERVATION_DIRECTORY = path.join('trash', 'manuscript-deletions')
const WINDOWS_RESERVED_FILE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

function replaceWindowsControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined && codePoint <= 0x1f ? '_' : character
  }).join('')
}

export interface ManuscriptTargetInput {
  projectRoot: string
  chapterNumber: number
  chapterTitle: string
  finalizationId: string
  /**
   * 在途删除收据正在认领的文件名（小写）。这些名字**一律不得再被发布占用**：
   * 盘上可能还留着旧稿、也可能已被挪走，两种状态都不该被新稿顶到同名位置，
   * 否则续跑清理会按同名把刚放回来的新稿删掉（丢稿）。
   *
   * **必填**（卡 d9117e48 补正 A）：调用点必须显式给出。正常取值是
   * `listReservedManuscriptTargets(projectRoot)`；传空集等于放弃这层保护。
   * 运行时仍保留 `undefined` 兜底（见 `resolveManuscriptTarget`），
   * 只为兼容不经过类型检查的 JS 调用方，类型层面不允许漏传。
   */
  reserved: ReadonlySet<string>
}

export interface ManuscriptTarget {
  fileName: string
  absolutePath: string
}

export interface PublishManuscriptInput {
  projectRoot: string
  targetFileName: string
  chapterNumber: number
  chapterTitle: string
  content: string
}

function sanitizeWindowsFileNamePart(value: string): string {
  const normalized = replaceWindowsControlCharacters(
    value.replace(WINDOWS_ILLEGAL_FILE_NAME_CHARS, '_'),
  )
    .trim()
    .replace(/[. ]+$/g, '')
  if (!normalized) return ''
  return WINDOWS_RESERVED_FILE_NAME.test(normalized)
    ? `${normalized}_`
    : normalized
}

function manuscriptFileName(chapterNumber: number, chapterTitle: string): string {
  const title = sanitizeWindowsFileNamePart(chapterTitle)
  return title ? `第${chapterNumber}章 ${title}.txt` : `第${chapterNumber}章.txt`
}

function containedDirectChild(projectRoot: string, fileName: string): ManuscriptTarget {
  const root = path.resolve(projectRoot)
  const absolutePath = path.resolve(root, fileName)
  if (path.dirname(absolutePath) !== root || path.basename(absolutePath) !== fileName) {
    throw new Error('实体稿目标越出受信项目 manuscript 边界')
  }
  return { fileName, absolutePath }
}

/**
 * 生成仅属于受信项目根目录的实体稿路径。目标名称会在 SQLite outbox 中冻结，
 * 重试绝不重新接受渲染进程提供的路径或标题。
 */
export function resolveManuscriptTarget(input: ManuscriptTargetInput): ManuscriptTarget {
  if (!Number.isInteger(input.chapterNumber) || input.chapterNumber < 1) {
    throw new Error('章节号无效，无法生成实体稿目标')
  }
  // `reserved` 类型上必填；`??` 只是运行时兜底，防不经过类型检查的 JS 调用方传 undefined。
  const reserved = input.reserved ?? listReservedManuscriptTargets(input.projectRoot)
  const taken = (candidate: ManuscriptTarget): boolean =>
    fs.existsSync(candidate.absolutePath) || reserved.has(candidate.fileName.toLowerCase())
  const preferred = manuscriptFileName(input.chapterNumber, input.chapterTitle)
  const first = containedDirectChild(input.projectRoot, preferred)
  if (!taken(first)) return first

  const parsed = path.parse(preferred)
  const collisionMarker = sanitizeWindowsFileNamePart(input.finalizationId).slice(0, 12) || 'finalized'
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? ` (${collisionMarker})` : ` (${collisionMarker}-${index})`
    const candidate = containedDirectChild(input.projectRoot, `${parsed.name}${suffix}${parsed.ext}`)
    if (!taken(candidate)) return candidate
  }
  throw new Error('实体稿文件名碰撞过多，拒绝覆盖现有文件')
}

function resolveStoredManuscriptTarget(projectRoot: string, targetFileName: string): ManuscriptTarget {
  if (!targetFileName || targetFileName !== path.basename(targetFileName)) {
    throw new Error('已提交的实体稿目标无效')
  }
  return containedDirectChild(projectRoot, targetFileName)
}

export function serializeManuscript(input: Omit<PublishManuscriptInput, 'projectRoot' | 'targetFileName'>): string {
  const title = sanitizeWindowsFileNamePart(input.chapterTitle)
  const header = title
    ? `第${input.chapterNumber}章 ${title}\n\n`
    : `第${input.chapterNumber}章\n\n`
  return header + input.content.replace(/^#+ .*\r?\n*/, '')
}

/**
 * 删除收据占位（2026-11-27，卡 d9117e48）：一条章节删除收据在清理实体稿期间，
 * 在盘上登记「这个名字归我处理」，让两件事同时成立：
 * 1. 选目标处不再占用这个名字（新稿换名发布，不会顶到旧稿位置）；
 * 2. 续跑清理只删**内容仍是当初那份**的旧稿；盘上已是别的文件（作者刚放回的新稿）
 *    就保留文件、只清收据 —— 这是本卡要堵的丢稿点。
 *
 * 只落盘不落库：`chapter_deletion_operations` 加列需要迁移，不在本卡白名单内。
 */
export interface ManuscriptDeletionReservation {
  /** 被认领的文件名（原始大小写；比对时统一小写）。 */
  targetFileName: string
  /**
   * 收据所属实体稿的 sha256（对 `serializeManuscript` 后的全文取摘要）。
   * 空串 = 登记时已读不到冻结正文（旧收据续跑），所有权不明：
   * 清理时不得按文件名删除，只能保留盘上文件、只清收据。
   */
  contentDigest: string
  /** 登记时间（ISO 8601），仅作审计与清理时机判断。 */
  registeredAt: string
  /** 认领该目标的定稿标识，仅作审计。 */
  finalizationId: string
}

export interface ReserveManuscriptDeletionInput {
  projectRoot: string
  targetFileName: string
  finalizationId: string
  chapterNumber: number
  chapterTitle: string
  /** outbox 冻结正文；`null` = 读不到，按「所有权不明」登记。 */
  content: string | null
}

function manuscriptDeletionReservationDirectory(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), CANONICAL_PROJECT_DIRECTORY, MANUSCRIPT_DELETION_RESERVATION_DIRECTORY)
}

function manuscriptDeletionReservationFile(projectRoot: string, targetFileName: string): string {
  // 文件名可能超长或带非法字符，落盘名改用「小写文件名」的摘要。
  const key = createHash('sha256').update(targetFileName.toLowerCase(), 'utf8').digest('hex').slice(0, 32)
  return path.join(manuscriptDeletionReservationDirectory(projectRoot), `${key}.json`)
}

function parseReservation(value: unknown): ManuscriptDeletionReservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.targetFileName !== 'string' || !record.targetFileName) return null
  if (typeof record.contentDigest !== 'string') return null
  return {
    targetFileName: record.targetFileName,
    contentDigest: record.contentDigest,
    registeredAt: typeof record.registeredAt === 'string' ? record.registeredAt : '',
    finalizationId: typeof record.finalizationId === 'string' ? record.finalizationId : '',
  }
}

/** 读取某个目标的占位；没有或读不懂一律 `null`（损坏的占位按「不存在」处理）。 */
export function readManuscriptDeletionReservation(
  projectRoot: string,
  targetFileName: string,
): ManuscriptDeletionReservation | null {
  try {
    return parseReservation(JSON.parse(
      fs.readFileSync(manuscriptDeletionReservationFile(projectRoot, targetFileName), 'utf8'),
    ))
  } catch {
    return null
  }
}

/** 全部在途占位的文件名（小写），供选目标处判「被占」。 */
export function listReservedManuscriptTargets(projectRoot: string): ReadonlySet<string> {
  const directory = manuscriptDeletionReservationDirectory(projectRoot)
  let entries: string[]
  try {
    entries = fs.readdirSync(directory)
  } catch {
    return new Set<string>()
  }
  const reserved = new Set<string>()
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const reservation = parseReservation(readJsonOrNull(path.join(directory, entry)))
    if (reservation) reserved.add(reservation.targetFileName.toLowerCase())
  }
  return reserved
}

function readJsonOrNull(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 登记删除收据占位。**只首次生效**：已经有占位就原样返回 `false`，
 * 绝不覆盖 —— 重试时盘上可能已经换成新稿，覆盖会把新稿摘要写进旧收据。
 *
 * @returns 本次是否新建（调用方据此在 `begin` 失败时撤销自己的登记）。
 */
export function reserveManuscriptDeletionTarget(input: ReserveManuscriptDeletionInput): boolean {
  const target = resolveStoredManuscriptTarget(input.projectRoot, input.targetFileName)
  const file = manuscriptDeletionReservationFile(input.projectRoot, target.fileName)
  if (fs.existsSync(file)) return false
  const reservation: ManuscriptDeletionReservation = {
    targetFileName: target.fileName,
    contentDigest: input.content === null
      ? ''
      : createHash('sha256')
        .update(serializeManuscript({
          chapterNumber: input.chapterNumber,
          chapterTitle: input.chapterTitle,
          content: input.content,
        }), 'utf8')
        .digest('hex'),
    registeredAt: new Date().toISOString(),
    finalizationId: input.finalizationId,
  }
  const directory = manuscriptDeletionReservationDirectory(input.projectRoot)
  fs.mkdirSync(directory, { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, JSON.stringify(reservation), { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temporary, file)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
  return true
}

/** 撤销占位（只用于「登记后 `begin` 失败、这条收据根本没落地」）。 */
export function releaseManuscriptDeletionReservation(projectRoot: string, targetFileName: string): void {
  try {
    fs.rmSync(manuscriptDeletionReservationFile(projectRoot, targetFileName), { force: true })
  } catch {
    // 占位目录不可写时不清也不影响正确性：最多让这个名字继续被避开。
  }
}

/**
 * 临时文件写入后在同一目录原位 rename。若重试时发现同内容目标已存在，视为
 * 上次 rename 成功但状态回写中断，保持幂等；不同内容则永不覆盖。
 */
export async function publishManuscript(input: PublishManuscriptInput): Promise<void> {
  const target = resolveStoredManuscriptTarget(input.projectRoot, input.targetFileName)
  const serialized = serializeManuscript(input)
  if (fs.existsSync(target.absolutePath)) {
    const current = fs.readFileSync(target.absolutePath, 'utf8')
    if (current === serialized) return
    throw new Error(`实体稿目标已存在且内容不匹配：${target.fileName}`)
  }

  const temporary = containedDirectChild(
    input.projectRoot,
    `.${target.fileName}.${randomUUID()}.tmp`,
  )
  try {
    fs.writeFileSync(temporary.absolutePath, serialized, { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temporary.absolutePath, target.absolutePath)
  } finally {
    if (fs.existsSync(temporary.absolutePath)) {
      fs.unlinkSync(temporary.absolutePath)
    }
  }
}

/**
 * 删除 outbox 中已冻结的实体稿目标。缺失文件表示投影已经清理，按幂等成功处理。
 *
 * 有删除收据占位时（本卡新建的机制）只删**内容仍是当初那份**的文件：
 * 盘上已换成别的文件（作者刚放回的同名新稿），就保留文件、只清占位，
 * 绝不复用「按名字删」的老规则。占位登记时读不到冻结正文（`contentDigest` 为空）
 * 同样按「所有权不明」处理 —— 保留文件。
 */
export async function removePublishedManuscript(
  projectRoot: string,
  targetFileName: string,
): Promise<void> {
  const target = resolveStoredManuscriptTarget(projectRoot, targetFileName)
  const reservation = readManuscriptDeletionReservation(projectRoot, targetFileName)
  if (!fs.existsSync(target.absolutePath)) {
    if (reservation) releaseManuscriptDeletionReservation(projectRoot, target.fileName)
    return
  }
  if (!reservation) {
    fs.unlinkSync(target.absolutePath)
    return
  }
  let digest = ''
  try {
    if (!fs.lstatSync(target.absolutePath).isFile()) {
      releaseManuscriptDeletionReservation(projectRoot, target.fileName)
      return
    }
    digest = createHash('sha256').update(fs.readFileSync(target.absolutePath)).digest('hex')
  } catch {
    releaseManuscriptDeletionReservation(projectRoot, target.fileName)
    return
  }
  if (reservation.contentDigest && digest === reservation.contentDigest) {
    fs.unlinkSync(target.absolutePath)
  }
  releaseManuscriptDeletionReservation(projectRoot, target.fileName)
}

export const manuscriptPublisher = {
  publish: publishManuscript,
  remove: removePublishedManuscript,
}
