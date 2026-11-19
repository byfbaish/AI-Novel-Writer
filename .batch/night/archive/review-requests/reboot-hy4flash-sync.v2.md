From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

状态：**待首验**（等 developer 报告落盘后开工）
执行方：developer
首验方：QA
卡号：reboot-hy4flash-sync（A 类）
卡面基准：`.batch/night/cards/reboot-hy4flash-sync.v2.md`｜10,616B｜`0714a372d4da7616f6f0fd52402905fc`｜119 行｜**投出版（判件只认这一份）**
- 卡面 v1（9,820B｜`34ebdc46e22ff9af34ca05c612acb90f`｜113 行）为**未投出草稿**，按版本纪律原样留档，不作判件基准。
- 卡面 v2 `:108` 写着「本文件为投出版 v1」，是卡面自我描述串版笔误；**以本条基准行为准**，该行不作判据、也不因它扣分（卡面已投出，冻结不改字节，复工后如需修正由我另存 v3）。

## 一、要我判什么

developer 的复工首卡交付是否满足卡面 §4 九条判据。**我只接受带「文件:行 或 命令输出原文」的证据**，自我报告不算。

## 二、验收清单（逐条判成立／不成立，不许合并）

1. `vitest run scripts/workbuddy/__tests__/model-policy.test.mjs` → 25 passed / 0 failed，附 exit code 原文
2. `rejectUnknownModel('Hy4')` 仍拒那条断言**一字未动**（给 `git diff` 该段无变化，或改动前后对照）
3. `describeModelPolicy()` 每条含 `auth=`，命中 `^auth=(UNVERIFIED|\S+\|\S+\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})`；缺一条即不合格
4. `develop` 树：`HY4_DISABLED===true`、`pickModel(23:30)` 的 `.model !== 'Hy4'`
5. 副本判定表 **8 行齐全**（含 develop），列：树路径／分支或 HEAD／md5／HY4_DISABLED／ALLOWED_MODELS／pickModel(23:30)／结论；结论列只能是 `可派活`（develop 1 行）与 `禁派活`（7 行）。**本卡不要求改这 7 棵**——你若发现哪棵被写了文件，直接判不通过并报我
6. 记账件 v7：`§11`／`§12` 存在、无 `§7`(`:62`)／`§8`(`:70`) 残留重号（行号证据）；`:47` 段之后连续出现 v3、v4、v5、v6、v7 五行；**v6 原文件 md5 仍为 `e70654eebbbd09f56acca62990be5fd3`、9,927B 未变**
7. `grep -c 'auth=' scripts/workbuddy/model-policy.mjs` ≥ 2（改前基线 0）；行号集合含 `describeModelPolicy` 段
8. `pnpm check:fast` 全绿，附 exit code
9. 提交纪律：`git show --stat <新提交>` 只含三个点名文件；无 push/tag/publish（`git rev-list --left-right --count origin/exp/resource-ledger...HEAD` 应为 `0 N`，`N`＝本卡提交数）
10. 报告首三行定式：第 1 行 `执行方：developer`；第 2 行取数件三元组；第 3 行 `model= | 倍率= | provider=`，provider 须命中 `^magpie/group/`，出现 `deepseek-official`／`deepseek-account` 判不通过

## 三、我明确不通过的红线

- 改动了其余 7 棵 worktree 的任何文件
- 动了 `HY4_DISABLED`、`pickModel()` 时段分支、`Hy4` 拒绝语义
- 记账件 v6 被原地覆盖
- 出现 `git add -A` 或把未跟踪的 5 项混入提交
- 报告里出现「已堵住」字样（实测只证明「夜间＋旧树」才暴露，不能写已堵）

## 四、出件纪律

- 首验单另存 `.batch/night/reports/reboot-hy4flash-sync-qa-firstcheck.md`；如需 v2 另存 `.vN`，不覆盖
- 首验单第 1 行 `执行方：QA`（与派验单顶部 `执行方：developer` 不相等，G1 机检），第 2 行写你验收的**报告**三元组
- 判词首行钉「报告路径 + 字节数 + MD5」三元组，后续引用必须用这组值
