# AI 输出面板运行态渲染策略（停流式、只给状态）

> 状态：已实施（作者 2026-10-21 裁定「方案二」）
> 日期：2026-10-21
> 上级稿：无（本稿是一条独立的性能 + 交互决定，不隶属既有设计树）

---

## 1. 现象

作者报：**审稿（剧情串联维度）极吃内存**，任务管理器里 Electron 4 个进程涨到 5GB+，后来到 10GB
不得不手动中止工作流；跑完「似乎」会释放。右下角 AI 输出面板的「思考过程」一直在不停刷新。

## 2. 取证（全部为实机数据，可复现）

| 观察 | 数据 |
|---|---|
| 进程归属 | 全部内存都在**唯一**渲染进程（main 119MB / gpu 152MB / utility 12MB） |
| 增长速率 | 私有内存 +20～40MB/s 持续增长，单线程 ~100% 单核；04:31→04:5x 从 6.3GB 涨到 12.2GB |
| 堆快照对比（1.8GB vs 5GB 两次） | JS 堆净增仅 ~2–3MB（`Error` +1.2MB、`run` 闭包 +1658）⇒ **泄漏不在 V8 堆** |
| 内存探针 `performance.memory` | 峰值仅 95MB ⇒ 探针只读 V8 堆，**结构上看不到这类故障** |
| 模型侧 | `ollama /api/ps` 空、两个 ollama 进程 3 秒内 CPU **+0.0s** ⇒ 模型并未在生成 |
| IPC 速率（`[ipc-rate]`） | 泄漏态 **9–32 次/秒**；最热 `fs:check-exists`。⇒ 不存在「IPC 风暴」 |
| CPU profile（泄漏态，窗口 5.75s） | `<StepOutputBlock>`/`<ThinkingBlock>` 各渲染 **950 次 ≈165 次/秒**；`updateSyncExternalStore` 1,146 次；`get scrollHeight` 自身 **1,251ms（11%）**；GC 828ms |

> 早期一次误判需要留档：从 04:31 的 trace 里数出 `V8Console::runTask` 42,621 次/4.29s，
> 曾据此推断「IPC 风暴 ~5,000 次/秒」。`[ipc-rate]` 实测 9 次/秒后该结论**已作废**——
> console 任务数只说明日志条数，不等于 IPC 次数。

## 3. 根因

```
模型持续吐 reasoning（每分片一次 onReasoning，主进程无节流）
  → IPC 推送 → useWorkflowReasoningStore.append（原实现 text 单调增长、无上限）
  → ActiveRunView 订阅该 store → 整棵 AI 面板子树重渲染         ≈165 次/秒
  → ThinkingBlock 的 effect 读 scrollHeight 强制布局 + 全文重写文本节点   ≈11% CPU
  → 单次成本随文本长度线性上升 ⇒ 总量 O(n²) ⇒ GC 停顿、私有内存一路涨
```

三个放大器：

1. **`onReasoning` 无节流**（`electron/llm/openai-provider.ts` 中相邻的 `onDiagnostics` 有 250ms 节流，
   `onReasoning` 没有）；
2. **`ActiveRunView` 无 memo 且直接订阅 reasoning**，一个分片就让整棵子树（含 Markdown 渲染）重来；
3. **`ThinkingBlock` 每次 `thinking` 变化都读 `scrollHeight`**，每个分片强制一次同步布局。

为什么堆快照看不见：上述产物全是**瞬时**的字符串/布局对象，GC 能回收，但产生速度远超回收速度；
真正涨的是 Blink 侧的文本/布局对象与 V8 大对象空间的碎片，堆快照里只剩几 MB 存活对象。

## 4. 决定（作者 2026-10-21 裁定：方案二）

作者原话：「模型的思考加正文的输出速率实在太快，看也看不清，只要给个状态显示当前正在工作就好。」

- **运行中只渲染状态行**：`正在工作 · 已用 Ns · 距最近有效输出 Ns`，外加审稿专属提示；
- **不做流式正文渲染**：`step.result` 只在**步骤结束/失败**时一次性渲染（含思考过程，静态无光标）；
- **保留一个默认折叠的「查看当前输出（低频）」**：点开才显示，**每 1.5 秒**刷新一次，**只留尾部 8KB**；
- **诊断数据**：reasoning 不再进界面；store 保留尾部 8KB（`MAX_VISIBLE_REASONING_CHARS`）供排查
  「模型是不是在胡说」，`append` 的工作量因此恒定，不随会话长度恶化。

## 5. 实现（文件级）

| 文件 | 改动 |
|---|---|
| `src/components/panels/AIOutputPanel.tsx` | `ActiveRunView` 不再订阅 reasoning store；`StepOutputBlock` 拆成「运行态 = 状态行 + 低频预览」与「结束态 = ThinkingBlock + MarkdownContent」两条分支；新增 `RunningStepStatus`（替代原 `ReviewWaitStatus`）、`LiveOutputPeek`、`useLowFrequencyValue` |
| `src/stores/workflow-reasoning-store.ts` | `append` 结果用 `capTail` 截到尾部 8KB（含「更早的思考已省略」提示），语义仍是同步 append |
| `src/components/panels/__tests__/AIOutputPanel.failed.browser.tsx` | 断言改为「运行态有状态行、**不含**思考文本」 |
| `src/components/panels/__tests__/AIOutputPanel.v3-history.browser.tsx` | 运行态不再断言流式正文，改为断言状态行 + 正文不出现 |

## 6. 参数（嫌占用还高就动这三个，按顺序）

| 参数 | 位置 | 当前值 | 说明 |
|---|---|---|---|
| `LIVE_OUTPUT_REFRESH_MS` | `AIOutputPanel.tsx` | `1_500` | 调大更省（预览刷新更慢）；调小更实时 |
| `LIVE_OUTPUT_TAIL_CHARS` | `AIOutputPanel.tsx` | `8_192` | 预览只保留尾部，决定单次渲染规模 |
| `MAX_VISIBLE_REASONING_CHARS` | `workflow-reasoning-store.ts` | `8_192` | 诊断用思考尾部上限 |

**再进一步（作者批准的降级顺序）**：

1. 直接把 `LiveOutputPeek` 从运行态分支里去掉 —— 状态行独立存在，预览成本归零；
2. 把 `RunningStepStatus` 的 `setInterval` 从 1000ms 提高到 5000ms（计时粒度变粗）；
3. **彻底关掉**：运行态连状态行都不渲染，只保留顶部进度条与「中止生成」。

## 7. 验证方法

1. 跑一轮审稿：任务管理器里渲染进程内存曲线应当**基本平**，不再出现 +40MB/s 的斜率；
2. DevTools 性能录制 5 秒：`<StepOutputBlock>` 渲染应从 ~165 次/秒降到 **≤4 次/秒**，
   `get scrollHeight` 应从 11% 降到接近 0；
3. `[mem] prompt.build` 的峰值应当只与 attempt 次数相关，不再随生成时长增长；
4. 回归：`AIOutputPanel.*.browser.tsx`（39 条）+ `workflow-main-reasoning.test.ts` 全绿。

## 8. 回退

若要恢复流式显示：在 `StepOutputBlock` 运行态分支挂回 `MarkdownContent`/`ThinkingBlock`，
并恢复 `ActiveRunView` 的 reasoning 订阅。**但必须同时**给 `onReasoning` 加节流，
否则会立刻回到本稿记录的 O(n²) 状态。

## 9. 本稿未纳入的后续（另一条线，别混进来）

- **主进程 `onReasoning` 仍无节流**：渲染层不再消费它，暂不动；一旦恢复流式显示，先在主进程加节流；
- **每次 attempt 的固定开销**：`[mem] prompt.build` ≈ +26MB、`[mem] trace.flush` ≈ +7.3MB，
  且 `SkillRegistry.loadAllAtomic` 每次从磁盘重载全部 skills —— 属提示词装配/追踪线；
- **模型退化重复**（写 JSON 的审稿任务却无限思考、永不 `stop`）：属生成侧，需要输出上限或重复检测；
- **`MainDraftRecoverySection` 的重查频率**：`generation:snapshot` 每来一次就整轮重查
  （`generation:list` + 每个 run 一次 `read-context` + 每个审稿 run 一次 `probe-recovery`），
  实测 21 次 `read-context`/秒。建议对该事件做 300–500ms 合并，本稿未改；
- **排查工具**（本稿新增，dev-only）：`src/services/debug/ipc-rate-meter.ts`（按通道的 IPC 速率 +
  热点通道首次调用栈）、`src/services/debug/microtask-probe.ts`（`queueMicrotask` 排队调用方，
  用于抓「微任务频率的自激 setState」）。两者生产环境零开销、不注册常驻定时器。
