import { useLocaleStore } from '../../stores/locale-store'
import { KnowledgeRegistryPanel } from './KnowledgeRegistryPanel'

/**
 * P1-1 知情登记页（独立 tab）。
 *
 * 与关键物品、制度同一类入口：都是「世界观的产物清单」，都塞不进世界观卡片
 * （W6a-5 的实机教训：十列以上的表格嵌在卡片里会被截断）。
 *
 * 三句话讲清这一页的边界：只记「谁知道」、不记「谁不知道」；只引用定稿事实、不另写说法；
 * 未来的「得知章」不会写进当前章。
 */
export function KnowledgeRegistryEditor({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('知情（谁知道什么）', 'Knowledge state')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '登记「某个角色从哪一章起知道哪条定稿事实」。写前查阅会提醒已登记的事实；没登记的事实一概不判——它不是「谁都不知道」的断言。',
            'Register which finalized fact a character knows, and from which chapter. The pre-writing reference only reminds you of registered facts; unregistered facts are not judged at all.',
          )}
        </p>
      </div>
      <KnowledgeRegistryPanel projectKey={projectKey} />
    </div>
  )
}

export default KnowledgeRegistryEditor
