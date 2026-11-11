# 2026-11-11 夜班计划（External 派发版 · 定稿）

> 状态行：**已中止**（01:50 起跑 → 04:18 停摆，S3–S6 全段未执行；2026-11-11 19:0x 按 [`2026-11-11-night-batch-digest.md`](2026-11-11-night-batch-digest.md) 结算。本稿自此为**存档口径**，不再按它派活；未做项的归属与重开条件见 digest §2.4 / §5）
>
> ~~状态行：**执行中**（01:50 起跑；本稿为定稿版，由 2026-11-11 草案 review 后重写）~~
> 授权：**可改码 + 可提交（不含推送）+ 主区实机与全量测试**（依据 2026-11-10 交接稿 + 作者 2026-11-11 01:0x「把 Review 的活派给 WorkBuddy」与「走 External 派发」）
> 中控角色：**只做调度、判读、收口**；所有实现类活派给 WorkBuddy / 豆包。
> D12 不单独测（作者 2026-11-10 拍板）。

## 0. 对草案的 8 条 review 结论（已全部吸收进本稿）

| # | 草案问题 | 本稿处理 |
|---|---|---|
| 1 | 派发链是 Host 定时 trace 卡 → DSH 卡会话，正是 11-10 半夜「日志 append 被拒 + `approval/asked` 卡死」的根因 | **整条删除**：改 External 拉取，不建 schedule、不点 Run（`armedSchedules` 恒 0），**零 DSH 卡会话** |
| 2 | 「日志遇 EPERM 退 `wt-2/.batch/night`」是错误兜底（11-10 实测两处同时不可写） | 夜间产物只落两处：`develop/.runtime/night/`（**只由 Lead 写**）与各 worktree 的 `.dsh-task-board/reports/`（agent 写）；报告永远是**新建文件**，永不 append 到已存在文件 |
| 3 | T0=01:10 已过 | T0 改为 **01:50**，整体后移 |
| 4 | §2 基线行过时（11-10 的产物早已合并） | 基线改为 `5e031021`，并已核对 wt-1/wt-2 状态 |
| 5 | 实机卡让 WorkBuddy 进 develop，和 worktree 红线冲突且无落地机制 | **develop 由 Lead 独占**：起 dev、造 fixture、跑全量、采 SQL/截图全在 Lead 手上；agent 只判读产物 |
| 6 | browser 判定线缺失 | 判定线写明 `2 failed / 835 passed / 837`（11-10 基线 30 failed / 808 / 838，R2 修 28 条 + 删 B8 一条 ⇒ 837） |
| 7 | 编号混乱（W1 同时指「草案卡」和「昨夜 W1」） | 全 lane 重编：`P-WB/WB-1..7/RV`、`P-DB/DB-1..7/DG`，卡 ID 用 UUID，不再复用旧编号 |
| 8 | 缺卡↔提交↔回滚映射、未认领卡收口、豆包空闲检查 | §6 补映射表；§7 补未认领收口；§1 前置检查含两 agent 空闲确认 |

## 1. 前置状态（01:30 实测）

- `develop`（`exp/resource-ledger`）HEAD `5e031021`（D9 阶段 1）；未提交只有 `M` 两个 C1 测试改动 + `M` 交接稿补记 + `?? .batch/`。
- `wt-1` @ `5e031021`（含同样两处 C1 `M`，与 develop 字符串一致）；`wt-2` @ `5e031021`（F0b 已 ff，工作区干净）。
- 看板：`http://127.0.0.1:61365`，ledger `0bdbb2fa-af3a-4544-b25b-78f299d2b217`，CLI `scripts/task-board/dsh-task-board.mjs`。
- 两 agent：WorkBuddy CDP 9333「允许完全访问」/ Hy4 限免；豆包 CDP 9331 任务模式「本地电脑」/ 自动·中。
- 端口 5180/5181/5182/9222 全部空闲（无 dev 实例）。
- F0/F0b 已完成：草案 + F0（merge wt-1）+ **F0b（`git -C wt-2 merge --ff-only 5e031021`）**，两 worktree 与主线同基线。

## 2. 架构：External 拉取（不推送、不定时）

```
Lead create --add external --add wb|db --add I*   （卡面 prompt = 自包含任务书）
  → worker: claim <id> --agent workbuddy:worker|doubao
  → worker 干活 + 写 <workspace>/.dsh-task-board/reports/<id>.md（四段）
  → worker: tag <id> --add review --remove external --release
  → Lead:    review <id> --pass|--rework --agent lead:reviewer
```

- **提权坑四道结构措施**：① 零 DSH 卡会话；② agent 只写自己 worktree 的 `.dsh-task-board/reports/`；③ `develop/.runtime/night/` 只由 Lead（danger-full-access）写；④ 报告是独立新文件，永不 append；任何确认框 → 立即 BLOCKED 不停等。
- 不用 `next` 而按**卡 ID 认领**：避免两个 agent 抢同一张、也避免卡序被 `next` 的打分逻辑打乱。
- worker 失败用 `fail`；Lead 不复活失败卡。
- 看板卡是**任务载体**，不承载状态：状态回填仍写台账 / 设计稿 / 缺陷稿（§6）。

## 3. 卡清单（18 张：16 主 + 2 备用）

| 编号 | 卡 ID | 标题 | lane | 重要度 | 起始 external |
|---|---|---|---|---|---|
| P-WB | `c87c888f-40b6-4ffe-8079-094f3bc315fd` | 就绪探针 | WB | I3 | ✅ |
| WB-1 | `1ada5cbf-8d4e-4fb3-93e8-c8f81a3b5e6d` | 单测夹具补 M29 三列（`execution_owner`） | WB | I2 | ✅ |
| WB-2 | `f41947b6-1596-47ee-a3a1-a59ad1eaab78` | B11 监听器 1 vs 2 静态判定 | WB | I2 | ✅ |
| WB-3 | `b20c9393-5a5a-4055-a2fa-ae26bfe50202` | D17 大纲提交记覆盖章区间 | WB | I1 | ✅ |
| WB-4 | `926a5b30-2dca-4fb7-adeb-677b412b0f67` | D9 慢吐实机判读 | WB | I1 | ⏸ 到窗口释放 |
| WB-5 | `b33ca4e0-3879-424f-940c-91b90a0f3ad5` | B16 来源冲突文案判读 | WB | I2 | ⏸ |
| WB-6 | `2fff7426-a5fe-4677-bb25-07dd72eb6191` | `pnpm test` 全量判读 | WB | I2 | ⏸ |
| WB-7 | `016862ed-d543-4ca6-88d6-f04fca445d98` | browser 全量（唯一允许跑套件的卡） | WB | I2 | ⏸ |
| RV | `f9cb0320-b72a-43b6-9c02-639158bf161b` | 07:00 独立复核（干净会话 + DeepSeek-V4.1-Flash） | WB | I1 | ⏸ |
| P-DB | `ee4a088e-0b7a-422d-9b13-2c8b72389159` | 就绪探针 | DB | I3 | ✅ |
| DB-1 | `9af76744-cbc8-467f-a3bc-c50b7fa4322a` | D9 阶段 2：逐章完成读数纯函数（不接线） | DB | I1 | ✅ |
| DB-2 | `40e86fcc-df8b-404d-ae70-6657e23e0925` | B16 文案全量对照 + 晨间三步脚本 | DB | I2 | ✅ |
| DB-3 | `b80a3fe8-3eb5-4cde-adf4-03f1526472c7` | 超时→续写衔接方案（四段模板） | DB | I1 | ✅ |
| DB-4 | `981977bf-76e7-4fcf-9435-95e9c96ba7cd` | D9 台账/状态行回填两处 | DB | I2 | ✅ |
| DB-6 | `3a9ca460-9792-4d89-8601-d5a71ee3faf1` | 交叉复核 WB-1..WB-3（换身份） | DB | I1 | ⏸ 待材料 |
| DB-5 | `105067bc-0dc2-449e-87f1-77b76f4d9267` | 备用：文档一致性扫描 | DB | I3 | ⏸ 备用 |
| DB-7 | `ee381832-7f61-46b3-92a1-b2d9fb2b700d` | 备用：D17 交叉自检 | DB | I3 | ⏸ 备用 |
| DG | `db186e6c-b06e-491e-9f31-4f7f0b3d4d88` | 晨间 digest | DB | I2 | ⏸ 到窗口释放 |

任务书原文：`develop/scripts/night/20261111/*.md`（每张卡一份，卡面 prompt 即该文件正文）。

**释放前提（hold 卡，缺一条就不许 `tag --add external`）**

| 卡 | 释放前提 |
|---|---|
| WB-4 | Lead 实机产物 `wt-2/.runtime/judge/M1/` 已落盘 |
| WB-5 | Lead 实机产物 `M2/` 已落盘 |
| WB-6 | `M3/`（`pnpm test` 全量输出）已落盘 + 基线已存 |
| WB-7 | 进入 S5 窗口，且 WB-4/5/6 已交回 |
| RV | 07:00 到点 + 干净会话（`--new --model DeepSeek-V4.1-Flash`） |
| DB-6 | `wt-1/.runtime/crosscheck/` 下 `WB-1`、`WB-2` 各有 `report.md` + `diff.patch`；`WB-3` 必须是**已完成**的 report（未完成时只能写「未开工」，不得据此判 PASS） |
| DB-5 | 备用：豆包 lane 提前空出时释放（不依赖 WB 产物） |
| DB-7 | **WB-3 报告落盘后**（材料源就是 WB-3 的 patch；WB-3 未开工时禁止释放） |
| DG | 至少 3 份主卡报告 + 全部已交 review 卡可读 |

## 4. 时间轴（T0 = 01:50）

| 段 | 时间 | WorkBuddy | 豆包 | Lead |
|---|---|---|---|---|
| S0 | 01:50–02:05 | P-WB 探针 | P-DB 探针 | 盯两条探针报告 + 看板 `review` 列 |
| S1 | 02:05–03:15 | WB-1 夹具 | DB-1 阶段 2 读数 | 复核探针；准备基线（`pnpm test` 基线落盘） |
| S2 | 03:15–04:20 | WB-2 → WB-3 | DB-2 → DB-3 | 04:00 起起 dev（9222 探活）、准备慢吐 fixture |
| S3 | 04:20–05:30 | WB-4 判读（Release 后） | DB-4 → DB-6 材料就位 | 跑 D9 慢吐实机 + 采集产物 → 复制到 `wt-2/.runtime/judge/M1/` |
| S4 | 05:30–06:40 | WB-5 → WB-6 判读 | DB-6 交叉复核 | 跑 B16 实机 + `pnpm test` 全量 → 产物落 `M2/`、`M3/` |
| S5 | 06:40–07:20 | WB-7 browser 全量 | DG 晨间 digest | 收 patch → apply → `check:fast` → 分批提交（不推送） |
| S6 | 07:20–08:10 | RV 独立复核 | — | 读 RV → 回填台账 → 写 `docs/handoffs/2026-11-11-night-batch-digest.md` → README 索引 + memory |

**06:30 硬检查点**：落后 ≥ 1 段 ⇒ 砍 DG / DB-6、WB-6 顺延到晨间；不允许拖过 08:10。

**弹性批（豆包 lane 的实际节奏）**：01:31–01:45 实测 5 张卡 14 分钟完成（卡面时间盒合计 200 分钟，约 1/14）。因此豆包 lane **不按上表逐段推进**：上一批交回后即按 §3「释放前提」检查下一张，满足条件的立刻释放（DB-5 可随时放；DB-7 必须等 WB-3 落盘；DG 等材料齐）。释放动作一律由 Lead 做，worker 不得自行 `--add external`。

## 5. 判定线

- **browser 全量**：`2 failed / 835 passed / 837`（B11、B16 为已知两条）；出现新红 ⇒ 先 revert 对应提交再查。
- **`pnpm test` 全量**：与基线做**失败集合 diff**，只允许「消失」，不允许「新增」。
- **实机**：每条结论必须给 SQL 行原文或截图原文；不允许「应该/估计」。
- **RV**：逐卡 `可合并 / 需改 / 仅材料`，并对 WB-1/2/3、DB-1/4 单独抽查行号 ≥6 处。
- **提交纪律**：每批一提交、每次提交前 `node scripts/check-fast.mjs` 全绿；不推送。

## 6. 卡 ↔ 提交 ↔ 回滚映射

| 卡 | 预期产物 | 落点（提交信息前缀） | 回滚 |
|---|---|---|---|
| WB-1 | 单测夹具补齐（1 文件） | `test(generation) 补 M29 三列到 run-service 夹具` | revert 该提交 |
| WB-2 | 结论（可能 ≤10 行修） | 若有代码：`fix(startup) …`；无代码则只回填交接稿 | 同上 / 无需 |
| WB-3 | commitSynopsis + 判定侧两处 + 单测 | `feat(d17) 大纲提交记覆盖章区间` | revert 该提交（无 schema 变更） |
| DB-1 | 新纯函数 + 单测（2 文件，零调用方） | `feat(d9) 阶段2 逐章完成读数纯函数` | revert |
| DB-2 | 纯材料 | 不回填代码；摘进交接稿 | 无需 |
| DB-3 | 纯材料（方案） | 摘进交接稿「待拍板」 | 无需 |
| DB-4 | 两处台账现值 | `docs(ledger) D9 阶段1 现值回填` | revert |
| WB-4/5/6/7、RV、DG | 判读与 digest | 摘进交接稿 / README | 无需 |

## 7. 收口与兜底

- **未认领的卡**：08:10 前仍未 claim ⇒ Lead 用 `update --column backlog` 移出 To Do（不删除、不 `done`）。
- **worker BLOCKED**：卡片留在 review 列，Lead 在 digest 里单列「卡在哪、缺什么」。
- **提权弹窗**：任何 agent 报「确认框」⇒ 该卡判 BLOCKED，Lead 记录并跳过（不重启、不等待）。
- **dev 实例**：只在 04:00–06:40 需要；结束后 `Stop-Process` 并确认 9222 释放。
- **不推送**：本轮所有提交停留在 `exp/resource-ledger` 本地。

## 8. 不做清单

A1 判据实跑（作者已定顺延）· D7 · D11 · M1 删稿 · C2 A2–A4 · D12 复查 · `VolumeHandoffRegistryPanel` 区间断言 · 推送 · 动 `wt-3` · 改全局配置（`config.json`/`models.json`/`recent-projects.json`）· `pnpm test:node` · Host 定时卡 / 点 Run。

## 9. 与 11-10 夜班的关系

11-10 的教训直接变成本稿结构：① Host 定时卡 + DSH 卡会话 = 提权卡死（§0-1）；② 日志 append 到既有文件被拒（§0-2）；③ EPERM 双落点同时不可写（§0-2）；④ 判读与实机必须分离（§0-5）；⑤ 报告的「测试通过」必须有可复跑的独立证据（§5）。11-10 产物已全部合并（`4184cae1` / `9c3c913c` / `7a800313` / `a7b84373`），本稿基线从 `5e031021` 起算。

## 10. 发现：提权坑的根因（2026-11-11 02:2x，待作者拍板后再改手册）

**结论（T3 证据，尚未落地任何脚本/手册改动）**：三次夜间事故同根——**会话落地根目录（Harness 叫法不同）与任务书里的绝对路径不在同一棵树，且开窗后没有任何一条通道能验证这件事**。

1. **WorkBuddy 侧（窗口坑）**。`scripts/workbuddy/workbuddy-attach.mjs:345-360` 的 `openSpaceDraft()` 是「点侧栏某个**空间**标题右侧的 `+`」开新草稿；`spaceLabelForCwd()`（`:310-312`）取 `path.basename(path.resolve(cwd))`。任务书里却是另一工作区的绝对路径 ⇒ agent 每次读写撞沙箱边界 → 确认框 → 无人值守卡死。02:1x 实测 `--cwd C:\develop\workspace\AI-writer\develop --force` 派发后，目标文件一个都没写成、却显示「已发送」，且文本落进旧会话。
2. **守卫静默失效（可直接修的点）**。`:355-358` 本有一条守卫 `const workspace = snapshot?.chips?.workspace ?? null; if (workspace && normalizePath(workspace) !== normalizePath(label)) throw`，但**实测 `chips.workspace` 恒为 `null`**（status 输出 `"chips":{"workspace":null,"branch":null,"permission":"允许完全访问","model":"Hy4"}`）⇒ `?? null` + 真值判断 = 跳过校验，从未真正拦过。
3. **可靠字段**：`status --json` 的 `recentSessions[].cwd` / `recordedSession.cwd`（本轮靠它确认 `6c7177f1` 落 wt-2，也靠它发现早前派发落错窗口）。修法方向 = 开窗后按 `currentSessionId` 回查 cwd 与目标目录比对，**查不到就拒发**。
4. **DSH 侧是另一个洞，不能混为一谈**：11-10 卡死是 **DSH 卡会话进程**（受限令牌 + Low 完整性）append `develop/.runtime/night/*.log` 被 ACL 拒 → `approval/asked`，属「进程权限档不足」；与「空间 ≠ 目标目录」不同。共同结论只有一条：**夜间无人值守时，会话落地根目录必须 = 卡面所有绝对路径的父目录**。
5. **命名对照（同一概念 = 会话的落地根目录）**：WorkBuddy 叫「空间」· DSH 叫「工作区」· 豆包叫「项目」。豆包 `bootstrap.mjs --project AI-writer-wt-1` 已带绝对路径 project chip，是三者中唯一有显式选择操作的；WB 缺这一层等价物；DSH 有 `--cwd` 但无校验。

**处置**：手册修订（`docs/agents/workbuddy-channel.md`、`task-board-channel.md`、doc-placement 命名对照表）按 T0#2 留给作者拍板，本稿只记录证据。
