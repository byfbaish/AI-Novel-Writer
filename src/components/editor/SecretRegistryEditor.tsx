import { useLocaleStore } from '../../stores/locale-store'
import { SecretRegistryPanel } from './SecretRegistryPanel'

/**
 * P20-2 秘密宿体登记页（独立 tab）。
 *
 * 与知情、能力、关键物品、制度同一类入口：都是「世界观的产物清单」，
 * 塞不进世界观卡片（W6a-5 的实机教训：十列以上的表格嵌在卡片里会被截断）。
 *
 * ## 这一页刻意不接世界观、不产候选
 *
 * 第 3 维【隐喻与深层危机】是**纯散文**（模板只给两个自由问句 + 两条禁令），
 * 没有任何机读表面 ⇒ 没有可抽的源。所以这里不给「从世界观抽取」按钮：
 * 给了就得先改模板加机读行（撞判据 AO），那是另一期的事。
 *
 * ## 三句话讲清边界
 *
 * 只记「谁在捂、谁还不知道、第几章穿」；真相只给审稿判泄密用，**绝不进正文提示词**；
 * 揭穿章留空是合法状态（按「任何章都还没揭穿」保守处理）。
 */
export function SecretRegistryEditor({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('秘密（谁在捂什么）', 'Secrets (who hides what)')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '登记「谁在隐瞒什么、谁还不知道、计划第几章揭穿」。审稿会拿它检查正文有没有提前写出真相；真相本身不会进正文提示词，以免模型把谜底写出来。',
            'Register who hides what, who does not know yet, and the planned reveal chapter. Review uses it to check whether the draft reveals the truth too early; the truth itself never reaches the draft prompt.',
          )}
        </p>
      </div>
      <SecretRegistryPanel projectKey={projectKey} />
    </div>
  )
}

export default SecretRegistryEditor
