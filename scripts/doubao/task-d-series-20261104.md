## 队列（按顺序做，做完一项就报一项，不许自主扩范围）

本轮 4 项：T5/T6 写代码 + 单测，T7/T8 只读代码取证。全部在 `C:\develop\workspace\AI-writer\wt-1`（项目 `AI-writer-wt-1`）里做。

**验收只看产物与命令输出，不看你的自我评价。** 每项做完输出一行 `## [T5] DONE <一句话>`，全部做完输出 `## [QUEUE] EMPTY`。

---

## T5 · 卷单元区间互斥校验器（D15）

**背景**：第 2 卷的单元区间实测重叠（7–9 / 8–9 / 10–10），第 8、9 章归属不唯一。第 1 卷（1–3 / 4–4 / 5–6）没有这个问题。现在落库前完全没有校验。

**要做的事**：新建 `src/shared/volume-unit-overlap.ts`，导出纯函数，**不要接线到任何调用点**（本轮只做机检件）。

函数要求：

```ts
export type UnitRange = { label: string; from: number; to: number }
export type OverlapFinding = {
  kind: 'overlap' | 'ambiguous-chapter' | 'inverted-range'
  chapters: number[]
  units: string[]
}
export function findUnitOverlaps(units: UnitRange[]): OverlapFinding[]
```

判定口径：

- `overlap`：两个单元的 `[from, to]` 区间有交集 ⇒ 报交集章号
- `ambiguous-chapter`：某章被 ≥2 个单元覆盖 ⇒ 单独报出来（这是 D15 的直接症状，与 overlap 分开列）
- `inverted-range`：`from > to`
- `kind` 的先后顺序固定为 `inverted-range` → `overlap` → `ambiguous-chapter`，同一 `kind` 内按 `chapters[0]` 升序

**单测**：`src/shared/__tests__/volume-unit-overlap.test.ts`，必须包含：

1. 第 2 卷真实样本 `[{7,9},{8,9},{10,10}]` ⇒ 命中 `overlap`（交集 8–9）且 `ambiguous-chapter` 含 8、9
2. 第 1 卷真实样本 `[{1,3},{4,4},{5,6}]` ⇒ 返回空数组
3. 单点区间 `[{5,5},{6,6}]` 不报重叠
4. 相接不算重叠：`[{1,3},{4,6}]` ⇒ 空（3 和 4 相邻但无交集）
5. `from > to` ⇒ 报 `inverted-range` 且不参与后续重叠计算
6. 完整包含 `[{1,10},{3,4}]` ⇒ overlap 报 3–4

**验收**：`node node_modules/vitest/vitest.mjs run src/shared/__tests__/volume-unit-overlap.test.ts` 通过；`npx tsc --noEmit` 无新增错误。

---

## T6 · 蓝图钩子 ↔ 大纲收尾行 对齐校验器（D18）

**背景**：第 6 章的蓝图 `suspense_hook` 写了「寿元」「因果纹」，但大纲该章收尾行里没有这些概念，正文里这两个词各出现 0 次。现在提交蓝图时对钩子**没有任何校验**。

**要做的事**：新建 `src/shared/suspense-hook-alignment.ts`，导出纯函数，**不要接线**。

```ts
export type HookAlignment = {
  verdict: 'aligned' | 'drifted'
  sharedTokens: string[]
  hookTokens: string[]
}
export function alignSuspenseHook(outlineEnding: string, hook: string): HookAlignment
```

分词规则（简单实现即可，但必须写进 JSDoc）：

- 只保留**汉字连续串**（`/[\u4e00-\u9fa5]+/g`），英文/数字/标点丢弃
- 长度 < 2 的片段丢弃
- 停用词表（至少包含）：`的` `了` `在` `是` `和` `与` `也` `就` `都` `这` `那` `一个` `什么` `不是` `没有` `自己` `他们` `我们`
- `sharedTokens` = 两者交集，去重后按出现顺序
- `verdict`：`sharedTokens` 非空 ⇒ `aligned`，否则 `drifted`

**单测**：`src/shared/__tests__/suspense-hook-alignment.test.ts`，必须包含：

1. 真实漂移样本：`outlineEnding = "他退到门口，看着那道门缓缓合上。"`，`hook = "寿元将尽的秘密被揭开"` ⇒ `drifted`，`sharedTokens` 为空
2. 对齐样本：`outlineEnding = "他把律条拍在案上，赵铎的脸色变了。"`，`hook = "律条上的名字被人篡改"` ⇒ `aligned`，含 `律条`
3. 两边都为空串 ⇒ `drifted`（不是 aligned）
4. 停用词不算交集：`outlineEnding = "这是他自己的选择"`，`hook = "这是他们自己的东西"` ⇒ `drifted`
5. 单字不参与：`outlineEnding = "他走了"`，`hook = "他来了"` ⇒ `drifted`

JSDoc 必须写明一句话：**「判定是启发式，只能警示，不能阻断提交」**。

**验收**：`node node_modules/vitest/vitest.mjs run src/shared/__tests__/suspense-hook-alignment.test.ts` 通过；`npx tsc --noEmit` 无新增错误。

---

## T7 · 只读取证：`generation_runs` 的终态由谁写（D2）

**背景**：实测 36 条 `generation_runs` 永远停在 `running`，`blocked_code` 是 NULL，但 `generation_attempts` 都是 `settled`。连**成功跑完**的批次也不留终态（run `0030f404`、`290d435b` 到第二天仍是 `running`）。

**这是一项只读取证，不许改任何文件。**

**要回答的问题**（每个答案都必须带 `文件:行` + **原文片段逐字粘贴**，不许写"大致在 xxx 附近"，不许归纳成结论）：

1. `generation_runs.status` 一共有**几个写入点**？（INSERT 时给的是什么值；所有 UPDATE 语句在哪）
2. 有谁会把 status 改成 `success` / `completed` / `failed` / `aborted` / `settled` 之类的终态？分别在哪行？
3. `blocked_code` 字段：哪些地方写它？哪些地方读它？
4. 把「写入终态」的调用点列出来，逐个判断：**它在成功路径上会被走到吗**？给出调用链（谁调用它、上一层是谁）。如果某个函数**全库没有调用点**（死代码），明确写出来。
5. 失败路径（抛错 / catch）里有没有落终态？

**输出格式**（照抄这个结构，一条一行）：

```
[1] generation_runs.status 写入点
- electron/<path>.ts:123  <原文片段>
- ...
[2] 终态写入
- ...
[5] 失败路径
- ... / 或 "本次读取的文件内未找到"
```

---

## T8 · 只读取证：同一章三次失败的三个出口（D13）

**背景**：同一章连续三次失败，分别挂在**短细纲层** / **重演层** / `GENERATION_COMPOSITION_NO_PROGRESS` 三个不同的地方，失败原因互不相关，界面上看到的是三条不相干的报错。

**只读取证，不许改文件。** 三个出口逐个查，每个都给 `文件:行` + 原文片段：

1. 短细纲层的失败出口在哪？抛的什么错误码？
2. 重演（`重演` / `replay`）拦截的出口在哪？（已知在 `generate-draft.command.ts` 附近，行号自己核实，别抄我给的范围）
3. `GENERATION_COMPOSITION_NO_PROGRESS` 在哪抛？抛之前已有正文会怎样处理（丢弃 / 保留）？
4. 三个出口的**上层捕获者**分别是谁？捕获后有没有写库、有没有返回给界面？

**输出格式**：

```
[T8-1] 短细纲层
- 抛出点：<path>:<line>  <原文>
- 错误码：<字符串>
- 上层捕获：<path>:<line>  <原文>  / 或 "未找到捕获点"
...
```

---

## 硬约束（违反即本轮作废）

1. **只准单元测试**：允许 `node node_modules/vitest/vitest.mjs run <单个文件>`、`npx tsc --noEmit`。禁 `pnpm test`、禁 `pnpm test:node`、禁 `test:browser`、禁任何会启动 Electron / 占固定端口 / 写 `user-data-dir` 的脚本。
2. **只改点名路径**：`src/shared/volume-unit-overlap.ts`、`src/shared/suspense-hook-alignment.ts`、以及这两个的测试文件。**T7/T8 一个文件都不许改**（含不许新建）。
3. **不许任何 git 写操作**（add / commit / checkout / stash / reset / push）。
4. **不许改既有实现**：`arc-placeholder-guard.ts` 之类已有文件一律不碰，哪怕你觉得它写得不好。
5. 没读到的内容只能写「**本次读取的文件内未找到**」，不许写「全库没有」。
6. 不确定的判定标「**不确定**」，不许硬判。
7. 不许跑 `doubao.mjs task` / `ask`（会切断编排方自己的会话）。

## 收尾

全部做完后，在回复里输出：

```
## [T5] DONE <一句话>
## [T6] DONE <一句话>
## [T7] DONE <一句话>
## [T8] DONE <一句话>
## [QUEUE] EMPTY
```

并附上两条测试命令的**原始输出末尾**（`Tests  N passed` 那一行，逐字粘贴，不要总结成"全部通过"）。
