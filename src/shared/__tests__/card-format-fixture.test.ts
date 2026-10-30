import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CARD_LIMITS,
  parsePersonalityCard,
  renderPersonalityCard,
} from '../character-card-format'

/**
 * 离线产物的验收闸 —— **用真解析器判，不另写正则**。
 *
 * 生产者：`scripts/experiments/personality-card-v3-loop.mjs`
 * 为什么单独一层：脚本跑模型要几分钟且需要本地 Ollama，不能进 CI；但**判定**必须用
 * 与生产同一个 `parsePersonalityCard`，否则「离线通过了、真机解析不了」这种事会反复发生。
 *
 * 无产物时整组 skip（别人 clone 仓库不该因为缺 fixture 变红）。
 */
const FIXTURE_DIR = path.join(process.cwd(), 'scripts', 'experiments', 'out')

interface FixtureRow {
  model: string
  caseId: number
  run: number
  personality: string
  error?: string
}

function readFixtureRows(): FixtureRow[] {
  if (!fs.existsSync(FIXTURE_DIR)) return []
  const files = fs.readdirSync(FIXTURE_DIR).filter(name => /^personality-v3-.*\.jsonl$/u.test(name))
  const rows: FixtureRow[] = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')
    for (const line of content.split(/\r?\n/u)) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as FixtureRow
        if (typeof parsed.personality === 'string' && parsed.personality.trim()) rows.push(parsed)
      } catch {
        // 半行（脚本中途被杀）直接跳过，不算失败。
      }
    }
  }
  return rows
}

const ROWS = readFixtureRows()

describe.skipIf(ROWS.length === 0)('offline 三格产物必须能被真解析器解析', () => {
  it('每条产物都解析成 v3，且条数在范围内', () => {
    const failures: string[] = []
    for (const row of ROWS) {
      const card = parsePersonalityCard(row.personality)
      const tag = `${row.model} case${row.caseId} run${row.run}`
      if (card.format !== 'v3') {
        failures.push(`${tag}: format=${card.format}（没有【禁区】段或零条 X）`)
        continue
      }
      if (card.forbidden.length < 1 || card.forbidden.length > CARD_LIMITS.forbidden) {
        failures.push(`${tag}: 禁区 ${card.forbidden.length} 条`)
      }
      if (card.chips.length > CARD_LIMITS.chips) {
        failures.push(`${tag}: 筹码 ${card.chips.length} 条`)
      }
      if (card.softSpots.length > CARD_LIMITS.softSpots) {
        failures.push(`${tag}: 软肋 ${card.softSpots.length} 条`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })

  it('渲染回去再解析，结果不变（幂等）', () => {
    // 只比**内容**。`issues` 描述的是「输入文本有什么毛病」，渲染后的规范化文本
    // 当然不再带那些毛病（比如重复编号已被丢弃），把它算进比较等于要求"错误也要幂等"。
    const content = ({ format, forbidden, chips, situation, softSpots }: ReturnType<typeof parsePersonalityCard>) =>
      JSON.stringify({ format, forbidden, chips, situation, softSpots })
    const failures: string[] = []
    for (const row of ROWS) {
      const card = parsePersonalityCard(row.personality)
      if (card.format !== 'v3') continue
      const again = parsePersonalityCard(renderPersonalityCard(card))
      if (content(again) !== content(card)) {
        failures.push(`${row.model} case${row.caseId} run${row.run}: render→parse 漂移`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })

  it('整体通过率达标（离线上线闸）', () => {
    const total = ROWS.length
    const passed = ROWS.filter(row => parsePersonalityCard(row.personality).format === 'v3').length
    const rate = passed / total
    // 闸门按「每个模型各自过半 + 全体 ≥ 75%」—— 单模型全绿才算条款真的稳。
    const byModel = new Map<string, { total: number; passed: number }>()
    for (const row of ROWS) {
      const bucket = byModel.get(row.model) ?? { total: 0, passed: 0 }
      bucket.total += 1
      if (parsePersonalityCard(row.personality).format === 'v3') bucket.passed += 1
      byModel.set(row.model, bucket)
    }
    const summary = [...byModel.entries()]
      .map(([model, stats]) => `${model}: ${stats.passed}/${stats.total}`)
      .join(' · ')
    expect(rate, `全体 ${passed}/${total} —— ${summary}`).toBeGreaterThanOrEqual(0.75)
    for (const [model, stats] of byModel) {
      expect(stats.passed / stats.total, `${model} 只有 ${stats.passed}/${stats.total}`).toBeGreaterThanOrEqual(0.75)
    }
  })
})
