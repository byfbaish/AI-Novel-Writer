import { describe, expect, it } from 'vitest'

import {
  ALLOWED_MODELS,
  MODEL_DEEPSEEK_FLASH,
  MODEL_HY4,
  buildPeakBanner,
  describeModelPolicy,
  formatClock,
  isDeepSeekPeakAt,
  isHy4FreeAt,
  nextOffPeakAt,
  pickModel,
  rejectUnknownModel,
  sameModel,
} from '../model-policy.mjs'

/**
 * 用例来源：用户 2026-11-05 的拍板 + 两份官方口径
 * - Hy4 preview 夜间限免 23:00–次日 08:00（腾讯公告，IT之家 2026-10-02）
 * - DeepSeek-V4.1-Flash 高峰 = 周一至周五 09:00–12:00、14:00–18:00，其余 5 折（腾讯云 2026-10-22）
 * 2026-11-05 是周四；11-07 是周六。
 */
const at = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute, 0, 0)

describe('Hy4 夜间限免窗口（23:00–08:00）', () => {
  it('22:59 还没到限免', () => {
    expect(isHy4FreeAt(at(2026, 11, 5, 22, 59))).toBe(false)
  })

  it('23:00 起免费，且跨午夜到 07:59', () => {
    expect(isHy4FreeAt(at(2026, 11, 5, 23, 0))).toBe(true)
    expect(isHy4FreeAt(at(2026, 11, 6, 0, 30))).toBe(true)
    expect(isHy4FreeAt(at(2026, 11, 6, 7, 59))).toBe(true)
  })

  it('08:00 起不再限免', () => {
    expect(isHy4FreeAt(at(2026, 11, 6, 8, 0))).toBe(false)
  })
})

describe('DeepSeek 高峰（工作日 09:00–12:00、14:00–18:00）', () => {
  it('工作日两段区间是高峰', () => {
    expect(isDeepSeekPeakAt(at(2026, 11, 5, 9, 0))).toBe(true)
    expect(isDeepSeekPeakAt(at(2026, 11, 5, 11, 59))).toBe(true)
    expect(isDeepSeekPeakAt(at(2026, 11, 5, 14, 0))).toBe(true)
    expect(isDeepSeekPeakAt(at(2026, 11, 5, 17, 59))).toBe(true)
  })

  it('区间两端是开区间：12:00 / 18:00 已经出高峰', () => {
    expect(isDeepSeekPeakAt(at(2026, 11, 5, 12, 0))).toBe(false)
    expect(isDeepSeekPeakAt(at(2026, 11, 5, 18, 0))).toBe(false)
  })

  it('周一至周五以外不算高峰（周末全天 5 折）', () => {
    expect(isDeepSeekPeakAt(at(2026, 11, 7, 10, 0))).toBe(false) // 周六
    expect(isDeepSeekPeakAt(at(2026, 11, 8, 15, 0))).toBe(false) // 周日
  })
})

describe('pickModel', () => {
  it('夜间 → Hy4（免费且比 Hy3 强）', () => {
    const picked = pickModel(at(2026, 11, 5, 23, 30))
    expect(picked).toMatchObject({ ok: true, model: MODEL_HY4, window: 'hy4-free-night' })
  })

  it('工作日白天非高峰 → DeepSeek-V4.1-Flash（0.11x 且 5 折）', () => {
    const picked = pickModel(at(2026, 11, 5, 13, 0))
    expect(picked).toMatchObject({ ok: true, model: MODEL_DEEPSEEK_FLASH, window: 'deepseek-off-peak' })
  })

  it('工作日高峰 → 拦下，并给出最早可开工时间', () => {
    const picked = pickModel(at(2026, 11, 5, 10, 15))
    expect(picked.ok).toBe(false)
    expect(picked.blocked).toBe(true)
    expect(picked.model).toBeNull()
    expect(formatClock(picked.nextOffPeakAt)).toBe('12:00')
  })

  it('下午高峰拦截后指向 18:00', () => {
    expect(formatClock(pickModel(at(2026, 11, 5, 15, 40)).nextOffPeakAt)).toBe('18:00')
  })

  it('周末白天不拦，直接走 DeepSeek', () => {
    expect(pickModel(at(2026, 11, 7, 10, 0))).toMatchObject({ ok: true, model: MODEL_DEEPSEEK_FLASH })
  })
})

describe('nextOffPeakAt / formatClock', () => {
  it('不在高峰时返回当前时刻（不瞎跳）', () => {
    const now = at(2026, 11, 5, 13, 5)
    expect(formatClock(nextOffPeakAt(now))).toBe('13:05')
  })

  it('分钟补零', () => {
    expect(formatClock(at(2026, 11, 5, 9, 5))).toBe('09:05')
  })
})

describe('高峰横幅（PEAK_HOURS）', () => {
  it('末尾固定 PEAK_HOURS，且给两条可粘贴的重跑命令', () => {
    const banner = buildPeakBanner({ now: at(2026, 11, 5, 9, 30), command: 'task', prompt: '审查 D18' })
    expect(banner.split('\n').at(-1)).toBe('PEAK_HOURS')
    expect(banner).toContain('审查 D18')
    expect(banner).toContain('--model ' + MODEL_DEEPSEEK_FLASH)
    expect(banner).toContain('--model ' + MODEL_HY4)
    expect(banner).toContain('12:00')
  })
})

describe('模型白名单', () => {
  it('只放行 Hy4 和 DeepSeek-V4.1-Flash', () => {
    expect(ALLOWED_MODELS).toEqual([MODEL_HY4, MODEL_DEEPSEEK_FLASH])
    expect(rejectUnknownModel(MODEL_HY4)).toBeNull()
    expect(rejectUnknownModel(MODEL_DEEPSEEK_FLASH)).toBeNull()
    expect(rejectUnknownModel(null)).toBeNull()
  })

  it('Hy3 明确拒绝（全天免费但能力弱，用户点名不要）', () => {
    expect(rejectUnknownModel('Hy3')).toContain('不在白名单')
    expect(rejectUnknownModel('GLM-5.3')).toContain('不在白名单')
  })

  it('名字比对忽略大小写与空白（选择器文本偶尔带换行）', () => {
    expect(sameModel(' Hy4 ', 'hy4')).toBe(true)
    expect(sameModel('DeepSeek-V4.1-Flash', 'deepseek-v4.1-flash')).toBe(true)
    expect(sameModel('Hy4', 'Hy3')).toBe(false)
  })
})

describe('describeModelPolicy', () => {
  it('非高峰给出「时刻 → 模型」的一行摘要', () => {
    expect(describeModelPolicy(at(2026, 11, 5, 13, 0))).toContain(MODEL_DEEPSEEK_FLASH)
  })

  it('高峰给出拦截摘要', () => {
    expect(describeModelPolicy(at(2026, 11, 5, 10, 0))).toContain('不派活')
  })
})
