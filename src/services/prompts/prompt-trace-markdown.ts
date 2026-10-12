/**
 * Prompt 追踪快照的 markdown 渲染（**纯函数、零运行时依赖**）。
 *
 * 为什么要单独成文件：
 * ① 它是"给人看的那一面"，格式规则（**首屏必须是拼装态**）值得被单独测试与复用；
 * ② 主落盘模块 `prompt-trace-writer.ts` 依赖 `ipc-client` / `debug-store` 等渲染层模块，
 *    在 Node 侧无法直接引入；离线用真实落盘数据渲染预览时需要一个无依赖入口。
 *
 * 因此本文件**不得**引入任何运行时依赖（只允许类型）。
 */

/** 片段（与 `PromptTraceSnapshot.fragments` 结构兼容，此处内联以免反向依赖）。 */
export interface PromptTraceMarkdownFragment {
  order: number
  sourceKind: string
  label: string
  editable: boolean
  resolvedFrom?: string
  rawText: string
  variables: ReadonlyArray<{ key: string; value: string }>
  note?: string
}

export interface PromptTraceMarkdownSnapshot {
  promptKey: string
  writingLanguage: string
  capturedAt: number
  builtLength: number
  fragments: ReadonlyArray<PromptTraceMarkdownFragment>
  /** 组装后的 user 正文（变量已替换）。 */
  built: string
  /** 实际作为 system message 发送的内容；旧数据可能缺失。 */
  systemMessage?: string
}

/** 一次真实请求（一轮生成可能有多次：短纲 → 正文 → 续写）。 */
export interface PromptTraceMarkdownIoCall {
  /** `task.purpose`，用于区分同轮内的多次请求。 */
  purpose?: string
  messages: ReadonlyArray<{ role: string; content: string }>
  output: string
  finishReason?: string
  /** 记录时刻；旧数据可能缺失。 */
  at?: number
}

export interface PromptTraceMarkdownPayload {
  runHandle?: string
  operation?: string
  chapterNumber?: number
  writtenAt: number
  snapshots: ReadonlyArray<PromptTraceMarkdownSnapshot>
  /** 本轮实际发出的**全部**请求，按序（这是评估提示词的主要依据）。 */
  ioCalls?: ReadonlyArray<PromptTraceMarkdownIoCall>
  /** 旧数据（P2.3 之前）只记录单次请求面；读取时并入 `ioCalls`。 */
  io?: PromptTraceMarkdownIoCall
}

/** 追加一个 ```text 代码块（反引号转义，避免截断 markdown）。 */
function pushCodeBlock(lines: string[], text: string): void {
  lines.push('```text')
  lines.push(text.replace(/\r\n/g, '\n').replace(/```/g, "'''"))
  lines.push('```', '')
}

/** 一次调用的标题，如 `第 2 次 · \`chapter-draft-continuation\` · finishReason=stop`。 */
function callHeading(index: number, call: PromptTraceMarkdownIoCall): string {
  const parts = [`第 ${index + 1} 次`]
  if (call.purpose) parts.push(`\`${call.purpose}\``)
  parts.push(`finishReason=\`${call.finishReason ?? 'unknown'}\``)
  return `### ${parts.join(' · ')}`
}

/**
 * 能否把「唯一一次调用」当作该快照的真实请求面。
 *
 * 光看数量不够：一轮生成可能只保留了其中一次调用（旧数据），而快照属于**另一个阶段**
 * —— 例如正文快照是「首次成稿」，唯一录到的请求却是「自动续写」。那种情况下把它当成
 * 该快照的提示词就是张冠李戴。因此要求真实请求里确实**包含**该快照的组装正文。
 * 判不出时一律退回「按装配结果重建 + 全量列出请求」，这是永远正确的路径。
 */
function associatedCallOf(
  ioCalls: ReadonlyArray<PromptTraceMarkdownIoCall>,
  snapshots: ReadonlyArray<PromptTraceMarkdownSnapshot>,
): PromptTraceMarkdownIoCall | undefined {
  if (ioCalls.length !== 1 || snapshots.length !== 1) return undefined
  const needle = snapshots[0].built.trim().slice(0, 120)
  if (!needle) return undefined
  return ioCalls[0].messages.some(message => message.content.includes(needle)) ? ioCalls[0] : undefined
}

/**
 * 人读快照。
 *
 * 首屏必须是**拼装后的完整提示词**（评估提示词质量看这里），而不是模板。
 * 模板片段（变量未替换）排在后面，只用于回答"这一块从哪来、能不能改"。
 *
 * 请求面有两个来源，规则单一：
 * - `ioCalls`：实际发出的请求，**与模型收到的完全一致**（含运行时注入的写作 Skill）。
 *   一轮发多次请求时全部按序保留 —— 不能只留最后一次，否则中间请求的提示词与产出全丢。
 * - 快照重建：`systemMessage` + `built` 拼出请求骨架；运行时注入的内容不在此列，故显式标注来源。
 *
 * 仅当「恰好一个装配快照 + 恰好一次调用 + 请求里确实含该快照正文」时，两者才能唯一对应，
 * 此时才把这次真实请求当作该快照的首屏（避免同一段提示词在文件里出现两遍）。
 */
export function buildTraceMarkdown(payload: PromptTraceMarkdownPayload): string {
  const ioCalls: ReadonlyArray<PromptTraceMarkdownIoCall> = payload.ioCalls && payload.ioCalls.length > 0
    ? payload.ioCalls
    : payload.io
      ? [payload.io]
      : []
  const associatedCall = associatedCallOf(ioCalls, payload.snapshots)
  const associated = associatedCall !== undefined

  const lines: string[] = []
  lines.push('# Prompt 追踪快照', '')
  lines.push(`- 生成任务：\`${payload.operation ?? '未知'}\``)
  lines.push(`- 关联句柄：\`${payload.runHandle ?? '（无，未进入命令作用域）'}\``)
  if (payload.chapterNumber !== undefined) lines.push(`- 章节：第 ${payload.chapterNumber} 章`)
  lines.push(`- 记录时刻：${new Date(payload.writtenAt).toLocaleString('zh-CN')}`)
  lines.push(`- 提示词装配批次：${payload.snapshots.length}`)
  lines.push(`- 实际调用次数：${ioCalls.length}`)
  lines.push(`- 请求面来源：${ioCalls.length > 0 ? '实际发出（与模型收到的一致）' : '按装配结果重建'}`, '')

  for (const [index, snapshot] of payload.snapshots.entries()) {
    lines.push('---', '')
    lines.push(`## ${index + 1}. \`${snapshot.promptKey}\``, '')
    lines.push(`组装后长度：${snapshot.builtLength} 字 · 共 ${snapshot.fragments.length} 块`, '')

    // ① 首屏：拼装后的完整提示词
    lines.push('### 拼装后的完整提示词（发送给模型前）', '')
    if (associatedCall) {
      lines.push('> 来源：**实际发出的请求**，与模型收到的逐字一致。', '')
      for (const message of associatedCall.messages) {
        lines.push(`#### ${message.role}`, '')
        pushCodeBlock(lines, message.content)
      }
    } else {
      lines.push('> 来源：**按装配结果重建**。由「system 角色」+「组装后正文」拼出骨架；')
      lines.push('> 运行时注入的「补充写作 Skill」等不在其中。')
      if (ioCalls.length > 0) {
        lines.push(`> 本轮实际发出 **${ioCalls.length} 次**请求，逐字内容见下方「实际发出的请求与输出」。`)
      } else {
        lines.push('> 本次未拿到真实请求面（该链路的请求未回传渲染层）。')
      }
      lines.push('')
      lines.push('#### system', '')
      if (typeof snapshot.systemMessage === 'string' && snapshot.systemMessage.trim()) {
        pushCodeBlock(lines, snapshot.systemMessage)
      } else {
        lines.push('（本条记录生成时尚未采集 system message，可在「片段来源」中查看 systemRole 片段。）', '')
      }
      lines.push('#### user', '')
      pushCodeBlock(lines, snapshot.built)
    }

    // ② 片段来源：回答"这块从哪来、能不能改"
    lines.push('### 片段来源（可改性归因）', '')
    lines.push('| 序号 | 来源 | 名称 | 可改 | 生效来源 | 变量 |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const fragment of snapshot.fragments) {
      const variables = fragment.variables.map(variable => `{{${variable.key}}}`).join(' ') || '—'
      lines.push(`| ${fragment.order} | ${fragment.sourceKind} | ${fragment.label} | ${fragment.editable ? '可改' : '锁定'} | ${fragment.resolvedFrom ?? '—'} | ${variables} |`)
    }
    lines.push('')
    lines.push('> 以下为各片段的**原始模板**（变量尚未替换），仅用于定位来源与可改性。', '')
    for (const fragment of snapshot.fragments) {
      lines.push(`#### 第 ${fragment.order} 块 · ${fragment.label}`, '')
      lines.push(`- 来源：\`${fragment.sourceKind}\`${fragment.resolvedFrom ? ` · 生效于 \`${fragment.resolvedFrom}\`` : ''}`)
      if (fragment.note) lines.push(`- 说明：${fragment.note}`)
      lines.push('')
      pushCodeBlock(lines, fragment.rawText)
    }
  }

  // ③ 实际请求与输出：一轮内的每一次调用都要保留
  lines.push('---', '')
  if (ioCalls.length === 0) {
    lines.push('## 实际发出的请求与输出', '')
    lines.push('- 本次未捕获到真实请求面（该链路的请求未回传渲染层）。', '')
    lines.push('- 正文成品可在项目内查看；此处缺失不影响上方提示词的评估。', '')
    return lines.join('\n')
  }

  lines.push(`## 实际发出的请求与输出（${ioCalls.length} 次调用）`, '')
  if (associated) {
    lines.push('> 本次仅一次调用，其请求已在上方「拼装后的完整提示词」中逐字呈现。', '')
  } else {
    lines.push('> 以下为**实际发出**的请求，与模型收到的逐字一致（含运行时注入的写作 Skill 等）。', '')
    lines.push('> 一轮生成可能发多次请求（如正文的短纲 → 正文 → 续写），此处按发生顺序全部保留。', '')
  }

  for (const [index, call] of ioCalls.entries()) {
    lines.push(callHeading(index, call), '')
    if (!associated) {
      for (const message of call.messages) {
        lines.push(`#### ${message.role}`, '')
        pushCodeBlock(lines, message.content)
      }
    }
    lines.push('#### 模型输出', '')
    pushCodeBlock(lines, call.output)
  }

  return lines.join('\n')
}
