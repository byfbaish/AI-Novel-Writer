# D16 实施后实机复验（2026-11-11 晚 · 单轮 dev）

> 状态：已实施（2026-11-11）。本稿只记**实机观察到什么**，不重复实现说明（见
> [`2026-11-07-d9-d16-structural-design-handoff.md`](../2026-11-07-d9-d16-structural-design-handoff.md) §9）。

## 环境

- 启动方式：`$env:AI_NOVEL_UI_DEBUG_PORT='9222'; node node_modules/vite/bin/vite.js`（**不用 `pnpm dev`**，CDP 通道要求）
- Vite `5180` + CDP `9222`（Chrome/146.0.7680.216）
- 项目：`C:\develop\workspace\AI-writer\.batch-a\proj`（「师父派我来除魔，幕后真凶竟是小师妹」）
- 配置默认模型：`ab365b78-…` = `Ollama/qwen3.5:9b-128k`（A，未改动）

## 数据库事实：最近三条 run 的 modelReceipt

```
run       status     at                      model
43fdfcd0  completed  2026-11-11T12:41:27Z    deepseek-flash   ← a2 那轮的 B
0651a65b  cancelled  2026-11-11T12:50:15Z    qwen3.5:9b-128k  ← A
de2e266c  cancelled  2026-11-11T12:51:06Z    qwen3.5:9b-128k  ← A（最近一条）
```

**关键**：12:41 之后还有两条用 A 的 cancelled run ⇒「最近一次实际调用」确实是 A。

## 实测读数（渲染层真实状态，经 CDP 读取）

| 时机 | `actual` | 状态栏 title | 状态栏文本 |
|---|---|---|---|
| 关闭项目 | `null` | `当前模型（配置）：Ollama/qwen3.5:9b-128k` | `Ollama/qwen3.5:9b-128k` |
| 打开项目（7s 后） | `{modelId:'ab365b78…', modelName:'qwen3.5:9b-128k'}` | `当前模型（实际调用）：Ollama/qwen3.5:9b-128k` | 同上 |
| `location.reload()` 后（10s） | 与上行完全一致 | 与上行完全一致 | 同上 |

## 结论：三条通路实机通过

1. **启动期回填（hydration）通了。** 打开项目后 `actual` 从 `null` 变成非空。本次会话**没有跑任何生成**，渲染层 store 是纯内存的，所以这个值**只能**来自主进程 `generation:last-model` —— 该项目的 `generation_runs` 持久化回执。
2. **「重启后仍显示」通了。** `location.reload()` 会让渲染层 store 归零（此时 `actual` 必为 `null`，见上表第一行），10 秒后读到的仍是同一份值且 `actual` 非空 ⇒ 值从持久化 binding 重新回填，不是内存残留。
3. **tooltip 分档通了。** 无实际调用时显示「（配置）」，有实际调用时显示「（实际调用）」，**可见文本不变**（两种状态都是同一个昵称）。
4. **显示名走的是昵称反查。** DB 里 `modelName` 是 `qwen3.5:9b-128k`，状态栏显示 `Ollama/qwen3.5:9b-128k` —— 带前缀的昵称来自 `useLLMStore.models` 按 `modelId` 反查，符合设计 §2.3 的三级优先级。

## 没验到的一条，以及为什么

**「配置 A / 实际 B ⇒ 显示 B」没有在实机上直接观察到。** 原因是数据现状：最近一条 run 是 A，所以显示 A 是**正确行为**，与配置值恰好相同 ⇒ 这个场景区分不出「读实际」与「读配置」。

尝试过构造：把项目复制到 `.runtime-d16/proj-b`，只改副本库里两条 A 的时间戳，让 B（`43fdfcd0`）成为最近一条。结果被主进程拒绝：

```
project:open => success:false, error: "项目未获授权，请重新选择项目目录。", dbReady:true
```

未授权路径必须经文件对话框授权，这是安全设计，**没有绕过**。

替代证据（不宣称等价于实机）：

- 「取哪一条」是 `lastModel()` 的 SQL 语义，已由 `main-generation-owner.test.ts` 的 D16 用例覆盖（`reopen()` 后 `list()[0].model` 与 `lastModel()` 指向同一条回执）；
- 「显示的就是这一条」由本次「显示 A 且 A 恰好是最近一条」自洽印证；
- 「显示名/分档/回填/重载」四条已于上表实机确认，B 与 A 走的是同一段代码、同一通道。

## B16 未实机

内联气泡的冲突提示需要真实制造「选中的正文被改动」场景。本轮**未实机验证**，由
`CodeMirrorEditor-generation.browser.tsx` 13/13 覆盖（真实渲染，含「只出现单句、不含『后续单元不再执行』」断言）。
