# P48 · 审稿报告页显示「近 10 章动作数中位数」（A 类改码）

执行方：WorkBuddy（经 WorkBuddy 联络人递卡）
执行通道：`node scripts/workbuddy/workbuddy-attach.mjs task --model DeepSeek-V4.1-Flash`
**不带 `--cwd`**（固定 wt-2，本通道只允许 wt-2；指到别处会被护栏拒）
估时：60 分钟
工作区：`C:\develop\workspace\AI-writer\wt-2`（分支 `agent/wt-2`，起点 HEAD `8c0bd657c5b91fdcc0d3e628975dd85a4b0626ab`）
代码基线：以 develop `0e76f498` 只读对照，**不写入 develop**

## 1. 为什么做

G-A 判据 A2 要求「连续 10 章作者动作数中位数较基线不上升」（`staging/market-quality-acceptance.md:25`）。P38 只落了单章的三个数（保存 X 次 · 作者改动 Y 处 · 千字改动 Z），**没有任何地方给出 10 章中位数**，A2 现在无法判定。本卡只补这一个聚合读数。

## 2. 口径（负责人定，不许自行改动）

1. **动作数定义**（沿用 P38 已落口径，不许改）：某章 `draft_edit_stats` 里 `origin = 'human'` 且 `changed_chars > 0` 的行数。
2. **取哪 10 章**：同一项目内按 `chapter_number` 降序取最近 10 章（含当前章）。不是按时间戳，不是取全书。
3. **中位数**：标准定义——9 个数取第 5 个；10 个数取第 5、6 个的平均。显示时 `Math.round` 取整数。
4. **样本不足**：不足 10 章时显示「近 10 章动作数中位数：样本不足（N/10 章）」，不显示数字、不按 N 个章硬算。
5. **口径在渲染层算**：主进程/DB 层**只回原始行**（章节号 + origin + changed_chars），中位数与筛选写成渲染层纯函数 —— 沿用 P37 判例，主进程不做业务口径。

## 3. 落点与改法

1. 数据通道：扩展或新增 IPC，入参要能表达「这个项目最近 10 章」；返回原始行数组（`chapter_number`、`origin`、`changed_chars`）。已有的 `db:draft-edit-stats` 在 `src/shared/ipc-channels.ts:1256`、handler 在 `electron/controllers/db-controller.ts:1271` 附近，可扩展也可加新通道，二选一由你判断，报告里写明选了哪个与理由。
2. 纯函数：新文件 `src/components/editor/draft-edit-median.ts`（或同级），导出
   `medianActionsLast10(rows: {chapterNumber:number; origin:string; changedChars:number}[]): {median: number | null; sampleChapters: number}`
   —— 只做「筛 human+changed>0 → 按章计数 → 取最近 10 章 → 中位数」，不碰 IO。
3. 渲染：`src/components/editor/ReviewReport.tsx` 顶部 P38 那三数下面新增一行，读一次数据、复用 P38 的 error/空态样式。文案：
   - 正常：`近 10 章动作数中位数：{median}`
   - 不足：`近 10 章动作数中位数：样本不足（{n}/10 章）`
   - 读取失败：沿用 P38 的「计量读取失败」样式，不新增文案体系。

## 4. 不许动的

1. **禁改区**：`src/shared/review-generation-report.ts`、`src/services/workflows/commands/review-chapter.command.ts`、`src/services/workflows/commands/generate-draft.command.ts`、`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目。
2. 不改 P38 那三数的算法与文案。
3. 不写 stash / 不 reset / 不 checkout 覆盖他人改动。
4. 不 push、不打 tag、不 publish。
5. 不启界面抢宿主窗口（不点 DSH GUI）。

## 5. 测试与提交

1. 新增纯函数单测：9 章 / 10 章 / 不足 10 章 / 全 ai 行 / 空数组 五个用例。
2. 点名套件用 `pnpm test <你改动涉及的文件路径>`（Electron 运行时）。**禁止 `node vitest`、禁止全量**。
3. 提交：一次点名 `git add` 你改的文件（禁 `-A`），提交信息 `feat: show 10-chapter median of author edit actions`。
4. 报告落 `.batch\night\staging\p48-median-report.md`（wt-2 内），须写：
   - 起点 HEAD 与提交后 HEAD、`git show --numstat` 全文、porcelain 是否空；
   - 选了哪个数据通道、为什么；
   - 五个用例的实跑输出；
   - 中位数口径复述 + 一个手算对照例子；
   - 末行 `<!-- DONE -->`。

## 6. 完成判据

报告在盘、末行 DONE、提交为一次、点名套件全绿、禁改区未动、porcelain 空。
