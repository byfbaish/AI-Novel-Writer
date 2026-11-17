# 裁定 · workbuddy 文档陈旧判据与 Hy4 债（终裁版 v1）

执行方：项目总负责人
时间：2026-11-16 08:37
状态：终裁，不再改版；覆盖 08:15「四处＋一处」版与 08:31「三处」版

## 0. 先纠正一个定位错误

这批文件在 **AI-writer 仓**：`docs/agents/workbuddy-channel.md`、`scripts/workbuddy/workbuddy-attach.mjs`，基线 `C:\develop\workspace\AI-writer\develop` HEAD `69cd4a41`。
**不在** `dsh-group-rules-prompt` 插件仓，也**不钉共用 develop 工作区**——卡面 §0 钉独立 worktree。
前几轮「并入插件线首卡」的措辞作废。

## 1. 陈旧 `--cwd` 判据（判据层，全部改）

按清单逐行改，不按处数计：

| # | 文件:行 | 现状 | 改成 |
|---|---|---|---|
| 1 | `docs/agents/workbuddy-channel.md:116` | `--cwd <目录>`（默认且只允许 wt-2；指到别处 exit 1） | 默认 wt-2；可用 `WORKBUDDY_ALLOWED_CWDS` 注册额外绝对路径，未注册的目录 exit 1 |
| 2 | `docs/agents/workbuddy-channel.md:130` | 「`--cwd` 指到别处会直接 exit 1 拒绝（`checkPinnedCwd`）」 | 同上，补注册路径与 `--force` 关系 |
| 3 | `docs/agents/workbuddy-channel.md:225` | 排障表「`--cwd` 指到别处会被拒」 | 补「先注册再投，别换目录」 |
| 4 | `scripts/workbuddy/workbuddy-attach.mjs:810` | `--cwd <目录>（只允许 wt-2；改到别处会被拒）` | 与 `:798` 已写的 `WORKBUDDY_ALLOWED_CWDS=` 对齐 |

`scripts/workbuddy/workbuddy-attach.mjs:798` 是**基准**，不改；`:841` 注释已正确，不改。

## 2. Hy4 相关 8 行（分两档）

判据/表格 —— **改**：
- `docs/agents/workbuddy-channel.md:139`（「2026-11-07 订正」段落，仍教促销期走 Hy4）
- `:143`（表格行「≤2026-11-15 全天 促销期」→ Hy4）
- `:144`（表格行「23:00–08:00 夜间限免」→ Hy4）

说明/历史 —— **加注，不删**：标注「Hy4 已于 2026-11-16 全线禁用（`scripts/workbuddy/model-policy.mjs:26` `HY4_DISABLED = true`），本段仅留历史」：
- `:188`（烧积分：Hy4 夜间 0.00x）
- `:208`（模型自动切换 Hy3 → Hy4）
- `:274`（§13 标题「实测，Hy4 夜间档」）
- `:296`（分工表「WorkBuddy / Hy4」）
- `:303`（Hy4 夜间免额额度说明）

`:148`（常量名清单）不含推荐语义，不改。

## 3. 禁改区【硬】

- `docs/agents/workbuddy-channel.md:5`（通道定位）
- `:130` 前半句「归属固定、不抢」（只改后半句判据）
- `docs/agents/worktree-parallel.md` §3.1（整节不动）
- `scripts/workbuddy/model-policy.mjs`（`HY4_DISABLED = true` 不动，本卡只引用它作依据）
- 任何 `.workbuddy/memory/`、`docs/adr/` 既有条目

## 4. 不进卡、单列的配置债

`dsh-group-rules-prompt` 仓 `branch.master.remote=origin` / `merge=refs/heads/main` / `push.default` 未设：
**不改配置**，只在文档写规避法（显式 refspec、禁裸推）。列入技术债台账，不进本卡。

## 5. 本卡交付面

- 类型：A 类（产生仓库提交），须配派验单
- 执行方：WorkBuddy（经 workbuddy联络人 CLI 派卡），首验方：QA
- 只改文档与 usage 文本，**不动任何运行逻辑**；`node --check` 通过即算语法不破
- 提交一次点名 `git add` 上述 4 个文件，禁 push/tag/publish
