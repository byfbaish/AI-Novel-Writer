From: 项目总负责人 · AI writer项目组 | 64419d69
To: QA · AI writer项目组 | 57c8bd18 | 群分身

# 派验单：wt-2 → exp/resource-ledger 合并提交（p55 合回）

- 派单方：项目总负责人（07:34 授权 developer 执行合并）
- 受判对象：`C:\develop\workspace\AI-writer\develop` 分支 `exp/resource-ledger` HEAD＝`69cd4a41`（完整 `69cd4a41cf5f89a813d09104bcf744959922dc7c`）
- 合并方式：`merge --no-ff agent/wt-2`（保 `51e95bf8` 为祖先，p55 判词不失效）
- 回滚锚点：`545988b2`（合并前 develop HEAD）
- 关联：p55 原判词 `reports/p55-pinned-cwd-allowlist-qa.md`（`5498905b…`）与补记 `p55-qa-addendum-1.md`（`597e0b19…`）**不重判**；本单只验合并结果

## 一、须验判据（逐条贴原样输出）

1. 父与身份：`git rev-parse HEAD`＝`69cd4a41…`；`git log --oneline -3` 显示 merge commit；`git log -1 --pretty=%P` 两个父（`545988b2` 与 `51e95bf8`）。
2. 祖先关系：`git merge-base --is-ancestor 51e95bf8 HEAD` exit 0（保 SHA）。
3. 提交计数：`git rev-list --count 26627655..HEAD`。**派单方实测为 5**（3 条 develop 侧 + 1 条 wt-2 侧 + 1 个 merge commit），方案 §4 第 3 项写「=4」是方案算错，以实数 5 为准；若你实测非 5，按实测报并说明构成。
4. 变更集：`git diff --numstat 545988b2..HEAD` 恰为三文件——`__tests__/attach.test.mjs` 103/0、`attach.mjs` 57/9、`workbuddy-attach.mjs` 15/3；无其他文件、未碰禁改区。
5. 工作区：`git status --porcelain` 空；R4 口径 `git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均空。
6. Hy4 断言：`grep -n 'HY4_DISABLED = true' scripts/workbuddy/model-policy.mjs` 命中（派单方实测 `:26`）；`ALLOWED_MODELS` 运行时只含 `DeepSeek-V4.1-Flash`。
7. 回归：不设 `WORKBUDDY_ALLOWED_CWDS` 投非 wt-2 仍 `[refuse]`（G1 回归）；`node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs scripts/workbuddy/__tests__/model-policy.test.mjs`；`pnpm check:fast` 全绿。
8. 边界：无 tag、未推送（`git log origin/exp/resource-ledger..HEAD --oneline` 只增不减旧 3 条 + 新 2 条）。

## 二、明确不做的

- 不重开 p55 判词、不改原报告；`--cwd` 文案 nit 不在本单范围（已记技术债）。
- 不验 `dev_byf`/`master`（第二次合并，另开卡）。
- 不推送（推送属对外写动作，等主人裁定 origin）。

## 三、交付

- 报告落 `.batch/night/reports/merge-p55-into-develop-qa.md`，§五 三行头（执行方／model／末行 `<!-- DONE -->`）
- 判词只写 PASS / FAIL / PASS-with-notes；判词绑受判 SHA `69cd4a41`，HEAD 离开即失效
