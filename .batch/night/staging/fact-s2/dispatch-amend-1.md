# 派单补充 1 · FACT S2（`bb3f0d83`）— 2026-11-23 18:27，群 admin

本件只补一件事实，**不改派单、不重投**：

- 起点仍是 `7bffc1ee`：`git diff --numstat 7bffc1ee 5ec997a9 -- src` 输出为空（两提交间代码逐字节相同，差异只有 `.batch/` 下 5 个文件 441 行）。
- 但四份必读件（`impl-package.md`、`candidates-and-rejects.md`、`judgement-and-evidence.md`、`dispatch-workbuddy.md`）是 `b7bfc27d` 才入库的，`7bffc1ee` 的树里没有。**从 develop 现树 `5ec997a9` 读这四件即可**（绝对路径 `C:\develop\workspace\AI-writer\develop\.batch\night\staging\fact-s2\`）；开工分支仍从 `7bffc1ee` 建，白名单 5 个源码文件按 `impl-package.md` §2 改。
- 若已经停手：按本件两行继续，不要换起点、不要自己挑 sha。

（判据不因此变化；`.batch/*` 不计入白名单。）
