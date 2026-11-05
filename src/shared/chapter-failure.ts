/**
 * D13 章节失败契约（方案稿 §5.1）。
 *
 * 「一章为什么没写出来」要有身份：正文层 / 组装层 / 调用层的每个失败出口都归到
 * 一个**受控码**，作者拿到的不是三句互不相干的话，而是一份可判定的诊断。
 *
 * 四条使用规则（§5.1，禁止长出第四种形态）：
 * 1. **`code` 必须来自本文件的受控词表**（`CHAPTER_FAILURE_CODE_VOCABULARY`），
 *    不许临场拼字符串 —— 与「设计稿状态行取值受控」同一条纪律，用测试钉住。
 * 2. **`detail` 只写现象，不写归因** —— 归因在 `code` 里；改文案不会改机器判定，
 *    也不会把码与文案耦合死。
 * 3. **抛出的对象必须带 `code` 字段**（自定义 Error 子类或 `Object.assign`），
 *    因为 `recoveryFailureCode` 只认 `error.code`（generate-draft.command.ts）。
 * 4. **跨进程必须保住码** —— Electron IPC 会丢类身份与 `code` 属性，只剩
 *    `Error invoking remote method '<channel>': Error: <码>` 形态的 message；
 *    跨进程的码走 §5.4 B 路正则（`safeProtocolCode`）从 message 取，抛点时
 *    message 必须是**纯码**，人话进 `detail`，不许夹回 message。
 */
export type ChapterFailureLayer = 'call' | 'content' | 'compose'

export interface ChapterFailure {
  layer: ChapterFailureLayer
  /** 机器可判的稳定码，取值受控（§5.2 / §5.3 词表） */
  code: string
  /** 一句话说明，进 UI；只写现象，不写归因，不含行号与内部术语 */
  detail: string
  /** 作者能做的下一步；空数组表示"没有可做的" */
  suggestions: string[]
}

/** 受控码词表（§5.2 正文层 + §5.3 组装层）。新增码必须同时更新这里的常量与下方 meta。 */
export const CHAPTER_FAILURE_CODES = {
  // —— 正文层（§5.2）——
  /** 正文明显不足目标字数（两处抛点共用） */
  DRAFT_TOO_SHORT: 'DRAFT_TOO_SHORT',
  /** 退化 · 整段复读 */
  DRAFT_DEGENERATE_VERBATIM_REPEAT: 'DRAFT_DEGENERATE_VERBATIM_REPEAT',
  /** 退化 · 占位 / 拒绝语 */
  DRAFT_DEGENERATE_PLACEHOLDER: 'DRAFT_DEGENERATE_PLACEHOLDER',
  /** 退化 · 工序词泄漏 */
  DRAFT_DEGENERATE_META_LEAK: 'DRAFT_DEGENERATE_META_LEAK',
  /** 照搬本章蓝图事件原文 */
  DRAFT_BLUEPRINT_COPY: 'DRAFT_BLUEPRINT_COPY',
  /** 开头重演上一章结尾 */
  DRAFT_PREVIOUS_ENDING_REPLAY: 'DRAFT_PREVIOUS_ENDING_REPLAY',
  /** 作者配置在生成途中被改 */
  DRAFT_AUTHOR_CONFIG_CHANGED: 'DRAFT_AUTHOR_CONFIG_CHANGED',
  /** 唯一一次无进展恢复后仍无进展 */
  DRAFT_NO_PROGRESS: 'DRAFT_NO_PROGRESS',
  /** finishReason=length（正文收尾 / 压缩轮共用映射） */
  DRAFT_INCOMPLETE_LENGTH: 'DRAFT_INCOMPLETE_LENGTH',
  /** finishReason=content_filter */
  DRAFT_INCOMPLETE_CONTENT_FILTER: 'DRAFT_INCOMPLETE_CONTENT_FILTER',
  /** finishReason=cancelled */
  DRAFT_INCOMPLETE_CANCELLED: 'DRAFT_INCOMPLETE_CANCELLED',
  /** finishReason=unknown（LLMFinishReason 的 'error' 不映射，见 incompleteFinishReasonCode 注释） */
  DRAFT_INCOMPLETE_UNKNOWN: 'DRAFT_INCOMPLETE_UNKNOWN',
  /** 压缩轮取消 */
  DRAFT_CANCELLED: 'DRAFT_CANCELLED',
  // —— 组装层（§5.3）——
  /** 合成结果为空 */
  GENERATION_COMPOSITION_EMPTY: 'GENERATION_COMPOSITION_EMPTY',
  /** 压缩修订本不该发生 / 压缩响应被截断（判的是压缩前正文） */
  GENERATION_COMPOSITION_CONDENSE_UNEXPECTED: 'GENERATION_COMPOSITION_CONDENSE_UNEXPECTED',
  /** 压缩响应非 stop（被截断） */
  GENERATION_COMPOSITION_CONDENSE_TRUNCATED: 'GENERATION_COMPOSITION_CONDENSE_TRUNCATED',
  /** 截断且本轮增量不足 */
  GENERATION_COMPOSITION_TRUNCATED_NO_PROGRESS: 'GENERATION_COMPOSITION_TRUNCATED_NO_PROGRESS',
  /** 合成后根本没变长 */
  GENERATION_COMPOSITION_NO_PROGRESS: 'GENERATION_COMPOSITION_NO_PROGRESS',
} as const

export type ChapterFailureCode = typeof CHAPTER_FAILURE_CODES[keyof typeof CHAPTER_FAILURE_CODES]

export const CHAPTER_FAILURE_CODE_VOCABULARY: readonly ChapterFailureCode[] = Object.freeze(
  Object.values(CHAPTER_FAILURE_CODES),
)

export function isChapterFailureCode(value: string): value is ChapterFailureCode {
  return (CHAPTER_FAILURE_CODE_VOCABULARY as readonly string[]).includes(value)
}

/** 码 → 对人话版本（detail + suggestions 的来源：只有这里，UI 不得按 code 写 if-else 拼文案）。 */
const CHAPTER_FAILURE_META: Readonly<Record<ChapterFailureCode, ChapterFailure>> = Object.freeze({
  [CHAPTER_FAILURE_CODES.DRAFT_TOO_SHORT]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_TOO_SHORT,
    detail: '模型已声明生成结束，但正文明显未达到本章目标字数，结果未保存。',
    suggestions: ['提高最大输出 Tokens，或降低本章目标字数', '改用输出能力更强的模型后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_DEGENERATE_VERBATIM_REPEAT]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_DEGENERATE_VERBATIM_REPEAT,
    detail: '生成的正文出现整段复读，未通过内容完整性检查，结果未保存。',
    suggestions: ['更换生成模型后重试', '调整本章目标字数后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_DEGENERATE_PLACEHOLDER]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_DEGENERATE_PLACEHOLDER,
    detail: '生成的正文被占位或拒绝语填充，未通过内容完整性检查，结果未保存。',
    suggestions: ['更换生成模型后重试', '检查并补充本章蓝图后再试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_DEGENERATE_META_LEAK]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_DEGENERATE_META_LEAK,
    detail: '生成的正文混入了工序性说明文字，未通过内容完整性检查，结果未保存。',
    suggestions: ['更换生成模型后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_BLUEPRINT_COPY]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_BLUEPRINT_COPY,
    detail: '生成的正文照搬了本章蓝图中的事件原文，没有展开成正文，结果未保存。',
    suggestions: ['调整本章蓝图的措辞，避免模型直接照抄', '更换生成模型后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_PREVIOUS_ENDING_REPLAY]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_PREVIOUS_ENDING_REPLAY,
    detail: '生成的正文开头重演了上一章结尾，没有推进本章内容，结果未保存。',
    suggestions: ['修改上一章结尾，或调整本章开头的衔接设定', '更换生成模型后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_AUTHOR_CONFIG_CHANGED]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_AUTHOR_CONFIG_CHANGED,
    detail: '生成途中章节配置发生了变化，本次结果未保存。',
    suggestions: ['确认配置稳定后重新生成本章'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_NO_PROGRESS]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_NO_PROGRESS,
    detail: '重试后正文仍无进展或仍退化，结果未保存。',
    suggestions: ['更换生成模型后重试', '降低本章目标字数后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_LENGTH]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_LENGTH,
    detail: '模型在达到输出上限时结束，正文未完整生成。',
    suggestions: ['提高最大输出 Tokens，或缩短本章目标字数', '已保存的部分可通过续写补齐'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CONTENT_FILTER]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CONTENT_FILTER,
    detail: '模型因内容限制提前结束，正文未完整生成，结果未保存。',
    suggestions: ['调整本章内容设定后重试', '更换生成模型后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CANCELLED]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CANCELLED,
    detail: '生成在完成前被取消，结果未保存。',
    suggestions: ['如需结果，请重新生成本章'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_UNKNOWN]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_UNKNOWN,
    detail: '模型以未知原因提前结束，正文未完整生成，结果未保存。',
    suggestions: ['更换生成模型后重试', '提高最大输出 Tokens 后重试'],
  },
  [CHAPTER_FAILURE_CODES.DRAFT_CANCELLED]: {
    layer: 'content',
    code: CHAPTER_FAILURE_CODES.DRAFT_CANCELLED,
    detail: '压缩修订在完成前被取消，结果未保存。',
    suggestions: ['如需结果，请重新生成本章'],
  },
  [CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_EMPTY]: {
    layer: 'compose',
    code: CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_EMPTY,
    detail: '本章正文在合成环节没有产出内容，结果未保存。',
    suggestions: ['更换生成模型后重新生成本章'],
  },
  [CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_CONDENSE_UNEXPECTED]: {
    layer: 'compose',
    code: CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_CONDENSE_UNEXPECTED,
    detail: '压缩修订未按预期完成（正文本不需要压缩，或压缩响应被截断），正文未合并，结果未保存。',
    suggestions: ['确认本章目标字数设置后重试', '提高最大输出 Tokens 后重试'],
  },
  [CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_CONDENSE_TRUNCATED]: {
    layer: 'compose',
    code: CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_CONDENSE_TRUNCATED,
    detail: '压缩响应被截断，正文未合并，结果未保存。',
    suggestions: ['提高最大输出 Tokens 后重试'],
  },
  [CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_TRUNCATED_NO_PROGRESS]: {
    layer: 'compose',
    code: CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_TRUNCATED_NO_PROGRESS,
    detail: '模型在达到输出上限时结束，且本轮新增正文不足，结果未保存。',
    suggestions: ['降低本章目标字数后重试', '更换生成模型后重试'],
  },
  [CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_NO_PROGRESS]: {
    layer: 'compose',
    code: CHAPTER_FAILURE_CODES.GENERATION_COMPOSITION_NO_PROGRESS,
    detail: '合成后正文没有增长，续写没有进展，结果未保存。',
    suggestions: ['更换生成模型后重试', '调整续写起点或本章目标字数'],
  },
})

/** 取码的对人话契约；不在词表内的码返回 undefined（如 GENERATION_FAILED 兜底，UI 需自行兜底）。 */
export function chapterFailureMeta(code: string): ChapterFailure | undefined {
  return CHAPTER_FAILURE_META[code as ChapterFailureCode]
}

/**
 * `finishReason` 非 stop → 正文层不完整码（§5.2）。
 * `BoundedCompletionFailure.failureCode`（bounded-completion.ts）取 length / content_filter /
 * cancelled / unknown 四种，映射成 DRAFT_INCOMPLETE_*。
 *
 * `LLMFinishReason` 另有 `'error'`：**不映射**（返回 undefined）——现场裁决，
 * 依据：① §5.2 表只列 4 值；② 既有测试 generate-draft.command.test.ts:5341 钉死
 * 「provider error + 不可信失败文本不得变成显示码」（该断言不在卡面许可改动清单）。
 * 'error' 无码时走 GENERATION_FAILED 兜底。
 */
export function incompleteFinishReasonCode(reason: string): ChapterFailureCode | undefined {
  switch (reason) {
    case 'length': return CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_LENGTH
    case 'content_filter': return CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CONTENT_FILTER
    case 'cancelled': return CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_CANCELLED
    case 'unknown': return CHAPTER_FAILURE_CODES.DRAFT_INCOMPLETE_UNKNOWN
    default: return undefined
  }
}
