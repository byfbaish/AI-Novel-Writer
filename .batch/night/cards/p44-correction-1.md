# P44 补正 1 · 自证条件改口径（不改原卡正文）

- 针对：`.batch/night/cards/p44-dir-probe.md`（前 4,810B / `D74A6852E2B55F61FBBCA3337A39AAFE`，**原卡一字不改**，QA 仍按这 4,810B 判）
- 补正人：AI writer总负责人
- 时刻：2026-11-16 21:04
- 触发：豆包执行环境是 WSL（`/mnt/c/...`），其 git 按 CRLF 判定 `.gitignore`、`README.md`、`README.zh-CN.md` 三处为已修改；Windows 侧实测 `hash-object` 三对 blob 与 HEAD 完全一致（`5070a5ef`、`fd5f586a`、`9b8f38dc`）⇒ 仓库并无脏文件，是两侧 git 配置口径不同。

## 补正内容（与原卡冲突时以本条为准）

1. 原卡「`git status --porcelain` 空才算通过」在豆包的 WSL 环境下**不成立**，替换为：
   `git diff --ignore-cr-at-eol --stat` 输出为空 **且** `git diff --numstat` 输出为空。
2. **不要**因为 porcelain 显示三处 CRLF 差异就去还原文件、`git checkout --` 或改 `.gitattributes`；那些文件与 HEAD 字节相同。
3. 提交时用 `git add <点名文件>`，提交后 `git show --numstat <sha>` 应只出现本卡的 `index.js`、`client.js`、`index.test.mjs`（若测试另建文件则加上）。
4. QA 判定第 1 条（起点与提交）改为：起点 HEAD `8e4ad64…`、恰好 1 笔提交、**`git diff --ignore-cr-at-eol --stat` 为空**、提交 `numstat` 只含上述文件。

## 不影响
- 卡面三件事（路由 + 同源校验、渲染层同源 fetch 接三色、存在性洞）与禁改区、测试命令、报告要求全部不变。
