/**
 * read_blueprint — 读取章节蓝图
 */
import { buildAgentTool } from '../tool-registry'
import { keyEventsText } from '../../../shared/blueprint-key-events'
import { ipc } from '../../ipc-client'
import { agentToolText, assertAgentProjectCurrent, requireAgentProject } from './project-context'
import { describeDrift, type DerivedValidity } from '../../../shared/upstream-revisions'


export const readBlueprintTool = buildAgentTool({
  name: 'read_blueprint',
  description: '读取指定章节的蓝图（剧情大纲、场景分配、角色出场计划等）。蓝图是写稿前的详细规划。',
  descriptionEn: 'Read a chapter blueprint, including its plot, scene allocation, and planned character appearances.',
  source: 'builtin',
  inputSchema: {
    type: 'object',
    properties: {
      chapter_number: {
        type: 'number',
        description: '章节号（可选）。不填则列出所有蓝图文件。',
        descriptionEn: 'Optional chapter number. Omit it to list all chapter blueprints.',
      },
    },
  },
  requiresConfirmation: false,
  execute: async (args, context) => {
    const { project, projectSession } = requireAgentProject(context)
    const text = (zhCN: string, enUS: string) => agentToolText(context, zhCN, enUS)

    const chapterNum = args.chapter_number as number | undefined

    if (chapterNum !== undefined) {
      // 读取指定章节蓝图
      const bp = await ipc.invokeWithProjectSession(projectSession, 'db:blueprint-get', chapterNum, project.path)
      assertAgentProjectCurrent(context)
      if (!bp) {
        return { success: false, content: '', error: text(`第 ${chapterNum} 章蓝图不存在或读取失败`, `The blueprint for Chapter ${chapterNum} does not exist or could not be read`) }
      }
      // 过期要说出来（P2-2 期 2）。只在 handler 挂字段、工具不读字段，等于没拦：
      // agent 会拿一份和当前大纲不一致的卡去规划后续章节。
      const staleNotice = bp.validity?.state === 'stale'
        ? text(
            `\n\n⚠️ 这张章节卡基于的${describeDrift(bp.validity.behind)}已经改过了，内容可能与当前大纲不一致；引用它之前先请作者核对。`,
            `\n\n⚠️ This card is stale: ${describeDrift(bp.validity.behind)} changed after it was written. Confirm with the author before relying on it.`,
          )
        : ''
      return { success: true, content: text(
        `📋 第 ${chapterNum} 章蓝图\n\n标题: ${bp.title}\n作用: ${bp.role}\n目的: ${bp.purpose}\n关键事件: ${keyEventsText(bp.keyEvents)}\n角色: ${bp.characters.join(', ')}\n悬念: ${bp.suspenseHook}\n备注: ${bp.notes}\n用户指引: ${bp.userGuidance}`,
        `📋 Chapter ${chapterNum} blueprint\n\nTitle: ${bp.title}\nRole: ${bp.role}\nPurpose: ${bp.purpose}\nKey events: ${keyEventsText(bp.keyEvents)}\nCharacters: ${bp.characters.join(', ')}\nSuspense hook: ${bp.suspenseHook}\nNotes: ${bp.notes}\nUser guidance: ${bp.userGuidance}`,
      ) + staleNotice }
    }

    // 列出所有蓝图文件
    try {
      const bps = await ipc.invokeWithProjectSession(projectSession, 'db:blueprint-get-all', project.path)
      assertAgentProjectCurrent(context)
      if (!bps || bps.length === 0) {
        return { success: true, content: text('⚠️ 蓝图为空。建议先通过工作流生成章节蓝图。', '⚠️ There are no blueprints yet. Generate chapter blueprints with the workflow first.') }
      }

      const list = bps.map((b: unknown) => {
        const entry = b as { chapterNumber?: number; title?: string; validity?: DerivedValidity }
        const mark = entry.validity?.state === 'stale' ? text('（已过期）', ' (stale)') : ''
        return text(
          `  - 第 ${entry.chapterNumber} 章: ${entry.title || '无标题'}${mark}`,
          `  - Chapter ${entry.chapterNumber}: ${entry.title || 'Untitled'}${mark}`,
        )
      }).join('\n')
      return { success: true, content: text(`📋 蓝图列表（${bps.length} 个）\n${list}\n\n使用 chapter_number 参数可以读取具体章节蓝图的内容。`, `📋 Blueprint list (${bps.length})\n${list}\n\nUse chapter_number to read a specific chapter blueprint.`) }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        content: '',
        error: context?.writingLanguage === 'en-US' && /[\u3400-\u9fff]/u.test(detail)
          ? text('读取蓝图失败', 'Could not read blueprints')
          : text(`读取蓝图失败：${detail}`, `Could not read blueprints: ${detail}`),
      }
    }
  },
})
