# B16 · 编辑器内联来源冲突文案（2026-11-11 实机逐字采集）

- 环境：单轮 dev（5180 / CDP 9222），项目 `.batch-a\proj`，第 2 章正文（2052 字）
- 动作链：`EditorView` 设选区（前 24 字）→ 点「润色」→ 等「替换」由 disabled 变可用（46s，模型 A `Ollama/qwen3.5:9b-128k`）→ 改动正文 → 点「替换」

## 一、实机拿到的三类文案（逐字）

### 1. 候选生成成功（内联气泡）

```
润色预览
“身无分文，按律当罚。”赵铎将这话重重砸在冰冷的石台上，语调平直冷硬，不留半分余地。
取消   替换
```

### 2. 改正文后点「替换」→ 内联气泡显示的提示（本次实机命中）

```
正文或原目标已变化，结果未应用；你仍可复制预览内容
```

DOM（最小承载者）：

```html
<div class="text-xs leading-relaxed mb-3" style="color: var(--color-error-text);">
  正文或原目标已变化，结果未应用；你仍可复制预览内容
</div>
```

来源：`CodeMirrorEditor.tsx:729-735`（`targetStillCurrent` 判定失败分支）。

### 3. 「来源已变化」两条并列文案（AI 输出面板，`SourceConflictNotice`）

```html
<div role="status" class="space-y-1">
  <p data-conflict-layer="output">来源已变化：这一稿不能保存，仍可复制。</p>
  <p data-conflict-layer="batch">来源已变化：后续单元不再执行，需重新发起。</p>
</div>
```

**关键：它们是两个独立的 `<p>`，不是一条拼接串。**

### 4. 第三条文案（本卡要求「若出现第三条需单列」）

```
批次来源已变化，不能继续此批次。请从当前正文发起新任务。
```
来源：`src/components/panels/AIOutputPanel.tsx:454`，由 `gate.sourceChanged` 控制，
与 `source-conflict-copy.ts` 完全无关，属**批次续跑闸门**的独立文案。

## 二、判定

**这是「测试写法问题」，不是产品文案不一致。**

| 路径 | 渲染形态 | 精确 `getByText` 是否可用 |
|---|---|---|
| `SourceConflictNotice` 组件（AI 输出面板） | 两条独立 `<p>` | ✅ 可用 |
| 编辑器内联 `setAiError(sourceConflictNoticeText(...))`（`CodeMirrorEditor.tsx:717`、`:695`） | **一条字符串**，两句用空格连接 | ❌ 精确匹配前半句必失败 |
| 内联 target 变化分支（`:730`） | 一条独立文案 | ✅ 可用 |

`CodeMirrorEditor-generation.browser.tsx:281 / :335` 断言的是**编辑器内联路径**，
而该路径把 `sourceConflictNoticeText()` 的整串塞进单个错误元素 ⇒
`getByText('来源已变化：这一稿不能保存，仍可复制。')` 的**精确**匹配必然落空。

## 三、最小修法建议（二选一，需作者点头，本轮未改）

- **首选（改测试）**：把两处断言改成 `getByText(/来源已变化：这一稿不能保存/)`，或对 aiError 元素做 `toHaveTextContent` 断言。零产品风险。
- 备选（改产品）：让内联路径也复用 `SourceConflictNotice` 组件渲染两条 `<p>`，与输出面板视觉统一。这会改 UI，不建议为一条测试红灯动。

## 四、实机新发现（原卡未覆盖）

**改正文后点「替换」，命中的是「正文或原目标已变化」，不是「来源已变化」。**
也就是说：作者最可能遇到的操作路径（先改动再应用），文案并不指向「来源」，
而 `sourceStatus !== 'current'`（真来源漂移 / 候选消失）才走「来源已变化」。
两条文案语义不同（前者=你的正文变了，后者=上游来源变了），当前用户难以区分。
是否要统一或加区分提示，属产品判断，列入待裁。

## 五、证据形态说明

- 截图：`b16-conflict.png`（已保存）
- 逐字原文：本节 DOM 块，均为 `page.evaluate` 直接从真实 DOM 取 `outerHTML`，未经改写
- 副作用：为造冲突在正文末尾输入过一个 `〇`，随后删除；第 2 章内容由本轮 A2 生成，非原稿
