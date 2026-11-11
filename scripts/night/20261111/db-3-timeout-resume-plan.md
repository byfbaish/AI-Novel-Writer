# 夜跑 11-11 · DB-3 超时→续写衔接方案（只出方案不改码）

你是豆包。本卡由 Lead 通过外部看板派发。

## 身份与落点
- 工作区：`C:\develop\workspace\AI-writer\wt-1`
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\<卡ID>.md`
- 时间盒：50 分钟。

## 红线（先回一行「已确认红线 1-4」，再动手）
1. 只读源码 + 只写报告；零代码改动。
2. 不跑测试/构建。
3. 禁一切 git 写。
4. 禁 `done`；禁自证文件；只写报告。
5. 遇确认框/提权弹窗 → `BLOCKED`。

## 背景
D9 阶段 1 已裁口径：**单章超时停整批**（`GENERATION_CALL_TIMEOUT` 落 `block` + `settle`，后续 open 全拒，不是缺陷）。**续写模式另案**：现行续写只抛弃超时那一章。作者要看的是「超时之后怎么接着写」的产品方案，不是代码。

## 任务
按先读后写：
1. 读 `5e031021` 的 D9 阶段 1 实现（`electron/services/generation-run-service.ts`、`src/shared/generation-call-timeout.ts`、`src/panels/ai-output-failure-presentation.ts`）。
2. 读甲方案现状（`src/services/batch-interrupt-resume.ts` + `docs/design/features/batch-interrupt-resume-design.md` §11 作者校正）与 DB-1 同夜的 A1 纯函数（若已在 `wt-1` 落地，读它）。
3. 产出方案，用固定四段模板（作者口径，见 `docs/agents/documentation-charter.md` §11.1）：
   - **产品语言**：作者看到什么、点了什么、发生什么（不写类名/函数名）；
   - **卡点**：为什么现在不能「超时后自动接着写」，卡在哪一层；
   - **意图**：作者想达到的效果（超时不白跑、已写完的章不重写、失败章可续）；
   - **后果**：三个候选方案的代价对比 —— A「停整批 + 手动续跑」（现状）、B「自动跳过超时章继续后续章」、C「超时章重试 N 次后停批」；每个写清对已定稿内容、成本、可回退性的影响。
4. 给推荐方案（一个）+ 为什么现在选它（不选另外两个的一句话理由），并给「需要作者拍板的一个问题」（只问一个，二选一）。

## 验收
- 四段齐全，每段 ≤ 12 行；不出现「函数/类/字段名」以外的实现细节堆砌。
- 推荐方案明确，且与「单章超时停整批已裁」不冲突（若冲突必须显式提出而不是绕过）。

## 交付
四段报告（改动清单写「无」）+ `## [T1] DONE` / `## [T1] BLOCKED <原因>`。

## 交回
```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag <卡ID> --add review --remove external --release --agent doubao
```
