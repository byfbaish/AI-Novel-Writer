/**
 * 卷结构告警的**分类汇总**（D15 接线时补）。
 *
 * ## 为什么需要分类
 *
 * `VolumePlanProjection.warnings` 是一个 `string[]`，混着两种完全不同的问题：
 *
 * - `VOLUME_OBSERVED_OUT_OF_RANGE`：大纲里的章号跑到算出的卷外 —— 大纲与实际进度不同步；
 * - `VOLUME_UNIT_*`：同一段章号被两个单元共用 —— 卷内区间划分有问题。
 *
 * 面板原先把整个数组一律说成「观测与算出的区间不一致（大纲与实际不同步）」。
 * 单元重叠接进同一个通道后，那句话会变成**错误归因**：作者会去查大纲进度，
 * 而实际该改的是单元归属。两者的处置完全不同，所以按前缀拆开再分别成句。
 *
 * ## 只数 `ambiguous-chapter`
 *
 * `overlap` / `inverted-range` 是 `ambiguous-chapter` 的同因描述
 * （前者按单元对列举、后者按章列举），三样全数会让同一处重叠在界面上报三遍。
 */

export type VolumeWarningSummary = {
  /** `VOLUME_OBSERVED_OUT_OF_RANGE:*` 的条数。 */
  observedOutOfRange: number
  /** `VOLUME_UNIT_AMBIGUOUS:*` 的条数（一处重叠计一次）。 */
  ambiguousCount: number
  /** 上述告警涉及的章号，已拼成人读文本（如 `8-9`、`8-9、12`）。 */
  ambiguousChapters: string
  /** 前缀不认识的告警条数 —— 留着是为了「新加告警忘了归类」时界面不会静默吞掉。 */
  other: number
}

export function summarizeVolumeWarnings(warnings: readonly string[]): VolumeWarningSummary {
  let observedOutOfRange = 0
  let ambiguousCount = 0
  let other = 0
  const ambiguousChapters: string[] = []

  for (const warning of warnings) {
    if (warning.startsWith('VOLUME_UNIT_AMBIGUOUS:')) {
      ambiguousCount += 1
      // `VOLUME_UNIT_AMBIGUOUS:<卷>:<单元>-<单元>:<章>` —— 章号是最后一段
      const chapters = warning.split(':')[3]
      if (chapters) ambiguousChapters.push(chapters)
    } else if (warning.startsWith('VOLUME_UNIT_')) {
      // overlap / inverted-range：同因的另一种列举，不重复计数
    } else if (warning.startsWith('VOLUME_OBSERVED_OUT_OF_RANGE')) {
      observedOutOfRange += 1
    } else {
      other += 1
    }
  }

  return { observedOutOfRange, ambiguousCount, ambiguousChapters: ambiguousChapters.join('、'), other }
}
