# 项目文档 · 唯一入口

> **找文档只看这一页。** 本页给出「想干什么 → 打开哪个文件」的完整索引、每个目录的职责边界，以及**新文档该放哪里**的硬规则。
> 更新：2026-10-24 · 分支 `exp/resource-ledger`
> **开工前先读**（新会话 / 新任务）：根目录 `AGENTS.md`（常驻宪法，**≤60 行 且 ≤4,500 字符**）→ [`agents/documentation-charter.md`](agents/documentation-charter.md)（文档纪律、四层模型、完成定义、**§12 规则分档**）。本页只做**索引**，不复述纪律。
> 上一版入口是 [`plans/00-OVERVIEW.md`](plans/00-OVERVIEW.md)（2026-10-11 历史看板，已冻结，只作存档）。

---

## 0. 一句话地图

```
docs/
├── design/      ★ 现行设计 + 实施记录（唯一活跃设计区）
│   ├── prompt/         Prompt 流水线（组装 / 作用域 / 去重 / 缓存 / 追踪）
│   ├── architecture/   架构五层 / 故事弧 / 阶段结构 / 一致性校验 / 蓝图结构
│   ├── review/         审稿链
│   ├── characters/     角色卡、roster 同步
│   └── features/       设置包、作者操作手册等
├── plans/       🔒 台账 + 冻结合同（只读：唯一 TODO 台账 + Program v3 冻结包）
├── research/    🔒 研究、外部材料消化、实施证据（含被脚本引用的冻结证据）
├── adr/         ✅ 架构决策记录（编号连续，只增不改）
├── agents/      ✅ 交付与协作规则
├── handoffs/    ✅ 跨会话交接快照（日期化）
└── experiments/ ✅ 实验记录
```

**两句话记住边界**：

1. **要改代码的方案 → `docs/design/`。** 不再往 `docs/plans/` 里写设计稿。
2. **`docs/plans/` 与 `docs/research/` 里带 `novel-quality-*` 前缀的子树是冻结证据**，被 `scripts/__tests__` 与 `donor-delta.json` 按路径引用，**不得移动、改写、改名**。

---

## 1. 我要找什么 → 打开哪里

| 你想… | 打开 |
|---|---|
| 知道某功能**为什么这么设计** | `docs/design/<主题>/…-design.md` |
| 看某设计**做到哪一步**（实施没 / 卡在哪） | 该设计稿头部的 `> 状态：` 行 —— 状态只改这一行，不新建文件 |
| 找**接下来做什么**（TODO） | [`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md) ← **唯一台账** |
| 查 **Prompt 组装 / 材料准入 / 去重 / 缓存** | [`design/prompt/`](design/prompt/) |
| 查 **架构五层 / 故事弧 / 阶段结构 / 一致性校验** | [`design/architecture/`](design/architecture/) |
| 查 **审稿链**（材料去重、目标准入、序数断言） | [`design/review/`](design/review/) |
| **行业对齐 / 阶段目标（W7 · W8 · S×5）** | [`design/architecture/industry-alignment-and-stage-goals.md`](design/architecture/industry-alignment-and-stage-goals.md) —— **写任何设计稿前先读 §5 的四问**；写/改 prompt 条款前先过三问 → [`design/prompt/prompt-clause-admission.md`](design/prompt/prompt-clause-admission.md) |
| 查**已定的、不可逆的决定** | [`adr/`](adr/) |
| 查**为什么没采纳某方案** | `design/<主题>/…-assessment.md`，或 `research/` |
| **评估外部 agent-skill 流水线包**（oh-story v0.9.0 吸收评估） | [`research/2026-10-25-oh-story-absorption/`](research/2026-10-25-oh-story-absorption/) —— 结论：**它强在文本质检、弱在连续性**，与我方互补；**A2/A3/A4/A5 全部已实施**（§9 与 §9b）、A1 降级、C1–C8 刻意不为 |
| **看同题材竞品**（墨枢 Moshu 对照评审） | [`research/2026-10-30-moshu-competitor/`](research/2026-10-30-moshu-competitor/) —— 结论：**它是参照系不是威胁**；两边把长篇失败归因到不同地方（它=记不住→claim+七类规则，我方=撑不住→弧光+角色可判定），**只取 3 个机制**（世界状态审计员 / 章内局部去重 / 证据锚点契约写法），9 成服务端基建刻意不为；含三条警告（文档密度≠交付密度、它有一份可抄的诚实文档制度、别把我方先进当默认正确） |
| **重校「AI 味」阈值要怎么找语料** | [`research/2026-10-25-threshold-calibration-corpus/`](research/2026-10-25-threshold-calibration-corpus/) —— 起点 3 条合法来源（全限非商业）· **番茄零** · 书面许可边界与「内主外辅」校准路径 |
| **研究「AI 味」怎么量、怎么降**（课题 A-1） | [`research/2026-11-04-ai-flavor-measurement-and-intervention.md`](research/2026-11-04-ai-flavor-measurement-and-intervention.md) —— 检测侧三世代（perplexity+burstiness → 分类器 → 水印）· **检测 ≠ 质量**（2023 Stanford：非母语作文平均 61% 被误判为 AI，而它们困惑度更低）· RQ1 可观测性 / RQ2 基线 / RQ3 干预 · 四阶段（对齐 → 基线 → 困惑度可行性裁定 → 单变量对照）· **不把困惑度当目标、不追骗过检测器、不做词表拦截**；台账见 `plans/prompt-assembly-backlog.md`「2026-11-04 研究课题 A-1」，看板容器卡 `b2ac48ca`；**指标对齐表已产出** → [`research/2026-11-04-ai-flavor-indicator-map.md`](research/2026-11-04-ai-flavor-indicator-map.md)（检测 6 项 × 创作 4 条 × 四列，2026-11-05） |
| 查 **Program v3 原始合同 / 审计证据** | `plans/novel-quality-*/`、[`research/novel-quality-modernization/`](research/novel-quality-modernization/) 🔒 冻结 |
| **问「这套工作流能写哪些题材」**（市场边界估算） | [`research/2026-10-28-platform-genre-coverage-bounds.md`](research/2026-10-28-platform-genre-coverage-bounds.md) —— 番茄主分类 + 起点 14 类 · **九槽判定** · A/B/C/D 四档（A 原生约 30%、D 骨架冲突约 35%）· 结论：**结构层通用、素材层不通用**，扩展应沿素材层做 |
| 接手别人的会话 | [`handoffs/`](handoffs/) —— **最近一份**：[`handoffs/2026-11-12-workbuddy-landing-click-fix.md`](handoffs/2026-11-12-workbuddy-landing-click-fix.md)（**WorkBuddy 落点点击修复 + 跨空间往返实机验证**：`+` 开草稿从坐标点击改页面内 DOM click（坐标在可滚动侧栏会静默点空），补「新草稿证据」与 `sessionId` 精确点卡片；三段往返 wt-2 → develop → wt-2 全部 `[ok] 落点已证实`、无提权框 ⇒ 顺带证明「WorkBuddy 进 develop」可行；单测 47→57，**未提交待复核签字**；含 5 条已知限制与复现命令）；上一份：[`handoffs/2026-11-11-night-batch-digest.md`](handoffs/2026-11-11-night-batch-digest.md)（**11-11 夜班收口**：40 卡 = 26 done / 14 未结算，04:18 停摆于 Lead 实机段整段未启动；已把可信成果收进 develop 工作区并复跑 —— `batch-completion` **17/17**、`generation-run-service` **43/43**、`check:fast` 全绿；**B11 方案 A 实测无效已回退**、`2 failed / 835 / 837` 判定线本身无实测出处；含 7 项待裁 + 未验证事项清单 + 合并口径提醒）；上一份：[`handoffs/2026-11-10-r2-fixtures-and-verification-handoff.md`](handoffs/2026-11-10-r2-fixtures-and-verification-handoff.md)（**R2 存量红收尾 + 验证清单**：W3 合并（`4184cae1`）+ R2-A/R2-B 落主线（`9c3c913c`/`7a800313`），browser 30 failed 预期收敛到 2（B11/B16 待实机判定）；含可直接照抄的三阶段验证命令、判定纪律、回滚点，以及 A1/W1/W4 三项悬留裁定）；上一份：[`handoffs/2026-11-10-night-closeout-and-next-steps-handoff.md`](handoffs/2026-11-10-night-closeout-and-next-steps-handoff.md)（**11-09 夜班四条线收尾**：D21/D3 双双转 ✅（修法 C + A2 五条实机全绿 + 两闸门顺序有结论）、D10 的 `SYSTEM_NOTICE` 桥接实机验过（含顺手修掉 Toast 首条静默丢弃）、browser 最后一条 D19 陈旧断言清掉 —— 基线比对 31→30 failed 零新增；**核心是 §二「接下来能做的」三层清单**，最该先做 A1 正文批量重跑：卡两周的唯一阻塞 D12 已结案，但 9B 复现率约 50% ⇒ 判据要先请作者拍「换模型还是放宽到 ≥2/3」）；上一份：[`handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md`](handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md)（**DSH 无头首仗不合格**：虚报单测通过（缺 vitest 导入 + C 风格隐式字符串拼接，一行跑不起来）、越界建 6 个自证文件、免费模型额度耗尽 ⇒ 实测「只回复两个字」也失败；Lead 修 6 处后 8/8 通过 → `wt-3` 未接线未提交。同稿：豆包 D 系列 21 行对账（抽查 3 条行号全对，发现 backlog D 段是冻结快照、B 类互斥 9 条）· 批量中断无续跑路径设计稿（读码定位、未实机）· 五处脏状态与四项待裁定；**2026-11-09 夜跑**（13 张定时卡：WB 6 + 豆包 6 + 07:00 WB 干净会话复核）→ 仅 W3/W4 可合并、W1 打回（断章卡死）、W2 BLOCKED、W5 需追认，汇总见 [`handoffs/2026-11-09-night-batch-digest.md`](handoffs/2026-11-09-night-batch-digest.md)、八项台账裁定见 [`handoffs/2026-11-09-eight-rulings-brief.md`](handoffs/2026-11-09-eight-rulings-brief.md)）；上一份：[`handoffs/2026-11-08-d12-closeout-small-model-weakness.md`](handoffs/2026-11-08-d12-closeout-small-model-weakness.md)（**D12 结案**：定性为 9B 模型固有弱点、非 App 缺陷 —— 拔掉全部护栏的直连复跑 10 次 = 干净 3 / 重演 5 / 失控 2，与 App 内 4+4 同量级；锚点保留且「必要不充分」、B1 不回滚；含四层排除证据、遗留五项、复现三坑、**工作区未提交改动的三组归属**）；上一份：[`handoffs/2026-11-07-d12-replay-live-verification.md`](handoffs/2026-11-07-d12-replay-live-verification.md)（**R6 上线后仍是 4 次全灭**：短细纲 4/4 写对、正文 4/4 复述，第 2 章 0 次落库）；上一份：[`handoffs/2026-11-06-d8b-checkpoint-cleanup-handoff.md`](handoffs/2026-11-06-d8b-checkpoint-cleanup-handoff.md)（**D8b 收口**：未落稿生成物不再被当正式产物守护、卷单元模式下中继续写入口整块静默，Agent 用 CDP 真点 APP 复验通过；含四条作者原话订正 + 四条已登记未处理边界）；上一份：[`handoffs/2026-11-05-d20-d13-defects-handoff.md`](handoffs/2026-11-05-d20-d13-defects-handoff.md)（**D 系列晚间班**：D20 模板指纹误报已落地并合并、D20b 收窄在 wt-1 进行中、D13 失败契约稿已出三条待裁、六条裁定原文口径、八条环境陷阱）；上一份：[`handoffs/2026-11-05-five-hour-agent-run.md`](handoffs/2026-11-05-five-hour-agent-run.md)（**五小时联动 WorkBuddy + 豆包**：6 张 A-1 卡复核落 Done、能力画像写入手册、keyEventsText 缺口已开卡）；再上：[`handoffs/2026-11-02-d14-volume-structure-sync-handoff.md`](handoffs/2026-11-02-d14-volume-structure-sync-handoff.md)（**D14 卷结构自动同步**：A 两步自动已落地 + 实机复验含历史回填、B 缺口提醒只差第 10 章、新登记 D17「大纲提交不记覆盖章区间」、脏状态分组）；上一份：[`handoffs/2026-11-01-invalidation-line-closeout.md`](handoffs/2026-11-01-invalidation-line-closeout.md)（**上游失效线收口**：P2-3 全线落地、schema 29，含「新加一列算不算内容」三处黑名单、既有红归因、三条已裁定别再讨论、下一步三候选）；再上：[`handoffs/2026-10-31-phase3-unattended-handoff.md`](handoffs/2026-10-31-phase3-unattended-handoff.md)（期 3a 无人值守作业手册）· [`handoffs/2026-10-30-invalidation-and-deletion-baseline.md`](handoffs/2026-10-30-invalidation-and-deletion-baseline.md)（删除/失效机制盘点：**上游重建不触碰任何下游表**，含删除收据 `keep_draft` 落点清单）；**2026-10 月交接稿分流（2026-11-09 作者裁定）：21 份已归档，全量清单见 [`handoffs/archive/README.md`](handoffs/archive/README.md)（归档不等于删除，链接照常可点）· 另 7 份仍被现行工作依赖，留在 `handoffs/` 根目录，依赖位置见清单 §3** |
| **写 / 调 DSH 插件翻车了**（启动即崩、卡片不出现、投递不触发、改名后不加载、发版坏 tag） | [`design/harness/dsh-plugin-pitfalls/`](design/harness/dsh-plugin-pitfalls/README.md) —— 24 条真实事故，**按现象关键词查**再点进正文；索引件在 `README.md`，四棵树按加载 / 设置与依赖 / 取证 / 发版分。有意不进 `AGENTS.md`（受容量硬顶），入口只在这里与 §4.7 |
| 发布 / 交付 / 审查流程 | [`DEVELOPMENT.md`](DEVELOPMENT.md) · [`agents/delivery.md`](agents/delivery.md) |
| **把活派给 Copilot CLI**（无头、另一进程、可校验副作用） | [`agents/copilot-channel.md`](agents/copilot-channel.md) —— 落点/PATH · 参数速查 · 权限模型 · 工具别名 · 已验证与未验证清单 |
| **把活派给 WorkBuddy**（桌面 UI 走 CDP；用它的客户端积分） | [`agents/workbuddy-channel.md`](agents/workbuddy-channel.md) —— Debug 环境变量起法 · `workbuddy-attach.mjs` 命令与退出码 · 模型策略（Hy4 夜间 / DeepSeek 平峰 / 高峰拒派）· §9 headless 兜底已移除 · **§11 社区方案取舍** · 失效判据 |
| **把活派给豆包电脑版**（桌面 UI，只能 CDP 驱动；用它的客户端积分） | [`agents/doubao-channel.md`](agents/doubao-channel.md) —— Launcher 吞参数真相 · 独立 profile 起法 · `doubao.mjs` 命令速查 · §5 跨 Agent 红线 |
| ~~把活派给 DeepSeek Harness~~（**2026-11-09 退役：DSH 升为中控**，人直接在 `develop` 跟它对话；`wt-3` 已清空） | [`agents/dsh-channel.md`](agents/dsh-channel.md) —— **保留为历史记录**：`dsh-task.mjs` 命令与退出码 · `--patch` 锁模型 · §7 已验证/未验证 · **§11 退役记录与三条首仗教训**（无头完成声明不可采信 / 禁自证文件 / 免费额度墙） |
| **让外部 agent 自己来认领看板任务**（同机、拉取式、干完交 review 不自结算） | [`agents/task-board-channel.md`](agents/task-board-channel.md) —— `dsh-task-board` CLI/MCP · 发布约定 · 各 harness 接入片段 · 退出码与让位规则 · **§5.1 禁自结算** |
| **多 agent 并行改代码**（worktree 隔离 / 端口写死 / Master 合并） | [`agents/worktree-parallel.md`](agents/worktree-parallel.md) —— 槽位表（5180/9222 · 5181/9223 · 5182/9224 · 5183/9225）· **§3.1 固定归属**（develop=中控 DSH · wt-1=豆包 · wt-2=WorkBuddy · wt-3=空闲待回收）· 三条隔离机制 · 禁 `test:node` 等红线 |
| **放文档 / 归档文档 / 判断该不该新建一份** | [`agents/documentation-charter.md`](agents/documentation-charter.md) —— 四层模型 + 单一事实源 + 完成定义 + 反例库 + **§12 规则分档** |
| **查某条规则还失效吗 / 它凭什么占注意力** | [`agents/rule-registry.md`](agents/rule-registry.md) —— 40 余条规则逐条登记档位（T0/T1/T2/T3）· 失败形态 · 触发时机 · 闸门有无 · 5 条闸门缺口 |
| **要跑某个构建/验收/运维脚本，或想知道「改完这个该跑什么」** | [`../scripts/README.md`](../scripts/README.md) —— 按用途分类 + 「何时跑」+ 谁调用（npm script / CI / 手工） |
| 产品术语 / 事实源边界 | [`product-domain.md`](product-domain.md) |
| **这工具该为谁做、什么算写得好**（定位空白 + 五份评估稿导航） | [`design/product/writing-capability-assessment.md`](design/product/writing-capability-assessment.md) —— 定位只写了形态没写价值；`目标用户`/`用户画像` 全库 0 命中；「写得好」缺位是 C8 与 A1 降级的共同根因 |

---

## 2. 目录职责（含冻结标记）

| 目录 | 职责 | 状态 | 能新增吗 |
|---|---|---|---|
| [`design/`](design/) | 所有**现行**设计稿、评估、实施记录，按主题分子目录 | ★ 活跃 | ✅ 新设计一律放这里 |
| [`plans/`](plans/) | ① 唯一 TODO 台账 ② Program v3 冻结合同 ③ 历史看板 | 🔒 除台账外冻结 | ⚠️ 只往台账追加；**不新增设计稿** |
| [`research/`](research/) | 外部材料消化、实施证据、协议与证据索引 | 🔒 冻结（`novel-quality-*` 子树） | ⚠️ 新调研需独立文件名并登记来源 |
| [`adr/`](adr/) | 难以从代码恢复的架构决定 | ✅ 只增不改 | ✅ 连续编号 |
| [`agents/`](agents/) | Issue / 领域文档 / Agent 交付规则 | ✅ 活跃 | ✅ |
| [`handoffs/`](handoffs/) | 指定分支或任务的交接快照 | 按日期过时 | ✅ `YYYY-MM-DD-主题.md` |
| [`experiments/`](experiments/) | 实验执行说明与回执 | 按日期 | ✅ |

> **编号勘误（2026-10-18 登记）**：`adr/0018-module-ownership.md` 与 `adr/0018-program-v3-domain-contracts.md` 为历史重号——后者实际接续 0017、先于 0019 定稿，引用时请以**文件全名**为准，不要凭编号猜测。因冻结子树 `research/novel-quality-modernization/`（`current-spec-index.md`、`evidence-index.md`、`s01-evidence.md`）按字面路径引用这两个文件名，**暂不改名**；后续新 ADR 从 **0021** 起连续编号。

---

## 2.5 文档纪律（2026-10-23 作者要求，硬性）

### ① 改代码必须同步改文档（同一提交内）

| 改了什么 | 必须同步 |
|---|---|
| `src/` / `electron/` 的**行为或契约**（字段、错误码、状态机、判定条件） | 对应设计稿的 §落地记录 + 头部 `> 状态：` 行 |
| **推翻了既有决定** | 新增一条 ADR（只增不改），并在被推翻的文档里打作废标记 + 指向新 ADR |
| 收口一期 | **所有写着该期状态的位置**都要改（顶部状态行、分期表、台账、交接稿）—— 2026-10-22 的教训：只改了顶部，路线图表格没标 ✅，读者以为没做完 |
| 新增 TODO / 缺陷 | 只往 [`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md) 追加，不另建台账 |
| 提交前 | `node scripts/check-doc-links.mjs`（断链不许进主线） |
| 提交前（**新增 2026-10-23**） | **跑受影响的测试文件，不只是改动所在模块的测试**。反例：给生成链加了一个 IPC 调用，却只跑了那个 IPC 的测试 ⇒ `generate-draft.command.test.ts` 51 例红了整个批次，靠下一位施工员发现。`tsc` 通过不代表测试通过 |

### ② 图：用 Mermaid，一图配一句读法

- 流程图/状态机/时序图一律用 ` ```mermaid ` 代码块（GitHub / VS Code / Typora 可直接渲染），不贴截图（无法 diff、无法维护）。
- **每张图下方给一句"一句话读法"**，保证纯文本阅读器里也知道图在说什么。
- 已有示例：`design/architecture/long-form-readiness-review.md` §1（生产链路 + 卡点）、`adr/0021`（定稿状态机）。

### ③ 归档：过期就移走，别让它拖慢查阅

| 判定 | 动作 |
|---|---|
| 被新稿**取代** | 移到 `docs/design/archive/`，原位置留一行指针 |
| 交接快照**超过 30 天**且无新会话引用 | 移到 `docs/handoffs/archive/` |
| 已完成且**不再被任何文档引用**的计划/评估 | 移到 `docs/design/archive/` |

**不能归档**：`docs/adr/`（只增不改）、`docs/design/` 的**现行**设计稿、`plans/` 的唯一台账与 `novel-quality-*` 冻结子树。
**迁移必须改引用**（相对路径会变），迁完跑 `check-doc-links` 兜底。

> **2026-10-24 补注**：`docs/design/archive/` 此前只在本节被引用，**目录并不存在**（相当于空文）。现已建立，含一份说明性 README；`docs/handoffs/archive/` 早已存在。归档四步见 [`agents/documentation-charter.md`](agents/documentation-charter.md) §5.3。

---

## 3. 新文档放置规则（写之前先读这一节）

### 3.1 判定口诀（按顺序问）

1. **它会改代码或改产品行为吗？**
   → 会：`docs/design/<主题>/<编号>-<主题>-design.md`
   → 不会、只是看清现状 / 对比外部方案：`docs/design/<主题>/<主题>-assessment.md`
2. **它只是一条待办？** → 追加到 [`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md)，**不要新建台账**。
3. **它是一个不可逆的架构决定？** → `docs/adr/`（连续编号；进度和待办不写进 ADR）。
4. **它是外部报告 / 调研回执？** → `docs/research/`（保留来源、采集时间、适用边界）。
5. **它是一次跨会话交接？** → `docs/handoffs/YYYY-MM-DD-主题.md`（注明分支、基准 SHA、脏状态、未验证事项）。

### 3.2 硬规则

1. **不往 `plans/` 新增设计稿。** 2026-10-17 起 `plans/` 只保留台账与冻结合同；此前散落在 `plans/` 的设计稿已迁到 `design/<主题>`。
2. **冻结子树不得移动或改写**：`plans/novel-quality-modernization/`、`plans/novel-quality-program-2026-09-13/`、`plans/novel-quality-program-v3-2026-09-13/`、`research/novel-quality-modernization/`。
   原因：`vite.config.ts:89` 把 `**/docs/plans/**` 从 vitest 排除（冻结规划脚本自行执行），且 [`donor-delta.json`](research/novel-quality-modernization/donor-delta.json) 等证据文件按字面路径引用其中的 `.md`。
3. **每份设计稿头部必须有状态行与日期**：
   `> 状态：待裁定 / 已裁定 / 已实施 / 已搁置（原因）/ 已结项` + `> 日期：YYYY-MM-DD`。
   **状态变化只改这一行**，不新建文件；实施记录写在同一文件的「实施记录」章节。
4. **上位稿 / 子稿关系写在头部**：`> 上级稿：`docs/design/prompt/xxx-design.md` §…`。设计是树，不是散点。
5. **相对链接必须能点开**。提交前跑：

   ```bash
   node scripts/check-doc-links.mjs
   ```

6. **不复制** API Key、模型凭据、小说正文、用户目录、可再生构建输出。

### 3.3 命名约定

| 类型 | 命名 | 例 |
|---|---|---|
| 设计稿 | `<编号>-<主题>-design.md` | `p7-review-material-dedup-design.md` |
| 评估 / 否决记录 | `<主题>-assessment.md` | `seven-layer-skeleton-assessment.md` |
| 操作手册 / 草案 | `<编号>b-<主题>-guide.md` | `p1-2b-settings-period-authoring-guide.md` |
| 交接 | `YYYY-MM-DD-<主题>.md` | `2026-10-23-w6-and-w8-handoff.md`；过期移入 `handoffs/archive/` |
| ADR | `NNNN-<slug>.md` | `0020-legacy-project-copy-import.md` |

---

## 4. 现行设计索引

> 完整索引即本节。**这是查找设计文档的唯一清单**，不要再去翻目录树。

### 4.1 Prompt 流水线 · [`design/prompt/`](design/prompt/)（38 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`prompt-payload-scoping-design.md`](design/prompt/prompt-payload-scoping-design.md) | ★ 上位稿 | 全链路 Prompt 载荷作用域（材料白名单）；P0/P1 系列的总纲 |
| [`chapter-prompt-pileup-triage.md`](design/prompt/chapter-prompt-pileup-triage.md) | 诊断 | 章节链路「一锅乱炖」逐条判定，payload 设计的前置 |
| [`p1-literal-dedup.md`](design/prompt/p1-literal-dedup.md) | ✅ 已完成 | 单次请求内逐字重复消除（D1 收敛 2/2→1/1） |
| [`p3-semantic-dedup.md`](design/prompt/p3-semantic-dedup.md) | 🏁 已关闭 | 语义去重；收益仅 2.8–4.7%，仅采纳提示词替代方案 |
| [`p4-prompt-config-merge.md`](design/prompt/p4-prompt-config-merge.md) | ⏸ 待做 | 提示词配置整合（AI 优化 → diff → 人工确认） |
| [`p4-reassessment.md`](design/prompt/p4-reassessment.md) | 结论 | P4 是否还有必要；原形态取消 |
| [`p0-0-upstream-projection-design.md`](design/prompt/p0-0-upstream-projection-design.md) | ✅ 已实施 | 上游章级投影 |
| [`p0-1-short-outline-scoping-design.md`](design/prompt/p0-1-short-outline-scoping-design.md) | ✅ 已实施 | 短细纲只喂该步材料（16.7k 字 → 单步材料） |
| [`p1-1-boundary-notice-design.md`](design/prompt/p1-1-boundary-notice-design.md) | ✅ 已实施 | 后续计划降级为「本章不可写事件」清单 |
| [`p1-2-architecture-projection-design.md`](design/prompt/p1-2-architecture-projection-design.md) | ✅ 已实施 | `architecture` 对正文只给事实源 |
| [`p1-3-variable-export-scoping-design.md`](design/prompt/p1-3-variable-export-scoping-design.md) | 部分落地 · 待裁定 | L1 变量出口语义化（`acceptsScopes` / `enforceRequiredContext`） |
| [`free-text-scoping-design.md`](design/prompt/free-text-scoping-design.md) | ✅ 已实施 | 自由文本按步骤分区（参考作品落点 + `global_guidance` 分区） |
| [`short-outline-first-failure-retry-design.md`](design/prompt/short-outline-first-failure-retry-design.md) | ✅ 已实施 | 短细纲首次失败自动重试 |
| [`outline-setting-compatibility-guard-design.md`](design/prompt/outline-setting-compatibility-guard-design.md) | 待裁定 R5 | 大纲/蓝图层「设定相容性」守卫 |
| [`outline-structure-marker-assessment.md`](design/prompt/outline-structure-marker-assessment.md) | 评估（替代已实施） | 大纲要不要加「标记行」；诊断对、处方错层 |
| [`global-guidance-scope-lint-design.md`](design/prompt/global-guidance-scope-lint-design.md) | ⏸ 搁置 | 全局写作要求章节越界静态校验（作者裁定不进框架） |
| [`refine-chapter-base-alignment-design.md`](design/prompt/refine-chapter-base-alignment-design.md) | ✅ 已实施 | 精修基座定位失准（三方指令打架 / 同源摘要 27%）重构为「改写动作 + 不可动边界」 |
| [`contract-first-reassessment.md`](design/prompt/contract-first-reassessment.md) | 存档 | 《全链路 Prompt 架构重构评估》复核；结论已折进上位稿 |
| [`prompt-cache-evaluation.md`](design/prompt/prompt-cache-evaluation.md) | ⏸ 挂起 | 提示词缓存命中率评估 |
| [`debug-prompt-trace-design.md`](design/prompt/debug-prompt-trace-design.md) | 设计稿 | Debug 开关：Prompt 片段追踪 + 输入输出落盘 |
| [`prompt-trace-output-sample.md`](design/prompt/prompt-trace-output-sample.md) | 样本 | 真实生成数据的 Prompt 组装快照 |
| [`p8-fanqie-flavor-draft-quality-design.md`](design/prompt/p8-fanqie-flavor-draft-quality-design.md) | ✅ P1 生效 · ⏳ P2/P3 待复验 | 番茄向正文质量闸门：续写判定接回合格线 / 可判定 AI 味禁令 / 番茄 KPI 落点（§10 复验 #1） |
| [`p9-platform-style-layer-design.md`](design/prompt/p9-platform-style-layer-design.md) | ⏸ 待裁定 | 平台文风层：用写作 Skill 承载平台口味，`.vela-pack` 加 platform 字段，按平台选择加载 |
| [`p14-chapter-role-guidance-design.md`](design/prompt/p14-chapter-role-guidance-design.md) | 待裁定 | 章节定位七档 → 本章「承担/不做」成对合同，落执行合同（system），未知零字节 |
| [`prompt-clause-admission.md`](design/prompt/prompt-clause-admission.md) | ✅ 已生效 | 条款准入三问（作者要它时是否仍成立 / 合法反例 / 限定词）+ 反例库 |
| [`prompt-three-layer-inventory.md`](design/prompt/prompt-three-layer-inventory.md) | ✅ 已入库 + 测试锁定 | **Prompt 三层全景清单**（系统级 19 处 / 工程级 30 模板含**真实消费方**列 / 作者级 8 类 / **20 条装配链路** / 覆盖矩阵 A·B·C / 缺口 G1–G10）。三个测试断言把"不必全量重扫"变成机器保证 |
| [`prompt-three-layer-alignment-assessment.md`](design/prompt/prompt-three-layer-alignment-assessment.md) | 📝 待裁定（2026-10-24） | **工程侧**行业对标：三条锚点带 URL + 逐字摘句，12 行逐条对照（✅6/⚠️5/❌2）。结论：**工程侧基本对齐，三处口径没对齐**（层级被抹平 / 同层无冲突规则 / 作者可调高度被锁死），本轮不动任何文案；附创作自由度三条准入线 |
| [`worldbuilding-capacity-and-stage-cost-design.md`](design/prompt/worldbuilding-capacity-and-stage-cost-design.md) | ✅ 已落地（2026-10-27） | 世界观第 1 维补「容量 / 阶段性代价」两格：缺口是**设定缺口**不是记述漏洞；实测分档内容进规则精选但只认带模态词的档（capacity / escalating cost / legibility，Sanderson 第二定律对照） |
| [`choice-source-and-elimination-design.md`](design/prompt/choice-source-and-elimination-design.md) | ✅ 已落地（2026-10-28） | 选择行改**力源四面 + 元层两个例外**（4+2）：六词横跨五个面是一维枚举的 category mistake，不是粒度问题；写死淘汰顺序（Tversky EBA / Simon 满意化）让选择由角色做；判定句「否掉的理由指不回角色卡 ⇒ 模型替他选的」；`守` 防拖沓、`破` 防降神；蓝图侧改去枚举化 |
| [`author-persona-mode-design.md`](design/prompt/author-persona-mode-design.md) | 📝 提案，待裁定（2026-10-28） | **作者人格**（以性格驱动生成）：四层概念分离（文风 / 人格 / 全局要求 / 章级微操，现缺第二层）· 归因到 `writing_style` 的**明文降权句**（"仅用于选择表达方式，不是新增事实或事件要求"）· 数据模型（`decisionBias` 直引六选一）· 抽卡 · 优先级链 · **三条可判定验收（含"性格驱动 vs 禁令驱动"的分离测法）** · 三个待裁定分叉 |
| [`character-core-lie-design.md`](design/prompt/character-core-lie-design.md) | ⛔ 已部分推翻（2026-10-28） | **角色内核层**：动机 / 禁区 / 恐惧是**同一条 Lie 的三个投影**（禁区=保护它不被证伪的动作、恐惧=它被当众证伪的场面、动机=能证明它为真的目标）。保留三学科分层查证与机制下限；**落点被推翻**——作者裁定只要性格特征层，且按卷位移（见下一条） |
| [`character-disposition-state-design.md`](design/prompt/character-disposition-state-design.md) | ✅ 已落地（2026-10-28；**落点经下行勘误稿修正后**） | **性格即选择倾向，作卷级状态维护**：性格 = **if–then 响应函数**（CAPS，Mischel & Shoda 1995；「情境换了 then 跟着换，但对应关系是稳的」）· 成长 = **均值位移被登记**（WTT，Fleeson & Jayawickreme 2015）· 赫拉克利特断片 D119 出处考（daimon 取荷马「分得一份」义）· 三条判据 K1 可复现 / K2 有来处 / K3 **位移必须有后果** · 反滥用条款 · 主角 3–5 条 / 反派 ≥1 条 / `minor` 不写。**本稿按模板 `content` 落地的写法在架构链里是死信（实机两轮未生效），真实落点见下一行** |
| [`protagonist-golden-traits.md`](design/prompt/protagonist-golden-traits.md) | ✅ A+B 已落地（2026-10-29 凌晨；当日第三版实测后再收紧） | **金色词条：主角性格由作者覆盖，模型只演绎**：性格必须作者定（**功能约束**：没有突破因子的胆小鬼在那个世界活不过三章）· 题库只做**翻译**不做测量 · 查证魅力三刻度（proactivity / competence **under constraint** / 具体而克制的 vulnerability；"别追着 likable 跑"）· 两类主角的闪光点（李长寿：「仅有稳健撑不起 300 万字」+「'苟'不是目的是手段」+「稳到最后稳不住」（作者言归正传访谈）；石昊/叶凡/萧炎：豪横与腹黑的落点都是"护住身后"）· **金色词条 = 矛盾结构**：底色 + **破例条件** + 不可让渡（+ 代价）· **编号是条目号、档位是方括号标签**（〔日常〕〔代价〕〔破例〕，破例恰好一条）· 零迁移映射到 `personality`/`motivation`/`arc`。**2026-10-29 第三版实测三错并补五道闸**：禁本书专名（换世界要听懂）／〔破例〕必须与〔日常〕**反方向**（"日常+更用力"不算）／〔破例〕位移右端**必须就是它自己的倾向**／〔破例〕局面他**极少遇到**／位移是**条件**不是程度 |
| [`golden-trait-experiment-manual.md`](design/prompt/golden-trait-experiment-manual.md) | 🆕 可用（2026-10-29） | **实验手册：可交给任意大模型独立复现，不需要本项目上下文**。四层串行验收（L0 可复现 → L1 区分度 → L2 反身性 → L3 一致性）· 三张**信息量相同、只差组织形态**的人物卡（无样例 / 范例 / 范例+编号）× 20 章固定处境序列（第 11·12 章重复第 8·6 章测反身性，第 14 章测泛化，第 17·18 章测一致性）· 手工可算的四张判定表 · **五条已知陷阱**（`presence_penalty=1.5` 是抖动主因，关闭后方向稳定 3/20→15/20 ／ 稳定与塌缩是一体两面 ／ 编号会被滥用成万能答案 ／ 无样例时模型会自创设定并逐章漂移 ／ 上下文不是瓶颈，实测仅 349–509 token）· 结果回填模板。脚本版 `scripts/experiments/golden-trait-minimal-loop.mjs`（`--round2` `--group` `--seed` `--temp` `--pp` `--ctx`） |
| [`character-event-types-draft.md`](design/prompt/character-event-types-draft.md) | 🆕 草案（2026-10-29） | **处境类型库草案（期 3：只出方案，未落代码）**——给第三层「各类事的做法」里的"各类"一个有限清单，也是期 2「定性：」行的归类对象。四问：① 粒度（**一类 = 一个"要他付出什么"的结构，不是一个场面**；12 个候选，每个必配**反例**作护栏）② 来源（取卷纲节点，**不取正文**——正文无结构、事后判会抖动且循环依赖）③ 存放（**不进 DB**，放 `src/shared/` 冻结常量，与 `story-beats.ts` 同族；进 DB 要迁移且不可逆）④ 与策略的关系（**稀疏矩阵不是联合表**，角色卡只写发生变化的格）。⚠️ 定性行仍引用 `D<n>` 而非类型 ID；类型白名单校验不在本期 |
| [`d18-chapter-hook-contract-design.md`](design/prompt/d18-chapter-hook-contract-design.md) | ✅ 已实施（2026-11-04）· 文案已进模板；**C1/C1b/C2/C4 已接单元批、C3/C5 已接正文落盘/定稿（均只报不拦，C1 重跑权限未开）** | **章尾钩子合同**：**六值枚举**（`悬念截断`/`危机降临`/`信息炸弹`/`两难选择`/`情绪断裂`/`落点` —— **本项目操作化，不宣称行业标准分类**），第六值「落点」＝**过渡章／日常章的豁免出口**（行业：不是每章都要断章，但"什么都不留"也不行 ⇒ 换成"带走一件已经变了的事"；Swain：sequel 以决定收尾）；豁免有准入三条（前章是强钩／本章账已结清／**作者手标**，作者权最高且只报不改）、末章规则（**不再按位置禁类型**，改成"必须改变下一段的条件"）、**不做配额管理**（单元只有 3–10 章，⅓ 等于每三章一个落点；且配额按章数算而剧情不按章数走，高潮章撞上配额会被逼写成落点 —— 选哪类交给剧情）· **一行两段**（前半给读者＝类型＋**断点**——纸上一件具体事，**不出现问号、不点破人物疑问**（行业：no question is stated / 让读者自己问）；后半给下一章与校验＝种在哪）· **三级位置按模型在请求里实际能看到多少定规则**（单元内知下一章大纲／单元末知下一单元任务／卷末只知下一卷名）——**六类处处可选、由模型判**（给的是"被扣住的是哪一样"的操作准则，不给类型禁令）；单元末章的约束只有"**取材有据**"（别具名今天没给的人事物）——**章尾钩子不存在兑现难题**（兑现窗口就是紧邻的下一章，那一章必被写；兑现难题属**伏笔**系统，另议） · 蓝图 `suspenseHook` 是**锚点不是解释器**（同一件事／停在哪一帧／不许写出来的三样施工指令，删掉"更像一个问题"） · **钩子行是给模型的指令、不是给读者看的文本**（指令层有没有问号不重要，真正硬要求只在正文；禁问号只是防模型照抄）· 六条可机判（结构／版式／空钩外挂／**照抄＝正文末段与钩子文本比对**／落点自洽／**定稿侧未落地**），**只有格式缺失重跑，craft 判断只报不改**；C3/C5 **已用存量 10 章真实成稿标定**（20 组只第 6 章蓝图报 C5，其余零误报；C5 用"最长连续片段 < 3 字"而非共享实词数，输入取蓝图 suspenseHook） · **依据以中文网文为主**：空钩（换本书也成立＝空钩）／卡壳（次次只讲半句不是卡章）／横向钩（爽后抛新坑，外国 craft 无对应）／番茄 80% 弃文发生在章末／**段评是验收口径**（读者想不想在这段发段评）／AI 的说明书本能（因果分明、把结论摆明面）⇒ 真正要防的是"写得太明白"。**2026-11-04 三条补充裁定**：B 环节（蓝图自造设定）**不设判据**（根因＝输入材料冗余，先做 prompt 材料减法，实机验证后再定）· 「落点」**不改名**（同名源于旧弧光体系未剥离，剥离另立待办）· **主线之外不承诺钩子／伏笔的绝对兑现**（C5 只判当章闭环）。事故与实测出处见 `design/features/idle-guards-wiring-inventory.md` §6.4.1、§6.5 |
| [`character-behavior-four-layers.md`](design/prompt/character-behavior-four-layers.md) | 🆕 设计稿，待裁定（2026-10-29） | **角色行为四层：从「性格描述」到「可判定的人格」**——取代 `detailTask` 现有的「D1 日常 / D2 代价 / D3 破例」扁平三档。**四层**：① 在乎什么（底线排序，参照 **Schwartz 十项基本价值**，补锚点与 **Truby 的 psychological/moral weakness**）② 什么算一件事（**归章纲**，实测模型「不作为」最难生成）③ 各类做法（处境类型 × 策略两层相乘，**每条必须写「不适用」**）④ 具体动作（模型唯一职责）。**例外不是第四条策略**，是「该给的答案缺席的那一次」，必须挂到某一条底线上（v2 随意破 → 17/18 方向相反且错；v3 挂底线 → 两章都对）。**噪音**：代价不碰底线时允许「神经」，但**一致性的强度与价值项成正比**（底线必须一致、面子/好玩不必）。零 schema。实验依据 `scripts/experiments/` 400+ 条 |
| [`character-disposition-questionnaire.md`](design/prompt/character-disposition-questionnaire.md) | 📝 提案，待裁定（2026-10-28，**其"题库用途"已被下一行修正为翻译而非测量**） | **性格从哪来**：现行条款「局面必须本卷出现两次」把**因果链倒置**（未来剧情 → 性格），而性格底色来自**过去**、只决定未来的**倾向**；作者判断成立。业内四类方法（**SJT 情境判断测验**＝作者描述的那件事，但只有 behavioural-tendency 版测人格、knowledge 版测理想人格；Kohlberg 两难故事法「不问选什么问为什么」；D&D 九宫格只借两根轴不借标签；角色问卷是题型参考但最易 cookie-cutter）· 三个坑（产标签 / 题目与世界观不搭 / 把人拆成零件）· 提案：8–12 道前史两难题（四组轴对应下游力源）· 判据 J1 不含本作专有名词 / J2 至少 1 条对他不利 / J3 至少 1 对互相打架 / J4 至少导出两种力源 · 分两步（先改文本判据，后加阶段的题库） |
| [`previous-chapter-context-assessment.md`](design/prompt/previous-chapter-context-assessment.md) | 📝 待裁定（2026-11-01） | **上一章注入形态：全文本 vs「要点 + 末尾片段」**。实测：上一章全文 **1,741 字符**（短细纲请求占 **43.6%**、正文请求占 9.3%），章节要点 **946 字符**但进正文只剩 **584 字符 / 6 条**（`category` 白名单丢掉伏笔与角色动态）。行业三家（Re³ / NovelDreamer / dsh-novel-craft）都走「摘要 + 紧邻结尾片段」，但结论是**有条件成立**：先补要点通路（未完成动作、语气、6 条上限）再替换，且尾部片段宜 800–1,000 字而非 300 |
| [`character-dynamics-effective-site.md`](design/prompt/character-dynamics-effective-site.md) | ✅ 已落地（2026-10-28，方案甲；当晚二次收紧） | **角色性格倾向的实际生效点**：架构链「角色」步只读模板 `systemRole` + `taskGuidance`，**`content` 无出路**（`architecture.command.ts` 的 `creativeSystem` / `creativeGuidance` 两条赋值）；真正条款在 `prompt-language.ts` 的 `CHARACTER_ARCHITECTURE_PROMPTS`（中英各一套）· **120 字符是话术不是硬墙**（v2 解析不校验，模型照写所以被压缩）· 两轮白跑时间线 · **已落方案甲**：detailTask 加【主角的性格倾向】三行式 + 四条硬要求、`personality` 上限 120→400、测试锚定生效点 · **二次收紧**：「局面」必须写成**条件句**且含**当场要做的选择**（首轮实测写成"同门当众递状纸"这类具体事件；`personality` 会原样进 `characters_arch` 被大纲/正文读到 ⇒ 等于开第二个事实源） |
| [`chapter-prompt-block-ordering-design.md`](design/prompt/chapter-prompt-block-ordering-design.md) | ⚠️ B1 已落地（2026-11-08），**块序待重评**（见 `chapter-task-anchor-design.md` §5.3） | **正文 prompt 块序**：上一章正文全文从请求中段（实测 42.8%）挪到末尾 recency 区（实机 83.5%→92.3%，紧跟【本章篇幅合同】之前，全篇只出现一次），材料内容一字不改 · 材料包**出两版**（`text` 给续写/压缩，`textWithoutPredecessor` + `predecessorBlock` 给初始正文）· 豆包评审 16 条采纳记录在 §8（v1 有 4 处切块伪影，B4 整项撤销、B2/B3/B5 降级不进第一批） |
| [`chapter-task-anchor-design.md`](design/prompt/chapter-task-anchor-design.md) | ✅ 已落地（2026-11-08）· **判定「必要但不充分」，待裁是否回滚 B1** | **正文请求的显式任务锚点**：此前第 2 章请求里「第2章」出现 **0 次**、「第一章」6 次（来自覆盖层 taskGuidance），9B 把上一章整章重写（8-gram **98.2%**、最长连续 1,601 字）· 改法 = `chapter_number`/`chapter_title` 变量 + 内置首句中英双改 + 装配末尾 `chapterTaskAnchorText()`（**禁用「续写」二字**）· **实机 6 次**：无锚点 2/2 复述（86–98%），有锚点 4 次 2 通过（5.3%/6.5%）2 失败（57.5%/60.1%）⇒ 二值分布、未根治 · §3 记**覆盖层三处路径**与「看 trace `fragments.resolvedFrom`」判据 |
| [`prompt-block-order-audit.md`](design/prompt/prompt-block-order-audit.md) | 📋 审计（豆包产出，2026-11-08） | **正文 prompt 29 块横向审计**：只有一处结构性倒置（作者事实+世界观 3,644 字符落在指令区之后），挪回会推进 U 形中谷故**不建议挪**；可动仅两项 —— 输出格式↔AI 味反制换序（0 字符）、「本章写作方向+钩子」615 字符挪末段（**须先过照抄门槛**）；含「绝不能挪」8 条与照抄风险专项 |

### 4.2 架构 / 故事弧 / 一致性 · [`design/architecture/`](design/architecture/)（51 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`stage-structure-layer.md`](design/architecture/stage-structure-layer.md) | ★ 主文档 | 第五层「阶段结构」显现设计（施工图 + 6 步落地） |
| [`arc-nesting-design.md`](design/architecture/arc-nesting-design.md) | ★ 主文档 | 弧的层级/因果/篇幅语义规范（大弧⊃中弧⊃小弧） |
| [`story-arc-proposal.md`](design/architecture/story-arc-proposal.md) | v3 提案 | 故事弧环节设计演进记录（v1→v4） |
| [`arc-granularity-and-enum.md`](design/architecture/arc-granularity-and-enum.md) | 问答闭环 | 作者五问答复（步骤粒度 / 枚举降级） |
| [`arc-prompt-assessment.md`](design/architecture/arc-prompt-assessment.md) | 评估 | 弧生成 Prompt 外部报告；哲学吸收、手段拒绝 |
| [`arc-space-causal-state-feasibility.md`](design/architecture/arc-space-causal-state-feasibility.md) | 评估 | 弧/空间/因果/状态修订版落地可行性 |
| [`causal-vs-state-digestion.md`](design/architecture/causal-vs-state-digestion.md) | 判据 | 「能推理→prompt；不能推理→代码」 |
| [`state-tracking-assessment.md`](design/architecture/state-tracking-assessment.md) | 评估 | 13 类状态里只有「角色知识」是纯空白 P0 |
| [`seven-layer-skeleton-assessment.md`](design/architecture/seven-layer-skeleton-assessment.md) | 坐标系 | 七层骨架模型 L0–L6（与「五层架构」编号不同，见文内换算） |
| [`l3-arc-gap-verification.md`](design/architecture/l3-arc-gap-verification.md) | 定论 | 为什么剧情树/叙事线索都不构成 L3 |
| [`layered-generation-assessment.md`](design/architecture/layered-generation-assessment.md) | 评估 | 分层/增量生成；仅篇幅约束可采纳 |
| [`architecture-consistency-design.md`](design/architecture/architecture-consistency-design.md) | 评估（已进台账） | 五层一致性校验 → AC1/AC2/AC3 三段走 |
| [`ac5-numeric-resource-consistency-design.md`](design/architecture/ac5-numeric-resource-consistency-design.md) | ⛔ 部分否决 | AC5 数值一致性：**机读数值行已否决**，保留判据 CJ–CM 与覆盖版阻断项 |
| [`world-state-review-and-wiring-plan.md`](design/architecture/world-state-review-and-wiring-plan.md) | ⚙️ 已实施至 W5 | 世界状态：**状态已在库里、两条消费链都不读**（正文 `.withCharacterStates('')`、审稿只放行 `kind=author`）；W0 接线可证伪。**W0–W3 已完结 · W4a 流水线 + W5 只读视图已落地**；W4b 已移交 W6 · §19 一人多身份（未开工） |
| [`world-state-w4a-wiring-plan.md`](design/architecture/world-state-w4a-wiring-plan.md) | ✅ 已实施 | 上一稿的**施工子稿**：§11.7 五维齐备性检查 + W4a 三段流水线 + W5 视图一轮做完；含「先生成后 stage」裁决、偏差全表与验证命令 |
| [`w6-resource-ledger-design.md`](design/architecture/w6-resource-ledger-design.md) | ✅ 七期全落地（W7 未开工） | 资源账本（灵石案）：权威值 `resources` 表 · **生成期自检（防下一本，A-1/A-2 + B 层自审）** · 账本三态（已知/未知/冲突，未知不说 0）· 并入世界状态**第六类**（空间先占第五）；判据 **DI–DL**；§9.1–§9.3 是三波落地记录，§6.1 交代只覆盖六槽里的「资源」一半 |
| [`w7-world-state-injection-design.md`](design/architecture/w7-world-state-injection-design.md) | 📝 立项待裁定 | 世界状态**前置注入**（闭环的另一半）：最小集经作者材料块注入 · 卷切片复用 E4 三层投影 · 未知不填 0 · 注入即划期界；判据 **DM–DP** |
| [`p1-1-key-items-design.md`](design/architecture/p1-1-key-items-design.md) | ✅ 已落地（M14） | 关键物品宿体（possession continuity）：三件套 + 出处，不做枚举、不做余额 |
| [`p1-1-institution-cadence-design.md`](design/architecture/p1-1-institution-cadence-design.md) | ✅ 已落地（M15） | 制度槽（periodic obligations）：锚 = 上次真的发生，缺则 `unknown`，只判「该不该发生」 |
| [`p1-1-knowledge-state-design.md`](design/architecture/p1-1-knowledge-state-design.md) | ✅ 已落地（M16） | 信息流（who knows what）：人粒度，只做正向知情，不做 C1 身份分面 |
| [`p1-1-knowledge-scope-and-awareness-design.md`](design/architecture/p1-1-knowledge-scope-and-awareness-design.md) | ❌ 撤回扩展 · ✅ 修两处 | **不做全集/差集/程度/势力层**（行业只记「承重事实」，模板四列且**无「程度」列**）⇒ 主线机密归 M21。**已修**：① 裁剪单位从「行」改成「事实」（旧的按行切 + 封闭默认会把「知道」静默翻成「不知道」）② `secrets` 不再把「角色知道了但没写出真相」推给知情格（那边没有秘密，两头都不判） |
| [`p1-1-power-ability-design.md`](design/architecture/p1-1-power-ability-design.md) | ✅ 已落地（M17） | 能力槽（power system）：Sanderson 三类限制 + 当前阶段，不判次数与冷却 |
| [`p1-1-power-system-shape-proposal.md`](design/architecture/p1-1-power-system-shape-proposal.md) | ✅ 形状已签（G4a） | 能力槽形状提案（13 列，含 `evidence_scope`），期 4b 的形状依据 |
| [`p1-1-worldbuilding-extraction-assessment.md`](design/architecture/p1-1-worldbuilding-extraction-assessment.md) | 📝 待裁定（2026-10-26） | **三格为什么抽不出来**：写入通道只有手填，`derived` 留的是「从定稿抽」且另立项 ⇒ 来源轴不同（键挂章号 + 引文，世界观没有章号）。逐格结论：**能力该抽**（来源 100% 是设定文本，卡在 8 条 / 第 1 维 2 个名额）· 制度只能抽一半（锚抽不出，全 `unknown`）· 知情**宿体不符**（要的是 secrets 不是 knowledge state）· 物品不该抽。方案 = 抽取 → 候选草稿 → 逐条采纳，豁免「不写库、不进 prompt」 |
| [`p20-2-secrets-design.md`](design/architecture/p20-2-secrets-design.md) | ✅ 已落地（M21） | 秘密宿体（secrets）：谁在捂什么 / 谁还不知道 / 第几章穿。**真相只进审稿守卫，不进正文提示词一节**（判据 DP）；不做抽取，登记全手工 |
| [`p20-3-knowledge-candidates-design.md`](design/architecture/p20-3-knowledge-candidates-design.md) | 📝 待裁定（2026-10-26） | 章末知情候选：**只做知情一格**（物品/制度锚不做）。模型权限降到「在既有 fact 清单里挑 + 指人」，引文与 `factKey` 由系统反查 ⇒ 「模型复述当事实」从结构上消失。M22 加 `summary_snapshots.knowledge_candidates`；失效靠 `factKey` 自证，不加列 |
| [`p1-2-volume-handoff-design.md`](design/architecture/p1-2-volume-handoff-design.md) | ✅ 期 1/1b/2/2b · 期 3 未开工 | 卷末交接单（volume handoff）+ 开写闸门；期 3 大纲前缀投影未做 |
| [`volume-unit-structure-design.md`](design/architecture/volume-unit-structure-design.md) | ✅ 已落地（M19） | 卷 / 单元结构持久化：计划列从大纲物化、实际列只由定稿链写，区间外置成外键 |
| [`w8-nested-world-handoff-design.md`](design/architecture/w8-nested-world-handoff-design.md) | 📋 方向已定 · 未开工 | 跨部切片交接（series bible handoff）：只做线性升级流，不做多图往返 |
| [`long-form-craft-alignment-assessment.md`](design/architecture/long-form-craft-alignment-assessment.md) | ✅ 已裁定（2026-10-24）· C1/C2/C4 已收口 | **创作侧**行业对标（读者会不会追）：十维度 × 四问，锚点带 URL 与摘句；缺口 C1–C9。三条结论：**最具体的创作规则进不了正文链**（`pacing_guidance` 只到章纲，本轮只补了作用域说明）· **创作侧零测量**（审稿刻意不判文笔）· **平台画像逐层接线**（架构链 + 正文首稿已接，章纲链与续写轮未接）。**C1 黄金三章已关闭**（不删不搬，四法则逐条归属见 §4）。与 `long-form-readiness-review.md`（生产链：会不会自相矛盾）互补不互抄 |
| [`long-form-readiness-review.md`](design/architecture/long-form-readiness-review.md) | 评估（生产链） | 长篇就绪度：跨卷失真与 300 章可行性；与上一行「创作侧」评估互补、不互抄。**本行与 `world-state-review-and-wiring-plan.md` / `p2-1-continuity-findings-design.md` 两行一起，承接 2026-11-06 从 AGENTS.md 下沉的两行任务级指针** |
| [`blueprint-key-events-structuring-design.md`](design/architecture/blueprint-key-events-structuring-design.md) | 初稿 v2 · 待裁定 | 蓝图 `keyEvents` 结构化 |
| [`phase2-keyevents-bprime-implementation-plan.md`](design/architecture/phase2-keyevents-bprime-implementation-plan.md) | 待过目 · 未动代码 | 阶段 2 + B′（含 R6）实施清单 |
| [`p11-plan-validity-and-fact-registry-design.md`](design/architecture/p11-plan-validity-and-fact-registry-design.md) | 📝 待裁定 | 计划的有效期与事实登记：水位列 / `attacks` / 复核五步 / 章级「前提」 |
| [`arc-delivery-audit-assessment.md`](design/architecture/arc-delivery-audit-assessment.md) | 📝 待裁定 | 弧光兑现度审计：情节弧被超额消耗、角色弧 3/7 起点、两弧不对齐 |
| [`p12-arc-node-anchoring-design.md`](design/architecture/p12-arc-node-anchoring-design.md) | 📝 待裁定 | 弧光结构位 ID（`M1-2/转折`，纯函数派生）+ `covers` + 三个不变量 |
| [`p13-arc-layer-expansion-design.md`](design/architecture/p13-arc-layer-expansion-design.md) | ✅ 已实施 | 弧光分层信息量必须递增：小弧从「标签」变「材料」+ 大弧「中弧推进」+ 生成时体检 |
| [`arc-proportion-calibration.md`](design/architecture/arc-proportion-calibration.md) | 📝 已并入下条 | 弧光篇幅比例：30:45:25 / 40:60 / 小弧差 ≤2 倍（现为全层均分） |
| [`arc-budget-engine-design.md`](design/architecture/arc-budget-engine-design.md) | 📝 立项 · 待裁定 | **骨架预算引擎**（合并平台画像）：章数由本地算、模型只复核；一张画像两个消费者；比例与绝对区间在 150 章下不兼容 |
| [`o1-arc-event-progress-design.md`](design/architecture/o1-arc-event-progress-design.md) | 📝 待裁定 · 已被下条取代 | **O1 旧口径（按弧）**——事件按 `→` 编号 + 每章进度线 + `覆盖：#E<n>` 水位，四条不变量（不改批次/cursor/请求数）。⚠️ 单元模式禁止「覆盖：」行，改判见 [`o1-unit-event-progress-design.md`](design/architecture/o1-unit-event-progress-design.md) |
| [`o1-unit-event-progress-design.md`](design/architecture/o1-unit-event-progress-design.md) | 📝 待裁定（2026-11-24） | **O1 改判版：单元内逐章事件进度水位**——进度改挂独立行 `进度：E<n>`（不挂覆盖行、不自造结构编号；**须同笔改 `ZH/EN_TWO_LEVEL_SUFFIX` + 两处逐字断言**）+ 折算 `[floor(k·M/N), ceil(k·M/N)]`，**N＝已写章数、按章冻结** + EV-1..4 全 fail-open；只改渲染文本、不新增模板变量、不改请求数与 cursor |
| [`p6-narrative-thread-range-design.md`](design/architecture/p6-narrative-thread-range-design.md) | 📝 待裁定（2026-11-24） | **叙事线索候选区间化（档 1）** + 生成后建议（档 3）：区间 ≤10 复用 `PLANNING_ACTION_CHAPTER_LIMIT`，**串行 N 次单章请求**（每章预算 4096、超限拒绝不截断；失败即停、已产出整批保留、记失败章号续跑）；「已扫/剩余」由计划区间并集派生，不新建扫描表；档 2 按单元批量明确不做 |
| [`synopsis-expansion-design.md`](design/architecture/synopsis-expansion-design.md) | ✅ 已实施 | **大纲层扩张机制**：章数不减，改「章级局面」（想要—被挡—尝试—代价—未决）+ 展开四来源 + 弧位块逐章步数上限（代码算，不让模型排） |
| [`arc-layer-handoff.md`](design/architecture/arc-layer-handoff.md) | ✅ 交接必读 | **弧光层工间交接**：初衷（把硬编码的阶段划分显性化）/ 职责三问 / 怎么长到 10.6k 的正反馈 / 五条已证伪假设 / 六条交接禁忌 / 下一步（先只写大弧层跑一次） |
| [`arc-tree-expansion-design.md`](design/architecture/arc-tree-expansion-design.md) | 🟡 待评审（`exp/arc-tree-v2`） | **弧光「逐节点展开」验证方案**：一次性生成的病是"同一个上下文里同时做 27 个决定 ⇒ 只能套格式"；本轮只做两层（大弧一次 + 中弧逐个大弧展开、小弧不拆）；复用同一 key 跑 1+N 次拼接，零 DB/契约改动；`arc-node` 的中弧结构位已够大纲对账，不依赖小弧 |
| [`arc-generality-and-ending-design.md`](design/architecture/arc-generality-and-ending-design.md) | ✅ 已实施（P15 + P16） | **弧光泛用性 / 结局 / 类型分配**：层级由章数定义、类型只有 A/B/C、骨料只认「拿到了」是三处题材偏置；张力=价值翻转；结局四笔债；**中弧三型原来只规定了"他失败"的位置、没有"对手失手"的位置**⇒ 各补反制/得手/反获 + 每小弧一条对手侧事件；D/E **暂不加** |
| [`arc-prompt-v2-web-test.md`](design/architecture/arc-prompt-v2-web-test.md) | 🧪 验证件 v2.1 · 已否决 | **弧光提示词组装稿（v2.1）**：真实项目数据填充、可直接粘到网页模型验证。v2 网页实测三处失败已修：小弧由「3–5 条必发事件」→「回合」→ **战线**；中弧补**局面**；**底牌记账上移大弧**。⚠️ v2.1 实测仍失败（小弧全是家长里短），原因见 v3 |
| [`arc-prompt-v3-web-test.md`](design/architecture/arc-prompt-v3-web-test.md) | ✅ 方向已验证（作者 2026-10-19）· 被 v4 取代 | **弧光提示词 v3**：行业词（卷/单元）、删掉第三层小弧、放开章数区间与占比、末尾**全书节奏表**。实测产出明显优于 v2.1（叙事任务有架子、状态变化留白） |
| [`arc-prompt-v4-web-test.md`](design/architecture/arc-prompt-v4-web-test.md) | ✅ 双画像已验证（2026-10-19）· 被 v5 取代 | **篇幅收回、改画像推荐**：模型不再输出章数/占比/章号；输入侧给「节奏推荐」画像。实测：番茄 23 单元 / 起点 21 单元，**无篇幅数字也未缩小气** ⇒ 数字不是"大"的必要条件 |
| [`arc-prompt-v5-web-test.md`](design/architecture/arc-prompt-v5-web-test.md) | 🧪 验证件 v5 · 被 v6 取代 | **补两处退化**：① 逼法"变"= 上一段那个办法**不好使了**，只换施压者判不合格，并给五档强度；② 结账必须落到具体的人/物/记录，追问"谁现在会来找麻烦"。硬画像实测 19 vs 27 单元。⚠️ 个数在三处声明（画像/怎么切/输出格式），画像改不动常量 |
| [`arc-prompt-v6-web-test.md`](design/architecture/arc-prompt-v6-web-test.md) | ✅ 双画像已验证（2026-10-19）· 被 v7 取代 | **个数单一事实源 + 去同质化**：个数只在【节奏推荐】声明；相邻两单元交手类型不许相同。实测首次分开卷数（番茄 7 卷 / 起点 5 卷），**总单元数守恒 28 vs 29**（被 章数÷跨度 钉住）⇒ 画像控形状、章数守恒 |
| [`arc-prompt-v7-web-test.md`](design/architecture/arc-prompt-v7-web-test.md) | ✅ 双画像已验证（2026-10-19）· 提示词定稿 | **标注转正 + 自检静默**：把模型自发的「（交手：X；档：A→B）」收编为正式字段供机器校验；自检改为只做不输出。实测起点 4 卷/23 单元、番茄 7 卷/28 单元；**"单元数守恒"被证伪**（是巧合） |
| [`arc-v7-implementation-design.md`](design/architecture/arc-v7-implementation-design.md) | ✅ 已实施 P1–P4 | **落地方案 P1/P2**：① 解析器兼容（`大弧\|卷`、`中弧\|单元`、补中文序号、两级模式成一等公民、golden 测试）；② 画像注入（`rhythm_profile` 走 M08 lane 六步，空=中性，模板需同时进 `requiredContextVariables`）；P3 体检两条只报不拦、P4 UI 文案 |
| [`unit-budget-elastic-allocation-design.md`](design/architecture/unit-budget-elastic-allocation-design.md) | ✅ E1/E1.5/E2 已实施 · **E3 全项目 Top 优先（未开始）** · §2 额度口径已被取代 | **弹性配给制**：单元章数由内容决定，代码只给「紧/松/按节奏」的方向（Z = 实际消耗 − 计划进度，±10% 三档）；偏差只在卷内结清、不跨卷；卷计划额度 = 画像默认 + 作者可覆盖；逐单元生成（不给 to，写完本单元即停） |
| [`volume-quota-context-budget-design.md`](design/architecture/volume-quota-context-budget-design.md) | 🟡 实施中（T2–T8 ✅ · E4 内：T11 优先/T9 后放/T10 确认搁置） | **大纲前缀预算（E4）**：每批都把整段已完成大纲塞进 prompt ⇒ 成本 O(已写章数)，长篇 666 章大纲 20 万字（133k–200k tokens）**数学上塞不进**；改三层投影（本卷全文 + **上一卷快照** + 最近 K 章），输入恒定 ≈2.6 万字；**卷末快照**按 agent compaction 语义只交接下一卷要用的物与债（生命周期止于下一卷）；**冻结与定稿同机制（作者触发、按卷冻、当前卷不冻）**，快照同时是回滚锚点（回滚单独立项）+ 弧光进全量清除；长卷单元**默认折叠可全量展开 + 可 pin 的卷/单元只读树 + Tab 实例 LRU4/墓碑（审稿对照场景）**；顺带解析 `cached_tokens`；E3 改「请求无 to、落库回填」 |
| [`unit-budget-prompt-ab-test.md`](design/architecture/unit-budget-prompt-ab-test.md) | 🧪 E2 已完成 · 提示词层已验证 | **弹性配给的 A/B/C 微型 prompt**：同一结构只改「配给状态」块（不足/均衡/充足），验章数是否跟着变；三份各 <1,500 字、虚构数据；附判读表与「提示词无效就别动机制」的判定规则 |
| [`e3-unit-batch-implementation-plan.md`](design/architecture/e3-unit-batch-implementation-plan.md) | 🟡 T1–T3 / T5–T7 / T4a 已实施 · T4b + T8–T10 待做 | **E3 实施拆解**：请求 `{from,unitIndex,maxChapters}`、落库 `{from,to}` + 游标三元组；预算按本卷剩余章数冻结；T1–T11 每步可独立验证 + 检查点回归清单 |
| [`e3-unit-batch-chain-design.md`](design/architecture/e3-unit-batch-chain-design.md) | 🟡 T12 已实施 · 待实机复验 | **连续单元（链式新 run）**：一次确认连写 N 个，**只到本卷末**；判定顺序 卷界 > 配额；每批必须重读检查点 / 重探 / 重放 author inputs / 等上一批退出活跃列表；重启不续链 |
| [`chapter-position-format-design.md`](design/architecture/chapter-position-format-design.md) | 🟡 P0/P1/P2 已落地 · P3 待做 | **章节位置表达统一**：`## 第3卷第2单元第3章（全书第45章）：章名`——把「属哪卷哪单元」从**事后折算**变成**生成时写进标题**，给 `outline-tree` 补第四种 source（`heading`），终结「单元写超 ⇒ 后续章号与单元整体错位」；三个各写各的章标题正则已抽成共享解析器（P0 零行为变化），存量永久双格式兼容。**P2 三个坑见 §5**：`naming==='volume'` 只是措辞不是层数、格式段只在 suffix 出现一次、逐章模式刻意不改 |
| [`story-beat-library.md`](design/architecture/story-beat-library.md) | ✅ 已实施（2026-10-28，拍子格当晚改形见 §6.1） | **故事节拍库与分层换拍**：旧口径「严格按结构组织大纲 + 百分比切章」在 150 章书上等于**82 章共用一句职责**（中段无分段依据 ⇒ 只能同构循环填，读感＝拖沓＋一个套路）。新口径：`shared/story-beats.ts` 为唯一事实源（十套拍子 × 原生跨度），**全书层只定两端**、卷／单元各选一套、**同一层只准一套**（防叠层：*layering gives a spreadsheet, not a book*）、相邻不同拍／卷内不重样／跨度匹配四条机检（`ARC_SAME_BEAT` / `ARC_BEAT_REPEAT` / `ARC_BEAT_OVERSPAN` / `ARC_BEAT_UNKNOWN`）。只查下限，不承诺质量。**§6.1：首版「一拍一句话」把卷纲撑爆（7 卷 + 26 单元、节拍表 15 拍 ⇒ 整份被截断），已改成「名字 + 落位」两行；骨架只在库里，拍子到单元层为止，章纲层是场景清单不是拍子** |

| [`upstream-version-and-derived-invalidation-design.md`](design/architecture/upstream-version-and-derived-invalidation-design.md) | ✅ 期 1/2/3 全落地（2026-11-01，schema 29） | **上游重建与下游失效**：五套先例（物化视图维护 Gupta&Mumick · Bazel **change pruning** · Salsa **red-green/backdating** · dbt **state:modified+** · K8s **level-triggered**）收敛到同一条 —— **写时不传播、读时验证**；事件只当提示不当真相。三个答案：① 上游按影响域分版 `upstream_revisions(domain,scope,rev,digest)`，大纲按**单元批次**而非整版（同 Doris 分区对齐）② 派生只记 `source_ref`「我基于哪一版」，**不记下游、不做反向索引**（反向索引必然漏，这就是今天 16 处静默消费的来源）③ 处置三档（可自愈重算 / 标失效+**读取侧拒绝** / 归档），执行者都在读方。三条不照搬：**LLM 产出不可复现 ⇒ early cutoff 只对确定性派生有效**；反向索引必然漏；只标脏没人看 = 没标。~~期 1 = 零消费者改动~~ → 期 2 接读取侧、期 3 接 UI（硬拦/强提醒/清点页三个消费者共用一份判定）。上游回滚须**先算 plan 再执行**（§八） |

| [`upstream-invalidation-phase2-source-ref-and-read-gates.md`](design/architecture/upstream-invalidation-phase2-source-ref-and-read-gates.md) | ✅ 已落地（2026-10-30） | **上游失效期 2 的实施设计**。先定**四条判定不变量**（空章集=覆盖全部 · `have>need` 一律脏 · 缺键=覆盖全部 · 非 outline 恒全章）—— 每条都对应一个会静默出错的形态。v2 修掉 6 个缺口、改判 3 处：①章集格式改 `{rev:[章]}`，但写入只允许 `newRevOnly` / `replace`（`parseChangedChapters` 只认数组，只改格式不改 parse 等于「迁移即自毁」）②交接单只有 `basis` 为 `actual` 才按区间收窄，否则按全书（`VolumeRange` 可全 null ⇒ 否则整卷重建静默通过）③`bump` 返回值要拆「表没有（null）」与「第 0 版（0）」。**20+ 处读蓝图**里五处必须拦（正文链两处主干道 / 审稿 / 卷末承接 / agent 工具）；`commitRange` 与 `upsertMany` 在循环里调 `upsert` ⇒ bump 必须提到循环外、且每行写同一新 rev；角色改名/合并的裸 `UPDATE blueprints` 也要 bump；**清除全部必须同事务清 `upstream_revisions`**，否则导入旧备份后永久脏且不自愈；剧情树**加列不加 JSON 字段**（`graph-generation` 拿整串当 baseline hash），rev 出徽标、hash 只拦生成、不两判取严；便携**不 bump** 策略版本号。并发：同进程无竞态，跨进程补 CAS + 重试一次 |
| [`upstream-invalidation-phase3-plan-and-ui.md`](design/architecture/upstream-invalidation-phase3-plan-and-ui.md) | ✅ 已实施（2026-11-01） | **上游失效期 3 的施工图 + 全部落地记录**。开工前两个事实：`source_ref` 只落在三张表（M25）；主稿 §8.2 要的四组里「已定稿章节」与「伏笔计划」**没有判定原料** ⇒ 期 3a 只报三组 + `unseen`（S6/M28 补齐定稿组）。`legacy` 只进 `unseen` 不进 `groups`、`unseen` 不许折成 0、空组不占位；`tier` 判据是**后果不可撤销**（含定稿章或交接单 ⇒ `strong`）；plan **纯读**，取消后 rev 必须一位未动（S4 专测）。S1–S7 每片独立验收；S7 收窄成「清点 + 跳转」（不做一键重算） |
| [`d17-outline-change-range-design.md`](design/architecture/d17-outline-change-range-design.md) | ✅ **已结项**（2026-11-05，已实机复验） | **D17 收尾补丁**：判定链已完整，缺的只是写入侧一个入参 —— `commitSynopsis` 拿不到「这次写进大纲的是哪几章」，`changed_chapters` 恒空集 ⇒ 判定按既有不变量把它当「全改」⇒ 提交 1 章列 7 项待处置。修法只做一件事：请求加 `writtenRange`，由 `commitSynopsisWithCheckpointRollback` 从检查点算（正常=实际范围 / 收缩=全段 / 中断=不声称）。**不动判定不变量、不加列、不改 `scope`**；② 的「区分不知道与全改」已由 `covers_all` 三分承担，不重造。**复验实测**：rev21 `[18,19]`、同步页 7 项 → 3 项、13 张蓝图全 valid（§7.4）；复验时撞出的模板指纹问题已单列 **D20** |
| [`d6-volume-count-source-design.md`](design/architecture/d6-volume-count-source-design.md) | 🟡 **已裁定**（2026-11-05 · **方向 A**，未开工） | **卷数的事实源**：卷数今天没有事实源 —— 它是模型照着画像常量文本挑的一个数，代码既不算也不校验；30 章被切成 6 卷 × 3 单元时，「卷数×单元数×章数≈总章数」这条乘法链上**没有任何一环被要求把它们写出来**（`totalChapters` 只在 `builtin-prompt-templates.ts:752` 进模型脑内"心里算"，且 `:864` 明令不许写进输出）。**新发现**：12 章缺口不是被谁吃掉，而是「实写环（D7 偏保守）× **终止环**（`architecture.command.ts:373` 单元用尽即判全书完成，全链没有 `covered_to` 对账）」两环叠加；只修 D7 仍会在第 18 单元收尾。**裁定（§8）**：方向 A 采纳（卷数 = `f(totalChapters)`、代码算，画像只给每卷章数区间），**并显式取代 2026-10-19「卷/单元章数由模型决定」那条旧裁定**（作者理由：那个做法「有一点公式主义，为了不一样而不一样」）；旧裁定原文保留在 `arc-budget-engine-design.md:4` 并加取代标注。裁定 2/3/4/5 仍待答，其中 3（存量库怎么办）是开工前置 |
| [`d8-checkpoint-degradation-design.md`](design/architecture/d8-checkpoint-degradation-design.md) | ✅ **已实施**（2026-11-06 18:5x · 第八轮补正后直接施工 · 单测 2203/2203 / browser 54/54 / check-fast 全绿 · **19:5x Agent 已用 CDP 实机跑完四条；20:4x 作者四条订正后的三项阻塞（未落稿生成物被当正式产物守护 / 卷单元模式下中继续写入口仍露出 / 弹窗两套说明）已修复，21:0x 实机复验通过，见 §12.10.6** · `566ca5d6`） | **候选区残本阻塞大纲生成**（§12.1.1 / §12.10）：卷/单元路线**每次点「生成 / 执行」无条件清候选区**、上游级联清空时界面连坐清；清场**只作废残本**（仅 `synopsis_incomplete===true` 时删旗标 / handle / 残本正文），完成态 `synopsis_range` / `synopsis_result`、进度 / 游标 / 偏差账 / DB 正文一律保留，**绝不复用 `resetSynopsisCheckpoint` 的 14 键整表删除**。按生成路线分流（配置开关单一事实源、卷单元路线不保留章节连选、禁止模式交替）、旧模式语义不改、反馈收敛链零改动；**不新增 / 不删除任何按钮**（卷单元模式下右侧中断续写入口改为整块静默，不新增「取消」按钮）。单元连选 = 链式新 run 每批立即落稿，只丢最后残缺单元（§12.9）。18:5x 作者裁定「不用复审、直接施工」⇒ 十三条取证已在 §12.10.2 收口、不再重划 v4；执行与验收只认 §12.10。v1–v3、C1 / C2、05:20 两条伪裁定均已作废，原文逐字保留作历史 |
| [`d20-checkpoint-template-fingerprint-design.md`](design/architecture/d20-checkpoint-template-fingerprint-design.md) | 🟡 **已裁定**（2026-11-05 · **裁定 1 = A 模板变化允许续**，未开工） | **D20 模板指纹误报**：指纹是 4 元的（11 个源事实字段 / 步骤指导 / 批次范围 / **`JSON.stringify(template)` 整对象**），比对时只剩一个布尔值，而两处报文（`:3135` / `:3242`）只认第 1 元。**实测只有「源事实 / 模板」两项可能漂移**——②③ 是拿检查点自己的值重算自己，永远相等；同文件的对照 `:2334` 点了模板这一项（但只列 3 项，漏步骤指导）。真因是换数据根 / 换机器 / 改模板导致模板解析结果不同。**代价**：指纹让「改内置模板」变成高风险操作，两次输出合同变更因此只能走渲染期替换（红线 19 的「必须」由此而来；但两处 override 各有独立理由，不是为躲指纹而生）。修法 = `synopsisInputFingerprintParts()` 只落**两个短哈希**（源事实 + 模板），逐项比、按 `drift` 出报文，旧检查点诚实兜底；**必补两个名单**（`SYNOPSIS_CHECKPOINT_FIELDS` / `SYNOPSIS_CHECKPOINT_KEYS`，漏了会打坏回滚）。**裁定 A**：模板变 ⇒ 放行 + 不阻塞提示。**裁定 2**：旧检查点（无新字段）也放行、不逼全书重来——新项目一律新检查点，旧检查点只在已有项目与实机验证项目里。遗留：世界观链要不要一起改（成本已实读，收益小一个量级）。**稿子经独立复核打回后修订**（§11）**卡 `216dcf5b`**（I1）· 四条裁定已全裁：③ 世界观链**不改**；④ 模板段收窄**做**，作 **D20b 卡 `45ef0936`**（I3，等本体复核通过才打 `external`） |
| [`d13-chapter-failure-contract-design.md`](design/architecture/d13-chapter-failure-contract-design.md) | ⬜ **待裁定**（2026-11-05 · 方案稿已出，经复核打回五处后修订） | **D13 一章三种死法**：不是三个 bug，是**一条链上没有失败契约**。实读后是 **18 个出口、约 8 个码**（正文层 10 处 + 主进程 4 处 + 组装层 4 处），且**码全在 message 里、不带 `code` 字段**（`fail()` 就是 `throw new Error(code)`）⇒ `recoveryFailureCode` 一律兜底 `GENERATION_FAILED`；跨 IPC 还会再丢一次。**三条旧结论被推翻**（§4）：①「续写结果没参与 compose 判定」**错**——它逐字参与，第 3 次的真实路径是 `accepted → acknowledge → compose :531`；②「丢弃前留草稿」**代码在但生产不可达**（`!mainOwned` 恒假）；③ 范围不是 3 处而是 18 处。**另修一处读反**：组装层 `:526` 判的是**压缩前**正文（`text` 到 `:533` 才更新），语义是「本该不需要压缩」，不是「压缩后仍超上限」 |

### 4.3 审稿链 · [`design/review/`](design/review/)（4 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`p2-1-continuity-findings-design.md`](design/review/p2-1-continuity-findings-design.md) | 🚧 期 1 已实施 | 四类连续性登记作「核对基准」进审稿（物品/制度/知情/能力），findings 随报告生灭、零 schema 变更 |
| [`p7-review-material-dedup-design.md`](design/review/p7-review-material-dedup-design.md) | ✅ 已实施 | 审稿链材料去重（世界观/角色状态重复注入） |
| [`c1-review-architecture-declaration-design.md`](design/review/c1-review-architecture-declaration-design.md) | ✅ 已实施 | 审稿链「远期设定使用规则」声明（路子 B） |
| [`consistency-check-ordinal-claim-guard-design.md`](design/review/consistency-check-ordinal-claim-guard-design.md) | ✅ 已实施 | 序数/全称断言独立复核 |

### 4.4 角色 · [`design/characters/`](design/characters/)（5 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`p1-blueprint-roster-sync.md`](design/characters/p1-blueprint-roster-sync.md) | ✅ 已实施 | 蓝图角色 ↔ 角色卡 roster 同步 |
| [`p2-character-card-ai-generation.md`](design/characters/p2-character-card-ai-generation.md) | ✅ 已实施 | 角色卡管理界面的 AI 生成增强 |
| [`character-proposal-adoption-merge-design.md`](design/characters/character-proposal-adoption-merge-design.md) | ✅ 已实施 | 采用到已有角色时改为字段合并（不覆盖已引用设定）+ 候选→已有卡的关系可直接采用 |
| [`character-roster-rebuild-design.md`](design/characters/character-roster-rebuild-design.md) | ✅ 已实施 | 架构重建＝整册替换：同名默认采用、字段覆盖、名单外旧卡退休、同对关系边收敛 |
| [`c1-relevance-filter-and-regeneration-diff-design.md`](design/characters/c1-relevance-filter-and-regeneration-diff-design.md) | 📝 待裁定（2026-11-24） | **C1 落地**：相关性筛选三档（关系/蓝图声明/大纲世界观命中）只标原因不自动勾选；重生成改**字段级并排 + 三选一 + 排序**，覆盖前留旧卡快照（**新 lane 表 `character_regeneration_snapshots`**，照 M08 先例、不动 M00 基线）、覆盖后按 `operation_id` 逐字段回退；排序 v1 只留「有剧情优先／名字」；不做逐字 diff |

### 4.5 功能与设置 · [`design/features/`](design/features/)（9 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`user-settings-package-design.md`](design/features/user-settings-package-design.md) | 待审核 · 未编码 | 用户级设置包（创作资产导出/导入） |
| [`p1-2b-settings-period-authoring-guide.md`](design/features/p1-2b-settings-period-authoring-guide.md) | 草案 v1 | 世界观期次标注的作者操作手册 |
| [`system-notification-design.md`](design/features/system-notification-design.md) | 已实施（2026-11-02） | 系统级 OS 通知 + 声音提醒（主进程发通知/渲染进程播音/聚焦抑制/注册表热插拔；N1–N3 全落地，音色待作者试听） |
| [`task-completion-notify-design.md`](design/features/task-completion-notify-design.md) | 已列入待办（顺延） | 应用内 toast 统一宿主 + 热插拔注册表（作者裁先做系统级；将来可合并为双输出） |
| [`ai-output-live-render-design.md`](design/features/ai-output-live-render-design.md) | ✅ 已实施 | AI 输出面板运行态只给状态行、不渲染流式文本（原文：审稿把渲染进程推到 10GB 的 O(n²) 取证与参数） |
| [`p16b-prompt-config-and-trace-guide.md`](design/features/p16b-prompt-config-and-trace-guide.md) | ✅ 已实施 | 作者操作手册：三条配置边界、口味/数字之辨、三类打架、Prompt 追踪五步归因 |
| [`d2-run-lease-abort-design.md`](design/features/d2-run-lease-abort-design.md) | 已裁定 · 部分实施 | D2 方案甲：`generation_runs` 加执行租约三列（M29），启动时把「主人已死」判成 `aborted`。已落地迁移/仓储/12 条单测 + **A4（`aborted` 不可续）**；**心跳未接（§10.6 / §11 写了要动哪几处）** |
| [`idle-guards-wiring-inventory.md`](design/features/idle-guards-wiring-inventory.md) | 待裁定（2026-11-04） | 三个「写完但零调用方」的守卫（D5 / D15 / D18）各自该在哪一行被调用；含「接线前必须先定的三件事」 |
| [`batch-interrupt-resume-design.md`](design/features/batch-interrupt-resume-design.md) | ✅ 已实施（2026-11-09 · 甲方案；乙/丙待裁定） | **批量写到一半失败后无路可走**（A1 验收的卡点）：点「继续此批次」→ 去续一条已 terminated 的 run ⇒ `GENERATION_RESUME_REFUSED`；重新开一批 → 起始章仍是已完成的那章 ⇒ 撞「已有草稿不覆盖」。定位到 `batch-chapter-workflow.ts:272` 与 `generation-run-repository.ts:789-791`；三条修法（甲补文案+默认起点 / 乙终止批次改走新开 / 丙批次跨运行存活），建议先走甲。**机制为读码定位，尚未实机复现** |

### 4.6 产品与方法论 · [`design/product/`](design/product/)（15 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`writing-capability-assessment.md`](design/product/writing-capability-assessment.md) | 待裁定 | **五份评估稿的导航** + 定位三问（用户 / 质量标准 / 竞品）+ 「写得好」缺位为何让所有质量判据必然降级 |
| [`prose-shape-measurement-design.md`](design/product/prose-shape-measurement-design.md) | ✅ 已实施 | P17-2 正文形态统计器：阈值取自作者自己的 v7 正文规则（不是外部口径）；测量仪不做裁判、只写日志；钩子整个不做（标点判语义会奖励 AI 腔） |
| [`live-verification-checklist.md`](design/product/live-verification-checklist.md) | 待执行 | **一次新项目跑批要验什么**：按世界观→架构→第一章→修稿四阶段排好，标零成本/人工判读；P17-3 明确不在本轮 |
| [`config-registry-write-paths-assessment.md`](design/product/config-registry-write-paths-assessment.md) | 待裁定 | 配置与登记格**五条写入路径只有两条带确认面**；手填的真负担是「护锚」不是建账；「抽卡变追加」与「输入框看不清」是同一个缺口（缺显式替换动作），diff 面板正好补它 |
| [`live-pipeline-acceptance-defects-assessment.md`](design/product/live-pipeline-acceptance-defects-assessment.md) | 📝 待裁定（2026-11-01） | **2026-11-01 实机链路验收的 11 条缺陷**（D1–D11，均带证据）。最重要结论：**界面上无法区分「在跑」和「已死」**——批内第二次调用即被判 `GENERATION_SOURCE_CHANGED`（D1），而中止后既无失败回执也无终态落库（D2）；另有 L3 降级静默（D3）、卷数脱离总章数（D6）、模板尖括号占位符原样落库（D5）等 |
| [`d12-short-synopsis-replay-fix-plan.md`](design/product/d12-short-synopsis-replay-fix-plan.md) | 🏁 已结案（2026-11-08，方案未采纳） | **D12 修复方案草稿**（豆包拟）：真因判在「拦截点太晚」并建议把对象归属判据前移到短细纲出口。**结案时被推翻**——拔护栏直连复跑 10 次＝干净 3 / 重演 5 / 失控 2，与 App 内同量级 ⇒ 定性为 **9B 模型固有弱点、非 App 缺陷**，B1 不回滚；结论见 [`handoffs/2026-11-08-d12-closeout-small-model-weakness.md`](handoffs/2026-11-08-d12-closeout-small-model-weakness.md) |
| [`d21-gate-shortcircuit-evidence-20261109.md`](design/product/d21-gate-shortcircuit-evidence-20261109.md) | 🔍 T3 证据（取证完成、修法未落地） | **D21 大纲进度闸门短路取证**：短路段在 `src/services/outline-progress-gate.ts:92-95`（不在 `shared/` 纯函数里），卷结构 `stale`/`unparsed` 时第二维判据不可达、调用方拿到 `gate: null` 只 `console.warn` 后**静默放行**；落地卡在单测 `outline-progress-gate.test.ts:154-165` 固化了短路行为 |
| [`d21-fix-c-implementation-plan-20261109.md`](design/product/d21-fix-c-implementation-plan-20261109.md) | 📐 实施设计（**待点头**） | **D21 修法 C 怎么落地**：归档取证稿只有方向、无可粘贴 diff，且上一轮落地清单漏了「按 `project_core` 现算卷边界」这一核心（只删短路 = 作者否掉的修法 A）；本稿给全五个决策点（降级 / 合并 / 区间下沉 / 确认顺序 / 断言改法）、两处 UI 建议值与「若采纳动哪几处」，生产代码与断言同批改 |
| [`d21-gate-ui-guide-20261109.md`](design/product/d21-gate-ui-guide-20261109.md) | 🔍 设计输入（2026-11-09 夜跑） | **D21 修法 C 的 UI 操作指南**（豆包）：四个固定位置的中英文案可直接进下一批实现 + 作者操作路径；指出「确认先于过期」（`src/shared/outline-progress-gate.ts:136`/`:143`）与卷末交接闸「过期优先」（`volume-handoff-gate.ts:66`）相反；主次按钮顺序、「表旧」做附注还是第五档待作者裁 |
| [`d12-retry-design-20261109.md`](design/product/d12-retry-design-20261109.md) | ⛔ **不实施**（2026-11-09 作者裁定：已结案事项被重列为待裁，属伪议题） | **D12 拦截后自动重跑一次**（豆包）：触发条件从「结尾 1000 × 开头 1200、8-gram ≥80」换成全章 `analyzeChapterReuse` blocking 0.45；重跑必须同时做材料减法（撤上一章结尾，缺陷稿 `:851` 自述强指导无效）；两个硬前置＝缺「上一章全文」入参、`generate-draft.command.test.ts:979-998` 写死三次调用 |
| [`same-plot-check-20261109.md`](design/product/same-plot-check-20261109.md) | ⛔ **伪需求 · 不实施**（2026-11-09 作者裁定） | **「连续两章剧情相同」怎么查**（豆包）：现有一致性检查是一次 LLM 审稿、不是判据集合；逐字判定器对改写式复用 `ratio=0`（不是阈值问题）；推荐先落「相邻两章蓝图 `key_events` 重合度」（2–4h，唯一有结构化输入），拦路石是审稿证据锚点要求逐字唯一引文（`review-chapter.command.ts:129`） |
| [`2026-11-13-q4-delivery-plan.md`](design/product/2026-11-13-q4-delivery-plan.md) | 待裁定（2026-11-12 用户已同意入库） | **Q4 交付计划**：唯一硬指标从「做了几个功能」改成「『已实施未实机』几时清零」；四期 + 季度收口（1a 清噪声 11/13 → 1b D12 接线与 G14 第一张成绩单 11/14–11/17 → 2 实机复验 → 3 架构一致性 → 4 计划层 UI）；红线 `no new red`，基线双轨（browser 按 G7、全量按 G12），三个数字任一恶化即停新功能 |
| [`2026-11-07-batch-acceptance-plan.md`](design/product/2026-11-07-batch-acceptance-plan.md) | ✅ 已裁定（2026-11-07） | **第三方独立复核验收清单**（甲方案：E0 台账卫生 + A 实机 + B 界面小缺陷 + C 撤销）：开工基准快照、§3 逐项可判验收矩阵（「第三方结论」列留空、不替复核者下判断）、实测读数、红线检查表、签核表；**2026-11-07 作者裁「丙」拆批**：B 组独立复核 3 兑现 / 2 打回，D9/D16 结转下一批结构设计；明确列出 A1 未跑 / A2-1·2·6 未兑现，证据保留至签核后 |
| [`2026-11-12-author-now-what-works.md`](design/product/2026-11-12-author-now-what-works.md) | 待裁定（2026-11-12） | **作者口径的「现在能做什么、不能做什么」一页**：按开新书→设定→大纲→逐章正文→批次→审稿→定稿七段，逐格写「能做 / 不能做 / 作者要做的」；四处必须人接手 —— 相邻章剧情重演（D12 判定器零接线）、卷单元章区间重叠（D15 未开工）、批次终态未实机（D2 / D13）、钩子与 AI 味只报不拦（D18 / P8）。QA 交叉核对后认可「能做 / 不能做」划分 |
| [`2026-11-13-relay-multicast-reflection.md`](design/product/2026-11-13-relay-multicast-reflection.md) | 待裁定（2026-11-13） | **随想：多播是神经突触，但先不做**。不重复对外正文的故事，只留三条产品判断（界面上的「一个 Bot」是幻觉 / 基础设施会被使用者自己发现 / 误报比不投更贵）、多播暂缓的理由（一条规则投 N 个会话 = N 个 agent 并跑，编排责任不该塞进投递层；「同一目录投多目标」用多条 watch 表达）与 README 故事版中英备选 |

### 4.7 Harness 与文档治理 · [`design/harness/`](design/harness/)（4 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`harness-and-docs-reorganization-plan.md`](design/harness/harness-and-docs-reorganization-plan.md) | 待裁定 | 用五子系统（指令/工具/环境/状态/反馈）给本仓库打分：**环境与工具已经很强，状态与反馈是两条短腿**，并附一处可 `git show` 复盘的漂移实例；三档方案（A 止血 / B 状态归一 / C 历史清理），本次只出了 A 档的一半 |
| [`cross-harness-task-board-access-design.md`](design/harness/cross-harness-task-board-access-design.md) | 已实施（2026-11-03） | 外部 agent 用 `dsh-task-board` CLI / MCP 壳走看板 HTTP action 拉取任务；`move` 即 CAS，本地租约记归属/过期/重试；端口随机靠自动发现 + `ledgerId` 防串板；看板仍是唯一账本，不改 DSH、不改插件、不做主动派发 |
| [`dsh-plugin-pitfalls/`](design/harness/dsh-plugin-pitfalls/README.md) | 已实施（2026-11-14） | **DSH 插件开发避坑指南（索引 + 四棵树）**：24 条真实事故，一条三行「现象 / 根因 / 解法」；加载期崩溃（`cannot get property "settings" without inject`、fire-and-forget 无 catch、`ctx.get` 假修好、await fiber 挂住启动）、设置卡与依赖（schemastery 解析基线站错、asar 不能用 Test-Path 判、只读界面也是 client、客户端 inject 里的服务名随宿主改版失效）、取证（冒烟必须能复现原崩溃、stub≠真机时序、临时目录统一 finally、行号会漂、单个 git 命令失败≠通道不通、先查社区再扒源码、同一份交付被推两遍）、投递与发版（插件停用＝链路消失、只认字节+MD5、改名四处同批、坏 tag 不回滚不删）—— 写/调 DSH 插件前先按现象查这一页。分册：[`01-lifecycle.md`](design/harness/dsh-plugin-pitfalls/01-lifecycle.md)（K01–K05）· [`02-settings.md`](design/harness/dsh-plugin-pitfalls/02-settings.md)（K06–K12、K21）· [`03-evidence.md`](design/harness/dsh-plugin-pitfalls/03-evidence.md)（K13–K16、K22–K24）· [`04-release.md`](design/harness/dsh-plugin-pitfalls/04-release.md)（K17–K20） |
| [`dsh-file-watch-plugin-design.md`](design/harness/dsh-file-watch-plugin-design.md) | 待裁定（2026-11-12） | **文件监控唤醒插件开源版方案**：`watches[]` 五字段（`dir`/`include`/`stableMs`/`marker`/`targets`）、不做 `ignore` 与正则；判据取**合取**（尾部 marker + 连续 `stableMs` 不变）；尺寸红线单文件 ≤150 行、零依赖、无 UI；附 README 可写/不可写对照表、脱敏最小示例与首次跑通四步 |

---

## 5. 台账与冻结区

- **唯一 TODO 台账**：[`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md)。P 系列（P1–P9 / P11 / P12）+ N 系列 + E 系列全在里面；新待办追加到这里。
- **历史看板**：[`plans/00-OVERVIEW.md`](plans/00-OVERVIEW.md)（2026-10-11 冻结，仅存档；现行状态见本页与台账）。
- **Program v3 冻结合同**：[`plans/novel-quality-program-v3-2026-09-13/00-START-HERE.md`](plans/novel-quality-program-v3-2026-09-13/00-START-HERE.md)（34 节点原合同；DAG/NOT STARTED 不代表当前调度）。
- **开发入口（Program v3 侧）**：[`research/novel-quality-modernization/current-spec-index.md`](research/novel-quality-modernization/current-spec-index.md) ← 逐项连接原合同与现行替代。
- **线程 10 交付计划**：[`research/novel-quality-modernization/thread10-delivery-plan.md`](research/novel-quality-modernization/thread10-delivery-plan.md)（采样裁决与实施顺序）。
- **留在 `plans/` 的两份历史文件**（目录外存在按字面路径的锚点，移动会造成断链，故不动）：
  - [`chapter-goal-review-production.md`](plans/chapter-goal-review-production.md) —— 被 [`donor-delta.json`](research/novel-quality-modernization/donor-delta.json) 按路径引用。
  - [`llm-probe-observation-plan.md`](plans/llm-probe-observation-plan.md) —— 被 `electron/services/llm-probe.ts`、`src/shared/synopsis-projection.ts`、`src/services/workflows/commands/generate-draft.command.ts` 的注释引用。
- **实施证据索引**：[`research/novel-quality-modernization/evidence-index.md`](research/novel-quality-modernization/evidence-index.md)；质量协议：[`quality-protocol.md`](research/novel-quality-modernization/quality-protocol.md)。
- **P8 取证（2026-10-17）**：[`research/2026-10-17-fanqie-draft-quality-evidence.md`](research/2026-10-17-fanqie-draft-quality-evidence.md) —— 番茄向草稿的 5 份并行取证 + 独立校验，供 [`p8-fanqie-flavor-draft-quality-design.md`](design/prompt/p8-fanqie-flavor-draft-quality-design.md) 引用。

---

## 6. 文档权威层级

| 文档 | 用途 | 权威与生命周期 |
| --- | --- | --- |
| [`README.md`](../README.md)、[`README_en.md`](../README_en.md) | 面向用户的产品定位、安装、隐私和能力概览 | 当前公开产品说明；中英文需要同步 |
| [`docs/product-domain.md`](product-domain.md) | 稳定产品术语、事实源和边界 | 可发布的领域词汇表；实现和规格应使用这里的名称 |
| [`docs/adr/`](adr/) | 难以从代码恢复的架构决定、边界和取舍 | 已接受决定；后续变化应明确扩展或取代原决定 |
| [`docs/agents/`](agents/) | Issue、领域文档和 Agent 协作规则 | 当前贡献流程；不得承载临时任务状态 |
| [`docs/design/`](design/) | 现行设计稿、评估与实施记录 | 按各稿头部的状态行使用；状态只改那一行 |
| [`docs/plans/`](plans/) | 待办台账 + Program v3 冻结范围 | 台账活；冻结包不回填进度 |
| [`docs/research/`](research/) | 调研、实施证据及实验执行说明 | 按各文件的日期和角色使用；历史回执不自动成为当前资格 |
| [`docs/handoffs/`](handoffs/) | 指定分支或任务的交接快照 | 有日期的任务状态；完成或分支变化后可能过时 |

`AGENTS.md` **已入库**（2026-10-25 起，见 [`adr/0025`](adr/0025-track-agents-md-and-copilot-channel.md)；此前按 `.gitignore:58` 被忽略，已解除）。它是**新会话的常驻入口**——不是产品文档，也不能覆盖 [`product-domain.md`](product-domain.md) 或 ADR；其权威内容在 [`agents/documentation-charter.md`](agents/documentation-charter.md)，两边用 `charter-version` 标记同步（脚本 C7 校验）。

---

## 7. 已取代的决定

- [`0006-unified-cross-platform-github-release.md`](adr/0006-unified-cross-platform-github-release.md) 保存最初的 Windows + macOS ARM64 发布决定，当前三目标发布与平台更新动作由 [`0016-three-target-release-and-platform-update-actions.md`](adr/0016-three-target-release-and-platform-update-actions.md) 取代。
- [`0019-remove-real-call-hard-cap.md`](adr/0019-remove-real-call-hard-cap.md) 取代冻结实验合同的全局 80 次调用硬帽；80 保留为计划分配额，逐请求记账和产品安全限额继续有效。
- [`0020-legacy-project-copy-import.md`](adr/0020-legacy-project-copy-import.md) 将旧小说兼容改为保留原件的完整项目导入，禁止 AI 重建或覆盖既有设定；取代旧根退役/永久拒写要求。[现行 F05](research/novel-quality-modernization/frontend-transition-specs.md#f05--最终-v3-功能及桌面体验资格) 同时拥有新版编辑交互验收。
- [正文篇幅现行要求](plans/novel-quality-modernization/specs/S06B.md#prose-length-overrun) 自 2026-10-05 起保留一次既有超长压缩，仍超长则提示并继续；偏短处理不变。
- [AI 自主审稿与成稿资格](research/novel-quality-modernization/quality-protocol.md#ai-review-final-manuscript) 自 2026-10-01 获用户批准。
- [线程 10 交付计划](research/novel-quality-modernization/thread10-delivery-plan.md) 自 2026-10-02 拥有材料补齐、自动短细纲、有界模型筛选及 candidate-only 多轮资格。

---

## 8. Worktree 边界

审计或接手任务时先运行 `git worktree list --porcelain`，再在目标 Worktree 内记录分支、SHA 和 `git status --short`。移动、合并或删除 Worktree 属于单独的清理任务；文档治理不授权这些操作。

每次提交态文档绑定其实际 SHA；用户授权的工作区规格增量可供本次审查，但须记录来源、内容 hash 和未提交状态。不能把其他 Worktree 的材料或尚未提交的修订说成当前提交/远端已包含的事实。
