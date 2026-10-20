import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import {
  SYNOPSIS_UNIT_LAUNCH_FLAG,
  describeSynopsisUnitProbe,
  probeSynopsisUnitLaunch,
  probeSynopsisUnitLaunchForProject,
  reportSynopsisUnitProbe,
  resolveSynopsisUnitLaunch,
  synopsisUnitCheckpointPath,
  synopsisUnitLaunchEnabled,
  type SynopsisUnitCheckpoint,
} from '../synopsis-unit-launch'

/**
 * E3 T10 探针：发射侧从检查点算出「本次要写的单元」。
 *
 * 要保住的性质（少了任何一条，实机都会在 `approveUnitContext` 被拒）：
 * 1. 与命令侧**同源**：`coveredTo` 取检查点字段、无游标时用 `deriveSynopsisUnitCursor` 预览；
 * 2. 任何算不出的情况（无骨架 / 无检查点 / 有未完成批次 / 开关关）都返回 `null` 让调用方退回按章区间；
 * 3. 开关关掉时**一次 IPC 都不读**。
 */

const projectAPath = 'C:\\novels\\unit-launch'

/** 与 `synopsis-unit-batch.command.test.ts` 同一套骨架：60 章，卷 1 两单元各 15，卷 2 一单元 30。 */
const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '- 叙事任务：立规则。',
  '### 单元二：定价',
  '- 叙事任务：把销档变成交易。',
  '## 卷二：销档',
  '### 单元一：配合',
  '- 叙事任务：只剩配合这一条路。',
].join('\n')

const doubles = vi.hoisted(() => ({
  checkpoint: {} as SynopsisUnitCheckpoint,
  readFails: false,
  invokeWithProjectSession: vi.fn(),
}))

vi.mock('../../ipc-client', () => ({
  ipc: { invokeWithProjectSession: doubles.invokeWithProjectSession },
}))

const projectSession = { projectPath: projectAPath } as unknown as ProjectSessionContext

function enabledStorage(): Pick<Storage, 'getItem'> {
  return { getItem: key => (key === SYNOPSIS_UNIT_LAUNCH_FLAG ? '1' : null) }
}

function resolve(
  overrides: Partial<{ totalChapters: number; plotStructurePlan: string | undefined; storage: Pick<Storage, 'getItem'> | null }> = {},
) {
  return resolveSynopsisUnitLaunch({
    projectSession,
    totalChapters: overrides.totalChapters ?? 60,
    plotStructurePlan: 'plotStructurePlan' in overrides ? overrides.plotStructurePlan : PLAN,
    storage: 'storage' in overrides ? overrides.storage : enabledStorage(),
  })
}

beforeEach(() => {
  doubles.checkpoint = {}
  doubles.readFails = false
  doubles.invokeWithProjectSession.mockReset()
  doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string) => {
    if (channel !== 'fs:read-json') return { success: false }
    if (doubles.readFails) return { success: false }
    return { success: true, data: doubles.checkpoint }
  })
})

describe('synopsisUnitLaunchEnabled', () => {
  it('只认显式的 1，读不到或抛错都算关闭', () => {
    expect(synopsisUnitLaunchEnabled({ getItem: () => '1' })).toBe(true)
    expect(synopsisUnitLaunchEnabled({ getItem: () => 'true' })).toBe(false)
    expect(synopsisUnitLaunchEnabled({ getItem: () => null })).toBe(false)
    expect(synopsisUnitLaunchEnabled({ getItem: () => { throw new Error('denied') } })).toBe(false)
  })
})

describe('synopsisUnitCheckpointPath', () => {
  it('指向项目目录下的 partial_arch.json', () => {
    expect(synopsisUnitCheckpointPath(projectAPath)).toBe(`${projectAPath}/.ai-novel/partial_arch.json`)
  })
})

describe('resolveSynopsisUnitLaunch', () => {
  it('开关关闭时既不读检查点也不返回单元', async () => {
    expect(await resolve({ storage: { getItem: () => null } })).toBeNull()
    expect(doubles.invokeWithProjectSession).not.toHaveBeenCalled()
  })

  it('全书未开始时从首单元起，上界按卷内剩余摊到剩余单元', async () => {
    expect(await resolve()).toEqual({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
  })

  it('用落库游标定位：from 永远取 covered_to + 1，单元号取游标', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10, synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 1, writtenInVolume: 10 } }
    expect(await resolve()).toEqual({ from: 11, unitIndex: 1, maxChapters: 10, volumeRemaining: 20 })

    doubles.checkpoint = { synopsis_covered_to: 22, synopsis_unit_cursor: { volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 } }
    expect(await resolve()).toEqual({ from: 23, unitIndex: 1, maxChapters: 30, volumeRemaining: 30 })
  })

  it('旧检查点没有游标时用与命令侧同一个推导函数预览（不落盘）', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10 }
    const migrated = await resolve()
    // 命令侧也会用 deriveSynopsisUnitCursor 迁移出同一个游标，所以这里必然等于「有游标」的结果。
    doubles.checkpoint = { synopsis_covered_to: 10, synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 1, writtenInVolume: 10 } }
    expect(migrated).toEqual(await resolve())
    expect(migrated?.from).toBe(11)
  })

  it('有未完成批次时退回按章区间（中断续写不是「再写一个单元」）', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10, synopsis_incomplete: true, synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 1, writtenInVolume: 10 } }
    expect(await resolve()).toBeNull()
  })

  it('读不到检查点文件时按「全书未开始」处理', async () => {
    doubles.readFails = true
    expect(await resolve()).toEqual({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
  })

  it('骨架缺失 / 总章数非法 / 已写到全书末尾时一律退回', async () => {
    expect(await resolve({ plotStructurePlan: undefined })).toBeNull()
    expect(await resolve({ totalChapters: 0 })).toBeNull()
    doubles.checkpoint = { synopsis_covered_to: 60, synopsis_unit_cursor: { volumeIndex: 2, unitIndex: 1, writtenInVolume: 30 } }
    expect(await resolve()).toBeNull()
  })
})

/**
 * 探针存在的唯一理由：**让「没进单元模式」这件事在界面上说得清**。
 * 这些断言锁的是「原因不会退化成静默 null」——现场真机踩过的坑就是「点了没反应、控制台也没字」。
 */
describe('probeSynopsisUnitLaunch', () => {
  function probe(overrides: Partial<{ totalChapters: number; plotStructurePlan: string | undefined; storage: Pick<Storage, 'getItem'> | null }> = {}) {
    return probeSynopsisUnitLaunch({
      projectSession,
      totalChapters: overrides.totalChapters ?? 60,
      plotStructurePlan: 'plotStructurePlan' in overrides ? overrides.plotStructurePlan : PLAN,
      storage: 'storage' in overrides ? overrides.storage : enabledStorage(),
    })
  }

  it('算得出单元时 reason 为 null，并标出用了推导游标', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10 }
    const result = await probe()
    expect(result.reason).toBeNull()
    expect(result.unit).toEqual({ from: 11, unitIndex: 1, maxChapters: 10, volumeRemaining: 20 })
    expect(result.coveredTo).toBe(10)
    expect(result.checkpointFound).toBe(true)
    expect(result.cursorDerived).toBe(true)
  })

  it('显式游标不算推导；读不到检查点时 found=false', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10, synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 1, writtenInVolume: 10 } }
    expect((await probe()).cursorDerived).toBe(false)
    doubles.readFails = true
    const missing = await probe()
    expect(missing.checkpointFound).toBe(false)
    expect(missing.coveredTo).toBe(0)
  })

  it('每个退回分支都有自己的 reason，不会退化成静默 null', async () => {
    expect((await probe({ storage: { getItem: () => null } })).reason).toBe('flag-off')
    expect((await probe({ totalChapters: 0 })).reason).toBe('invalid-total')
    doubles.checkpoint = { synopsis_covered_to: 10, synopsis_incomplete: true }
    expect((await probe()).reason).toBe('incomplete')
    // 已写到第 10 章但没有骨架 ⇒ 推不出游标
    doubles.checkpoint = { synopsis_covered_to: 10 }
    expect((await probe({ plotStructurePlan: undefined })).reason).toBe('no-cursor')
    // 全书未开始 + 没有骨架 ⇒ 有初始游标（不推导）但算不出区间
    doubles.checkpoint = {}
    expect((await probe({ plotStructurePlan: undefined })).reason).toBe('compute-null')
  })

  it('describeSynopsisUnitProbe 给人话，且带上真实数值', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10 }
    expect(describeSynopsisUnitProbe(await probe())).toContain('第 11 章起')
    expect(describeSynopsisUnitProbe(await probe({ storage: { getItem: () => null } }))).toContain(SYNOPSIS_UNIT_LAUNCH_FLAG)
    // 检查点读不到 + 没有骨架：话里必须点出「没读到 partial_arch.json」，否则现场只会以为骨架坏了
    doubles.readFails = true
    expect(describeSynopsisUnitProbe(await probe({ plotStructurePlan: undefined }))).toContain('partial_arch.json')
  })

  it('reportSynopsisUnitProbe 用 warn 上报（不会被 Info 过滤吃掉）并挂到 globalThis', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await probe()
    reportSynopsisUnitProbe(result)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[E3]'))
    expect((globalThis as Record<string, unknown>).__e3UnitProbe).toEqual(result)
    warn.mockRestore()
  })
})

describe('probeSynopsisUnitLaunchForProject', () => {
  it('自己读弧光结构，不再要调用方发一次 project-core-get', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10 }
    doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string) => {
      if (channel === 'db:project-core-get') return { plotStructurePlan: PLAN }
      if (channel === 'fs:read-json') return { success: true, data: doubles.checkpoint }
      return null
    })
    const result = await probeSynopsisUnitLaunchForProject({
      projectSession, totalChapters: 60, storage: enabledStorage(),
    })
    expect(result.unit).toEqual({ from: 11, unitIndex: 1, maxChapters: 10, volumeRemaining: 20 })
    expect(doubles.invokeWithProjectSession).toHaveBeenCalledWith(projectSession, 'db:project-core-get', projectAPath)
  })

  it('读弧光结构失败按「没有骨架」处理，抛错也不会打断生成', async () => {
    doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string) => {
      if (channel === 'db:project-core-get') throw new Error('DB_BUSY')
      if (channel === 'fs:read-json') return { success: true, data: doubles.checkpoint }
      return null
    })
    const result = await probeSynopsisUnitLaunchForProject({
      projectSession, totalChapters: 60, storage: enabledStorage(),
    })
    expect(result.unit).toBeNull()
    expect(result.reason).toBe('compute-null')
  })
})
