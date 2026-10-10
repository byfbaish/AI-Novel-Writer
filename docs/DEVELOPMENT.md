# AI-Novel-Writer 开发指南（fork: byfbaish）

> 面向开发者的本地搭建、架构导航与已知痛点修复地图。
> 适用版本：`v1.2.0`（仓库 `package.json` 声明，尚未正式发布；基于上游 `EthanYoQ/AI-Novel-Writer` master）。
> 协议：GPL-3.0（根目录桌面应用）。DeepSeek Harness 插件为独立 MIT 包，不在此文档范围。

---

## 0. 这份文档解决什么

你 fork 本项目是因为上游 Release 太慢、且 DeepSeek 接入体验差。本指南做三件事：

1. 让你能在本地把桌面应用跑起来、改起来；
2. 把代码分层讲清楚，知道改哪；
3. 把你踩到的「超限 / 失败」两类的**真实代码位置**标出来，方便直接动手修。

行内引用的文件路径与行号均对应当前 checkout（`C:\develop\workspace\AI-writer\develop`，commit `8c93403`）。上游若继续推进，行号可能漂移，但文件与符号名稳定。

---

## 1. 环境要求

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **>= 20** | `package.json` `engines.node` 强制 |
| 包管理器 | **pnpm @ 11.11.0** | `package.json` `packageManager` 锁定；用 `corepack enable` 或 `npm i -g pnpm@11.11.0` |
| Electron | 41.x（运行时由依赖引入） | 无需单独安装，但需能下载 Electron 二进制 |
| 操作系统 | Windows x64 / macOS（arm64 & x64） | 主进程有平台相关安全模块（`electron/security/`） |
| 原生模块 | better-sqlite3、LanceDB 等 | `pnpm install` 后由 `prepare-native-for-electron.mjs` 自动 rebuild |

> `.npmrc` 已设 `shamefully-hoist=true` 与 `auto-install-peers=true`，不要删——Electron 原生模块依赖扁平化。
> 国内拉 Electron / electron-builder 二进制慢时，在本机或 CI 覆盖 `ELECTRON_MIRROR` 等环境变量即可，仓库不改。

---

## 2. 首次搭建与常用命令

```bash
# 1) 安装依赖（会触发原生模块 rebuild，耗时较长）
pnpm install

# 2) 启动开发模式：编译 electron/main.ts 并拉起 Electron + Vite HMR
pnpm dev
#   等价于 vite；predev 脚本会先跑 prepare-native-for-electron.mjs
#   渲染进程热更新；主进程改动会重启 Electron

# 3) 类型检查 / 单测 / lint / i18n 覆盖率
pnpm run typecheck
pnpm test
pnpm run lint
pnpm run check:i18n

# 4) 组件文档（Storybook）
pnpm storybook

# 5) 打本地安装包（Windows）
pnpm run build:win-dir        # 生成未打包目录，便于本地验证
pnpm run build:win:artifacts  # 走 release gate 的产物构建
```

> 没有单独的 `electron .` 命令：`vite-plugin-electron/simple` 在 `pnpm dev` 时把 `electron/main.ts` 编译到 watch 模式并自动启动 Electron，指向 Vite dev server。生产入口为 `dist-electron/main.js`（`package.json` 的 `main` 字段）。

---

## 3. 架构总览

本项目是 **Electron + React + TypeScript** 桌面应用，严格分两层：

```
src/                 渲染进程（Renderer）
  components/        React UI（pages / panels / settings / editor / dialogs …）
  stores/            Zustand 状态（agent-store / project-store …）
  services/
    generation/      生成编排（harness / runtime / budget planner）— 纯逻辑，可被主进程复用
    workflows/       工作流命令（蓝图、草稿、角色架构）+ 批量执行器
    prompts/         提示词模板
    agent/           Agent 响应协议与补全
  shared/            跨进程共享类型、Provider 预设、推理策略、契约
  i18n/              中英文文案（messages/）

electron/            主进程（Main）
  main.ts            入口
  controllers/       IPC 处理器（generation / project / finalization / chapter-lifecycle …）
  llm/               Provider 适配层（openai-provider / gemini-provider / generation-parameter-policy）
  repositories/      SQLite 仓储（项目、章节、生成运行记录 …）
  services/          主进程业务服务（generation-run-service 等）
  migrations/        数据库迁移
  security/          平台安全（Windows 文件锁、macOS 沙盒）
  vector-store.ts    LanceDB 知识库
```

### 生成管线的分层（最关键）

```
UI / stores
  └─ agent-store ── 用户配置的模型、输出上限、推理档
       └─ workflows/commands/*          工作流意图与预算（base-command.ts 定义 WORKFLOW_GENERATION_BUDGETS）
            └─ generation/generation-harness.ts   单次物理请求编排（attempt 循环、截止时间、预算校验）
                 └─ CompletionPort  ← 唯一的外部调用接缝（见 §5.3）
                      └─ electron/llm/openai-provider.ts   真正发 HTTP 请求
```

记住一个边界：**`CompletionPort`（`src/services/generation/generation-harness.ts:162`）是生成模块唯一的外部接缝**。所有重试 / 限流 / 超时增强都应集中在这里或 Provider 层，不要在 UI 或工作流层各写一套。

---

## 4. 目录导航（改东西先来这）

| 你想改什么 | 去哪 |
| --- | --- |
| 模型预设 / DeepSeek 默认参数 | `src/shared/provider-presets.ts` |
| 工作流单次/总输出上限 | `src/services/workflows/commands/base-command.ts:108`（`WORKFLOW_GENERATION_BUDGETS`） |
| 全应用绝对安全上限 | `src/services/generation/generation-harness.ts:105`（`GENERATION_ABSOLUTE_BUDGET_LIMITS`） |
| 实际发请求、状态码、重试 | `electron/llm/openai-provider.ts` |
| 单次请求失败如何归类 | `src/services/generation/generation-harness.ts:698`（`catch {}`） |
| 批量章节生成的并发/提交 | `src/services/workflows/structured-batch-executor.ts` |
| 误导用户的报错文案 | `src/services/agent/agent-completion.ts:16`、`src/shared/plot-tree-generation-pure.ts:92` |
| 设置界面里的「最大输出 Token」 | `src/components/settings/` + `src/stores/agent-store.ts` |
| 上游设计决策依据 | `docs/adr/`（ADR-0019 专门讲输出硬上限） |
| 验收台账 / 已知问题 | `docs/research/novel-quality-modernization/g01-issue-ledger.md` |

---

## 5. 你踩到的「超限 / 失败」——真实代码位置与修复地图

> 结论先说：**不是你配置问题**，是产品成熟度缺陷。以下均对应当前 fork 代码（v1.2.0 开发版），其中部分已在 v1.2.0 缓解，但**核心两个坑仍活着**。

### 5.1 「超限」：输出上限三层取最小，且报错文案误导

实际生效的「单次输出上限」是三层取最小：

1. **模型配置默认输出上限**：v1.2.0 已把新建/重置模型的默认值提到 **65536**（`src/stores/agent-store.ts` 等；发布说明第 24 条）。
2. **工作流意图上限** `WORKFLOW_GENERATION_BUDGETS.maxRequestedOutputTokensPerAttempt`：structured / text / character-architecture **三处仍是 8192**（`base-command.ts:112/118/126`）；草稿命令 `generate-draft.command.ts:225` 也是 8192。
3. **全应用绝对安全上限** `GENERATION_ABSOLUTE_BUDGET_LIMITS.maxRequestedOutputTokensPerAttempt`：v1.2.0 从旧硬上限提到 **32768**（`generation-harness.ts:108`）。

→ 对于工作流生成（蓝图/草稿/角色架构），`min(65536, 8192, 32768, 模型能力)` = **8192 仍然兜底生效**。你把模型输出上限填到 60000，日志里看到的仍是 `单次上限 8,192`（见 `generate-draft.command.ts:340` 的日志输出）。

**更糟的是报错文案仍然误导**（v1.2.0 未修）：
- `src/services/agent/agent-completion.ts:16`：
  `AI 输出达到模型最大长度，未将不完整内容写入对话或执行工具。请提高模型最大输出 Tokens 或缩短任务后重试。`
- `src/shared/plot-tree-generation-pure.ts:92`：
  `剧情树输出达到模型最大长度，结果未保存，请提高最大输出 Tokens 或缩短项目资料。`

它让你去调一个**根本救不了**的设置（真正卡你的是工作流层的 8192，不是模型配置）。

**修复切入点：**
- 想立刻放宽：把 `base-command.ts:112/118/126` 与 `generate-draft.command.ts:225` 的 `8192` 调到例如 `32768`（贴着绝对上限）。
- 想根治：让工作流意图上限改为 `min(用户设置, 绝对上限)` 而不是硬编码常量；并**删掉/改写那两句误导文案**，改成「本次工作流单次上限为 N，可在设置中调高模型输出上限至 ≤ 绝对上限 32768」之类真话。

### 5.2 「失败」：瞬时故障无自动重试，但 v1.2.0 已加中断恢复

- **自动重试仍然缺席**：`src/services/workflows/structured-batch-executor.ts` 中**没有任何 retry / transient / backoff / 429 / 503 逻辑**（已全文检索确认）。一次瞬时故障（连接中断 / 502 / 503 / 529 / 超时）仍会让该次物理请求失败。
- **好消息（v1.2.0 已落地）**：发布说明第 9–10 条——生成任务现在**保存执行进度、已收内容与恢复依据**，中断后可查看候选内容并从有效来源继续。这缓解（但未根除）了早期 issue #305「整批成功结果被一次抖动丢弃」的灾难性后果。
- **传输层零重试**：`electron/llm/openai-provider.ts` 单次 `fetch`，非 2xx 直接判死，没有 429/503 处理、不看 `Retry-After`、没有空闲超时。

**修复切入点（推荐在 `CompletionPort` 接缝处做）：**
- 在 `openai-provider.ts` 的 `complete()` 内对 `429/502/503/529` 与 `ECONNRESET`/`ETIMEDOUT` 加**有限指数退避重试**（读 `Retry-After` 头），并把瞬时失败标记为可重试。
- 不要只在 UI 加「Retry」按钮（现有 `generation:retry-draft-short-outline` 是手动重试，issue #330 只是修了它的测试）。

### 5.3 为什么你分不清「超限」还是「失败」：状态码被吞

- 状态其实**有捕获**：`openai-provider.ts:212` 把 `res.status` 写入 `diagnostics.httpStatus`；`:131/:220` 的错误串也带了状态码。
- 但**向上被归一成一句话**：`generation-harness.ts:698` 是个裸 `catch {}`，一律转成 `PROVIDER_REQUEST_FAILED`、文案「模型请求失败。」（仅区分取消 / 截止）。
- 收据里虽有 `failureCode: 'GENERATION_PROVIDER_FAILED' | 'NETWORK_ERROR'`（`generation-harness.ts:186`），但**用户可见层没有把 429 限流、402 余额、503 抖动区分开**。

**修复切入点：**
- 让 `CompletionPort` / provider 把 HTTP 状态码作为结构化字段一路上抛，UI 失败面板（`src/components/panels/ai-output-failure-presentation.ts`）按 `429 / 402 / 5xx / 网络` 给出不同建议。这是体验上性价比最高的一改。

### 5.4 一个可以排除的方向：并发打爆限流

生成走 **promise 队列串行化**（`src/services/generation/generation-runtime.ts`），应用不会并发轰你的限流。所以「是不是我并发太高」可以排除——问题在单次重试缺失与上限硬编码，不在并发。

### 5.5 v1.2.0 已经修好的 DeepSeek 相关项（别重复造轮子）

- 官方 DeepSeek 的 `https://api.deepseek.com` 与 `.../v1` **能力配置已一致化**（发布说明第 25 条）——之前两个端点能力不一致会导致错误估算。
- 通用 OpenAI 协议配置**不再依赖内置型号名单**（第 23 条）；模型名手写也不会再严重退化为保守估算。
- 通过 SiliconFlow（`https://api.siliconflow.cn/v1`）+ `deepseek-ai/DeepSeek-V4-Flash` 可显式选 `high/max` 推理档（第 22 条）。

---

## 6. 提交规范（沿用上游 CONTRIBUTING.md）

- **Issue-first**：PR 必须链接已有 Issue；非琐碎改动先在 Issue 说清问题、场景、验收方式。
- **单一 PR**：一个 PR 只解决一个问题，别混入无关重构/格式化/依赖升级。
- **核验改动**：用 Node 20+ 与指定 pnpm；至少跑 `pnpm run typecheck`、`pnpm test`、`pnpm run lint`、`pnpm run check:i18n`，并在 PR 留存实际命令与结果。
- **AI 辅助允许但你要负责**：生成内容须逐项审阅、能解释实现与风险，否则不提交。
- **脱敏**：公开仓库，禁止上传 API Key、完整正文、私人路径、整包日志。

---

## 7. 调试技巧

- **应用内日志**：失败面板 `ai-output-failure-presentation.ts` 会展示语义失败类别；生成日志里有 `单次上限 / 累计 / max output` 等（`generate-draft.command.ts:340`）。
- **应用日志不落盘**：诊断信息主要在 UI 面板，且状态码在上层已被归一。要抓**真实 HTTP 状态码**，建议在本地挂一个兼容中转 / 代理（如把 Base URL 指向本地代理）看请求与响应头。
- **主进程 DevTools**：Electron 主进程可开 `electron/main.ts` 里相关开关；渲染进程用 Vite HMR + 浏览器 DevTools。
- **精确复现上限问题**：建一个长项目，单章目标字数设高，观察日志里 `max output` 是否被压到 8192。

---

## 8. 建议的开工顺序（如果你想修 DeepSeek 体验）

1. **最低成本、立竿见影**：放宽 `base-command.ts` 与 `generate-draft.command.ts` 的 8192 → 32768，并改写 §5.1 两句误导文案。先让自己用得爽。
2. **中等成本、体验质变**：在 `openai-provider.ts` 的 `complete()` 加 429/5xx 指数退避重试 + `Retry-After` 支持（§5.2）。
3. **高价值、需谨慎**：把 HTTP 状态码结构化上抛，UI 失败面板按类别给建议（§5.3）。
4. 每改一项都走 §6 的核验清单，并写清用户可见变化与测试证据，方便日后向上游提 PR。

---

## 9. 相关链接

- 上游仓库：`https://github.com/EthanYoQ/AI-Novel-Writer`
- 你的 fork：`https://github.com/byfbaish/AI-Novel-Writer`
- 设计决策记录：`docs/adr/`（重点看 `0019-remove-real-call-hard-cap.md`）
- 已知问题验收台账：`docs/research/novel-quality-modernization/g01-issue-ledger.md`
- 贡献规范：`CONTRIBUTING.md`
