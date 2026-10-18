import type { WritingLanguage } from '../../shared/writing-language'

/**
 * 平台节奏画像（v7）。
 *
 * 为什么是数据不是提示词：平台是**书的属性**——同一个 App 里两本书可以一本起点、一本番茄。
 * 提示词里出现的任何个数都必须来自这里，而不是写在模板正文里（v6 的教训：个数被写在
 * 模板、【怎么切】、输出格式三处，改画像时两处常量不跟着变，模型同时收到两个数）。
 *
 * 空串 = 中性：模板里【节奏推荐】整段被裁掉，模型按内容自己定 —— 老项目升级后
 * 不该被静默改节奏，所以**不要**给空值一个"默认起点"。
 */
export const RHYTHM_PROFILE_IDS = ['qidian', 'fanqie'] as const
export type RhythmProfileId = typeof RHYTHM_PROFILE_IDS[number]

const PROFILE_TEXT: Record<RhythmProfileId, Record<WritingLanguage, string>> = {
  qidian: {
    'zh-CN': `起点向（长线铺陈、升级流）
- 全书 3–5 卷；每卷 5–7 个单元
- 一个单元完成一次"交手方式的换代"，不要每单元都打同一批人
- 兑现：三到五章一次可感进展，一到两卷一给一次不可逆的换挡
- 允许慢热：前两卷可以先建关系和规则，但每卷必须有一次"世界变了"`,
    'en-US': `Qidian style (slow build, progression-driven)
- 3–5 volumes; 5–7 units per volume
- Each unit must escalate the *kind* of pressure, not repeat the same cast
- Payoffs: a felt advance every 3–5 chapters; an irreversible gear change every 1–2 volumes
- Slow openings are allowed: the first two volumes may build relationships and rules, but each volume must still change the world once`,
  },
  fanqie: {
    'zh-CN': `番茄向（强钩子、快兑现）
- 全书 6–8 卷；每卷 3–5 个单元
- 卷内节奏：每个单元必须开场就出事、结束就挂账，不留缓冲段
- 兑现：一到两章一次可感进展，每章章末必须有钩子
- 不允许慢热：第一卷第一个单元就要把规则和代价演完`,
    'en-US': `Fanqie style (hard hooks, fast payoffs)
- 6–8 volumes; 3–5 units per volume
- Every unit opens with a hit and closes with a debt; no buffer units
- Payoffs: a felt advance every 1–2 chapters; every chapter ends on a hook
- No slow opening: rules and costs must be fully demonstrated in the first unit`,
  },
}

/** 画像值 → 注入文本。空 → ''（中性）；未知值当自定义文本原样使用。 */
export function resolveRhythmProfile(
  value: string | null | undefined,
  language: WritingLanguage,
): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  if ((RHYTHM_PROFILE_IDS as readonly string[]).includes(raw)) {
    return PROFILE_TEXT[raw as RhythmProfileId][language]
  }
  return raw
}
