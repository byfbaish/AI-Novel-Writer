From: developer · AI writer项目组 | 906d802a
To: 项目总负责人 · AI writer项目组 | 64419d69 | 群分身

# wt-2 → exp/resource-ledger 收口方案（v2 · 只计划，不动分支）

> 性质：v1（07:2x）是仅计划稿；**v2 追加 §8 三项债实测与 §9 合并执行记录（合并已按 07:40 授权完成，提交 `69cd4a41`，未推送，`wt-2` 全程只读）**。v1 原文保留不动。
> 派单方：项目总负责人（07:17 派）。取证时间：2026-11-16 07:20–07:24 CST。

## 0. 起点与现状（只读实测）

| 项 | develop 检出 | wt-2 检出 |
|---|---|---|
| 路径 | `C:\develop\workspace\AI-writer\develop` | `C:\develop\workspace\AI-writer\wt-2` |
| 分支 | `exp/resource-ledger` | `agent/wt-2` |
| HEAD | `545988b260160fa495abd9046f2d433157961cf3` | `51e95bf8e3a3f903e2ffc217f338332e00c7d0ec` |
| porcelain | 0 行 | 0 行 |
| 与远端 | `[origin/exp/resource-ledger: ahead 3]`（3 条提交未推） | 无上游跟踪 |

- merge-base：`26627655c61fd84410412f109edc161537eac950`（两分支共同祖先）
- 分叉：`git rev-list --left-right --count exp/resource-ledger...agent/wt-2` = **3 / 1**
  - 仅 develop 有：`545988b2` Hy4 禁用、`e3dafb51` 空章中位数、`747fdbb4` 断链修复
  - 仅 wt-2 有：`51e95bf8` WORKBUDDY_ALLOWED_CWDS（QA 首验 PASS 的受判件，父 `26627655`）
- 两侧文件重叠面：`scripts/workbuddy/workbuddy-attach.mjs`（双方都改，改的是同一 `usage()` 区域）、`scripts/workbuddy/__tests__/`（各改各的测试文件，不重叠）。
- `agent/p51-median`（worktree `wt-p51`）也停在 `e3dafb51`，与本收口无关，不动。

## 1. 可行性：dry-run 已证无冲突（未写工作区）

```
git merge-tree --write-tree agent/wt-2 exp/resource-ledger
→ c877af69f8e2e262231e7f4febf7ab3c05f3e312   exit=0
```
- 现代 `--write-tree` exit 0 ⇔ 无冲突；旧式 `git merge-tree <base> <ours> <theirs>` 输出 `<<<<<<<` 计数 **0**，两法互证。
- 合并树相对两侧的差异正是对方那一侧的增量：
  - 对 `exp/resource-ledger`：3 文件 +175/−12（`attach.test.mjs` 103/0、`attach.mjs` 66/…、`workbuddy-attach.mjs` 18/…）
  - 对 `agent/wt-2`：8 文件 +190/−66（即 develop 侧 3 条提交）
- 合并结果的 `usage()` 人工核过：wt-2 的「默认只认 wt-2 + WORKBUDDY_ALLOWED_CWDS 注册」两行**保留**，545988b2 的「`--model` 只允许 DeepSeek-V4.1-Flash」「模型策略工作日高峰」两行也**保留**，语义不打架。

## 2. Hy4 技术债：合回即消失，不是待改项

QA 报告 §三①的技术债是「wt-2 基线里 `model-policy.mjs` 仍含 Hy4」。该文件 **wt-2 一侧一字未改**，merge 后取 develop 侧版本：

```
git show c877af69:scripts/workbuddy/model-policy.mjs | grep -n 'HY4_DISABLED\|ALLOWED_MODELS ='
26: export const HY4_DISABLED = true
31: export const ALLOWED_MODELS = HY4_DISABLED ? [MODEL_DEEPSEEK_FLASH] : [MODEL_HY4, MODEL_DEEPSEEK_FLASH]
74/112/120: 三处分支均在 HY4_DISABLED 下短路
```
⇒ **merge 完成后该槽位自动不再选 Hy4，无需另开改码卡**。项目总负责人「合回时一并修」的口径可以简化为「合回即修好，只作验收断言」。
仍留一个**文案 nit（不阻断）**：合并后 `--cwd` 选项行仍写「只允许 wt-2；改到别处会被拒」，与新增白名单注册能力不完全对应（上面已有注册说明行兜住）。要不要顺手改这半句，由派单方定，不进本方案默认范围。

## 3. 收口方式：建议 merge（保 SHA），否决 rebase

| 方式 | 结果 | 判断 |
|---|---|---|
| **merge（普通或 `--no-ff`）** | 新合并提交，`51e95bf8` 保留为祖先 | **推荐**：QA PASS 绑的就是 `51e95bf8`，SHA 不变⇒判词继续有效；`git revert -m 1 <merge>` 一步可回滚 |
| rebase wt-2 到 develop | 线性，但 `51e95bf8` 被改写为新 SHA | **否决**：PASS 绑定失效，须重走派验；且改写的是 WorkBuddy 槽位提交，等于替它改历史 |
| fast-forward | 不可能：已分叉 3/1 | — |

补充：若后续要进 `dev_byf` / `master`，那是第二次合并，另开卡，不在本方案内。

## 4. 判据（执行方必须逐条贴原样输出）

1. 开工前：`git -C <develop> rev-parse --abbrev-ref HEAD` = `exp/resource-ledger`；`git rev-parse HEAD` = `545988b2`；`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均空（R4 口径）；`git -C <wt-2> rev-parse HEAD` = `51e95bf8`。
2. 合并：`git merge --no-ff agent/wt-2 -m "merge: bring wt-2 whitelist card p55 into exp/resource-ledger"`，期望无冲突直接成功；若打印冲突 ⇒ 停手、`git merge --abort`、报派单方，**不许自行解冲突**。
3. 合并后：`git rev-list --count 26627655..HEAD` = 4（3+1+merge）；`git merge-base --is-ancestor 51e95bf8 HEAD` exit 0；`git diff --stat exp/resource-ledger@{1} HEAD` 恰为上述 3 文件 +175/−12；`git status --porcelain` 空。
4. Hy4 断言：`grep -n 'HY4_DISABLED = true' scripts/workbuddy/model-policy.mjs` 命中；`node -e` 取 `ALLOWED_MODELS` 只含 `DeepSeek-V4.1-Flash`；不设 `WORKBUDDY_ALLOWED_CWDS` 投非 wt-2 仍 `[refuse]`（G1 回归）。
5. 测试：`node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs scripts/workbuddy/__tests__/model-policy.test.mjs`；闸门 `pnpm check:fast` 全绿。合并后测试数应从 98 变为 98（两侧测试互不重叠，模型策略 8 条断言随 develop 侧版本生效）。
6. 不推送。推送属对外写动作，须主人点头，且 `origin` 推送目标本身待拍板（见 §6）。

## 5. 回滚路径（说出就不做，做了就能退）

- 合并前记：`git rev-parse HEAD` = `545988b2…`（本方案 §0 冻结值）。
- 回滚：`git reset --hard 545988b260160fa495abd9046f2d433157961cf3`（未推送，无远端副作用）；若已推送则改用 `git revert -m 1 <merge-sha>`。
- 边界：合并只在 develop 检出做，`wt-2` 全程只读（`agent/wt-2` 分支指针不得移动）；合并提交不改任何已跟踪文件内容以外的东西，不删文件、不改 `.gitattributes`。

## 6. 仍需拍板 / 依赖（不属本方案能自行决定）

1. **执行方是谁**：`wt-2` 我按只读条款不碰；合并动作发生在 develop 检出、写的是 `exp/resource-ledger`，需要派单方明确由谁执行（可派我，但须给「可改码/可提交」授权行）。同一时刻只允许一个提交。
2. **`origin` 推送目标**与 `exp/resource-ledger` 未推的 3 条一起待主人裁定（已知未决项）。
3. 合并后是否立刻向 `dev_byf` 前进，另开卡。

## 7. 本次未做的事（留痕）

- 未 checkout、未 merge、未 commit、未 push；未在 `wt-2` 写入任何字节。
- `git merge-tree --write-tree` 只写了对象库的一次性松散对象（树/索引计算），不改文件、不改 ref、不影响工作区。
- 未跑测试（不做代码判定，测试留给执行方与 QA）。

## 8. 三项技术债：合并后实测现状（2026-11-16 07:44）

**先说结论：合并只解掉其中 1 项（②），另 2 项（①③）合并不动，必须另开卡。** 合并实际只动 3 个文件（`attach.test.mjs` 103/0、`attach.mjs` 57/9、`workbuddy-attach.mjs` 15/3），**两份文档与 `model-policy.mjs` 一个字没变**。

| # | 债 | 位置 | 合并后状态 | 依据 |
|---|---|---|---|---|
| ① | 「归属固定／只允许 wt-2」与白名单语义不符 | `docs/agents/workbuddy-channel.md:130` | **仍在**（合并不碰此文件） | `git diff --numstat 545988b2..HEAD` 无该文件；合并前 develop 与 wt-2 两侧此行逐字相同 |
| ② | usage 里 Hy4 文案 | `scripts/workbuddy/workbuddy-attach.mjs`（wt-2 侧 :811/:813） | **已消失** | `grep -c Hy4 scripts/workbuddy/workbuddy-attach.mjs` = **0**（合并取 545988b2 版 usage） |
| ③ | `model-policy.mjs` 白名单含 Hy4、「23:00–08:00 用 Hy4」文案 | `scripts/workbuddy/model-policy.mjs` | **代码层已闭，文档层仍在** | `HY4_DISABLED = true`（:26）；运行时 `ALLOWED_MODELS = ["DeepSeek-V4.1-Flash"]`（实跑 node import 取值）；但 `docs/agents/workbuddy-channel.md` 第 138–148 行仍整表写「≤11-15 全天走 Hy4」「23:00–08:00 走 Hy4」，全文 Hy4 出现 **8** 次 |

### ① 的实情（比「文案不符」更具体）

代码侧的真实护栏不是「白名单」，是**单目录 pin + 环境变量追加注册**：
- `scripts/workbuddy/workbuddy-attach.mjs:65`：`DEFAULT_CWD = path.resolve(REPO_ROOT, '..', 'wt-2')`
- `scripts/workbuddy/attach.mjs:483` `checkPinnedCwd({ cwd, pinnedCwd, force })`：命中 pinned 即通过；否则 `--force` 才过；否则返回含「目标目录不在本通道的固定归属里」的 reason。
- 追加目录靠 `WORKBUDDY_ALLOWED_CWDS`（`51e95bf8` 引入）在 CLI 层注册。
- **文档 :130 仍写「`--cwd` 指到别处会直接 exit 1 拒绝，只有 `--force` 能越过」——漏了 env 注册这条路**，读者会以为只能 `--force`。这是本条债的准确表述（不是「白名单与固定归属冲突」）。

### ③ 的建议范围（下次碰这两个文件时一并做，本卡不做）

1. `docs/agents/workbuddy-channel.md` §4 模型策略表：删 Hy4 两行，改「全线 `DeepSeek-V4.1-Flash`，Hy4 由 `HY4_DISABLED` 禁用」。
2. `model-policy.mjs`：`MODEL_HY4` / `HY4_FREE_WINDOW` / `HY4_PROMO_ALL_DAY_UNTIL` 属**受开关保护的死分支**，保留可恢复性，**不建议删**；只建议注释标明「仅在 `HY4_DISABLED=false` 时可达」。

## 9. 合并执行记录（受项目总负责人 07:40 授权：可改码＋可提交，仅 develop、不推送、wt-2 只读）

开工前：`exp/resource-ledger` HEAD `545988b2`、porcelain 0 行、R4 双空（`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均空）。

```
$ git merge --no-ff agent/wt-2 -m "merge: bring wt-2 whitelist card p55 into exp/resource-ledger"
Auto-merging scripts/workbuddy/workbuddy-attach.mjs
Merge made by the 'ort' strategy.
 scripts/workbuddy/__tests__/attach.test.mjs | 103 ++++++++++++++++++++++++++++
 scripts/workbuddy/attach.mjs                |  66 +++++++++++++++---
 scripts/workbuddy/workbuddy-attach.mjs      |  18 ++++-
 3 files changed, 175 insertions(+), 12 deletions(-)
```

- 合并提交 **`69cd4a41cf5f89a813d09104bcf744959922dc7c`**（`69cd4a41`），双亲 `51e95bf8` + `545988b2`，**无冲突、未 `--abort`**。
- `git rev-list --count 545988b2..HEAD` = **2**（merge + `51e95bf8`）；`merge-base --is-ancestor 51e95bf8 HEAD` 成立。
- `git diff --numstat 545988b2..HEAD` 与上表逐字一致，未碰禁改区；合并后 porcelain 0 行。
- Hy4 断言：`HY4_DISABLED = true`（`model-policy.mjs:26`）命中；`node -e` 取 `ALLOWED_MODELS` = `["DeepSeek-V4.1-Flash"]`；`workbuddy-attach.mjs` 内 Hy4 计数 0。
- 单测：`node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs` → **74 passed / 74**（459ms）。
- 闸门：`pnpm check:fast` 全绿（typecheck ✓ 24.4s；doc-links 1468 查 0 破；doc-placement 438 份 0 违规）。
- **未推送**（授权边界）；回滚锚点仍是 `545988b2`，`git reset --hard 545988b260160fa495abd9046f2d433157961cf3`。
- 按授权，usage 文案 nit（§2）本卡未改，仍记为技术债（已并入 §8 ③）。

<!-- DONE -->
