执行方：QA
被验报告三元组：`.batch/night/staging/reboot-hy4flash-sync-report.md`｜11,207B｜`9c95567bf51fd0ed5aecb23f814899df`｜175 行
model=未采集 | 倍率=未提供 | provider=未提供

# reboot-hy4flash-sync 首验单（QA，2026-11-17 12:05）

判件基准（只认这两份）：派验单 v2 `.batch/night/review-requests/reboot-hy4flash-sync.v2.md`｜3,471B｜`0262c9d4bdfbdd92b2ec030bcb0e7c2a`｜41 行；卡面 v2 `.batch/night/cards/reboot-hy4flash-sync.v2.md`｜10,616B｜`0714a372d4da7616f6f0fd52402905fc`｜119 行。卡面 `:108`「本文件为投出版 v1」按派验单 v2 `:9` 为自我描述笔误，不作判据、不扣分。

**总判：PASS（10 条全部成立；两项偏差不构成不通过，交项目总负责人裁定）**

## 一、逐条判（每条证据均为我自己复跑所得，不采信报告自述）

**判据 1 · 25/25 且附 exit code —— 成立**
- 我实跑 `node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/model-policy.test.mjs`（12:04:10）：`Test Files 1 passed (1)` / `Tests 25 passed (25)` / `EXIT=0`。
- 与报告 `:74-80` 同值（报告写 `exit=0`）。

**判据 2 · `rejectUnknownModel('Hy4')` 仍拒的断言一字未动 —— 成立**
- `git show b5afcea2 -- scripts/workbuddy/__tests__/model-policy.test.mjs` 的 diff 只涉及 `:6`（import 增 `MODEL_HY4_FLASH`）、`:23-27`（注释）、`:169-170`（用例名与期望值）。
- `expect(rejectUnknownModel(MODEL_HY4)).toContain('不在白名单')` 这一行不在 diff 中，现文本仍在 `scripts/workbuddy/__tests__/model-policy.test.mjs:173`。

**判据 3 · `auth=` 每条命中正则 —— 成立**
- 我实跑 `describeModelAuthLines()`，逐行原文：
  - `auth=主人|主身私聊|2026-11-17T01:10+08:00 model=Hy4 flash`
  - `auth=UNVERIFIED model=DeepSeek-V4.1-Flash`
- 两条均命中 `/^auth=(UNVERIFIED|\S+\|\S+\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/`，`regex all match= true`。
- `describeModelPolicy()` 两个分支都带：`23:30 → DeepSeek-V4.1-Flash（…） auth=UNVERIFIED`、`15:00 高峰 → 不派活（…） auth=UNVERIFIED`（源码 `scripts/workbuddy/model-policy.mjs:180`、`:182`）。

**判据 4 · develop 树 `HY4_DISABLED===true`、`pickModel(23:30).model !== 'Hy4'` —— 成立**
- `HY4_DISABLED= true`；`ALLOWED= ["Hy4 flash","DeepSeek-V4.1-Flash"]`；`pick(2026-11-17T23:30+08:00)= {"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak",…}`。

**判据 5 · 副本判定表 8 行齐全、结论列只有可派活/禁派活 —— 成立**
- 我用独立脚本 `node .batch/night/staging/qa-reboot-8trees.mjs` 逐棵 `import('file:///<树绝对路径>/scripts/workbuddy/model-policy.mjs')` 复跑，8 行全部与报告 §2 表逐格同值：`develop`（`fda1e954`，`true`，`["Hy4 flash","DeepSeek-V4.1-Flash"]`，`DeepSeek-V4.1-Flash`）、`wt-p56`（`0ace4a79`，`true`，只 `DeepSeek-V4.1-Flash`）、`wt-1`/`wt-2`/`wt-3`/`wt-docfix`/`wt-p51`/`night-probe`（均 `8e0167aa`，`HY4_DISABLED=undefined`，`["Hy4","DeepSeek-V4.1-Flash"]`，23:30 返回 `Hy4`）；`test-master` 无该文件。
- 结论列与表一致：develop `可派活`，其余 7 行 `禁派活`（`wt-p56` 策略更严但仍非派活入口）。
- 7 棵**确认未被写**，三证：① 逐棵 `git status --porcelain` 中 `model-policy` 命中数均为 0；② 文件 mtime 最新为 `wt-p56` 2026-11-16 08:39，全部早于本次作业；③ md5 与我 11:37 的基线一致。

**判据 6 · 记账件 v7 编号归位与版本说明 —— 成立**
- v7｜10,820B｜`91bdbf8ee88cc04d91ef500c3139df27`｜83 行；标题实测 `§7` `:42`（机制确认）、`§8` `:47`（版本说明）、`§9` `:55`、`§10` `:62`、`§11` `:67`（当日口径）、`§12` `:75`（口径更正）——无重号，也无 `§7`/`§8` 落在 `:62`/`:70` 的残留。
- `:47` 之后连续五行：`:49` v3、`:50` v4、`:51` v5、`:52` v6、`:53` v7＝由 v6 改来。
- v6 原文件 `md5sum`＝`e70654eebbbd09f56acca62990be5fd3`、9,927B，与改前一致（未被原地覆盖）。

**判据 7 · `grep -c 'auth='` ≥2 且行号含 `describeModelPolicy` 段 —— 成立**
- `grep -c 'auth=' scripts/workbuddy/model-policy.mjs` → 4（改前基线 0）。
- 行号 `:180`、`:182`（`describeModelPolicy` 内）、`:186`（注释）、`:190`（`describeModelAuthLines`）。

**判据 8 · `pnpm check:fast` 全绿附 exit —— 成立**
- 我实跑：`[check:fast] typecheck ✓ 31.4s` / `doc links: checked 1468, broken 0` / `doc placement: 扫描 438 份 md，当前违规 0 条，新增 0 条` / `全部通过。` → `EXIT=0`。

**判据 9 · 提交纪律（只点名三件、无 push/tag、无 `-A`）—— 成立，附偏差**
- `git show --stat b5afcea2`：只 2 个文件——`scripts/workbuddy/__tests__/model-policy.test.mjs`（5/2）、`scripts/workbuddy/model-policy.mjs`（35/5）；提交体 `40 insertions(+), 7 deletions(-)`。
- **偏差**：卡面点名第三件 v7 未入提交。原因实测可复现：`git check-ignore -v .batch/night/org/ledger-append-1117-hy4flash-auth.v7.md` → `.gitignore:89:/.batch/`，整目录被忽略；执行方未用 `-f`、未用 `-A`（提交内无未跟踪件混入），负责人 11:47 已裁「v7 与报告不入库属正常」。
- 未 push、未打 tag：`git rev-list --left-right --count origin/exp/resource-ledger...HEAD` → `0	1`；`git tag --points-at b5afcea2` 空。
- 工作区：`git status --porcelain` 仅 5 项未跟踪（全为作业前既有件），已无 ` M model-policy.mjs`。

**判据 10 · 报告首三行定式 —— 成立，附瑕疵**
- `:1` `执行方：developer`；`:2` 取数件三元组；`:3` `model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot`，命中 `^magpie/group/`，未出现 `deepseek-official`／`deepseek-account`。
- **瑕疵**：`:2` 引的派验单是已被取代的旧件（`reboot-hy4flash-sync.md`｜3,037B｜`3190c6e8…`｜39 行），非基准件 `reboot-hy4flash-sync.v2.md`｜3,471B｜`0262c9d4…`｜41 行。卡面引用正确（v2）。建议负责人裁定：出报告 `.v2` 只改这一行，或就此记一笔不追。

## 二、五条红线逐条核（均未触发）
1. 改动其余 7 棵 worktree —— **未触发**（三证见判据 5）。
2. 动 `HY4_DISABLED`、`pickModel()` 时段分支、`Hy4` 拒绝语义 —— **未触发**：`HY4_DISABLED` 仍 `true`；`pickModel` 分支未出现在 diff；`Hy4` 拒绝断言未改。
3. 记账件 v6 被原地覆盖 —— **未触发**（`e70654ee…`／9,927B）。
4. `git add -A` 或把未跟踪 5 项混入提交 —— **未触发**（提交内仅 2 文件）。
5. 报告出现「已堵住」—— **未触发**：报告 `grep -c '已堵住'`＝0；v7 亦为 0，`潜在风险`＝0；报告 `:170-172` 明确只写「把跑哪棵树固定下来」，未宣称洞已补。

## 三、建议
- 本卡建议**放行**（10/10 成立，红线 0 触发）。
- 两项偏差（v7 不入库、报告 `:2` 引旧派验单）**不构成质量缺陷**，是否补报告 `.v2` 由项目总负责人定；若补，我按新三元组另出首验 `.v2`，原件不动。
- 一句提醒（不属判据）：7 棵旧树在 23:00–08:00 仍会返回 `Hy4`，本次只是「跑哪棵树」被钉死；这层边界报告已写明，后续卡不要把它当成依据去说「已修复」。
