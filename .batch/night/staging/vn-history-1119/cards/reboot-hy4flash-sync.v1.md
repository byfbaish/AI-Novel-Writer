From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: developer · AI writer项目组 · 群分身

# reboot-hy4flash-sync（复工首卡 · A 类）

状态：**可投**（前置＝本卡已落盘并被 developer 在群里确认领取；无其他前置）
估时：改码 40 分钟 + 首验 30 分钟
执行方：developer；首验方：QA（A 类卡必填）
类型：**A 类**——会产生仓库提交，必须配派验单

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\develop`（**本卡就是主工作区卡**，明写允许在此改码与提交）
- 分支 `exp/resource-ledger`，起点 HEAD `69cd4a41`
- 开工第一动作（早于任何写盘、早于任何 `pnpm`）逐条核，任一不符即停手，回执照抄实质输出，不得自行 `cd` 到别处继续：
  1. `git rev-parse --show-toplevel` 规范化后须等于 `C:/develop/workspace/AI-writer/develop`（正/反斜杠、大小写规范化后比较）
  2. `git branch --show-current` ＝ `exp/resource-ledger`
  3. `git rev-parse --short HEAD` ＝ `69cd4a41`
  4. `git diff --numstat HEAD` **必须恰好是** `6	1	scripts/workbuddy/model-policy.mjs`（本卡唯一允许的既有脏区＝主人 01:10 授权落盘的 flash 白名单改动，未提交）；`git diff --ignore-cr-at-eol --stat HEAD` 同样只能列这一个文件。出现第二个文件即停手。
  5. `git -c core.quotepath=false status --porcelain=v1` 白名单全文（多一项即停手）：
     ```
      M scripts/workbuddy/model-policy.mjs
     ?? .c/
     ?? reports/evidence-receipt-side-1116.md
     ?? reports/hy4-modelname-probe-20261117.md
     ?? reports/wo-hy4-modelname-20261117.md
     ?? scripts/workbuddy/space-readonly-check.mjs
     ```
  6. 目标文件存在：`scripts/workbuddy/model-policy.mjs`、`scripts/workbuddy/__tests__/model-policy.test.mjs`、`.batch/night/org/ledger-append-1117-hy4flash-auth.v6.md`
- 环境：`node_modules` 已有，**禁 `pnpm install` / `rebuild` / `pnpm dev`**（切 ABI 会打断别的槽位）。

## 1. 起因与背景

主人 2026-11-17 01:10 在 to-owner 私聊回「1」（三选一第 1 条：只开 `Hy4 flash`、`Hy4` 继续禁用），大肥鱼@主身 01:11 落盘 6 行到 `scripts/workbuddy/model-policy.mjs`，未提交。由此产生三笔必须同一次收掉的欠账：

1. **红测试**：`vitest run scripts/workbuddy/__tests__/model-policy.test.mjs` → `1 failed | 24 passed`，失败在 `scripts/workbuddy/__tests__/model-policy.test.mjs:170` `expect(ALLOWED_MODELS).toEqual([MODEL_DEEPSEEK_FLASH])`——该断言写的是授权前口径。
2. **缺出处行**：`describeModelPolicy()` 输出没有任何「谁在何时授权」的痕迹，事后无法自证合规。
3. **记账件 v6 三处未收**：`§7`/`§8` 重号（`:62`、`:70` 与 `:42`、`:47` 撞号）、`:47` 版本说明停在「本 v2 取代 v1」（全文零次 v6）、`:70` 口径仍写「潜在风险」，而实测已证明是「夜间＋旧树」的当时态。

## 2. 要改成什么（唯一口径）

一次改完以下四件，**不拆三轮**：

**① 测试同步**（`scripts/workbuddy/__tests__/model-policy.test.mjs`）
- `:170` 期望值改为 `[MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH]`
- `:169` 用例名与 `:23` 注释同步改写为授权后口径（点名授权渠道与日期，写「主人 2026-11-17 01:10 主身私聊授权，只开 `Hy4 flash`；`Hy4`(0.29x) 仍禁用」）
- **`rejectUnknownModel('Hy4')` 仍拒那条断言一字不动**

**② `auth=` 出处行**（`scripts/workbuddy/model-policy.mjs`）
- `describeModelPolicy()` 每条白名单输出末尾追加 `auth=<角色>|<渠道>|<ISO>`；取不到写 `auth=UNVERIFIED`
- `MODEL_HY4_FLASH` 那条写 `auth=主人|主身私聊|2026-11-17T01:10+08:00`；`MODEL_DEEPSEEK_FLASH` 那条无法溯源则写 `auth=UNVERIFIED`
- 机检正则：`^auth=(UNVERIFIED|\S+\|\S+\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})`
- **缺 `auth=` 判不合格（不是 WARN）**

**③ 记账件另存 v7**（`.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md`，v6 字节不动）
- 编号归位：原 `§7`(`:62`)→`§11`、原 `§8`(`:70`)→`§12`；`:42` 的 `§7`、`:47` 的 `§8` 保持原名不改（它们是机制确认与版本说明，不与前者撞）
- `§8`(`:47`) 版本说明在「本 v2 取代 v1」之后补 `v3`、`v4`、`v5`、`v6` 各一行，再补一行「v7＝由 v6 改来：编号 `:62`→§11、`:70`→§12；`:70` 口径改为『夜间 23:00–08:00＋跑了旧树脚本』」
- `§12`（原 `:70`）口径改写：把「潜在风险」改成实测定性——旧树**只在 23:00–08:00 返回 `Hy4`**（`pickModel(date)` 实测 `23:30`／`02:00`→`Hy4`(`hy4-free-night`)，`12:30`／`20:00`→`DeepSeek-V4.1-Flash`，`15:00`→`blocked:true`）；**禁止写「已堵住」**
- v7 首行 `状态：现行`，第 2–3 行 From/To

**④ 副本处置（本卡只读，不改）**——我拍板：**7 份副本本卡一律不动、不提交**
- 理由：7 棵是各自分支/detached 的 worktree，改完不提交＝7 棵树长期 dirty（反而妨碍它们当干净工作区开工）；提交＝往 7 个分支各写一次提交，越权且污染分支历史。
- 改为：developer 在报告里给**逐棵只读判定表**（8 棵含 develop），列`树路径 / 分支或 HEAD / 文件 md5 / HY4_DISABLED / ALLOWED_MODELS / pickModel(23:30) / 结论`，结论只有两种：`可派活`（仅 develop）或 `禁派活`。
- 派活入口纪律（04:0x 已生效的裁定 A 继续有效）：一切派活只用 `C:/develop/workspace/AI-writer/develop/scripts/workbuddy/workbuddy-attach.mjs` 绝对路径发起；`wt-*`／`night-probe`／`test-master` 树里同名脚本**禁跑**。

## 3. 落点与禁改区【硬】

- 改：`scripts/workbuddy/model-policy.mjs`（`describeModelPolicy` 段 + `:23`/`:169`/`:170` 相关注释与断言所在测试文件）
- 补：`scripts/workbuddy/__tests__/model-policy.test.mjs`
- 另存：`.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md`
- **禁改**：
  - `HY4_DISABLED=true` 与其判定逻辑（`Hy4` 仍禁用这条语义不许动）
  - `pickModel()` 的时段分支、`rejectUnknownModel()` 对 `Hy4` 的拒绝行为
  - `docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目（脚本按字面路径引用）
  - `.batch/night/` 下任何历史件（v1–v6 记账件、卡面、报告一律只读）
  - 其余 7 棵 worktree 的任何文件（本卡只读判定，不许写）
  - notice / `cordis.patch.yml` / 任何宿主配置

## 4. 验收判据【硬】

每条必须能指认（文件:行 或 命令输出），缺一条即不通过：

1. `vitest run scripts/workbuddy/__tests__/model-policy.test.mjs` → **25 passed / 0 failed**（贴原文，含 exit code）；且 `rejectUnknownModel('Hy4')` 仍拒那条用例名与断言未变（给 `git diff` 该段无变化）
2. `describeModelPolicy()` 每条输出含 `auth=`，机检正则 `^auth=(UNVERIFIED|\S+\|\S+\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})` 命中；缺一条即不合格
3. `develop` 树：`HY4_DISABLED===true`、`pickModel(new Date('2026-11-17T23:30:00+08:00')).model !== 'Hy4'`；给命令原文与输出
4. **副本判定表 8 行齐全**（含 develop），每行含树路径/分支或 HEAD/md5/`HY4_DISABLED`/`ALLOWED_MODELS`/`pickModel(23:30)`/结论；结论列只有 `可派活`（develop 1 行）与 `禁派活`（其余 7 行）。**本卡不要求改这 7 棵**，但表必须真实可复跑——每条命令原文进报告
5. 记账件 v7：`§11`/`§12` 存在且无 `§7`(`:62`)、`§8`(`:70`) 残留重号（`grep -n` 输出行号进报告）；`:47` 段之后连续出现 v3、v4、v5、v6、v7 五行；v6 原文件 md5 仍为 `e70654eebbbd09f56acca62990be5fd3`、字节 9,927 未变
6. 正例机检（补说明类）：`grep -c 'auth=' scripts/workbuddy/model-policy.mjs` ≥ 2（改前基线 0）；`grep -n 'auth=' scripts/workbuddy/model-policy.mjs` 行号集合含 `describeModelPolicy` 所在段
7. `pnpm check:fast` 全绿，贴 exit code
8. 提交纪律：一次点名 `git add` 只加 `scripts/workbuddy/model-policy.mjs`、`scripts/workbuddy/__tests__/model-policy.test.mjs`、`.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md`；禁 `git add -A`；**禁 push/tag/publish**
9. 报告首三行定式：第 1 行 `执行方：developer`；第 2 行取数件三元组；第 3 行 `model= | 倍率= | provider=`（provider 须命中 `^magpie/group/`，出现 `deepseek-official`／`deepseek-account` 判不通过）

## 5. 交付物与信号【硬】

- 报告：`.batch/night/staging/reboot-hy4flash-sync-report.md`，末行 `<!-- DONE -->`，写明起点 HEAD、终点 HEAD、`--numstat`、套件输出原文、副本判定表、`check:fast` exit code
- 报告头三行按 §4 判据 9
- 信号文件：`.batch/night/signals/` 下按既有通道投；正文三行＝卡号 / 回执路径 / `<!-- DONE -->`
- 投递留痕：本卡执行方在群内，不走 relay；以群内回执＋报告落盘为准

## 6. 派验单与首验【A 类必填】

- 派验单：`.batch/night/review-requests/reboot-hy4flash-sync.md`（我出）
- 首验单：`.batch/night/reports/reboot-hy4flash-sync-qa-firstcheck.md`（QA 出，另存 `.vN` 不覆盖）
- G1 机检：派验单顶部 `执行方：developer` 与首验单顶部 `执行方：QA` 取值不相等

## 7. 版本纪律

- 卡面改动另存 `.vN.md`，不覆盖；本文件为投出版 v1
- 记账两行并记：投出版哈希＋现行版哈希

## 8. 身份与投递（From/To）【硬】

本卡在群内派发（形态 A）：第 1 行 `From: 项目总负责人 · AI writer项目组 | 5b1e2d16`、第 2 行 `To: developer · AI writer项目组 · 群分身`。判据全文见 `.batch/night/staging/handoff-usage-criteria-v4.md`。
