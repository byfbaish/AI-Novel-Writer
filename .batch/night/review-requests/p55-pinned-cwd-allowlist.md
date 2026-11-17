From: developer · AI writer项目组 | 906d802a
To: QA · AI writer项目组

# 派验单 · P55 归属护栏改为「可注册白名单」

- 对应卡面：`.batch/night/cards/p55-pinned-cwd-allowlist.v2.md`（v1 原样留档）
- 卡面类型：**A 类**（会产生仓库提交）
- 执行方：WorkBuddy（经 workbuddy联络人 通道投）
- 验证方：QA
- 工作区：`C:\develop\workspace\AI-writer\wt-2`；分支 `agent/wt-2`
- **起点：`26627655`**（项目总负责人 06:34 定「甲」；乙已否决）
- 派单方：项目总负责人（批）；投出方：workbuddy联络人

## 一、验什么

WorkBuddy 归属从「单值固定 wt-2」改为「默认 wt-2 + 可注册白名单」，且**默认行为零变化**。判 G1–G8（卡面 §4），逐条要能指认文件:行或命令输出。

## 二、硬判据（缺一条即不通过）

1. **G1 不注册仍 refuse（必须真跑，不接受只测成功分支）**：不设 `WORKBUDDY_ALLOWED_CWDS` 时
   - `checkPinnedCwd({cwd: DEFAULT_CWD, pinnedCwd: DEFAULT_CWD})` → `{ok:true, forced:false}`
   - `checkPinnedCwd({cwd:'C:\\develop\\workspace\\dsh-group-rules-prompt', pinnedCwd: DEFAULT_CWD})` → `{ok:false}`，reason 含 `归属白名单`
2. **G2 注册后可投**：`WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\dsh-group-rules-prompt` 时同一请求 → `{ok:true, forced:false}`
3. **G3 路径段判据**：`...-prompt-other`、`...-promptX` → 仍 `{ok:false}`；`...-prompt\sub\dir` → `{ok:true}`
4. **G4 边界拒绝**：注册项含 `*`／`?` → refuse；注册项 `C:\` 或 `c:/` → refuse；请求为相对路径 → refuse；大小写/斜杠变体 → `{ok:true}`
5. **G5 `--force` 未放宽**：`force:true` 且不在白名单 → 仍 `{ok:true, forced:true}`；`force:false` 不在白名单 → 必 `{ok:false}`
6. **G6 覆盖不减**：`node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs scripts/workbuddy/__tests__/model-policy.test.mjs` 全绿、`skipped 0`，用例数 ≥ 交件前基线（报告贴改前/改后计数）
7. **G7 提交纪律**：`git add` 点名文件（禁 `-A`）；`git status --porcelain` 交件后为空；不 push、不打 tag；提交说明与 diff 一致
8. **G8 `pnpm check:fast` 全绿**

## 三、禁改区复核（发现即判不通过）

`cordis.patch.yml`、任何 Bot 的 model 设置、`docs/`、`model-policy.mjs`、`package.json`、`.gitignore`、`--force` 相关逻辑、`DEFAULT_CWD` 取值。核对方式：`git diff --name-only <起点>..<提交>` 与上述清单求交集，非空即停。

## 四、证据要求

- 每条判据给「命令 + 实质输出」，不要只写「已通过」
- G1 必须贴出**不设 env** 的实跑输出（这是本卡最容易糊弄过去的一条）
- 报告首行 `执行方：QA`，末行 `<!-- DONE -->`
- 判词落 `.batch/night/reports/p55-pinned-cwd-allowlist-qa.md`

## 五、开工前三项校验（验证方也照做）

1. `git -C C:\develop\workspace\AI-writer\wt-2 rev-parse --abbrev-ref HEAD` ＝ `agent/wt-2`
2. 起点 `26627655` 是提交树的祖先（`git merge-base --is-ancestor 26627655 <提交>`）
3. `git status --porcelain` 为空（R4 口径：行尾差异不计）

## 六、回滚

软回滚：不设 `WORKBUDDY_ALLOWED_CWDS` 即行为同今天。硬回滚：`git revert <提交>`，回滚后自测 G1。
