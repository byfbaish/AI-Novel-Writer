# P9 重启复验清单（developer 版·重启前基线）

生成时间：2026-11-13 22:20

## 一、重启前基线（已实查）

| 项 | 值 |
|---|---|
| 仓库 HEAD | `51b9b73`（父 `6563d27`） |
| porcelain | 空 |
| `index.js` | 30,431B，mtime 22:06:23 |
| profile junction | `~\.dsh\profiles\desktop\node_modules\dsh-handoff-relay` → `C:\develop\workspace\dsh-handoff-relay`（新代码会随重启加载） |
| `relay.log` | **不存在** |
| `failed.json` | **不存在** |
| `dsh-handoff-relay-state.json` | **不存在**（P8 已退役该文件，出现即异常） |
| `delivered\` 现状 | `90caa0a2de22` 1 件、`abf70c44921e` 1 件、`dad6df13f302` **0 件** |

## 二、walk 目录留存（重启后会被启动扫描逐个投递）

| 目录 | 非 .gitkeep 文件 |
|---|---|
| `signals\doubao` | **2 个**：`p9-failed-take.done` 210B（22:09:11）、`wake-later.done` 176B（21:54:49） |
| 其余 6 个目录 | 0 |

⚠️ **这条会直接打掉「恰好 1 条」判据**：`signals\doubao` 里有 2 个带完成标记的文件，重启扫描会各投一次 ⇒ 豆包联络人会收到 **2 条**，不是 1 条。两种处理：
- A（推荐）：重启前先把 `p9-failed-take.done` 挪进 `.batch\night\archive\`，只留 `wake-later.done` 作单一变量，判据仍是「恰好 1 条」；
- B：保留两个，判据改成「`wake-later.done` 对应 1 条 + `p9-failed-take.done` 对应 1 条，共 2 条，互不重复」。

## 三、`relay.log` 的正确预期（按代码，不看行号）

- 落点：`~\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`（`relayStateDir()` + `RELAY_LOG_FILENAME`）。
- **只写三条路径**：启动（`启动 N/M 个 watch；stableMs=…, delivered=…`）、移动失败（warn）、跳过已失败件（warn）。
- 正常重启、两次移动都成功 ⇒ 文件里应当**只有 1 行 INFO**，以 ISO 时间戳开头。
- 若出现 WARN 行 ⇒ 说明走到了失败/跳过路径，正好用来给 P9 定性。
- 上限 256KB，超了截断保留末尾一半。

## 四、重启后复验三判据

1. `signals\doubao\wake-later.done` **不在原地**；
2. `delivered\dad6df13f302\` 出现 `wake-later.done`，176B，内容 md5 与原文件一致（`EAE979C6…229`）；
3. 豆包联络人会话收到投递（条数与第二节的 A/B 口径一致），文案含绝对路径；
4. 附加：`relay.log` 生成且只有 1 行 INFO / 或含预期 WARN；`failed.json` 不应生成（两次移动都成功的前提下）。

---

## 五、重启前最终快照（22:21，A 方案已执行后）

### delivered 现有清单（重启后只认新增）

| dirKey | 文件 | 字节 | mtime |
|---|---|---|---|
| `90caa0a2de22` | `probe-rewire-2125.txt` | 214 | 11-13 21:26:02 |
| `abf70c44921e` | `decision-permission-b-2124.md` | 1077 | 11-13 21:24:29 |
| `dad6df13f302` | — | 0 件 | — |

### 待投文件

- 路径：`C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\wake-later.done`
- 字节：176
- mtime：11-13 21:54:49.453
- MD5：`EAE979C60EFCAE0F25758B2593E71229`
- `signals\doubao` 剩余：`.gitkeep`(0B)、`wake-later.done`(176B) —— 其余 6 个 watch 目录已空

### state 三元

`relay.log` 不存在、`failed.json` 不存在、`dsh-handoff-relay-state.json` 不存在

### 代码侧

HEAD `51b9b73`，porcelain 空
