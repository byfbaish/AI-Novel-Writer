import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CharacterProposalInbox } from '../CharacterProposalInbox'
import type { CharacterProposalHistoryEntry } from '../../../shared/character-proposal'
import { useCharacterStore } from '../../../stores/character-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useProjectStore } from '../../../stores/project-store'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = { projectId: '项目', projectPath: 'C:/收件箱', leaseId: '会话' }

const cancelledEntry: CharacterProposalHistoryEntry = {
  proposalBatchId: 'cpb:取消批次', revision: 3, status: 'cancelled', sourceGroup: 'directory',
  source: { kind: 'directory', operationId: 'blueprint-sync-目录' },
  itemCount: 6, label: '章节蓝图 · 6 个角色',
}

let root: Root | undefined
let host: HTMLDivElement | undefined
let invoke: ReturnType<typeof vi.fn>

function mountApi(history: CharacterProposalHistoryEntry[]) {
  invoke = vi.fn(async (channel: string) => {
    if (channel === 'character-proposal:list-history') return history
    if (channel === 'character-proposal:reopen') return { proposalBatchId: 'cpb:取消批次', status: 'pending-approval' }
    if (channel === 'skills:list-user') return []
    if (channel === 'fs:check-exists') return false
    throw new Error(channel)
  })
  ;(window as unknown as { aiNovelAPI: { invoke: typeof invoke; on: () => () => void } }).aiNovelAPI = { invoke, on: () => () => {} }
}

afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = undefined
  host = undefined
  useProjectStore.setState({ currentProject: null })
  useCharacterStore.setState({ characters: [], rosterRevision: 0 } as never)
})

async function mount(history: CharacterProposalHistoryEntry[]) {
  useLocaleStore.setState({ locale: 'zh-CN' })
  useProjectStore.setState({ currentProject: { id: session.projectId, path: session.projectPath, sessionLease: session.leaseId, novelConfig: {} } as never })
  mountApi(history)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => { root?.render(<CharacterProposalInbox />) })
  return host
}

describe('候选收件箱对已取消批次', () => {
  it('保留入口并可重新打开（取消不落身份效果，作者应能重来）', async () => {
    const host = await mount([cancelledEntry])
    // 已取消批次不再从收件箱消失 —— 否则这批候选就永远无路可回。
    await expect.element(page.getByRole('button', { name: '检查角色候选：章节蓝图 · 6 个角色' })).toBeVisible()
    expect(host.textContent).toContain('已取消 · 章节蓝图 · 6 个角色')
    await act(async () => { await page.getByRole('button', { name: '重新打开' }).click() })
    expect(invoke.mock.calls.some(([channel]) => channel === 'character-proposal:reopen'
      && JSON.stringify((invoke.mock.calls.find(([c]) => c === 'character-proposal:reopen')?.[1] as { expectedRevision: number }).expectedRevision) === '3')).toBe(true)
  })

  it('纯已批准批次不进收件箱', async () => {
    await mount([{ ...cancelledEntry, status: 'approved', proposalBatchId: 'cpb:已批' }])
    expect(host!.textContent).not.toContain('待处理角色候选')
  })
})
