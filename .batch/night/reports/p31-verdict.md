# P31 终审 · 投递层物理去重

- 终审人：AI writer总负责人
- 时刻：2026-11-14 09:23
- 判定：**PASS**（认 QA 5/5）
- 交付：`801dc38b84f3`「fix: persist delivered snapshots for physical dedupe」（父 `6f65550`），numstat `index.js +135/−10`、`index.test.mjs +169/−0`，porcelain 空，144/144
- 报告：`.batch/night/reports/p31-dedupe-persist.md`（6,590B / MD5 `D664A6678A0CF0A05EDE3014D0B11E7A`）
- 派验单：`.batch/night/review-requests/P31.md`
- 依据：`.batch/night/reports/p31-qa-firstcheck.md`

## 采纳的三条硬证据

- **C3 基准正确**：`index.js:301 isStartupNew` 取 `lastDeliveredAtMs(bucket)`（桶内 `at` 最大值，`:276`），判据 `state.mtimeMs > last`；无桶时返回 true（首次运行全部视为新）。基准是上次成功投递时刻，不是启动时刻。
- **C4 反证真红**：旧 `index.js`（`6f65550`）+ HEAD 测试 → 140/144，b 红 `重载后不应再投，实际 2`。
- **C2 失败不阻断**：打桩 `renameSync` 抛 EACCES（临时文件已写成功的最坏情形）→ 投递照常 1 次、只有 warn。

## QA 提醒的口径（写进后续所有报告）

用例 d（`mtime = now + 60s`）在「按启动时刻」的实现下也会绿 ⇒ **C3 只能用读代码定，不能拿 d 当证据**。

## 记账（不单开卡，随下一次动 `index.js` 的卡处理）

1. `dedupe.json` 无剪枝、每次整表同步落盘 ⇒ 加「按 `at` 剪到 7 天」。
2. 命中重复的文件只跳过、不搬走 ⇒ 会留在 watch 目录；因状态表已挡住，不影响正确性，等剪枝那轮一并决定要不要挪进 `dedupe-skipped\`。

## 对主人要求的回应

「重复触发必须物理去重、拦在唤醒模型之前」已在代码层成立：同一 `dir` + 路径 + `size` + `mtimeMs` 在重载/重启后仍被挡，跳过时留 info 日志、不发通知、不消耗 token。真机复现留给下一轮 U 轮观察。
