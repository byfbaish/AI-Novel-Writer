import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import {
  describeSynopsisUnitProbe,
  probeSynopsisUnitLaunch,
  probeSynopsisUnitLaunchForProject,
  resetSynopsisCheckpoint,
  reportSynopsisUnitProbe,
  resolveSynopsisUnitLaunch,
  synopsisUnitCheckpointPath,
  synopsisUnitModeEnabled,
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
  /** 文件在、但读不出来（手工改坏 / 编码不是 UTF-8）——必须与「文件不存在」分开。 */
  readBroken: false,
  core: null as { synopsis?: string; plotStructurePlan?: string } | null,
  invokeWithProjectSession: vi.fn(),
}))

vi.mock('../../ipc-client', () => ({
  ipc: { invokeWithProjectSession: doubles.invokeWithProjectSession },
}))

const projectSession = { projectPath: projectAPath } as unknown as ProjectSessionContext

function resolve(
  overrides: Partial<{ totalChapters: number; plotStructurePlan: string | undefined; unitMode: boolean }> = {},
) {
  return resolveSynopsisUnitLaunch({
    projectSession,
    totalChapters: overrides.totalChapters ?? 60,
    plotStructurePlan: 'plotStructurePlan' in overrides ? overrides.plotStructurePlan : PLAN,
    unitMode: 'unitMode' in overrides ? overrides.unitMode : true,
  })
}

beforeEach(() => {
  doubles.checkpoint = {}
  doubles.readFails = false
  doubles.readBroken = false
  doubles.core = null
  doubles.invokeWithProjectSession.mockReset()
  doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string) => {
    if (channel === 'db:project-core-get') return doubles.core
    if (channel !== 'fs:read-json') return { success: false }
    if (doubles.readBroken) return { success: false, data: null, reason: 'invalid-json' }
    if (doubles.readFails) return { success: false }
    return { success: true, data: doubles.checkpoint }
  })
})

describe('synopsisUnitModeEnabled', () => {
  it('读用户设置：只有显式 false 才算关掉，缺省（新装 / 未写过）就是开', async () => {
    expect(await synopsisUnitModeEnabled(true)).toBe(true)
    expect(await synopsisUnitModeEnabled(false)).toBe(false)
    expect(await synopsisUnitModeEnabled(async () => true)).toBe(true)
    expect(await synopsisUnitModeEnabled(async () => false)).toBe(false)
  })

  it('读不到配置时按开启兜底，绝不把探针变成生成拦路虎', async () => {
    // 注入的读取器抛错 = 现场读配置失败；默认行为不该因为一次抖动退回旧路径
    expect(await synopsisUnitModeEnabled(async () => { throw new Error('DB_BUSY') })).toBe(true)
    // 没注入 = 自己走 config:get；这里没有 mock 该通道 ⇒ 抛错 ⇒ 同样兜底为开
    expect(await synopsisUnitModeEnabled()).toBe(true)
  })
})

describe('synopsisUnitCheckpointPath', () => {
  it('指向项目目录下的 partial_arch.json', () => {
    expect(synopsisUnitCheckpointPath(projectAPath)).toBe(`${projectAPath}/.ai-novel/partial_arch.json`)
  })
})

describe('resolveSynopsisUnitLaunch', () => {
  it('开关关闭时既不读检查点也不返回单元', async () => {
    expect(await resolve({ unitMode: false })).toBeNull()
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
    // 有半成品正文 ⇒ 真的可续，必须退回
    doubles.checkpoint = { synopsis_covered_to: 0, synopsis_incomplete: true, synopsis_result: '## 第1章：半截' }
    expect(await resolve()).toBeNull()
  })

  it('空的中断标记（什么都没写进库）视同未开始，不锁死单元模式', async () => {
    // 实机故障：批前预写 incomplete=true，随后回填失败未回滚 ⇒ 下一批若直接退回按章，
    // 作者会拿对话框里第 1 章起的区间去覆盖已有大纲。
    doubles.checkpoint = { synopsis_covered_to: 0, synopsis_incomplete: true, synopsis_result: '' }
    expect(await resolve()).toEqual({ from: 1, unitIndex: 1, maxChapters: 15, volumeRemaining: 30 })
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
  function probe(overrides: Partial<{
    totalChapters: number
    plotStructurePlan: string | undefined
    unitMode: boolean
  }> = {}) {
    return probeSynopsisUnitLaunch({
      projectSession,
      totalChapters: overrides.totalChapters ?? 60,
      plotStructurePlan: 'plotStructurePlan' in overrides ? overrides.plotStructurePlan : PLAN,
      unitMode: 'unitMode' in overrides ? overrides.unitMode : true,
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

  it('带出本卷剩余单元数（连写上限），与 planUnitStats 同源', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10 }
    const first = await probe()
    expect(first.volume).toMatchObject({ index: 1, unitCount: 2, remainingUnits: 2 })
    // 卷 1 的第二个单元：本卷只剩 1 个（连写不该再多给）
    doubles.checkpoint = { synopsis_covered_to: 10, synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 10 } }
    expect((await probe()).volume?.remainingUnits).toBe(1)
    // 没进单元模式时不给卷进度（避免 UI 拿它当「可以连写」的信号）
    expect((await probe({ totalChapters: 0 })).volume).toBeNull()
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
    expect((await probe({ unitMode: false })).reason).toBe('flag-off')
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
    // 位置统一写成「第V卷第U单元第C章（全书第N章）」：层级必须报全（A6 事故里
    // 作者把「第 2 个单元」读成了「第二卷开始」），全书章号仍可直接核对。
    expect(describeSynopsisUnitProbe(await probe())).toContain('第1卷第1单元第1章（全书第11章）')
    expect(describeSynopsisUnitProbe(await probe({ unitMode: false }))).toContain('设置')
    // 检查点读不到 + 没有骨架：话里必须点出「没读到 partial_arch.json」，否则现场只会以为骨架坏了
    doubles.readFails = true
    expect(describeSynopsisUnitProbe(await probe({ plotStructurePlan: undefined }))).toContain('partial_arch.json')
  })

  /**
   * 2026-10-20 实机事故：作者手改检查点（A6 把 writtenInVolume +3）之后，文件读数失败被
   * 当成了「全书未开始」，于是从第 1 章开写，把已完成的 21 章大纲覆盖成 4 章。
   * 这两条锁的就是「读不出来 ≠ 新项目」。
   */
  it('检查点文件坏了（JSON / 编码）⇒ 拒绝进单元模式，绝不从第 1 章开写', async () => {
    doubles.readBroken = true
    const result = await probe()
    expect(result.reason).toBe('checkpoint-broken')
    expect(result.unit).toBeNull()
    expect(describeSynopsisUnitProbe(result)).toContain('覆盖重写')
  })

  it('检查点丢了但库里有大纲 ⇒ 拒绝（用第二份进度事实反证）', async () => {
    doubles.checkpoint = {}
    const result = await probeSynopsisUnitLaunch({
      projectSession,
      totalChapters: 60,
      plotStructurePlan: PLAN,
      outlineCoveredTo: 21,
      unitMode: true,
    })
    expect(result.reason).toBe('checkpoint-lost')
    expect(result.unit).toBeNull()
  })

  /**
   * 中断批次里只要有**半成品正文**，就一律按「中断」退回（不是单元模式）。
   * 这条与「作者清空大纲」在文件上无法区分，所以不自动判过期，只由作者显式重置。
   */
  it('有半成品正文 / 有进度时按「中断」退回，不擅自作废', async () => {
    doubles.checkpoint = {
      synopsis_covered_to: 0,
      synopsis_incomplete: true,
      synopsis_result: '## 第1章：半截',
      synopsis_db_hash: '1upvfjc',
    }
    expect((await probe({})).reason).toBe('incomplete')
    doubles.checkpoint = {
      synopsis_covered_to: 8,
      synopsis_incomplete: true,
      synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 3, writtenInVolume: 8 },
      synopsis_db_hash: '1upvfjc',
    }
    expect((await probe({})).reason).toBe('incomplete')
    expect((await probe({})).reason).toBe('incomplete')
  })


  it('组件入口自己取库内进度：检查点丢了也拦得住', async () => {
    doubles.checkpoint = {}
    doubles.core = { synopsis: '## 第1章：甲\n## 第2章：乙', plotStructurePlan: PLAN }
    const result = await probeSynopsisUnitLaunchForProject({ projectSession, totalChapters: 60, unitMode: true })
    expect(result.reason).toBe('checkpoint-lost')
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

/**
 * 2026-10-20 实机：作者清空大纲后，检查点仍记着「已覆盖 8 章 + 未完成批次」，
 * 探针据此退回按章区间，而界面上**没有任何地方**能取消它。
 *
 * 自动判过期不可行：真正中断的批次和「作者清空大纲」在文件上形态完全一样
 * （区别只在 handle 背后的 run 还活着没有，那是运行期事实）。所以只做**显式重置**，
 * 由作者自己触发 —— 这个块锁的就是「它只删该删的」。
 */
describe('resetSynopsisCheckpoint', () => {
  const checkpoint = {
    synopsis_covered_to: 8,
    synopsis_incomplete: true,
    synopsis_result: '## 第6章：甲',
    synopsis_range: { from: 6, to: 8 },
    synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 3, writtenInVolume: 8 },
    synopsis_volume_deviations: [{ volumeIndex: 1, planned: 30, actual: 9 }],
    synopsis_generation_handle: { runId: '旧run' },
    synopsis_db_hash: 'abc1234',
    synopsis_body_hash: 'def5678',
    // 世界观 / 前提的候选必须原样保留
    world_building_partial_result: '世界观候选正文',
    world_building_incomplete: true,
    premise_result: '前提候选正文',
  }

  function harness(read: unknown, writeOk = true) {
    const written: Record<string, unknown>[] = []
    doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string, ...rest: unknown[]) => {
      if (channel === 'fs:read-json') return read
      if (channel === 'fs:write-json') {
        if (!writeOk) return { success: false, error: 'EACCES' }
        written.push(rest[1] as Record<string, unknown>)
        return { success: true }
      }
      return { success: false }
    })
    return written
  }

  it('只清 synopsis_* 字段，世界观 / 前提候选原样保留（数据库正文一个字不动）', async () => {
    const written = harness({ success: true, data: { ...checkpoint } })
    expect(await resetSynopsisCheckpoint(projectSession)).toEqual({ ok: true, cleared: 9 })
    expect(written).toHaveLength(1)
    expect(written[0]).toEqual({
      world_building_partial_result: '世界观候选正文',
      world_building_incomplete: true,
      premise_result: '前提候选正文',
    })
    // 写出去的只有检查点文件：不得去动 DB 正文
    expect(doubles.invokeWithProjectSession.mock.calls.map(([, channel]) => channel))
      .not.toContain('db:project-core-update')
  })

  it('检查点文件坏了 / 不存在时覆盖成一个干净对象，不让作者去手改文件', async () => {
    const broken = harness({ success: false, data: null, reason: 'invalid-json' })
    expect(await resetSynopsisCheckpoint(projectSession)).toEqual({ ok: true, cleared: 0 })
    expect(broken[0]).toEqual({})

    const missing = harness({ success: false, reason: 'missing' })
    expect(await resetSynopsisCheckpoint(projectSession)).toEqual({ ok: true, cleared: 0 })
    expect(missing[0]).toEqual({})
  })

  it('写失败如实回报，不假装成功', async () => {
    harness({ success: true, data: { ...checkpoint } }, false)
    const result = await resetSynopsisCheckpoint(projectSession)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('EACCES')
  })
})

describe('probeSynopsisUnitLaunchForProject', () => {  it('自己读弧光结构，不再要调用方发一次 project-core-get', async () => {
    doubles.checkpoint = { synopsis_covered_to: 10 }
    doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string) => {
      if (channel === 'db:project-core-get') return { plotStructurePlan: PLAN }
      if (channel === 'fs:read-json') return { success: true, data: doubles.checkpoint }
      return null
    })
    const result = await probeSynopsisUnitLaunchForProject({
      projectSession, totalChapters: 60, unitMode: true,
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
      projectSession, totalChapters: 60, unitMode: true,
    })
    expect(result.unit).toBeNull()
    expect(result.reason).toBe('compute-null')
  })
})
