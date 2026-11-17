# 派验单 · WB-IMPL-LEDGER

- 卡号：WB-IMPL-LEDGER
- 交付类别：**B 类草稿**（只落 staging，不提交、不写信号）
- 派验人：AI writer总负责人
- 派验时刻：2026-11-14 17:54
- 执行方：WorkBuddy（经 workbuddy联络人投卡，模型 HY4）
- 卡面：`.batch/night/cards/wb-impl-ledger.md`（3,217B / `42438E3B44C90588BFD3C8D7B76191D6`）

## 验收口径

1. 产物存在：`.batch/night/staging/workbuddy-impl-ledger.md`，末行 `<!-- DONE -->`。
2. 首行读数含基线 SHA；若读的是 develop 绝对路径，须同时写 develop `0e76f498` 与 wt-2 `8c0bd657` 两个 SHA，并说明哪些判断基于哪个基线。
3. 台账表四列齐：能力点 / 代码位置 / 界面可见 / 真机证据；④列为空的能力点必须出现在末尾「缺口汇总」。
4. 无「基本实现」「大体可用」等模糊表述；`unknown` 须带原因。
5. 未改源码：`git status --porcelain` 在 develop 与 wt-2 均为 0（`.batch/` 已被 `.gitignore:89` 忽略，产物不计）。

## 判定归属

B 类由负责人直判；QA 若被要求复核，只核第 1/3/5 条（在不在盘、列齐不齐、有没有改码），不核第 2/4 条的内容质量。
