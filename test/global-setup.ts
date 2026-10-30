import { sweepDiscardedTrees } from './helpers/temp-dir'

/**
 * vitest `globalSetup`：整轮跑测开始前跑一次（不是每个文件一次）。
 *
 * 只做一件事 —— 把**上一轮** `discardTree` 没删掉的临时目录扫掉。
 *
 * ## 为什么只在开跑前扫，不在结束时扫
 *
 * 结束时的 teardown 看起来更顺手，但它是 vitest 关闭阶段的最后一个钩子：一旦它慢住或卡住，
 * 整轮跑测就**不出汇总**（表现是文件列表打完就没下文了）。2026-10-30 深夜为这一个钩子排查
 * 了三轮全量跑测才发现不值得。开跑前扫完全等价（残留迟早会被清），却完全不碰关闭路径。
 */
export default function globalSetup(): void {
  sweepDiscardedTrees()
}
