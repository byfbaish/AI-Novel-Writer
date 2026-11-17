# 卡 B · D12 三处接线点清单（只读）

> 卡号：B-d12-wiring-sites。夜间卡：**只读**，不许改码、不许跑测试。
> 执行方：WorkBuddy。派卡人：AI writer总负责人。

## 0. 已知事实（已核实，别重复考古）

- 设计与现状说明：`docs\design\product\d12-retry-design-20261109.md`，重点读 L58–L70（「全章判定器已入库但零接线」）。
- 判定器实现在 `src\shared\chapter-reuse-coverage.ts`（`analyzeChapterReuse`，定义在 `:66`），生产调用点 0，只有 `src\shared\__tests__\chapter-reuse-coverage.test.ts` 在用。
- 失败契约在 `src\shared\chapter-failure.ts:115`–`:120`。
- 主流程文件 `src\services\workflows\commands\generate-draft.command.ts`（165,681B），现有范式在 `:1969`–`:1977`（「唯一一次带纠正指令重来」）——这是要照抄形状的地方。

## 1. 要回答的问题（三处，一处一张小表）

「该接哪三处」以设计文档 L58–L70 的意图为准，但**位置由你在代码里核实后给出**，不要照抄文档行号就交差（文档行号可能已漂）。

每处给：
- 文件:行号（当前 HEAD 上的真实行号）+ 所在的函数名/方法名；
- 入参是什么（当前函数能拿到的变量名）、返回值怎么用；
- 触发时机（在生成后、保存前、还是失败分支里）；
- 这一处是否**必须**改，还是可选（说明理由）。

## 2. 额外两问

1. `analyzeChapterReuse` 的签名与返回结构（贴函数签名原文），以及它需要哪些上下文（上一章正文/当前草稿/窗口参数）。
2. 如果只在其中一处接线（最小可用），你推荐哪一处、为什么。

## 3. 禁止

- 只读：不改任何源码、不 `git add`、不跑测试（夜间禁跑）。
- 不要提议「顺手重构」；只回答接在哪、入参出参是什么。

## 4. 产物

- 报告：`.batch\night\reports\d12-wiring-sites.md`，末行 `<!-- DONE -->`（追加内容加在 DONE 之前）。
- 信号：`.batch\night\signals\workbuddy\d12-wiring-sites.done`，三行：完成 / 推荐的最小接线点（文件:行号）/ 报告路径。

## 5. 估时

40–60 分钟。

> 旁注（23:49，负责人补）：`scripts\experiments\measure-chapter-reuse.mjs:103` 有一处**实验用途**的 `analyzeChapterReuse` 调用；`src` 内仍为 0 处，不影响「生产未接线」的结论，但请在报告里写明这一处，免得后面核代码的人以为卡面写错了。
