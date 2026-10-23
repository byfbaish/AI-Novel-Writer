import { useLocaleStore } from '../../stores/locale-store'
import { KeyItemRegistryPanel } from './KeyItemRegistryPanel'

/**
 * P1-1 关键物品登记页（独立 tab）。
 *
 * 为什么独立成 tab 而不是塞进世界观卡片：W6a-5 的实机教训 —— 十列以上的表格嵌在
 * 世界观卡片里会被截断，作者要先横向滚两次才能看到「出处」列。物品表虽然列少，
 * 但它和资源登记是同一类入口（世界观的产物清单），放一起比塞回去更难找。
 */
export function KeyItemRegistryEditor({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('关键物品', 'Key items')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '登记「谁拿着什么」。这里不记余额、不做算术 —— 那是资源登记的事。登记后，生成下一章时它们会带着出处一起进写前查阅。',
            'Register who holds what. No balances and no arithmetic here \u2014 that belongs to the resource registry. Once registered, they enter the pre-writing reference with their sources.',
          )}
        </p>
      </div>
      <KeyItemRegistryPanel projectKey={projectKey} />
    </div>
  )
}

export default KeyItemRegistryEditor
