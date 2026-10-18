/**
 * 「类型」标签的拼装口径（2026-10-18）。
 *
 * 配置页有两栏：**类型**（genre，如「都市」）与**细分类型**（subGenre，如「都市/脑洞/轻喜剧」）。
 * 架构链路此前只把 `genre` 填进 `{{genre}}`，细分类型一路丢失 —— 作者在弧光提示词里
 * 看到的是「小说类型：都市」，而真正决定调性的是「脑洞/轻喜剧」那一层。
 *
 * 为什么不新增 `{{sub_genre}}` 变量：
 * 新增变量要同时改模板正文、`requiredContextVariables`（红线 16：会穿透作者覆盖版）、
 * 以及双语契约测试；而 `{{genre}}` 在模板里出现的位置本来就该同时容纳两者
 * （「小说类型：{{genre}}」「节奏策略要匹配「{{genre}}」类型」）。
 * 因此在装配点合并成一个标签，模板与契约都不动。
 *
 * 去重：细分类型常把主类型重复一遍（「都市」+「都市/脑洞/轻喜剧」），
 * 直接拼会得到「都市 / 都市/脑洞/轻喜剧」——这里按 `/`「、」「，」切开后去重合并。
 */
const SUB_SPLIT = /[/／、,，+＋]/u

export function composeGenreLabel(genre?: string | null, subGenre?: string | null): string {
  const parts = [
    (genre ?? '').trim(),
    ...(subGenre ?? '').split(SUB_SPLIT).map(item => item.trim()),
  ].filter(Boolean)
  const unique = parts.filter((item, index) => parts.indexOf(item) === index)
  return unique.join(' · ')
}
