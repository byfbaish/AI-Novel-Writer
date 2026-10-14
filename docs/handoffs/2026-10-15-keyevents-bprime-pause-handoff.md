# 交接：keyEvents 阶段 2 已落地 / 迁移段未开始（2026-10-15 03:15）

> **一句话**：阶段 1 → 段一（阶段 2）→ 阶段 2.5 实测**全部通过**；下一步是**唯一一次 schema 迁移**，清单已预置好，开工即可执行。
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

## 2. 下一步：迁移段（lane 六步，M08: 8 → 9）

**执行清单已写好，不用重新调研** → `docs/design/phase2-keyevents-bprime-implementation-plan.md` **§9**（含六步落点表、DDL、五条验收、以及迁移后段三/段二的顺序）。

要点：
1. **一次迁移做两件事**：`blueprints` 加 `structured_refs TEXT`（B′ 的 `spaceRefs`）+ 新表 `character_cast_decisions`（R6 锚点人物决定日志，append-only）。
2. 六步落点：`registry.ts` / `src/shared/project-storage.ts` / 新建 `electron/migrations/m08-*.ts` / `desktop-registry.ts` / `sqlite-project-migration.ts` 白名单 / **`baseline-schema.ts` 冻结**。
3. 参照实现 = `electron/migrations/m07-plot-structure-plan.ts`（幂等 apply + verify + createM07Migration）。
4. 验收第一条就用**作者库副本**跑升级，确认不报 `UNRECOGNIZED_SCHEMA`。
5. 迁移后：**先段三**（R6 管理面 + `declinedCandidateNames()` 改读新表 + 一次性回填），**后段二**（B′ 机读行 + `spaceRefs` + 同章内校验器 `space-time-consistency.ts`）。

---

## 3. 未决 / 待作者定

| # | 事项 | 状态 |
|---|---|---|
| 1 | **R6 命名** | 建议「锚点人物（不建卡）」；作者已同意（2026-10-15 03:00 前拍板），实现时照此写 UI |
| 2 | **复活 vs 孪生**（R6 验收点 5） | 建议「复活 = 复用原 `character_id`」；**实现前需最后确认一次**（设计稿 §9.7 验收点 5） |
| 3 | `legacySourceHashMatches` 是否收紧 | 阶段 2.5 之后的标定项，未动 |
| 4 | 阶段 2.5 严格闭环 | ch6 估算 2550 vs **其真实正文**——写 ch6 时回填对比（并行观察项） |
| 5 | backlog P6（伏笔/线索一次只能选一章） | 已登记 `docs/plans/prompt-assembly-backlog.md`，等作者定档位 |

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
