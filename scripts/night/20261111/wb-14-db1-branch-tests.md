# 夜跑 11-11 · WB-14 DB-1 未测分支补测（只新增测试文件）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`8690ecde-47cc-457f-992c-f381f4d90fe2`，报告写到 `wt-2\.dsh-task-board\reports\<卡ID>.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准 `pnpm test <单个测试文件>`；禁全量 / test:browser / test:node / **pnpm dev / 打包**。
2. 禁一切 git 写操作。
3. **只允许新增/修改 `src/shared/__tests__/batch-completion.test.ts` 这一个文件**。**不许改 `src/shared/batch-completion.ts` 的实现**（那是 DB-1 的产物，改它就是改被测对象）。
4. 禁 `done`；禁自建自证文件。

## 背景
DB-1 在 wt-1 产出了 `src/shared/batch-completion.ts`（纯函数「逐章完成读数」，未接线）与它的测试。WB-8 的交叉复核结论是：**这个纯函数够格合入，但测试覆盖不足**——尤其是它最核心的那条声明「`coveredTo` 只补最后一个连续完成边界」**从未被单独验证**。

中控已把 DB-1 的两份产物复制到你的工作区：
- `wt-2/src/shared/batch-completion.ts`（实现，**只读，不许改**）
- `wt-2/src/shared/__tests__/batch-completion.test.ts`（现有测试，**可以追加用例**）

先读这两个文件，再读 WB-8 报告里的覆盖缺口段落：
`wt-2\.batch\night\WB-8-crosscheck-db1.md`（找不到就 `Get-ChildItem wt-2\.batch\night | Select-String -Pattern WB-8 -List`）。

## 任务（T1）
**只加用例，不改实现、不改既有用例的断言。** 至少覆盖以下 5 类分支（每类 1–2 个用例，用例名用中文描述场景）：

1. **`coveredTo` 只补连续完成边界**：给「第 1–3 章完成、第 4 章失败、第 5 章完成」的输入，断言覆盖点是 3 而不是 5；再加一组「第 1 章失败、第 2–4 章完成」，断言覆盖点是 0/null（依实现约定）。
2. **空输入**：零卷 / 零单元 / 空章列表，断言不抛异常且返回「无完成」。
3. **单卷单单元**：最小正例。
4. **多卷多单元**：跨卷时不串味（第 2 卷的完成章不影响第 1 卷的覆盖点）。
5. **状态集边界**：把「批次终止终态」与「完成口径」分开测——至少一个用例断言：一个 run 状态是 `cancelled`/`aborted`（属终止但非完成）的章**不计**进完成集合。**这条要按实现的真实状态集写，不要凭卡面猜**；若实现里没有这条语义，就在报告里明写「实现未区分，未覆盖」而不是编一个通过的用例。

## 验收
- 跑 `pnpm test src/shared/__tests__/batch-completion.test.ts`，把**原样输出全文**贴进报告（含 `Tests  N passed`）。
- 逐条列出新增用例名 → 对应哪个分支 → 是否通过。
- 如果某条分支「实现根本没做」，写进报告的「未做项/发现」，**不许**用改断言的方式让它变绿。

## 允许命令（白名单）
- `pnpm test src/shared/__tests__/batch-completion.test.ts`
- `Get-Content` / `Select-String` / `Get-ChildItem`
- `git -C C:\develop\workspace\AI-writer\wt-2 status --short`（只读）
- `node <看板 CLI> claim/tag`

不许：跑其它测试文件、跑全量、跑 dev、git 写操作、改 `src/shared/batch-completion.ts`。

## 交付四段
1. 结论（覆盖了什么、发现了什么缺口）；
2. 改动清单（只列测试文件的行数与新增用例数）；
3. 原始输出（`pnpm test` 全文原样）；
4. 未做项 / 不确定（尤其第 5 类）。

报告末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
交回：`node … tag <卡ID> --add review --remove external --release --agent workbuddy:worker`

