import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InvalidationPlan } from '../../../shared/invalidation-plan'
import { useLocaleStore } from '../../../stores/locale-store'
import InvalidationPlanGatePanel from '../InvalidationPlanGatePanel'

/**
 * 失效清单强提醒面板（P2-3 期 3a · S3）。验收口径：**三档由后端给的 `tier` 决定**，
 * 面板自己不许重算 —— 强度背后是「后果能不能撤销」这种业务判断，落到渲染层就等于
 * 把它变成样式选择。
 *
 * 钉住的四件事：
 * - `once`：清单 + 单击确认即可；
 * - `strong`：必须勾选才 enabled，**未勾选时点了必须是没反应**；
 * - `unseen` 那一行永远出现（主稿 §9.2：dimelo 看不见的派生不许消失）；
 * - 取消 ⇒ 不触发任何放行。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BLUEPRINT_DRIFT = [{ key: 'outline:book', have: 2, need: 3 }]

const ONCE_PLAN: InvalidationPlan = {
  groups: [{
    kind: 'blueprint',
    count: 2,
    items: [
      { label: '第 3 章', chapters: [3], behind: BLUEPRINT_DRIFT },
      { label: '第 12 章', chapters: [12], behind: BLUEPRINT_DRIFT },
    ],
  }],
  unseen: { count: 1, kinds: ['plot-tree'] },
  tier: 'once',
  unaffected: { from: 4, to: 11 },
  reason: 'unknown',
}

const STRONG_PLAN: InvalidationPlan = {
  groups: [
    { kind: 'blueprint', count: 1, items: [{ label: '第 31 章', chapters: [31], behind: BLUEPRINT_DRIFT }] },
    {
      kind: 'handoff',
      count: 1,
      items: [{
        label: '第 1 卷第 20 章交接单',
        chapters: Array.from({ length: 20 }, (_, index) => index + 1),
        behind: BLUEPRINT_DRIFT,
      }],
    },
  ],
  unseen: { count: 0, kinds: [] },
  tier: 'strong',
  unaffected: null,
  reason: 'unknown',
}

let root: Root
let container: HTMLDivElement

function testid(name: string): HTMLElement {
  const target = container.querySelector(`[data-testid="${name}"]`)
  if (!target) throw new Error(`missing testid ${name}`)
  return target as HTMLElement
}

function proceedButton(): HTMLButtonElement {
  return testid('invalidation-proceed') as HTMLButtonElement
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

async function renderPanel(plan: InvalidationPlan, domain: 'outline' | 'worldbuilding' = 'outline') {
  const onProceed = vi.fn()
  const onDismiss = vi.fn()
  await act(async () => {
    root.render(
      <InvalidationPlanGatePanel plan={plan} domain={domain} onProceed={onProceed} onDismiss={onDismiss} />,
    )
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return { onProceed, onDismiss }
}

beforeEach(() => {
  useLocaleStore.setState({ locale: 'zh-CN' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('失效清单强提醒面板 · once 档', () => {
  it('给可数清单 + 影响章节 + 不受影响区间，单击确认即可', async () => {
    const { onProceed } = await renderPanel(ONCE_PLAN)
    const groups = testid('invalidation-groups').textContent ?? ''
    expect(groups).toContain('章节蓝图（2）')
    expect(groups).toContain('第 3 章')
    expect(groups).toContain('第 12 章')
    // drift 必须落到具体域名 + 版本区间，不能只说「上游变了」
    expect(groups).toContain('情节大纲 2 → 3')

    expect(testid('invalidation-scope').textContent).toContain('影响章节：3、12')
    expect(testid('invalidation-unaffected').textContent).toContain('第 4–11 章及其派生不受影响')
    expect(testid('invalidation-unseen').textContent).toContain('另有 1 项无法判断')

    // once 档：没有勾选框，主按钮直接可用。
    expect(container.querySelector('[data-testid="invalidation-ack"]')).toBeNull()
    expect(proceedButton().disabled).toBe(false)
    await click(proceedButton())
    expect(onProceed).toHaveBeenCalledOnce()
  })

  it('取消 ⇒ 不放行', async () => {
    const { onProceed, onDismiss } = await renderPanel(ONCE_PLAN)
    const cancel = [...container.querySelectorAll('button')].find(node => node.textContent?.includes('取消'))
    await click(cancel as HTMLButtonElement)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onProceed).not.toHaveBeenCalled()
  })

  it('动的是世界观 ⇒ 影响范围说「全书设定」，不谎报章号', async () => {
    await renderPanel(ONCE_PLAN, 'worldbuilding')
    expect(testid('invalidation-scope').textContent).toContain('世界观变更影响全书设定')
  })
})

describe('失效清单强提醒面板 · strong 档', () => {
  it('未勾选 ⇒ 主按钮 disabled，点了也没用', async () => {
    const { onProceed } = await renderPanel(STRONG_PLAN)
    const ack = container.querySelector<HTMLInputElement>('[data-testid="invalidation-ack"]')
    expect(ack).not.toBeNull()
    expect(proceedButton().disabled).toBe(true)
    await click(proceedButton())
    expect(onProceed).not.toHaveBeenCalled()
  })

  it('勾选后放行，且勾选文案带真实章数', async () => {
    const { onProceed } = await renderPanel(STRONG_PLAN)
    const ack = container.querySelector<HTMLInputElement>('[data-testid="invalidation-ack"]')!
    // React 的受控 checkbox 只认真实的 click：**先手设 checked 再 click 会把它又切回去**。
    await act(async () => ack.click())
    expect(proceedButton().disabled).toBe(false)
    // 第 1 卷 20 章 + 第 31 章 = 21 章
    // S6 之后这句话分了两档：这份计划里没有 `finalized` 组，所以不能说「已定稿」。
    expect(container.textContent).toContain('我明白这会波及 21 章派生内容')
    await click(proceedButton())
    expect(onProceed).toHaveBeenCalledOnce()
  })

  it('清单里出现交接单组，并说明它会导致下一卷开不了工', async () => {
    await renderPanel(STRONG_PLAN)
    expect(testid('invalidation-groups').textContent).toContain('卷末交接单（1）')
    expect(container.textContent).toContain('下一卷会开不了工')
  })

  it('unseen 为 0 时不渲染那一行（不是渲染成「另有 0 项」）', async () => {
    await renderPanel(STRONG_PLAN)
    expect(container.querySelector('[data-testid="invalidation-unseen"]')).toBeNull()
  })
})

/**
 * S6 / M28：已定稿章节组与「回滚逐层列出」。
 *
 * 两处文案改动的共同点：**它们原来都在说一件没有依据的话**。
 * - 勾选那句写「N 章已定稿内容」，而 N 是所有受影响章 —— 交接单触发的 strong 里
 *   一张已定稿章都没有时，这句话是假的；
 * - 影响范围那句有第四档「卷回滚 ⇒ 逐层列出」，但请求里没有 `reason`，一直判不出来。
 *
 * 现在两者都有原料了。这里钉住的是「原料变了，话说对了没有」——
 * 不是样式，是**这句话会不会让作者按错误的理解点下去**。
 */
describe('失效清单强提醒面板 · S6 已定稿章节', () => {
  const FINALIZED_PLAN: InvalidationPlan = {
    groups: [
      { kind: 'blueprint', count: 1, items: [{ label: '第 12 章', chapters: [12], behind: BLUEPRINT_DRIFT }] },
      { kind: 'finalized', count: 2, items: [
        { label: '第 8 章', chapters: [8], behind: BLUEPRINT_DRIFT },
        { label: '第 9 章', chapters: [9], behind: BLUEPRINT_DRIFT },
      ] },
    ],
    unseen: { count: 0, kinds: [] },
    tier: 'strong',
    unaffected: null,
    reason: 'regenerate',
  }

  it('有已定稿组 ⇒ 勾选那句报「Z 章已定稿正文」，不是「已定稿内容」', async () => {
    await renderPanel(FINALIZED_PLAN)
    expect(container.textContent).toContain('已定稿章节（2）')
    // 只有 8、9 两章真的定稿；第 12 章只是蓝图。把三个加起来说「3 章已定稿」就是谎报。
    expect(container.textContent).toContain('我明白这会波及 2 章已定稿正文')
  })

  it('没有已定稿组时不许说「已定稿」—— 那是交接单触发的 strong', async () => {
    await renderPanel(STRONG_PLAN)
    expect(container.textContent).not.toContain('已定稿正文')
  })

  it('reason=rollback ⇒ 影响范围先讲级联顺序，章号收得出来就照旧附上', async () => {
    await renderPanel({ ...ONCE_PLAN, reason: 'rollback' })
    const scope = testid('invalidation-scope').textContent ?? ''
    expect(scope).toContain('这是回滚')
    expect(scope).toContain('大纲 → 章节蓝图 → 卷末交接单 → 已定稿正文')
    // 回滚不等于「全书」：说得出章号就要说，别退化成「影响范围难以精确判定」。
    expect(scope).toContain('影响章节：3、12')
  })

  it('reason 不是 rollback ⇒ 一个字都不许多（向后兼容：不传 reason 的老调用方行为不变）', async () => {
    await renderPanel(ONCE_PLAN)
    const scope = testid('invalidation-scope').textContent ?? ''
    expect(scope).not.toContain('这是回滚')
    expect(scope).toBe('影响章节：3、12')
  })
})
