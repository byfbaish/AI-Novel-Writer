import type { WritingLanguage } from '../../shared/writing-language'
import { RHYTHM_PROFILE_IDS, type RhythmProfileId } from '../../shared/rhythm-profile-ids'

/**
 * 平台节奏画像（v7）。
 *
 * 为什么是数据不是提示词：平台是**书的属性**——同一个 App 里两本书可以一本起点、一本番茄。
 * 这里给的是**方向与节奏**（松紧、兑现频率、钩子密度），不是配额：「个数来源」≠「个数只能
 * 来自常量」——模板正文里不许写死卷数 / 单元数区间，画像里也不许再给出卷数 / 单元数的固定
 * 个数（v6 的教训只是前者：个数曾写在模板、【怎么切】、输出格式三处，改画像时两处常量不跟
 * 着变，模型同时收到两个数）。分几卷、每卷切几个单元由模型按题材、平台与篇幅自己划分，
 * 重生成卷纲的代价极小，5 卷与 7 卷都合理（D6 §9.2，2026-11-06）。
 *
 * 空串 = 中性：模板里【节奏推荐】整段被裁掉，模型按内容自己定 —— 老项目升级后
 * 不该被静默改节奏，所以**不要**给空值一个"默认起点"。
 */
export { RHYTHM_PROFILE_IDS, type RhythmProfileId }

const PROFILE_TEXT: Record<RhythmProfileId, Record<WritingLanguage, string>> = {
  qidian: {
    'zh-CN': `起点向（长线铺陈、升级流）
- 卷与单元按剧情量切：一段该有几节，看它自己的分量，不要为了凑数把薄的一段撑开、把厚的一段压扁
- 一个单元完成一次"交手方式的换代"，不要每单元都打同一批人
- 兑现：三到五章一次可感进展，一到两卷一给一次不可逆的换挡
- 允许慢热：前两卷可以先建关系和规则，但每卷必须有一次"世界变了"`,
    'en-US': `Qidian style (slow build, progression-driven)
- Cut volumes and units by dramatic weight: a thin stretch is not padded out to match a thick one
- Each unit must escalate the *kind* of pressure, not repeat the same cast
- Payoffs: a felt advance every 3–5 chapters; an irreversible gear change every 1–2 volumes
- Slow openings are allowed: the first two volumes may build relationships and rules, but each volume must still change the world once`,
  },
  fanqie: {
    'zh-CN': `番茄向（强钩子、快兑现）
- 卷与单元按剧情量切：一段该有几节，看它自己的分量，不要为了凑数把薄的一段撑开、把厚的一段压扁
- 卷内节奏：每个单元必须开场就出事、结束就挂账，不留缓冲段
- 兑现：一到两章一次可感进展，每章章末必须有钩子
- 不允许慢热：第一卷第一个单元就要把规则和代价演完`,
    'en-US': `Fanqie style (hard hooks, fast payoffs)
- Cut volumes and units by dramatic weight: a thin stretch is not padded out to match a thick one
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
