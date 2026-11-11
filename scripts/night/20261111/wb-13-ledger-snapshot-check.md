# 夜跑 11-11 · WB-13 台账“现值 vs 快照”体检脚本（纯新增，不接线）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`。
- 卡 ID：`db504048-32ec-4528-8350-91716e51ac48`，报告写到 `wt-2\.dsh-task-board\reports\<卡ID>.md`。
- 看板 CLI：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准 `pnpm test <单个测试文件>`；禁全量 / test:browser / test:node / **pnpm dev / 打包**。本卡不跑测试。
2. 禁一切 git 写操作。
3. **只允许新增两个文件**：`scripts/check-ledger-snapshot.mjs` 与（可选）`scripts/__tests__/check-ledger-snapshot.test.mjs`。**不许改 package.json、不许改任何既有脚本、不许接线到 check:fast**。
4. 禁 `done`；禁自建自证文件。

## 背景（今晚真实踩到的问题）
`docs/plans/prompt-assembly-backlog.md` 里同一件事有两类行：
- **快照行**（列头明写「此表为 2026-11-02 快照，勿据此判断现状」）—— 如 `:113`、`:114` 的 D17 格；
- **现值索引行** —— 如 `:140`。

今晚 WB-3 因为**只读了快照行**，把「D17 已结项」误判成「D17 未开工」，直接导致一张卡 BLOCKED；DB-7 复核才发现这是「过期快照 vs 现值」的索引冲突。同类风险在整份 backlog 里都存在（`D1`–`D21` 每行都有一份快照格 + 一份现值格）。**这个体检脚本就是把这个坑变成机器可查的。**

## 任务（T1）：写 `scripts/check-ledger-snapshot.mjs`
一个**只读**体检脚本，行为：

1. 解析 `docs/plans/prompt-assembly-backlog.md`：
   - 找出所有形如 `| … | DN … |` 的表格行（N 为数字），记录：行号、缺陷编号（`D1`/`D17`/`D21` 等）、该行所处表格的列头行行号。
   - 找出列头里**含“快照”字样**的表格区域（快照区），与不含的（现值区）。
2. 对每个缺陷编号，输出一行状态：
   - `快照行: <行号> <该格首 40 字>`、`现值行: <行号> <该格首 40 字>`（没有就写 `（无）`）；
   - 判定 `OK`（两处都存在且都能解析）/ `MISSING-PRESENT`（缺现值行）/ `MISSING-SNAPSHOT`（缺快照行）/ `AMBIGUOUS`（同一区里出现多行，无法判定哪个是现值）。
3. 输出格式：默认人读（表格对齐）；`--json` 输出机器可读（字段：`id`、`snapshotLine`、`presentLine`、`verdict`）。
4. 退出码：全部 `OK` ⇒ 0；存在 `MISSING-*` 或 `AMBIGUOUS` ⇒ 1（供将来接线用）；文件不存在/解析失败 ⇒ 2 并打印原因，**不要抛栈**。
5. **必须写的注释块**（脚本开头）：说明这个脚本为什么存在、判据是什么、以及「为什么不用正则直接匹配 `已结项` 字样」（因为快照格里也可能出现历史状态词，按词匹配会误报）。
6. **不要**改文件、不要写任何缓存/临时文件（除了 stdout）。

### 验收（自检，不跑测试套件）
- 在 `wt-2` 里实际跑一次 `node scripts/check-ledger-snapshot.mjs`，把**原样输出**贴进报告。
- 再跑一次 `node scripts/check-ledger-snapshot.mjs --json`，贴前 5 个对象的原文。
- 自报 `exit code`（两条命令各自）。
- 若脚本对 D17 的判定与今晚已知事实不一致（D17 快照行 `:114`、现值行 `:140` 都存在），必须在报告里明写「判定与已知事实不符」，不许调参掩盖。

## 允许命令（白名单）
- `node scripts/check-ledger-snapshot.mjs`（你自己写的那个）
- `Get-Content` / `Select-String` / `Get-ChildItem`
- `git -C C:\develop\workspace\AI-writer\wt-2 status --short`
- `node <看板 CLI> claim/tag`

不许：跑既有测试套件、跑 dev、改其它文件、git 写操作。

## 交付四段（写在卡报告里）
1. 结论（脚本能不能用、对 D17 判定对不对）；
2. 改动清单（2 个新文件，给路径与行数）；
3. 原始输出（两次运行的原样 stdout + exit code）；
4. 未做项 / 不确定（例如：本卡只覆盖 backlog 一份文件，其它台账未覆盖）。

报告末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。
交回：`node … tag <卡ID> --add review --remove external --release --agent workbuddy:worker`

