import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { withoutComments } from '../../../../test/source-contract'

const brandingSources = [
  'src/components/settings/SettingsModal.tsx',
  'electron/main.ts',
  'package.json',
  'pnpm-lock.yaml',
  'electron-builder.json5',
  'README.md',
]

const visibleSettingsSources = [
  'src/components/settings/SettingsModal.tsx',
  'src/components/settings/PromptSettings.tsx',
]

function readSources(files: string[]): string {
  return files
    .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
    .join('\n')
}

const brandingSource = readSources(brandingSources)
// 伪图标断言扫**可见文案**：⚠️/★ 是仓库注释的常用记号，不是 UI 图标 ⇒ 剥注释后再扫。
// 正则类断言专用（transpile 会重排格式，不能用于多行精确串）。
const visibleSettingsSource = visibleSettingsSources
  .map((file) => withoutComments(file, readFileSync(resolve(process.cwd(), file), 'utf8')))
  .join('\n')

const forbiddenVisibleLegacy = [
  '"name": "vela"',
  '"productName": "Vela"',
  '"appId": "com.vela.ide"',
  'Vela IDE',
  'heider',
  'heider-x',
  '/buyme/',
  'public/buyme',
  'wepay',
  'alipay',
  'wechat.jpg',
  'group.png',
  '微信打赏',
  '支付宝打赏',
  '扫码赞助',
  '赞助与支持',
  'Donate QR',
  '商业合作与技术交流',
  'Crafted with',
  'Vela —',
]

const pseudoIconPattern = new RegExp([
  '[\\u2600-\\u27BF]',
  '[\\u{1F300}-\\u{1FAFF}]',
  '\\uFE0F',
].join('|'), 'u')

describe('settings visible branding', () => {
  it('does not expose legacy support, payment QR, or pseudo-icon branding', () => {
    for (const value of forbiddenVisibleLegacy) {
      expect(brandingSource).not.toContain(value)
    }

    expect(visibleSettingsSource).not.toMatch(pseudoIconPattern)
    // svg 禁令保持裸扫：连注释里出现 <svg 也要能看见。
    expect(readSources(visibleSettingsSources)).not.toMatch(/<svg\b|<path\b/)
  })

  it('does not keep legacy support image assets in the repository', () => {
    const buymeDir = resolve(process.cwd(), 'public/buyme')
    const legacyAssets = [
      'public/buyme/alipay.jpg',
      'public/buyme/group.png',
      'public/buyme/wechat.jpg',
      'public/buyme/wepay.jpg',
    ]

    expect(existsSync(buymeDir)).toBe(false)
    for (const asset of legacyAssets) {
      expect(existsSync(resolve(process.cwd(), asset)), asset).toBe(false)
    }
  })
})
