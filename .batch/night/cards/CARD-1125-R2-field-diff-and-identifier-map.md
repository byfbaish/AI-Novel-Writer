From: 项目总负责人 · AI writer项目组
To: 产品经理 · AI writer项目组 · 群分身

# CARD-1125-R2：C1-② 并排口径改切片 diff ＋ 代码标识符语义对照表

状态：**可投**（前置＝无；与 R1 并行，不同人不同文件）
估时：口径改写 50 分钟 + 对照表 30 分钟 + 首验 20 分钟
执行方：产品经理（主笔）；developer 只读供「代码标识符清单」（grep 输出，不改码）；首验方：QA
类型：**A 类**（产出 docs 提交，须配派验单 `review-requests/CARD-1125-R2.md`）

依据：`.batch/night/staging/res-next/next-round-card-allocation.md`；`ext-review-1125-four-way-synthesis.md` §一·1、§一·2（4/4）。

## 0. 前置【硬】

- 工作目录 `C:\develop\workspace\AI-writer\develop`，分支 `exp/mainline-1119`。
- **不动代码**：`git diff --name-only -- src` 必须为空；禁全量重命名、禁改契约。
- 开工前核：`git status --porcelain -uall | wc -l` ＝ `0`。

## 1. 起因

四家一致：C1-② 的「字段级并排」对长自由文本字段不成立——名字／身份／关系这类短字段并排够用，而「背景」「当前状态」是数百字自由文本，并排只说「这块变了」，指不出句内哪句被改，正是它想解决的 diff 痛点。四家同样一致：代码里 `arc` 仍是活标识符（`arc-position.ts`／`arcSpanForUnit`／`findArcCoverRisks`／「弧位块」），文档层「弧降统称」只是文案闭环，补一张对照表即可，全量重命名会碰契约。

## 2. 要交什么

新增 `docs/research/2026-11-26-c1-2-field-diff-spec.md`，两节：

### 2.1 并排口径改写
- **短字段**（名字／身份／关系等，给出判定阈值，例如 ≤N 字）→ 保留字段级并排。
- **长字段**（背景／当前状态等）→ 改为**按句或按段切片 diff**，输出「第 k 句：旧 → 新」。
- 必须写明：切片粒度怎么定（标点／段落／固定窗口，选一种并说理由）、切片后如何对齐（同序号对齐还是相似度对齐）。

### 2.2 代码标识符 → 现值语义对照表
developer 只读供 grep 清单，产品经理成表，每行三列：`标识符／文件:行／现值语义`。只出表，**不动代码、不写实现**。

## 3. 判据（每条带分层标）

1. `[static]` 短／长字段各有明确判定阈值与例子；只写「按长度分档」不算过。
2. `[static]` 长字段输出形态能给到「第 k 句：旧 → 新」；**指不出哪一句被改就算没做**（本卡唯一定性门槛）。
3. `[static]` 切片粒度与对齐方式各写明一种并给理由，不给「视情况」。
4. `[static]` 对照表行数 ≥ developer 清单行数，且每行带 `文件:行`；缺行、缺行号即打回。
5. `[static]` `git diff --name-only -- src` 为空；`grep -rn 'arcSpanForUnit\|findArcCoverRisks' --include=*.ts src | wc -l` 与本卡开工前读数一致（不改码证据）。
6. `[static]` `node scripts/check-fast.mjs` EXIT=0；提交后 `git status --porcelain -uall` 0 行。

（本卡无 mock／live 项：不改码、不跑生成。）

## 4. 回执四行头

```
From: CARD-1125-R2 · 产品经理
To: 大肥鱼@主身
卡号：CARD-1125-R2｜会话：<会话标识>｜起点 sha：<HEAD 短 sha>
模式：工作模式｜模型：<派单指定模型原文>
```

## 5. 交付后

QA 首验按 §3 六条；我终审只补一条——拿一段真长字段现场走一遍切片规则，看能不能指出句内改动。
