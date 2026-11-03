# 豆包任务书 · 2026-11-03 夜 · T1–T4

> 用途：一条消息塞完整有序队列，逐项连续执行，不许停下来问。
> 项目：`AI-writer-wt-1`（工作目录 `C:\develop\workspace\AI-writer\wt-1`）
> 队列结束：输出 `## [QUEUE] EMPTY` 后停止，不许自主扩展范围。

---

## 一、开工前（先做这一步，做完再动手）

依次读这三份，然后**用 3 行复述你必须遵守的红线**，复述完再开始 T1：

1. `AGENTS.md`（仓库根）
2. `docs/agents/documentation-charter.md` 的 §4 与 §6
3. `docs/agents/worktree-parallel.md` 的 §7

**没复述 = 视为没读，本批全部作废。**

---

## 二、命令白名单（只准这些，其余一律禁止）

允许：

- `node node_modules/vitest/vitest.mjs run <单个测试文件路径>`
- `npx tsc --noEmit`
- 读文件、搜索、新建本任务书指定的文件

禁止：

- 任何要起应用进程的测试：`*.browser.tsx`、`pnpm test`、`pnpm dev`、`test:node`、验收脚本（`scripts/f0*-journey.mjs` / `*-proof.mjs`）
- 一切 git 写操作：`add` / `commit` / `reset` / `checkout` / `stash` / `push`（提交权不在你）
- 修改 `src/shared/source-ref.ts`、`src/shared/narrative-thread-generation-pure.ts` 这两个既有源文件
- 修改本任务书没有点名的任何文件
- 运行全量测试

---

## 三、行为约束（三条，违反即该项判 BLOCKED）

1. **只准新增文件，不准修改既有实现**。本批 T1/T2 是补测试，发现源文件有 bug 只许写进报告，不许动手改。
2. 没读到的内容只能写「本次读取的文件内未找到」，**不许写「全仓没有」**。
3. 不确定的判定必须显式标「不确定」，不许硬判成结论。

> 测试必须只 import 纯函数模块。一旦测试链路上出现 `better-sqlite3` 会报 ABI 不匹配 —— 那不是你的代码问题，直接标 BLOCKED 并说明。

---

## 四、队列

### T1 · 给 `src/shared/source-ref.ts` 补单元测试

- 先完整读 `src/shared/source-ref.ts`（约 61 行），按它的**真实导出**写测试，不要按猜测的接口写。
- 新建 `src/shared/__tests__/source-ref.test.ts`（**只新建这一个文件**）。
- 覆盖：每个导出函数的正常路径；边界输入（`null` / `undefined` / 空串 / 只有空白）；至少一条异常输入的行为断言。
- 若某导出是纯类型或常量而无可测行为，在报告里写明「该导出无行为可测」，不要为它编断言。

验收：`node node_modules/vitest/vitest.mjs run src/shared/__tests__/source-ref.test.ts` 通过，且 `git status` 里只多这一个文件。

### T2 · 给 `src/shared/narrative-thread-generation-pure.ts` 补单元测试

- 同上流程，源文件约 177 行。
- 新建 `src/shared/__tests__/narrative-thread-generation-pure.test.ts`。
- 这个模块是「叙事线生成」的纯函数层，重点测：输入归一化、空/缺失字段的兜底、输出结构字段是否齐全。

验收：对应测试文件通过，`git status` 只多这一个文件。

### T3 · 新建尖括号占位符守卫（不接线）

背景：模型会把格式模板里的 `<七点>`、`<钩子>` 这类占位符原样抄进正文，当前无任何机检。

- 新建 `src/shared/arc-placeholder-guard.ts`。
- 导出：

```ts
export interface PlaceholderHit {
  raw: string      // 命中的完整片段，含尖括号
  index: number    // 在原文中的起始下标
  line: number     // 1 起的行号
}
export function findAngleBracketPlaceholders(text: string): PlaceholderHit[]
```

- 判据：半角 `<` 与 `>` 成对包裹、内部非空，且内部**不是**下列 HTML 标签名（大小写不敏感、允许带 `/`）：
  `br` `p` `b` `i` `em` `strong` `span` `div` `ul` `ol` `li` `table` `tr` `td` `a` `img` `h1`–`h6`
- 必须命中：

| 输入 | 期望 |
|---|---|
| `<七点>` | 命中 1 条 |
| `拍子：<七点>` | 命中 1 条，index = 3 |
| `<钩子>→单元一｜<第一转折>→单元二` | 命中 2 条 |
| `<赵铎用律条锁人>` | 命中 1 条（**括号内是本书专名，仍须命中**） |
| `第一行\n第二行 <结局>` | 命中 1 条，line = 2 |

- 必须不命中：`<br>`、`</strong>`、`<strong>x</strong>`（这里 `<strong>` 豁免，`</strong>` 豁免）、`《书名》`、`a < b`、`x > y`、空串、`<未闭合`
- 新建 `src/shared/__tests__/arc-placeholder-guard.test.ts`，用表格驱动（`it.each` 或数组循环）覆盖上表全部行。
- **不接线**：不许 import 到任何既有模块，不许改任何调用点。本项只交付纯函数 + 测试。

验收：测试通过；`git status` 只多两个新文件；`npx tsc --noEmit` 无新增报错。

### T4 · 只读取证：单元 → 章的折算逻辑

- 读 `src/components/dialogs/ArchitectureConfirmDialog.tsx` 第 700–820 行附近，找出「单元 → 章」折算的**实际实现**。
- 报告必须逐条给 `文件:行 → 原文片段`，最多 15 行结论。
- 需要回答三件事：
  1. 折算公式是什么（哪些变量参与、怎么取整）；
  2. 对话框预告给作者看的数字，是否来自同一处计算；
  3. 若两者不一致，指出各自的代码位置。
- **不许改任何文件**。读不到就写「本次读取的范围未找到」。

---

## 五、每项结束后的标记（严格照此格式，便于我读进度）

每完成一项，输出两行：

```
## [T1] DONE|BLOCKED|SKIPPED <一句话说明>
<真实时间戳 YYYY-MM-DD HH:MM>
```

四项全部结束后，另起一行输出：

```
## [QUEUE] EMPTY
```

---

## 六、交付报告（四节，缺一节即退回）

1. **改动清单**：文件路径 + 每个文件做了什么
2. **执行记录**：跑了哪些命令 + 退出码
3. **原始输出**：测试条数、`tsc` 结果**原样粘贴**，不要总结成「全部通过」
4. **结论与未做的事**：含所有 BLOCKED / SKIPPED 的原因
