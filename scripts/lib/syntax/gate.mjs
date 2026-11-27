/**
 * 误报闸门：逐类比较两臂每千字密度，`human_per1k ≤ ai_per1k / 3` 才算过线。
 * 不过线的类自动降为 `report` 并产出一条 WARN（不静默、不阻断）。
 */

import { RULES } from './rules.mjs'

export function round(value) {
  return Math.round(value * 100) / 100
}

const CATEGORIES = [...new Set(RULES.map(rule => rule.category))].sort()

function declaredTier(category) {
  return RULES.find(rule => rule.category === category)?.tier ?? 'report'
}

export function evaluateGate(chapters) {
  const humans = chapters.filter(chapter => chapter.arm === 'human')
  const ais = chapters.filter(chapter => chapter.arm !== null && chapter.arm !== 'human')
  if (humans.length === 0 || ais.length === 0) {
    return { hasArms: false, decisions: new Map(), warnings: [] }
  }
  const sum = list => list.reduce((total, chapter) => total + chapter.units, 0)
  const humanChars = sum(humans)
  const aiChars = sum(ais)
  const decisions = new Map()
  const warnings = []
  for (const category of CATEGORIES) {
    const countOf = (list) => list.reduce((total, chapter) => total
      + chapter.hits.filter(hit => hit.category === category).length, 0)
    const humanHits = countOf(humans)
    const aiHits = countOf(ais)
    const humanPer1k = humanChars === 0 ? 0 : (humanHits / humanChars) * 1000
    const aiPer1k = aiChars === 0 ? 0 : (aiHits / aiChars) * 1000
    const passes = aiPer1k === 0 ? humanPer1k === 0 : humanPer1k <= aiPer1k / 3
    decisions.set(category, {
      humanPer1k: round(humanPer1k),
      aiPer1k: round(aiPer1k),
      humanHits,
      aiHits,
      passes,
      tier: passes ? declaredTier(category) : 'report',
    })
    if (!passes) {
      warnings.push(`WARN: category ${category} below false-positive gate (human=${round(humanPer1k)} ai=${round(aiPer1k)})`)
    }
  }
  return { hasArms: true, decisions, warnings, humanChars, aiChars }
}

/** 没有臂标签时按设计口径取 tier；有标签时取闸门裁定。 */
export function tierOf(category, gate) {
  return gate.decisions.get(category)?.tier ?? declaredTier(category)
}
