From: developer · AI writer项目组 | 906d802a
To: WorkBuddy · 主身

# P55 · 归属护栏改为「可注册白名单」（默认仍只认 wt-2）

状态：**可投**（06:38 更新）——(a) 项目总负责人已批；(b) 起点**已定：甲 `26627655`**（见 §0 末条）；(c) 派验单 `review-requests/p55-pinned-cwd-allowlist.md` 已与卡面同批出。`From:` 已回填本群分身前 8 位、机检通过。
估时：改码 40–60 分钟 + 首验 20 分钟
执行方：WorkBuddy（经 workbuddy联络人 通道投）；首验方：QA（A 类卡，交件即开判）
类型：**A 类**——会产生仓库提交，必须配派验单

## 0. 工作区前置【硬】

- 工作目录：**`C:\develop\workspace\AI-writer\wt-2`**（WorkBuddy 固定槽位，`docs/agents/worktree-parallel.md` §3.1）；分支 `agent/wt-2`；起点 HEAD **`26627655`**。
- **禁在 `C:\develop\workspace\AI-writer\develop` 改码或提交**（主控区，另有他人在用）。
- 开工第一动作逐条核，任一不符即停手（回执照抄实质输出，不自行 `cd` 到别处）：
  1. `git rev-parse --show-toplevel` ＝ `C:\develop\workspace\AI-writer\wt-2`（规范化后比较，不裸比字符串）。
  2. `git branch --show-current` ＝ `agent/wt-2`。
  3. `git rev-parse --short HEAD` ＝ 起点（见下条「起点分支」）。
  4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` **双空**，且 `git diff --cached --numstat` 为空（R4）。
  5. `git -c core.quotepath=false status --porcelain=v1` 无 `M/A/D/R/U` 首列项；`??` 白名单＝**空**。
  6. 目标文件存在：`git ls-files scripts/workbuddy/workbuddy-attach.mjs scripts/workbuddy/attach.mjs` 命中两行。
- **起点（已定：甲 `26627655`）**：分支 `agent/wt-2`，起点 HEAD `26627655`。方案乙（先把 `545988b2` 合入 `agent/wt-2`）**已由项目总负责人 06:34 否决**：`agent/wt-2` 是 WorkBuddy 的槽位，本卡不跨进去动基线；本卡只动归属判断区。
  - **与 `545988b2`（Hy4 禁用，在 `exp/resource-ledger`）的关系**：两者改到的行不相邻——本卡动 `attach.mjs` 的 `checkPinnedCwd`（`:483`）与 `workbuddy-attach.mjs:65`/`:829` 归属传参；`545988b2` 动的是 `model-policy.mjs`、`workbuddy-attach.mjs:798/:801`（`--model` 白名单与帮助文案）。日后合并由合并方处理，**不是本卡开工理由**。
  - 开工时 `git rev-parse --short HEAD` 必须是 `26627655`；若槽位已前移（例如基线被别人合了别的提交），**停手报派单方**，不要自行 reset、rebase 或改基线。
- 禁 `pnpm install` / `rebuild` / `pnpm dev`（切 ABI 打断别的槽位）；本卡只跑 node 脚本测试，不需要装依赖。

## 1. 起因与背景

WorkBuddy 通道的固定归属写死在代码里，无法登记第二个目录，导致本组一张卡（`wb-rules-example.v1.md`，目标仓 `C:\develop\workspace\dsh-group-rules-prompt`）投不出去，只能停在 `[refuse]`：

```
[refuse] 目标目录不在本通道的固定归属里：
  请求=C:\develop\workspace\dsh-group-rules-prompt
  归属=C:\develop\workspace\AI-writer\wt-2
```

取证（file:line）：
- `scripts/workbuddy/workbuddy-attach.mjs:65` `const DEFAULT_CWD = path.resolve(REPO_ROOT, '..', 'wt-2')` —— 唯一归属，写死。
- `scripts/workbuddy/workbuddy-attach.mjs:829` `const pin = checkPinnedCwd({ cwd: args.cwd, pinnedCwd: DEFAULT_CWD, force: args.force })` —— 把单值当白名单传。
- `scripts/workbuddy/attach.mjs:483` `export function checkPinnedCwd({ cwd, pinnedCwd, force = false } = {})`：只做 `samePath(cwd, pinnedCwd)` 全等（`:376` `samePath` 规范化反斜杠、去尾斜杠、转小写），`force` 是唯一例外。
- 全仓相关 env 只有 `WORKBUDDY_DB`（`workbuddy-attach.mjs:246`）与 `WORKBUDDY_MODEL_POLICY`（`:825`），**无任何归属登记方式**。
- 因此 `wt-2` 的子目录也投不进去（全等判据），worktree 变通路同样不可行。

## 2. 要改成什么（唯一口径）

归属从「单值固定」改为「单值默认 + 可注册白名单」，**默认行为与今天完全一致**：

1. `DEFAULT_CWD` **保留不动**，仍是默认归属、仍是 `checkPinnedCwd` 的主入口值。
2. 新增注册方式：**环境变量 `WORKBUDDY_ALLOWED_CWDS`**，值为绝对路径清单，用 `path.delimiter`（Windows＝`;`）分隔；空或不设＝不注册任何额外目录。
   - **选环境变量、不选配置文件的理由**：①与通道既有配置同构（`WORKBUDDY_DB`、`WORKBUDDY_MODEL_POLICY` 都是 env），不引入新文件格式与解析器；②仓内配置文件会随提交扩散到所有人的检出，等于把「谁能投到哪」变成可提交内容，风险高于一次性 env；③env 是每次调用显式给，不落盘、不会静默长期生效。
3. `checkPinnedCwd({ cwd, pinnedCwd, allowedCwds = [], force = false })`：先 `samePath(cwd, pinnedCwd)` 命中即通过（与今天逐字等价）；未命中再按 `allowedCwds` 逐条判**路径段包含**。
4. 判定规则（缺一条即不通过）：
   - 候选必须是**绝对路径**：`path.isAbsolute()` 为真，否则 refuse；`path.resolve()` 规范化后再比。
   - **按路径段**判包含：规范化后 `candidate === base` 或 `candidate.startsWith(base + '/')`；**禁止**裸 `startsWith(base)`（`wt-2foo` 会混过）。`samePath` 的 norm（`\`→`/`、去尾 `/`、转小写）复用，不另写一份。
   - 注册项含通配符（`*`、`?`）→ 直接 refuse 并报错，不支持通配。
   - 注册项是盘根（norm 后长度 ≤ 3，如 `c:/`）→ 直接 refuse，不允许匹配整盘。
   - `--force` 逻辑**一个字不动、也不放宽**：仍是全等失败后的唯一人工出口，仍要求报告写明原因。
5. 报错文案改为列出**当前生效的完整归属清单**（默认值 + 已注册项，一行一项），其余措辞保留：

```
[refuse] 目标目录不在本通道的归属白名单里：
  请求=<cwd>
  允许=<每行一个：默认 wt-2 + 已注册项>
（要新增归属用环境变量 WORKBUDDY_ALLOWED_CWDS 注册；确需排障时加 --force，并在报告里写明）
```

## 3. 落点与禁改区【硬】

- 改：`scripts/workbuddy/attach.mjs`（`checkPinnedCwd` `:483` 及紧邻注释；可新增一个纯函数 `isUnderCwd` 放在 `samePath` `:376` 之后）。
- 改：`scripts/workbuddy/workbuddy-attach.mjs`（`:65` 附近新增 `ALLOWED_CWDS` 解析、`:829` 传参、`usage()` 帮助里加一行 env 说明）。
- 补：`scripts/workbuddy/__tests__/attach.test.mjs`（新用例；**不许删既有用例**）。
- **禁改**：`cordis.patch.yml`、任何 Bot 的 model 设置、`docs/`（含 `docs/agents/worktree-parallel.md` §3.1 那张表——表是「固定归属」的权威描述，本卡不改它）、`model-policy.mjs`、`package.json`、`.gitignore`、`--force` 相关逻辑、`DEFAULT_CWD` 的取值。
- 禁写死第二台机器的绝对路径进代码或测试（测试里用 `path.join(os.tmpdir(), ...)` 拼临时路径，或对 `DEFAULT_CWD` 相对推导）。

## 4. 验收判据【硬】（每条要能指认文件:行或命令输出）

- **G1 默认行为零变化**：不设 `WORKBUDDY_ALLOWED_CWDS` 时，`checkPinnedCwd({cwd: DEFAULT_CWD, pinnedCwd: DEFAULT_CWD})` → `{ok:true, forced:false}`；`checkPinnedCwd({cwd:'C:\\develop\\workspace\\dsh-group-rules-prompt', pinnedCwd: DEFAULT_CWD})` → `{ok:false}` 且 reason 含 `归属白名单`。**这条是「不注册时投非 wt-2 仍 [refuse]」的自测，必须有。**
- **G2 注册后可投**：`WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\dsh-group-rules-prompt` 时，同一请求 → `{ok:true, forced:false}`。
- **G3 路径段判据**：注册 `C:\develop\workspace\dsh-group-rules-prompt` 时，`C:\develop\workspace\dsh-group-rules-prompt-other` 与 `...\dsh-group-rules-promptX` → 仍 `{ok:false}`；`...\dsh-group-rules-prompt\sub\dir` → `{ok:true}`（子目录属该归属）。
- **G4 边界拒绝**：注册项含 `*`／`?` → refuse；注册项为 `C:\` 或 `c:/` → refuse；请求为相对路径 → refuse；大小写与斜杠变体（`c:/develop/workspace/DSH-group-rules-prompt`）→ `{ok:true}`（与 `samePath` 口径一致）。
- **G5 `--force` 未放宽**：`force:true` 且请求不在白名单 → 仍 `{ok:true, forced:true}`（与今天一致）；`force:false` 不在白名单 → 必 `{ok:false}`。
- **G6 用例覆盖不减**：`node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs scripts/workbuddy/__tests__/model-policy.test.mjs` → 全绿、`skipped 0`，用例数 **≥ 交件前基线**（交件报告里贴改前/改后两条计数）。
- **G7 提交纪律**：提交说明与实际 diff 一致；`git add` **点名三个文件**（禁 `-A`）；`git status --porcelain` 交件后为空；不 push、不打 tag。
- **G8 `pnpm check:fast` 全绿**（typecheck + 文档检查）。

## 5. 交接后的使用方式（写进报告，不写进代码注释）

投 `dsh-group-rules-prompt` 时由投出方在命令前设 env：

```
set WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\dsh-group-rules-prompt
node scripts/workbuddy/workbuddy-attach.mjs task --cwd C:\develop\workspace\dsh-group-rules-prompt --model DeepSeek-V4.1-Flash ...
```

用完即失效，不改任何持久配置。

## 6. 回滚路径【硬】

- **软回滚（1 步，不改代码）**：不设 `WORKBUDDY_ALLOWED_CWDS` ＝ 行为与今天逐字相同（只有 wt-2）。这正是默认值。
- **硬回滚**：`git revert <本卡提交>`；或把 `:829` 的 `allowedCwds` 入参删掉、`checkPinnedCwd` 签名退回 `{cwd, pinnedCwd, force}`。
- 回滚后自测：G1 必过。

## 7. 身份头与投出【硬】

- 卡面第 1–2 行为形态 B（投外部执行方，`To:` 不写 session 前 8 位）。本 v2 的 `From:` 已回填本群分身前 8 位 `906d802a`，`^From:` 与 `^To:` 双机检通过；**v1 原样留档，不覆盖**。
- 回执首行写 `执行方：WorkBuddy`；第二行写 `model=DeepSeek-V4.1-Flash | 倍率=<实际> | provider=<实际>`（外部执行方口径，见模板 §4.9）。
