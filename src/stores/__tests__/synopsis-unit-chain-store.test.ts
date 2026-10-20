import { beforeEach, describe, expect, it } from 'vitest'

import { useSynopsisUnitChainStore } from '../synopsis-unit-chain-store'

/** E3 T12：连写状态容器。只保证「进得去、退得出、停掉就不会被复活」。 */
describe('synopsis-unit-chain-store', () => {
  beforeEach(() => {
    useSynopsisUnitChainStore.getState().clear()
  })

  it('起链就是「已发起 1 批」，并原样记住作者参数', () => {
    useSynopsisUnitChainStore.getState().start({
      projectPath: 'C:/books/a',
      total: 3,
      volumeIndex: 2,
      runId: 'run-1',
      targetUnits: 700,
      stepGuidance: { synopsis: '多写打脸' },
    })
    const chain = useSynopsisUnitChainStore.getState().chain
    expect(chain).toMatchObject({
      projectPath: 'C:/books/a',
      total: 3,
      launched: 1,
      volumeIndex: 2,
      runId: 'run-1',
      targetUnits: 700,
      status: 'running',
      stopReason: null,
    })
    // 深拷：调用方之后改自己的对象不该影响后续批次
    expect(chain?.stepGuidance).toEqual({ synopsis: '多写打脸' })
  })

  it('advance 只会往后走，停掉的链不再接受新批次', () => {
    useSynopsisUnitChainStore.getState().start({ projectPath: 'p', total: 3, volumeIndex: 1, runId: 'run-1' })
    useSynopsisUnitChainStore.getState().advance('run-2')
    expect(useSynopsisUnitChainStore.getState().chain).toMatchObject({ launched: 2, runId: 'run-2' })

    useSynopsisUnitChainStore.getState().stop('volume-end', '第 1 卷写完了')
    useSynopsisUnitChainStore.getState().advance('run-3')
    expect(useSynopsisUnitChainStore.getState().chain).toMatchObject({
      launched: 2,
      runId: 'run-2',
      status: 'stopped',
      stopReason: 'volume-end',
      stopDetail: '第 1 卷写完了',
    })
  })

  it('stop 幂等：同一个原因重复上报不会把状态抖回去', () => {
    useSynopsisUnitChainStore.getState().start({ projectPath: 'p', total: 2, volumeIndex: 1, runId: 'run-1' })
    useSynopsisUnitChainStore.getState().stop('failed', '批次失败')
    const first = useSynopsisUnitChainStore.getState().chain
    useSynopsisUnitChainStore.getState().stop('failed', '批次失败')
    // store 保持同一份引用（没有多余的状态变更），避免订阅方被无意义地唤醒
    expect(useSynopsisUnitChainStore.getState().chain).toBe(first)
  })

  it('没有链的时候 stop / advance 都是空操作', () => {
    expect(() => useSynopsisUnitChainStore.getState().stop('manual')).not.toThrow()
    useSynopsisUnitChainStore.getState().advance('run-x')
    expect(useSynopsisUnitChainStore.getState().chain).toBeNull()
  })

  it('total 至少是 1（选 0 个单元没有意义）', () => {
    useSynopsisUnitChainStore.getState().start({ projectPath: 'p', total: 0, volumeIndex: null, runId: 'run-1' })
    expect(useSynopsisUnitChainStore.getState().chain?.total).toBe(1)
  })
})
