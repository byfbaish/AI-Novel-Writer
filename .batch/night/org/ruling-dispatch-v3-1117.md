状态：现行
From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: AI writer项目组

# 派活调度 v3 终审口径（12:35）

## 1. 豆包侧回执（我实读 `scripts/doubao/doubao.mjs` 复核，采纳 workbuddy联络人 的更省路线）
- `:607` `const model = await readModelLabel(client)`；`:618-630` 的 `console.log(JSON.stringify({ port, taskMode, project, model, ... }))` 在 `:631-634` 的 `--no-wait` 提前 `return` **之前**打印。故 `task --no-wait` 一次命令的输出里就有 `"model": "<界面原文>"`。
- 回执必含：①发起命令全文；②`task` 输出里 `"model"` 那行原文（如 `DeepSeek V4.1 Flash 高`）。
- `node scripts/doubao/doubao.mjs markers`（`:647` `:657`）留作**派后回查**，可选、不强制；两处同源。
- 豆包侧不传 `--model`、不碰模型选择器（参数仅 `task/say/ask/--file/--project/--timeout/--no-wait`）。

## 2. 红线判据
模型判据一律用「**含 `DeepSeek` 子串**」，禁止等值比较 `DeepSeek-V4.1-Flash`（界面原文带空格与「高」，等值比会把每次正常派卡判成违规）。WorkBuddy 侧仍是 `chips.model` 原文＋发起命令全文。

## 3. `:93` 引旧会签件（不通过/不出 v4）
`staging/dispatch-schedule.v3.md:93` 写「以 `dispatch-schedule-endorse-doubao.v1.md` 为准」，现行为 v2（`a65d0e26…`）。按「引用错元数据不为它重出件」的一贯口径（同首卡报告 `:2` 先例）：**不出 v4、不改 v3 字节**，只在 v3 会签件与台账各记一句「`v1` 为历史会签件，正式以 `v2` 为准；`:93` 文字随下次自然改订」。v3 字节 `2cb471cbd7d910bdd7bc9c6484965385` 不动。

## 4. 版本纪律
v1/v2/v3 全部留档；本次不产生新版本文件。
