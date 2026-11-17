# 恢复执行记录：清理存量 → 解冻 → 唯一探针（developer，2026-11-14 02:15）

口径：负责人定 **A 案**——6 条存量全部移档、不重放；只放 1 个探针指向负责人会话。

## 一、清前 / 清后清单

清前（6 条，全部是插件停用期间积压或历史噪声）：

| 文件 | 字节 | 原目录 |
|---|---|---|
| `dsh-wake-20261114-0205-7426.md` | 247 | `scripts\dsh\wakeup-inbox` |
| `p13-settings-inject-crash.done` | 610 | `.batch\night\signals\doubao` |
| `p14-settings-inject-mount.done` | 616 | `.batch\night\signals\doubao` |
| `2026-11-14-0125-plugin-pitfalls-guide.md` | 1,659 | `.batch\night\bridge\to-owner` |
| `2026-11-14-0205-card-visible.md` | 1,899 | `.batch\night\bridge\to-owner` |
| `2026-11-14-0207-release-notes-ready.md` | 585 | `.batch\night\bridge\to-owner` |

移至 `.batch\night\archive\resume-1114\{wakeup-inbox|signals-doubao|bridge-to-owner}\`，保留原文件名。

清后 7 个 watch 目录：`wakeup-inbox` 及其余 6 个全部为 0（只剩 `.gitkeep`）。

## 二、插件解冻

- `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml` 第 295 行 `disabled: true` → `disabled: false`（该条目 `- id: dsh-handoff-relay`，唯一改动；文件其余 `disabled: true` 4 处未动）。
- 备份：`cordis.patch.yml.bak-resume-1114`。
- 改前 10,317B → 改后 10,907B，首三字节 `23 20 59`（UTF-8 无 BOM）。

## 三、**意外但关键：不需要重启，配置被热加载了**

改完配置没重启，`relay.log` 02:14:16 就出现完整加载段：

```
watches[1..6] 加载解析 … resolved=session-…（7 条里 6 条逐条列出）
启动 7/7 个 watch；stableMs=5000，delivered=…\delivered
WARN 设置卡未挂载：宿主无 settings 服务（跳过，不影响 watch）
```

⇒ **cordis 监听 `cordis.patch.yml`，改完即热重载插件**，不需要关 DSH。
（我先前说「改配置要重启才生效」**是错的**，这里更正。）

同时留一条待办：热重载路径下宿主没有 settings 服务，所以设置卡不会当场挂上（WARN 已写明「跳过，不影响 watch」）；要让卡在**主实例**里出现，仍需一次正常启动。

## 四、唯一探针

- 放置：`scripts\dsh\wakeup-inbox\probe-resume-1114.txt`，376B，内容含时间戳、目标 `session-daeb834f…`、预期判据，末行 `<!-- DONE -->`。
- 结果：**02:14:34.710 被投出并存档**为 `delivered\90caa0a2de22\probe-resume-1114.txt`（376B）；源目录只剩 `.gitkeep`。
- 其余 6 个 watch 的 delivered 计数**一条都没变**（`83e63d6cfdfa` 4 件、`abf70c44921e` 1 件、`dad6df13f302` 6 件，mtime 均早于本次），说明存档的 6 条存量**没有被重放**。

## 五、仓库一致性（Junction 直读，无需 install）

- `HEAD = 43c3762`（`chore: release 0.4.1`），porcelain 空，`version = 0.4.1`。
- blob 三项逐一相同：`index.js` `e353298c…`、`client.js` `e76141cf…`、`package.json` `54713647…`（`HEAD:<path>` 与 `git hash-object` 工作区一致）。

## 六、结论

清理与解冻都已完成且**已生效**；探针投递成功，6 条存量确认未重放。重启不再是恢复的前置条件——仅剩「让设置卡在主实例里出现」需要一次正常启动。
