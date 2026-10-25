/**
 * 平台节奏画像的 id 集合 —— **唯一一份**。
 *
 * 为什么单独成文件：`services/prompts/rhythm-profiles.ts` 用它决定注入哪段节奏文本，
 * `shared/prose-shape.ts` 用它决定形态统计器按哪档阈值判，两侧必须同一个源。
 * v6 的教训是同一组个数写在三处，改一处另两处不跟着变；这里先堵住 id 层面的分裂。
 *
 * ⚠️ 只放 id，不放任何文本或数字。文本在 services 侧，数字在 prose-shape 侧。
 */
export const RHYTHM_PROFILE_IDS = ['qidian', 'fanqie'] as const
export type RhythmProfileId = typeof RHYTHM_PROFILE_IDS[number]

/**
 * 是否**已知**档位 id。注意这是严格相等判断，不是「空 = 默认」的兜底：
 * `rhythm-profiles.ts:10-11` 定下「空 = 中性，不要给默认起点」，调用方拿到 `false`
 * 时一律不判，而不是退回某一档。
 */
export function isRhythmProfileId(value: string | null | undefined): value is RhythmProfileId {
  const raw = (value ?? '').trim()
  return (RHYTHM_PROFILE_IDS as readonly string[]).includes(raw)
}
