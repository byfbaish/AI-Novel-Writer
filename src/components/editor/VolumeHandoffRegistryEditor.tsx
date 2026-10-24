import { useLocaleStore } from '../../stores/locale-store'
import { VolumeHandoffRegistryPanel } from './VolumeHandoffRegistryPanel'

/**
 * P1-2 期 1 卷末交接单页（独立 tab）。
 *
 * 与关键物品、制度、知情、能力登记同一类入口：都是「世界观的产物清单」，塞不进世界观卡片
 * （W6a-5 的实机教训：十列以上的表格嵌在卡片里会被截断）。
 */
export function VolumeHandoffRegistryEditor({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('卷末交接（跨卷记忆）', 'Volume handoffs (cross-volume memory)')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '一卷写完后，把「下一卷必须承接的几件事」填在这里。每一章的每一次生成都会带上上一卷的这一份，直到下一份取代它。',
            'When a volume ends, record what the next volume must carry forward. Every chapter generation includes the previous volume\'s handoff until the next one replaces it.',
          )}
        </p>
      </div>
      <VolumeHandoffRegistryPanel projectKey={projectKey} />
    </div>
  )
}

export default VolumeHandoffRegistryEditor
