# P9 终审 · 移走失败止血

结论：**PASS**
判定人：AI writer总负责人
依据：QA 首验 `.batch/night/reports/p9-qa-firstcheck.md`（独立复核，不重复查）

## 判定

| # | 判据 | 结果 | 依据 |
|---|---|---|---|
| ① | rename 前建目录、失败重试 3 次 | 过 | QA 首败次成用例，断言「rename 时目录已存在」 |
| ② | 三次全失败写 `failed.json`，下次加载跳过不重投 | 过 | QA 复跑 |
| ③ | `failed.json` 200 条上限、坏 JSON 整表丢弃 | 过 | QA 复跑 |
| ④ | `relay.log` 三类写入路径、256KB 截断 | 过（两条硬断言） | QA 记：只硬断言「启动」「失败」，第三条为代码路径 |
| ⑤ | `TOTAL:` ≥ 69/69、`source:` 按内容逐字不变、porcelain 只两文件 | 过 | 77/77 PASS；`source:` 内容比对一致 |

提交：`51b9b73 fix: retry moving delivered files out and record unmovable ones so they never replay`
（父 `6563d27`，2 files changed，401 insertions / 17 deletions）

## 记入 backlog（不拦）

1. `relayStateDir()` 缺 `isInsideDir` 兜底（`delivered/` 有），profile 配错时状态文件可能落进 watch 目录 —— 二期
2. 「三路径日志」第三条（跳过已失败件）没有硬断言
3. 失败件标记在 200 条上限前不会自动清
4. 豆包报告「改动范围」数字待改（+182/-17 → 165/17），只影响报告，不影响判定

## 剩余一条未验（需重启）

`signals\doubao\wake-later.done`（176B，21:54:49）故意留在原地。重启后必须验：
- [x] 源文件被 move 进 `delivered\<dirKey>\`（不再留在原地）
- [x] 目标会话 **恰好 1 条**，带绝对路径
- [x] `~\.dsh\profiles\desktop\dsh-handoff-relay\relay.log` 生成且有启动行

重启由主人点。重启后由 developer 接班复验，口径见 `.batch/night/review-requests/rewire-1113.md`。

## 真机复验（22:36 重启后，developer 执行 A 方案碰 mtime）

- 重启后首轮**未投递**：文件原地不动、`delivered\` 无新增、只 1 行启动 INFO。定为启动扫描早于会话注册表就绪（启动行 `14:36:41.558Z`，目标会话首写 `22:36:53`，差 11 秒），归 P10，**不计入 P9**。
- 碰 mtime 后投递成功，四读数：①源目录只剩 `.gitkeep` ②`delivered\<dirKey>\wake-later.done` 176B、MD5 `EAE979C60EFCAE0F25758B2593E71229`、恰 1 件 ③目标会话恰 1 条、22:42:18、触发 `DONE`、带绝对路径 ④`relay.log` 168B 仍只有 1 行 INFO、无 WARN，`failed.json` 未生成。
- `agents.get('session-4380d607…')` 此刻解析成功（既投又移 ⇒ `:494` 必成功）。
- QA 判 P9 真机**成立**；我终审维持 **PASS**。

结论：P9 代码级与真机均 PASS。P9 未覆盖的启动期静默丢转 P10（`.batch/night/cards/p10-resolve-before-mark.md`）。
