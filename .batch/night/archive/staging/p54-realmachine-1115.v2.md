执行方：developer
model=DeepSeek-V4.1 | 倍率=— | provider=—（本报告为工程取证，无模型生成内容）

# P54 真机验取证（40f34b5 · 隔离副本）

## 0. 结论速览

1. **正例通过**：桩件自带 `From:` 时，注入正文首两行逐字为 `From: QA · AI writer项目组 | 11111111` 与 `To: Chief | session- | 主身`，`^From:` / `^To:` 各**恰 1 行**（桩件自带的 To 行已被丢弃，未出现双头）。
2. **负例通过**：`From:` 缺失的桩件，注入首行为 `From: UNKNOWN`。
3. **发现真缺陷（不在卡面）**：`To:` 的「前 8 位」段是 `session-`，不是会话 id 前 8 位。根因 `index.js:1290` `const id8 = String(resolved.id || '').slice(0, 8);` —— resolved.id 形如 `session-8ea61110-…`，前 8 字符正好是字面量 `session-`。**`f41b031`（fix2）未修**（`git show f41b031:index.js` 第 1290 行同文）。线上真实 `relay.log` 同样复现：`to=session-|大肥鱼|主身`。
4. **隔离不彻底（我的方案缺陷，如实报）**：探针实例的 relay 状态落点解析到了**真实** `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay`，故主 profile `relay.log` **新增 4 行**、`dedupe.json` 被更新、`delivered\aacf6baf5ecd\` 收了 4 个探针文件。原判据「主 profile relay.log 新增=0」**不成立**。

## 1. 环境（可复现）

- 隔离根：`C:\Users\<用户名>\AppData\Local\Temp\dsh-p54v-1115`
- 副本 profile：`<根>\home\profiles\p54probe`（`robocopy /E /XJ` 自 `~/.dsh/profiles/desktop`，1.1G / 28s）
- 插件代码：`git worktree add --detach <根>\relay-40f34b5 40f34b5` → HEAD `40f34b5fe02064b62672fca2d6656b656603e6ae`、porcelain 空
- 装载：`<副本>\node_modules\dsh-handoff-relay` → Junction → `<根>\relay-40f34b5`
- 配置：`<副本>\cordis.patch.yml` 的 `dsh-handoff-relay.config.watches` 替换为单条：dir=`<根>\watch-in`、`targetSessionId=session-8ea61110-6f93-4b92-b4a6-5bcde00400bd`、`exact: true`、`done.text: <!-- DONE -->`；crlf=0
- 实例：`DeepSeek Harness.exe --expose-internals <cli.js> --profile p54probe --port 61151 --no-open`（pid 30272，`DSH_HOME=<根>\home`）
- 目标会话在探针实例内创建（无 Playwright 时的替代路径：系统 Chrome `--headless=new --remote-debugging-port=9223` + CDP `Runtime.evaluate` 点「新建会话」）
- 会话日志：`<根>\home\sessions\--C-Users-~4F2F~4E91~98DE-…--\session-8ea61110-…\session.v4.jsonl.zstd`（多帧，按 magic `28 B5 2F FD` 逐帧 `zstdDecompressSync` 后读）

## 2. 正例（3 次，桩件 172B/122B/101B，末尾 `<!-- DONE -->`）

注入记录（session 日志 `agent/inbox/spliced` + `user/message`，`source.kind = plugin:dsh-handoff-relay`）：

- seq 7（`p54v-pos-01.md`）：
  ```
  From: QA · AI writer项目组 | 11111111
  To: Chief | session- | 主身
  文件 …\watch-in\p54v-pos-01.md 已就绪（触发=DONE），请继续。
  ```
- seq 22（`p54v-pos-02.md`）、seq 30（`p54v-pos-03.md`）：同形。

机检：`^From:` 计数=1、`^To:` 计数=1；`From:` 值与桩件首行逐字相同；桩件正文里那行 `To:` 未出现在注入正文中（剥离生效）。

## 3. 负例（1 次，桩件 103B，无 `From:` 行）

- seq 39 / 43（`p54v-neg-01.md`）：
  ```
  From: UNKNOWN
  To: Chief | session- | 主身
  ```

## 4. 缺陷明细（供开卡）

| 项 | 证据 | 判定 |
|---|---|---|
| To 行 id8 = `session-` | `index.js:1290` `slice(0, 8)`；注入文本；线上 relay.log 多行 | 真缺陷，需改为先剥离 `session-` 前缀再取 8 位（或取 `resolved.id.replace(/^session-/, '').slice(0,8)`） |
| 状态落点绕开副本 | 真实 `~/.dsh/profiles/desktop/dsh-handoff-relay/relay.log` 新增 4 行（`07:18:49` / `07:26:47` / `07:33:55` / `07:45:57` UTC，均带 `dir=…\Temp\dsh-p54v-1115\watch-in`） | 我的方案缺陷；`profileRootDir()`（`index.js:244-248`）在 `DSH_PROFILE_DIR` 缺位时兜底到 `~/.dsh/profiles/<DSH_PROFILE>`，副本实例未显式设 `DSH_PROFILE_DIR` 故落到 desktop |
| 去重表被探针写入 | 真实 `dedupe.json` mtime 15:48、新增 `aacf6baf5ecd` 键 | 同上，需清理 |

## 5. 待办

- 清理：`delivered\aacf6baf5ecd\` 4 个探针文件、`dedupe.json` 的 `aacf6baf5ecd` 键；探针实例与 Chrome 收尾。
- 收尾三判据（负责人 15:4x 定稿）：①探针树 HEAD=`40f34b5` 且 porcelain 空 ②主仓 HEAD=`f41b031` 且 porcelain 空 ③`worktree remove --force` + `prune` 后只剩主仓。

## 6. 双快照四行（v2 补记 · 大肥鱼 16:11 判据）

**① 开工前 `HEAD + porcelain` 原文**（`<隔离根>\snapshot-open.txt`，2026-11-15 14:40:26）：
```
# P54 真机验 开工快照  2026-11-15 14:40:26
## 主仓 C:\develop\workspace\dsh-handoff-relay
rev-parse HEAD: 40f34b5fe02064b62672fca2d6656b656603e6ae
branch: master
porcelain-v1-begin
 M README.md
 M index.js
 M index.test.mjs
porcelain-v1-end
## worktree
C:/develop/workspace/dsh-handoff-relay                                                         40f34b5 [master]
"C:/Users/\<用户名>\274\257\344\272\221\351\243\236/AppData/Local/Temp/dsh-p54v-1115/relay-40f34b5" 40f34b5 (detached HEAD)
## worktree 自证
HEAD: 40f34b5fe02064b62672fca2d6656b656603e6ae
porcelain:[]
```

**② 收尾 `HEAD + porcelain` 原文**（2026-11-15 16:10 实测主仓 `C:\develop\workspace\dsh-handoff-relay`）：
```
HEAD: f41b0312d89a50493943706b488b8773aaaa0eec
branch: master
porcelain-v1-begin
porcelain-v1-end
(0 行)
```
**两份快照不逐字相同**，差异根因是**他人提交**：fix2 执行方于 `2026-11-15 15:09:17 +0800` 提交 `f41b031 fix: label relay From by watch directory and log identity conflicts`，把开工时的 `M README.md` / `M index.js` / `M index.test.mjs` 三笔收进提交，故 HEAD 前进、porcelain 归零。本人在此期间只执行 `worktree add --detach` 与 `worktree remove --force`，未 add / 未 commit / 未 checkout。

**③ `git worktree list` 原文**
- 开工时：
```
C:/develop/workspace/dsh-handoff-relay                                                         40f34b5 [master]
"C:/Users/<用户名>/AppData/Local/Temp/dsh-p54v-1115/relay-40f34b5" 40f34b5 (detached HEAD)
```
- 收尾后（`remove --force` + `prune`）：
```
C:/develop/workspace/dsh-handoff-relay f41b031 [master]
```

**④ worktree 自证（开工时读取，全文见 ①）**
```
HEAD: 40f34b5fe02064b62672fca2d6656b656603e6ae
status --porcelain: []（空）
```
worktree 已在收尾时 `remove --force` 删除，故上述为删除前读取值（原文留存于 `snapshot-open.txt`），无法在删除后复读；如需复读请重跑 `git worktree add --detach <根>\relay-40f34b5 40f34b5`。

<!-- DONE -->
