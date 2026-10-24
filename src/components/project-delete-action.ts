import { useLocaleStore } from '../stores/locale-store'
import { useProjectStore } from '../stores/project-store'
import { confirm } from './ui/Confirm'
import { toast } from './ui/Toast'

/** Shared confirmation for the sidebar and V3 home; the store enforces current-project authority. */
export async function confirmDeleteCurrentProject(project: { name: string; path: string }) {
  const text = useLocaleStore.getState().text
  const ok = await confirm(
    text(`确认删除项目「${project.name}」？\n此操作会删除该项目目录下的小说正文、故事架构、角色、蓝图、知识库和所有项目数据。`, `Delete project “${project.name}”?\nThis removes its manuscripts, architecture, characters, blueprints, knowledge base, and all project data.`),
    {
      title: text('删除项目', 'Delete project'),
      confirmText: text('删除项目', 'Delete project'),
      danger: true,
    },
  )
  if (!ok) return

  if (await useProjectStore.getState().deleteProject(project.path)) {
    toast.success(text(`项目「${project.name}」已删除`, `Project “${project.name}” deleted`))
  }
}

/**
 * 书架条目的移除。删除项目目录必须由主进程会话闸门授权，而闸门只认当前已打开的项目，
 * 因此书架上的其它条目拿不到删除授权。这里只做「从书架移除」——不动磁盘，
 * 也不会因为目录打不开而把条目永久卡在书架上。
 */
export async function confirmRemoveShelfProject(project: { name: string; path: string }, options: { missing: boolean }) {
  const text = useLocaleStore.getState().text
  const title = text('从书架移除', 'Remove from shelf')
  const ok = await confirm(
    options.missing
      ? text(
          `项目「${project.name}」的目录已不可读取，可能已被移动或删除。\n将从书架移除这条记录，不会改动磁盘上的任何文件。`,
          `The folder for “${project.name}” can no longer be read; it may have been moved or deleted.\nThis removes the shelf entry only and leaves every file on disk untouched.`,
        )
      : text(
          `仅将「${project.name}」从书架移除。\n项目文件仍原样保留在磁盘上，之后可以用“打开作品”重新加回书架。`,
          `Remove “${project.name}” from the shelf only.\nIts files stay on disk, and you can add it back later with Open project.`,
        ),
    { title, confirmText: title, danger: false },
  )
  if (!ok) return

  if (await useProjectStore.getState().removeRecentProject(project.path)) {
    toast.success(text(`已从书架移除「${project.name}」`, `Removed “${project.name}” from the shelf`))
  }
}
