# 系统级通知与声音提醒设计

> 状态：**已裁定（5/5）· 待作者发话开工** —— 2026-10-17 21:4x 作者裁毕全部待定项（结论见 §9）；作者明示**仍在运行使用项目，裁定后先不接入代码**，N1 待作者发话再动工。
> 日期：2026-10-17
> 分支：`dev_byf`
> 上级稿：无（独立功能设计；与 `task-completion-notify-design.md` 的关系见 §8）

## 1. 背景

作者诉求：「现在我想要的是弹系统级通知，因为还有声音提醒。」

- 应用内 toast 的规划稿（[`task-completion-notify-design.md`](task-completion-notify-design.md)）**保留为后续待办**（作者 2026-10-17 裁定先做系统级），已登记台账。
- 取证：本项目**零系统通知、零声音播放**（`electron/` 与 `src/` 全仓 grep `Notification` / `new Audio` / 音频文件均无命中）——是全新功能，但**触发事件源已经就绪**。

## 2. 取证：现成的基础设施

| 层 | 现状 | 位置 |
|---|---|---|
| 触发事件 | `WORKFLOW_COMPLETE` **唯一 emit 点**（8 种 `WorkflowType` 共用）；`FINALIZE_COMPLETE`；`WORKFLOW_ERROR` | `workflow-store.ts:928` · `finalize-chapter.command.ts:476` · `event-bus.ts:135`（`AppLogger.error`） |
| 主进程 | Electron 41；模块级 `win` 句柄；`publishUpdateState` 是现成的主→渲染推送范式 | `main.ts:70,136` |
| IPC | 多 controller 注册模式；通道类型集中于 `shared/ipc-channels.ts`；preload 对 `invoke/on` 通用透传（新通道 = 加类型 + 加 handler） | `ipc-handlers.ts` · `preload.ts:12-36` |
| 配置 | `GlobalConfig` + `DEFAULT_GLOBAL_CONFIG`；`config:get/set`（浅合并写入） | `config-utils.ts:124` · `config-controller.ts` |
| 设置 UI | `SettingsModal` 11 个 tab，每 tab 独立组件 | `src/components/settings/` |
| 静态资源 | `public/` 由 `VITE_PUBLIC` 机制管理（dev → `public/`，prod → `dist/`） | `main.ts:66-68` |

**⚠️ 取证发现的坑（实施必读）**：`readJsonFile` 在配置文件存在时**原样返回文件内容，不与 `DEFAULT_GLOBAL_CONFIG` 逐字段合并**（`config-utils.ts:43-50`）⇒ 旧配置文件必然缺本设计新增的字段 ⇒ 两条路二选一：① `config:get` 返回前做 `{...DEFAULT, ...file}` 浅合并（顺带修复所有未来新字段的同类问题，推荐）；② 使用侧一律宽容判断（`x !== false`）。本设计按 ① 实现，使用侧同时保持宽容。

## 3. 设计目标与非目标

**目标**：
1. 任务完成 / 失败 → **OS 原生通知**（Windows toast / macOS 通知中心 / Linux notify-osd）。
2. 可配置的**声音提醒**，音量、静音、试听。
3. 触发规则**可注册**（热插拔）：新增场景 = 加一条规则，不改主结构。
4. 设置项 + 设置 UI。

**非目标**：
- 不做通知历史/通知中心（OS 自带）。
- 不引原生音频依赖（不装 `play-sound` 之类）。
- 不改 `globalEventBus`、不改任何 emit 点（红线：单一 emit 点是现有优良性质）。
- 不碰 DB schema（config 是 JSON 文件，与 schema 红线无关）。

## 4. 核心设计决策

### 4.1 通知走主进程，声音走渲染进程

- **系统通知必须主进程发**：`new Notification()` 在主进程是 Electron 官方路径；点击回调里能直接 `win.show()` + `win.focus()` 把作者带回应用；macOS 授权流程主控。渲染进程的 `Notification` 在 Electron 虽可用，但点击回窗口、权限管理都要绕。
- **声音在渲染进程播**：主进程没有零依赖的音频播放方案；渲染进程 Web Audio API 合成 + `public/` 资源是现成能力，跨平台一致。
- 两者由渲染进程的「通知中心」编排：一次任务完成 → 同时请求主进程发 OS 通知 + 本地播声音。

### 4.2 智能抑制（关键，决定好不好用）

**应用窗口处于激活状态时，默认不弹 OS 通知**（声音独立开关）。作者盯着界面做事时，右上角/右下角弹系统 toast 是纯骚扰——这是系统通知类功能的通行做法（VS Code / Slack 同款：focused 不通知）。
- 主进程判断：`win.isFocused()` / `win.isMinimized()`，仅失焦或最小化时发送。
- 抑制时 IPC 返回 `reason: 'suppressed-focused'`，调用方可选改为仅播声音。
- **失败通知同样走聚焦抑制**（作者裁定「按建议」）：失败链另有 AlertDialog 强提示兜底，系统通知只作辅助，不需要“始终弹”。

### 4.3 合并抑制：3 秒同类只留最后一条

一次 workflow run 完成 = 一条通知（run 级事件天然不刷屏）；但连续多个 run 完成（如批量链自动开下一章）会连弹 ⇒ 同 `ruleId` 的通知 3 秒内只保留最后一条。

### 4.4 声音：Web Audio 合成（零二进制资源）

不往仓库放音频文件：
- `complete`：两声上行轻钟（C5→G5，正弦，各 ~120ms，指数衰减）
- `error`：单声低鸣（A4→E4 下行，三角波，~200ms）
- 合成参数集中在 `notification-sounds.ts` 一处；后续想换采样文件只改这一处（`public/sounds/` 路径预留）。

理由：仓库卫生（不引二进制）、无版权问题、跨平台听感一致、音量/静音/试听全由 config 控制。音效质感上限有限——列为待裁项（§9.2）。

## 5. 架构

```
渲染进程 globalEventBus（WORKFLOW_COMPLETE / FINALIZE_COMPLETE / WORKFLOW_ERROR）
        │
        ▼
┌─────────────────────────────────────────────┐
│ SystemNotifyHub（src/services/system-notify/）│
│  · 注册表 rules[]（可插拔，见 §5.2）            │
│  · 3 秒同类合并抑制                            │
│  · 声音：Web Audio 合成 + 音量 / 静音          │
└──────┬───────────────────────────┬──────────┘
       │ ipc.invoke                │ AudioContext（本地播放）
       ▼                           ▼
主进程 NotificationController      扬声器
  · 聚焦抑制（win.isFocused）
  · new Notification({ title, body, icon })
  · click → win.show/focus + 路由回传
  · macOS 授权查询 / 请求
```

### 5.1 IPC 通道（新增，`shared/ipc-channels.ts`）

```ts
export interface SystemNotificationChannels {
  'system-notification:show': {
    args: [options: {
      title: string
      body: string
      /** 声音在渲染进程播放，此 id 仅供日志/将来主进程扩展 */
      sound?: 'complete' | 'error'
      /** 点击通知后的跳转意图，由渲染进程消费 */
      route?: 'ai-output' | 'editor' | 'characters'
    }]
    return: {
      shown: boolean
      reason?: 'unsupported' | 'permission-denied' | 'suppressed-focused' | 'suppressed-cooldown'
    }
  }
  'system-notification:permission': {
    args: []
    return: 'granted' | 'denied' | 'default' | 'unsupported'
  }
}
```

点击通知后，主进程 `webContents.send('system-notification:activated', { route })` 回渲染进程，由渲染侧 layout-store 执行跳转（复用 `openRightPanel` / `setSidebarView` 等现有能力，不新造导航）。

### 5.2 注册表（热插拔核心）

```ts
// src/services/system-notify/rules.ts
export interface SystemNotifyRule {
  id: string                                    // 去重键；同 id 重复注册后者覆盖（热替换）
  events: GlobalEventType[]                     // 订阅哪些完成类事件
  build: (payload: unknown, ctx: NotifyCtx) => SystemNotifyPayload | null  // null = 不提示
}

export function registerSystemNotifyRule(rule: SystemNotifyRule): () => void  // 返回注销函数（热拔出）
```

`NotifyCtx` 提供：已做 session 校验的项目上下文、run 查询结果（`activeRuns ∪ history` 按 runId）、`text()` 双语函数、config 快照。规则只写差异化逻辑，不写样板。

**内置规则（默认集）**：

| id | 事件 | 文案 | 声音 | route |
|---|---|---|---|---|
| `workflow-complete` | `WORKFLOW_COMPLETE` | 按 run.type 分流，见下表 | complete | 按 run.type 分流 |
| `workflow-error` | `WORKFLOW_ERROR` | 「「XX」失败」 | error | `ai-output` |
| `finalize-complete` | `FINALIZE_COMPLETE` | 「第 N 章已定稿」 | complete | `editor` |

**`workflow-complete` 按类型分流表**（作者裁定「可以」）：

| run.type | 文案 | route | 说明 |
|---|---|---|---|
| `batch_generate` | 「N 章批量生成已完成」 | `editor` | N 取 run 元数据；**取不到则退化为通用文案**（不猜数据来源，实施时确认） |
| `chapter_creation` | 「「XX」已完成」 | `editor` | 产物是章节草稿 |
| `architecture_generation` | 「「XX」已完成」 | `editor` | 产物是架构文件 |
| `directory` | 「「XX」已完成」 | `editor` | 产物是蓝图 |
| `novel_import` | 「「XX」已完成」 | `editor` | 导入结果 |
| `config_generation` / `post_process` / `new_project_setup` | 「「XX」已完成」 | `ai-output` | 无明确编辑器产物，沿用现状右栏 |

**route 语义（保守定义，防打断作者）**：
- `ai-output` = `openRightPanel('ai-output')`（沿用 App.tsx 现状行为）。
- `editor` = **仅聚焦编辑器区域，不自动打开产物文件**——自动开文件会覆盖作者当前打开的内容，打断创作；是否自动开由实施时按类型单独评估，默认不开。

### 5.3 配置项（`GlobalConfig` 增量）

```ts
systemNotificationEnabled: boolean       // 总开关
notificationSoundEnabled: boolean        // 声音开关
notificationSoundVolume: number          // 0–1
notificationOnlyWhenUnfocused: boolean   // 聚焦抑制开关
```

**默认值已裁定**：`true / true / 0.6 / true`（作者「1: 都开」）。

写入安全：`config:set` 是浅合并；读取侧按 §2 处理旧文件缺字段。
**默认值落地方式（跟随项目现有模式）**：EditorSection 三个既有开关用的就是**使用侧宽容判断**（`config.autoPromptBlueprintCharacterSync !== false`，`SettingsModal.tsx:1306-1308`）——本功能沿用同模式（`!== false` / `=== true`），不依赖 config:get 合并也能正确取默认值。`config:get` 浅合并（§2）仍建议顺手修（消隐性 bug），但降为可选，不阻塞 N1。

### 5.4 设置 UI（已裁定：并入「编辑器」tab，不新建 tab）

落点 = `SettingsModal.tsx` 的 `EditorSection()`（`:1288`）——该区已有三个同族开关（自动开下一章 / 蓝图建卡提示 / 大纲补卡提示，均为「任务完成后的自动行为」），通知设置属同族，且作者裁定「放进编辑器 tab」。

新增控件（照该区现有开关模式：useState 宽容初值 → `config:get` 加载 → `config:set` 保存 → 失败回滚 + 错误文案）：

- 系统通知总开关（默认开）
- 声音提醒开关（默认开）
- 音量滑条（0–1，默认 0.6）
- 「聚焦时不弹通知」开关（默认开，附一句说明：窗口正在前台时只播音、不弹系统通知）
- 「试听」按钮（直接播合成音，不依赖真实任务；macOS 授权状态在被拒时显示手动开启指引）
- 文案走 `text(zh, en)` 双语模式，与该区一致

## 6. 分期实施计划

> 每期独立提交、独立可回滚；任何期不碰 emit 点、不碰 DB schema。

### N1 · 主进程闭环 + 一条规则

- 主进程 `NotificationController`（新 controller，挂进 `registerIPCHandlers()`）：`system-notification:show` / `system-notification:permission` 两个 handler；聚焦抑制；点击 → `show/focus` + `webContents.send('system-notification:activated')`。
- 渲染侧 `SystemNotifyHub` 骨架 + `workflow-complete` 一条规则（含按类型分流表，§5.2；session 校验收编到 Hub）。
- config 四键（默认值走使用侧宽容，§5.3）；`config:get` 浅合并修复（可选，§2）。
- 设置区并入 `EditorSection`（§5.4）。
- 验收：任务完成 → OS 弹出通知；点击 → 窗口回前台并跳对应面板；窗口激活时不弹（返回 suppressed-focused）。

### N2 · 声音 + 全规则

- `notification-sounds.ts`：Web Audio 合成 `complete` / `error`；播放带音量/静音；设置 tab「试听」。
- `workflow-error` / `finalize-complete` 两条规则。
- 验收：完成/失败有区分音；静音/音量生效；`WORKFLOW_ERROR` 与 `FINALIZE_COMPLETE` 触发通知。

### N3 · 抑制完善 + 注册表测试

- 3 秒同类合并；批量连弹场景人工验证。
- 注册表单测：注册/热替换/注销/null 返回/cooldown 合并；`app-workflow-complete` 现有测试不受影响（本功能不改其断言面）。
- 验收：连续两个 run 完成只弹一条；测试全绿；tsc 0；eslint 0 warning。

## 7. 风险与红线

| 风险 | 缓解 |
|---|---|
| macOS 授权被拒 | `system-notification:permission` 查询 + 设置 tab 显示状态与手动开启指引；被拒不崩，返回 reason 降级 |
| Linux 无 notify 服务 | `Notification.isSupported()` 检查，unsupported 返回 reason，静默降级 |
| dev 期频繁弹扰 | 聚焦抑制默认开（§4.2）+ 3 秒合并（§4.3） |
| 旧 config 缺字段 | §2 坑：`config:get` 浅合并 + 使用侧宽容双保险 |
| 批量链连弹 | run 级事件一次一条 + cooldown 合并 |
| 合成音听感上限 | 参数集中可调；`public/sounds/` 文件路径预留；作者试听后裁（§9.2） |
| 点击路由落空 | route 回传后由 layout-store 执行；面板未开时先开面板再定位（复用现有 openRightPanel 语义） |
| 触碰 emit 点 / event-bus | **红线**：N1–N3 只消费不生产事件 |
| 触碰 DB schema | 不涉及（config = JSON 文件） |

## 8. 与既有设计稿的关系

- [`task-completion-notify-design.md`](task-completion-notify-design.md)（应用内 toast 热插拔）：作者 2026-10-17 裁定**优先做本稿**，旧稿保留为后续待办并登记台账。
- 两者共享「注册表」思想但输出层不同（OS 通知 vs 应用内卡片）。若将来都实施，可合并为「完成通知中心」双输出。本稿注册表按可扩展设计：规则返回结构化 payload，输出层（OS 通知 / 应用内卡片 / 将来别的）可增可减，规则不用改。

## 9. 裁定记录（2026-10-17 21:4x，作者 5/5 全裁）

| # | 议题 | 作者裁定 | 落点 |
|---|---|---|---|
| 1 | 默认值 | **「都开」**——系统通知默认开 + 聚焦抑制默认开 | §5.3：`true / true / 0.6 / true` |
| 2 | 声音方案 | **「合成」**——Web Audio 合成，不内置 wav | §4.4 |
| 3 | 按类型分流 | **「可以」**——`WORKFLOW_COMPLETE` 按 run.type 分流文案/route | §5.2 分流表（batch 汇总；N 取不到则退化通用） |
| 4 | 失败通知 | **「按建议」**——同样走聚焦抑制 | §4.2 |
| 5 | 设置位置 | **「放进编辑器 tab」**——并入 `EditorSection`，不新建 tab | §5.4 |

**附加约束（作者原话）**：「先不要接入，我还在使用运行项目」⇒ 裁定只改设计稿与台账，**代码零改动**；N1 待作者明确发话再开工。
