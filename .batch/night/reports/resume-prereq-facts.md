# 恢复前两项核实 + 一个必须先处理的存量清单（developer，2026-11-14 02:12）

## 一、重启后会话 id 会不会变？—— 不会，id 落盘

- 会话以目录形式持久化：`C:\Users\<用户名>\.dsh\sessions\--C-develop-workspace-AI-writer-develop--\session-<uuid>\`（内含 `session.v4.jsonl.zstd`）。
- 配置里 5 个 `targetSessionId` 在磁盘上都能对到目录，创建时间分别是 11-12 / 11-13：
  `daeb834f`、`33494f59`、`4380d607`、`a1d48adb`、`f6f51eef`。
- 11-13 那次重启的实测也是「一次都没变」（7 条 watch 原样可用）。
- 结论：重启不产生新 id，**恢复只需一次重启**，不需要「重启后改配置再重启一次」。

## 二、`targetSessionId` 失效时插件怎么办？—— 只跳过那一条，不影响其他

按 `index.js`（HEAD `848c26d`）：
- `:816` 注释与实现：**先解析、后标记**；解析不到就不进 `delivered`，文件保持「未投递」，不移动。
- `:819` 写 `WARN … 解析不到目标，保持未投递（reason=agent-not-found）` 到 `relay.log`。
- P11 有限重扫：`RETRY_DELAYS_MS = [1000, 5000, 15000]`（`:31`），21s 窗口内最多 3 次；仍解析不到就等首个文件事件触发全量重扫（`:884`）。
- `:998` 启动期校验解析不到**只 warn、不阻断加载、也不影响其他 watch**。
- 代价：配置里写错 id 不会崩、也不会拖累别人，但那条 watch 会一直不投；改配置后**必须重启才生效**（插件启动时读一次配置）。

## 三、主 profile 不需要 `install` 刷新

- `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-handoff-relay` 是 **Junction → `C:\develop\workspace\dsh-handoff-relay`**（linkType=Junction）。
- 它直接读仓库，所以 `dsh plugin --profile desktop install` 不是必需；真正要核的是「仓库 blob == 期望提交」（`git rev-parse HEAD:client.js`）。
- 注意：Junction 只对主 profile 成立；`selftest1114` 那种用 `file:` 装出来的 profile 才会有 `.pnpm` 副本被重新物化的问题。

## 四、必须先处理的存量（否则重启就是重放）

当前 `cordis.patch.yml:295` 仍是 `disabled: true`（插件停用中）。7 个 watch 目录里**并非全空**：

| 目录 | 存量 | 文件 |
|---|---|---|
| `scripts\dsh\wakeup-inbox` | 1 | `dsh-wake-20261114-0205-7426.md`（247B，02:05:01） |
| `.batch\night\signals\doubao` | 2 | `p13-settings-inject-crash.done`（610B）、`p14-settings-inject-mount.done`（616B） |
| `.batch\night\bridge\to-owner` | 3 | `2026-11-14-0125-plugin-pitfalls-guide.md`、`…0205-card-visible.md`、`…0207-release-notes-ready.md` |
| 其余 4 个 | 0 | — |

- relay 启动时会**全量扫 watch 目录**，这 6 个文件会被逐个投出去（不按 DONE 判定也可走 stableMs）。也就是说：只要不清理，重启=重放 6 条。
- 分类：
  - 3 个 `bridge\to-owner` 是**本该送到大肥鱼却没送出去的积压通知**（插件停用期间 relay.log 无新行）；
  - 2 个 `signals\doubao\*.done` 是已完成卡片的历史信号，重放只会给豆包联络人制造噪声；
  - 1 个 `wakeup-inbox\dsh-wake-…` 是唤醒任务的产物，重放会给负责人一条过期提醒。

## 五、两个可选口径（需负责人/大肥鱼定）

- **A（严格按主人「只放一个探针」）**：把这 6 个文件全部移入 `.batch\night\archive\resume-1114\`，之后只放 1 个探针，验收就是「恰好 1 条」；3 条积压由大肥鱼另行补发。
- **B（保留真实积压）**：只清 3 个噪声（2 个 `.done` + 1 个 wake 产物），保留 `to-owner` 3 条积压，再放 1 个探针；验收口径变成「恰好 4 条，其中 to-owner 3 条是补发」。
- 我倾向 A：变量最少，「恰好 1 条」才可判定；积压重发本来就是另一件事，混在一起会让判据失效。
