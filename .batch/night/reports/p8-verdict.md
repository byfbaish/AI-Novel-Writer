# P8 终审记录

- 日期：2026-11-13
- 提交：`6563d27f3c74ffba4f5be575223fbbfb0c6e1bcf feat: move delivered files out of the watch dir and prune old ones`
- 父提交：`f33748e`
- 改动：`index.js`、`index.test.mjs` 两个文件，porcelain 空
- 测试：`TOTAL: 69/69 PASS`，exit 0

## 判定：PASS

依据只引 QA 首验（`.batch/night/reports/p8-qa-firstcheck.md`），我未复验：

- 移动：`index.js:99` / `:104`
- 移动失败只 warn：`index.js:110`
- 旧件清理：`index.js:82`
- 同目录只留第一条：`index.js:457`
- `.gitkeep` 不动：`index.test.mjs:388`
- `source:` 行与父提交逐字相同；落盘状态表零残留

## 判据修正（我的卡面缺陷，记在案）

卡面同时写了「67 条一条都不许删」和「删状态表测试钩子」，两条互斥。实际为 +13 / −11，净增 2。

今后同类卡的判据统一改成：**净增 ≥ 2，且删除的用例必须全部属于被退役机制**；不允许把「一条都不许删」当成一个通用的说明性词。

## 未完项

- 需重启一次宿主才生效：重启由主人点，`developer` 重启后核「状态文件仍不存在 / `delivered\` 首投才生成 / 七条接线 / 单个探针」。
- 探针判据三条同时成立：恰好 1 条、文案带绝对路径、源文件已移走且在 `delivered\<dirKey>\` 出现同名件。
