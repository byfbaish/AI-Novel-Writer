From: 项目总负责人 · AI writer项目组 | 64419d69
To: workbuddy联络人 · AI writer项目组 · 群分身

# p56 · workbuddy 文档陈旧判据与 Hy4 残档清理

状态：**可投**（v5 · 2026-11-16 08:59）——目录前置已解（`C:\develop\workspace\AI-writer\wt-p56` 已建、分支 `agent/p56-wb-docs`、HEAD `69cd4a41`，§0 六项校验过）；**当前唯一挡板是 WorkBuddy 侧未注册 `wt-p56` 空间**（两次投递 exit 1 `no-section`），空间未注册前不投、不判。**v5 相对 v4 只改 §6 派验单引用（`.v5`）与本状态行，§0/§4 判据一字未动**；以 v5 为执行件，v1–v4 作废。
估时：改文档 25 分钟 + 首验 15 分钟
执行方：WorkBuddy；首验方：QA（A 类卡必填）
类型：**A 类**——会产生仓库提交，必须配派验单 `.batch/night/review-requests/p56.v5.md`

## 0. 工作区前置【硬】

- 工作目录：**`C:\develop\workspace\AI-writer\wt-p56`**，分支 `agent/p56-wb-docs`，起点 HEAD **`69cd4a41`**。
- **禁在共用主工作区 `C:\develop\workspace\AI-writer\develop` 里改码或提交**；也**不许**改 `wt-docfix`（它缺 `WORKBUDDY_ALLOWED_CWDS` 那批改动，不是同一基线，行号会漂）。
- 开工第一动作（早于任何写盘）逐条核，任一不符即停手，回执照抄实质输出：
  1. `git rev-parse --show-toplevel` ＝ `C:/develop/workspace/AI-writer/wt-p56`（正斜杠形态，规范化后比较）。
  2. `git branch --show-current` ＝ `agent/p56-wb-docs`。
  3. `git rev-parse --short HEAD` ＝ `69cd4a41`。
  4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` **双空**（R4）。
  5. `git -c core.quotepath=false status --porcelain=v1` 无 `??` 项，首列无 `M`/`A`/`D`/`R`/`U`。
  6. 目标文件存在：`docs/agents/workbuddy-channel.md`、`scripts/workbuddy/workbuddy-attach.mjs`。
- 环境约束：**禁 `pnpm install` / `rebuild` / `pnpm dev`**（切 ABI 会打断别的槽位）；本卡只改文本，不需要起服务。

## 1. 起因与背景

文档与脚本对 `--cwd` 的判据已过期：脚本 `:798` 早已写明可用环境变量 `WORKBUDDY_ALLOWED_CWDS` 注册额外目录，而同文件 `:810` 和文档三处仍写「只允许 wt-2、指到别处会被拒」，新人照文档会被劝退或误以为被拦。Hy4 已于 2026-11-16 全线禁用（`scripts/workbuddy/model-policy.mjs:26` `HY4_DISABLED = true`），但文档仍有 3 处判据在教人走 Hy4、5 处说明在按 Hy4 讲成本和分工。终裁件：`.batch/night/staging/verdict-wb-docs-debt-1116.md`（3,334B / MD5 `6daf9c9a45be01c794a80a5506803051`）。

## 2. 要改成什么（唯一口径）

按清单逐行改，**不按处数计**，改完即止，不扩大不改写整段：

**A. 陈旧 `--cwd` 判据（4 行，全改）**

| 文件:行 | 改成 |
|---|---|
| `docs/agents/workbuddy-channel.md:116` | 默认 wt-2；可先 `set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>]` 注册额外目录，未注册的目录 exit 1 |
| `docs/agents/workbuddy-channel.md:130` | 只改后半句：未注册目录 `exit 1`（`checkPinnedCwd`），`--force` 可越过但须写明原因；补注册路径 |
| `docs/agents/workbuddy-channel.md:225` | 排障口径改为「先注册再投，别换目录」，删去「指到别处会被拒」的绝对说法 |
| `scripts/workbuddy/workbuddy-attach.mjs:810` | 与 `:798` 对齐：只允许 wt-2 或 `WORKBUDDY_ALLOWED_CWDS` 已注册的目录 |

**B. Hy4 判据行（3 行，直接改）**
- `docs/agents/workbuddy-channel.md:139`：删「促销期内任何时段都走 Hy4」的现行指引，写明 Hy4 已禁用、依据 `model-policy.mjs:26`。
- `:143`：促销期行标为历史，不作为当前可选模型。
- `:144`：夜间 23:00–08:00 行标为历史；现行夜间档同走 DeepSeek-V4.1-Flash。

**C. Hy4 说明/历史行（5 行，加注不删）**
`:188`、`:208`、`:274`、`:296`、`:303` —— 每行就地追加一句「（Hy4 已于 2026-11-16 全线禁用，`model-policy.mjs:26` `HY4_DISABLED = true`；本段仅留历史）」，原文保留。
`:148` 只列常量名，**不改**。

## 3. 落点与禁改区【硬】

- 改：`docs/agents/workbuddy-channel.md`（`:116`、`:130` 后半句、`:139`、`:143`、`:144`、`:188`、`:208`、`:225`、`:274`、`:296`、`:303`）
- 改：`scripts/workbuddy/workbuddy-attach.mjs:810`（仅 usage 字符串一行）
- 报告：`.batch/night/staging/p56-report.md`
- **禁改**：`docs/agents/workbuddy-channel.md:5`（通道定位）；`:130` 前半句「归属固定、不抢」；`docs/agents/worktree-parallel.md` 全文（§3.1 尤其不动）；`scripts/workbuddy/model-policy.mjs`（只引用不修改）；`docs/adr/` 既有条目；任何 `.workbuddy/memory/`。
- **禁做**：改 `dsh-group-rules-prompt` 仓的任何配置（`branch.master.merge` 那条债务本裁定为「不改配置」，只写规避法，不进本卡）。

## 4. 验收判据【硬】

每条必须能指认（文件:行 或 命令输出），缺一条即不通过：

1. **`--cwd` 判据（负例 + 正例双检，v3 补正）**——只删旧句不算通过，必须把注册路径写进去：
   - 负例：`grep -n '只允许 wt-2\|指到别处' docs/agents/workbuddy-channel.md scripts/workbuddy/workbuddy-attach.mjs` 无「指到别处会被拒」式绝对说法残留（`:5` 通道定位句与 `:130` 前半句不在本判据范围内）。
   - **正例（硬）**：`grep -c 'WORKBUDDY_ALLOWED_CWDS' docs/agents/workbuddy-channel.md` ≥ 3；且 `grep -n 'WORKBUDDY_ALLOWED_CWDS' docs/agents/workbuddy-channel.md` 的输出行号集合**包含 `116`、`130`、`225` 三行**；`grep -n 'WORKBUDDY_ALLOWED_CWDS' scripts/workbuddy/workbuddy-attach.mjs` 命中 `810`。三条输出原文抄进报告，任一不满足即判不通过。
   - 判据基线（08:44 实测，改前应为 0）：`grep -c 'WORKBUDDY_ALLOWED_CWDS' docs/agents/workbuddy-channel.md` = 0、`scripts/workbuddy/workbuddy-attach.mjs` 中该行（`:810`）亦无命中。
2. `grep -n 'Hy4' docs/agents/workbuddy-channel.md` 命中 8 行，其中 `:139`/`:143`/`:144` 已无「按促销期走 Hy4」的现行指引；`:188`/`:208`/`:274`/`:296`/`:303` 每行都含「已禁用」或「仅留历史」字样。
3. `node --check scripts/workbuddy/workbuddy-attach.mjs` exit 0；`node scripts/workbuddy/workbuddy-attach.mjs help | grep -n 'ALLOWED_CWDS'` 命中 usage 行。
4. 回归：`pnpm check:fast` 全绿（typecheck + doc-links 0 broken + doc-placement 0 违规），输出原文抄进报告。
5. 改动面：`git diff --name-only HEAD` 只有 `docs/agents/workbuddy-channel.md` 与 `scripts/workbuddy/workbuddy-attach.mjs` 两个文件；`worktree-parallel.md`、`model-policy.mjs` 不在列表。
6. 提交纪律：一次点名 `git add docs/agents/workbuddy-channel.md scripts/workbuddy/workbuddy-attach.mjs`，禁 `-A`；**禁 push / tag / publish**。
7. 报告首行钉「取数件路径 + 字节数 + MD5」三元组：`.batch/night/staging/verdict-wb-docs-debt-1116.md` / 3,334B / `6daf9c9a45be01c794a80a5506803051`，报告正文复写同一组值；哈希对不上即判证据无效。
8. 外部执行方口径（不适用档位机检）：报告正文第二行钉 `model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连`；缺这一行判不通过。

## 5. 交付物与信号【硬】

- 报告：`.batch/night/staging/p56-report.md`，末行 `<!-- DONE -->`，写明起点 HEAD `69cd4a41`、终点 HEAD、`git diff --numstat HEAD` 原文、六条判据输出原文。
- 信号文件正文三行：`p56` / 回执路径 / `<!-- DONE -->`；DONE 是整份交付最后字节，投出后不得原地改写。
- 投递留痕（CLI 直投，等价三件套）：① WorkBuddy 会话库行（session id / title / cwd / model / 起止时间 / status）；② 提交 SHA；③ `workbuddy-attach read --session <id> --json` 回执全文。缺一按「未投递」处理。

## 6. 派验单与首验【A 类必填】

- 派验单：`.batch/night/review-requests/p56.v5.md`（缺此件不进 QA 判定）
- 首验单：`.batch/night/reports/p56-qa-firstcheck.md`
- G1 机检：派验单顶部 `执行方：WorkBuddy` 与首验单顶部 `执行方：QA` 取值必须不相等

## 7. 版本纪律

- 本卡改动一律另存 `.vN.md`；已投出版须保留。记账两行并记：投出版哈希 + 现行版哈希。

## 8. 身份与投递（From/To）【硬】

本卡用形态 B（投外部执行方），第 1、2 行即身份头，`To:` 不写 session 前 8 位。机检：

```bash
sed -n '1p' <卡面> | grep -qE '^From: .+ · .+ \| [0-9a-f]{8}$' \
  && sed -n '2p' <卡面> | grep -qE '^To: +\S.* · \S.* · (主身|群分身)$'
```

投出侧抄送：卡面 → `workbuddy联络人`，由联络人用 `workbuddy-attach task --file` 投给 WorkBuddy，`--model DeepSeek-V4.1-Flash`（**禁 Hy4**）。派验单 → QA。回执原件回传我。
