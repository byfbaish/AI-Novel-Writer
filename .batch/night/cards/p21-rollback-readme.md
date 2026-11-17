# P21-fix · 回滚两份 README，只保留 WARN 文案与断言

- 派卡：豆包联络人（2026-11-15 04:43，按 AI writer总负责人「立即停投」指令）
- 执行：豆包（经豆包联络人）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点：当前工作区，HEAD `16e80a2`（你上一步自己提交的），远端 master 仍是 `74f4cc1`，无 tag

## 为什么要回滚（一句话）

主人刚纠正：内置配置界面属核心功能、必须交付。README 里「当前版本无内置界面」这段口径现在是错的，不能写进发行物。WARN 文案与测试断言与路线无关，保留。

## 必做改动（只做这一件）

1. 把两份 README 恢复到 `74f4cc1` 时的样子，**不做任何其它编辑**：

   ```
   git -C C:\develop\workspace\dsh-handoff-relay checkout 74f4cc1 -- README.md README.zh-CN.md
   ```

2. `git status --porcelain` 里不应再出现两份 README。

3. 保留不动：`index.js` 的 WARN 字符串改动（新文案 `设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml`）与 `index.test.mjs` 四处断言的同步。

4. 提交这一次回滚，提交信息：

   ```
   revert: restore both READMEs pending the built-in settings UI decision
   ```

   `git add README.md README.zh-CN.md`，**不许** `git add -A` / `git add .`。不推送、不打 tag。

## 明令不做

- 不改 `client.js`、不改 `package.json`、不改版本号。
- 不重写、不删减 README 内容，就是整文件回到 `74f4cc1`。
- 不碰 `.batch/` 下任何文件。

## 验收判据（逐条贴原始输出）

- P1 `git show --numstat --format=%h HEAD` 只含 `README.md`、`README.zh-CN.md` 两行。
- P2 `git diff 74f4cc1 HEAD -- README.md README.zh-CN.md` 为空（无输出）。
- P3 `git diff 74f4cc1 HEAD -- index.js index.test.mjs` 仍有 WARN 与断言的改动（贴 `--stat`）。
- P4 `git status --porcelain` 为空。
- P5 `git rev-parse --short=12 HEAD` 原文。

## 交付

- 报告 `.batch\night\reports\p21-rollback-readme.md`，贴 P1–P5 命令与原始输出。
- 信号 `.batch\night\signals\doubao\p21-rollback-readme.done`，三行：产物路径 / 提交 SHA / `<!-- DONE -->`。
- 报告末行 `<!-- DONE -->`。

<!-- DONE -->
