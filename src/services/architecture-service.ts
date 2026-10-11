/**
 * architecture-service — 架构文件状态检查服务
 *
 * 全量 DB 化后，这里直接查 project_core 和 blueprints 表，不再读取文件。
 * 使用场景：Sidebar、WorldBuildingEditor
 */

import type { ProjectSessionContext } from '../shared/ipc-channels'
import { ipc } from './ipc-client'

export type ArchStepKey = 'premise' | 'characters' | 'worldbuilding' | 'plotStructure' | 'synopsis'

export const ARCH_FILES: Array<{
  key: ArchStepKey
  label: string
  emoji: string
  desc: string
}> = [
    { key: 'premise', label: '故事前提', emoji: '🎯', desc: 'Logline · 核心冲突链 · 金手指定位 · 悬念骨架' },
    { key: 'characters', label: '角色图谱', emoji: '👥', desc: '角色弧光 · 关系网络 · 矛盾交织' },
    { key: 'worldbuilding', label: '世界观', emoji: '🌍', desc: '核心规则 · 阶层断层 · 深层危机' },
    { key: 'plotStructure', label: '弧光结构', emoji: '🧭', desc: '弧光分层 · 因果/时序推进 · 篇幅约束' },
    { key: 'synopsis', label: '情节大纲', emoji: '🗺️', desc: '三幕结构 · 拐点节奏 · 伏笔闭环' },
  ]

/**
 * 单条架构内容的「已生成」判据。**所有入口必须共用它。**
 *
 * ★ 2026-10-11 实测教训：同一状态在三个入口（本服务 / WorldBuildingEditor /
 *   ArchFileViewer）各自实现了一遍，于是 ArchFileViewer 那份漏掉了 `plotStructure`，
 *   导致弧光结构已生成 5708 字、对话框仍显示「待生成」。状态判据一旦复制，
 *   必然出现「同一数据、不同结论」。新增步骤时只允许改这里。
 */
export function hasArchContent(content: string | null | undefined): boolean {
  return (content?.length ?? 0) > 50 && !content!.includes('待生成')
}

/**
 * 检查所有架构块的生成状态
 * @returns key → boolean 映射，true 表示该块已有有效内容
 */
export async function checkArchStatus(
  projectSession: ProjectSessionContext,
): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {
    premise: false,
    characters: false,
    worldbuilding: false,
    plotStructure: false,
    synopsis: false,
  }

  const [core, roster] = await Promise.all([
    ipc.invokeWithProjectSession(
      projectSession,
      'db:project-core-get',
      projectSession.projectPath,
    ),
    ipc.invokeWithProjectSession(
      projectSession,
      'db:character-roster-read',
      projectSession.projectPath,
    ),
  ])
  if (!core) return status

  // 长度 > 50 才算真正已生成，前端可以直接用长度判断（判据见 hasArchContent）
  status.premise = hasArchContent(core.premise)
  // ★ 角色图谱不能只看名册投影是否 ready：其它四步的判据都是「DB 里有内容」，
  //   而名册 ready 是更严的条件（需要投影完成/审批落地）。实测：生成完角色图谱后，
  //   非角色界面拿到的是未就绪的本地快照 → 误判「待生成」，与角色界面自相矛盾。
  //   故补上「DB 正文存在」这一条，与其它步骤语义对齐。
  status.characters = roster.status === 'ready' || hasArchContent(core.charactersArch)
  status.worldbuilding = hasArchContent(core.worldbuilding)
  status.plotStructure = hasArchContent(core.plotStructurePlan)
  status.synopsis = hasArchContent(core.synopsis)

  return status
}

/**
 * 检查架构状态（包含字数统计）
 */
export async function checkArchStatusWithWordCount(projectSession: ProjectSessionContext): Promise<{
  status: Record<string, boolean>
  wordCounts: Record<string, number>
}> {
  const status: Record<string, boolean> = { premise: false, characters: false, worldbuilding: false, plotStructure: false, synopsis: false }
  const wordCounts: Record<string, number> = { premise: 0, characters: 0, worldbuilding: 0, plotStructure: 0, synopsis: 0 }

  const [core, roster] = await Promise.all([
    ipc.invokeWithProjectSession(
      projectSession,
      'db:project-core-get',
      projectSession.projectPath,
    ),
    ipc.invokeWithProjectSession(
      projectSession,
      'db:character-roster-read',
      projectSession.projectPath,
    ),
  ])
  if (!core) return { status, wordCounts }

  const check = (key: ArchStepKey, content: string | undefined | null) => {
    const hasContent = hasArchContent(content)
    status[key] = hasContent
    wordCounts[key] = hasContent ? (content?.length ?? 0) : 0
  }

  check('premise', core.premise)
  // 角色图谱：即使名册投影尚未 ready，只要 DB 里有正文就算已生成（与其它步骤同语义）。
  check('characters', roster.status === 'ready' ? roster.renderedMarkdown : core.charactersArch)
  check('worldbuilding', core.worldbuilding)
  check('plotStructure', core.plotStructurePlan)
  check('synopsis', core.synopsis)

  return { status, wordCounts }
}

/**
 * 获取蓝图数量
 */
export async function getBlueprintCount(projectSession: ProjectSessionContext): Promise<number> {
  try {
    const blueprints = await ipc.invokeWithProjectSession(
      projectSession,
      'db:blueprint-get-all',
      projectSession.projectPath,
    )
    return blueprints.length
  } catch {
    return 0
  }
}

/**
 * 获取具体架构块的内容
 */
export async function readArchFile(
  key: ArchStepKey,
  projectSession: ProjectSessionContext,
): Promise<{ success: boolean; content: string }> {
  try {
    if (key === 'characters') {
      const roster = await ipc.invokeWithProjectSession(
        projectSession,
        'db:character-roster-read',
        projectSession.projectPath,
      )
      return {
        success: true,
        content: roster.status === 'ready'
          ? roster.renderedMarkdown
          : roster.legacyMarkdown ?? '',
      }
    }
    const core = await ipc.invokeWithProjectSession(
      projectSession,
      'db:project-core-get',
      projectSession.projectPath,
    )
    if (!core) return { success: false, content: '' }

    let content = ''
    switch (key) {
      case 'premise': content = core.premise; break
      case 'worldbuilding': content = core.worldbuilding; break
      case 'plotStructure': content = core.plotStructurePlan; break
      case 'synopsis': content = core.synopsis; break
    }
    return { success: true, content: content ?? '' }
  } catch {
    return { success: false, content: '' }
  }
}
