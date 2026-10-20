/**
 * E3 T12：连续写多个单元（**链式新 run**，不是 run 内循环）。
 *
 * 作者裁定（2026-10-20）：
 * - 入口 = 在架构确认弹窗里直接选「连写 N 个单元」；
 * - 停止条件 = **只连续到本卷末**（v1）。「写到全书完」「跑到指定个数就停」都先不做，
 *   它们需要「卷冻结」配合评估 —— 卷是一道天然对账边界，跨卷自动跑会把对账时机藏起来。
 *
 * 为什么是链式新 run 而不是一个 run 里循环：
 * 现有 owner / lease / binding / 指纹全部围绕「一次 run 只做一批」建立（按章续批
 * `planningContinuation` 也是发新 run）。在 run 内循环要重写占位与子 run 授权语义，
 * 风险远大于收益；而每批本来就是原子的 —— 中途停下来，已完成的单元照样在检查点里。
 *
 * 本模块**只做判定**（纯函数），状态与副作用在 `stores/synopsis-unit-chain-store` 与 App。
 */

export type UnitChainStopReason =
  /** 写满了作者要求的 N 个单元。 */
  | 'quota'
  /** 下一个单元已经进了下一卷（v1 不跨卷）。 */
  | 'volume-end'
  /** 探针算不出下一个单元（全书走完 / 骨架没划界 / 检查点未完成…）。 */
  | 'no-unit'
  /** 当前批次失败或被取消。 */
  | 'failed'
  /** 项目会话换了。 */
  | 'project-changed'
  /** 作者点了「停止连续」。 */
  | 'manual'

export interface SynopsisUnitChainState {
  readonly projectPath: string
  /** 作者选的 N：本次最多连写几个单元（≤ 本卷剩余单元数）。 */
  readonly total: number
  /** 已经**发起**的批次数（首批 = 1）。 */
  readonly launched: number
  /** 链启动时所在的卷号；一旦下一批换了卷就停。`null` = 卷结构读不出来，不判卷界。 */
  readonly volumeIndex: number | null
  /** 当前批次的 run（只认它的完成事件，别的架构 run 不许推进这条链）。 */
  readonly runId: string | null
  /**
   * 首批带出去的作者参数，**每一批都要原样重放**。
   * 「每章大纲目标字数」与「补充指导」是作者对整段大纲的要求，第二批就丢了 = 前后两批口径不一致。
   */
  readonly targetUnits: number | null
  readonly stepGuidance: Record<string, string>
  readonly status: 'running' | 'stopped'
  readonly stopReason: UnitChainStopReason | null
  /** 停下来的**人话**解释（直接进 toast / 横幅）。 */
  readonly stopDetail: string | null
}

export interface UnitChainDecision {
  readonly action: 'continue' | 'stop'
  readonly reason: UnitChainStopReason | null
  readonly detail: string | null
}

export interface UnitChainStepInput {
  readonly chain: SynopsisUnitChainState
  /**
   * 下一批探针结果：`null` = 算不出下一个单元；`volumeIndex: null` = 探针没给卷信息
   * （此时**不判卷界**，宁可继续也别用猜的卷号把链掐断）。
   */
  readonly next: { readonly volumeIndex: number | null } | null
  /** 探针跳过原因（`no-unit` 时写进人话解释）。 */
  readonly probeReason?: string | null
}

/** 批次完成后该不该再发一批。**纯函数**：同样的输入永远同一个结论。 */
export function decideUnitChainStep(input: UnitChainStepInput): UnitChainDecision {
  const { chain, next } = input
  if (chain.status !== 'running') {
    return stop(chain.stopReason ?? 'manual', chain.stopDetail)
  }
  if (!next) {
    return stop('no-unit', `下一个单元算不出来：${input.probeReason ?? '探针未给出原因'}`)
  }
  // 先判卷界再判配额：跨卷时「本卷写完了」比「凑够 N 个了」更能解释作者看到的现象。
  if (chain.volumeIndex !== null && next.volumeIndex !== null && next.volumeIndex !== chain.volumeIndex) {
    return stop('volume-end', `第 ${chain.volumeIndex} 卷的单元已写完，下一批会进第 ${next.volumeIndex} 卷`)
  }
  if (chain.launched >= chain.total) {
    return stop('quota', `已连写 ${chain.launched} 个单元（本次上限 ${chain.total} 个）`)
  }
  return { action: 'continue', reason: null, detail: null }
}

function stop(reason: UnitChainStopReason, detail: string | null): UnitChainDecision {
  return { action: 'stop', reason, detail }
}

/** 停止原因 → 界面文案（横幅 / toast 用；`describeUnitChain` 只给控制台看）。 */
export const UNIT_CHAIN_STOP_COPY: Record<UnitChainStopReason, { zh: string; en: string }> = {
  quota: { zh: '连写的单元已写完', en: 'All requested units are done' },
  'volume-end': { zh: '本卷已写完，连写到卷末为止', en: 'This volume is finished; chaining stops at the volume end' },
  'no-unit': { zh: '没有下一个单元了', en: 'There is no next unit' },
  failed: { zh: '这一批失败了，已停止连写', en: 'This batch failed, so chaining stopped' },
  'project-changed': { zh: '项目已切换，已停止连写', en: 'The project changed, so chaining stopped' },
  manual: { zh: '已手动停止连写（当前这批会写完）', en: 'Chaining stopped (the current batch still finishes)' },
}

/** 说明这条链在干什么（横幅一行字）。 */
export function describeUnitChain(chain: SynopsisUnitChainState): string {
  const progress = `第 ${Math.min(chain.launched, chain.total)}/${chain.total} 个单元`
  if (chain.status === 'running') return `连续生成中：${progress}`
  switch (chain.stopReason) {
    case 'quota':
      return `连续生成已结束：${progress}`
    case 'volume-end':
      return `连续生成已结束：本卷写完（${progress}）`
    case 'no-unit':
      return '连续生成已结束：没有下一个单元了'
    case 'failed':
      return `连续生成已中断：${progress}失败`
    case 'project-changed':
      return '连续生成已停止：项目已切换'
    case 'manual':
    default:
      return `连续生成已停止：${progress}`
  }
}
