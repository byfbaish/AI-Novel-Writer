# 卡：字段卡收尾（只做三件事，不许再改内容）

## 背景

`package.json` 的 22 行改动已经在工作区里，内容正确（`files`/`repository`/`homepage`/`author`/`keywords` 五个字段都在，`name`、`version 0.3.0`、`dsh.bundle.patch` 未动）。上一回合在核对 README 写法时卡住 30 分钟没交付，现已中止。

本卡**不重新设计方案、不改任何字段内容**，只把已经改好的东西提交并交证据。

## 只做四件事

1. `git add package.json`（点名，不许 `git add -A` / `git add .`）
2. 提交，message 用：`chore: add npm publish metadata (files, repository, homepage, author, keywords)`
3. 写报告 `.batch/night/reports/npm-fields.md`，末尾 `<!-- DONE -->`，内容只要四段：
   - `git show --stat HEAD` 输出
   - `npm pack --dry-run` 输出的文件清单（应恰好 6 项：`index.js`、`cordis.patch.yml`、`README.md`、`README.zh-CN.md`、`LICENSE`、`package.json`）
   - `node index.test.mjs` 的 TOTAL 行（应 49/49 PASS）
   - `git rev-parse HEAD`
4. 落交付信号 `.batch/night/signals/doubao/npm-fields.done`，三行：
   ```
   产物路径：C:\develop\workspace\AI-writer\develop\.batch\night\reports\npm-fields.md
   提交 SHA：<上一步的 sha>
   <!-- DONE -->
   ```

## 禁忌

- 不许改 `README.md` / `README.zh-CN.md`（另一张卡已定稿）
- 不许改字段内容、不许调 `version`
- 不许 `git push`、不许 `npm publish`、不许重启 DSH
- 卡住超过 10 分钟就停下报告卡壳点，不要继续在同一回合里磨

## 判定线

1. 提交只含 `package.json` 一个文件。
2. `npm pack --dry-run` 恰好 6 项，无 `index.test.mjs`、无 `.gitignore`。
3. 测试 49/49 PASS。
4. `signals/doubao/npm-fields.done` 三行齐全、末行是 `<!-- DONE -->`。
