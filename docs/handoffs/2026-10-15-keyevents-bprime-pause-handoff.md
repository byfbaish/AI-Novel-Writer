# 交接：keyEvents 阶段 2 + M08 迁移已落地 / 下一步 = 段三（2026-10-15 · 15:56 更新）

> **一句话**：阶段 1 → 段一（阶段 2）→ 阶段 2.5 实测 → **M08 迁移（v8→v9）全部通过** → **段三（R6 锚点人物管理面）** → **段二（B′ 双写）** —— **四段全部落地并提交**；只剩「段二实机验证」这一个收尾动作。
> ⚠️ 本文件 03:15 首次写就时迁移段尚未开始；15:56 已按实施结果更新（迁移段已完成）。
> 本会话起点 = 上一份交接（P0 主线已完成、R5 结案）；本会话主要在处理**作者实机连续暴露的候选/角色链路缺陷**，并把 `keyEvents` 阶段 2 落地。

---

## 1. 本会话完成了什么（全部已提交）

### 1.1 候选/角色链路的六个真实缺陷（作者实机连续命中）

| 提交 | 缺陷 | 判据 |
|---|---|---|
| `1a7b230d` | 目录批次写前证明比对了 7 个字段 ⇒ 作者补写章指导即杀批次 | ⑫ 证明只管候选真正依赖的字段 |
| `6e737bb0` | 候选面板无滚动、同名候选淹没新面孔 | ⑬ 语义决定与视觉收纳解耦 |
| `f8ac0571` | **暂存即完成（sync op）+ 取消即终态（批次）⇒ 候选三路全断** | ⑭ completion ≠ 已处理 |
| `159aac8f` | 列出步从未给确认步喂数据（`5933a506` 起断的）；源 D 同病 | — |
| `01f891b3` | 目录批次还被 `assertSources`（整条运行谱系）二次卡死；目录进度标记消失 ⇒ 连读都失败 | ⑮ 重算取不到 ≠ 从未存在 |
| `57173786` / `abf0a933` | 关系端点未采用时面板仍给「采用」⇒ 保存必炸；静默移除又像功能丢失 | — |
| `503943b8` | 「为指定角色补全背景」的 stage 因 operation 不匹配**从未成功过** | — |
| `bcec0367` | 模型输出含未转义引号 ⇒ 整条流程报废 | 语法容错 ≠ 语义解析 |

**实机结果**：老陈已彻底恢复（活跃卡 `c7a331dd`，role=minor；补全批次以 **map** 决策落到该卡，未重复建卡）。

### 1.2 `keyEvents` 阶段 2（段一）落地

`ec2f4e79`：三处中文模板示例 + 运行时不可变合同（zh/en）+ `directory.command.ts` 内联形状 + **作者两份覆盖版**（含新 `builtinRevision`）+ 验收脚本口径。
`ee937cec`：**结构化证据闸门读不动全角标点**（lexer 遇 `，`/裸控制字符直接 `return undefined` ⇒ 任何修复都被判"改写事实"）——修 lexer + 新增确定性本地修复（省掉一次 65536 tokens 的修复轮）。判据 ⑯。

### 1.3 阶段 2.5 实测（作者实机 ch6-8）

- 落库 ch6/7/8 = 4/5/4 条数组，id 被运行时重写为 `chN:E1`；
- `sum(estimatedUnits)` = **2550 / 2600 / 2500**，项目合同 = 每章 2500 ⇒ 偏差 ≤ +4%；
- ch1 已定稿 `word_count = 2464` ⇒ 单位尺度 ≈ 字数 ⇒ **可承担门禁职责**；
- 修复后无 `:structured-syntax-repair` attempt；
- 旧章 ch1-5 仍为数组（各 1 条）⇒ 双形态读写无回归。

---

## 2. ✅ 迁移段已完成（M08: v8 → v9，`6dfea726`）

**内容**：
- `blueprints.structured_refs TEXT NOT NULL DEFAULT ''` —— B′ 双写的机读伴随字段（`spaceRefs` JSON）；
- 新表 `character_cast_decisions` —— 锚点人物（功能配角）的 **append-only 作者决定日志**：
  `action ∈ (register, revoke)`，撤销 = 追加一条 `revoke`，当前态 = 按 name 取最后一条
  （不改写已批准批次收据 —— 同 `reopen` 原则：只追加现状，不重写历史）。

**lane 六步**全部落地（`registry.ts` / `project-storage.ts` / 新建 `m08-*.ts` / `desktop-registry.ts` /
`sqlite-project-migration.ts` 白名单 / **`baseline-schema.ts` 一字未动**）；
便携策略两处登记，新表走**独立标签 `m08Tables`**（照 m06 先例，不混进 m01–m05 桶）。

**验收读数**：
- `electron/migrations/__tests__` **88/88**（含新增 m08 installed-lane 2 例：v8→v9 内容不变 + 新列默认空串 + CHECK 拒非法动作 + 幂等；verify 失败回滚不留痕）；
- **作者库副本实测升级成功**：v8 → v9、无 `UNRECOGNIZED_SCHEMA`、8 行蓝图完好、新列全 `''`、新表就位、`user_version = 9`；
- v8/v9 结构精确 diff = **+10 字段**（9 列新表 + 1 新列），无消失、无不明增项；
- 5 文件回归面：失败 **34（基线）→ 3**，且 3 条**全在基线交集内**（预存在）；
- `sqlite-project-migration.test.ts` 失败集合与基线**逐名一致**；`tsc` 0 错。

**顺手修掉的历史欠账**：M07 当年漏登记 `project_core.plot_structure_plan` 的便携策略 ⇒
`portable-project-format` 的「双向精确匹配」测试从那时起一直红，现已全绿。

---

## 2.5 ✅ 段三（R6）与段二（B′ 双写）均已完成（2026-10-15 19:55）；本计划四段全部落地

**段二（B′）实施要点**（详见 `phase2-keyevents-bprime-implementation-plan.md` §9.6）：
- **T8** 世界观第 4 维加机读行 `老陈记｜hours=07:00-09:00｜entry=直接进入`；三处同步（zh 内置 / en 内置 / **作者覆盖版**）。覆盖版用**逐字抽取**同步（不手抄），并写回新 `builtinRevision=50f6770002f6c9b6`，备份 `world_building.zh-CN.json.bak-20261015115412`。⚠️ 模板是 JS 模板字符串，机读行里不能出现反引号（本轮踩过 TS1005）。
- **T9** 蓝图侧 `spaceRefs` → `blueprints.structured_refs`。换名只在 `normalizeBlueprintForWrite` 一处；**稀疏**（空则不写该键，否则改掉 payload 哈希/`character_sync_input` 字节形态、打红回读比对）；**fail-open**（缺列即不写，未升级 v9 的库照常工作）。
- **T10** 新校验器 `src/shared/space-time-consistency.ts`：空间名逐字命中 + 钟点纯数字包含判定；**零语义解析**（只认 `14:00`，不认「下午两点」）；**两侧缺字段只记 info、不判**；设定层一条机读行都没有时直接返回 `[]`（否则旧项目全量误报）。
- **T11** 接**既有**预检关卡（未新增流程）：`findBlueprintSpaceTimeRisks` 只接豁免 + 译成 `ConsistencyFinding`；`ConsistencyFinding` 加可选 `sourceLayer`，面板显示「冲突源：世界观设定（改本章无效）/ 本章蓝图」；设定侧取**架构产出的 `worldbuilding`**（不是作者手写的 `worldSetting`），读取失败 fail-open。
- **读数**：`tsc` 0 错；新增 56 例（校验器 35 + 预检接线 11 + structured_refs 10）；受影响面全绿（blueprint-repository 21 / semantic-contract 25 / directory-workflow 30 / review-revision-context 20 / prompt-local-qwen-contract 21）。

**下一步**：本计划（阶段 1 / 段一 / 阶段 2.5 / 段三 / 段二）已全部完成。段二**尚未实机验证**（跑一次带 `spaceRefs` 的蓝图，确认 trace/库内出现 `structured_refs` 且预检能报 finding）——这是唯一建议的收尾动作。

**历史记录——段三（R6 锚点人物管理面，2026-10-15 18:20 完成）**：

**T13 读取源切换**：`declinedCandidateNames()` 改读 append-only 决定日志 `character_cast_decisions`。
- **回填判据（关键）**：按「**该名字在日志里一条记录都没有**」回填，而**不是**按「表为空」—— ① 作者若先登记新名字（表已非空），老陈这类历史登记仍须补上；② 一旦某名字有了任何记录（含一条 `revoke`）就永不回填，**撤销过的名字不会因一次读取而「复活」**。老陈那条已保住。
- `approve` 路径在**确认时**就把 `functional` 写进日志（日志因此是唯一事实源）；backfill 只负责段三之前的历史批次。
- 未升级到 M08 的库（无新表）自动回退旧派生；写入路径则显式报 `CAST_DECISION_SCHEMA_REQUIRED`，不静默丢弃作者决定。

**T14 UI**：角色侧栏新增 **「锚点人物（不建卡）」** 区（`CharacterCastPanel.tsx`）—— 列出名字/定位/口吻/与主角关系/来源，可**撤销**（名字回到待建卡候选）、可改口吻定位。命名已按拍板统一为「锚点人物（不建卡）」（候选面板与收件箱两处旧文案同步改掉）。

**T15 复活 = 复用原 `character_id`**（作者 2026-10-15 拍板）：
- 落点在 `commitCharacterIdentities` 的 creations 循环 —— 两条建卡路径（手动保存 / 候选 `create`）都汇聚于此，只在 UI/store 加守卫会漏掉候选路径；
- 匹配同时看 `characters.name` 与 `character_aliases.name`（改名后退场的身份，作者记得的是最后那个名字）；
- **同名退休身份不止一个时不猜** —— 宁可新建，也不把候选挂到可能错误的那一个上；
- 复活保留历史静态字段与既有 provenance，只覆盖作者这次给的字段；别名窗口重开 = 追加一条 `valid_through IS NULL` 的别名，旧别名不动；
- 收据新增 `revived[]`，store 经 `characterRevivalEvents` 通知 UI 提示作者「这是已退场的同名身份，已复活原角色」。

**顺带修掉的真缺陷**：新通道 `character-cast:*` 必须登记进 `src/services/ipc-client.ts` 的 `isProjectScopedChannel` 前缀白名单，否则渲染层调用会被「通道不属于项目会话范围」拒绝（浏览器测试当场抓到）。

**段二（B′，下一步）**：世界观产出加机读行（`hours=` / `entry=`）+ 蓝图产出加 `spaceRefs` 写入 `structured_refs`
+ 新校验器 `space-time-consistency.ts`（**同章内**单点比较、零语义解析、两侧缺字段 fail-open）
+ 接既有预检关卡（finding 带「冲突源层级」）。

清单与落点 → `docs/design/phase2-keyevents-bprime-implementation-plan.md`（**§9.5 段三实施记录** / §9.4 段三与段二顺序）。

## 3. 未决 / 待作者定

| # | 事项 | 状态 |
|---|---|---|
| 1 | **R6 命名** | ✅ 已按「锚点人物（不建卡）」落地（段三 T14） |
| 2 | **复活 vs 孪生**（R6 验收点 5） | ✅ 作者 2026-10-15 拍板「复活 = 复用原 `character_id`」，已落地（段三 T15） |
| 3 | `legacySourceHashMatches` 是否收紧 | 阶段 2.5 之后的标定项，未动 |
| 4 | 阶段 2.5 严格闭环 | ch6 估算 2550 vs **其真实正文**——写 ch6 时回填对比（并行观察项） |
| 5 | backlog P6（伏笔/线索一次只能选一章） | 已登记 `docs/plans/prompt-assembly-backlog.md`，等作者定档位 |
| 6 | **作者项目尚未升级到 v9** | M08 已提交，但**要等作者重启 `pnpm dev` 才会应用**；重启后自动 v8→v9，无需人工干预。⚠️ 段三的「锚点人物（不建卡）」区依赖 v9 的新表：**重启前该区不出现**（读取回退旧派生，不报错） |
| 7 | ~~老陈的 functional 登记暂仍来自旧派生~~ | ✅ 已随段三回填解决：首次读取即把老陈写进决定日志，且**撤销过的名字不会因回填而复活** |

---

## 4. 环境提醒（避免重踩）

- **ABI**：`pnpm dev` 运行期间 Electron 持有 `better_sqlite3.node` ⇒ `prepare-native-for-node.mjs` 报 `EBUSY`。
  **绕过法**：`ELECTRON_RUN_AS_NODE=1 "<repo>/node_modules/electron/dist/electron.exe" node_modules/vitest/vitest.mjs run <test>`（Electron 内置 node 24.18.0 / ABI 145，与已装二进制匹配）。实测可用，不必关应用。
- **只读排查作者库**：必须连 `-wal`/`-shm` 一起复制（否则误判"没落库"）；现场 = `每天第一句谎话都会成真\.ai-novel\project.db` + `debug\prompt-trace\`。
- **改动 `src/` 非组件模块或模板后必须重启 `pnpm dev`**，否则看不出效果。
- `main-generation-owner.test.ts` 整文件跑 ~137–139 failed 属**预存在环境噪声**（含 5000ms 超时类），判回归一律**同口径基线对照**。

---

## 5. 记忆位置

- 注入层：`.workbuddy/memory/MEMORY.md`（本会话已做**滚动迁移**：12,057 → 10,653 字节，红线 16 条与判据 ⑥–⑯ 一条未丢）
- 细节原文：`notes/prompt-engineering.md`（老陈案各节 + 语法容错 + 闸门可读性）、`notes/data-and-schema.md`（软删影响面）、`notes/env-and-conventions.md`（ABI 绕过法）
- 当日现场：`.workbuddy/memory/2026-10-15.md`（12 小节，含全部库级取证读数）
