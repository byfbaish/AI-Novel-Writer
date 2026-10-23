import { useLocaleStore } from '../../stores/locale-store'
import { CadenceRegistryPanel } from './CadenceRegistryPanel'

/**
 * P1-1 制度登记页（独立 tab）。
 *
 * 与关键物品、资源登记同一类入口：都是「世界观的产物清单」，都塞不进世界观卡片
 * （W6a-5 的实机教训：十列以上的表格嵌在卡片里会被截断）。
 */
export function CadenceRegistryEditor({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('制度（周期事件）', 'Institutional cadences')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '登记「每隔多久该发生一次」的周期事件：月例、送账日、巡夜。这里只判「这一章该不该发生」，不记「该发多少」——数量与余额是资源登记的事。',
            'Register recurring events: monthly rites, delivery days, night patrols. This only decides whether one is due in a chapter, never how much is owed \u2014 quantities belong to the resource registry.',
          )}
        </p>
      </div>
      <CadenceRegistryPanel projectKey={projectKey} />
    </div>
  )
}

export default CadenceRegistryEditor
