# P28a 首验（QA）· 副本探针复验 P26/P27（隔离实例）

- 判定对象：`.batch/night/reports/p28-probe-after-fix.md`（6,798B / MD5 `A1E9AF8583E0158ED1A75950E38A594F`，末行 DONE）
- 判据：报告 §3 R1–R4（负责人指派：独立复算四档读数 + 核「反证是真换回旧代码跑出来的」）
- **结论：PASS 4/4**，另纠一处**报告注记的字面错误**（不改结论，须改一句）

## 1. 产物与信号

- 报告字节/MD5 与派验一致；信号 `%USERPROFILE%\.dsh\profiles\desktop\dsh-handoff-relay\delivered\83e63d6cfdfa\p28-probe-after-fix.done`，319B / 08:50:44，内容与报告一致。
- 未登记独立派验单（`review-requests/` 下无 `p28a.md`），按负责人群内指派判；此为流程缺口，已在群内说明。

## 2. 四档读数独立复算（源：探针日志，不是报告转述）

日志 `%TEMP%\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\relay.log`（行首 UTC）：

| 阶段 | 行 | 关键读数 |
|---|---|---|
| 正例 t4 | `00:47:48Z` | `describe.length=25`、`inList=true`、`configUndefined=false cfgType=object hasToJSON=true` |
| 正例 t20 | `00:48:03Z` | `describe.length=26`、`inList=true`、同上 |
| 反证 t4 | `00:49:42Z` | `describe.length=25`、`inList=false`、`configUndefined=true cfgType=undefined hasToJSON=false` |
| 反证 t20 | `00:49:58Z` | 同上 |

四档 `profileRootDir=C:\Users\<用户名>\AppData\Local\Temp\dsh-probe-1114\home\profiles\probe` 且与同行 `env` 一致 ⇒ R4（不是主 profile）成立。

- R1 形态：`typeof=object isArray=true`，与 `dsh-settings/lib/index.js:463 return descriptors;` 一致；length 25→26 的差异是 `ui-task-board` 晚装配，不影响结论。
- R2 进列：正例 `inList=true` / 反例 `inList=false` —— **同一副本、同一探针、只换 `index.js`**，这是本卡的核心判据。
- R3 Config 形态：正例 `hasToJSON=true`（`dsh-settings:540 return schema !== void 0 && "toJSON" in schema ? schema : void 0;` 能返回）、反例 `configUndefined=true`，与 P25 的 ERR_REQUIRE_ESM_RACE_CONDITION 链吻合。

## 3. 「反证是真跑出来的」独立取证

报告写「只换 `repo\index.js`」。我按字节重建，确认反证实例当时**确实是旧代码 + 探针**，不是同一份新代码换标签：

```
# 用提交版本按 LF 写入得到的 blob
beb0af2:index.js  → 186570feeba7f1b485ceb2f087fcb396e21dd38d
8d562a0:index.js  → 394fd90f204ac3744331071cbab4a60d27d3f018

# 再拼 .batch/night/tools/probe3.snippet.js 之后的 blob
beb0af2 + probe3 → d395d079…
8d562a0 + probe3 → e13f7722d8f2f670ae4d65fd496f484aa49d96aa

# 副本当前字节
%TEMP%\dsh-probe-1114\repo\index.js 现 blob = e13f7722…（= 8d562a0 + probe3）
  · 无 `await import(`，有同步 `loadSchemastery()` 与 `req('@deepseek-ai/schemastery')`
  · 文件 mtime 08:49:35 ↔ 反证日志首行 00:49:42Z 对得上
```

⇒ 反证段确实用 P26 之前的同步加载版本跑出 `inList=false`，不是「新代码但断言失败」的伪反证。

## 4. 隔离

主实例日志 `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`：`PROBE-DESCRIBE` 命中 **0**，mtime 停在 08:45:37（探针 08:47–08:50 期间未写入）⇒ 副本与主实例未串。

## 5. 必须改的一句（报告 §0 注）

报告 §0 现写：「上表两个 blob 是**写入副本并插桩后**的字节……仓库对应值 `04a44b8d…`/`489389d9…`」。

实测 **`186570fe…`/`394fd90f…` 是插桩前**（= 提交版本按 LF 写入后）的字节；插桩后应是 `d395d079…`/`e13f7722d8f2f670ae4d65fd496f484aa49d96aa`（后者与副本现存字节一致）。

建议改为：

> 上表两个 blob 是**插桩前**（提交版本按 LF 写入副本后）的字节；插桩后分别为 `d395d079…` / `e13f7722…`。

这是注记字面错，不影响 R1–R4 读数与结论；已在群内同步 developer 改一句即可，不重开卡。

## 6. 边界

- 副本探针证明的是「新代码在**副本 profile** 的加载序下进了 describe」，离线/主 profile 未复现 race（离线两版都能建出 Config）；真机主实例效果仍归真机 U 轮（U0/U2 已 PASS，U3/U7/U8 待）。
- 本轮只读取证范围：未碰在用 profile、未重启主实例（报告 §0 声明；主日志 mtime 与 PROBE=0 与之相容）。
