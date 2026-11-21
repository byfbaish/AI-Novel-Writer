From: 项目总负责人 · AI writer项目组 | 5dfa8c4d
To: workbuddy联络人 · AI writer项目组 · 群分身（转 WorkBuddy，通道 CDP 9333）

# 外派件 · D12 判据字段静态审计（WorkBuddy，静态活 · 规格 v2）

- 卡号：`d12-field-audit`（关联 `d12-replay-retry` 判据 §4.3）
- 依据：主人 11-21 19:07 裁定（外派只接静态活）＋ 群管理分身 19:4x 新规格（四列、源行号、贴原文、`? 0 : 0` 判不可判）
- 被审对象：**提交面** `f8d703c0:scripts/d12-replay-acceptance.mjs`（514 行 / 31,312B / sha256 `036191e7…0516e`）——**不是**工作区里的 515 行版本
- 工作目录：`C:\develop\workspace\AI-writer\wt-2`
- 派活命令（联络人执行）：`node scripts/workbuddy/workbuddy-attach.mjs task --file <本件绝对路径> --new`
- 模型：`DeepSeek V4.1 Flash`；高峰期（周一至五 09:00–12:00、14:00–18:00）禁派
- 产物回流方式：**证据件**，写 `wt-2/.batch/night/staging/d12-static-field-audit.md`，由联络人转投 `C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner`；**不进仓库、不许直推**

## 1. 需求（做什么）

纯静态读码。对下列 **14 个字段**逐个给出**四列**结论，列名与列序固定、不得合并、不得改表：

`字段名 | 源码行号 | 实读取值（贴那几行原文） | 结论`

字段清单（13 个必报字段 + 1 个补充项）：
1. `endingBlockUnits`
2. `notesBlockUnits`
3. `notesSixColumnsPresent`
4. `notesTableRowsUnchanged`
5. `notesHooksCountUnchanged`
6. `outlineMidMaxOverlapUnits`
7. `proseContainsFullPrevious`
8. `proseDispatches`
9. `retryHasCorrection`
10. `retryLeaksDraftFragment`
11. `composeCalls`
12. `drafts`
13. `candidates`
14. `unclassified`

判定规则（硬性）：
- 第 2 列写 `f8d703c0:scripts/d12-replay-acceptance.mjs` 的行号（可写行区间），必须指向真正产生该值的语句，不写函数起点。
- 第 3 列**逐字贴该处源码**（2–4 行即可），不许改写、不许概括。
- 出现下列任一形态，第 4 列一律写「**不可判**」，并补一句「该字段过去读数无意义」：
  - 三元表达式两支同值，如 `x ? 0 : 0`
  - 空值兜底成 0，如 `x ?? 0`、`x || 0`
  - 字面量直赋，如 `candidates: 0`、`const n = 0`
  - 只在证据文件里被 echo、并无独立取数来源
- 其余情形第 4 列写「**可判**」并一句话说清取值来源（哪张表/哪个请求体/哪个变量）；若「可判」但需二次计算，追加一句「需二次计算：<怎么算>」。

## 2. 验收标准（交什么）

1) 14 行四列表，14/14 填满，缺列或整列合并视同未交；
2) 表后一段「不可判字段汇总」：列出字段名与行号，一句话说明为什么；
3) 末节「未做项」：明确写「未运行任何脚本、未装依赖、未切 ABI、未改任何文件、未取工作区 515 行版本」；
4) 不是判定权：只交事实与行号，不写「通过／不通过」。

## 3. 不许做的事

- 不许运行 `node scripts/d12-replay-acceptance.mjs`、`pnpm`、`pnpm install`、`prepare-native-for-electron.mjs`、任何 `electron` 命令；
- 不许装依赖、不许切 ABI、不许改 `node_modules`；
- 不许改被检文件、不许 commit、不许 push；
- 不许用工作区版本替代 `f8d703c0` 提交面版本；发现二者不一致只能报差异，不能自己选一份来审。

## 4. 回执

联络人转报：产物路径、字节数、sha256、14 行是否填满、不可判字段个数与名单。
