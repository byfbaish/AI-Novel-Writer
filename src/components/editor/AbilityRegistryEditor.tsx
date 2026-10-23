import { useLocaleStore } from '../../stores/locale-store'
import { AbilityRegistryPanel } from './AbilityRegistryPanel'

/**
 * P1-1 能力登记页（独立 tab）。
 *
 * 与关键物品、制度、知情登记同一类入口：都是「世界观的产物清单」，塞不进世界观卡片
 * （W6a-5 的实机教训：十列以上的表格嵌在卡片里会被截断）。
 */
export function AbilityRegistryEditor({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('能力（本书的能力规则）', 'Abilities (book-level rules)')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '登记金手指、体系漏洞、宝物权限这类「属于这本书」的规则：能做什么、要付什么、什么情况下会被破。角色技能留在角色卡里，这里不重复登记。',
            'Register book-level rules such as the golden finger, system loopholes, and artifact permissions: what it does, what it costs, how it breaks. Character skills stay on character cards.',
          )}
        </p>
      </div>
      <AbilityRegistryPanel projectKey={projectKey} />
    </div>
  )
}

export default AbilityRegistryEditor
