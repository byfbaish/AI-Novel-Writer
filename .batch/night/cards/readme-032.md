# 卡：README 更新到 0.3.2（安装段 + 配置字段 + 通知文案）

## 背景

仓库 `C:\develop\workspace\dsh-handoff-relay` 已发布 npm 0.3.2（`latest=0.3.2`，0.3.1 已 deprecate）。但两份 README 停留在发布前，且没有写 0.3.2 新增的两个能力（`targetTitle` 包含匹配、通知带绝对路径）。

基线：HEAD `fe19581`、porcelain 空、`package.json` version `0.3.2`、`git ls-files` 8 件。

## 要做的事（只改 `README.md` 与 `README.zh-CN.md`）

1. **404 段改掉**：`README.md:67-68`、`README.zh-CN.md:54-55` 现在写「尚未发布到 npm，`npm view` 返回 404，市场搜不到」。改成已发布口径：包名 `dsh-handoff-relay`，在应用内插件市场搜得到；命令行也可以直接 `dsh plugin --profile desktop add dsh-handoff-relay`。保留「必须指明 profile」的既有解释，别删。
2. **版本固定示例更新**：`README.md:127`、`README.zh-CN.md:109` 的 `#v0.3.0` 改成 `#v0.3.2`。
3. **配置字段补两项**：
   - `watches[].targetTitle`：与 `targetSessionId` **二选一**（都写或都不写 → 该条跳过并告警）。按会话标题**包含匹配**（`简报` 会命中 `周简报`）；命中 0 条或多条都不投递，只告警。不做 `cwd` 兜底。
   - `message` 模板支持占位符补 `{path}`（被投递文件的绝对路径）；默认模板已改成带绝对路径。
   - 中英两份的字段表都要补齐，行文对应。
4. **行为段补一句**：默认通知文本形如 `文件 <绝对路径> 已就绪（触发=stable|DONE），请继续。`——收件方可以按该路径直接读文件。英文对应句同样加。
5. 两份 README 的章节顺序保持一一对应，不许一份有、一份没有。

## 禁忌

- 只改这两份 README，其他文件一律不动（`package.json`、`index.js`、`LICENSE` 都不许碰）
- 命令必须真实可用；不确定的命令先 `dsh plugin --help` 查证并附原始输出
- 脱敏：不得出现 `C:\develop`、内部 Bot 名、卡号、`.batch`
- 不许 `git push`、不许 `npm publish`、不许重启 DSH
- 点名 `git add README.md README.zh-CN.md`，不许 `-A`

## 产物

`.batch/night/reports/readme-032.md`，末尾 `<!-- DONE -->`；另落 `.batch/night/signals/doubao/readme-032.done`（三行：产物路径 / 提交 SHA / `<!-- DONE -->`）。

## 判定线

1. 两份 README 里 `404`、`尚未发布`、`not published` 字样 0 命中。
2. `#v0.3.0` 两处都变成 `#v0.3.2`，全仓无 `v0.3.0` 残留（`git grep -n "v0.3.0"`）。
3. 字段表两份都含 `targetTitle` 与 `{path}`，且写明二选一与包含匹配、命中多条不投。
4. 提交只含这两份文件；`git diff --stat` 只有它们。
5. `node index.test.mjs` 仍 `TOTAL: 56/56 PASS`（没动代码，确认没误伤）。
