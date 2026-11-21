From: 项目总负责人 · AI writer项目组 | 5dfa8c4d
To: workbuddy联络人 · AI writer项目组 · 群分身（转 WorkBuddy，通道 CDP 9333）

# 外派件 · D12 实机复验取证（WorkBuddy）

> **已撤回（主人 19:07 裁定）**：撤回理由——外派只接静态活（读码给复现步骤、写取证脚本、静态核对判据字段是否可判），不碰运行环境、不装依赖、不切 ABI；实机复验（起应用＋playwright 走流程）须在 develop 由 developer 执行（AGENTS 第 8 条）。本件仅留作 S2 外派模板参考，不得再投；已发生的 C 类停手按撤回处理，不再补跑。

- 卡号：`d12-replay-retry`（开工包 `.batch/night/cards/d12-replay-retry.md`，判据 §4.3）
- 外派位：**本卡只外派「实机复验取证」这一段**；改码、单测、交件仍归 developer，判定仍归 QA 与项目总负责人。
- 外派理由：取证是确定性执行（跑脚本、收 JSON、算哈希），不涉及判据制定；可烧外部免费额度，省本队 token。
- 工作目录：`C:\develop\workspace\AI-writer\wt-2`（WorkBuddy 归属固定槽位，不得改目录）
- 派活命令（由联络人执行）：`node scripts/workbuddy/workbuddy-attach.mjs task --file <本件绝对路径> --new`
- 模型：`DeepSeek V4.1 Flash`，派活行写明推理强度档（照 `ruling-dispatch-v6-1120.md` §1）；高峰期（周一至五 09:00–12:00、14:00–18:00）禁派，改约时段
- 认证与端口：CDP 9333；连不上就报 `NEED_HUMAN_DEBUG` 交人，**不许自己 spawn `WorkBuddy.exe`**
- 产物回流方式：**证据件**（命令原文 + 输出摘录 + `evidence.json` 路径/字节/sha256），落 `wt-2/.batch/night/staging/`，由联络人转投 `C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner`，**不进仓库、不许直推**
- 派单时点（负责人 11-21 改订）：**两个条件同时满足才派**——① developer 本地已跑绿（末行 JSON 无 `GENERATION_COMPOSITION_NO_PROGRESS`）；② `card/d12-replay-retry` 已含提交且提交里有 `scripts/d12-replay-acceptance.mjs`。缺一不派，由联络人等通知

## 1. 需求说明（做什么）

1. 取 developer 在分支 `card/d12-replay-retry` 上的**提交面**（不看工作区未提交改动）。
2. 在该提交面上跑一次实机复验脚本，把它吐出的机器可读结果原样交回。
3. 只交证据，不给「通过/不通过」结论。

## 2. 环境前置门禁（任一不过 → 停手，按 §6 报，不自行修环境）

1. 提交面存在：`git -C . rev-parse --short card/d12-replay-retry` 必须 **≠ `89ec7014`**（起点无提交＝还没东西可验）。相等即停手，报「分支尚无提交，取证不可开始」。
2. 脚本存在：`git cat-file -e card/d12-replay-retry:scripts/d12-replay-acceptance.mjs` 成功（exit 0）。
3. 依赖在位（**wt-2 可以装，且只装 wt-2**）：`node_modules/playwright` 与 `node_modules/esbuild` 可解析。缺依赖时按主身 11-21 口径先装：
   ```bash
   cd C:/develop/workspace/AI-writer/wt-2 && pnpm install 2>&1 | tail -15
   node -e "console.log(require.resolve('playwright'), require.resolve('esbuild'))"
   ```
   装完把 `pnpm --version` 与上面 `require.resolve` 两行原文贴进报告。**禁**在 develop / wt-1 / wt-3 装或重建；`pnpm` 失败即报 `NEED_HUMAN_DEBUG`，不许自己 spawn、不许换目录重试。
4. 构建产物：脚本以 `_electron.launch({ cwd: <repo>, args: ['.'] })` 启动；若 wt-2 缺产物而启动报错，按 §6 C 类停手记录原文，**不要**为了让它起来去改仓库或切 ABI。

## 3. 步骤（逐条留输出原文）

```bash
cd C:/develop/workspace/AI-writer/wt-2
git fetch --all --prune 2>&1 | tail -3          # 只读远端，不写历史
git rev-parse --short card/d12-replay-retry
git cat-file -e card/d12-replay-retry:scripts/d12-replay-acceptance.mjs && echo SCRIPT_OK
git status --porcelain | head -20                # 记录，不清理
```

若未提交改动会污染运行结果，则**不要** `reset --hard`／`clean`，直接停手报告 §6 的 B 类。

```bash
git worktree add --detach ../wt-2-d12 card/d12-replay-retry   # 若已存在则跳过
cd ../wt-2-d12
node scripts/d12-replay-acceptance.mjs 2>&1 | tee ../wt-2/.batch/night/staging/d12-live-verify-<sha>.log
```

不允许在工作区里新建 worktree 时，改为在 wt-2 内 `git checkout --detach card/d12-replay-retry`，跑完 `git checkout --detach <wt-2 原 HEAD>` 复原，并在报告里写明原 HEAD。

## 4. 验收标准（交回什么算合格）

0. **成功判据（先看这条）**：末行 JSON 里 §4 第 4 项 13 个字段**齐全**，且**不含** `GENERATION_COMPOSITION_NO_PROGRESS` 或任何装配报错；终止原因是「跑完」而不是「中途抛错」。只跑出错也算取证，但要按 §6 C 类如实报错，**不许把失败当跑通**。
1. **命令原文**：贴实际执行的命令（含 `cd` 与参数），不得只写「运行了脚本」。
2. **输出摘录**：脚本末行 JSON 全文 + 退出码。
3. **证据文件**：`evidence.json` 绝对路径、字节数、`sha256`。
4. **必报字段**（缺一即不合格，值照抄，不要解读）：`endingBlockUnits`、`notesBlockUnits`、`notesSixColumnsPresent`、`notesTableRowsUnchanged`、`notesHooksCountUnchanged`、`outlineMidMaxOverlapUnits`、`proseContainsFullPrevious`、`proseDispatches`、`retryHasCorrection`、`retryLeaksDraftFragment`、`composeCalls`、`drafts`、`candidates`。
5. **所验提交**：`git rev-parse --short HEAD` 与分支名，写进报告首行。
6. **未做的事**：单列一段，写清哪条没做、为什么。

判定不归你：字段是否达标由 QA 按 `.batch/night/review-requests/d12-replay-retry.md` 判，**不要**在报告里写「PASS／不通过」。

## 5. 回执

- 路径：外派方写 `C:\develop\workspace\AI-writer\wt-2\.batch\night\staging\<卡号>-<提交>.md`，由联络人转投 `C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner`（投递后须有 resolved/delivered 留痕，不许「发了就算」）
- 回执首行写：`D12 实机取证 · 提交 <sha> · 结果 <可跑完/停手>`；停手时写停手类号（A/B/C，见 §6）与一句原因。
- 产物同时落 `wt-2/.batch/night/staging/d12-live-verify-<sha>.md`，报告里给绝对路径。

## 6. 不许做的事（越界即打回，不计产出）

1. 不许 `git push` / `tag` / `publish` / 合并 / 改远端（push 只由主身做）。
2. 不许改 `src/`、`scripts/`、测试或任何仓库文件；**唯一允许写入**是 `.batch/night/staging/` 下的日志与报告。
3. 不许跑全量测试、`test:browser`、`test:node`、`pnpm dev`；`pnpm install` **只准在 wt-2 内**（见 §2.3），不许在 develop / wt-1 / wt-3 装或重建（切 ABI 会打断其他槽位）。
4. 不许 `git reset --hard`、`git clean`、`git checkout -- .`，不许动 `develop` / `wt-1` / `wt-3` 与仓外 `.backups`。
5. 不许自己 spawn `WorkBuddy.exe`，不许碰宿主系统设置。
6. 不许改判据、不许自行放行，也不许替 developer 补交件报告。

## 7. 失败处置（三类，按类停手报告，不尝试绕过）

- **A 类·无提交面或脚本未跑绿**：分支尖端仍 `89ec7014`、脚本未进提交，或 developer 报脚本仍停在 `GENERATION_COMPOSITION_NO_PROGRESS` → 报告写清断点，退出（**派单前就该拦住，A 类出现即说明时点没对上，记一笔**）。
- **B 类·工作区不可用**：wt-2 有未提交改动会污染运行，或无构建产物 → 报告写清 `git status --porcelain` 原文，退出，不改环境。
- **C 类·运行环境不符**：ABI 不符、Electron 起不来、CDP/端口不可达 → 报告写错误原文首 20 行，标 `NEED_HUMAN_DEBUG` 交人，退出。

三类都不许自行修环境；停手本身就是合格交付（把现场留住比硬跑更有价值）。
