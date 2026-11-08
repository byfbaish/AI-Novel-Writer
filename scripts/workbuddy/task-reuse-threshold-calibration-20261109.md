# 任务：8-gram 整章复用阈值标定（卡 caf3f90a · B4）

工作目录固定 `C:\develop\workspace\AI-writer\wt-2`（基线提交 09791033）。**禁止**读写改 `develop` 主区 / `wt-1` / `wt-3`。

## 0 开工前（不照做即拒收）

1. 先读：仓库根 `AGENTS.md` · `docs/agents/workbuddy-channel.md` §4.1 / §5 · 判定器源码 `src/shared/chapter-reuse-coverage.ts` · 现有脚本 `scripts/measure-ai-flavor-baseline.mjs`。
2. **在回复第一段复述下面三条红线**（没复述 = 我直接拒收，不看后面的活）：
   1) 只在 `wt-2` 里改文件，不碰 `develop` / `wt-1` / `wt-3`；
   2) 只跑本任务新增的脚本，**禁** `pnpm test` 全量、`vitest run` 不带路径、`test:browser`、`pnpm test:node`、`pnpm dev`、打包、任何 `better-sqlite3` 重建（切 ABI 会打断所有槽位）；
   3) 不提交 git（禁 `git add/commit/push/merge/reset/checkout`），不改 `docs/agents/doc-placement-baseline.json`。
3. **不许建自证文件**：不许写 `FINAL_SUMMARY.md` / `TASK_SUMMARY.md` / `DELIVERY_VERIFICATION.md` / `##_T1_DONE.md` / `run-test.ps1` 之类。交付只在「报告文件 + 回复正文」两处。

## 1 允许的命令白名单（只此几类）

- `node scripts/experiments/measure-chapter-reuse.mjs`（本任务新增的脚本，可带参数）
- `git status --porcelain` / `git diff --stat` / `git diff -- <path>`（**只读**，用来证明你没改判定器）
- `python -c "..."`（只读复核语料，可选；见 §2）
- 列目录 / 读文件（`Get-ChildItem` / `Get-Content` / `type`）

其它命令一律先问。**没有** `pnpm test` / `vitest` / `pnpm dev` / `pnpm install`。

## 2 语料：已经备好，直接用（不要自己找库、不要碰 sqlite）

派单方已从 `wt-2/.runtime/db-copy/project.db` **只读导出**到：

`C:\develop\workspace\AI-writer\wt-2\.runtime\corpus\reuse-calibration\`

| 文件 | 内容 |
|---|---|
| `ch01.txt` … `ch11.txt` | 第 1–11 章，全部 `drafts.status='finalized'`、version=1，连续正文 |
| `ch06-v2-draft.txt` | 第 6 章 version=2（status=draft），**真实改写样本** |
| `ch10-v2-draft.txt` | 第 10 章 version=2（status=draft），**真实改写样本** |
| `manifest.json` | 来源库路径、SQL、每文件字数和 sha256、编码说明 |

- 编码 UTF-8 **无 BOM**，正文为纯文本；每章 1,600–2,000 字符。
- **不要**用 `better-sqlite3` 读库：本机 `.node` 编译在 Electron ABI 145，裸 node（ABI 137）加载会 `ERR_DLOPEN_FAILED`；脚本一律读上面这些 `.txt`。**不许** `npm rebuild` / `prepare-native-*` 去修 ABI。
- 复核方式（可选，只读）：`python -c "import sqlite3;..."` 对 manifest 抽查两章即可，别改库。

## 3 背景与目标（照抄卡片，先读一遍）

判定器已入库：`src/shared/chapter-reuse-coverage.ts`，导出
`analyzeChapterReuse(prose, previousChapter, options?) -> { ratio, coveredUnits, runs, longestRun, severity }`，
常量 `REUSE_RATIO_ADVISORY=0.15` / `REUSE_RATIO_BLOCKING=0.35`。**阈值是拍的、没标定，且零接线。**

目标：用存量正文 + 三组对照，标定这两个阈值。**本任务只测量、只出报告，不许接线，不许改判定器语义。**

## 4 要交付的脚本：`scripts/experiments/measure-chapter-reuse.mjs`

### 4.1 必须直接 import 已入库判定器（硬要求，验收会读源码核对）

- 从 `src/shared/chapter-reuse-coverage.ts` 导入 `analyzeChapterReuse`、`REUSE_RATIO_ADVISORY`、`REUSE_RATIO_BLOCKING`。
- `.mjs` 不能直接 import `.ts`（内部相对导入无扩展名）。**照抄现成做法**：`scripts/measure-ai-flavor-baseline.mjs:174-187` 的「esbuild 内存打包 + `data:text/javascript;base64` 动态 import」。骨架：

```js
import { Buffer } from 'node:buffer'
import { build } from 'esbuild'
const bundled = await build({
  stdin: {
    contents: "export { analyzeChapterReuse, REUSE_RATIO_ADVISORY, REUSE_RATIO_BLOCKING } from './src/shared/chapter-reuse-coverage.ts';",
    resolveDir: repositoryRoot,
  },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
})
const { analyzeChapterReuse, REUSE_RATIO_ADVISORY, REUSE_RATIO_BLOCKING } =
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
```

- **不许**在脚本里重写一份判定逻辑（不许自己算 ratio/severity 再叫它「标定」），也不许改判定器里的常量。
- 报告里必须写出「import 来源: `src/shared/chapter-reuse-coverage.ts`（`analyzeChapterReuse`）」以及 `git status --porcelain` 证明该文件未被改动。

### 4.2 第二套读数：d12 生产口径（对照，不替代判定器）

`scripts/experiments/d12-direct-rerun.mjs` 里已有「生产口径」8-gram 覆盖率：`NGRAM=8`、`norm()` 归一化（同文件 :37）、**正文头部 1,200 字** 被「**上一章结尾 1,000 字**」的 8-gram 覆盖比例、连续 ≥80 字判重演（同文件 :33-60）。

- 把这套算法**原样搬**进新脚本（含注释标出处 `d12-direct-rerun.mjs:33-60`），对每章同时输出这套读数。
- **不要** `import` d12 脚本本身：它有顶层副作用（读 trace 文件、写 out 目录），import 会直接执行。
- 报告里两套读数并列：主口径 = 判定器（全章 vs 上一章全文，16 字 n-gram，ratio/severity）；对照口径 = d12 生产口径（头 1200 vs 上章结尾 1000，8-gram）。阈值结论**必须基于主口径**；对照口径用来解释「为什么生产守卫抓不到整章重写」。

## 5 要测的三组样例

### 组 A：真实相邻章（期望低）

`ch02 vs ch01`、`ch03 vs ch02` … `ch11 vs ch10`（10 对，逐对给 ratio / coveredUnits / longestRun / severity）。

### 组 B：人工构造「整章重写上一章、只换开头」（期望高，验证 blocking 灵敏度）

至少 **3 例**。做法示例：取一章正文，把开头约 150–300 字换成全新文字、其余保持原样（可再随机改 1–2 处标点/词序）。每例给出 ratio / longestRun / severity，并注明是基于哪一章构造的。

### 组 C：人工构造「同题材、同人物、剧情不同」（期望低，防误报）

至少 **3 例**。用相同人物名/设定名词，写全新的剧情段落（每例 ≥ 600 字，可以自己写、也可以用章节里的句子重新组合成大段落，但**不许**直接整段复制上一章）。每例给出读数。

### 组 D：真实改写样本（bonus，真实数据而非人工构造）

`ch06-v2-draft vs ch05`、`ch06-v2-draft vs ch06`、`ch10-v2-draft vs ch09`、`ch10-v2-draft vs ch10`。这几对是「同一章重写 / 改后版本」，读数用于校准 advisory/blocking 的边界。

> 构造的样例必须落盘到 `wt-2/.batch/reuse-calibration-fixtures/`（组 B、组 C 各一文件，文件名自解释），以便我复核；不要只写进内存。

## 6 报告：`wt-2/.batch/reuse-threshold-calibration-20261109.md`

必须含：

1. **语料**：来源（`.runtime/db-copy/project.db` 只读导出 → `.runtime/corpus/reuse-calibration/`）、13 个文件清单、编码、你抽查过哪两章、manifest sha 是否对得上。
2. **逐章表**：第 1–11 章每章 vs 上一章 —— ratio / coveredUnits / longestRun / severity（主口径），另列 d12 生产口径的头覆盖率与是否 ≥80 连续。
3. **三组样例读数**：组 A / B / C / D 逐条列，标明构造方式与文件路径。
4. **阈值结论**：
   - 0.15 / 0.35 是否合理？给结论与证据（哪几对真实相邻章会误报/漏报）。
   - 给**保守**与**激进**两档建议值（具体数字，例如 advisory=0.xx / blocking=0.xx），并说明两档各自代价（误报打断生成 vs 漏报放过整章重写）。
   - 误报 / 漏报评估：真实相邻章的最高 ratio 是多少？组 B 的最低 ratio 是多少？两者之间有没有可分的间隔。
5. **脚本原始输出片段**：把 `node scripts/experiments/measure-chapter-reuse.mjs` 的 stdout 关键段落原样贴进来（表格或 JSON 都行，**不要只写「结果见上」**）。
6. **未做的事 / 不确定项**（没有就写「无」）：例如样本量只有 11 章、组 B/C 是人工构造、阈值只对中文语料有效等。

## 7 收尾

回复正文按此顺序写，缺段视为未完成：

1. **红线复述**（三条，见 §0）。
2. **改动清单**：`路径:行` 逐条（新建的脚本、报告、fixtures；确认没有第 4 个文件）。
3. **执行记录**：每条命令 + 真实输出（不要只写「通过」）。
4. **读数摘要**：组 A 最高 ratio / 组 B 最低 ratio / 组 C 最高 ratio / 组 D 各对读数 / 建议阈值。
5. **未做的事 / 待裁决**。
6. 最后一行：`## [T1] DONE <一句话>` 或 `## [T1] BLOCKED <卡在哪>`。
