# A2 · D16 状态栏模型指示器实机复验（2026-11-11 单轮 dev）

- 环境：`pnpm dev`（Vite 5180 + CDP 9222），项目 `C:\develop\workspace\AI-writer\.batch-a\proj`
- 配置默认模型 A：`ab365b78-b076-4e7f-8f0e-1e34ec6867cb` = `Ollama/qwen3.5:9b-128k`（`config.json` `defaultModelId`，全程未改）
- 本次创作模型 B：`88cd3187-c5f9-46e6-ace9-30bd4b9528f0` = 显示名 `deepseek-创作`、`modelName: deepseek-flash`
- 实机前备份：`.tmp-ui\d8-backup\1111-project.db`、`1111-partial_arch.json`

## 一句话结论

**「本次创作模型」选择确实生效（DB 回执 = B），但状态栏模型指示器在章节写稿这条主链路上拿不到实际模型，始终显示配置值 A。**

## 证据 1 · 选择生效（对话框侧）

`startBtn.disabled=false`，下拉 `selectedValue=88cd3187-…`、`selectedText=deepseek-创作`，
对话框逐字含「仅用于本次创作，不会更改默认模型。」；点开始创作前 `defaultModelId` 仍为 A。

## 证据 2 · 实际调用的是 B（DB 事实源，最硬）

读 `project.db` 的 `generation_runs`（按 rowid 倒序第一条）：

```json
{
  "rowStatus": "completed",
  "modelId": "88cd3187-c5f9-46e6-ace9-30bd4b9528f0",
  "modelName": "deepseek-flash",
  "provider": "openai",
  "protocol": "openai"
}
```

该字段取自 `binding_json.sourceManifest.modelReceipt`，正是 D16 设计稿指定的事实源。

## 证据 3 · 生成真的完成

- 底部任务区逐字「整个工作流已全部完成」，卡片「第 2 章 · 写稿 1/1」
- 编辑器 `.cm-content` 实测 `innerText.length = 575`，开头为「塌方前的账目漏洞 / 第 2 章 / “身无分文，按律当罚。”赵铎把话撂在石台上。」

## 证据 4 · 状态栏未反映（问题所在）

生成完成后经 CDP 读渲染层真实状态：

```json
{
  "actual": null,
  "statusbarTitle": "当前模型：Ollama/qwen3.5:9b-128k",
  "statusbarText": "Ollama/qwen3.5:9b-128k"
}
```

`useActualModelStore.getState().actual === null` ⇒ `resolveStatusbarModel()` 走配置兜底分支，显示 A。

## 根因（代码链路，非猜测）

1. `src/services/workflows/commands/base-command.ts:154`
   `createRuntime: (options, main) => main ? createWorkflowMainGenerationRuntime(main) : createGenerationRuntime(options)`
   章节写稿带 main handle，走右支。
2. `src/services/workflows/workflow-main-generation.ts:37` → `createMainOwnedGenerationRuntime`
   （`generation-runtime.ts:187`）。
3. `MainGenerationSnapshot`（`generation-runtime.ts:82-93`）字段只有
   `artifactId / attemptId / revision / durableRevision / text / textHash / status / compositionEligible`，
   **没有任何模型字段**。
4. `recordActualModel` 的唯一调用点在 `generation-runtime.ts:409`，位于 `beginModelExecution()` 内部；
   主进程持有租约的路径**不经过**这个方法，故 store 永远为 `null`。

## 判定

| 项 | 结果 |
|---|---|
| 「本次创作模型」是否生效 | ✅ 生效（DB 回执 = `deepseek-flash`） |
| 默认模型是否被误改 | ✅ 未改（仍 `Ollama/qwen3.5:9b-128k`） |
| 章节生成是否成功 | ✅ 成功（575 字正文 + 工作流完成） |
| D16 状态栏是否显示实际调用模型 | ❌ 未显示，恒为配置值 A |
| 严重度 | 中：D16 原始验收判据 **N3**（`2026-11-07-d9-d16-structural-design-handoff.md:53`「构造『配置 A / 实际 B』⇒ 显示 B，且删掉快照写入行单测会红」）**不成立**。数据侧事实源正确、无数据错写，属展示层缺口；但按 N3 这**是验收失败，不是设计边界**，D16 缺陷稿**保持 ⬜ 不销账**（同文 `:74-76` 第 2 条禁止据此销账） |

## 待裁（不自行改码）

1. **首选：把模型事实带进主进程快照。** 注意最小改动点不是「往 `MainGenerationSnapshot` 加两个字段」这么简单——
   `src/services/workflows/workflow-main-generation.ts:41 / :104` 渲染层其实**已经拿到 `modelId`**，
   缺的只是 `modelName`（可由 `useLLMStore.models` 按 id 反查）。所以有两条路：
   （a）快照只补 `modelId`，显示名在渲染层反查（改动最小，不动主进程契约语义）；
   （b）快照同时补 `modelId` + `modelName`（更自洽，但要改 `generation-contract` 与主进程投影）。
   建议 (a)，需作者点头。
2. ~~若暂不改，设计稿标注「仅覆盖渲染层持租约路径」~~ —— **此选项按 N3 不成立，已撤回**：
   N3 明确要求主链路（章节写稿）也显示实际模型，标注边界等于销账。若作者决定推迟，
   应写为「D16 保持 ⬜，延至某期」，而不是「标注为设计如此」。

## 附：字数口径

- 「575 字」是 `.cm-content` 的 `innerText.length`（CodeMirror 虚拟化，只渲染视口内行）；
- 「2052」是库内 `contents` 的实际字数（`a2-db-drafts.mjs` 查得）。
两个数不是同一口径，勿并列当矛盾。以库内 2052 为准。

## 环境副作用

- 本轮 dev 未重启；T3 造成的外观 `blocked` 已恢复为 `phase: migrated`、`failureCode: null`。
- 未改动任何源码。
