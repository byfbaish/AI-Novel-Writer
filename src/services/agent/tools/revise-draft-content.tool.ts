/**
 * revise_draft_content — 按指令修改某一章的正文草稿
 *
 * 只做「落盘」这一件事：改什么由模型决定，能不能改、改得安不安全由本工具保证。
 *
 * 两种模式（必须二选一）：
 * - edits：批量精准替换（推荐）。**原子性**——任一 find 未命中或不唯一则整批不生效。
 * - content：整章覆盖。仅当确实需要重写全章时使用。
 *
 * 边界：
 * - 只写草稿正文（与编辑器保存走同一条 `db:draft-update-content`）；不碰磁盘文件，
 *   也不碰任何结构化项目事实（配置 / 蓝图 / 架构有各自的工作流与工具）。
 * - 已定稿（finalized）或已归档（archived）的草稿一律拒改。
 * - 该章正文正在编辑器中且有未保存修改时拒改，避免覆盖作者手头的内容。
 */
import { buildAgentTool, createToolArtifact } from '../tool-registry'
import { ipc } from '../../ipc-client'
import {
  agentToolText,
  assertAgentProjectCurrent,
  assertAgentToolActive,
  requireAgentProject,
} from './project-context'
import { countDraftUnits } from '../../../shared/draft-units'
import { formatResourceUri } from '../../../shared/project-paths'
import { useEditorStore } from '../../../stores/editor-store'
import { useDraftStore } from '../../../stores/draft-store'

/** 单次调用的替换条数上限，防止模型一口气塞进整章级别的补丁 */
export const MAX_DRAFT_EDITS = 300

export interface DraftEdit {
  find: string
  replace: string
}

/** IPC 返回的错误可能带中文；英文环境下降级为通用文案，避免语言串台。 */
function localizedIpcError(
  context: Parameters<typeof agentToolText>[0],
  detail: string | undefined,
  fallbackZh: string,
  fallbackEn: string,
): string {
  const isEnglish = context?.writingLanguage === 'en-US'
  if (!detail || (isEnglish && /[\u3400-\u9fff]/u.test(detail))) {
    return agentToolText(context, fallbackZh, fallbackEn)
  }
  return detail
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

/**
 * 把一批替换应用到正文上。
 *
 * 原子性：只要有任何一条 find 未命中或不唯一，就返回**原始正文**加问题清单——
 * 调用方据此原样返回失败，正文保持不变，绝不暴露"改了一半"的结果。
 *
 * 替换按顺序生效：后一条的 find 必须在**前一条替换之后**的文本里唯一，
 * 因此多条替换的 find 区间不要互相重叠。
 */
export function applyDraftEdits(
  source: string,
  edits: readonly DraftEdit[],
): { content: string; problems: string[] } {
  let content = source
  const problems: string[] = []
  for (const [index, edit] of edits.entries()) {
    const occurrences = countOccurrences(content, edit.find)
    if (occurrences === 0) {
      problems.push(`第 ${index + 1} 条：find 片段未在正文中出现（必须与正文逐字一致，含标点与换行）`)
      continue
    }
    if (occurrences > 1) {
      problems.push(`第 ${index + 1} 条：find 片段在正文中出现 ${occurrences} 次，不唯一（请带上前后文使其唯一）`)
      continue
    }
    // 用函数形式替换：避免 replace 内容里的 $& / $1 被当成替换模式。
    content = content.replace(edit.find, () => edit.replace)
  }
  if (problems.length > 0) return { content: source, problems }
  return { content, problems }
}

/** 校验并归一化模型给出的 edits 参数 */
export function normalizeDraftEdits(raw: unknown): { edits: DraftEdit[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'edits 必须是非空数组' }
  if (raw.length > MAX_DRAFT_EDITS) return { error: `edits 条数超过上限 ${MAX_DRAFT_EDITS}` }
  const edits: DraftEdit[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: '每个 edit 必须是 {"find":"...","replace":"..."} 形式的对象' }
    }
    const { find, replace } = item as Record<string, unknown>
    if (typeof find !== 'string' || find.length === 0) return { error: '每个 edit 的 find 必须是非空字符串' }
    if (typeof replace !== 'string') return { error: '每个 edit 的 replace 必须是字符串' }
    edits.push({ find, replace })
  }
  return { edits }
}

export const reviseDraftContentTool = buildAgentTool({
  name: 'revise_draft_content',
  userFacingName: '修改本章正文',
  description: '修改某一章的正文草稿。优先用 edits 做批量精准替换：每条形如 {"find":"正文中的原片段","replace":"替换为"}，find 必须与正文逐字一致且在正文中只出现一次，否则整批不生效。只有当确实需要重写全章时才用 content 传入完整新正文。本工具不做语义判断，只管精确落盘；已定稿的正文不可修改。这是写入操作，需要用户确认。',
  descriptionEn: 'Revise a chapter draft. Prefer batch exact replacements via edits: each item is {"find":"exact text in the draft","replace":"replacement"}; every find must match exactly once or the whole batch is rejected. Use content only when the entire chapter must be rewritten. This tool performs no semantic reasoning; it only applies exact edits. Finalized drafts are read-only. This is a write operation and requires user confirmation.',
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      chapter_number: {
        type: 'number',
        description: '章节号（正整数，必填）',
        descriptionEn: 'Chapter number (positive integer, required)',
      },
      edits: {
        type: 'array',
        description: '批量精准替换列表。每项为 {"find":"正文中的原片段","replace":"替换为"}；find 必须与正文逐字一致（含标点、空格与换行），且在正文中恰好出现一次。任一条不满足则整批不生效、正文不变。',
        descriptionEn: 'Batch of exact replacements. Each item is {"find":"existing text","replace":"new text"}. Each find must match the draft exactly once. If any item fails, nothing is applied.',
      },
      content: {
        type: 'string',
        description: '（备用）整章覆盖用的完整新正文。仅在确实需要重写全章时使用，不要与 edits 同时提供。',
        descriptionEn: '(Fallback) Complete replacement text for the whole chapter. Use only when the entire chapter must be rewritten; do not combine with edits.',
      },
    },
    required: ['chapter_number'],
  },
  requiresConfirmation: true,
  isReadOnly: false,
  execute: async (args, context) => {
    const text = (zhCN: string, enUS: string) => agentToolText(context, zhCN, enUS)

    const chapterNumber = args.chapter_number
    if (!Number.isSafeInteger(chapterNumber) || Number(chapterNumber) < 1) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text('chapter_number 必须是正整数', 'chapter_number must be a positive integer'),
      }
    }

    const hasEdits = args.edits !== undefined
    const hasContent = args.content !== undefined
    if (hasEdits === hasContent) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text('必须且只能提供 edits 或 content 其中一个', 'Provide exactly one of edits or content'),
      }
    }

    const { project, projectSession } = requireAgentProject(context)
    const projectPath = project.path

    // 1. 定位该章最新草稿
    const listed = await ipc.invokeWithProjectSession(
      projectSession,
      'db:draft-list',
      Number(chapterNumber),
      projectPath,
    ) as unknown as Array<Record<string, unknown>> | null
    assertAgentProjectCurrent(context)
    const drafts = Array.isArray(listed) ? [...listed] : []
    if (drafts.length === 0) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text(`第 ${chapterNumber} 章暂无草稿，无法修改。`, `Chapter ${chapterNumber} has no draft to revise.`),
      }
    }
    // 不依赖后端顺序，按版本号倒序取最新
    drafts.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))
    const latest = drafts[0]
    const draftId = Number(latest.id)
    if (!Number.isSafeInteger(draftId)) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text('无法确定该章草稿身份', 'Could not determine the chapter draft identity'),
      }
    }
    const draftStatus = String(latest.status ?? '')
    if (draftStatus === 'finalized') {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text(
          `第 ${chapterNumber} 章正文已定稿，定稿正文不可修改。如需调整，请先处理定稿状态。`,
          `Chapter ${chapterNumber} is finalized and cannot be modified. Resolve the finalization state first.`,
        ),
      }
    }
    if (draftStatus === 'archived') {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text(
          `第 ${chapterNumber} 章正文已归档，不可修改。`,
          `Chapter ${chapterNumber}'s draft is archived and cannot be modified.`,
        ),
      }
    }

    // 2. 编辑器里开着同一份草稿且有未保存修改 → 拒改，避免覆盖作者手头的输入
    const openTab = useEditorStore.getState().tabs.find(
      tab => tab.projectKey === projectPath && tab.draftId === draftId,
    )
    if (openTab?.dirty) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text(
          `第 ${chapterNumber} 章正在编辑器中且有未保存的修改。请先保存（或撤销）该章，再让我修改。`,
          `Chapter ${chapterNumber} is open in the editor with unsaved changes. Save or revert it first.`,
        ),
      }
    }

    // 3. 读当前正文
    const full = await ipc.invokeWithProjectSession(
      projectSession,
      'db:draft-get-full',
      draftId,
      projectPath,
    ) as { content?: string } | null
    assertAgentProjectCurrent(context)
    const source = typeof full?.content === 'string' ? full.content : null
    if (source === null) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text(`读取第 ${chapterNumber} 章正文失败`, `Could not read the draft of chapter ${chapterNumber}`),
      }
    }
    if (!source.trim()) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: text(`第 ${chapterNumber} 章正文为空，无法修改`, `Chapter ${chapterNumber}'s draft is empty`),
      }
    }

    // 4. 计算新正文
    let nextContent: string
    let summary: string
    if (hasEdits) {
      const normalized = normalizeDraftEdits(args.edits)
      if ('error' in normalized) {
        return {
          success: false,
          commitState: 'not_committed',
          content: '',
          error: text(`edits 参数不合法：${normalized.error}`, `Invalid edits argument: ${normalized.error}`),
        }
      }
      const applied = applyDraftEdits(source, normalized.edits)
      if (applied.problems.length > 0) {
        // 原子性：一条不成立就整体不改，把问题原样交回给模型修正
        return {
          success: false,
          commitState: 'not_committed',
          content: '',
          error: text(
            `以下替换无法应用，正文未做任何改动：\n${applied.problems.join('\n')}`,
            `These replacements could not be applied; the draft was left unchanged:\n${applied.problems.join('\n')}`,
          ),
        }
      }
      nextContent = applied.content
      summary = text(`已应用 ${normalized.edits.length} 处替换`, `Applied ${normalized.edits.length} replacement(s)`)
    } else {
      if (typeof args.content !== 'string' || !args.content.trim()) {
        return {
          success: false,
          commitState: 'not_committed',
          content: '',
          error: text('content 必须是非空字符串', 'content must be a non-empty string'),
        }
      }
      nextContent = args.content
      summary = text('已整章覆盖', 'Replaced the whole chapter')
    }

    if (nextContent === source) {
      return {
        success: true,
        commitState: 'committed',
        content: text(
          `第 ${chapterNumber} 章正文与目标一致，无需改动。`,
          `Chapter ${chapterNumber} already matches the requested content; nothing changed.`,
        ),
      }
    }

    // 5. 落盘（与编辑器保存同一条通道）
    assertAgentToolActive(context)
    context?.markSideEffectStarted?.()
    const written = await ipc.invokeWithProjectSession(
      projectSession,
      'db:draft-update-content',
      draftId,
      nextContent,
      countDraftUnits(nextContent),
      projectPath,
    ) as { success?: boolean; error?: string } | null
    if (!written?.success) {
      return {
        success: false,
        commitState: 'not_committed',
        content: '',
        error: localizedIpcError(context, written?.error, '正文修改失败', 'Could not update the draft'),
      }
    }

    // 6. 同步已打开的编辑器 Tab（若期间内容又变了，保持 dirty 而不覆盖作者输入）
    const stillOpen = useEditorStore.getState().tabs.find(
      tab => tab.projectKey === projectPath && tab.draftId === draftId,
    )
    if (stillOpen) {
      useEditorStore.getState().settleMergedRevision(stillOpen.id, {
        content: stillOpen.content ?? source,
        contentRevision: stillOpen.contentRevision ?? 0,
      }, nextContent)
    }

    // 7. 刷新草稿列表缓存
    await useDraftStore.getState().loadChapterDrafts(Number(chapterNumber), projectPath, projectSession)

    return {
      success: true,
      commitState: 'committed',
      content: text(
        `✅ 第 ${chapterNumber} 章正文已更新（${summary}，现 ${countDraftUnits(nextContent)} 字）。`,
        `✅ Chapter ${chapterNumber} draft updated (${summary}; ${countDraftUnits(nextContent)} units).`,
      ),
      artifacts: [createToolArtifact({
        type: 'file_modified',
        path: formatResourceUri({ kind: 'draft', id: draftId }),
        name: text(`第${chapterNumber}章正文`, `Chapter ${chapterNumber} draft`),
        projectPath,
        projectSession,
      })],
    }
  },
})
