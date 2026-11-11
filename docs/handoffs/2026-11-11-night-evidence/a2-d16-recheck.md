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
| 严重度 | 中：README/设计稿承诺的「配置 A / 实际 B」可见性，在主链路（章节写稿）上不可达；数据侧事实源正确，属**展示层缺口**，无数据错写 |

## 待裁（不自行改码）

1. 是否要把 `modelReceipt` 投影进 `MainGenerationSnapshot`（最小改动点），由主进程在首帧快照带出 `modelId/modelName`，渲染层收到后 `recordActualModel`。
2. 若暂不改，设计稿 §实施记录 应显式标注「D16 指示器仅覆盖渲染层持有租约的路径；主进程持有的章节写稿不适用」，避免后续再按「缺陷」重查。

## 环境副作用

- 本轮 dev 未重启；T3 造成的外观 `blocked` 已恢复为 `phase: migrated`、`failureCode: null`。
- 未改动任何源码。
