<!-- charter-version: 2026-11-07 -->
# AGENTS.md · 常驻上下文（新会话开工先读这一份）

> 只放三样：**分档尺子（§0）** · **T0 不变量（§2）** · **路由表（§3）**。**硬顶 ≤ 60 行 且 ≤ 4,500 字符**——只卡行数会被「压成一行长段」绕过。加任何东西前先从别处减一行。全量规则台账 → [`rule-registry.md`](docs/agents/rule-registry.md) · 分档判据 → [`documentation-charter.md`](docs/agents/documentation-charter.md) §12 · 索引 → [`docs/README.md`](docs/README.md)。**本文件入库**（[ADR-0025](docs/adr/0025-track-agents-md-and-copilot-channel.md)）；权威副本是 charter，改规则两边同步 `charter-version`。

## 0. 分档尺子（元规则：它本身是 T0，不许删减；量失败形态，不量主题）

| 档 | 准入（两条同时成立） | 形态 | 落点 | 容量 |
|---|---|---|---|---|
| **T0 不变量** | ① 后果**不可逆或静默**（数据丢失 / 错提交 / 越权 / 方向漂移）② **每次会话都可能触发** | 一句祈使句，不写原因、日期、编号 | §2 | ≤ 8 条 |
| **T1 触发型** | 有明确触发条件（「动 X 前」），但不是每次会话都该占注意力 | 条件 + 一句动作 + 指针 | 记忆注入层 | 受 8,000 字符 |
| **T2 判据型** | 要用它得先有判断力（边界、反例、为什么） | 全文 | `notes/*.md` | 无 |
| **T3 证据型** | 一次复盘、一次交接 | 全文 | `docs/handoffs/`、ADR | 无 |

**降档三问**（任一答否 ⇒ 进不了 T0）：① 违反了作者当天能自己看出来吗（报错 / 测试红 / 界面不对）——能，就是闸门的事，不占 T0；② 每次会话都有机会被违反吗——只在加列 / 改模板 / 收口时才有机会 ⇒ T1；③ 删掉原因只留一句就执行不了吗——是 ⇒ 它是知识点，不是规则 ⇒ T2。

**两条附加**：**T0 必须配闸门**（脚本或强制读入点；都没有 ⇒ 台账标 🕳，没有闸门的 T0 只是愿望）· **T0 上限 8 条**，要加第 9 条先证明某条已不成立。**「这次特殊、先加一行」就是破线。**

## 1. 项目地图与禁动区

目录职责见 [`docs/README.md`](docs/README.md) §1。两条查表查不出的边界：**主进程与渲染层各拼一半 prompt**（改 prompt 先读 inventory §2）· **改 `src/` 非组件模块热更新不生效，必须重启 `pnpm dev`**。**禁动区**：`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`（脚本按字面路径引用）、`docs/adr/` 既有条目；**语料样本（含原文全文、切片、章名）只落 `.runtime/`，禁止入库、禁止上传**。

## 2. T0 不变量（8 条 · 唯一清单，别处只写指针）

1. **授权边界**：开工先写一句 `本轮授权：<只读 / 只计划 / 可改码 / 可提交 / 可推送>`；**未明说不做善意推断，按最窄执行**；越界先问一句（细则 → charter §7 第 0 步）。
2. **先讨论再落地**：规则、层级、契约、格式的改动先给方案等点头——一次成型必偏。
3. **不猜根因**：先取证（代码 / 日志 / trace）再改；测试失败先 `git stash` 对照确认是否既有红。
4. **干完 ≠ 完成**：不自己宣布完成，交**上下文隔离**的子 agent 审（只给要求 / 交付 / 判定线）；签字必须换身份。
5. **同提交同步文档**：改代码那次提交里同步设计稿 / ADR / 台账；提交前 `pnpm check:fast`。
6. **提请裁定用产品语言**：讲流程 / 卡点 / 意图 / 后果，代码只作证据；见「非此即彼」先查单选前提。
7. **规划不是数学**：完本字数 × 单章字数是一等目标，章数是派生落点——只报偏差，不拦截。
8. **并行隔离**：worktree 只准单元测试（禁全量 / `test:browser` / `test:node`，切 ABI 打断所有槽位）；派出去的 agent 不给 `review` / `done`；实机测试 / 验收单实例串跑，跑完必关，残留 Electron 进程＝0。

## 3. 命令

```bash
pnpm dev            # predev 自动探测 better-sqlite3 ABI，不匹配才重建；无需手动 rebuild

# 测试统一走 Electron 运行时（全工程一份 ABI，可与 pnpm dev 并存）
pnpm test <paths>
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <paths>   # *.browser.tsx

pnpm check:fast                                  # 闸门：typecheck + 文档检查（pre-commit 自动跑）
pnpm check:full                                  # 再加 lint + 全量测试（慢，手动）
node scripts/check-doc-placement.mjs --status-of "期 2"   # 收口：把写着该期的位置列全
```

## 4. 要做什么 → 先读什么

> 本机工作记忆在 `.workbuddy/memory/`（**不入库，换机不跟随**）：注入层 `MEMORY.md` + 主题卷 `notes/*.md` + 日志 `YYYY-MM-DD.md`。

| 你要做 | 先读 |
|---|---|
| 放 / 改 / 归档文档 | [`documentation-charter.md`](docs/agents/documentation-charter.md) §4 · [`README.md`](docs/README.md) §3 |
| 改 prompt 组装 / 加改条款 | `design/prompt/prompt-three-layer-inventory.md` · `prompt-clause-admission.md`（三问 + 反例库） |
| 起环境 / 构建报错 / 实机验证 | `notes/env-and-conventions.md`（含 CDP 9222 通道） |
| 动蓝图 / 正文 / 字数 / 弧光 | `notes/generation-pipeline.md` · `notes/prompt-engineering.md` |
| 加列 / 迁移 / 查库 | `notes/data-and-schema.md` · `notes/upstream-invalidation.md` §5（两处黑名单） |
| 找接下来做什么 | [`plans/prompt-assembly-backlog.md`](docs/plans/prompt-assembly-backlog.md) 顶部优先级表 |
| 把活派给外部 agent | [`worktree-parallel.md`](docs/agents/worktree-parallel.md) + `docs/agents/{copilot,workbuddy,doubao,task-board}-channel.md`；任务书里写明**不用交互式提问**，卡点走 relay 投 `bridge\to-owner`；状态靠 relay 推送，**不起轮询监督任务** |
