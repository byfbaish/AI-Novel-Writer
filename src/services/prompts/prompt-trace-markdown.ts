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

export interface PromptTraceMarkdownPayload {
  runHandle?: string
  operation?: string
  chapterNumber?: number
  writtenAt: number
  snapshots: ReadonlyArray<PromptTraceMarkdownSnapshot>
  io?: {
    messages: ReadonlyArray<{ role: string; content: string }>
    output: string
    finishReason?: string
  }
}

/** 追加一个 ```text 代码块（反引号转义，避免截断 markdown）。 */
function pushCodeBlock(lines: string[], text: string): void {
  lines.push('```text')
  lines.push(text.replace(/\r\n/g, '\n').replace(/```/g, "'''"))
  lines.push('```', '')
}

/**
 * 人读快照。
 *
 * 首屏必须是**拼装后的完整提示词**（评估提示词质量看这里），而不是模板。
 * 模板片段（变量未替换）排在后面，只用于回答"这一块从哪来、能不能改"。
 *
 * 请求面的两个来源，按可信度择一：
 * - `io.messages`：实际发出的请求，**与模型收到的完全一致**（含运行时注入的写作 Skill）。
 * - 快照重建：`systemMessage` + `built` 拼出请求骨架；运行时注入的内容不在此列，故显式标注来源。
 */
export function buildTraceMarkdown(payload: PromptTraceMarkdownPayload): string {
  const lines: string[] = []
  lines.push('# Prompt 追踪快照', '')
  lines.push(`- 生成任务：\`${payload.operation ?? '未知'}\``)
  lines.push(`- 关联句柄：\`${payload.runHandle ?? '（无，未进入命令作用域）'}\``)
  if (payload.chapterNumber !== undefined) lines.push(`- 章节：第 ${payload.chapterNumber} 章`)
  lines.push(`- 记录时刻：${new Date(payload.writtenAt).toLocaleString('zh-CN')}`)
  lines.push(`- 片段批次：${payload.snapshots.length}`)
  lines.push(`- 请求面来源：${payload.io ? '实际发出（与模型收到的一致）' : '按装配结果重建'}`, '')

  const ioMessages = payload.io?.messages ?? []

  for (const [index, snapshot] of payload.snapshots.entries()) {
    lines.push('---', '')
    lines.push(`## ${index + 1}. \`${snapshot.promptKey}\``, '')
    lines.push(`组装后长度：${snapshot.builtLength} 字 · 共 ${snapshot.fragments.length} 块`, '')

    // ① 首屏：拼装后的完整提示词
    lines.push('### 拼装后的完整提示词（发送给模型前）', '')
    if (ioMessages.length > 0) {
      lines.push('> 来源：**实际发出的请求**，与模型收到的逐字一致。', '')
      for (const message of ioMessages) {
        lines.push(`#### ${message.role}`, '')
        pushCodeBlock(lines, message.content)
      }
    } else {
      lines.push('> 来源：**按装配结果重建**。本次未拿到实际请求面（该链路在主进程执行，')
      lines.push('> 请求/输出未回传渲染层），故由「system 角色」+「组装后正文」拼出骨架；')
      lines.push('> 运行时注入的「补充写作 Skill」等不在其中。', '')
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

  lines.push('---', '')
  lines.push('## 模型输出', '')
  if (payload.io) {
    lines.push(`- finishReason：\`${payload.io.finishReason ?? 'unknown'}\``, '')
    pushCodeBlock(lines, payload.io.output)
  } else {
    lines.push('- 本次未捕获到模型输出（该链路的请求面未回传渲染层）。', '')
    lines.push('- 正文成品可在项目内查看；此处缺失不影响上方提示词的评估。', '')
  }

  return lines.join('\n')
}
