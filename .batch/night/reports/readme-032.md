# README 更新到 0.3.2（安装段 + 配置字段 + 通知文案）

仓库：`C:\develop\workspace\dsh-handoff-relay`
基线 HEAD：`fe19581 chore: release 0.3.2`（开工时 porcelain 空、`git ls-files` 8 件、`version` 0.3.2）
提交：`5b6903553ac2b6d304f5fa0fc2b6dda9bc3f167d`
改动文件：`README.md`、`README.zh-CN.md`（仅这两个）

## 一、改了什么（两份一一对应）

| 段落 | 英文 | 中文 |
|---|---|---|
| 发布状态 | `Install from the marketplace`：已发布到 npm（当前 `0.3.2`），市场按包名可搜；附 `dsh plugin --profile desktop add dsh-handoff-relay` | `从插件市场安装`：同义，命令同 |
| 目标会话 | `Who gets notified`：id / title 二选一、双写或双空跳过；包含匹配、区分大小写（`简报`→`周简报`）；每次投递前重解析、不缓存；0 条或多条不投递只告警；无 `cwd` 兜底 | `通知发给谁`：同义 |
| 通知文案 | 默认文本 `文件 <absolute path> 已就绪（触发=stable|DONE），请继续。`，收件方按路径直接读 | 同句、同语义（`<绝对路径>`） |
| 重启说明 | `targetSessionId` 需每次重启后重接；`targetTitle` 不用 | 同义 |
| 版本固定 | `#v0.3.2` | `#v0.3.2` |
| 配置字段（散列） | `watches` 改为「`dir` + `targetSessionId` / `targetTitle` 恰好一个」；新增 `targetTitle` 条目 | 同义 |
| 加载期校验 | 目标（id 或标题）现在能否解析；解析不到只告警仍启动；结果不缓存 | 同义 |
| 配置表 | 新增 `targetTitle` 行；`targetSessionId` 行注明二选一；`message` 行补 `{path}`（绝对路径），保留 `{file}` | 同义 |

保留原有解释：`dsh plugin` 会把参数转发给 profile 目录里的 `pnpm`，所以必须指明 profile（未删）。

## 二、命令与发布状态查证（原始输出）

`dsh plugin --help`（不带 profile 直接报错，说明 `--profile` 是必填）：

```
error: required option '--profile <name>' not specified
```

`dsh plugin --profile desktop --help`：

```
Usage: pnpm [command] [flags]
...
      add                  Installs a package and any packages that it depends
                           on. By default, any new package is installed as a
                           prod dependency
```

即 `dsh plugin --profile desktop add <包名>` 会在 profile 目录里执行 `pnpm add`，README 里的
`dsh plugin --profile desktop add dsh-handoff-relay` 与实际 CLI 行为一致。

`npm view dsh-handoff-relay version dist-tags`：

```
version = '0.3.2'
dist-tags = { latest: '0.3.2' }
```

## 三、判定线逐条

| # | 判定 | 证据 | 结果 |
|---|---|---|---|
| 1 | `404` / `尚未发布` / `not published` 0 命中 | `git grep -n -E "404|尚未发布|not published"` → 空输出 | 通过 |
| 2 | 两处 `#v0.3.0` → `#v0.3.2`，全仓无残留 | `git grep -n "v0.3.0"` → 空输出；两份 README 现为 `#v0.3.2` | 通过 |
| 3 | 两份字段表都含 `targetTitle` 与 `{path}`，写明二选一、包含匹配、多命中不投 | 英文表：`Exactly one of this and targetTitle is required` / `Substring … case-sensitive` / `zero or multiple matches mean no delivery`；中文表同义 | 通过 |
| 4 | 提交只含两份文件 | `[master 5b69035] 2 files changed, 89 insertions(+), 40 deletions(-)`，`git diff --stat` 只有 README.md / README.zh-CN.md | 通过 |
| 5 | `node index.test.mjs` 仍 56/56 PASS | `TOTAL: 56/56 PASS` / `RESULT: PASS` | 通过 |

## 四、脱敏与边界

- 两份 README 内无 `C:\develop`、无内部 Bot 名、无卡号、无 `.batch`（`git grep -n -E "develop|\.batch" -- README.md README.zh-CN.md` 未新增命中；插件市场 URL 与 GitHub 地址为公开信息）。
- 未改 `package.json`、`index.js`、`LICENSE`、`cordis.patch.yml`；未 `git push`、未 `npm publish`、未重启 DSH。
- 未验证项：应用内插件市场的搜索 UI 本身未实机点验（只验证了 npm 上 `latest=0.3.2` 与 CLI 参数形态）；「市场必能按包名搜到」依据的是 npm dist-tag + 市场按 registry 名字检索的既有行为，本次读取的文件内未见市场检索实现细节。

<!-- DONE -->
