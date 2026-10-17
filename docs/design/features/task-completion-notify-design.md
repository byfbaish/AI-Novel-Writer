# 任务完成提示 · 统一宿主与热插拔注册设计

> 状态：**已列入待办**（2026-10-17 作者裁定：先做系统级通知 → [`system-notification-design.md`](system-notification-design.md)；本稿顺延，届时两稿注册表可合并为双输出「完成通知中心」）
> 日期：2026-10-17
> 分支：`dev_byf`
> 上级稿：无（独立功能设计）

## 1. 背景与问题定义

作者诉求：「每一项任务完成之后，也没个提示什么的。能不能规划出来一个热插拔式的提示组件？」

**取证结论：组件不是没有，而是「任务完成 → 提示」这条链是散装的。** 分三层：

### 1.1 呈现层：两套并行实现

| | [`Toast.tsx`](../../../src/components/ui/Toast.tsx) | [`ActionToast.tsx`](../../../src/components/ui/ActionToast.tsx) |
|---|---|---|
| API | `toast.success/error/warning/info(msg, duration?)` | `actionToast.show({type, message, actions, duration})` + `workflowComplete(msg, open?)` |
| 类型 | success / error / warning / info | success / info / warning / ai |
| 挂载 | 自建 `#ai-novel-toast-root`，独立 `createRoot` | 自建 `#ai-novel-action-toast-root`，独立 `createRoot` |
| z-index | 9999 | 9998 |
| 位置 | bottom-10 right-5，maxWidth 380 | bottom-48 right-20，maxWidth 400 |
| 竞态处理 | `requestAnimationFrame` 等下一帧 | `_pendingItems` + `queueMicrotask` |
| 实质差异 | **仅「有无操作按钮」** | 同左 |

调用点实测：`toast.*` 50+ 处（多为 error/warning），`actionToast.*` 4 处（3 处 `workflowComplete` + 1 处 UpdateNotifier）。

**问题**：选哪套靠口头约定；两个容器、两套定时器、两个 z-index，同时弹出时堆叠顺序不归一个系统管。

### 1.2 分发层：全部内联在 App.tsx

`App.tsx` 单个 `useEffect` 内挂 4 段事件订阅（`src/App.tsx:147-309`）：

| # | 事件 | 行为 | 位置 |
|---|---|---|---|
| ① | `WORKFLOW_COMPLETE` | 通用「「XX」已完成」+「打开查看」跳 AI 面板 | `:147-161` |
| ② | `WORKFLOW_COMPLETE` | 蓝图/导入完成后，有待建卡角色则提示（config 开关 + pending 计算） | `:210-255` |
| ③ | `WORKFLOW_COMPLETE` | 大纲完成后建议补角色卡（config 开关 + dismissed 持久化 + duration 0 不自动消失） | `:259-309` |
| ④ | `FINALIZE_COMPLETE` | 自动开下一章创作窗（**流程后处理，不是提示**） | `:163-206` |

每段重复同一套样板：`sameProjectSessionContext` 校验（② 验 4 次）→ `useWorkflowStore.getState()` 查 run → `ipc.invoke('config:get')` → `useLocaleStore.getState().text`。**新增一个完成提示场景 = 改 App 主组件加第五段** —— 这就是「不热插拔」的实体。

### 1.3 覆盖层：无矩阵，缺不缺全凭感觉

`WORKFLOW_COMPLETE` 的 emit 点已经收敛为**唯一一处**（`workflow-store.ts:928`，8 种 `WorkflowType` 共用）；`FINALIZE_COMPLETE` emit 于 `finalize-chapter.command.ts:476`。但「哪个任务完成了给用户什么提示」没有成文清单，作者感知「没提示」与代码「有通用 toast」之间的落差正来源于此（详见 §5 覆盖矩阵）。

## 2. 设计目标与非目标

**目标**：
1. **单一宿主**：两套 Toast 合并为一个渲染宿主，差异收敛为卡片形态 prop；`toast.*` / `actionToast.*` 门面 API 保留，50+ 调用点零改动。
2. **注册表分发**：完成提示以「处理器」形式注册（`registerCompletionNotifier`），App 只保留一个订阅器做公共前置 + 分发；**新增提示场景零改 App**。
3. **覆盖矩阵成文**：8 种 `WorkflowType` × 现状 × 建议逐行列出，作为作者裁定输入（本稿只给矩阵，不擅自补场景）。
4. 每期可独立回滚，任何一期都不改 `event-bus.ts` / `workflow-store.ts` 的 emit 点。

**非目标**：
- 不改 `globalEventBus`、不改 emit 点、不改 `WorkflowType` 枚举。
- 不做「任务进度中」的持续提示（进行态由现有 AI 面板/任务面板承载）。
- 不新增设置项（M3 若补场景再议）。
- FINALIZE_COMPLETE 的「自动开下一章」（④）是流程后处理不是提示，建议同批从 App.tsx 迁出到独立模块，但不属本设计核心，标注为附赠清理。

## 3. 总体架构

```
                    ┌────────────────────────────────┐
                    │ workflow-store.ts:928（唯一emit）│
                    │ finalize-chapter.command.ts:476 │
                    └───────────────┬────────────────┘
                                    │ WORKFLOW_COMPLETE / FINALIZE_COMPLETE
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ CompletionNotifierHub（App 内唯一订阅点，M2 引入）                 │
│  公共前置（收编现有 4 段样板）：                                    │
│   · session 匹配校验（sameProjectSessionContext）                  │
│   · run 查询（activeRuns ∪ history，按 runId）                     │
│   · 事件 → 注册表分发（一个事件，多个匹配处理器各自产卡）              │
└───────────────┬─────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 注册表 registry（模块加载时静态注册，installCompletionNotifiers）   │
│  · default-complete        通用「已完成」+ 打开查看（收编①）        │
│  · blueprint-character     待建卡角色（收编②，含 config 开关）      │
│  · outline-nudge           大纲补角色卡（收编③，含开关+持久化）     │
│  · 〈未来场景〉             export / post_process / … 自行注册     │
└───────────────┬─────────────────────────────────────────────────┘
                ▼ 处理器返回 { message, actions?, duration? } | null
┌─────────────────────────────────────────────────────────────────┐
│ NotifyHost（M1 合并：单 createRoot 单容器 #ai-novel-notify-root）  │
│  · PlainCard（原 Toast.tsx 卡片，纯文本）                          │
│  · ActionCard（原 ActionToast.tsx 卡片，带按钮）                   │
│  · 统一队列 / 堆叠 / 位置 / 动画                                   │
└─────────────────────────────────────────────────────────────────┘
```

**关键决策与理由**：

| 决策 | 主张 | 理由 |
|---|---|---|
| 合并 vs 保留两套 | **合并宿主，保留两个门面 API** | 双 createRoot/双容器/双 z-index 是纯负债；plain/action 只是卡片形态差异，不是两个系统 |
| 分发语义 | **一事件 → 多处理器，各自独立产卡** | 与现状 4 段订阅并行语义一致 ⇒ 迁移**零行为变化**；② 在 ① 之后弹出正是现状 |
| 「不提示」的表达 | 处理器返回 `null` | ② 的「无候选不提示（空通知是纯噪声）」等静默逻辑保留在处理器内，不进框架 |
| 注册时机 | 模块加载静态注册 + `installCompletionNotifiers()` 一次装配；测试可 reset | 与 `initProjectService()` 同模式（App.tsx:142），项目已有先例 |
| session 校验 | **收编到 Hub 前置**，处理器不再写 | 这是消除样板的根本；处理器拿到的是「已校验」的 ctx |
| 配置开关 | 保留现有三个 config 键，作为处理器内判断 | 不新建设置项；开关语义本来就是场景属性不是框架属性 |

## 4. API 设计

### 4.1 命令式门面（保留，零改动）

```ts
import { toast } from '@/components/ui/Toast'        // 50+ 处调用点不动
import { actionToast } from '@/components/ui/ActionToast'
toast.success('已清空全部蓝图')
actionToast.show({ type: 'warning', duration: 0, message, actions })
```

### 4.2 注册式（新，热插拔核心）

```ts
// src/components/ui/CompletionNotifier.ts（新文件，M2）
export interface CompletionNotifyContext {
  run: WorkflowRun            // 已按 runId 查实（activeRuns ∪ history）
  projectSession: ProjectSessionContext
  event: 'WORKFLOW_COMPLETE' | 'FINALIZE_COMPLETE'
}

export interface CompletionNotifier {
  id: string                              // 去重键；同 id 重复注册后者覆盖（热替换）
  events?: Array<'WORKFLOW_COMPLETE' | 'FINALIZE_COMPLETE'>  // 默认两者都收
  notify: (ctx: CompletionNotifyContext) =>
    | { message: string; actions?: ActionToastAction[]; duration?: number }
    | null | Promise<…>
}

export function registerCompletionNotifier(n: CompletionNotifier): () => void  // 返回注销函数（热拔出）
export function installCompletionNotifiers(): void   // App 调一次；resetCompletionNotifiers() 供测试
```

### 4.3 现有 4 段订阅的迁移映射

| 现状 | 迁移后 | 行为等价要点 |
|---|---|---|
| ① 通用完成提示 | `default-complete` 处理器 | 「打开查看」仍跳 `openRightPanel('ai-output')`；duration 10000（有动作）/6000 |
| ② 待建卡角色 | `blueprint-character` 处理器 | 保留 `autoPromptBlueprintCharacterSync` 开关、全量候选查询、slice(0,3) 文案、跳 characters 侧栏 |
| ③ 大纲补角色卡 | `outline-nudge` 处理器 | 保留开关、`shouldNudge…`/`rearm/dismiss…` 持久化、`duration: 0`、双按钮 |
| ④ 自动开下一章 | **迁出 App.tsx** 至 `services/finalize-next-chapter.ts`（非提示，附赠清理） | 保留 `autoOpenNextChapterAfterFinalize` 开关、`source === 'batch'` 跳过、多次 session 复校验 |

## 5. 覆盖矩阵（作者裁定输入）

> 本稿**只列矩阵不补场景**。「建议」列是待裁项，作者圈定后进 M3。

| WorkflowType / 事件 | 现状提示 | 缺口判断 | 建议（待裁） |
|---|---|---|---|
| `architecture_generation`（架构生成） | ① 通用 + ③ 补角色卡提醒 | 通用提示的「打开查看」跳 AI 面板，对该类结果不贴切 | 「打开查看」改跳右栏对应视图 |
| `directory`（目录/蓝图） | ① 通用 + ② 待建卡 | 同左 | 同左 |
| `novel_import`（导入小说） | ① 通用 + ② 待建卡 | 同左 | 同左 |
| `chapter_creation`（章节创作） | ① 通用 | 「打开查看」跳 AI 面板合理 | 维持 |
| `batch_generate`（批量生成） | ① 通用 | 批量场景单章 toast 可能刷屏 | 汇总为「N 章已完成」一条（待裁） |
| `config_generation`（智能配置） | ① 通用 | — | 维持 |
| `post_process`（后处理） | ① 通用 | — | 维持 |
| `new_project_setup`（新项目） | ① 通用 | — | 维持 |
| `FINALIZE_COMPLETE`（定稿） | **无提示**（④只开窗） | 作者裁「自动开窗」已覆盖反馈，但窗被关掉后无痕迹 | 补一条轻提示（待裁，可能不需要） |
| `WORKFLOW_ERROR` | 有 AlertDialog（`alertError()`） | 错误链独立且完整 | 不碰 |

## 6. 分期实施计划

> 每期独立提交、独立可回滚；任何期不动 emit 点、不动 50+ 命令式调用点。

### M1 · 合并渲染宿主（纯内部重构，行为不变）

- 新增 `NotifyHost.tsx`：单容器 `#ai-novel-notify-root`、单 createRoot、统一队列；`Toast.tsx` / `ActionToast.tsx` 的卡片组件**原样搬入**为 `PlainCard` / `ActionCard`，各自导出门面不变。
- 视觉基准以 ActionToast 为准（更新、更宽 400）；Toast 的 `requestAnimationFrame` 竞态处理与 ActionToast 的 `_pendingItems` 统一为一套（取 ActionToast 方案，它有 pending + dismissed 两态更稳）。
- `workflowComplete` 的 locale-store 内部依赖改为调用方传 `text`（解耦，便于测试）。
- 验收：tsc 0；eslint 0 warning（`--max-warnings 0`）；`Toast.stories.tsx` 与 UpdateNotifier 浏览器测试绿；两门面 API 现有调用点全绿。
- **视觉回归**：合并前后右下角逐帧截图比对（位置/宽度/动画/堆叠）。

### M2 · 注册表 + Hub 收编 App.tsx

- 新增 `CompletionNotifier.ts`（§4.2 API）+ 三个处理器文件（§4.3 映射）。
- `App.tsx` 的 ①②③ 三段删除，换为 `installCompletionNotifiers()` 一次调用；④ 迁出到独立模块。
- Hub 公共前置：session 校验 + run 查询 + 分发；处理器抛错不影响其他处理器（try/catch 隔离，与 ②③ 现状的 `console.warn` 兜底一致）。
- 验收：`app-workflow-complete.test.ts`（现有，mock 点随合并调整）+ 新增注册表单测（注册/覆盖/注销/null 返回/config 开关/处理器异常隔离）；App.tsx 净减约 120 行；**行为逐条比对**（①②③ 的 message 文案、duration、跳转目标与迁移前一致）。

### M3 · 覆盖矩阵落地（依赖作者裁定 §5）

- 仅实施作者圈定的项；每项一个处理器，零改 App。
- 若涉及补 emit（如某任务完成无事件），必须评估是否踩「单一 emit 点」原则——**优先复用现有事件，不新增事件类型**。

## 7. 风险与红线

| 风险 | 缓解 |
|---|---|
| 合并宿主视觉回归 | M1 以 ActionCard 为基准 + 逐帧截图比对 + storybook 兜底 |
| ②③ 的行为细节迁移丢失（duration 10000/6000、`rearm` 时机、slice(0,3) 文案、dismissed 持久化） | §4.3 映射表逐项核对；迁移前先给每场景记一条金样本文案 |
| `app-workflow-complete.test.ts` mock 的是 `actionToast.workflowComplete` | M1/M2 后 mock 点改为注册表或新门面，**测试断言的行为不变** |
| 处理器异步竞态（②③ 现有多次 session 复校验是为了 ipc 往返期间项目被切换） | Hub 前置只校验一次；处理器内 ipc 往返后的**最终校验保留**（这是判据级细节，不能省） |
| 「一事件多卡」刷屏 | 矩阵 §5 由作者裁；batch 汇总是待裁项不是默认项 |
| 触碰 emit 点 / event-bus | **红线**：M1–M3 都不改；WORKFLOW_COMPLETE 唯一 emit 点是现有优良性质 |

## 8. 验收标准（汇总）

1. `toast.*` / `actionToast.*` 门面 API 与全部现有调用点**零改动**通过。
2. App.tsx 完成提示相关订阅收敛为一次 `installCompletionNotifiers()`；新增提示场景的样板 = 一个处理器文件。
3. ①②③ 迁移前后 message/duration/actions/跳转**逐项一致**（金样本文案比对）。
4. tsc 0 · eslint 0 warning · 相关测试全绿（含 `app-workflow-complete` 与新增注册表测试）。
5. 提交前 `node scripts/check-doc-links.mjs` 通过。

## 9. 待作者裁定项

1. §5 矩阵中哪些「建议」进 M3（尤其：batch 汇总、FINALIZE 补提示、「打开查看」按类型分流）。
2. ④「自动开下一章」是否同批迁出 App.tsx（附赠清理，不做也可）。
3. M1 合并宿主时，Toast 旧卡片的 maxWidth 380 → 400 是否可接受（以 ActionCard 为基准）。
