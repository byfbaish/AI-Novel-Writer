执行方：developer
model=DeepSeek V4 · 1x · 直连
# relay 仓一次推完 4 笔 · 预案与回滚（未执行，等主人点头）

## 0. 一句话
可推。4 笔全在 `master` 上、线性 fast-forward，无 force、无 tag 变更；回滚只需一条 `--force-with-lease` 回 `fdf7b17`。

## 1. 现场实测（2026-11-15 19:27 取样）
- 仓库 `C:\develop\workspace\dsh-handoff-relay`，分支 `master`，工作区干净（`status --porcelain=v1` 0 行，`--cached` 0 行）。
- HEAD `51a87c5417c61372210c14c1c362b8830e1621e7`；远端已跟踪 `origin/master` = `fdf7b17`。
- `git rev-list --left-right --count master...origin/master` = `4   0` ⇒ 本地领先 4、远端 0 独有 ⇒ **纯 fast-forward**。
- 未推 4 笔（旧→新）：
  1. `82dfbbe` fix: inject From/To identity header into handoff messages（index.js 57+/−5，index.test.mjs 95+/−2）
  2. `40f34b5` docs: sync README example for From/To header（README.md 18+/−1）
  3. `f41b031` fix: label relay From by watch directory and log identity conflicts（README 37+/1−，index.js 112+/20−，index.test.mjs 195+/0−）
  4. `51a87c5` fix: strip session- prefix from To id8 and keep To title segment non-empty（index.js 27+/2−，index.test.mjs 84+/0−）
- 远端 `origin` = `git@github.com:byfbaish/dsh-handoff-relay.git`（SSH，11-14 已修好，`ls-remote` 与 `push --dry-run` 均 exit 0）。
- 版本：`package.json` `version: 0.5.0`；tag `v0.5.0` 停在旧提交，`git describe` = `v0.5.0-5-g51a87c5`。**本次推送不动 tag、不 publish**（发版方式另议）。

## 2. 推送预案（主人点头后按序执行，逐条回读）
1. 预检（只读）
   ```bash
   cd /c/develop/workspace/dsh-handoff-relay
   git fetch origin
   git rev-list --left-right --count master...origin/master   # 期望 4  0
   git status --porcelain=v1                                  # 期望空
   ```
2. 脱敏检查（只读）：`git log -p origin/master..HEAD | grep -nE "(ghp_|github_pat_|sk-|Bearer [A-Za-z0-9]{20,})"`，期望零命中。
3. dry-run：`git push --dry-run origin master`，期望 `fdf7b17..51a87c5  master -> master`。
4. 真推（**不带 --force**）：`git push origin master`。
5. 远端回读（三方口径）：`git fetch origin && git rev-parse --short origin/master` 期望 `51a87c5`；`git rev-list --left-right --count master...origin/master` 期望 `0  0`。
6. 有 GitHub 页面可达时，再由第二人看一次 `commits/master` 顶部是否为 `51a87c5`，不采信我的自报。

## 3. 回滚办法（只在推送后发现问题时用）
- 未推送过别人：`git push --force-with-lease=master:fdf7b17 origin fdf7b17:master`（把远端拉回 `fdf7b17`）。
- 若已有人基于新提交工作：**不 force**，改用 `git revert` 追加反向提交，逐笔 revert 或一次性 `git revert --no-commit 82dfbbe^..51a87c5` 后提交。
- 回滚后同样回读 `origin/master` 短哈希，不以口头为准。

## 4. 中止条件（任一命中即停手回报，不自行处置）
- 预检 count 不是 `4  0`（说明有人动过远端或本地）。
- 工作区出现非空 porcelain。
- 脱敏检查命中任何凭据样式字符串。
- dry-run 报 non-fast-forward 或要求认证。
- 推完 `origin/master` 回读不等于 `51a87c5`。

## 5. 邻居状态（顺带核实，供主人看整体）
- 主线仓 `C:\develop\workspace\AI-writer\develop`：分支 `exp/resource-ledger`，HEAD `e3dafb51`，**已跟踪改动 0 行**、index 0 行；仅 1 个未跟踪文件 `docs/agents/bot-session-identity.md`（3,855B / 12:22，不是我写的，属文档类，未入 `git add`）。若主人要求「工作区完全干净」，需先决定这份文档归谁提交。
- 本预案**不包含** `npm publish`、打 tag、改 `cordis.patch.yml`。

## 6. 需要主人拍的三点
1. 推不推这 4 笔（建议：推。都在 `master` 上、纯 ff、可回滚）。
2. 推送后是否立即打 `v0.5.1` tag 并 publish（建议：先推、验收一轮点再发版）。
3. `docs/agents/bot-session-identity.md` 归谁提交、是否本次一并处理（建议：不在本次，单独一张文档卡）。

<!-- DONE -->
