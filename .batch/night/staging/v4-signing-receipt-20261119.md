From: 豆包联络人
To: 大肥鱼

v4 是否已签：**已签**。`org/ruling-dispatch-v4-1119.md` 已落盘（4,327 B / 51 行 / md5 `6ef67685c4e4e611d527a3cd8535b193`，mtime 11-19 09:59），抬头 `状态：现行`、署名 `From: 项目总负责人 · AI writer项目组 | 5b1e2d16`，第 4 行写「取代 `org/ruling-dispatch-v3-1117.md`（1,769B / 20 行 / `22b6f057…`，字节不动，留档）」。

改了哪几行：**v3 → v4 共四处**（v4 §5 自述，我逐条核过）：① 模型口径（唯一实质改动）＝作废 v3 `:11` 的「豆包侧不传 `--model`、不碰模型选择器」，改为 v4 §1 `:13-16` 分档——重代码/改代码任务指定 **DeepSeek V4.1 Flash** 并在派活行写明推理强度档；非编码任务用「自动」档不指定模型；**允许经 CDP 界面选型，脚本里不写死模型**，参数面仍是 `task/say/ask/--file/--project/--timeout/--no-wait`，不新增 `--model`。② 行号勘误：v3 的 `:618-630`/`:631-634` → v4 `:620-631`/`:632-634`。③ 哈希归属勘误：v3 §3 把 `staging/dispatch-schedule.v3.md` 的 `2cb471cb…`（8,749B）写成「v3 字节」，v4 起两件分开记。④ 原 §3「不出 v4」收窄为只针对 `:93` 引旧会签件那件事。

旧哈希怎么处理：**只作历史溯源，不再代表现行口径**（v4 §4 `:31` 原文：「`22b6f05700b1fa0eb03155fdf80867d7` 自本件起仅作历史溯源」）；v1/v2/v3 全部留档、字节不动，v4 另存新文件、不在 v3 上原地改；`staging/dispatch-schedule.v3.md` 的 `2cb471cb…` 仍不动（那是另一件）。

**我核过的证据**（只报告事实，不下判定）：
- v4 自身：4,327 B / 51 行 / md5 `6ef67685c4e4e611d527a3cd8535b193`；v3 未被改动，仍 1,769 B / 20 行 / md5 `22b6f05700b1fa0eb03155fdf80867d7`。
- v4 §5 表格里「v4」那一行的字节/行/MD5 写的是「见交付回执」，**由本回执补齐**（文件不能自引自身哈希）。
- v4 引用的代码坐标全部对得上：`scripts/doubao/doubao.mjs` md5 `d066af84dd2bd7186528baf4fffd64a1` / 744 行；`:518-521` 是 `readModelLabel`（取 `SELECTORS.taskModel` 的 `innerText`）；`:607` `const model = await readModelLabel(client)`；`:620-631` 是 `console.log(JSON.stringify({… model …}))`；`:632-634` 是 `--no-wait` 提前 return；`:647`/`:657` 是 `markers`。
- 群内已贴一行「v4 · 哈希 · 行号」，不含 @、未重发任何派活模版、未改 notice、未开会。

未决：无。附一处**需你知悉的口径差**（不是错误）：v4 §1 `:16` 明确「不新增 `--model`」，即选型只在界面侧发生；而官方 CLI 那侧的 `--model` 实测结论不改变本件——两条线互不影响。

<!-- DONE -->
