执行方：QA
model=未取到（本会话不暴露 model 标识，不编） | 倍率=未取到 | provider=未取到

# p55 归属白名单 · 首次验收判词

- 卡号：p55-pinned-cwd-allowlist
- 受判提交：`51e95bf8e3a3f903e2ffc217f338332e00c7d0ec`（`feat(workbuddy): allow extra pinned cwds via WORKBUDDY_ALLOWED_CWDS`）
- 受判件：`cards/p55-pinned-cwd-allowlist.v2.md`（10,216B / MD5 `a3203be6ed830045dbb9b34b40507a36` / 106 行 / crlf 0）＋ `review-requests/p55-pinned-cwd-allowlist.md`（3,353B / MD5 `34128feaebccf274709c7e314607a7ab` / 50 行 / crlf 0）
- 工作区：`C:\develop\workspace\AI-writer\wt-2`，分支 `agent/wt-2`
- 判词时间：2026-11-16 07:09 (+08:00)
- **结论：PASS**（G1–G8 全过；2 项非阻断观察见 §三）

## 一、起点校验（开工三项）

| 项 | 命令 | 实测 |
|---|---|---|
| HEAD 落在本槽位 | `git rev-parse --abbrev-ref HEAD` | `agent/wt-2` ✓ |
| 起点是祖先 | `git merge-base --is-ancestor 26627655 HEAD` | exit 0 ✓（`HEAD^` = `26627655`） |
| 工作区干净 | `git status --porcelain \| wc -l` | `0` ✓ |

## 二、判据逐条（G1–G8）

**G1 不注册时行为零变化 —— PASS**
- 端到端真跑（不设 env，请求非 wt-2 目录）：
  `node scripts/workbuddy/workbuddy-attach.mjs status --cwd "C:\develop\workspace\dsh-group-rules-prompt"`
  → `exit=1`，stderr `[refuse] 目标目录不在本通道的归属白名单里…`，`允许=` 只列 `C:\develop\workspace\AI-writer\wt-2`。
- 判据层：`checkPinnedCwd({cwd: DEFAULT_CWD, pinnedCwd: DEFAULT_CWD})` → `{"ok":true,"forced":false}`；未注册的第三目录 → `{ok:false}`，reason 同时含「归属白名单」与「WORKBUDDY_ALLOWED_CWDS」。

**G2 注册后可投 —— PASS**
- `checkPinnedCwd({cwd: EXTRA, pinnedCwd: DEFAULT_CWD, allowedCwds: [EXTRA]})` → `{"ok":true,"forced":false}`，`EXTRA = C:\develop\workspace\dsh-group-rules-prompt`。
- 成功路径未做端到端真投：此刻 WorkBuddy 侧可能有执行方在跑，同一时刻只许一个执行方，故只到判据层＋单测层（见 §三 观察②）。

**G3 按路径段判包含 —— PASS**
- `EXTRA + '-other'` → `{ok:false}`；`EXTRA + 'X'` → `{ok:false}`（裸 `startsWith` 会误放行，实现用 `isUnderCwd` 段判，`attach.mjs` 新增该函数并让 `samePath` 共用 `normalizeCwd`）。
- `EXTRA + '\sub\dir'` → `{ok:true}`；未注册的 `...\AI-writer\develop` → `{ok:false}`。

**G4 边界拒绝与变体放行 —— PASS**
- 注册项含 `*` / `?` → 拒（reason：「归属白名单不支持通配符（* / ?）」）；注册 `C:\` 与 `c:/` → 拒（「不允许注册盘根」）；注册项相对路径 → 拒；请求本身相对路径 → 拒（「目标目录必须是绝对路径」）。
- 大小写与斜杠变体：`c:/develop/workspace/DSH-group-rules-prompt` 对注册 `EXTRA` → `{ok:true}`。

**G5 `--force` 未放宽 —— PASS**
- `force:true` 且不在白名单 → `{"ok":true,"forced":true}`（`forced` 标记仍在，语义未变）；`force:false` 且不在白名单 → `{ok:false}`；注册项非法时即使 `force:false` 也先拒、不静默忽略。

**G6 用例数不减、无跳过 —— PASS**
- `node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs scripts/workbuddy/__tests__/model-policy.test.mjs`
  → `Test Files 2 passed (2)` / `Tests 98 passed (98)` / `skipped 0`。
- 基线对比：`attach.test.mjs` 的 `it(` 65（父 `26627655`）→ 74（HEAD），合计 89 → 98；`git grep` 无 `it.skip` / `it.only` / `describe.only`。

**G7 提交纪律 —— PASS**
- `git diff --name-status 26627655..HEAD` 恰三文件：`scripts/workbuddy/attach.mjs`（+57/−9）、`scripts/workbuddy/workbuddy-attach.mjs`（+15/−3）、`scripts/workbuddy/__tests__/attach.test.mjs`（+103/−0）——无多余文件（add 是否点名无法从历史反推，以「变更集恰为点名三文件」为据）。
- 禁改区八项交集为空：未触及 `cordis.patch.yml`、Bot model、`docs/`、`model-policy.mjs`、`package.json`、`.gitignore`、`--force` 逻辑、`DEFAULT_CWD` 取值（`DEFAULT_CWD = path.resolve(REPO_ROOT,'..','wt-2')` 未改）。
- `git status --porcelain` = 0；`git tag --points-at HEAD` = 0；无远端分支包含该提交（未推送）。

**G8 `pnpm check:fast` —— PASS**
- `[check:fast] typecheck ✓ 17.2s` / `doc links: checked 1470, broken 0` / `doc placement: 扫描 437 份 md，新增 0 条` / `全部通过。`

## 三、非阻断观察（不构成 FAIL，交负责人裁）

① **Hy4 残留仍在 wt-2 基线**：`workbuddy-attach.mjs:811/813` 的 usage 仍写「只允许 Hy4 / DeepSeek-V4.1-Flash」「23:00–08:00 用 Hy4」，`model-policy.mjs` 的白名单也仍含 `MODEL_HY4`。原因：Hy4 禁用提交 `545988b2` 在 `exp/resource-ledger`，未进 `agent/wt-2`（`git merge-base --is-ancestor 26627655 HEAD` 成立，但 `545988b2` 不是本链祖先）。影响：夜间在本槽位派活若不显式 `--model DeepSeek-V4.1-Flash`，仍会选 Hy4（主人 11-16 已全面禁用）。建议：决定 `545988b2` 何时合入本槽位，或在派单侧保持「必带 `--model`」纪律直到合入。
② **G2 成功路径未端到端真投**：出于「同一时刻只允许一个执行方」与不抢 WorkBuddy 会话，未实投到注册目录；判据与单测双层已覆盖，若负责人要求端到端，请在确认无并发窗口后再验一次。

## 四、复核方式

- 判据层 17 条探针脚本：`C:\Users\<用户名>\AppData\Local\Temp\p55-qa-probe.mjs`（不引用仓库内测试，import 产品代码 `attach.mjs`；`DEFAULT_CWD` 从源码字面读取，避免 import CLI 入口触发 usage）。
- 全部命令可在 `C:\develop\workspace\AI-writer\wt-2` 原地复跑。

<!-- DONE -->
