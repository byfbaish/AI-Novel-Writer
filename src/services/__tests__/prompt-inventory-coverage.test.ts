import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { BUILTIN_PROMPTS, EDITABLE_PROMPT_KEYS } from '../prompt-templates'

// 这份清单是「不必每次全量重扫」的全部凭据。它会腐烂，所以拿测试钉住：
// 增删模板 / 改可编辑白名单 / 挪动 §5 点到的文件，清单没跟着改就红。
// 规则见 docs/agents/documentation-charter.md §9 与清单 §8「增量核对清单」。
const INVENTORY = new URL('../../../docs/design/prompt/prompt-three-layer-inventory.md', import.meta.url)

const readInventory = (): string => readFileSync(INVENTORY, 'utf8')

const sectionOf = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from)
  expect(start, `清单缺少小节：${from}`).toBeGreaterThan(-1)
  const end = text.indexOf(to, start + from.length)
  expect(end, `小节 ${from} 之后找不到 ${to}`).toBeGreaterThan(start)
  return text.slice(start, end)
}

const templateRows = (): string[][] => {
  const section = sectionOf(readInventory(), '### 3.2 内置模板 key', '### 3.3')
  return section
    .split('\n')
    .filter(line => /^\|\s*\d+\s*\|/.test(line))
    .map(line => line.split('|').map(cell => cell.trim()))
}

const keyOfRow = (cells: string[]): string => cells[2].replace(/`/g, '').trim()

describe('Prompt 三层全景清单（防过期）', () => {
  it('§3.2 模板表覆盖全部内置 key，双向差集为空', () => {
    const listed = templateRows().map(keyOfRow)
    const actual = BUILTIN_PROMPTS.map(template => template.key)
    expect(new Set(listed).size, '清单内 key 重复').toBe(listed.length)
    // 少了 = 新模板没登记；多了 = 模板被删但清单没清。
    expect([...listed].sort()).toEqual([...actual].sort())
  })

  it('§3.2 的 EDITABLE 列与白名单一致', () => {
    const mismatched = templateRows()
      .map(cells => ({ key: keyOfRow(cells), editableCell: cells[4] ?? '' }))
      .filter(({ key, editableCell }) => {
        const claimed = !editableCell.includes('否')
        return claimed !== EDITABLE_PROMPT_KEYS.includes(key)
      })
      .map(({ key }) => key)
    expect(mismatched).toEqual([])
  })

  it('§5 装配链路点到的 src/ electron/ 文件全部存在', () => {
    const section = sectionOf(readInventory(), '## 5. 装配链路', '## 6. 覆盖矩阵')
    const paths = [...section.matchAll(/`((?:src|electron|scripts)\/[^`:\s]+\.(?:ts|tsx|mjs))(?::[0-9-]+)?`/g)]
      .map(match => match[1])
    expect(paths.length, '§5 至少应点到 15 个文件').toBeGreaterThanOrEqual(15)
    const missing = [...new Set(paths)].filter(path => !existsSync(new URL(`../../../${path}`, import.meta.url)))
    // 文件被移动/改名时，清单里的入口行号与链路归属也要一起改。
    expect(missing).toEqual([])
  })
})
