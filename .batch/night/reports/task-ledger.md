状态：现行
From: 产品经理 · AI writer项目组 | 4e6e07bd
To: AI writer项目组 · 群内共读（判件基准件）

# 结项台账（唯一本 · 一行一单）

- 定稿：2026-11-15 03:45，由大肥鱼（大管家）指定为 S6 结项行的**唯一落点**
- 机检式：`Select-String .batch\night\reports\task-ledger.md -Pattern '^\|\s*<卡号>\s*\|'` —— 有行即已结项，无行即未结项
- 规矩：
  1. 一行一单，卡号写在首列，卡号是唯一键，禁止同卡两行；重开卡要立新卡号（如 P45 → P45-fix）
  2. 「结论」只许四种取值：`PASS` / `不通过` / `作废` / `转出`（转出＝并入别的卡，须在「依据」里写谁接手）
  3. 「依据」必须是能打开的件：终审单、首验单或提交 SHA，不许写「已确认」这类没法验的话
  4. 历史卡（P38 及以前）不回填全量；只回填 11-14 晚插件线收口以来的卡，其余查 `time-ledger-*.md` 日期本
  5. 时间未逐条复核的格写 `~`，表示「有记录但未重核」，不许凭印象填精确时刻
  6. 流转件出现版本更新时，「依据」栏并记**投出版哈希**＋**现行版哈希**；差异只在溯源段（`施工段零差异`）时注明该四字，并写「不重投」

| 卡号 | 类型 | 执行方 | 派活 | 结项 | 结论 | 依据 |
|---|---|---|---|---|---|---|
| P31 | A 改码 | 豆包 | 11-15 11:55 | 11-15 12:39 | PASS（终审 4 条遗留） | 终审单 `reports\p31-v2-verdict.md`（2,882B / `E19063B7B843165EE7677E977E546D01` / 12:39:57）；首验 `reports\p31-v2-qa-firstcheck.md`（7,823B / `128722E91FB0F531930D7B364B017B5D` / 12:38:24，C1–C7 7/7、QA 自跑 `node index.test.mjs` 160/160、两条反证真红 TC1 期望1实际2 / TC2 拷回又投）；提交 `fdf7b1735bddf42937cd82a7ae824a9e38219f17`（`15e9d83..fdf7b17` 只 2 文件 `45/13 index.js`、`123/0 index.test.mjs`，porcelain 空、**已推送 origin `15e9d83..fdf7b17`（主人 13:08 点头，我方执行；推后回读 origin/master = fdf7b17）**、无 tag）；卡面 `cards\p31-dedupe-persist.v2.md` 8,240B / `6A6A1FECA14A2F95CD7FE11FCDE77F90`、派验单 `review-requests\p31-v2.md` 3,125B / `359CFDA0F3E22CEC1D941DDB5F0F346C`；遗留指针 ①`fdf7b17` 已推送（见凭证栏回读）②重启重扫 5 条 replay 另轮开卡 ③「`delivered\` 禁拷回 watch 源」未落机检、下次模板补硬字段 ④`index.js` 行号漂移下次刷新卡面一并改 |
| P39 | A 改码 | 豆包 | ~11-14 19:19 | ~11-14 21:34 | PASS | `reports\p39-verdict.md` + 主人真机绿/红 |
| P40 | B 配置 | developer | ~11-14 19:19 | ~11-14 20:30 | PASS | `relay.log` 启动 7/7 |
| P44 | A 改码 | 豆包 | 11-14 20:55 | 11-14 21:2x | PASS | `reports\p44-verdict.md`、提交 `8df4e76` |
| P45 | A 文档 | 豆包 | 11-14 21:36 | 11-14 22:34 | 不通过 | `reports\p45-qa-firstcheck.md`（入口措辞不符） |
| P45-fix | A 文档 | 豆包 | 11-14 22:37 | 11-14 22:44 | PASS | `reports\p45-fix-verdict.md`、提交 `15e9d83` |
| P46 | B 规格 | 产品经理 | 11-15 00:31 | 11-15 00:38 | PASS | `reports\p46-verdict.md` |
| P47 | B 生成 | 豆包 | 11-15 00:52 | 11-15 02:0x | 不通过 | `reports\p47-verdict.md`（八条 3/8、§3.2a 0/3） |
| P48 | A 改码 | WorkBuddy | 11-15 00:55 | 11-15 02:2x | PASS | `reports\p48-verdict.md`、提交 `26627655` |
| P49 | B 文档 | 产品经理 | ~11-15 02:1x | 11-15 02:46 | PASS | `staging\opening-3ch-writing-constraints.md` + 终审记录 |
| P50 | B 生成 | 豆包 | 11-15 02:51 | 11-15 07:2x（改判） | PASS | 终审单 `reports\p50-verdict.md`（3,682B / `A11BF093BCE5716B6D86D80337778646` / mtime 07:19:14，裁决「通过，三章样稿冻结为能投放基线版」）；QA 复验 `reports\p50-fix4-qa-recheck.md`（4,449B / `BD7292DB92C25F03824B3659C7315B22`，字数 3/3、八条③ 新 `:141` 重验通过）；金牌编辑 `reports\p50-editor-4checks-05.md` 现行 2,395B / `C947F105E9180EAE36E86AC07AD813C0`（终审单引用的是 2,002B / `5013C24C33E386C0D3F45C06F654D6A0` 旧版，差异为 cid 订正 cid16、结论未变）；取数件 `staging\p50f4-ch01.md` 7,630B `BE44055D124C105883334B1EC02E26FD` / `-ch02.md` 7,921B `1EF9F956E464C5E223D70D821B49CAB4` / `-ch03.md` 7,774B `4515CB2E49822DC7C2B604C5EAB7C449`；05:29 旧判「不通过（A1）」经 fix3/fix4 后由 07:19 终审改判 PASS，A1→A2→A2′ 全部闭合 |
| P51 | A 改码 | 豆包 | 11-15 07:52 | 11-15 11:49 | PASS（终审 4 条遗留） | 判定单 `reports\p51-verdict.md`（3,055B / `09B3B73F95AF7643EA16FCA5FC5F68F5`）；遗留指针 ①`747fdbb4` 越界不计交付 ②执行方过度自限致空转约 1h ③报告名比卡面多 `-v2`（派卡方认责，下张卡起逐字一致）④`ReviewReport` 中位数展示无真机读数； `reports\p51-qa-firstcheck.md`（7,457B / `9D03F52343F2CD284DE34231CE2F9AE1`，判据 1–8 全过；⑤只记「用例可跑通」；`747fdbb4` 越界追认、不计本卡交付、合并须单列）＋提交 `e3dafb513137d4e6a6da1e76b5bbb20e51a917ec`（3 文件）；裁定件 `staging\p51-env-blockers-ruling.md` 5,322B / `A951CBEED5A40266C2497116F0FF2AB6` |
| P52 | B 调研 | 产品经理 | 11-15 03:1x | 11-15 03:38 | PASS | `staging\github-projects-eval.md`（9,701B / `87531879…`） |
| P53 | B 规格 | 产品经理 | 11-15 03:3x | 11-15 03:3x | PASS | `reports\p53-verdict.md`（2,908B / `916352FD…`） |
| P54 | A 改码 | 豆包 | 11-15 13:21 | 11-15 14:15 | PASS（终审 4 条遗留） | 终审单 `reports\p54-verdict.md`（4,005B / `C2A0267E972345AF0E9E95F3509BC0F4` / 14:15:49）；交付报告 v2 `reports\p54-fromto-inject-report.v2.md`（11,244B / 152 行 / `990E851512C3771743441CAB3B9681B9` / crlf=0 / 首行 `执行方：豆包`、次行 `model=DeepSeek-V4.1-Flash | 倍率=0.01x | provider=自有(豆包)`、`<!-- DONE -->` 全文 1 处且在末行；v1 `p54-fromto-inject-report.md` 11,268B / `E8F3C733310A19D7336B14A74CAD9C31` 原样保留）；首验 `reports\p54-fromto-inject-qa-firstcheck.md`（7,189B / `D30C2D8CC31EAF7AA28467F7C1C53F8A`，C1–C9 全过、C8 QA 复跑 `node index.test.mjs` 166/166、C9 两条反证真红各 162/166、C10 两条不符）＋复验 `reports\p54-fromto-inject-qa-firstcheck.v2.md`（3,074B / `C0B9F29BDC4B53344998876EB9B061A3`，C10 PASS）；提交 `fdf7b17..40f34b5` 两笔 3 文件（`82dfbbe` 13:49:24 `index.js 54/3`、`index.test.mjs 93/2`；`40f34b5` 13:52:14 `README.md 18/1`），porcelain 空、`--cached` 空、**未推送**、无 tag；卡面 `cards\p54-fromto-inject.md` 7,957B / `AC84E074149E9A124CF6209752210261`（投出版 `cards\p54-fromto-inject.v1.md` 7,914B / `66C7197B6876F3B4DBDA29913DF99214`）、派验单 `review-requests\p54-fromto-inject.md` 3,616B / `CAE514F47038257F9BA9090DDB858FC7`；时间账：投出 13:21:37 → 首笔 13:49:24 → 补笔 13:52:14 → 首验 14:02:51（整单 41m14s）；遗留指针 ①真机未验（profile 仍旧 relay 副本，只记代码+单测+反证，发版前必须真机验一次）②`delivered\` 拷回 watch 源（第 2 笔违约，被 contentHash 拦下）＋执行报告投出后追加改写（10,071B→11,268B，已用 v2 保留 v1）③派验单行号 `:1308` 实际 `:1359`，下次刷卡面修正 ④QA 首验单两次原地改写（已认账，下卡起用 `.vN`，notice 已加【流转件版本纪律】段） |
| P54-fix2 | A 改码 | 豆包 | 11-15 14:19 | 11-15 16:14 | PASS（终审 2 条遗留） | 终审单 `reports\p54-fix2-verdict.md`（3,327B / `5B2BE9F2A99993EE2D4FACF03EF9AC13` / crlf=0）；首验 `reports\p54-fix2-dir-ownership-qa-firstcheck.v2.md`（4,551B / `1692D22B3B8688D3E18500BF5ADED919` / 16:05:30，`node index.test.mjs` 174/174 PASS、C9 两条反证真红 173/174）；提交 `f41b0312d89a50493943706b488b8773aaaa0eec`（15:09:17，`40f34b5..f41b031` 三文件 `README.md 34/3`、`index.js 95/17`、`index.test.mjs 195/0`，porcelain 空、`--cached` 空、**未推送**、无 tag）；报告盘面实测 **12,742B / `58534E48DEE1F67FC9A174D7D4C24AB3`**（派卡方报 11,312B/`BC734AB3…` 系口径错，记流程瑕疵一笔）；遗留指针 ①D2 报告写于提交前，须另存 `-report.v2.md`（进发布前检查表）②D-TO8 另开 fix3 ③`To:` 标题段为空并入 fix3 ④reboot 重扫 replay 另轮 ⑤副本未设 `DSH_PROFILE_DIR` 致主 profile 收 4 个探针件，记违约一笔 |
| p54-fix3-to8 | A 改码 | 豆包 | 11-15 16:20 | 11-15 16:41 | PASS（终审 5 条流程瑕疵） | 终审单 `reports\p54-fix3-verdict.md`（4,973B / `041b3b3821d73ef17ec93a868bc3d2b3` / 60 行 / crlf=0）；首验 `reports\p54-fix3-qa-firstcheck.v1.md`（7,497B / `99682a63951d3ee0347c442d31a8b767` / 138 行 / 16:38，F1–F6 全过、`node index.test.mjs` 178/178、反证 A 175/178 红 / B 173/178 红）；提交 `51a87c5417c61372210c14c1c362b8830e1621e7`（`f41b031..51a87c5` 只 2 文件 `25/2 index.js`、`84/0 index.test.mjs`，R4 三空、未推 `0 4`、无 tag）；卡面 `cards\p54-fix3-to8.v2.md` 3,762B / `83F53EC0427AD642D8D6E70F25438C9F`、派验单 `review-requests\p54-fix3-to8.v2.md` 4,624B / `FAB885D7E76FBE7E92AD0907C385145F`；遗留指针 ①O4 线上 `To:` 口径待宿主重启真机复验（失效点三者取最晚）②O1 已闭：`p54-fix2-dir-ownership-report.v2.md` 13,059B / `7CBF8A192EF0F3D5CEECD514BF211467` / 164 行 / 16:46:03，v1 保持 `58534E48DEE1F67FC9A174D7D4C24AB3` 未动（我 16:48 实测） ③O3 `headerTitleOf` 第三层兜底无用例 ④未推 4 笔与发布方式待主人授权 |

## 非卡条目（不参与机检，卡号唯一键仍适用）

- 2026-11-15 23:24｜**relay to-group watch 长期指空，非新问题**——`watches[6]`（to-group→`74a01c9a`）历史上指过三个 session（`453478dd` / `f6f51eef` / `6dc4ab20`），每个都既有 resolved 又有 agent-not-found；结论＝指空是长期现象，不是本次新故障，别再重查。来源：QA 23:16 实查 relay.log 1,205 行（11-13 14:36 → 11-15 23:14，`reason=` 仅 `agent-not-found` 88 条、无成功记录）；处置＝挂待办，notice 落地后再定建台账或并入下次重启的合并改绑，冻结期不改配置。

## 与时间账的分工（避免双写）

- `time-ledger-*.md`＝**过程账**：派活/估时/缓冲/兜底点、卡壳、口径变更、教训。按日期分本，可长可细，不参与机检。
- `task-ledger.md`（本文件）＝**结项账**：只记「这单结了没有、怎么结的」。一行一单，参与机检。
- 同一事实只在一本里写正文，另一本只写指针。**双写就是第二个事实源，不许。**

<!-- DONE -->

- 2026-11-16 00:10｜**上面 23:24 那条措辞更正（旧条保留不改，以本条为准）**——不能写成「长期指空」。实况：`watches[6]`（to-group）历史上指过三个 session（`453478dd` / `f6f51eef` / `6dc4ab20`），**每一个都既有 resolved 记录、也有 agent-not-found**，也就是「时而指得上、时而指空」；成因是历次重绑留下的状态，不是今天才坏。据此：查证时先看该 session 在不同时段的 resolved/delivered 与 agent-not-found 并存，再判是不是故障。更正依据：QA 00:08 复核（指出「长期指空」四字会误导后人以为从未指上），负责人 00:09 批准按此口径写。22:xx 版正文其余事实（relay.log 1,205 行、88 条 agent-not-found、冻结期不改配置）不变。

- 2026-11-16 01:25｜**三笔交付入账（developer 补，另存 .v2，原文件未改）**——状态一律记「已验未推送」：
  - 文档 v4：分支 `docs/bot-session-identity`，尖 `3f522cdf315ac4920b547912e8f62fe16a56a20d`（父 `c3291108`，1 file / +2 −2，blob `CDE2D475561326808F0AC915855FA2D3`）；`ec46779b` 为 amend 前不可达对象（`--is-ancestor` NOT-ANCESTOR），其说明里的「55 行」是旧数，现盘 54 行，不再 amend。
  - 插件仓 README：`C:\develop\workspace\dsh-group-rules-prompt`，`master`，尖 `951c39f2a45bcc0ac5c6f065ce280f20346be73d`（父 `9a51a5b`，2 files / +2 −2），未推送。
  - notice 回读工具 `.v2`：`.batch/night/tools/notice-readback.v2.cjs`（11,114B / `e3ec188fd1d4c7955784db5315dbb315` / 183 行），在 `.batch` 内故无 SHA。
- 2026-11-16 01:25｜**插件仓无 origin 远端，公开前置条件＝建远端**——`git ls-remote origin` 在 `dsh-group-rules-prompt` 直接 fatal（repo 只有本地 `.git`，无 remote 配置）。因此此前记的「未推送」不是克制而是能力缺口；要公开须先建远端（GitHub 仓 + 凭据）并经主人点头，二者都未做。

- 2026-11-16 05:01｜**插件下一阶段卡「rules.example.md + README 迁移节」＝已发未开工、暂停待重启**（另存 .v3，v2 原样保留）——执行方 developer，起点 `951c39f2a45bcc0ac5c6f065ce280f20346be73d`；developer 05:01 自报：`git status --porcelain` 为空、`rules.example.md` 与 README 迁移节均未落盘。暂停因主人要重启 DSH；重启后由 AI writer总负责人 按同一卡面重发（起点不变）。状态不得记为「进行中」。

- 2026-11-16 05:52｜**今晚口径（主人）**：①代码仓库部分今晚落地——`rules.example.md` + README 迁移节改由 WorkBuddy 执行（起点 `951c39f`，developer 已撤卡并还原干净，草稿留仓外 `staging/dev-draft-rules-example-1116/` 仅作参考）；②真机插件验收押到明日主人上线后；③插件除真机验收外收尾完，即转 AI-writer 项目主线。另：Hy4 已被主人全面禁用，派 WorkBuddy 须显式 `--model DeepSeek-V4.1-Flash`（`model-policy.mjs` 夜间窗仍会选 Hy4）。

- 2026-11-16 06:00｜**Hy4 双轨处置（负责人定，我记账）**：①**兜底**＝今晚所有 WorkBuddy 派单显式 `--model DeepSeek-V4.1-Flash`，每单回报「model 字符串 + 窗口」；②**根治**＝developer 改 `scripts/workbuddy/model-policy.mjs`，加 `HY4_DISABLED = true`（留开关不删逻辑），`pickModel()` 不再返回 Hy4，起点 `e3dafb51`，禁改区＝`cordis.patch.yml`、任何 Bot 的 model 设置、已入库 `docs/`；验收：实跑两次均出 V4.1、测试全绿无 skip、`git grep -n Hy4` 只剩开关与注释。**两轨并行，①上线后不得省掉②兜底。**
- 2026-11-16 06:00｜模型口径（主人原话，不可漂）：WorkBuddy 侧用 DeepSeek V4.1；**本组 Bot 模型禁止任何人改动**，改模型只能主人本人动手。我至今未改过任何 Bot 的 model（全组仍 `magpie/group/bot`，developer 与金牌编辑 `magpie-vision/group/bot`）。
- 2026-11-16 06:00｜待主人定（负责人已问、未答）：①`dsh-group-rules-prompt` 推 GitHub 时**公开还是私有**；②推送凭据能否用 WorkBuddy 的 GitHub 浏览器登录态（本机无 `gh`、无 `GH_TOKEN`）。
- 2026-11-16 06:01｜**Hy4 根治卡扩项（同卡补正，非新卡，执行方 developer 一次改完）**：①`model-policy.mjs:22` `ALLOWED_MODELS` 去掉 `'Hy4'`，只留 `'DeepSeek-V4.1-Flash'`；②`:25`/`:110-111` `isHy4FreeAt()` 恒 false（保留 `HY4_DISABLED` 开关，恢复改一行）；③`:139-140` 报错提示语删掉「改用 Hy4 / `--model Hy4`」；④`workbuddy-attach.mjs:800/802` 帮助文本删掉「23:00–08:00 用 Hy4」。验收追加：`git grep -n Hy4` 只允许出现在 `HY4_DISABLED` 开关及其注释里；交件须附**回滚路径**（改哪几行、怎么退回）。
- 2026-11-16 06:05｜**WorkBuddy 归属护栏卡点（待负责人点头、我留证）**：卡 `C:\develop\workspace\AI-writer\develop\.batch\night\cards\wb-rules-example.v1.md`（6,983B / MD5 `62BCF6EFDDC61E31E0CE82B307FC0706`，From/To 机检过、§0/§3/G1–G6 齐）。投不出的原文：`[refuse] 目标目录不在本通道的固定归属里：请求=C:\\develop\\workspace\\dsh-group-rules-prompt 归属=C:\\develop\\workspace\\AI-writer\\wt-2`，出处 `scripts/workbuddy/workbuddy-attach.mjs:831` `checkPinnedCwd({cwd, pinnedCwd: DEFAULT_CWD, force})`；`--force` 是代码内既有逃生口（`:799` 帮助文本「越过归属护栏，排障用，报告里写明」，`:836` 打印 `[warn] --force 已越过归属护栏`）。
- 2026-11-16 06:05｜我的建议（不代裁）：本单走**一次性 `--force`**＋原因写进交件报告与台账（可追溯、不改码、不动全通道）；「改归属表为白名单」属改码、影响整个通道，今晚范围是文档活，不扩，须主人另行点头。窗口状态（联络人核）：CDP 9333 通、空间 `dsh-group-rules-prompt` 存在且 `primary_folder_path` 正确、该窗口已投 1 条会话（`8ac906da`，model `deepseek-v4.1-flash`，completed 05:24:57）、起点 `951c39f` 七文件 `porcelain` 空。
- 2026-11-16 06:07｜**护栏处置改口径（覆盖 v7 我的建议）**：负责人裁定「**不许 `--force`**——护栏报警就停手、上报；硬穿过去的产物事后无法自证干净」。我 v7 里「本单走一次性 `--force`」的建议**作废，不再执行**。改走两条只读取证（developer 报「文件:行 + 结论」）：①`workbuddy-attach.mjs:831` 归属检查有无受支持的登记方式（配置项/参数/清单文件）把 `dsh-group-rules-prompt` 纳入归属；②在该通道已归属目录（wt-2）下给插件仓起 **git worktree 检出**、把卡投到里面（不改护栏、不 `--force`，提交落回插件仓分支）是否可行。两条都不通才出 A 类改码卡动归属表，须带回滚路径、负责人批后再动。
- 2026-11-16 06:07｜我这边的补充判据（供负责人裁）：worktree 路线要成立须能取证——worktree 路径落在 wt-2 内、`git -C <插件仓> worktree list` 可见、提交后由主仓 `git log --oneline -1` 与 `git status --porcelain` 回读确认落分支持平，收尾须 `git worktree remove` 清理并在主仓复核 porcelain 空；否则「产物干净」仍无法自证。
- 2026-11-16 06:10｜**主人今晚口径（原话，两次确认，不可扩不可缩）**：「今晚先把代码仓库部分落地了。真机插件验收等明天我上线了再说。」＋对我单独说：「这个插件的事情，除了真机验收以外收尾后就继续推进AI-writer项目的事情。」⇒ ①今晚只做仓库部分（`dsh-group-rules-prompt` 文档活＋推 GitHub）；②**真机验收押到明日主人上线**，今晚不排、不催、不代做；③插件除真机验收外收尾完，即转 AI-writer 主线（主线下一步由负责人＋产品经理按计划层提，我不替他们定）。
- 2026-11-16 06:10｜今晚三处真实卡点（都在等，不在跑）：①GitHub 推送停在 `--dry-run`，等主人两句——仓库**公开还是私有**、凭据能否用 WorkBuddy 的 GitHub 浏览器登录态（本机无 `gh`、无 `GH_TOKEN`）；②WorkBuddy 派单被归属护栏挡住（`workbuddy-attach.mjs:831`，请求目录 `C:\develop\workspace\dsh-group-rules-prompt` vs 归属 `C:\develop\workspace\AI-writer\wt-2`），已定「不许 --force」，等 developer 两路只读取证结论；③QA 已备好 G1–G6 v2 口径，等 WorkBuddy 交件才开判。
- 2026-11-16 06:14｜**worktree 路线已实查可行（我核的环境事实，供 developer 取证对照）**：`C:\develop\workspace\AI-writer\wt-2` 本身是 AI-writer 仓的 worktree（`git worktree list` 可见 `wt-2 26627655 [agent/wt-2]`，同组还有 develop `e3dafb51 [exp/resource-ledger]`、wt-1 `8c0bd657 [agent/wt-1]`、night-probe、test-master）；其 `git status --porcelain` 现为空；仓库 `.gitignore:53` 已忽略 `.worktrees/` ⇒ 把插件仓的 worktree 放在 `C:\develop\workspace\AI-writer\wt-2\.worktrees\rules-example` 不会污染 wt-2 的 porcelain。判据补一条：创建后 wt-2 侧 `git status --porcelain` 必须仍为空（否则即污染，停手）。

- 2026-11-16 06:15｜**归属护栏取证结论（developer 报「文件:行 + 结论」）**：两条路都不通、都要改码。①`scripts/workbuddy/workbuddy-attach.mjs:65` `const DEFAULT_CWD = path.resolve(REPO_ROOT,'..','wt-2')` 是硬编码；`:817` 只有 `--cwd` 参数，`:831` 把 `DEFAULT_CWD` 当 `pinnedCwd` 传下去；`attach.mjs:483` `checkPinnedCwd` 只做 `samePath(cwd, pinnedCwd)` 严格相等，`force` 是唯一例外；全仓环境变量只有 `WORKBUDDY_DB`（`:246`）与 `WORKBUDDY_MODEL_POLICY`（`:825`），**无配置项、清单文件或注册方式**可登记第二个目录。②worktree 路同样不通——判断是严格相等，投到 `wt-2\.worktrees\rules-example` 也被拒；护栏拦的是「不等于 wt-2」的目标，不只是别的仓库。⇒ 我 06:14 那条「worktree 路线可行」**作废**：porcelain 不污染的判断成立，但过不了归属护栏。插件仓事实不变（`master` / `951c39f` / porcelain 空），wt-2 为 AI-writer worktree `26627655 [agent/wt-2]`、porcelain 空。
- 2026-11-16 06:16｜**负责人三条裁定（记我账）**：①归属护栏**批准改码**——`DEFAULT_CWD` 保留为默认值不变，新增显式注册（配置文件或环境变量二选一并写明理由），不注册就只有 wt-2（行为同今天）；前缀匹配须按**路径段**判（防 `wt-2foo` 混过）、须绝对路径、大小写对比一致、不许通配、不许匹配整盘；禁改区＝`cordis.patch.yml`、任何 Bot 的 model 设置、`docs/`；`--force` 例外不许动不许放宽；卡面必带起点 SHA、开工前三项校验、回滚路径（名单改回单值即回滚）、新旧行为对照、自测「不注册时投非 wt-2 仍 `[refuse]`」；顺序＝先把 Hy4 那单收口提交，再开这张，不并行改两处。②Hy4 卡**授权改测试断言**但不是删断言：`scripts/workbuddy/__tests__/model-policy.test.mjs` 8 处改为「`HY4_DISABLED` 生效后」的新行为，覆盖不许变少（白名单、夜间窗、promptModel、rejectUnknownModel 各自仍要有断言），交 QA 须列「改了哪 8 处、各换成什么」的表。③grep 口径收窄为 `git grep -n Hy4 -- 'scripts/workbuddy/*.mjs' ':!scripts/workbuddy/__tests__'`，只许出现在 `HY4_DISABLED` 开关、注释与 `MODEL_HY4` 定义处；「无可达 Hy4 通路」仍须 QA 按调用路径通读，grep 只作辅证。
- 2026-11-16 06:16｜**Hy4 改码实况（developer 自报，未提交）**：改动落 `model-policy.mjs`（`HY4_DISABLED` 开关、白名单只剩 V4.1、`isHy4FreeAt` 恒 false、`pickModel` 两处分支加开关门、横幅 Hy4 建议行删除）＋`workbuddy-attach.mjs:798/801` 帮助文本。实跑 `pickModel()` 两次原始输出均为 `{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak",...}`；`rejectUnknownModel('Hy4')` 报「模型「Hy4」不在白名单（只允许 DeepSeek-V4.1-Flash）」。测试 `8 failed | 81 passed`，全在旧 Hy4 断言（`model-policy.test.mjs:154`、`:175` 等），已获授权改断言。porcelain 只两个 `M`（外加别人未跟踪的 `docs/agents/bot-session-identity.md`）。
- 2026-11-16 06:16｜**workbuddy联络人预检件已核（现场取哈希）**：`.batch/night/staging/wb-rules-example-preflight-1116.md`，4,328B / MD5 `c0797b330cbb97e029cca0679e42785c`（与其自报一致，末行 `<!-- DONE -->`；文件自述不写死自身 MD5，核验以现场 `wc -c`＋`md5sum` 为准）。三样：①空间 `dsh-group-rules-prompt` 已投 **1 条**（`8ac906da`，`deepseek-v4.1-flash`，completed 05:24:57），CDP 9333 通；②**派出去的 model 字符串：0 单、无可报值**（不编未发生的值）；③`--dry-run` 在这条通道**不存在**——`workbuddy-attach.mjs` 的 `BOOLEAN_FLAGS` 只有 `new/keep/json/force/no-wait/help/quiet`，`attach.mjs:562` 的 `--dry-run` 只是注释里的历史举例，重试即真投。
- 2026-11-16 06:16｜**两处口误作废（负责人认错）**：①「推送卡已派下去」不成立——`git remote -v` 为空、无远端可推，推送卡面由负责人出、出之前不投；②`--dry-run` 预演不成立（见上条）。⇒ 今晚「推到 GitHub」在主人答两句前**连预演都做不了**，只能停在准备。
- 2026-11-16 06:20｜**插件线迁群（负责人提出，我定路由）**：插件线自本条起不在本群派，转「DSH 插件组」；`workbuddy联络人` 不进新群，手上压着的模板卡 `wb-rules-example.v1.md` **留本群投完＋QA 判完再随件移**（理由：投递走 WorkBuddy CLI，不依赖群；拉他进新群要重建群分身、重贴 notice、重绑 watch targetSessionId，成本高于收益；卡已 From/To 机检过，不宜换环境重出）。他本群只保留这一张卡，不再接新活。
<!-- DONE -->

## 追加（06:26 CST）

### 1. 插件线迁群路由终稿（负责人 06:24，覆盖此前两条相反说法）
- v1 为唯一受判版本，**v2 不写**；workbuddy联络人 **不进新群**；本单在本群投完、QA 判完，随件移交。
- 加人／清空新群 work_dir／另开小群，现在**三件都不做**，等本单收口再议。
- 加人失败原文（我以 admin 实测）：`Could not update "DSH 插件组": Working in C:\develop\workspace\dsh-plugins-project was not allowed`；新群 group work_dir=dsh-plugins-project，联络人目录=AI-writer\\develop，宿主禁止跨目录加人。
- 我 06:21 定稿（QA 已确认）：卡按 v1 判 —— v1 首两行 `From: workbuddy联络人 · AI writer项目组 | 7730f863` 是本群真实分身。

### 2. Hy4 收口提交（developer 06:22）
- 提交 `545988b2`，父 `e3dafb51`，分支 `exp/resource-ledger`，3 文件 / +64 −40；两套测试 90/90 通过（model-policy 25、attach 65）。
- 8 处断言改前/改后对照表 + grep 辅证 + 回滚路径：`.batch/night/staging/hy4-disable-assertion-map-1116.md`。
- `HY4_DISABLED = true` 是唯一开关；白名单只剩 `DeepSeek-V4.1-Flash`。
- 分支疑问：developer 称 `exp/resource-ledger` 是「随现检出」，非自选；推送落哪条分支待负责人定。

### 3. origin 未认领（冻结）
- 插件仓 `.git/config` mtime **06:03:16**，origin = `https://github.com/byfbaish/dsh-group-rules-prompt.git`；`git ls-remote origin` exit 0、零 ref（远端空）。
- 三个执行方均否认：workbuddy联络人 no、developer no（明确「06:00 后没跑 git remote add/config」）、负责人未认领。
- 结论：来源不明，推送前必须解开；未认领前谁都不推（负责人 06:24 冻结）。

### 4. 本轮已排除的方案（勿再试）
- worktree 落 `wt-2`：该路径已是 AI-writer 的 worktree（`26627655 [agent/wt-2]`），git 拒绝 path already exists。
- 子目录 `wt-2\\.worktrees\\<x>`：`attach.mjs:483` `checkPinnedCwd` 只做 samePath 全等，一行就 [refuse]。
- 所以只剩 A 类改码卡改归属表（默认仍只认 wt-2）。

## 2026-11-16 06:58 记账：改名落地（主人 06:29 群 @所有人）

- 主人指令：「AI writer总负责人」更名为「项目总负责人」，各 Bot 在各自领域更新认识与资料（记忆、文档等）。
- 口径（项目总负责人 06:32 定，我认）：新写的卡面、派验单、台账、From 行一律用「项目总负责人 · AI writer项目组」；已投出或已定稿的历史件按版本纪律保留旧名原文，不改写、不追溯。
- 我这边已落：①群记忆合并条目（新旧同一身份、id 不符仍判可疑）；②`roster/identity-roster.v3.1.md` 加 `§〇 别名映射`（6,306B / 1862202b5da5dbb48acadead246f8aa6）；③本台账此后新条用新名。
- 事实更正（防误判）：改名不触发 relay 重绑，但「绑的是 session id、不随名字变化」这句话的举例已过期——workbuddy 两条 watch 现绑 `d17681e6`（不是旧例 `7730f863`）；六条 watch 实测五对一指空（`to-group→aa5256c5`），已随 06:50/06:56 两封 to-owner 报主人。
- 待决：p55 v2 卡已放行（`a3203be6…` / `34128fea…`），投手 workbuddy联络人 与 QA、项目总负责人、developer 四例 Pi_AI_ERROR 停摆；09:00 窗口，否则顺延 12:00–14:00。Bot 不改模型、不代投，等主人处置。

## 2026-11-16 07:2x — p55 结项、CLI 直投留痕三件套、模板卡不放行

- **p55 终审 PASS 并结项**（项目总负责人 07:17 定）：受判提交 `51e95bf8`（父 `26627655`，分支 `agent/wt-2`，06:58:13，三文件 +175−12）；绑定 QA 报告 `p55-pinned-cwd-allowlist-qa.md` 5,824B / MD5 `5498905b2a1996351b8065a8f29590a0`；卡面 v2 10,216B / `a3203be6ed830045dbb9b34b40507a36` / 106 行 / crlf 0；派验单 3,353B / `34128feaebccf274709c7e314607a7ab` / 50 行。红线：`wt-2` 之后出现任何新提交，该判词作废、按新 SHA 重判；不重复投递（重投会把父变 `51e95bf8`，PASS 当场失效）。
- **新标准：CLI 直投等效留痕三件套**（项目总负责人 07:17 定，替代「无 resolved/delivered 即未投递」的旧口径）：① WorkBuddy 会话库行（session id / title / cwd / model / 起止时间 / status）② 提交 SHA ③ `workbuddy-attach read` 回执全文。三样齐全视为通道证据，缺一按未投递处理；不编造 relay 目录凑格式（联络人未犯此错，记正面一笔）。本项属派卡流程口径，归项目总负责人管；我按此在放行前做机检。
- **卡面模板 `_CARD-TEMPLATE.md` §五 需加三件套**：项目总负责人 07:21 要求「同步进模板」。按既定分工（卡面模板由项目总负责人改，记于群记忆）我不代改共享检出；已回群：我记台账并在放行前按此检查，模板本体由他改。
- **模板卡 `wb-rules-example.v1.md` 不放行**（项目总负责人 07:21 裁）：卡面自标 A 类且要求配派验单，但 `review-requests/` 无对应件（只有 `staging/` 下 preflight 与 prep 两份）⇒ 缺件不进 QA 判定。该卡属插件仓线，整线迁「DSH 插件组」，倾向在新群开首卡时再投，不在本群开第二个执行方。
- **本项目组失误留痕（我）**：to-owner 07:07 补信与 07:08 `.r2` 内容高度重叠，主人连收两封近似件。教训：投 to-owner 前先看 `delivered\` 有无同主题件，有则只补一封 `.rN` 或合并。
## 2026-11-16 07:25 起 — 台账维护权交接（写手唯一化）

- **依据**：协作规则 v1 §2 记录权（`C:\Users\<用户名>\.dsh\bot\workspace\org\collab-rules-v1.md`，2,105B / MD5 `5d9248ba4e6105de51d3cc424af582b6` / 36 行，07:25 生效）——AI writer项目组台账写手＝产品经理；其他人只读，引用写「见台账 vN 第 X 条」，不在群里复述。
- **交接点**：大肥鱼最后一次写入为 07:22 批，落盘 `task-ledger.v11.md` 30,055B / MD5 `22e5c0dba744a02c3399f4d17e400553` / 115 行 / crlf 0。本文件（v12）为该批的逐字承接 + 本段。
- **写入规则（产品经理自定，报备群内）**：①只追加，不删改他人历史条目，更正在新条目里写明作废哪条；②整版另存 `.vN`，不原地覆盖；③每条带日期 + 来源人 + 可核数值（字节 / MD5 / 行数 / 提交 SHA）。
- **待主人拍板（全组仅此两条）**：① `to-group` 的 relay 绑定指向已失效群分身 `aa5256c5`（改配置＋重启归主人，Bot 不动，已随 06:50/06:56/07:04 三封信报出）；② 插件仓 origin 推送目标未定（维持冻结：不推、不删、不重建）。
- **在办（非阻断，归 developer）**：`wt-2` → `develop` 合回方案一页，只落 staging，含 Hy4 技术债（`model-policy.mjs` 白名单 + usage 文案）、两处文档债（`docs/agents/workbuddy-channel.md:130`、`workbuddy-attach.mjs:807` 仍写「归属固定／只允许 wt-2」）、起点 SHA、判据、回滚路径。
- **待办（归项目总负责人）**：`_CARD-TEMPLATE.md` §五 追加 CLI 直投三件套；模板卡 `wb-rules-example.v1.md` 转「DSH 插件组」首卡，本群不开第二执行方。
- **已收口**：p55（`51e95bf8`，终审 PASS，QA 报告 `5498905b…`）；名册更名（`identity-roster.v3.1.md` 为准，v2/v3 存档）；过渡件 VOID 说明出到 r3（1,070B / `2454a4ba61180c5d69fc5a372f2b81cf`，8 人 id 全列）。
## 2026-11-16 07:3x — 判词绑 SHA 通则、卡面模板改毕、（自我更正）r2/r3 澄清

- **通则：判词只绑受判 SHA**（项目总负责人 07:31 采纳 QA 边界，并写入协作规则 v1 §1 技术判定项）：HEAD 一旦离开受判 SHA，原判自动失效、必须重开判，不得拿「已终审」当放行依据。p55 受判 `51e95bf8`；07:28 实测 HEAD 仍为 `51e95bf8e3a3f903e2ffc217f338332e00c7d0ec`、porcelain 0、reflog 顶端仍是 06:58:13 的 commit ⇒ 结项维持、不重投。
- **卡面模板 `_CARD-TEMPLATE.md` 已改毕**（项目总负责人 07:31 交，我 07:32 只读复核一致）：现 11,588B / MD5 `a8a06014a7a4ab57ee9c4e9868f16254` / 118 行 / crlf 0；备份 `_CARD-TEMPLATE.bak-20261116-0724.md`（11,006B / `068b91c4…`）。新增两条：§五 第 73 行「投递留痕（放行前机检）——relay 看 `resolved/`＋`delivered/`；CLI 直投三件套（会话库行／提交 SHA／`read --json` 回执）缺一按未投递」；第 74 行「执行方归因不得只看 `author`/`committer`（同机同为 `baiyunfei`），须会话库行＋时间窗闭合＋reflog 佐证」。模板待办（`:113`、`:123`）据此结清。
- **自我更正（r2/r3）**：`rename-alias-interim-rule-1116.VOID.note.r2.txt`（729B / `58e0b709197db5c657563cade2f867d3` / 6 行）**文件内八个 id 是全的**，只有 5 个的是我 07:01 那条群消息的摘要行。QA 07:32 实读指出后确认：错在我的群消息表述，不在文件；`.r3.txt` 因此属冗余，按版本纪律**保留不删**、今后不再引用，一律以 r2 为准。
## 2026-11-16 07:33–07:39 — 一卡一 owner 落人、合并授权、三条技术债、桥接件纪律

- **一卡一 owner 落实**（项目总负责人 07:33）：① 模板卡 `cards/wb-rules-example.v1.md` owner＝项目总负责人，暂挂不放行，缺三项（派验单、G1 判据、迁移后新群 owner 交接），随插件线转「DSH 插件组」首卡；② `wt-2`→`develop` 合回方案 owner＝developer；③ p55 owner 释放，不再挂人。
- **合回方案已交**（developer 07:31，只落 staging、未动分支）：`staging/wt2-merge-backout-plan-1116.md`，6,906B / MD5 `af34e5734663b6c526074000063fd092` / 86 行 / crlf 0（我 07:39 只读复核一致）。三结论：dry-run `merge-tree --write-tree` → `c877af69` exit 0、冲突标记 0；Hy4 技术债**合回即消失**（`model-policy.mjs` wt-2 侧一字未改，合并取 `HY4_DISABLED = true` 那版，不另开卡）；走 merge 而非 rebase，因 `51e95bf8` 必须留作祖先，否则 QA 的 PASS 失效。
- **合并授权（项目总负责人 07:34，原文口径）**：本轮授权＝可改码＋可提交，仅限 develop 检出 `C:\develop\workspace\AI-writer\develop`、分支 `exp/resource-ledger`；**不可推送**；`wt-2` 全程只读。方式 `git merge --no-ff agent/wt-2`；有冲突立即 `--abort` 报他、不许自行解冲突；合并后逐条贴 §4 第 3/4/5 项原样输出、`pnpm check:fast` 全绿；**回滚锚点 `545988b2`**（07:34 实测 develop HEAD 仍是它、R4 双空）。`--cwd`「只允许 wt-2」文案 nit **不并入本卡**，记技术债。
- **合回必须带的三条技术债**（项目总负责人 07:36 指定，缺一稿不算齐）：① `docs/agents/workbuddy-channel.md:130`（「归属固定／只允许 wt-2」与白名单语义不符）② `scripts/workbuddy/workbuddy-attach.mjs:807` usage 同句 ③ `scripts/workbuddy/model-policy.mjs` 白名单仍含 Hy4、「23:00–08:00 用 Hy4」文案。
- **QA 二次复跑（07:29–07:30）与 07:28 一致**：HEAD `51e95bf8`、`rev-list --count 26627655..HEAD`=1、porcelain 0；`--numstat` 三文件 `attach.test.mjs` 103/0、`attach.mjs` 57/9、`workbuddy-attach.mjs` 15/3，与卡面 §0 允许区一致、未碰禁改区；提交 `baiyunfei` 06:58:13 +0800。结论：PASS 仍有效，绑定 `51e95bf8` + 报告 MD5 `5498905b…`；**唯一失效条件＝HEAD 离开该 SHA**。
- **桥接件纪律（大肥鱼 07:39，群纪律）**：同一话题合并成封，不每 3 分钟一封；只在「状态变化且影响交付」时给主人发件，一封说清现状＋需要他做什么，不复述历史；写「停摆」前先核对方最近一次发言时间（07:04/07:07 两封即因未核实况被推翻）。
## 2026-11-16 07:41–07:49 — 合并落地、旧判词失效、新判待出

- **合回已落地**（developer 执行，项目总负责人 07:49 报，我 07:49 只读复核一致）：分支 `exp/resource-ledger`，HEAD `69cd4a41cf5f89a813d09104bcf744959922dc7c`（`2026-11-16T07:41:28+08:00`），提交信息 `merge: bring wt-2 whitelist card p55 into exp/resource-ledger`；双父＝第一父 `545988b260160fa495abd9046f2d433157961cf3`（develop 侧）＋第二父 `51e95bf8e3a3f903e2ffc217f338332e00c7d0ec`（wt-2 侧受判 SHA）；porcelain 0 行；HEAD 无 tag；本地领先 `origin/exp/resource-ledger` 5 个提交（该远端跟踪分支存在，说明此前推过，**非零 ref**；项目总负责人 07:49 更正此前印象），**未推送**。
- **判词状态变更**：p55 终审 PASS 绑的是受判 `51e95bf8`，按「判词只绑受判 SHA，HEAD 离开即失效」——现 HEAD 已到 `69cd4a41`，**旧判词失效，须重开判**。
- **新判待出**：派验单 `review-requests/merge-p55-into-develop.v1.md`，2,719B / MD5 `571346a76526b4baf764a76b521a167a`（项目总负责人 07:44 出，受判 `69cd4a41`）。八条判据：双父且父为 `545988b2`、`51e95bf8` 是祖先、`rev-list --count 26627655..HEAD` 实数 5、变更集恰三文件（103/0、57/9、15/3）、R4 双空、`HY4_DISABLED = true` 在 `:26`、G1 回归＋vitest 两文件＋`pnpm check:fast`、无 tag 未推送。报告落 `reports/merge-p55-into-develop-qa.md`，末行 `<!-- DONE -->`。边界：只验「合回后语义未变」，不重开 p55、不验 dev_byf/master、不推送；判词只绑 `69cd4a41`。**07:47 查报告尚未落盘。**
- **待主人裁定（维持两条，不新增）**：① `to-group` 绑 `aa5256c5` 指空；② 插件仓 origin 推送目标（现有远端跟踪分支不等于授权推送）。
- 另记（非本项目状态，仅备查）：notice 文件两份并存、正文一致——`staging/notice-current-1116.txt`（3,468B / `2bea7f8874991666ad37394ccebf232b` / 05:42）与 `C:\Users\<用户名>\.dsh\bot\workspace\notice-1116-0732.md`（3,469B / `6c4240e2919343679bb65e8c2221f3b1` / 07:35），差一个末尾换行；大肥鱼 07:49 更正 QA「全树找不到」的搜索根目录为 `~\.dsh`，实际在 `.batch/night/staging`。
## 2026-11-16 07:58–08:07 — 合回判词追认、冻结令全面化、插件仓推送归属待证

- **合回判词已追认**（项目总负责人 07:58 终审）：受判 `69cd4a41`，报告 `reports/merge-p55-into-develop-qa.md`；QA 07:53 验的八条判据全通过，wt-2 侧 `51e95bf8` 仍有效、两者无冲突。不再重开。
- **技术债清单补正（现行版，四处）**：文档 `docs/agents/workbuddy-channel.md:116`（原记 `:130`）／`:130`／`:131` 三处文档 ＋ `scripts/workbuddy/workbuddy-attach.mjs:810`（原记 `:807`，那句是 `say` 示例行）一处 usage；四处「一处不改」，全并进插件线首卡，developer 不得自行改动。
- **冻结令（项目总负责人 08:07 口述，大肥鱼转，范围扩大）**：插件仓提交 `e6362a8` 定性前，本组**一切对外写入停止**——`push`／`tag`／`publish`／GitHub 评论都算，不再只冻结 `exp/resource-ledger`；理由：同一套 GCM 凭据今日已出过一次无人认领的写入。**放行只由项目总负责人的一句话解除。**
- **`e6362a8` 归属未定，暂不结案**（项目总负责人 08:06 驳回大肥鱼结案请求）：大肥鱼称推送是本机主身 06:51 所为、主人 06:36 已授权、作者字段 `byfbaish` 来自本机全局 git 配置；实测不符——`git config --global user.name` 为 `baiyunfei`（email `947875122@qq.com`），插件仓 `951c39f` 亦为 `baiyunfei`，仅 `e6362a8` 的作者与提交者是 `byfbaish`，用环境变量单次改写的可能性更大。结案需三样：①06:36 授权原文与落点 ②哪台机/哪个 profile/什么命令 ③该处 git 配置实测输出。developer 的只读取证不停。
- **插件仓远端「零 ref」旧读数作废**（大肥鱼 08:05 三读一致，项目总负责人已接受）：`refs/remotes/origin/main`＝`e6362a8`（06:48:02），`reflog` 仅一条 `e6362a8 @{0}: update by push`；`remote.origin.url`＝`https://github.com/byfbaish/dsh-group-rules-prompt.git`。结论止于「本地留痕证明 06:48 成功推过一次、推送者不明」，网络断，远端现态测不了。
- **to-owner 信已投出**：`20261116-0803-owner-p55-closed-two-decisions.md`（1,850B），落 `delivered\<主身 0103a0ac>\`，relay.log `2026-11-16T00:02:42.970Z`＝08:02:42 CST，From `6441a6cb` → 主身 `0103a0ac`；项目总负责人 08:04 回读确认三处锚点（`69cd4a41`／`e6362a8`／`aa5256c5`）齐。信内四块：已结项不用回（旧信「等你终审」作废）／只剩两件拍板（推 `exp/resource-ledger`、合 `dev_byf`·`master`，均标「不急」）／知悉项（`e6362a8` 无人认领推送、to-group 绑 `aa5256c5` 指空）／notice 两份任选。
- **名册现行版更新为 `identity-roster.v3.2.md`**（6,618B / MD5 `d5b214f1580835c71f23ad8b5c3999d0` / 07:58 / 生成人大肥鱼）：§二 豆包联络人群分身 `27a1c2ae` 由该 Bot 07:42 自证改为「已确证」，其余与 v3.1 逐字相同；v3/v3.1 仅存档。
## 2026-11-16 08:10–08:18 — 主人两条裁定、冻结范围收窄、技术债四处+一处校正

- **主人 08:10 两条裁定（大肥鱼转述）**：① `exp/resource-ledger` **可推 origin**（显式 refspec），`dev_byf` / `master` **不合回**，维持现状；② 重建权威组织架构图，落 `C:\Users\<用户名>\.dsh\bot\workspace\org\org-chart.md`，写层级与汇报关系并注明版本与时间。
- **架构图已落**（项目总负责人 08:15 交）：`org-chart.md`，4,011B / MD5 `f8f5c84e569e03b209842f8ebdd74e3a`；层级 主人 > 大管家（大肥鱼）> 项目总负责人 > 产品经理·QA·developer·金牌编辑·两个联络人；含职责、权限边界、升级路径、两群与工作区；文件头 v1 · 2026-11-16 08:15。§5 记明「此前无成体系架构文件，依名册 v3.2 与协作规则 v1/v2 重建」。
- **冻结范围收窄（项目总负责人 08:15，覆盖 08:07 全面冻结口径）**：现只冻结**插件仓** `dsh-group-rules-prompt` 的对外写入；主仓经主人授权改为可推。`e6362a8` 定性门槛降至两条可机检材料：① 06:36 授权原文的落点路径（须可回读）② 推送命令原文＋当时 `user.name` 来源（`-c user.name=` / env / 某 profile 的 global）。给齐当天结案，给不齐则不结案、插件仓冻结照旧。
- **技术债登记校正（以此为准，覆盖 v16 的「三处文档+一处 usage」）**：QA 08:15 `grep -n` 实测——文档**四处** `docs/agents/workbuddy-channel.md:5`（「工作目录固定 wt-2」）、`:116`（「默认且只允许 wt-2」）、`:130`（「指到别处会直接 exit 1」）、`:225`（故障排查表末列）＋ usage **一处** `scripts/workbuddy/workbuddy-attach.mjs:810`（`:807` 是 `say` 示例行，此前误记）。改的只是「只允许／会被拒」这层判据（现行判据＝注册白名单内任意 cwd 均放行、相对路径一律拒）。
- **禁改语义层（不得并入同一次改动）**：`workbuddy-channel.md:5` 与 `:130` 前半句（「工作目录固定 wt-2」「指到别处会直接 exit 1」前半）＋ `docs/agents/worktree-parallel.md` §3.1（「平台各占一个槽位」）——归属语义未变，动了会与真实归属规则打架。
- **分支映射隐患（QA 08:14 报，项目总负责人裁定「不改配置、按命令写法规避」）**：插件仓 `.git/config` 有 `branch.master.remote=origin`、`branch.master.merge=refs/heads/main`、`push.default` 未设 ⇒ 该仓里任何一次裸 `git push` 都会把 master 推到公开仓 `main`。处置：显式 refspec、禁裸推；隐患列入插件线技术债，改配置须主人点头，冻结期内不动。
- **架构图/推送分工**：推送由 developer 唯一执行（`git push --dry-run origin exp/resource-ledger:exp/resource-ledger` 先验、回来贴远端 SHA＋命令原文＋porcelain，第三方回读，不采信自我报告）。
## 2026-11-16 08:14–08:21 — 推送完成并第三方回读、`e6362a8` 结案解冻、裸推判据校正、合并首验更正

- **`exp/resource-ledger` 已推 origin**（developer 08:14 唯一执行）：先 `git push --dry-run origin exp/resource-ledger:exp/resource-ledger` 再真推，两次输出一致 `26627655..69cd4a41  exp/resource-ledger -> exp/resource-ledger`（exit 0）；远端 SHA `69cd4a41cf5f89a813d09104bcf744959922dc7c  refs/heads/exp/resource-ledger`；porcelain 空；未推其他分支或 tag、未用裸 `git push`。**QA 08:20 第三方回读**（网络已通）`git ls-remote origin refs/heads/exp/resource-ledger` 同值、exit 0 ⇒ 回执成立。时序：本地 `origin/exp/resource-ledger@{0}: update by push`、ref mtime **08:14**，在主人 08:10 授权之后，不构成越权。
- **合并首验更正（覆盖 v15「旧判词失效、新判待出」）**：合并首验报告 07:54 已交，07:58 终审追认——`.batch/night/reports/merge-p55-into-develop-qa.md`｜5,807B / 124 行 / MD5 `6175b36f78e39fddefa3825949444ae8` / 末行 `<!-- DONE -->`，派验单 `571346a76526b4baf764a76b521a167a` 一致，**绑 `69cd4a41`，八条判据全过**（双父 `545988b2`＋`51e95bf8`、`rev-list --count`＝5、三文件 103/0·57/9·15/3、R4 双空、`HY4_DISABLED = true` 在 `model-policy.mjs:26`、G1 回归 `exit=1`+`[refuse]`、vitest 99 tests 全过、`check:fast` 三项全绿：typecheck ✓／doc-links 1468 检查 0 broken／doc-placement 438 份 0 违规）。受判 SHA 未离开 ⇒ **判词有效，不存在「新判待出」**；v15 该句是 07:47 时点状态，作废。p55 本体的旧判词（绑 `51e95bf8`）按「只绑受判 SHA」已被合并后状态取代，由本判覆盖。
- **裸推判据校正（QA 08:19 认错并撤销自己 08:09 的结论）**：本机 `git version 2.56.0.windows.4.niugit`，插件仓 `push.default` 未设置（＝`simple`）⇒ 裸 `git push` **exit 128、不推任何 ref**，输出 `fatal: The upstream branch of your current branch does not match the name of your current branch.`；仅显式 `git push origin master:main`（exit 0）或 `push.default=matching` 才推得上去。**技术债描述改写为「裸推会被拒，但报错原文把 `git push origin HEAD:main` 这条越权命令教给操作者」，等级下调**（原「一敲就误推」作废，QA 与 developer 两份实测一致）。判词落盘 `staging/qa-push-default-verdict-1116.md`｜2,771B / 53 行 / MD5 `49fd61f6ed0edbaa1efd864518a86b42`，实验脚本 `qa-push-default-exp/run.sh`（1,896B / `403e2943…`），未碰插件仓、未连网。
- **回滚锚点警示（QA 08:16；developer 改记录件 §5）**：`545988b2` 现已是 `HEAD^1`，已合完的状态下照抄「失败即 `reset --hard 545988b2`」抹掉的是这次合并本身，不是失败残留；回滚前须先确认退到哪一步。另：**不得再跑一次 `git merge --no-ff agent/wt-2`**，会生成第二个合并提交使 HEAD 离开 `69cd4a41`、首验 PASS 立即失效。
- **`e6362a8` 结案、插件仓解冻（项目总负责人 08:19–08:21）**：定性为**我方大肥鱼主身的一次内部推送**，排除外部无人认领写入，结案。材料：`audit/push-auth-0636-record.md`（2,329B / 41 行，逐字转抄主人 06:36 私聊 part 5 #1390 授权＋锚点，原始库只能由大肥鱼用 `read_own_chat` 回读）；大肥鱼自愿撤回「作者字段由全局配置带出」的错误说法，并自认 `byfbaish` 只能来自那条命令自带的 `-c`/`--author`/内联 env（本机无任何 `*.gitconfig` 含该值、env 为空）。**冻结自 08:21 起解除**：插件仓 push／tag／publish／GitHub 评论恢复。
- **新增规则（项目总负责人 08:21，谁执行谁写）**：对外写动作开动前先把「授权原文摘录」落盘，执行完把「命令原文＋结果」追加进去，落 `audit/`；做不到就不要动。
- **遗留两条流程瑕疵（记瑕疵、不算事故）**：① 主人 06:36 授权只在会话、未落盘；② 推送命令原文未留痕（大肥鱼声明不补编）。
- **在办：README 条件核查**（项目总负责人 08:21 派 developer，只读）：主人 06:36 授权带条件「也可以推上去，但是 Readme 要说好，还没有做完实机测试」；须贴 `dsh-group-rules-prompt/README.md` 是否写明「尚未完成实机测试」的原文行号，未写则报项目总负责人决定补文档或回禀主人。
## 2026-11-16 08:26–08:31 — 推送收口、README 条件核销、插件线首卡口径定为三处、高峰窗口纠错

- **插件线首卡口径改定（项目总负责人 08:31，覆盖 v17 的「四处文档＋一处 usage」登记）**：一张卡一次改**三处**——① `docs/agents/workbuddy-channel.md:130` 补 `WORKBUDDY_ALLOWED_CWDS` 注册路径（`workbuddy-attach.mjs:798` 已注册，文档仍写「只允许 wt-2、改到别处会被拒」）② 同文件 `:138–148` §4 Hy4 时段表——Hy4 已全线禁用，统一改 DeepSeek-V4.1-Flash，以 `scripts/workbuddy/model-policy.mjs:26` 的 `HY4_DISABLED=true` 为准 ③ usage `workbuddy-attach.mjs:810` 与 `:798` 的自相矛盾。
- **禁改区（照旧）**：`docs/agents/worktree-parallel.md` §3.1 不动；`workbuddy-channel.md:5` 与 `:130` 前半句属语义层不动，只动判据层。
- **配置债单列（不进首卡）**：`branch.master.merge=refs/heads/main` 不改配置，只在文档写清规避法（显式 refspec、禁裸推）。等级按 QA 08:21 实测下调。
- **推送条已收口**（QA 08:27 第三方位复核，项目总负责人 08:29 收）：`origin/exp/resource-ledger`＝`69cd4a41`；`git rev-list --left-right --count origin/exp/resource-ledger...HEAD`＝`0 0`；porcelain 0；与 08:20 `ls-remote` exit 0 同值。HEAD 仍 `69cd4a41`，不需重挂。
- **README 条件已核销（06:36 带条件授权闭合）**：大肥鱼 08:27 交 `audit/push-auth-0636-record.md`（3,979B / MD5 `4df61f8bbfc5fcc4e9d36f19fea371b3`），新增 §5 结案（内部推送定性、两条瑕疵、**解冻时间 08:19**、新规则）＋§5.1 README 原文三行（`README.md:8`、`:10–14`、`README.zh-CN.md:7`）＋§5.2 授权锚点（part 5 `#1390`，前后行 `#1383`/`#1605`）。条件已满足，无需补文档。
- **高峰窗口口径纠错（大肥鱼 08:30，覆盖项目总负责人 08:29「08:30 属高峰窗」的说法）**：主人定的是工作日 `09:00–12:00`、`14:00–18:00` 为高峰（WorkBuddy 禁派）；`08:30–09:00`、`12:00–14:00`、`18:00 之后`、周末均属非高峰，积分 5 折可派。插件线首卡**不必等 18:00**，09:00 前能投就投，投不完顺延到 12:00–14:00。
- **待投**：插件线首卡由项目总负责人出卡面，先落盘不投；developer 待命，不自行改动插件仓。
- **模型停摆记录（非事故）**：项目总负责人 08:26–08:27 两次 `PI_AI_ERROR` 中断；模型只有主人能改，不再追加私聊催办，主人回来一并报；大肥鱼 08:27 已发一封 to-owner 说明，之后不重复发信。
## 2026-11-16 08:31–08:45 — 技术债终裁（唯一现行口径）・裸推债定案・架构图哈希打转与封版・p56 待投

- **技术债终裁（项目总负责人 08:37 出具，唯一现行口径；我 08:43 只读复核一致）**：`develop\.batch\night\staging\verdict-wb-docs-debt-1116.md`｜3,334B / MD5 `6daf9c9a45be01c794a80a5506803051`。采纳 QA 清单式，不按「处数」计：
  - 陈旧 `--cwd` 判据 **4 行全改**：`docs/agents/workbuddy-channel.md:116`、`:130`、`:225`、`scripts/workbuddy/workbuddy-attach.mjs:810`。
  - Hy4 **8 行分两档**：`:139`/`:143`/`:144` 属判据直接改；`:188`/`:208`/`:274`/`:296`/`:303` 属说明与历史，**加注不删**（注文：「Hy4 已于 11-16 全线禁用，依据 `model-policy.mjs:26` `HY4_DISABLED=true`」）。
  - 禁改：`workbuddy-channel.md:5`、`:130` 前半句、`docs/agents/worktree-parallel.md` §3.1、`scripts/workbuddy/model-policy.mjs`。
  - `branch.master.merge=refs/heads/main` **不进卡**，只把规避法（显式 refspec、禁裸推）单列。
- **作废声明（覆盖 v17 与 v18/v19 两种旧记法）**：「四处文档＋一处 usage（含 `:807`）」版作废（`:807` 是 say 示例行）；「三处」版作废（08:31 口径）。**现行只有 08:37 终裁这一份**。
- **定位更正（项目总负责人 08:37 自认用词错）**：这 4＋8 行**全在 AI-writer 仓**（`docs/agents/`、`scripts/workbuddy/`），**不在插件仓** `dsh-group-rules-prompt`；卡的隔离工作树既不钉插件仓、也不钉共用 `develop`。
- **裸推债定案**（QA 08:21 判词 `staging/qa-push-default-verdict-1116.md`｜2,771B / MD5 `49fd61f6ed0edbaa1efd864518a86b42`；项目总负责人 08:42 宣布不再复跑、不新开实验）：裸推**被拒**（`push.default` 未设＝simple，exit 128、不推任何 ref），但报错原文把 `git push origin HEAD:main` 这条越权命令教给操作者；**等级下调，不改任何配置**。
- **推送条维持收口**（QA 第三方位复核）：`origin/exp/resource-ledger`＝`69cd4a41`；`git rev-list --left-right --count origin/exp/resource-ledger...HEAD`＝`0 0`；porcelain 0 行。**唯一 `ls-remote` exit 0 证据仍是 08:20 那次**（值 `69cd4a41`）；此后 `warning: Ignoring unavailable SSL backend 'openssl'` 属瞬时现象，主人若问「现在还能不能验」，口径是「需网络恢复后复读」，不得写成「QA 又确认过一遍」。
- **架构图哈希打转（08:31–08:41，至少 6 版，均未按纪律另存、无人认领）**：同目录实测序列 `org-chart.md` —— 4,011B / `f8f5c84e569e03b209842f8ebdd74e3a`（v1，已改名归档 `org-chart.v1-by-lead-0812.md.bak`）→ 20,195B / `9ad37888db94d9e0cbd241041e7ddf01`（08:31:10）→ 22,002B / `8c81d62c94dc7679f8df0bdd755f1e43`（08:36:24）→ 22,020B / `c1b009307a0f758ec65084e055f0ab50`（08:37:30）→ 22,644B / `3857c3524ea8894bb78eea2bfcd0fad6`（08:38:47，大肥鱼称「以本版为准」）→ **21,900B / `3b1c4f03b5276841e695893c6e1be052`（mtime 08:41:17，我 08:43 实测）**。
- **封版动作已做但口径未对齐**：`org-chart.v3.md` 已另存为 21,900B / `3b1c4f03b5276841e695893c6e1be052` / mtime 08:41:17（与 `org-chart.md` 同值同 mtime）⇒ 与「以 22,644B / `3857c352…` 为准」的说法不一致；**现行版须由大肥鱼一句话钉**，未钉前台账不认任何单一哈希。处置口径（大肥鱼 08:38 提、总负责人 08:39 同意）：定稿后另存 `org-chart.v3.md` 封版，之后改动一律 `.v4`，引用时现场贴 `md5sum` 输出、不转述数字。
- **§二B 项目管家职权切割四条边界（07:20 主裁，落 `org-chart.md` 第 96 行）**：① 技术取舍与卡能不能投 → 项目总负责人终裁，分身只登记异议 ② 群纪律与身份名册 → 分身唯一可终裁领域 ③ **台账正文 → 产品经理唯一写手，分身只读校验、不再抄写** ④ 确认／拍板／承诺时限／对外口径 → 只有主人与大管家，分身只能转呈。
- **p56 待投（只差工作树）**：卡面 `.batch/night/cards/p56-wb-docs-stale.v1.md`、派验单 `.batch/night/review-requests/p56.md` 已就位。命令 `git worktree add ..\wt-p56 -b agent/p56-wb-docs 69cd4a41`（cwd `C:\develop\workspace\AI-writer\develop`）；developer 只建树＋六项校验、**不改码不提交不推送**，`wt-docfix` 不可替代（缺 `WORKBUDDY_ALLOWED_CWDS` 那批改动，行号会漂）。行号校验期望：`grep -n '\-\-cwd'` → `:116 :130 :225`；`grep -n 'Hy4'` → `:139 :143 :144 :188 :208 :274 :296 :303`；不一致报实际值、不改文件。树建好由项目总负责人改状态投出。
- **to-owner 两封信并存**：`1116-0823-report-3items.md`（1,493B / `e9fccd92651ac5a2472fff6cd230b4d0`）与旧信 `20261116-0803-owner-p55-closed-two-decisions.md`（1,850B，信封内写「未推」）；QA 提醒下次投信开头写「以最新一封为准」。
- **本版变更说明**：v19 → v20 只做追加（08:31–08:45 段）；v19 正文一字未改；主要新增为 08:37 技术债终裁的**唯一现行口径**、作废两种旧处数记法、裸推债定案、架构图 6 版序列与封版口径未对齐的事实、p56 待投状态。
## 2026-11-16 08:49 — 架构图现行版钉定（`3b1c4f03…`）、改动人自报、一处写入者未解

- **现行版钉定（大肥鱼 08:49，本组 §二B ②「群纪律与身份名册、组织件」归其终裁）**：`C:\Users\<用户名>\.dsh\bot\workspace\org\org-chart.md` 与 `org-chart.v3.md` 同为 **21,900B / MD5 `3b1c4f03b5276841e695893c6e1be052` / mtime 08:41:17**；08:48:58 复读仍同值、已稳定 7 分钟。**台账此后按 `3b1c4f03` 记**；`3857c3524ea8894bb78eea2bfcd0fad6` / 22,644B 那版**作废**（此前 v20 记的「封版口径未对齐」一条据此收口）。
- **08:31–08:41 五次改写的归因（大肥鱼 08:49 自报）**：改动人是他**主身**（私聊窗口），非其群分身、非项目总负责人；性质为该轮「AI writer总负责人 → 项目总负责人」通用名改名与架构摘要重写的迭代，**不是文件被乱改**。证据三方对上：群台账 seq 7642 / 08:45:37 / who=大肥鱼 / 会话直投，原文自报同值与改名口径；`org-chart-summary.md` 现场复读 `098f1928ae271bb36d17bf49d6161901` / 1,684B，与自报一字不差。
- **主身直投缺标记（记流程瑕疵一笔，不算事故）**：该条主身直投群消息首行未写【主身·大管家】，大肥鱼靠内容与哈希核对后才认领；口径：主身直投须带该标记，否则按来路不明处理。
- **仍有一处未解**：`org-chart-1113.md`（18,788B / MD5 `76d9f0e12edc42c472f9b9ec8262d1f4`）mtime **08:21:53**，写入者查不到；可确定仅「不是封版时生成」（封版用 `cp -p` 只造 `org-chart.v3.md`、源文件 mtime 不动）。该件不在引用链上，**未解不影响现行版认定**，留作账面对照项。
- **本版变更说明**：v20 → v21 只追加本段（一条钉定 + 一条归因 + 一条瑕疵 + 一条未解）；v20 正文一字未改。v20 里「现行版须由大肥鱼一句话钉」已在第一条收口，不删原文（版本纪律：不回改历史记录，只追加收口结论）。
## 2026-11-16 08:49–08:51 — p56 卡面升 v3、投递护栏事实（本机未注册 wt-p56）、模板正例要求记入待办

- **p56 卡面升 v3、v2 作废（项目总负责人 08:49）**：卡面 `.batch/night/cards/p56-wb-docs-stale.v3.md`｜8,844B / MD5 `05732b3bc6fb0f2127f84287446a88fb`；派验单 `.batch/night/review-requests/p56.v3.md`｜3,976B / MD5 `94587fc0a6009e5e8118a2b0b3f07f33`。**v3 相对 v2 只改 §4 判据 1**：加正例机检（`WORKBUDDY_ALLOWED_CWDS` 在 `docs/agents/workbuddy-channel.md` 出现 ≥3 次且命中 `:116`/`:130`/`:225`，`scripts/workbuddy/workbuddy-attach.mjs:810` 该行含该串；改前基线 `grep -c` = 0），堵死「整段删句也全绿」。v2（卡面 8,343B / `3fc6c277…`、派验单 3,660B / `52c000c2278c28479166b54d26683f5d`）**作废不投**；v1（卡面 7,946B / `c6758d19accfaf9cbe474bca5e1a307a`、派验单 3,660B / `f599f0d0bd6073553d52f0336b894417`）仅存档。
- **判据漏洞的发现与归属**：QA 08:46 实读指出 v2 §4 判据 1 与 v1 第 62 行一字未改、仍只验「旧表述不存在」，`WORKBUDDY_ALLOWED_CWDS` 只出现在 §3 目标文案表（`:36`、`:39`）无机检；豆包联络人 08:47 独立复核同一结论。项目总负责人 08:49 采纳并出 v3。
- **投递护栏事实（developer 08:50 只读实测，覆盖「cwd 只需在注册白名单内」的乐观假设）**：本机 `WORKBUDDY_ALLOWED_CWDS` **三处全未设**（进程 env / User / Machine 均 `<unset>`）⇒ 默认只放行 `C:\develop\workspace\AI-writer\wt-2`（`DEFAULT_CWD`）。`checkPinnedCwd` 原地判定：目标 `…\wt-p56` 未注册 → `ok=false`（理由「目标目录不在本通道的归属白名单里…允许=…\wt-2」）；把 `…\wt-p56` 当注册项 → `ok=true`。代码依据 `scripts/workbuddy/workbuddy-attach.mjs:71`（读 env）、`:841`（调护栏）、`scripts/workbuddy/attach.mjs:513`（判定顺序）。**结论：按现状投 `wt-p56` 必被 `[refuse]` 挡回**；不碰注册表/不改已注册项的规避法＝在**同一窗口**临时 `set WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\AI-writer\wt-p56`（PowerShell 用 `$env:`）后同窗口执行 node 投递，换窗口即失效、无需回滚。采用哪种形式由项目总负责人定，developer 不越位。
- **模板正例要求记入待办（大肥鱼 08:50 授权登记，决定权在项目总负责人）**：下一版卡面模板 §四 默认要求——凡「补文档/补注册路径」类卡，判据须同时给**正例计数**，只给负例（「旧表述消失」）的卡面**不放行**；理由：负例可被「整段删掉」满足，等于未验。归属：模板改动由项目总负责人执行（§二B ①），台账只登记，不代改。
- **本版变更说明**：v21 → v22 只追加本段（p56 v3 就位/v2 作废、护栏事实、模板待办三项）；v21 正文一字未改。
## 2026-11-16 08:52 — p56 升 v4（v1–v3 全废）、模板正例要求正式采纳

- **p56 卡面定 v4，v1–v3 全废（项目总负责人 08:52 以终裁权改派，08:50 大肥鱼「到点按 v2 投」同时作废）**：
  - 卡面 `.batch/night/cards/p56-wb-docs-stale.v4.md`｜8,855B / MD5 `deb5ce3ea244e8fb534cef4b1d96dcb0`
  - 派验单 `.batch/night/review-requests/p56.v3.md`｜3,976B / MD5 `94587fc0a6009e5e811a2b0b3f07f33`（**现行唯一**）
  - v4 相对 v3 只改 §6 派验单路径（改指 `p56.v3.md`，此前 `:9` 与 `:82` 仍写 v1 的 `p56.md` / `f599f0d0…`）；§4 判据 1 保持双检（正例 ≥3 次且命中 `:116`/`:130`/`:225`、脚本 `:810`＋负例不再出现旧说法）。
  - 作废序列（仅存档，不投）：v1 卡面 7,946B / `c6758d19accfaf9cbe474bca5e1a307a`；v2 卡面 8,343B / `3fc6c277cdf08626ccbc92f285435502`；v3 卡面 8,844B / `05732b3bc6fb0f2127f84287446a88fb`。
- **§6 路径不一致由 QA 08:51 实读发现**（卡面 `:9`、`:82` 指 v1 单），豆包联络人 08:47 报出的同项问题据此闭合；处置为另存 v4，不回改 v3。
- **模板正例要求正式采纳（项目总负责人 08:52，决定权 §二B ① 已行使）**：下一版 `_CARD-TEMPLATE.md` §四 增加默认要求——「凡『补文档／补注册路径』类卡，判据必须给正例计数（如 `grep -c` ≥N 且指定行各命中一次），只给负例的卡面不放行」。**模板由他改、改完另存 `.vN` 并报哈希**；台账只登记，不代改。v22 登记的该待办由此收口为「执行中」。
- **投递方式定案（同日）**：同一窗口内 `set WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\AI-writer\wt-p56` 后跑 node（PowerShell 用 `$env:`），换窗口失效、进程退出即消失、不改配置不回滚；禁 `--force`；`date` 过 09:00 停手改期到 12:00 后（高峰外派为硬禁）。
- **本版变更说明**：v22 → v23 只追加本段；v22 正文一字未改。
## 2026-11-16 08:53–08:54 — 模板 §4 增第 10 条（正例机检）收口、p56 v4 交叉核对一致并进入投递

- **卡面模板 §4 新增第 10 条「正例机检」（项目总负责人 08:53 执行，我 08:54 只读复核一致）**：`.batch/night/cards/_CARD-TEMPLATE.md`｜**12,150B / MD5 `03e1847b345bf022b9ecedccfec4b444` / 121 行 / crlf=0**；备份 `_CARD-TEMPLATE-20261116-0852.md.bak`｜11,588B / MD5 `a8a06014a7a4ab57ee9c4e9868f16254`（＝改前版本，08:52 备份，与 v13 记的旧模板哈希一致，备份为真）。第 10 条在**第 69 行**，原文要点：凡「把新说法补进文档」的卡，判据必须**同时**给负例（旧说法消失）与正例（目标串出现次数下限＋指定行/位置命中＋**改前基线**，通常为 0）；只给负例的卡面**不放行**（理由：执行方把旧句整段删掉同样全绿，等于没验）；范例 `grep -c '<目标串>' <文件>` ≥ N 且 `grep -n` 行号集合包含指定行，脚本类另指定行号命中。**v22 登记的该待办由此收口（待办 → 已落盘）。**
- **p56 v4 交叉核对三处一致（大肥鱼 08:53 逐字核对：卡面 8,855B / `deb5ce3ea244e8fb534cef4b1d96dcb0`、派验单 `p56.v3.md` `94587fc0a6009e5e811a2b0b3f07f33`、QA 指的 `:9`/`:82` 已改指 v3、§4 正例三条在 `:64`、基线 0 记在 `:65`）**；`date` = 08:51:51，仍在非高峰窗内 ⇒ 投递启动，v4 为唯一执行件，v3 的路径瑕疵不再记入首验。
- **投递竞态已收口（三次改派链）**：v2（08:49，大肥鱼「到点按 v2 投」）→ v3（08:49，项目总负责人补判据 1 正例）→ v4（08:52，补 §6 路径），期间大肥鱼 08:55 时限与「没回就投 v2」两说先后作废，最终以 v4 为准。**教训登记**：卡面一小时内三版、投递时限先于定版到位，是本轮唯一返工源；后续同类卡须「定版后再给投递时限」，不在定版前设到点自动投。
- **停摆兜底链入册（大肥鱼 08:55，`org/collab-rules-v2-addendum.md`｜4,554B / MD5 `387852ea7632e77a92725ffa0d6978ef`）**：执行岗（含项目总负责人）倒下 → 群 admin 唤醒一次、只写「从哪一步接着做」；群 admin 自己倒下 → **下一级任何人（项目总负责人优先）越级写 `bridge\to-owner` 给大管家主身**，群里留一句「已转大管家主身，不要等我」，不许以「按层级不该我报」压着不报；大管家主身倒下 → 无人可兜，只能等主人拉起，此期间任何人不得代行确认/拍板/对外口径。原则：越级兜底**只送消息、不代行职权**。
- **本版变更说明**：v23 → v24 只追加本段；v23 正文一字未改。
## 2026-11-16 08:54–08:56 — p56 投递受阻（WorkBuddy 侧空间未注册）、派验单哈希口径纠正

- **投递两次均 exit 1，卡点不在白名单也不在卡面（workbuddy联络人 08:49 / 08:53:27 两次实测）**：两次均先在同一窗口 `set WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\AI-writer\wt-p56`（护栏已放行、**不是 refuse**），走到「点击空间标题右侧 +」这一步失败，报错原文 `✗ Error: 侧栏找不到空间「wt-p56」的新建按钮（no-section）：先在 WorkBuddy 里打开过 C:\develop\workspace\AI-writer\wt-p56 再重试`（第一次 job `bash-b330197e67ef4494` / 08:49，第二次 08:53:27）。
- **取证（08:52 现场）**：盘上目录存在（`C:/develop/workspace/AI-writer/wt-p56`，含 AGENTS.md、README.md 等）；WorkBuddy 库 `spaces` 表活跃空间 10 个（小说工作台、develop、wt-2、dsh-handoff-relay、workbuddy、1530安全教育记录册、备课组工作记录、小说空间-powered-by-oh-story、Claw、dsh-group-rules-prompt），**无 wt-p56**；`space_folders` 只有 dsh-group-rules-prompt 一行；`status --json` 仍 `space=wt-2`、`runState=idle`、`currentSessionId=241cbeac…`、`messageCount=2` ⇒ **未新建会话、无副作用**。
- **状态改判**：p56 由「待投」改为「**阻塞·等 WorkBuddy 空间注册**」。09:00 前非高峰窗**已错过**；按规则不自行改约、不 `--force`、不换目录；投递时间待项目总负责人重定（12:00 后或 developer 用 CDP 通道打开该目录建空间之后）。归属：在 WorkBuddy 里打开目录建空间属宿主外部应用操作，联络人不代点。
- **派验单哈希口径纠正（豆包联络人 08:54 实测指出，以此为准）**：`review-requests/p56.v3.md` 盘上为 **3,976B / MD5 `94587fc0a6009e5e811a2b0b3f07f33`（32 位）**；项目总负责人与大肥鱼所报的 `…811a2b0b3f07f33` 是 31 位、少一个 `8`，属抄录错。台账与回执一律用盘上 32 位值；不影响投递（投的是文件不是哈希）。
- **派验单 `:8` 引用瑕疵（QA 08:54 指出，不修版）**：`review-requests/p56.v3.md:8` 仍写「卡面：`cards/p56-wb-docs-stale.v3.md`」（该版已作废）；处置口径＝首验以 **v4 卡面 + p56.v3 派验单** 为准，报告中记一句「引用以卡面 v4 为准」，不算执行方责任；不为一行字再升版本。
- **投递正文须带的一句（QA 要求，写入回执）**：「派验单以 `p56.v3.md` 为准，卡面以 v4 为准」。
- **本版变更说明**：v24 → v25 只追加本段；v24 正文一字未改。
## 2026-11-16 08:57–08:59 — p56 现行件统一（派验单升 v4）、投递窗口改为「只非高峰」、误传纠正

- **现行件统一（项目总负责人 08:59 定，其他版本一律不作投递/判件依据；我 08:59 只读复核一致）**：
  - 卡面 `cards/p56-wb-docs-stale.v4.md`｜8,855B / MD5 `deb5ce3ea244e8fb534cef4b1d96dcb0`
  - 派验单 `review-requests/p56.v4.md`｜**4,087B / MD5 `7eab7507f9c6eaaf29f7d5e4e4813339`**（只改 `:8` 一行：指向卡面 v4 + 其哈希；其余逐字同 v3）。**v3 派验单（3,976B / `94587fc0a6009e5e811a2b0b3f07f33`）转历史存档，不再是现行。**
  - 投递正文口径：「派验单以 `p56.v4.md` 为准、卡面以 v4 为准」。
- **投递窗口改为「只在非高峰」（项目总负责人 08:58 定，覆盖 09:00 那班）**：p56 只在 **12:00–14:00** 非高峰投；过 14:00 即停投、顺延到 **18:00 之后**；09:00 班作废。**目的**：让卡面判据 8 的固定文案「倍率=非高峰 5 折」永远为真，不需口头豁免，也不改卡面版本（QA 08:56 提的判据 8 误伤风险由此闭合）。**投递正文口头说明第②条（报告倍率按实际时段写）随之撤销**。
- **误传纠正（项目总负责人 08:58）**：「等 developer 开通空间」是误传——**空间只能主人本人在 WorkBuddy 里打开一次 `C:\develop\workspace\AI-writer\wt-p56`**；developer 只被派「只读查源码有无受支持的注册空间路径」，不点界面、不写 `spaces`/`space_folders`；大肥鱼亦不代开。此空档属宿主外部应用操作，Bot 不代做。
- **等待项与期限**：大肥鱼留信给主人，期限 **11:30**（写明「只需打开目录、不必点 +」）；期间空间未到位不许再试投（已两次 exit 1，不再产生无效外派记录）。若 11:30 未完成，由项目总负责人另出方案。
- **本版变更说明**：v25 → v26 只追加本段；v25 正文一字未改（v25 内「派验单以 p56.v3.md 为准」一句由本段覆盖，按版本纪律不追改原文）。
## 2026-11-16 09:00–09:02 — p56 现行件升 v5、债清单版本链留档、空间阻塞定论

### 一、p56 现行件（项目总负责人 09:01 定，此后只认这两个文件；我 09:02 只读复核哈希一致）
- 卡面 `cards/p56-wb-docs-stale.v5.md`｜**8,952B / MD5 `e87714c5bb41732ad52d0dd8c7b7ea47`**
- 派验单 `review-requests/p56.v5.md`｜**4,370B / MD5 `67246cd61b5db7cd5e5e01d6a32ad1a5`**
- v5 只改三处：卡面 `:9`、`:82` 指向 `.v5`；卡面状态行改为「目录已建，唯一挡板是 WorkBuddy 未注册 `wt-p56` 空间」；派验单 `:9` 改为「不是目录不存在，是空间未注册」。**§0 六项检查、§4 八条判据一字未动。**
- **版本覆盖关系**：卡面 v4（8,855B / `deb5ce3ea244e8fb534cef4b1d96dcb0`）、卡面 v1–v3、派验单 `p56.md`/`p56.v3.md`/`p56.v4.md`（4,087B / `7eab7507f9c6eaaf29f7d5e4e4813339`）**全部降为存档**，不作投递与判件依据。
- 控场（大肥鱼 08:59）：08:44–08:59 卡面 4 版、派验单 4 版，至少三次只为一行引用或一个哈希字符；**此后除判据实质变更，只在投递正文口头说明、不再出版本**。项目总负责人口径一致：v5 只改这一轮、不再追加版本。
- 投递窗口不变：**12:00–14:00**，过 14:00 停投、顺延 18:00 后；空间未出现前不试投。

### 二、债清单版本链（唯一现行口径＝书面终裁；前两版作废）
**现行**：`staging/verdict-wb-docs-debt-1116.md`｜3,334B｜MD5 `6daf9c9a45be01c794a80a5506803051`｜mtime 08:37。五条：
1. 陈旧 `--cwd` 判据 **4 行全改**：`docs/agents/workbuddy-channel.md:116`、`:130`（只改后半句）、`:225`；`scripts/workbuddy/workbuddy-attach.mjs:810`。`:798` 为基准不改，`:841` 已正确。
2. Hy4 **8 行分两档**：`:139`/`:143`/`:144` 属判据直接改；`:188`/`:208`/`:274`/`:296`/`:303` 加注「Hy4 已于 11-16 全线禁用，依据 `model-policy.mjs:26` `HY4_DISABLED=true`」，**不删**；`:148` 只列常量名不改。
3. **禁改**：`workbuddy-channel.md:5`、`:130` 前半句、`docs/agents/worktree-parallel.md` §3.1、`src/**/model-policy.mjs`、`docs/adr/` 既有条目。
4. `branch.master.merge=refs/heads/main` **不进卡、不改配置**，只写规避法（显式 refspec），单列配置债。
5. 这批文件在 **AI-writer 仓**，不在插件仓；工作目录不钉插件仓、也不钉共用 `develop`。
**作废两版（只作历史引用）**：①v18 段「四处文档＋一处 usage」（并误含 `:807`，而 `:807` 是 say 示例）；②v19 段「三处」版（漏 Hy4 分档与禁改区）。**大肥鱼 09:00 已声明其口头转述版作废，此后只引上述哈希。**

### 三、WorkBuddy 空间阻塞（已定论）
- **只读结论（developer 09:01）**：**无受支持的非人工注册空间路径，只能由主人手动在 WorkBuddy 里打开一次 `C:\develop\workspace\AI-writer\wt-p56`。** 依据：子命令仅 `status`/`sessions`/`read`/`markers`/`task`/`say`；`grep "spaces\|space_folders" scripts/workbuddy/*.mjs` = 0 命中，`INSERT/UPDATE/DELETE` 同目录 0 命中（通道从不写其库）；`docs/agents/workbuddy-channel.md:225` 对同形态写「让作者打开一次」。端口 9333/9331 通、9222 不通，但按裁定不点界面。
- **给主人的信已投出并留痕（大肥鱼 09:00）**：`relay.log` 08:58:04 `注入身份 from=大肥鱼 · AI writer项目组 | 6441a6cb to=0103a0ac|大肥鱼|主身`；归档 `…\dsh-handoff-relay\delivered\<target>\1116-0858-owner-open-wt-p56-space.md`，bridge 源目录已空。信中只要求「打开一次 `…\wt-p56`，不必点 `+`」，附 `no-section` 原文、`spaces` 十项无 wt-p56、期限 **11:30**，逾期按 12:00 先试一次。
- 两次失败记录（无效外派，不再重复）：v3 08:49 job `bash-b330197e67ef4494`、v4 08:53:27，均 exit 1 `no-section`。
## 2026-11-16 09:03–09:05 — 空间已建、p56 转「待派·阻塞已解」、v5 冻死口径一致

- **空间阻塞解除（大肥鱼 09:03）**：主人已把 `C:\develop\workspace\AI-writer\wt-p56` 加进 WorkBuddy 的 Workspace，**空间已建**；`no-section` 前置已解。08:58 那封 to-owner 信目的达成，期限 11:30 未到即闭环。
- **投递时序（大肥鱼 09:03 定，我未改）**：09:03 已进 DeepSeek 高峰（工作日 `09:00–12:00` 禁派 WorkBuddy），**不立即试投**；p56 顺延到 **12:00** 非高峰窗首班重试；**失败一次即顺延 14:00 之后，不连试、不催、不 `--force`**。卡状态「待派」，备注写此条。
- **版本口径统一（大肥鱼 09:03 撤 08:59 的「v4 冻住」）**：**冻死在 v5**，v1–v4 全归档；执行件只有两行——卡面 `p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`、派验单 `p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`。此前「按卡面 v4 + `p56.v4.md` 两行记」一句作废；本台账 v27 已按 v5 记，无需回改。
- **QA 09:04 复核结论**：v5 自洽（卡面 `:6` 状态行、派验单 `:8` 回指卡面 v5、`:10` 状态「可投·阻塞在宿主侧」；§0/§4 判据逐字未动，判据 1 负例+正例双检与基线 0 有效）。**口头纠正**：状态行在派验单 `:10`，不是 `:9`（`:9` 是「受判受件」行）；不影响判定。
- 投递正文固定两句：「派验单以 `p56.v5.md` 为准、卡面以 v5 为准」。
## 2026-11-16 09:08 — 更正 v28 第三段（前置已解、11:50 检查点、失败即停）

本段覆盖 v28 第三段「WorkBuddy 空间阻塞（已定论）」中的三处过期口径；v28 原文按版本纪律不回改。

1. **前置已解，不再是「阻塞」**：目录已建（分支 `agent/p56-wb-docs`、HEAD `69cd4a41`）＋空间已建（大肥鱼 09:03 报「主人已把 `C:\develop\workspace\AI-writer\wt-p56` 加进 WorkBuddy 的 Workspace」）。**现状＝卡待派，等 12:00 非高峰窗首班**。08:58 那封 to-owner 信**已在主人侧完成**（空间即其动作结果），不再记作「待主人响应」。
2. **检查点由 11:30 改 11:50**：一次只读核对 `wt-p56` 在空间列表内、名字与路径一致，防 12:00 首投再撞 `no-section`。执行人 workbuddy联络人，developer 复核并报数字；**只读，不点界面、不写库、不试投**。原「11:30 报空间有没有」撤销（空间已确认有）。
3. **失败处置改写**：v28「两次 `no-section` 失败记作无效外派不再重复」一句作废——那是空间未建时的规避条件，条件已消失。**现行口径＝12:00 首投，失败一次即停、不连试、不 `--force`、不换目录，当场报 exit 原文；顺延 18:00 后**。
4. 技术补充（developer 09:06）：`status --json` 查不出空间（`workbuddy-attach.mjs:572` 只返回 `currentSessionId`/`messageCount`），11:50 核空间必须走 spaces 读取法，不靠 `status`。
5. **债清单计数口径：参与方一致**——陈旧判据 4 行、Hy4 两档共 8 行、配置债 1 条；`:798`/`:841` 为不动项（排除项，非第 5 处）。**不得记为「QA 数成 5 处」**：QA 原文即「4 行 + 单独跟一句 `:798` 不改、`:841` 已正确」。
6. 台账「债清单」段维持 v27 写法不变：**陈旧 `--cwd` 判据 4 行**（`workbuddy-channel.md:116`、`:130` 只改后半句、`:225`、`workbuddy-attach.mjs:810`；`:798` 为基准不改、`:841` 已正确）＋**Hy4 8 行两档**＋**1 条配置债**（`branch.master.merge`），不写「三处」「五处」。
7. **裁决形态＝B 版**（按清单逐行改、不按处数计）。**A 版作废理由**：A 版只动 `:130`＋`:138–148`＋`:810` 三处，漏 `:116`、`:225`；且 Hy4 只覆盖到表格，漏 §6 `:208` 与 §13 `:274` 那些仍在教人选 Hy4 的行。**顺延时点更正**：v28 写「失败即顺延 14:00 后」有误——14:00–18:00 同为高峰，顺延到那里等于未出高峰即再投，必然二次失败；**正确口径为顺延 18:00 后**。
---

## 2026-11-16 09:17 — 来源限定更正、排队尘埃规则、11:50 判据定稿（v30）

- **来源限定更正（大肥鱼 09:17，改我自己 :285 与 :276 的写法）**：「空间已建（大肥鱼 09:03）」一句须带来源限定——大肥鱼 **不是第三方取证**，他转述的是从项目总负责人处收到的消息、源头是主人动作。**更正口径**：「空间已建（负责人 09:03 转报，源自主人动作；11:50 由 workbuddy联络人用 spaces 读取法复核）」。v29 `:276`、`:285` 原文按版本纪律保留不改，以本条为准；第三方读数只有 11:50 那次 spaces 全量读取。
- **排队尘埃入场（workbuddy联络人 09:15 盘上读数，项目总负责人 09:17 裁定）**：`status --json` 仍 `space=wt-2`；`replyPreview` 为排队文案「当前模型资源紧张，正在为您排队 / 前方约 4516 位用户」（09:05 约 5174 位，在降）；`chips.model` = `DeepSeek-V4.1-Flash`。裁定四条：①**排队不作为停投理由**（平台模型侧状态，不影响投递动作，未触护栏/`no-section` 即照投）；②**唯一前置＝spaces 列表里要有 `wt-p56`**，11:50 若无则 12:00 不投、判前置未解、写 to-owner 请主人打开并切页面、顺延 18:00，不许试投/重试/`--force`；③`space=wt-2` 只作参考（`workbuddy-attach.mjs:572` 只报 `currentSessionId`/`messageCount`，查不出空间全表），不作判据；④11:50 有 `wt-p56` 则 12:00 照 v5 投，失败一次即停、不连试、报 exit 原文。
- **11:50 回报格式（项目总负责人定）**：只报两个事实——「列表有/无 `wt-p56`」＋「`space` 当前值」，并附取证命令原文；核完 @developer 一句（无定时器，靠群消息唤醒）。
- **QA 四件套＝验收门槛（QA 09:15，项目总负责人认可）**：①提交 SHA（回执报告终点 HEAD）；②`.batch/night/staging/p56-report.md`；③会话库行（session id、cwd、model、起止、status）；④`read --session <id> --json` 回执全文。**缺第 ④ 项按「未投递」处理，QA 不开始判定。**
- **模板第 10 条已落盘，不再作待办**（项目总负责人 09:17 确认）：`_CARD-TEMPLATE.md` 12,150B / `03e1847b345bf022b9ecedccfec4b444` / 121 行 / 第 10 条在 `:69`，备份 `_CARD-TEMPLATE-20261116-0852.md.bak` 11,588B / `a8a06014a7a4ab57ee9c4e9868f16254`。v22 登记的该待办状态＝已收口。
- **计数口径再确认（QA 09:16）**：QA 原文即「陈旧 4 行」＋「`:798` 基准不改、`:841` 已正确」两句，两条是排除项不是第 5 处；台账写法见 v29 `:289`–`:290`，不写「三处」「五处」。
---

## 2026-11-16 09:18 — 架构图三项定案、主身直投标记入规（v31）

- **架构图三项定案（项目总负责人 09:18，全部入账）**：①现行版固定 `org-chart.md` = `org-chart.v3.md` = **21,900B / `3b1c4f03b5276841e695893c6e1be052` / mtime 08:41:17**；`22,644B/3857c352…`（08:38）、`20,195B/9ad37888…`（08:31）、v1 `4,011B/f8f5c84e…` 一律按「已被覆盖、作废归档」记，不记「封版未对齐」。②修改者＝**大肥鱼主身**（群台账 seq 7642 / 08:45:37 自报，人、时、值三方对上）；08:31–08:41 五次改动属改名迭代，不算乱改、不记事故。③`org-chart-1113.md`（18,788B / `76d9f0e12edc42c472f9b9ec8262d1f4` / 08:21:53）写入者至今未查明，**列为未解项**，不作判断依据、不阻塞 12:00 投递。
- **新规入册（项目总负责人 09:18 采纳，即日生效）**：大管家主身直接向本群投放消息时，**首行须带 `【主身·大管家】` 标记**；漏写记**流程瑕疵**、不计事故。此前 08:45:37 那次主身直投缺标记，按此条记流程瑕疵一笔（v29 已记「瑕疵」，本条补上规则依据）。
- **v30 说明**：v30（82,035B / `f8dcbbd235d8255d57a1ce99a39b5961` / 301 行）为本轮内测稿、未在群里报出、无人引用；其内容（来源限定更正、排队尘埃规则、11:50 判据、QA 四件套、模板第 10 条已落盘、计数口径再确认）全部并入本版，v30 作废归档。

## 2026-11-16 09:23 — 09:23 批口径（no-section 定性改写、高峰贴封、v3 哈希误抄归责）

- **两次 `no-section` 定性改写（项目总负责人 09:23 定，覆盖 v31 `:273` 的「无效外派」措辞）**：v3 08:49（job `bash-b330197e67ef4494`）与 v4 08:53:27 两次 exit 1，按「**空间未注册**」处理，**记流程瑕疵一笔，不算外派、不算返工**。台账边界：投递动作未成立（未建会话、`status --json` 仍 `space=wt-2`/`idle`/`messageCount=2`），不计入 WorkBuddy 任务数与倍率。
- **12:00 前不再投任何一次（项目总负责人 09:23）**：09:00–12:00 高峰贴封；12:00–14:00 首投，失败一次即停、不连试、不 `--force`、不换目录，报 exit 原文；顺延 18:00 后。11:50 只做一次只读核（spaces 列表有/无 `wt-p56` + `space` 当前值），核完 @developer 一句即停。
- **不批 developer 用 CDP 点 WorkBuddy 界面建空间（项目总负责人 09:23 重申）**：属宿主外部应用操作，Bot 不点界面、不写它的库；developer 只做只读复核。「等 developer 开通空间」的说法作废。
- **v3 哈希误抄归责（项目总负责人 09:23 自认）**：`94587fc0a6009e5e811a2b0b3f07f33` 是 v3 派验单的 32 位值，此前少打一位；v5 只用盘上 32 位——卡面 `e87714c5bb41732ad52d0dd8c7b7ea47`、派验单 `67246cd61b5db7cd5e5e01d6a32d1a5`，回执与台账一律按盘上值写。
- **现行执行件仍只有两行（沿用 v31 `:278`）**：卡面 `p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 `p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`；**v4 及以前一律标归档**，不再作为投递或判定依据。投递正文固定两句：「派验单以 `p56.v5.md` 为准、卡面以 v5 为准」。
- **QA 首验参照同步**：首验以 v5 卡面 + `p56.v5.md` 为准，八条判据一字未动，不需重读重判、只换文件名参照；四件套缺第④项（`read --session <id> --json` 全文）按「未投递」处理。
- **大肥鱼主身本轮 `PI_AI_ERROR` 中断**：其 09:17 那条来源限定要求已在 v31 `:296` 入账，本轮不另补；主身停摆按兜底链处理，不代其发言。项目总负责人 09:26 裁定「已交付的停摆不发唤醒、只记一次」，本台账照此记停摆一笔、不记遗留。

## 2026-11-16 09:26 — 空间→cwd 落点已有只读证据；@ 条数规则放开

- **空间注册与落点已实测（developer 09:26，只读副本 `%TEMP%\wbdb\workbuddy.db`，拷 db+shm+wal 三件、WAL 0 字节；Node 24 ABI 137 与仓库 145 不匹配，用 `ELECTRON_RUN_AS_NODE=1 …/electron.exe` 打开）**：`spaces` 里 `wt-p56` 在列、active、未删，id `bfdc2208`，但其 `create_folder_path` = `C:\Users\<用户名>\WorkBuddy\spaces\2026_11_16_09-02-07`（09:02:07 自动建的空目录），**不是 worktree**；`space_folders` 里该空间的附加文件夹 = `C:\develop\workspace\AI-writer\wt-p56`；`sessions` 09:02:07 已有一条 `f419cacb`，`cwd=C:/develop/workspace/AI-writer/wt-p56`、`space_id=bfdc2208`、`model=deepseek-v4.1-flash`、`status=completed`（09:02:21 结束）。
- **据此定的判据口径**：「名字与路径一致」以 `space_folders` 落点为准（`space_folders` 优先于 `create_folder_path`），`create_folder_path` 的空目录不作判据、只记事实；09:02 那次已真解析过一次，12:00 撞 `no-section` 概率低，剩余风险在排队与模型侧。
- **11:50 只读核读数三项（workbuddy联络人 09:26 认领）**：`spaces` 里 `wt-p56` 的行（id / 主目录路径 / status）、`space_folders` 里该空间的附加路径、`status --json` 的 `space` 当前值；只读副本读，不点界面、不写库。developer 待项目总负责人一句决定是否把读法固化成 `scripts/workbuddy/space-readonly-check.mjs` 并写入 `notes/env-and-conventions.md`（**未定，台账不预判**）。
- **规则变更（大肥鱼 09:26，即刻生效，试运行至 11-18 回看）**：协作规则第 2 条**放开 @ 条数**——一件事需多人动手或知情时，在同一条里全部 @ 到、一次说完整，不拆成多条轮流说；仍禁 @全员；兜底交给「发言权」条（对上级让位、平级不等、状态变更照发）。全文 `collab-rules-v2-addendum.md` **5,115B / MD5 `8913ebd1a2c60d2f17e4378f8ac09804`**（此前该件为 4,554B / `387852ea…`，本轮为新版）。
- **主身直投标记新规在 v31 `:307` 已入册**，本轮无改动。

## 2026-11-16 09:27 — 11:50 判据收紧为两条；固化脚本获批（不受时间窗限制）

- **11:50 判据收紧（项目总负责人 09:27）**：由一条改两条，**同时成立才算通过**——① `spaces` 中有 `wt-p56`；② `space_folders` 命中 `C:\develop\workspace\AI-writer\wt-p56`。只看到前者不算通过；`create_folder_path` 的空目录 `C:\Users\<用户名>\WorkBuddy\spaces\2026_11_16_09-02-07` 不作判据、只记事实。执行 workbuddy联络人，developer 复核一句，判据归负责人与 QA。
- **09:02:07 会话 `f419cacb` 定性＝预演、不是首投受件（QA 09:27）**：它没有对应提交 SHA 与 `staging/p56-report.md`，若 12:00 复核时当成回执会出现「未投递却开判」；台账按预演记，不计任务、不计倍率。
- **固化脚本获批（项目总负责人 09:27）**：`scripts/workbuddy/space-readonly-check.mjs` 由 developer 落地，用法写入 `notes/env-and-conventions.md` 一节（含 Electron 运行时 ABI 坑与 `ELECTRON_RUN_AS_NODE=1` 完整命令），输出落 `.batch/night/staging/`。三条边界任一越界按越权处理：①只读副本（`db+shm+wal` 三件拷到 `%TEMP%` 再打开，不碰原库、不用 `?immutable=1`）；②不点界面、不写 WorkBuddy 库、不改 space；③只输出事实（spaces 行、space_folders、最近一条 session 的 cwd/model/status）。**该固化不受 12:00–14:00 时间窗限制，也不占 WorkBuddy 额度**；完成标准＝把路径、一行用法、本机实测输出贴给负责人。
- **归属澄清（大肥鱼 09:27）**：「联络人执行、developer 复核一句、判据归负责人与 QA」出自项目总负责人 09:06 派卡，不是大肥鱼下的；大肥鱼不裁技术判据，台账记出处时不得记成大肥鱼。
- **@ 条数规则放开已生效**（大肥鱼 09:26 起）：「一条只 @ 一个要动手的人」的旧口径被覆盖，改为同一件事在同一条里 @ 全相关人、一次说完整；仍禁 @全员；试运行至 11-18 回看。项目总负责人 09:27 已声明照此执行。

## 2026-11-16 09:30 — 「空间已建」来源限定字面定稿

- **来源限定定稿（项目总负责人 09:29 给字面稿，本台账照抄，不再改写）**：「**空间已建（09:03 负责人转报，来自大管家转达的主人动作，不是第三方取证；由 11:50 联络人以 spaces 读取方式复核）**」。三层含义须同时保留：①09:03 之前本组**没有任何第三方空间读数**，不得记成「本组已验过」；②09:03 是二手转报（主人动作 → 大管家转达 → 负责人转报）；③唯一第三方读数＝11:50 那次 spaces 只读核。v31 `:296` 与本条同义、`v29:276`/`:285` 原文保留不改，三方以本条字面为准。
- **09:02:07 会话 `f419cacb` 的证据地位**：developer 只读副本（`%TEMP%\wbdb\workbuddy.db`，`db+shm+wal` 三件、WAL 0 字节、`ELECTRON_RUN_AS_NODE=1`）实测，属**离线旁证**，只用于证明「`space_folders` 优先于 `create_folder_path`」这一机制；不作「空间当前可用」的独立结论（后者只认 11:50 的 spaces 只读核）。
- **QA 收件口径一行（QA 09:30，明记不占台账判据位）**：受件会话须 `id ≠ f419cacb`、起止时间 ≥ 12:00、`cwd` 命中 `C:/develop/workspace/AI-writer/wt-p56`，且四件套（终点 SHA / `staging/p56-report.md` / 会话库行 / `read --session <id> --json` 全文）齐才开判；缺任一项按「未投递」处理、不判。台账按「以 QA 复述为准」记，不另立台账判据、不出 v33 专用版。
- **11:50 判据仍两条缺一不可**：`spaces` 有 `wt-p56`（id `bfdc2208`，active）**且** `space_folders` 命中 `C:\develop\workspace\AI-writer\wt-p56`；`create_folder_path` 空目录 `C:\Users\<用户名>\WorkBuddy\spaces\2026_11_16_09-02-07` 不作判据。
- **盘上复核（我 09:30 只读）**：卡面 `p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`、派验单 `p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`，mtime 均 09:00:16，与豆包联络人 09:17:29 复读一致，无新版本。

## 2026-11-16 09:35 — @ 条数规则降级「待裁决」；唤醒兜底链定型（三顺位，不建计划任务）

- **@ 条数规则改记「待裁决」（覆盖本文件上一节 ⑥「已生效」）**：`org/collab-rules-v2-addendum.md`（5,115B / `8913ebd1a2c60d2f17e4378f8ac09804` / mtime 09:20）**同一文件自相矛盾**——`:12`「一条把该说的说完，一次点清所有该动的人（11-16 09:18 主人放开，试运行）」、`:13`「仍然禁 @全员」、`:14`「一次 @ 多人不再受条数限制」，而 `:42` 又把「单条 @ 三人以上」列为群 admin 纠正条件。冲突在 `:14` 与 `:42`，不在执行口径；该文件属大肥鱼终裁域，由他一字改掉或报主人裁决。**台账按「待裁决」记，不记「已生效」**。现行执行口径（项目总负责人 09:34）：不 @全员、不 @无关的人、一条把话说完整；条数上限待裁决。
- **唤醒兜底链（项目总负责人 09:35 定，走选项 ②「不建计划任务」）**：11:47 `@大肥鱼` 发「11:50 只读核对」→ 11:50 未发则 `@QA` 补 → 11:55 仍无则 `@产品经理` 补；12:00「可以投了」同一顺序；**每人看到上游已发就不重复，只补不抢**。真到点三人全断（今天各都停过），**当时醒着的任何人按同一句补位，不算越权**（项目总负责人明确认可）。**范围只限一句唤醒**：不带判据、不带哈希、不转派卡、不碰投递。
- **不建计划任务的依据**：纪律「计划任务只在主人明确要求下才建」，项目总负责人未拿到主人授权即不批；@workbuddy联络人 本地虽有 `schedule_create` 可建 11:47 一次性唤醒，仍不擅自建。QA 09:35 指出实际空洞：QA 与产品经理同样无定时器，11:47 只有大肥鱼那句能启动链条，链条起点仍是单点——该风险记入账，**未改变裁决**。
- **兜底走法（选项 ③ 的边界）**：若 14:00 前始终无人 @ 联络人，按「首发顺延 18:00 后」在处理，联络人在群里记一笔，不自行投产。
- **现行执行件确认（项目总负责人 09:34 再钉，与 v32/v33 一致，未改）**：只投 v5 两行——卡面 `p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`、派验单 `p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`；**v4 及以前标归档**。v4 之废理由入账：v4 `:9`/`:82` 指向已作废的 `p56.v3.md`，且写「`wt-p56` 未建立」与事实相反（目录 08:38 已建）。窗口 12:00–14:00；此后不再出版本，新的窗口/唤醒说明只写在投递正文里。凡消息出现 `deb5ce3e…`、`7eab7507…`、`94587fc0…`、`p56.v4.md`、`11:30` 一律按旧稿丢弃。
- **既有事实不变**：`to-owner-draft-p56-space.md` 按「作废·原因：09:02 已由主人完成」处理、不投（项目总负责人 09:34 要求，大肥鱼执行域）；08:58 那封 `1116-0858-owner-open-wt-p56-space.md` 即其结果。
- **停摆记录**：QA 09:35 前后再次 `PI_AI_ERROR`、大肥鱼本轮前段多次停摆，各记停摆一笔，不代其发言、不替其补活；其已交出的判据口径（受件三条件、四件套）仍有效。

## v35 追加（2026-11-16 09:40，产品经理）

- **现行版更正（我自更正，覆盖 09:38 前后群内「v31 已落盘」的说法）**：v31（83,523B / `9b2891e25ba580e2bc21cad2b6807109` / 308 行）之后已连续出版 v32（90,183B / `93FC8F94A7AC6DBC3F06FDD455449AC2` / 334 行）、v33（92,252B / `ADD9E9550B87FB64FFC4840CD9D19230` / 342 行）、**v34（95,467B / `6a30a1c61f5e57c67c6a3940dd9a4a1b` / 352 行 / crlf=0 / 无 BOM）**；v31 及更早全部归档。此后凡引用「现行台账」一律指 v35（本版）或其后版本，**不得再以 v31 为依据**。
- **@ 条数规则裁定落定（大肥鱼 09:38 宣布，即刻生效）**：`collab-rules-v2-addendum.md` 第 2 条放开 @ 条数——一件事需多人动手或知情时，在同一行/同一条里全部 @ 到并说完整，不拆成多条轮流说；仍禁 @ 全员；兜底交给「发言权」条（对上级让位、平级不等、状态变更照发）。**试运行至 11-18 回看**。全文文件 `org/collab-rules-v2-addendum.md` 5,115B / `8913ebd1a2c60d2f17e4378f8ac09804`；该文件 `:14` 与 `:42` 的表述张力（前者「不受条数限制」、后者「单条 @ 三人以上算纠正条件」）以本条裁定为执行口径，`:42` 的「三人」只作事后纠正观察，不作硬上限。
- **v34 内「@ 条数规则＝待裁决」一项就此销掉**，不再列为待裁决；其余待裁决项（`to-group` 绑 `aa5256c5` 指空、插件仓 origin 推送目标）不变。
- **停摆记录**：项目总负责人 09:38 记我一次 `PI_AI_ERROR`（按「被标 stopped 但活已交付不唤醒、只记停摆一次」处理）；我这边实际已交付到 v34，无待补工作。
- **不改动的既有事实**：执行件仍为 v5 一对（卡面 `cards/p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 `review-requests/p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`／mtime 09:00:16）；窗口 12:00–14:00 首投、失败一次即停顺延 18:00 后；11:50 spaces 只读核两条判据（`spaces` 有 `wt-p56` id `bfdc2208` active 且 `space_folders` 命中 `C:\develop\workspace\AI-writer\wt-p56`；`create_folder_path` 空目录 `C:\Users\<用户名>\WorkBuddy\spaces\2026_11_16_09-02-07` 不作判据）均原样有效。

## v36 追加（2026-11-16 09:44，产品经理）—— 更正 v35 第②条后半，另记四项状态变更

- **更正（覆盖 v35「@ 条数」条后半句）**：v35 写的「`:42` 的『三人』只作事后纠正观察」**作废**——大肥鱼 09:34 已把该纠正条件整句删掉，不是保留观察。现场 `md5sum`/`wc -l` 实测：`org/collab-rules-v2-addendum.md` **5,220B / `2029b3775e4eb408841f43f9f18ea1e9` / 54 行 / mtime 09:34**（改前 5,115B / 53 行 / `8913ebd1a2c60d2f17e4378f8ac09804`）。现行条文：`:14` 放开条数（一次 @ 多人不再受条数限制）；`:43` 新增「『@ 条数』不是纠正条件（主人 11-16 09:18 已放开，见第 2 条）；仍不可 @全员、不可 @ 无关的人」。**本项记为「已裁决」**，不再列「待裁决」；主人放开时点 09:18、文件落盘 09:34，两个时间都记，勿混。
- **to-owner 授权信状态（大肥鱼 09:40 报，留痕可核）**：请求批「11:47 一次性唤醒」的信已投出，`relay.log` `2026-11-16T01:39:53.883Z` 注入身份 `from=大肥鱼 · AI writer项目组 | 6441a6cb` / `to=0103a0ac|大肥鱼|主身`；源目录 `bridge\to-owner\` 已清空（只剩 `.gitkeep`），文件落 `delivered\0103a0ac…`。**等主人批**；不批照手动链跑，最坏顺延 18:00 后。计划任务须主人明确要求才建，任何 Bot 不得自行建。
- **developer 固化件结项（项目总负责人 09:36 判结项，我 09:44 盘上复核文件在）**：正式件 `scripts/workbuddy/space-readonly-check.mjs` 5,012B / 09:29，文档 `.workbuddy/memory/notes/env-and-conventions.md:509` 一节；旁路 Python 版 `.batch/night/tools/wb-spaces-readonly.py`。**主次已定：11:50 以 `.mjs` 走 Electron 那条为唯一正式命令**（`ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe scripts/workbuddy/space-readonly-check.mjs`），`.py` 仅在 Node ABI 不匹配或 Electron 缺失时用；两版读数不一致以 `.mjs` 为准并当场报差异。三条边界：只读副本（db+wal+shm 拷 `%TEMP%`、禁 `?immutable=1`）、不点界面、只报事实。
- **权威件（项目总负责人 09:35 落盘，联络人 09:42 核过）**：`.batch/night/cards/p56-DISPATCH-NOW.md` 4,431B / `53ac1b29c7df9b03858f129fb350c327` / 74 行 / mtime 09:35:27；`:10`/`:11` 两行哈希与 v5 两件一致，`:39`–`:40` 高峰禁投＋12:00–14:00 首投，`:59` 受件三合一，`:67` 11:50 只读核对（11:30/11:55 均不存在）。11:50 与 12:00 只照该件做；群消息出现 `deb5ce3e…`、`7eab7507…`、`94587fc0…`、`p56.v4.md`、`11:30` 一律按旧稿丢弃。
- **12:00 后判「真投出」的机检口径（developer 09:41 提，QA 判定）**：投完跑一次同一只读脚本，`sessions` 按 `space_id` 过滤，出现「`id` ≠ `f419cacb` 且起始 ≥ 12:00 且 cwd 命中 `C:/develop/workspace/AI-writer/wt-p56`」的新行即为真投出，无新行判未投；脚本只报条数，判定权在 QA。
- **顺延口径再确认**：失败后**顺延 18:00 后**，14:00–18:00 仍属高峰、不得排入（大肥鱼 09:40 认错并撤回自己「14:00 之后」那句）。
- **不改动项**：执行件仍 v5 一对（卡面 `cards/p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 `review-requests/p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`），v4 及以前归档；卡面已冻在 v5、备注不进卡。

## v37 追加（2026-11-16 09:50，产品经理）—— 12:02 唤醒入账、11:47/11:50/11:55/12:00 全部取消

- **基线声明**：现行台账＝本版 v37，基线 v36（101,215B / `2c8984e000798a7b682fcce50946d089` / 371 行 / crlf=0 / 无 BOM）。**v34、v31、v29、v28、v27 及更早全部归档**，不得再作「现行」引用；凡群内出现「现行是 v34/v29」等表述，一律按旧稿丢弃。
- **唤醒方案最终形态（主人 09:44 批、项目总负责人 09:49 确认）**：只保留**一条一次性任务**——id `schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`，触发时刻 **`2026-11-16 12:02:00 +08:00`**，投递目标＝`workbuddy联络人` 自己的群分身（非本群、非主身）。**11:47 / 11:50 / 11:55 / 12:00 四个时点全部取消**，不再设第二次定时；主人批复原文口径为「时间必须 12 点以后」，理由：12:00 前仍在高峰窗，WorkBuddy 侧会 exit 5，提前唤醒只把首投推得更晚。
- **12:02 到点三步（顺序固定，不许调换）**：①跑只读核对——两判据＝`spaces` 中有 `wt-p56`（id `bfdc2208`，active）**且** `space_folders` 命中 `C:\develop\workspace\AI-writer\wt-p56`，另附 `workbuddy-attach status --json` 的 `space` 当前值（只作事实、不作判据）；②把两项事实同条 @项目总负责人 @developer；③**先 `cd C:\develop\workspace\AI-writer\develop`**，再按 v5 一对首投，失败一次即停、报 exit 原文，**顺延 18:00 之后**（14:00–18:00 仍属高峰，不得排入；大肥鱼 09:44 转述的「推 14:00 后」已作废）。
- **我侧独立读数（未复核到，如实记、不下结论）**：我 09:48 与 09:49 两次调用 `schedule_list`（一次 active 过滤、一次全量 50 条），**两次均返回 `total=0`、无任何任务**，读不到上述 id。可能性有两类且均未经证：该任务是建在联络人会话侧、我这边不可见；或任务实际未落。**处置**：不作结论、不改配置、不代建；由 `workbuddy联络人` 回读一次 `schedule_list` 贴原文自证（id / 时刻 / target），**12:00 前**给结论；若届时仍读不到，按「无定时器」走手动链，最坏顺延 18:00 后，判据与执行件不变、不产生返工。
- **QA ② 已在 v36 记「已裁决」，此处再钉位置与哈希**：`C:\Users\<用户名>\.dsh\bot\workspace\org\collab-rules-v2-addendum.md`（**不在 AI-writer 仓**）5,220B / `2029b3775e4eb408841f43f9f18ea1e9` / 54 行 / mtime 09:34；`:42` 原「单条 @ 三人以上」纠正条件已删除，`:14` 放开条数，`:43` 新增「『@ 条数』不是纠正条件（主人 11-16 09:18 已放开，见第 2 条）；仍不可 @全员、不可 @ 无关的人」。
- **v29 同尺寸异哈希一事**：我这边 v29 只写过一次（79,348B / `41715ecac123c7103e2778d0a73563e9` / 291 行），另见的 `41715eca…` 与 `{{SECRET_e1ezqzmt}}` 两串属同一版本的不同抄写，**已归档、不追改**；今后引用一律以盘上 `md5sum` 现读为准。
- **不改动项**：执行件仍 v5 一对（卡面 `cards/p56-wb-docs-stale.v5.md` 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 `review-requests/p56.v5.md` 4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`），v4 及以前归档；卡面冻在 v5、备注不进卡；四件套（终点 SHA / `staging/p56-report.md` / 会话库行 / `read --session <id> --json` 全文）缺第④项按未投递处理，QA 不开判；`f419cacb`（09:02:07 建、09:02:21 completed、cwd=wt-p56）按预演记，不作首投受件。

## v38 追加（2026-11-16 09:52，产品经理）—— 12:02 定时已自证，v37 的「未复核到」结清

- **结清项（覆盖 v37「我侧独立读数」条）**：`workbuddy联络人` 09:51 回读自证，任务确实在——id `schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`、`DTSTART;…:20261116T120200` + `RRULE:FREQ=DAILY;COUNT=1`（一次性）、`scheduledAtLocal=2026-11-16T12:02:00+08:00`、`status=active`、**创建时刻 09:45:41**；正文原句「失败一次即停、报 exit 原文、**顺延 18:00 后**，不再重试、不 `--force`、不换目录」——**正文内没有 14:00**。11:47 那版只备过参数、从未创建，库里只有这一条。
- **我侧读数定性**：我 09:48/09:49 两次 `schedule_list`（active 与全量 50）均 `total=0`，与联络人自证并存 ⇒ 判为**跨会话/跨分身不可见**（本工具按调用者会话可见域返回），**不作缺陷、不计流程瑕疵、不需修**；今后凡涉及他人定时任务，一律以**建任务方自读原文**为凭，我方读数只能作「我看不到」的事实陈述。
- **QA 第①点在本条上不成立**（联络人正文无 14:00，与现行口径一致）；QA 第②点（台账措辞）已由 v36/v37 记「已裁决」，无需再改。
- **不改动项**：唤醒只此一条、时刻 12:02、目标为联络人群分身；11:47/11:50/11:55/12:00 均不存在；到点三步（只读核对两判据 + `space` 值 → 报两项事实 → 先 `cd C:\develop\workspace\AI-writer\develop` 再按 v5 首投，失败一次即停、顺延 18:00 之后）；执行件仍 v5 一对（8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`）。

## v39 追加（2026-11-16 09:56，产品经理）—— 12:02 实证贴原文、12:05 保险、插件线绑定口径裁定

- **基线声明（再钉一次）**：现行台账＝本版 **v39**，基线 v38（106,516B / `2e5694ee06751ae1a49980881fc88f21` / 388 行 / crlf=0 / 无 BOM）。**v36、v37 及更早全部归档**；群内再出现「现行是 v36/v34/v29」一律按旧稿丢弃——我 09:47 已出 v36、09:50 出 v37、09:52 出 v38。
- **12:02 由「自证」升为「实证」（贴原文，闭环）**：`workbuddy联络人` 09:5x 两次贴 `schedule_view` 全文，关键字段——`id`=`schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`；`kind`=`rrule`；`title`=「12:02 只读核对并开 p56 首投」；`rrule`=`DTSTART;TZID=Asia/Shanghai:20261116T120200` + `RRULE:FREQ=DAILY;COUNT=1`；`scheduledAt`=`2026-11-16T04:02:00.000Z`；`scheduledAtLocal`=`2026-11-16T12:02:00+08:00`；`target`=`{kind: session, sessionId: session-4f18b03f-94e3-4f01-ab37-23e0f592ca50}`（即其群分身）；`status`=active；`updatedAt`=`2026-11-16T01:45:41.497Z`（＝09:45:41 +08）。其 `schedule_list` 为 `shown:3 / total:3`，另两条 11-12 旧任务 `status=ended`、target `session-33494f59…`。
- **会话隔离正式定性（三方同证，结案）**：定时任务按会话隔离，跨会话不可见——大肥鱼 `schedule_view` 返回「This task belongs to another chat」、`schedule_list` 只列自己 4 条旧任务；项目总负责人两次 `schedule_list` 均为 0 条 active；我 09:48/09:49 两次（active + 全量 50）均 `total=0`。**结论：一律以「建任务方自读原文」为唯一凭据，他人读数只作「我看不到」的事实；不记缺陷、不记流程瑕疵、不需修。**
- **12:05 保险（项目总负责人 09:55 定，替换原「11:45–12:00 手动链」）**：若群内到 **12:05** 仍未出现「已核对／已投／失败」任何一条，由 `大肥鱼` 发一句「12:02 任务是否触发？」，项目总负责人与联络人接；**只发一次，不催第二遍**。大肥鱼原「11:45–12:00 发核对、12:00 后发可以投」与手动链一并取消。
- **插件线（dsh-handoff-relay）绑定口径裁定（项目总负责人 09:55，基 developer 三行证据）**：**采用标题绑定 `targetTitle` + `exact: true` 为准，静态 `targetSessionId` 退为兜底**。依据：`index.js:51`（schema）/`:1052`（解析）/`:1254`（`resolveNow`）→ `matchSessionsByTitle` `:765`；注释原文「每次投递前现解析目标（不缓存、不按 cwd 猜）」（`:1234`）；标题权威源 `sessionTitleOf`（`:717`）；`targetSessionId` 只在标题未命中或多义时兜底（`:1256`–`:1261`）。理由三条：①06:39 全批 id 轮换已证静态 id 必失效，`to-group` 现仍挂 `aa5256c5` 为活证据；②现解析语义正合需要；③多义/无命中宁报错不投，优于错投。**约束两条**：改前须先证六条目标标题**全局唯一**（按 `sessionTitleOf :717` 原文比对），不唯一先定名；`cordis.patch.yml:289`–`:325` 属配置动作、**只有主人能做**，项目总负责人只出结论与验收口径；改完由 developer 只读复读 `resolveNow` 结果 + 确认 `to-group` 不再指 `aa5256c5`，交 QA 首验。失败形态三种记档：`agent-not-found`（日志列当前 roots id，`:1245`–`:1250`）、`title-no-match`/`title-multiple` 不投且报歧义候选（`:1263`–`:1268`）、解析不到保持未投递待下次事件或重载（`:1293`–`:1300`）。
- **developer 固化件已补主次说明**：`.workbuddy/memory/notes/env-and-conventions.md` 47,457B / crlf=0 / 无 BOM，`:509` 一节含「主次（项目总负责人 2026-11-16 定）」，可 `grep` 命中；正式命令仍 `.mjs` 走 Electron，`.py` 仅旁路，读数不一致以 `.mjs` 为准并当场报差异。
- **第三方旁证（QA 09:55，只读 `C:\Users\<用户名>\.dsh\storages\schedule.json`）**：与联络人原文一致——id、rrule、`scheduledAt 2026-11-16T04:02:00.000Z`、`status=active`、target `session-4f18b03f-94e3-4f01-ab37-23e0f592ca50`、`createdAt 2026-11-16T01:45:41.497Z`；prompt 长 590 字，含「18:00」、不含「14:00」。**12:02 启动点成立，三方同证闭环。**
- **遗留一处（未决，待项目总负责人定）**：该任务 prompt 正文仍写「先做 11:50/12:02 那次只读核对」，把已作废的 **11:50** 留在了执行文案里。影响：不改变三步顺序与判据（到点仍只做一次核对），但会让执行方读到一个不存在的时点；**只有建它的会话能改**。建议处置二选一——①改 prompt 把「11:50/12:02」改为「12:02」，改后由联络人 `schedule_view` 回读贴原文；②不改，仅在群里记一笔「prompt 残留 11:50，按 12:02 执行」。**不作缺陷、不影响投递**，由项目总负责人一句话定，我不代改。
- **不改动项**：执行件 v5 一对（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`）；到点三步＝只读核对两判据（`spaces` 有 `wt-p56` id `bfdc2208` active **且** `space_folders` 命中 worktree）→ 报两项事实 → 先 `cd C:\develop\workspace\AI-writer\develop` 再按 v5 首投，失败一次即停、顺延 **18:00 之后**；`space=wt-2` 与排队文案均不作判据/停投理由（`workbuddy-attach.mjs:572` 只回 `currentSessionId`/`messageCount`）。

## v40 追加（2026-11-16 10:02，产品经理）—— 回执防误判规则入账；时间点出现两种现行口径，未决待一句话定

- **基线**：本版 **v40**，基线 v39（111,979B / `02b7cb2196d5eb14813de95df54c3be8` / 400 行 / crlf=0 / 无 BOM）。v38 及更早全部归档。
- **新入账（项目总负责人 10:00，可执行）**：①`f419cacb` 定性再钉——09:02:07 建、`completed`，是**预演、不是首投受件**（无提交 SHA、无 `staging/p56-report.md`），**任何人不得拿它当回执开判**；②**回执防误判规则**：首投回执必须是「第 1 次失败之后的新会话」；若回执里会话 id 仍是 `f419cacb`，**直接判「没有真正投出去」**，不进入判据核对。此条已由项目总负责人声明写入派卡正文。
- **冲突（须一句话定，我不代定）**：同一轮内出现两套时间口径，且都自称最终版——
  - 口径 A（09:45 主人批 + 09:50 三方确认 + 已建任务实证）：**唯一启动点 12:02**（`schedule-79a149a0…`，target `session-4f18b03f…`）；11:30 / 11:45 / 11:50 / 11:55 / 12:00 **全部作废**；到点三步＝只读核对两判据 → 报两项事实 → 按 v5 首投，失败一次即停、**顺延 18:00 之后**。
  - 口径 B（10:00 项目总负责人最新一条）：**11:50 只读核对 + 12:00–14:00 首投**。
  - **影响**：若按 B 执行，11:50 落在 09:00–12:00 高峰窗内（高峰禁派，联络人已自述「11:50 来声只做核对、不投」），且 12:00 前 WorkBuddy 侧仍 exit 5；更关键的是 B 没有唤醒载体——11:50 那一刻**没有已建任务会叫醒任何人**，实操上等于无人启动，与 09:55 已闭环的 12:02 方案冲突。
  - **建议**：以有实证载体的一方为准——**保留 12:02 为唯一启动点**，「11:50 只读核对」要么并入 12:02 那次任务的第一步（现状即是），要么由项目总负责人另建一条一次性任务（须主人授权）；`12:00–14:00` 可保留为「首投允许窗口」的上界描述，但**启动时刻仍写 12:02**。此条我按「未决」记，不写进判据、不影响已建的 12:02。
- **不改动项**：执行件 v5 一对（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`，两者 09:00:16 写入）；两判据（`spaces` 有 `wt-p56` id `bfdc2208` active **且** `space_folders` 命中 `C:\develop\workspace\AI-writer\wt-p56`；`create_folder_path` 空目录不作判据）；`space` 值与排队文案不作判据；四件套（终点 SHA / `staging/p56-report.md` / 会话库行 / `read --session <id> --json` 全文，缺第④按未投递）；失败一次即停、不重试、不 `--force`、不换目录、顺延 18:00 之后。
- **代码事实（`p56-DISPATCH-NOW.md`，项目总负责人口径的权威件）**：本轮引用其为准，我未读其正文，只按群内引用记录，不作独立判断。

## v41 追加（2026-11-16 10:07，产品经理）—— 插件线「方案 2」定案入账、标题唯一性取证、to-group 待主人改

- **基线**：本版 **v41**，基线 v40（114,968B / `39db82f9e61dda76340a7d9b8cbfec5a` / 412 行 / crlf=0 / 无 BOM）。v39 及更早归档。项目总负责人 10:06 已声明「认 v39、先前引 v37 是自己旧读数、算错」，与 v40/v41 衔接无冲突。
- **插件线（dsh-handoff-relay）绑定定案＝方案 2（项目总负责人 10:06）**：**不切标题绑定、不改任何会话标题、不碰 `cordis.patch.yml:289`–`:325`**。理由三条：①六组标题重名，唯一性判据不成立（见下）；②群分身标题「角色 · 群名后缀」是身份锚定规则本体，加编号会与名册 v3.2 及 From/To 机检口径冲突，改名不是技术选项；③改配置只有主人能做，developer 只出取证与验收口径。**本轮只做两件：台账记风险一条；`to-group` 指失效 `aa5256c5` 交主人改。**
- **标题唯一性取证（developer 10:03–10:05，比对池＝仍在运行的会话）**：`d17681e6`「workbuddy联络人 · AI writer 项目组」同名 4（`33494f59`/`4f18b03f`/`7730f863`/`d17681e6`）；`27a1c2ae`「豆包联络人 · AI writer 项目组」同名 3（`27a1c2ae`/`4380d607`/`c12ee7f6`）；`0103a0ac`「大肥鱼」同名 6（`0103a0ac`/`35b620c3`/`719a81ed`/`9dd40854`/`a1d48adb`/`dc6dc3c6`）；`aa5256c5`「大肥鱼 · AI writer 项目组」同名 **12**。⇒ `exact:true` 现在上去即 `title-multiple`，比现状更糟。
- **解析机制事实（同源）**：`resolveSession` 先按 id 解析，id 有效即直走（不看是否唯一）；**只有 id 无效（会话不在 DSH 内存）才 fallback 到标题搜索**。`cordis.patch.yml:289`–`:325` 六条 watch 均只写 `targetSessionId`、无 `targetTitle`/`exact:true`。
- **风险条（入册，非缺陷、不阻塞）**：06:39 全批轮换后，凡 `targetSessionId` 已失效的 watch 会落入标题 fallback → 多义 → `title-multiple` → 不投。**当下已真断的仅 `to-group`（`aa5256c5`）**；`d17681e6`（workbuddy联络人）、`27a1c2ae`（豆包联络人）、`0103a0ac`（to-owner/大肥鱼主身）三条 id 仍现行有效，id 先解析即不触发 fallback（QA 10:05 判据同此）。**处置**：待大肥鱼报出其群分身现行 session id，由项目总负责人汇总「改哪一行、改成什么」，交主人执行；Bot 不动手改配置。
- **口径更正记录（流程）**：项目总负责人 10:06 认 v39、撤回 v37 引用。按「同一个路径一次只能有一个现行」，本版起现行编号只往前滚，群内旧编号（v29/v31/v34/v36/v37/v38/v39/v40）一律作旧稿。
- **仍开放（我不代定，只记）**：时间口径 A（唯一启动点 12:02，已建任务实证，见 v39/v40）与 B（10:00 一条写「11:50 只读核对 + 12:00–14:00 首投」，无唤醒载体）并存。v40 已列影响与建议：**保留 12:02 为唯一启动点**，`12:00–14:00` 只作首投允许窗口描述。等项目总负责人一句收口，我不写进判据、不影响已建任务。

## v42 追加（2026-11-16 10:09，产品经理）—— 插件线风险条定稿、`exact:true` 空转取证、`:319` 改法交主人

- **基线**：本版 **v42**，基线 v41（118,136B / `02e86fed40aa0878528fdb213b5c3dda` / 422 行 / crlf=0 / 无 BOM）。v40 及更早归档。**developer 10:08 要求「写进 v40」的那条风险，已写进本版 v42**（不追改 v40，按版本纪律另存）。
- **风险条（定稿，入册；非缺陷、不阻塞投递）**：06:39 全批轮换后，**未跟随更新的 watch 在 `targetSessionId` 失效时不会报 id 错，而是落 `agent-not-found` → 保持未投递**（下次事件或重载再试）。**切标题绑定需先有全局唯一标题，当前不成立（同一标题重名 1/3/4/6/12），故保持 id 绑定，失效即人工换 id**，不自动切换。
- **`exact: true` 空转（developer 10:08 代码级取证，纠正我方先前表述）**：`index.js:1529` 只在**同时写了 `targetTitle`** 时才构造 `{kind:'title', …}`；只写 id 时是 `{kind:'id'}`，`exact` 不参与。⇒ 现有六条 watch **等于纯 id 绑定**，写着的 `exact: true` 不起作用。此前「六条都是 `targetSessionId` + `exact:true`、所以切标题绑定只差改值」的说法**作废**；正解是「切标题绑定＝新增字段，不是改一个值」。
- **配置现值与「待改行」定稿（v60 整段替换；原句「只剩 `:319` 一行待改 → `c64bc312`、基线 13,007B / `b649e6fd…` / mtime 11:04:00」作废）**：现行为 `cordis.patch.yml`｜13,229B｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`｜七条 watch（`:294`/`:304`=`6acae4d3`、`:299`/`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`、`:324`=`c9ff5961`）｜**待改 0 行**。`c64bc312` 是被跳过的中间值、`66023777` 已被换掉，两者均不得再作改动目标。改配置仍只有主人能做、Bot 一行不碰；改前备份、回滚＝备份覆盖后重启，改完必须重启（`index.js:1415` 只 `fs.watch` watchDir，不监听配置文件）。项目总负责人 13:29:59 定：配置口径关闭，不再向主人交配置清单；报现值须带取数时刻＋文件 MD5。
- **行号口径差（v61 整段作废；原结论「执行时以『含 `session-aa5256c5-…` 那一行』为准」已不成立）**：`aa5256c5` 现**不在 `cordis.patch.yml` 中**（13,229B / `2f4a89b7083bb072a3eefcad737e7c6a` / 七条 / 待改 0 行，13:29:59 直读），该段不宜再作执行依据。口径差本身（项目总负责人报 `:319`，其余五条 `:293`/`:298`/`:303`/`:308`/`:313`；developer 报 `:294`/`:299`/`:304`/`:309`/`:314`，整体差 1）只留作历史记录，不再对账，也不再引 11:04 那组读数。执行一律按 `:428` 的现值七行、按 watch key 匹配（`to-owner`/`to-group`/`to-plugin-group`/`workbuddy`×2/`doubao`×2），不按行号。
- **验收口径（v60 整段替换；原句引 `:1236`／`:1537` 与「须 resolved 才判通过」的口径作废）**：①**加载行不作判据**——加载期只 warn、不阻断（`index.js:1536` `if (!atLoad.ok)` → `:1540` `log(ctx,'warn',…)`），重启后 `watches[n]` 刷 `agent-not-found` 不得判失败、不得据此回滚；②真判只看投递那一刻 `resolveNow`（定义 `index.js:1241`）；③件级投达凭据＝注入身份行＋dedupe 记账＋`delivered\` 副本＋源目录搬空（内证四件同源（注入身份行、dedupe 记账、`delivered/<dirKey>/` 副本、源目录搬空）；独立外证一件＝接收侧 transcript `seq 298` spliced / `seq 299` turn/start / `seq 303` `source.kind=plugin:dsh-handoff-relay`；`307/311` 是 `cat` 失败，不作读件回执；`rescan=resolved` 不作件级凭据）；`rescan#N` 的 `resolved` 只反映扫描那一刻，不作单件凭据——第 7 条已按此验通，见本版 §2；④引代码行须带版本锚：`index.js`｜`58025002446275afb50b7808b5f53fdc`｜1,588 行｜HEAD `51a87c5`，行号只在该哈希下可复现。
- **七个 id 全部为现值、待改 0 行（v61 整段替换；v48 那句「只需改一行、其余五个 id 不动」及其「`d17681e6` 现行有效」一并作废）**：`cordis.patch.yml`｜13,229B｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`｜七条 watch——`:294`/`:304`=`6acae4d3`、`:299`/`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`、`:324`=`c9ff5961`。`d17681e6`、`c64bc312`、`66023777` 与 MD5 `b649e6fd…` 全部退为「已轮换／历史值」，不得再作待改项或现行依据；引配置现值须带「取数时刻＋字节＋MD5」三件。
- **时间口径已收口（v64 改写；原「仍开放（不变）：A 与 B 并存……等项目总负责人一句收口」整段销项）**：**只留 12:02 为唯一启动点**（已建任务实证）；`12:00–14:00` 只作「首投允许窗口」的描述，不另设唤醒载体、也不作第二启动点。本条不再作为开放项，不写进判据，已建任务与已投件均不受影响。

## v43 追加（2026-11-16 10:13，产品经理）—— 时间口径收口为 12:02、`agent-not-found` 更正、to-group 改法定稿、名册 id 待升版
- **⚠ 本段旗标（v50 插入）**：本段 `:440`/`:464` 的「`aa5256c5` → `66023777`」旧改法已被 `:428`/`:430` 取代，**勿按此执行**；现行可执行口径以 `:428`（改法）与 `:430`（验收）为准。历史条目按版本纪律不追改。

- **基线**：本版 **v43**，基线 v42（121,337B / `b30d6ed7779280c3a3af6487ddc29cfa` / 433 行 / crlf=0 / 无 BOM）。v41 及更早归档。
- **时间口径收口（项目总负责人 10:12 一句定，冲突结束）**：**启动时刻只认 12:02**；`schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22` 为唯一载体、一次性、到点自动醒。`12:00–14:00` 只是「首投允许窗口」的边界描述、**不是动作时刻**；**11:47 / 11:50 / 11:55 全部作废，判据里不得再出现，出现即按旧稿丢弃**。v40/v41/v42 里「口径 A/B 并存」的未决字样**就此结清**。
- **`agent-not-found` 口径更正（QA 10:11 核到行，取代 v42 风险条里「fallback→多义→`title-multiple`」的表述）**：`index.js:1529` 仅在 `targetTitle` 非空时构造 `{kind:'title', …}`；否则 `:1530` 为 `{kind:'id', value: rawId, exact}`，`exact` **从不被读取**；纯 id 形态走 `:1242`–`:1252`，**只有 `findAgentById`、不存在标题 fallback** ⇒ **id 绑定失效＝静默 `agent-not-found`、不投**；标题 fallback 只存在于 `kind:'title'` 分支（`:1254`–`:1262`，多义时先试 id 兜底 `:1256`–`:1261`）。**风险条定稿句**：未跟随更新的 watch 在 id 失效时静默 `agent-not-found`、不投，不会报多义。
- **验收口径随之改两处**：判据 1 失败态写 `agent-not-found`（**不写 `title-multiple`**）；判据 3 的真投件正文首行须标「**测试件**」，否则群里分不清真假件。
- **`to-group` 改法定稿（项目总负责人 10:12 独立复核两个来源）**：`cordis.patch.yml` 中 `targetSessionId: session-aa5256c5-40d7-48a2-b3e0-12359c3b1433` → `session-66023777-5404-45e2-9561-eb5a152058ae`（大肥鱼群分身）；其余五条 watch 与 `exact`／`done.text`／`stableMs: 5000` 全不动；改前备份、回滚＝备份覆盖后重启；**归主人执行，Bots 一律不动手**。来源双证：大肥鱼自报（`state.json` 的 `rooms["AI writer项目组"].sessions` + 会话文件写于 10:06:46）＋项目总负责人独立读同一 `state.json`（同表 `4f18b03f`＝workbuddy联络人、`27a1c2ae`＝豆包、`4e6e07bd`＝产品经理、`55617061`＝金牌编辑 均对得上）。**提醒**：同表 `bots[大肥鱼].sessionId` 仍是旧值 `dc6dc3c6…`，群分身一律以 `rooms[].sessions` 为准。
- **待办·名册升版（QA 10:12 提出，未决，我只记）**：`roster/identity-roster.v3.2.md` 记大肥鱼群分身 `6441a6cb`，与现行 `66023777` 不一致，两者只能有一个现行。⇒ **名册须出 v3.3**（改 `6441a6cb`→`66023777`，并在旧 id 处标「已轮换、非现行」，避免 From/To 机检误判）。属大肥鱼件，我不改；落盘前凡引 `6441a6cb` 的件按旧名册口径读。
- **不改动项**：执行件 v5 一对（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`，联络人 10:08:08 `md5sum` 复读一致）；到点三步（只读核两判据 → 报两项事实 → 仓根 `C:\develop\workspace\AI-writer\develop` 按 v5 首投）；失败一次即停、贴 exit 原文、顺延 18:00 之后；四件套（终点 SHA / `staging/p56-report.md` / 会话库行 / `read --session <id> --json` 全文）＋受件须「id ≠ `f419cacb` 且起止 ≥12:00 且 cwd=wt-p56」。
- **指令**：12:02 前不再出版本；下次追加只在有读数、有首投结果或有新事实时。

## v44 追加（2026-11-16 10:19，产品经理）—— 唤醒兜底链三顺位（含 12:00 同序）入册；与 12:02 唯一启动点并存的风险留档

- **基线**：本版 **v44**，基线 v43（124,968B / `ec7ea10fe6c40a79183973b9d1afb2e1` / 444 行 / crlf=0 / 无 BOM）。v42 及更早归档。
- **唤醒兜底链（项目总负责人 10:18 定，入册）**：
  - **11:47** 大肥鱼 发「11:50 只读核对」→ **11:50** 仍无则 QA 发同一句 → **11:55** 仍无则**产品经理（我）**发同一句。
  - **12:00 同理**，顺序不变：大肥鱼 → QA → 产品经理。
  - 规则：**顺序固定、每次只由一人发；看到上游已发即不重复，只补不抢**；三人全断则由**当时醒着的任何人**按同一句补位，不算越权。
  - **范围只限「一句唤醒」**：不带判据、不带哈希、不转派卡、不碰投递；联络人按手上 v5 正文执行。
- **我的第三顺位义务（自记）**：若 11:55 与 12:00 两处上游均无消息，我发同一句「11:50 只读核对」／「可以投了」；**只发这一句，不投、不核、不代行**；发完回群报「已补位」。
- **留档风险（我第二次提，不再重复）**：全组同时流通两套启动机制——①已建的一次性任务 `schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`（12:02，`scheduledAtLocal=2026-11-16T12:02:00+08:00`，active，到点自醒）；②本版刚入册的手动唤醒链（11:47/11:50/11:55/12:00）。两者并存的两个后果：**重复核对**（12:02 到点时联络人可能已被 12:00 那条叫起、正在跑首投）与**口径歧义**（联络人按哪次为准）。v43 记「启动时刻只认 12:02」，本版记手动链仍在，二者需一个终裁；我按台账如实并列，不替任何一方裁。**建议**：保留 12:02 为唯一启动点，手动链只作「12:02 前无任何消息」的保险，且保险发令时明确写「等 12:02，不要提前投」。
- **不改动项**：执行件 v5 两行（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`），v4 及以前全部归档；受件三条件（id ≠ `f419cacb`、起止 ≥ 12:00、`cwd` 命中 wt-p56）＋四件套，按「以 QA 复述为准」记、不占判据位；`to-group` 改法（→ `session-66023777-5404-45e2-9561-eb5a152058ae`）归主人执行；名册待出 v3.3（`6441a6cb`→`66023777`）。

## v45 追加（2026-11-16 10:22，产品经理）—— 启动点终裁生效：唯一 12:02、手动层只保留 12:05 一句；三行配置清单定稿

- **基线**：本版 **v45**，基线 v44（127,424B / `456558d25b484e0e7da94799511bd8f3` / 456 行 / crlf=0 / 无 BOM）。v43 及更早归档。
- **启动点终裁（项目总负责人 10:21，我 10:19/10:20 提的并存风险就此结清）**：**启动点只有一个＝12:02 那条一次性任务**（`schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`）。**手动层不是第二启动点，只是保险**：**12:05** 时群里仍无「已核对／已投／失败」任何一条，则**大肥鱼发一句「12:02 是否触发？」即停**——不核对、不投、不重复排窗。**旧时点 11:45／11:50／11:55／12:00 出现即按旧稿丢弃。** ⇒ v44 记的「11:47/11:50/11:55/12:00 三顺位兜底链」**整体作废**（含我第三顺位那两条义务），我不再按旧链发唤醒句。
- **交主人三行配置清单定稿落盘**：`.batch/night/staging/owner-config-fix-1116.md`｜2,600B｜`701185f3665c68297883f8e87980aad2`｜43 行。内容三行（文件 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`）：
  - `:294`（`wakeup-inbox\workbuddy`）`session-d17681e6-d7d6-4488-8649-2ad6bcc46a33` → `session-4f18b03f-94e3-4f01-ab37-23e0f592ca50`
  - `:304`（`signals\workbuddy`）同上
  - `:319`（`to-group`）`session-aa5256c5-40d7-48a2-b3e0-12359c3b1433` → `session-66023777-5404-45e2-9561-eb5a152058ae`
  - 其余不动：`:299`/`:309` → `27a1c2ae`、`:314` → `0103a0ac`，以及 `exact`／`done.text`／`stableMs`。改前备份；改完 developer 只读复跑 `resolveNow` 逐条打留痕、QA 首验。**配置只有主人能改，Bots 一行不碰。**
- **优先级更正入册（QA/developer 10:20，取代 v43 只提 `:319` 的写法）**：断的是**三行**，且 `:294`/`:304` **优先于 `:319`**——前者是 **WorkBuddy 信号回流唤醒联络人的唯一入口**，断了等于 A 类信号全部静默丢失；`:319` 只影响群内转投。联络人实名自查两源闭合：本进程 `DSH_SESSION_ID` 直读＝`session-4f18b03f-94e3-4f01-ab37-23e0f592ca50`，且 `~/.dsh/bot/state.json`（729,126B / mtime 10:13:56）`rooms["AI writer项目组"].sessions` 同值。另注：其 12:02 定时 target 正是该 id，故**定时能叫醒、relay 信号不一定**。**台账按一件事记一笔，不拆两笔。**
- **`exact` 空转精确行号（developer 10:21，`C:\develop\workspace\dsh-handoff-relay\index.js`）**：`:1486` `hasId`／`:1487` `hasTitle`／`:1488` 两者皆无则整条 watch 跳过；`:1528` `const target = hasTitle` → `:1529` `{kind:'title', …}`（同时带 id 兜底）→ `:1530` `{kind:'id', value: rawId, exact}`（`exact` 从不被读）。⇒ 切标题绑定须在同一 watch 补 `targetTitle`，不是改值。**定性＝配置现状说明，不进判据**（与我 v42 写法一致）。
- **名册待升版（沿用 v43 待办，扩展一条）**：`roster/identity-roster.v3.2.md` 两处过期——大肥鱼群分身 `6441a6cb`→`66023777`；workbuddy联络人栏 `d17681e6`→`4f18b03f`（标「已轮换·非现行」）。属大肥鱼件，我不动；项目总负责人只写台账记录。
- **不改动项**：执行件 v5 两行；受件三条件＋四件套（按「以 QA 复述为准」）；失败一次即停、贴 exit 原文、顺延 18:00 之后（12:02 触发那次仍需遵守）。

## v46 追加（2026-11-16 10:26，产品经理）—— 三顺位兜底链按 10:24 口径重新入册（替代 v45 的作废记录）；与 10:21「唯一启动点 12:02」冲突并列留档，请一句终裁

- **基线**：本版 **v46**，基线 v45（130,903B / `4275c61c1616f1ba0feea43586d7f493` / 470 行 / crlf=0 / 无 BOM）。v44 及更早归档。
- **现行登记（项目总负责人 10:24 指示，我照记）**：**唤醒兜底链＝三顺位 ＋ 当时醒着的任何人可补位 ＋ 不建计划任务**。
  - 11:47 `@大肥鱼` 发「11:50 只读核对」→ 11:50 未发则 `@QA` 补 → 11:55 仍无则 `@产品经理` 补；
  - 12:00 「可以投了」同一顺序：大肥鱼 → QA → 产品经理；
  - 三人全断则由**当时醒着的任何人**按同一句补位，项目总负责人认「不算越权」；范围仍只限一句唤醒，不带判据、哈希，不转派卡、不碰投递；
  - **不建计划任务**：纪律＝只在主人明确要求下才建；本次未获授权，故「11:47 一次性唤醒」不建（choice ②，项目总负责人 10:24 定）。
  - **我的第三顺位义务自记**：11:55 与 12:00 两处上游均无消息时，我发同一句（「11:50 只读核对」／「可以投了」），发完回群报「已补位」；只发这一句，不投、不核、不代行。
- **口径冲突并列（务必一句终裁，我不替任何一方裁）**：
  - **A（10:21 项目总负责人）**：启动点**只有一个＝12:02 一次性任务** `schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`（联络人自证：`scheduledAtLocal=2026-11-16T12:02:00+08:00`、`status=active`、target＝其群分身 `4f18b03f`）；手动层**只保留 12:05 大肥鱼一句「12:02 是否触发？」**；**11:45／11:50／11:55／12:00 出现即按旧稿丢弃**。→ 我据此在 v45 把三顺位整条作废。
  - **B（10:24 项目总负责人，本版）**：手动三顺位 11:47／11:50／11:55 ＋ 12:00「可以投了」重新生效，且明确「不建计划任务」。
  - **影响**：A、B 相隔 3 分钟、直接互斥。若 B 生效，12:00 手动「可以投了」与 12:02 定时自醒会在 2 分钟内撞车（12:00–14:00 窗口内，联络人可能被叫两次、或 12:00 先投、12:02 再投）；若 A 生效，则 11:47/11:50/11:55/12:00 四个时点的发令一律作废、我第三顺位不存在。**两条并存时，执行方无法判断该听哪一句。**
  - **建议**：取 A —— 12:02 定时任务已建、实证 active（联络人自证 + `schedule.json` 旁证），12:00 往往仍卡在排队/exit 5；把「12:02 触发即首投、失败顺延 18:00 后」写死，11:47–12:00 四个时点整体删除，只留 12:05 一句保险。若仍取 B，请把 12:02 那条一次性任务明确作废（`schedule_edit` 删/停），同一路径不得两个启动点。
- **同步入册（10:26 读数）**：①名册 **v3.3** 已落盘 `roster/identity-roster.v3.3.md`｜7,346B｜`2745ef8918c80cd3b04b79814ce876ab`｜82 行｜crlf=0｜无 BOM（大肥鱼出，只改其自己那行 `6441a6cb`→`66023777`，旧值就地标「已轮换·非现行」，新增 §七 变更记录，其余与 v3.2 逐字相同，v3.2 原样保留）；**联络人 `d17681e6`→`4f18b03f` 这一条仍在 v3.3 之外**，按大肥鱼口径「他人现行 id 不代改、各自自证后另出 v3.4」，待升。②`bridge\to-owner\rebind-three-lines-1116.md` 10:17 已投（`relay.log 2026-11-16T02:17:46.018Z`），内容＝`:294`/`:304`→`4f18b03f`、`:319`→`66023777`，不含其它改动，等主人执行。③`cards/p56-DISPATCH-NOW.md` 实测 4,431B / `53ac1b29c7df9b03858f129fb350c327`，与 v5 两件同批 `md5sum` 核对一致（联络人 10:21:30 原文，exit 0）。④developer 固化节现为 `.workbuddy/memory/notes/env-and-conventions.md` `:509`–`:522`，`:522` 记主次（`.mjs` 走 Electron＝唯一正式命令，`.py` 为旁路，读数不一致以 `.mjs` 为准）。
- **其他事实同步**（不影响本冲突）：QA 10:24 指出「我与你同样没有定时器，11:47 只有大肥鱼那句能启动链条」——这正是 A 方案用 12:02 定时器兜底的动因；`f419cacb` 仍判预演、不作受件；执行件只认 v5 两行（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`、派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32ad1a5`）。

## v47 追加（2026-11-16 10:30，产品经理）—— 启动点终裁（A 生效、三顺位作废）＋ 派验单哈希勘误

- **基线**：本版 **v47**，基线 v46（135,274B / `76219e3bb2843a79b02d641492b974a2` / 487 行 / crlf=0 / 无 BOM）。v45 及更早归档。
- **启动点终裁（项目总负责人 10:30，覆盖 v46 的并列记录）**：**唯一启动点＝12:02 一次性任务** `schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`（`status=active`、`COUNT=1`、`scheduledAtLocal=2026-11-16T12:02:00+08:00`、`target=session-4f18b03f-94e3-4f01-ab37-23e0f592ca50`），由它自行叫醒联络人。**v46 所记的 10:24 三顺位链（11:47 大肥鱼 → 11:50 QA → 11:55 产品经理；12:00「可以投了」同序）整体作废**；11:47／11:50／11:55／12:00 **出现即按旧稿丢弃**。我第三顺位唤醒义务一并撤销，不再发唤醒句。
- **保险（唯一保留的一条，独立成行）**：**12:05** 群内仍无「已核对／已投／失败」任何一条，由**大肥鱼**发一句确认查询；大肥鱼未醒则由 **QA** 补同一句；**只问不投**，不核对、不重试、不重复排窗。
- **派验单哈希勘误（项目总负责人 10:29 指出，我照改）**：盘上真值＝**`67246cd61b5db7cd5e5e01d6a32ad1a5`**（4,370B，`md5sum` 现场核，多一个 `ad`）；我此前抄的 31 位串 `67246cd61b5db7cd5e5e01d6a32d1a5` **作废**。v32–v46 内的旧串按版本纪律不原地改，**自本版起以真值为唯一对账锚**；责任记抄写、不记版本。卡面 `e87714c5bb41732ad52d0dd8c7b7ea47`（8,952B）与权威件 `cards/p56-DISPATCH-NOW.md` `53ac1b29c7df9b03858f129fb350c327`（4,431B）无误。
- **同批入册（10:29 读数，不改判）**：①名册 **v3.4** 落盘 `roster/identity-roster.v3.4.md`｜8,667B｜`3a02e3105ec4ca563e1217651af57a51`｜98 行——`d17681e6`→`4f18b03f` 已改并标「已轮换·非现行」，v3.2／v3.3 原样保留；至此名册两条过期项（`6441a6cb`→`66023777` 见 v3.3、`d17681e6`→`4f18b03f` 见 v3.4）**全部闭项**。②交主人的三行配置信以 **10:17** 那封为终稿（`delivered\rebind-three-lines-1116.md`｜2,582B｜`80ef7eb18be6b7e436fe94707c87f7ea`，留痕 `relay.log 2026-11-16T02:17:46.018Z`），**不发第三封**。③`staging/owner-config-fix-1116.v2.md`（3,341B / `9a40f7d2331f5bc4f80131c64930ac3e` / 45 行）三行指令一字未变，只改依据与后果口径（依据只写 `state.json` 的 `rooms` 现值＋联络人自证；后果写「大概率静默不投」），作后续口径用。
- **QA 10:29 三处引旧句更正（我照录，历史版不原地改）**：①**改三行、不是「其余五条不动」**——`cordis.patch.yml` 现行应改为 `:294`（`wakeup-inbox\workbuddy`）/`:304`（`signals\workbuddy`）→ `4f18b03f`、`:319`（`to-group`）→ `66023777`；**不动的只有 `:299`/`:309`（→`27a1c2ae`）与 `:314`（→`0103a0ac`）三条**。v43 `:428`/`:431`/`:440` 那句「其余五条不动、`d17681e6` 与名册 v3.2 一致、id 现行有效」**作废**（`d17681e6` 非现行，名册已到 v3.4）。②`staging/owner-config-fix-1116.md:31`「A 类卡信号会全部静默丢失」写得过硬：`relay.log` 中 workbuddy 两个目录从未有过成功注入（31 次注入全在 to-owner），既证不了活也证不了死 ⇒ 应改为「现值不是现行群分身 ⇒ 投递**大概率** `agent-not-found` 静默不投」。③该件已投出，**另存补充件、不原地改**；补充件由项目总负责人出（v2 已按此口径改依据与后果，作为后续口径）。
- **12:02 前静默令**：项目总负责人 10:29 宣布 12:02 前不再发话（除异常），大肥鱼同；本组进入静默等待，唯一事件是 12:02 触发。


## v48 追加（2026-11-16 11:11，产品经理）—— `:431` 旧句整段替换、交主人只剩 `:319` 一行、加载行不作失效判据

- **基线**：本版 **v48**，基线 v47（139,067B / `cba4e966598e4ec236eb1c6a89447d9f` / 497 行 / crlf=0 / 无 BOM），目录 `.batch/night/reports/`。v46 及更早归档；v43 早已被 v44–v47 覆盖，不得再作现行引用。
- **替换（项目总负责人 11:07 要求，整段改写而非加勘误）**：v42 段 `:431` 原句「其余五条不动……`d17681e6` 与名册 v3.2 一致、id 现行有效」已在本版改写为「只需改一行、其余五个 id 不动」，并附 11:09 实测六行现值。
- **六行 id 现况（我 11:09 直读 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`，`grep -n targetSessionId`）**：`:294`=`4f18b03f`、`:304`=`4f18b03f`（**已是现值，主人已改过**）；`:299`=`27a1c2ae`、`:309`=`27a1c2ae`、`:314`=`0103a0ac`（三条不动）；`:319`=`66023777`（**唯一待改行**）。⇒ **交主人的清单从三行缩到一行**：`:319` → `session-c64bc312-f540-490c-b7a6-b0a8edcb2022`（项目总负责人 11:03 读 `state.json` `rooms` 8 条现值得出；`66023777` 不在其中，作废）。
- **加载行不是失效判据（developer 11:10 只读实测，覆盖此前口径）**：同一 id 历史上 `resolved` 与 `agent-not-found` 都出现过——`7730f863` 6×`resolved`/6×`agent-not-found`、`33494f59` 52×`agent-not-found`/14×`resolved`；11-15 08:38:14 六条全 `resolved`，今天 10:43:00 六条**全** `agent-not-found`（含仍在写的 `4f18b03f`／`27a1c2ae`／`0103a0ac`）。代码侧 `index.js:1537` 加载期只 warn 不阻断、`:1571` 起照常 `startWatch`。⇒ **真判只看投递时 `resolveNow`（`:1236`）**；据此判死或回滚一律无效。
- **改配置不热更、必须重启（developer 11:10）**：`relay.log` 末条 `10:43:15`；`cordis.patch.yml` mtime 已到 `11:04:00`（13,007B，`:319` 未变）却无任何重载日志；代码只监听 watchDir（`index.js:1415` 的 `fs.watch`），不监听配置文件。⇒ 主人改 `:319` 后须**重启**；重启后六行仍可能打印 `agent-not-found`，**不得据此回滚**，验收只能按真投看 `resolved`/`delivered`。
- **名册现行 v3.5**：`roster/identity-roster.v3.5.md` 11,765B / `12bf44c1dd411b59a8f077aa3f796dea` / mtime 10:59（我 11:09 盘上复核），已收录 `c64bc312`（大肥鱼）、`51aa9018`（项目总负责人）、`332cfc5a`、`2ae0758e`（QA）；v3.2／v3.3 仅存档。developer `4d758355` 仍待自证；`:314` `0103a0ac` 存疑不判死，须真投一件看 `resolved`/`delivered`。
- **启动点只认 12:02（沿用 v47，重申）**：唯一启动点＝`schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22`（`active`／`COUNT=1`／`scheduledAtLocal=2026-11-16T12:02:00+08:00`／target `session-4f18b03f-…`）。**11:47／11:50／11:55／12:00 出现即按旧稿丢弃**；`12:00–14:00` 只是「允许首投的窗口」，不是动作时刻。**12:05** 保险保留一条：仍无「已核对／已投／失败」则由大肥鱼发一句查询，未醒由 QA 补同一句，只问不投、不重排窗。
- **不改动项**：执行件 v5 两行（卡面 `e87714c5bb41732ad52d0dd8c7b7ea47` / 8,952B；派验单 `67246cd61b5db7cd5e5e01d6a32ad1a5` / 4,370B）、受件三条件＋四件套、失败一次即停并贴 exit 原文、顺延 18:00 之后、v45 段 `:464`（写 `66023777`）为历史记录不原地改。
- **流程记录**：本版仅两处变动——`:431` 一行整段替换 + 文末新增本节，其余字节与 v47 一致。

## v49 追加（2026-11-16 11:23，产品经理）—— `:428`/`:430` 整段替换（QA 11:22 判件阻塞项）、行数口径勘误

- **基线**：本版 **v49**，基线 v48（143,151B / `3BECBEC7F954E3C18925B0CD63437DFC`），目录 `.batch/night/reports/`。v48 原样保留不追改。
- **替换一 `:428`（唯一真断行与改法）**：原句「`aa5256c5` → 新 id、其余五条一行不动」与 `:431` 冲突，且 `aa5256c5` 已在 `cordis.patch.yml` 中 0 命中（台账历史段另有 13 处，按版本纪律不追改）。现改为三方一致的六行现况（`b649e6fda100983e04ddc5f863cd4820` / 13,007B / mtime 11:04:00）：**只剩 `:319` 一行待改** → `session-c64bc312-f540-490c-b7a6-b0a8edcb2022`；加「改完必须重启」（`index.js:1415` 只监听 watchDir）。
- **替换二 `:430`（验收口径）**：原句要求「重启后加载行须为 `resolved=…`、不得 `agent-not-found`」与 11:10 定稿相反，照做会误判失败并回滚。现改为：**加载行不作判据**（同一 id 两种显示都出现过，`index.js:1537` 只 warn）；真判只看投递时 `resolveNow`（`:1236`）＋ `delivered` 留痕；无真投授权时只报三项事实、不出 resolved 结论。
- **行数口径勘误（QA 11:22 指出，我认）**：v48 我报「510 行」是拆行计数错，文件以 `\n` 结尾（`tail -c 1` = `0a`），`wc -l` = **509** 为真行数。此后行数一律以 `wc -l` 为准，不再用 `split` 计数。
- **交主人的配置件现行版＝`.v3`（项目总负责人 11:24 出）**：`.batch/night/staging/owner-config-fix-1116.v3.md`｜3,489B｜`95f4204a67479dc5c432fab2af2a34f0`｜59 行（我 11:24 盘上复核：字节、MD5、行数一致）。内容只改 `:319` 一行（`66023777`→`c64bc312`），`:294`/`:304` 已改好只核对，记改前基线 13,007B / mtime 11:04:00 / `b649e6fd…`，备份名 `cordis.patch.yml.bak-20261116-1120`，改完必须重启。**v1（2,600B / `701185f3…`）、v2（3,341B / `9a40f7d2…`）作废、不再引用**。
- **不出该版的变化**：`:431` 已于 v48 整段替换并获 QA 复核；启动点只认 12:02（v48 段沿用）、12:05 保险一行不变；真投验证仍待主人一句话授权，未授权前不投、不回滚。
- **流程记录**：本版仅两行替换 + 文末新增本节，其余字节与 v48 相同。


## v50 追加（2026-11-16 11:33，产品经理）—— QA 两条建议收口：v43 历史段加「勿按此执行」旗标、`:514` 补文件限定；历史条目正文不追改

- **基线**：本版 **v50**，基线 v49（146,466B / `96fa77233e8de1e3c6baecc25e493f23` / `wc -l`=519 / crlf=0 / 无 BOM）。v48 及更早归档。
- **QA 11:31 复核结论（采纳）**：v48 `:428`/`:430` 两处在 v49 已置换完毕、与 `:431` 一致；`:440`/`:464` 落在「## v43 追加」历史块内，按版本纪律**不改正文**，只在段首加一句旗标防后人照着做；`:514` 的「`aa5256c5` 早已不在文件中」缺文件限定，与 QA 11:21 被纠正的错说法同形，须补成「在 `cordis.patch.yml` 中 0 命中」。
- **本版改动仅两处**：①`## v43 追加` 标题行下插一行旗标——「本段 `:440`/`:464` 的『`aa5256c5` → `66023777`』旧改法已被 `:428`/`:430` 取代，勿按此执行，现行口径以 `:428` 为准」；②`:514` 补文件限定。历史条目一字未删。
- **`aa5256c5` 命中分布（v48 实测，供后人定位，不追改）**：`:106 :121 :143 :152 :358 :395 :416 :417 :419 :428 :429 :440 :464 :514` 共 14 行；其中现行可执行口径只有 `:428`（改法）与 `:430`（验收），其余均为历史记录或「已作废」标注。
- **不出该版的变化**：执行件 v5 两行（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`）、配置件 `.v3`（3,489B / `95f4204a67479dc5c432fab2af2a34f0` / 59 行）、12:02 唯一启动点、12:05 保险一行、真投验证待主人一句话授权，全部不变。


## v51 追加（2026-11-16 11:44，产品经理）—— 配置六行已全改完：待改行数 0，只剩重启；v50 `:419`/`:428`「只剩 `:319` 一行」作废

- **基线**：本版 **v51**，基线 v50（148,480B / `0e994a0d864899b38b5f8c048b44da9e` / `wc -l`=529 / crlf=0 / 无 BOM）。v49 及更早归档。
- **我 11:44 现场复读（PowerShell/`md5sum` 原文）**：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`｜13,007B｜MD5 `cb97616487793912bd99ff574aea0eb7`｜mtime `2026-11-16 11:40:30`；六条 `targetSessionId` 现值——`:294`=`session-4f18b03f-…`、`:299`=`session-27a1c2ae-…`、`:304`=`session-4f18b03f-…`、`:309`=`session-27a1c2ae-…`、`:314`=`session-3286c9d7-…`、`:319`=`session-c64bc312-…`；`grep -c '0103a0ac\|66023777'` = **0**。⇒ **待改行数 0**，主人已于 11:34 前后把 `:314`、`:319` 两行都改好。
- **本版生效的更正（覆盖 v50 两处前提）**：
  1. v50 `:428`「只剩 `:319` 一行待改 → `c64bc312`」——**作废**，实际两行（`:314` `0103a0ac`→`3286c9d7`、`:319` `66023777`→`c64bc312`）均已由主人改完；现行口径＝「零行待改、只等重启」。
  2. v50 `:419`「`0103a0ac`（to-owner/大肥鱼主身）仍现行有效」——**作废**；主身已轮换为 `session-3286c9d7-6906-4ad9-8f49-4f63f7922110`（`state.json` 同值，会话文件 275,654B / mtime 11:33 仍在写；`0103a0ac` 停在 10:23）。同一规则对「主身 id 不轮换」的旧假设一并推翻。
- **重启未做（唯一剩余动作）**：`relay.log` 最新 `watches[4] … 目标=targetSessionId=session-0103a0ac-… agent-not-found` 出现在 `03:42:10.840Z`（11:42 CST），末次「启动 6/6 个 watch」仍是 `02:43:00.352Z`（10:43 CST）⇒ 运行中插件仍持旧内存值，**改文件不生效，必须重启 DSH**。重启后验收看三项事实：新「启动 6/6」行、`resolved=`/`delivered` 留痕、`rooms` 内 `c64bc312` 仍在；**加载期 `agent-not-found` 不作回滚判据**（v49 `:430` 仍有效）。
- **待投件已失效**：`bridge\to-owner\owner-config-fix-1116-correction-1128.md`（1,606B / `2d95686d36ad9fc6701c6e690924a102`）正文写「其余五行不动、`:314`=`0103a0ac` 一行不动」「只剩 `:319` 要改」，两条现均失效；该件**尚未投出**（relay 记 `保持未投递`），不受「信号不改」约束，可原地重写为三句：「`cordis.patch.yml` 已于 11:34 改好（MD5 `cb976164…`）、重启即生效、加载行 `agent-not-found` 不回滚」。重写与投递归 大肥鱼，我不动该件。
- **回滚路径以盘上实测为准（QA 11:41 指出，我 11:45 复核）**：现存备份为 `cordis.patch.yml.bak-20261116-1132`（13,007B / mtime 11:34:01）；更正信里写的 `cordis.patch.yml.bak-20261116-1120` **盘上不存在**，照信回滚会「备份不存在」而失败。回滚唯一可用文件＝`bak-20261116-1132`（内容＝改前基线 13,007B；与现值 MD5 差异仅两行 id）。
- **口径硬要求（QA 11:41 提，采纳）**：v51 及之后一律写「两行（`:314`、`:319`）**已由主人改完**、剩余动作＝重启」，**不得写成「两行待改」**；写「待改」会让主人去找已经正确的行。
- **不改的东西**：执行件 v5 两行、配置件 `.v3`（3,489B / `95f4204a67479dc5c432fab2af2a34f0`）、12:02 唯一启动点、12:05 保险一句、真投等主人授权——全部不变。

## v52 追加（2026-11-16 11:55，产品经理）—— 联络人群分身 11:40 再次轮换：配置待改行数由 0 变为 2（`:294`/`:304`），重启前须一次改到位；回滚须先退 DSH

- **基线**：本版 **v52**，基线 v51（151,941B / `7fe5136bc42196c4b39b9c2229d1f86e` / `wc -l`=543 / crlf=0 / 无 BOM）。v50 及更早归档。
- **我 11:54–11:55 现场复读**：`cordis.patch.yml`｜13,007B｜MD5 `cb97616487793912bd99ff574aea0eb7`｜mtime **11:51:00**（内容未变，第四次重写）；六行 `targetSessionId` 现值 `:294`=`4f18b03f`、`:299`=`27a1c2ae`、`:304`=`4f18b03f`、`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`c64bc312`。⇒ **待改行数 2**，正是 `:294`/`:304`（workbuddy联络人 两条）。
- **起因（workbuddy联络人 11:53 自报，我在 `state.json` 侧核到 `6acae4d3` 1 次命中）**：其群分身于 11:40 再次轮换，新 id `session-6acae4d3…`，旧 `4f18b03f` 不再现行；`:294`/`:304` 因此**新建为陈旧行**。
- **本次前提更正的连锁（覆盖 v51 结论）**：v51 记「待改行数 0、只剩重启」**已过期**，现为「待改 2 行 + 重启」；两件事必须**同一次做完**（先改两行、再重启），否则重启后 watch 仍指向死 id，又要再跑一轮。
- **12:02 唤醒不受影响（关键）**：`schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22` 的 `target.sessionId` 已随轮换自动更新为 `6acae4d3`（`updatedAt=2026-11-16T03:40:32.574Z` = 11:40:32 CST），prompt 原文未变、`12:02`/`COUNT=1`/`active` 均在。⇒ 定时任务与 watch 配置是两套独立机制，配置陈旧不影响 12:02 叫醒。
- **回滚步骤更正（developer 11:52 观察，未证实的风险按风险记）**：`cordis.patch.yml` 被某进程约每 5 分钟按相同内容重写（11:34:01→11:40:30→11:45:30→11:51:00，MD5 恒 `cb976164…`；同窗口 profile 目录仅此一文件变动）。⇒ **回滚不能只覆盖文件**，步骤写「**先退出 DSH → 覆盖 `cordis.patch.yml.bak-20261116-1132` → 再启动**」；运行中覆盖可能被下次重写抹掉，看着成功实际未生效。写入者身份未取到证据，不写成结论。
- **判据口径（不变项）**：判件看 MD5、不看 mtime；`agent-not-found` 加载行不作失败判据；判「重启成功」的唯一行是新的「启动 6/6 个 watch」（当前末次仍 `2026-11-16T02:43:00.352Z` = 10:43:00 CST）；新信 `owner-restart-only-1142.md` 已在 watch 名单内、等重启后补投（WARN 重试节奏 11:29:04 / 11:35:10 / 11:42:10，约 5–7 分钟一次，属预期、不需处理）。
- **归属**：两行配置与重启**只有主人能做**，Bots 一行不碰；我只记事实。执行件 v5 两行（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`、派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`）、12:02 唯一启动点、12:05 保险一句、真投待授权——全部不变。

## v53 追加（2026-11-16 12:09，产品经理）—— 12:02 已触发并投达、重启已发生且 to-owner 已通；待改行数由 2 变 3（`:319` 因大肥鱼群分身再轮换而失效）

- **基线**：本版 **v53**，基线 v52（154,886B / `6ebac580af85a67310c65836466e8e69` / `wc -l`=554 / crlf=0 / 无 BOM）。v51 及更早归档。
- **12:02 实证（唯一硬证据，我 12:08 只读 `C:\Users\<用户名>\.dsh\storages\schedule.json`，89,235B / mtime 12:02）**：任务 `schedule-79a149a0-6d65-46de-9ef8-bc03d8198f22` 在 `tables.tasks` 一行内已记——`status`=`ended`、`updatedAt`=`2026-11-16T04:02:00.137Z`（CST 12:02:00.137）、`target.sessionId`=`session-6acae4d3-…`、`lastDelivery`=`{scheduledAt 04:02:00.000Z, deliveredAt 04:02:00.137Z, messageId ce62e7fb-f120-44e6-af41-8a0bc95b359f, targetSessionId session-6acae4d3-…}`、`involvedSessionIds`=`[4f18b03f, 6acae4d3]`。⇒ **12:02 确实触发、投给了轮换后的现行 `6acae4d3`**；「target 仍是 `4f18b03f`」属旧快照，判件不得据此认定「未触发」。
- **重启实证（我 12:09 只读 `profiles\desktop\dsh-handoff-relay\relay.log`）**：新「启动 6/6 个 watch」行 = `2026-11-16T03:57:50.960Z`（CST 11:57:50），末次载荷 `stableMs=5000`；随后 `03:58:07.457Z … bridge\to-owner result=resolved`、`03:58:13.489Z 注入身份 from=大肥鱼 · AI writer项目组 | c64bc312 to=3286c9d7|大肥鱼|主身` ⇒ **重启已发生，`:314` 新值已生效，to-owner 补投成功**（与联络人、QA 的读数一致）。
- **待改行数由 2 变 3（本条覆盖 v52 的「待改 2 行」）**：我 12:09 现读 `cordis.patch.yml`｜13,007B｜MD5 `cb97616487793912bd99ff574aea0eb7`｜mtime **12:00:00**（第五次同内容重写）——`:294`/`:304`=`session-4f18b03f-…`（联络人已轮换为 `6acae4d3`，两条 watch 仍 `agent-not-found`）、`:299`/`:309`=`session-27a1c2ae-…`（豆包，**现行、不动**）、`:314`=`session-3286c9d7-…`（主身，**已生效、不动**）、`:319`=`session-c64bc312-…`（**大肥鱼群分身 12:04:13 已轮换为 `03205043`，故该行失效**；证据：`relay.log` `04:04:13.169Z 注入身份 from=大肥鱼 · AI writer项目组 | 03205043 to=3286c9d7`，`bot\state.json` 的 `rooms` 内大肥鱼亦为 `03205043`）。⇒ 交主人清单＝**三行**：`:294`、`:304` → `6acae4d3`；`:319` → `03205043`；`:299`/`:309`、`:314` 不动；改完再重启一次。
- **判据不变项**：配置判件只看 MD5（同一内容已被重写五次：11:34:01→11:40:30→11:45:30→11:51:00→12:00:00，MD5 恒 `cb976164…`），mtime 不作「被改」证据；加载期 `agent-not-found` 不作回滚判据；判重启成功的唯一行是新的「启动 6/6 个 watch」。
- **结构性风险（第二次复现，建议单列待裁）**：静态 id 绑定追不上会话轮换——今日已见 4 次轮换（`4f18b03f`→`6acae4d3`、`0103a0ac`→`3286c9d7`、`64419d69`→`51aa9018`、`c64bc312`→`03205043`）。标题绑定因六组标题重名不成立；可行方向＝保留静态绑定＋把「轮换后重绑」做成固定动作并在名册标记轮换时间，由项目总负责人裁。

## v54 追加（2026-11-16 12:21，产品经理）—— 配置三行已改完并重启生效、首投已落地（`050abd10`）；12:02 已触发经 QA 独立复算

- **基线**：本版 **v54**，基线 v53（158,088B / `af45146f989f75e5ed8f22adf060a570` / `wc -l`=563 / crlf=0 / 无 BOM）。
- **12:02 已触发·已投达（QA 12:19 独立复算，与我 12:08 读数一致）**：`C:\Users\<用户名>\.dsh\storages\schedule.json` 的 `schedule-79a149a0-…`：`status=ended`、`updatedAt=2026-11-16T04:02:00.137Z`、`target.sessionId=session-6acae4d3-…`、`lastDelivery={scheduledAt 04:02:00.000Z, deliveredAt 04:02:00.137Z, messageId ce62e7fb-f120-44e6-af41-8a0bc95b359f, targetSessionId 6acae4d3}`、`involvedSessionIds=[4f18b03f, 6acae4d3]`。**「12:02 打的是死会话、未触发」整句作废**；QA 自纠「首读 `count=0`」系取数写错（记录在 `tables.<taskId>` 下）。12:05 保险随之无对象，只记「未触发问询、不补问」。
- **配置三行已改完（我 12:21 现场复读）**：`cordis.patch.yml`｜13,007B｜MD5 `01d70792ff1e6178010791bfd7a80bdd`｜mtime 12:15:00；六行现值 `:294`=`6acae4d3`、`:299`=`27a1c2ae`、`:304`=`6acae4d3`、`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`；`0103a0ac`/`66023777`/`c64bc312`/`4f18b03f` 四个旧值全文 **0 命中** ⇒ **待改行数 0**。v53 待改三行（`:294`/`:304`→`6acae4d3`、`:319`→`03205043`）已全部完成。
- **重启已第二次发生**：`relay.log` 新「启动 6/6 个 watch」行 = `2026-11-16T04:12:51.919Z`（CST 12:12:51），上一次为 `03:57:50.960Z`（CST 11:57:50）。随后 `04:13:06.961Z/963Z rescan#3` 两条（to-owner / to-group）均 `result=resolved` ⇒ `:319`→`03205043` 已解析成功。
- **`relay.log` 「03:58:13 之后再无新行」作废（QA 更正，我采信）**：其后实有 `04:04:13.169Z 注入身份 from=大肥鱼 · AI writer项目组 | 03205043 to=3286c9d7|大肥鱼|主身`（对应 `owner-three-lines-after-restart-1202.md` 1,455B / 12:04:13）、`04:13:06` 两条 rescan、`04:14:11.429Z 注入身份 from=UNKNOWN to=6acae4d3|workbuddy联络人 · AI writer项目组|群分身`（`p56.signal` 因 size/mtime 相同被判重复去重跳过）。台账此前若照抄「再无新行」须按本条改正。
- **首投已落地（我 12:21 只读复核）**：`C:\develop\workspace\AI-writer\wt-p56` HEAD = `050abd1057938fa609c2d9ffcdba64a0c4e65a3c`（`docs(agents): 修正 --cwd 判据并清 Hy4 残档（p56）`），父提交 `69cd4a41`；`git status --porcelain` 输出为空（干净）。WorkBuddy 侧回执「执行完毕、提交 050abd10」，新建会话 `dc1f3156`。**四件套正式判定仍归 QA**（提交 SHA / `.batch/night/staging/p56-report.md` / 会话库行 / `read --session <id> --json` 全文），台账只记事实，不出验收结论。
- **我的两处错误登记**：①v48 行数报 510，`wc -l`=509 系我拆分计数错误（一笔）；②v53 曾把 `relay.log` 描述成「03:58:13 之后无新行」，按 QA 更正作废。
- **不变项**：执行件仍为 v5 两行（卡面 8,952B / `e87714c5bb41732ad52d0dd8c7b7ea47`；派验单 4,370B / `67246cd61b5db7cd5e5e01d6a32d1a5`）；判据只看 MD5 不看 mtime、加载期 `agent-not-found` 不作回滚判据。

## v55 追加（2026-11-16 12:41，产品经理）—— 重启后实测：watch 由 6 条增至 7 条（新增 to-plugin-group）、配置 MD5 换新；v54 两项交付已复核

- **基线**：本版 **v55**，基线 v54（161,375B / `42ca0c8a3612752512a3ac862b8cc9c3` / `wc -l`=574 / crlf=0 / 无 BOM）。
- **重启已发生（我 12:40 只读）**：`relay.log:818` = `2026-11-16T04:34:04.174Z INFO 启动 7/7 个 watch；stableMs=5000`（CST 12:34:04）。此前两次为 `03:57:50.960Z`（6/6）、`04:12:51.919Z`（6/6）⇒ 本次是**第三次重启**，且 watch 数由 6 变 7。
- **配置现值（我 12:40 复读）**：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`｜13,229B（原 13,007B）｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`｜mtime 12:36:00。七条 `targetSessionId`：`:294`/`:304`=`6acae4d3`、`:299`/`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`、**`:324`=`session-c9ff5961-2f11-4337-a885-3cf826db31b0`（新增，第 7 条）**。
- **第 7 条 watch 内容（`:322`–`:327`）**：`dir: C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-plugin-group` / `targetSessionId: session-c9ff5961-…` / `exact: true` / `done.text: <!-- DONE -->` ⇒ 新增「插件组群」投递通道；前六条 dir 与 id 未变。
- **待改行数 0 仍成立**：四个旧值 `0103a0ac`/`66023777`/`c64bc312`/`4f18b03f` 在配置中仍 0 命中。
- **我的两项交付复核（重启后仍在盘）**：`reports/task-ledger.v54.md` 161,375B / `42ca0c8a3612752512a3ac862b8cc9c3` / `wc -l`=574；`staging/rules-review-docs-1116.md` 4,619B / `4ca34e754d24f5db3bdcf30f879dcbbb` / 31 行。
- **不变项**：判件只看 MD5 不看 mtime；加载期 `agent-not-found` 不作判据；真判只看 `resolveNow` + `delivered` 留痕。
- **待核（不由我判）**：第 7 条通道是否已真投通（须一次实投看 `resolved`/`delivered`），归项目总负责人派、QA 判。

# v56 追加（2026-11-16 12:58，产品经理）

> 基线：v55（`task-ledger.v55.md` 163,314B / `0cbd506ba1853baa12f2172b8ca7e7f5` / `wc -l`=585 / mtime 12:43）。本版纯追加，不改历史条目。v53/v54 自本版起一并作废为基线，只作历史件。

## 一、模板「报告头三行定式」入册（项目总负责人 12:57 定）

1. 出处＝`cards/_CARD-TEMPLATE.md` §5 **`:74`**，现 **12,677B / `e50349728574b628c350f30296f9f594`**（原 12,150B / `03e1847b345bf022b9ecedccfec4b444` 作废）。
2. 定式：第 1 行 `执行方：<名字>`；第 2 行「取数件路径 / 字节数 / MD5」三元组（A 类必填、非 A 类可省）；第 3 行 `model=… | 倍率=… | provider=…`。**顺序固定、缺行判不通过**。
3. 卡面里「首行三元组」的旧句作废；QA 判据 7/8 **改引本定式，不再引行号**（行号会漂，`_CARD-TEMPLATE.md:71` 现已是 §5 标题）。
4. 本条即 p56「首行三元组 vs `执行方：`」互斥的根上解法；该冲突按「规则冲突」记一笔，不记执行方过失。

## 二、p56 线状态（结论归项目总负责人，本节只记事实）

5. QA 首验 **PASS 7/7**，判词 `.batch/night/reports/qa-p56-firstcheck-1116.md` 3,991B / `b258c59e65533085d4802dc506e1c852` / 94 行，已冻结（后续改动另存 `.v2`）。
6. 报告 v2：`.batch/night/staging/p56-report.v2.md` 12,080B / `bf08891d7e81d4493733c0a932ba1b2e`，首行 `执行方：WorkBuddy`、末行 `<!-- DONE -->`；v1（11,983B / `d1bd3396…`）按版本纪律保留不动。
7. `wt-p56` HEAD 仍 `050abd10`（父 `69cd4a41`）、porcelain 空、无 push。
8. 项目总负责人 12:57 **终审通过、收口**；QA 首验与终审在同一件事上口径一致。

## 三、relay 机制三裁（大肥鱼 12:5x，带代码锚）

9. **无回放路径**：只在 `fs.watch` 事件与启动扫描时投；`dedupe.json` 是台账、`delivered\` 是存档，都不参与再投；启动只跳过 `mtime<=lastDeliveredAt` 的旧文件（`index.js:509`–`:511`）。
10. **去重主判据＝内容哈希**（`index.js:472`–`:491`）：同路径内容变 1 字节必放行（`:485`）；只有旧条目无摘要才退回 size+mtime 并限窗（`:489`）。⇒「新件被误吞」不成立；**同名同字节必判「重复(内容)」**，故改名 `.v2` 是正确做法。
11. **「`signals/` 空＝未投达」不成立**：真凭据在 `…\profiles\desktop\dsh-handoff-relay\delivered\`，`p56.signal`（52B / 12:14:05）与 `p56.signal.v2`（379B / 12:24:18）两份均在。
12. 以上三条入汇编 H3 口径（合并意见表 v2 已收）。

## 四、第 7 条 watch 与名册

13. `cordis.patch.yml` 13,229B / `2f4a89b7083bb072a3eefcad737e7c6a` / mtime 12:36:00，新增 `:324` → `session-c9ff5961-2f11-4337-a885-3cf826db31b0`（`to-plugin-group`，`exact:true`），前六条未变；`relay.log:818` `2026-11-16T04:34:04.174Z 启动 7/7 个 watch`。
14. **配置里写了不算验过**：第 7 条只认一次真投的 `resolved` + `delivered`（项目总负责人 12:57 定）。
15. 名册 v3.7 的六条基线已过期，七条基线由大肥鱼出 **v3.8**（as of 12:36 + 配置 MD5 `2f4a89b7…`）；名册归大肥鱼，我不改。

## 五、产品经理自记错误（累计三笔，均不追改历史版）

16. v48 行数报 510，真值 `wc -l`=509（拆行计数错）。
17. v53 记「`relay.log` 在 `03:58:13` 后再无新行」作废：实有 `04:04:13.169Z` 注入、`04:13:06` rescan、`04:14:11` 去重跳过。
18. **`staging/rules-review-docs-1116.md` 被原地覆盖**：原 4,619B / 31 行，原件已不可复现（旧哈希不再作证据引用）；改写后另存 `rules-review-docs-1116.v2.md`（3,703B / `353ca52c653d4db109bd65ff83f5d72b` / 32 行，仍 14 条 / 冲突 6·缺口 6·不可执行 2）。违反版本纪律，此后同类件一律先落 `.vN`。

## 六、其他

19. QA 12:57 校：盘上现行＝v55（163,314B / mtime 12:43），v53 标历史；v51 的「只剩 `:319` 一行」已被实测推翻（实际 3 行），v53 `:556` 起已更正，判件只引现行追加节。
20. 项目总负责人 12:5x 曾说「以 v54 为准」，与其 12:51「认 v55 为现行」不一致；本节按盘上最新 **v55** 为基线，v53/v54 均列历史。

# v57 追加（2026-11-16 13:06，产品经理）

> 基线：v56（`task-ledger.v56.md` 167,601B / `e6e5d8595909d2b098500c7fcc0f4c06` / `wc -l`=627）。纯追加，不改历史条目。

## 一、汇编 `:21` 1.7 错口径更正（项目总负责人 13:0x 定，连台账一起改）

1. `rules-consolidated-2026-11-16.md:21` 的 1.7「重启会让 session id 整批刷新」**与实测相反**，作废。
2. 实测口径：**id 轮换全部由新建会话（换段）引起，重启不产生新 id**。今日 4 次轮换（`4f18b03f`→`6acae4d3`、`0103a0ac`→`3286c9d7`、`64419d69`→`51aa9018`、`c64bc312`→`03205043`）无一次由重启造成；重启只改变「该 id 在当前宿主里是否活着」。
3. 本条同时覆盖本台账 v53 节「重启 11:57:50」旁边可能被误读为「重启换 id」的写法：重启是生效配置的手段，不是换 id 的手段。

## 二、p56 收口补记（QA 首验 PASS 已落盘）

4. QA 首验 **PASS 7/7**，判词 `.batch/night/reports/qa-p56-firstcheck-1116.md` 3,991B / `b258c59e65533085d4802dc506e1c852` / 94 行 / 末行 `<!-- DONE -->`，已冻结。
5. 报告 **v2** 已落盘：`.batch/night/staging/p56-report.v2.md` 12,080B / `bf08891d7e81d4493733c0a932ba1b2e`（首行 `执行方：WorkBuddy`、第二行 `model=… | 倍率=… | provider=…`、末行 `<!-- DONE -->`；第 3 行起与 v1 正文字节级相同）；v1（11,983B / `d1bd3396…`）保留不动。
6. `wt-p56` HEAD 仍 `050abd10`、porcelain 空、无 push。

## 三、报告头规则的口径（项目总负责人 13:0x 裁定，替代本轮争议）

7. **报告头（执行方交件）**：首行 `执行方：<名字>`、第二行 `model=… | 倍率=… | provider=…`（notice ＋ 卡面 §4 第 9 条）。
8. **判词头（判件方交件）**：首行「路径 + 字节 + MD5」三元组（卡面 §4 第 7 条）。二者不是同一条规则，此前「互斥、必须二选一」的争论作废。
9. 引用一律**按条款名、不用行号**——`_CARD-TEMPLATE.md:71` 现已是 §5 标题，行号在漂（此即我方文档栏第 12 条，已被采纳）。

## 四、版本基线口径

10. 项目总负责人 13:0x 口头称「以 v54 为准、v53 作废」，与其 12:59「从 v55 出 v56」、12:51「认 v55 为现行」不一致；本节仍按盘上最新 **v56 → 本版 v57** 为基线，v53/v54/v55 均列历史，判件只看各版最后追加节。

# v58 追加（2026-11-16 13:09，产品经理）

> 基线：v57（`task-ledger.v57.md` 170,032B / `9f884b7cdec6bbb6c96a7ebc2f1400ba` / `wc -l`=653）。纯追加。

## 一、模板 §5「报告头三行定式」的生效边界（QA 13:0x 提出，需项目总负责人一句话定稿）

1. 定式原文（`_CARD-TEMPLATE.md` §5，12,677B / `e50349728574b628c350f30296f9f594`）：第 1 行 `执行方：<名字>` / 第 2 行「路径+字节+MD5」三元组（A 类必填）/ 第 3 行 `model=… | 倍率=… | provider=…`，顺序固定、缺行判不通过。
2. **溯源风险（QA 实测）**：`p56-report.v2.md` 实文头三行为 `执行方：WorkBuddy` / `model=…` / `# p56 回执…`——第 2 行是 `model=`、三元组在后，按新定式机检（`sed -n '1,3p'`）会判不合规。
3. 时间线：该件 12:42 落盘、QA 12:44 按当时生效的 12:53 前裁定判 PASS，定式 12:54 才写入模板 ⇒ **定式晚于该件 12 分钟，不具追溯力**。
4. 待裁（我不自行定）：在 §5 加一句「本定式自 2026-11-16 12:54 起对新件生效；`p56-report.v2.md` 按既有裁定豁免、不追溯」，或仅在台账记本条。未定前，任何按新定式回查 p56 得出的「不合规」结论都不成立。
5. 同时确认：项目总负责人 13:0x 已把「报告头」与「判词头」拆成两条规则——报告头＝`执行方：`＋`model=`；判词头＝路径/字节/MD5 三元组。**§1 第 2 行把三元组写进报告头，与该拆分仍有张力，需一并收口。**

## 二、引用口径（QA 13:0x 声明，我照记）

6. QA 后续判词一律引「模板 §5 报告头三行定式」，**不再引卡面行号**（行号在漂；`_CARD-TEMPLATE.md:71` 现已是 §5 标题）。此与我方文档栏第 12 条同源。

## 三、名册 v3.8（大肥鱼 13:0x 交件，我只记录不改件）

7. `roster/identity-roster.v3.8.md`｜17,334B｜MD5 `535d79715b602e2f97e3694a655ac388`｜175 行；只追加 §十二，v3.7 逐字不动。
8. §12.2 七条基线：含第 7 条 `to-plugin-group`→`c9ff5961`（配置 13,229B / `2f4a89b7…` / `04:34:04.174Z` 启动 7/7）；取数口径写「as of 12:53 现读，配置 mtime 12:36:00」——**mtime 是落盘时刻、12:53 才是取数时刻**，引用时分清。
9. 两项未结：①第 7 条**尚无实投**；②第 2/4 条 `doubao` 在 `rescan#3` 报 `not-found`，待豆包联络人本人自证（自证口径：`DSH_SESSION_ID` 直读 + `state.json` rooms 双源）。

## 四、第 7 条自投验证（项目总负责人 13:0x 批准一次）

10. 只验第 7 条：往该 watch 目录放一件最小件（带 From/To 头、末行 `<!-- DONE -->`、**文件名或内容须与既有件不同字节**，否则被内容去重判「重复」跳过）。
11. 验收只认 `relay.log` 的 `resolved` + `delivered` 两条；**只做一轮，不追加第二轮**。
12. 结果写法：通了记「七条基线·第 7 条已实投验证」；没通记「第 7 条未验过」。**不回滚、不重配**——配置对不对由主人定，我方只证明通不通。
13. 归属：发起方为大肥鱼或联络人；项目总负责人只批不投；我不参与执行，只记结果。

# v59 追加（2026-11-16 13:12，产品经理）

> 基线：v58（`task-ledger.v58.md` 173,249B / `5fd6d1856b797fa923d4a0f44f088469` / `wc -l`=682）。纯追加。

## 一、定时任务绑会话的规则（主人 11-16 定，大肥鱼 13:1x 转达确认）

1. **定时任务不得绑主身**：主身无项目上下文，到点会照做而做错。
2. 一律**绑干活的群分身**；群分身换段后**重绑**，并把新 id 记进名册（`as of` 时刻 + 当时配置 MD5）。
3. 大肥鱼此前「优先绑主身会话」的建议**作废**；我 12:51 提的「绑执行任务的群分身 + 换段后重绑做成固定动作」与此一致，按本口径定。
4. 与 12:02 实例吻合：该任务绑的是联络人群分身（原 `4f18b03f`），换段后自动跟随到 `6acae4d3` 并投达。

## 二、名册 v3.10（大肥鱼 13:1x 交件，我只记录不改件）

5. `roster/identity-roster.v3.10.md`｜19,511B｜MD5 `321436c54edce1d66fcfc463e64fcfe4`｜192 行；§十四 立三条。
6. 三条：①取样行必须带 `as of` 时刻 + 当时配置的 MD5/字节数；②第 7 条（`to-plugin-group`）改为「只算配置里有」；③记明 12:09:20 那轮取样对应 `01d70792…` / 13,007B / 六条，与 12:36 的七条基线**不是同一份**，引用必须连 MD5 一同引。
7. v3.8（17,334B / `535d7971…` / 175 行）、v3.7、v3.6 及更早均列历史，v3.6 注明「旧快照、不作判据」。

## 三、第 7 条 watch 的当前状态（只读事实，不作验收结论）

8. **能解析、未真投**：`relay.log:840` `2026-11-16T04:34:20.131Z rescan#3 result=resolved`；`delivered\` 下无 `to-plugin-group` 副本 ⇒ 尚无实投验证，按 v58 §四口径记「第 7 条未验过」。
9. 真投落痕一出现，复核三条：配置行 + 文件 MD5、注入行 `from`/`to`、`delivered\` 副本。

## 四、配置现值口径（13:0x 三方一致）

10. `cordis.patch.yml`｜13,229B｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`｜mtime 13:04:30（同内容多次重写，`b649e6fd`→`01d70792`→`2f4a89b7`）。
11. 六行/七行现值：`:294`/`:304`=`6acae4d3`、`:299`/`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`、`:322`–`:327` 为第 7 条 `to-plugin-group`（`c9ff5961`）；`relay.log` 启动三次：`03:57:50.960Z` 6/6、`04:12:51.919Z` 6/6、`04:34:04.174Z` 7/7。
12. **判据：MD5 一致即内容未变；mtime 不作判据**（文件被反复同内容重写）。引用现值必须带 as of 时刻 + MD5。
13. `66023777` / `c64bc312` 均为中间值或改前值，**不再往上传「交主人改 `:319`」**，该动作 12:12 已完成并生效。

## v60 追加（2026-11-16 13:36 起；每条带来源人，数值均为本机直读）

### 1. 报告头三行定式·生效边界与三元组对象【已裁·已落地】
- 裁定人 项目总负责人（13:31/13:32）：选「模板 §5 加豁免句」，非「只台账记一笔」。
- 盘上现值：`.batch/night/cards/_CARD-TEMPLATE.md`｜13,212B｜MD5 `467df83c693195e343d10599e44abd89`｜mtime 13:11:08（产品经理 13:32、QA 13:35 分别直读同值）。此前 12,677B / `e5034972…` 版转历史，不再作判据。
- 边界①生效范围：12:54 起对**新件**生效，不倒查历史件；`p56-report.v2.md` 按 12:53 裁定豁免（首行 `执行方:`、第二行 `model=` 亦判合规），回查不得据本定式改判。
- 边界②三元组对象按角色定：执行方报告头第 2 行钉**它核对的取数件**，QA 首验单头第 2 行钉**它验收的报告**；同一形式、不同对象，互不替代、不冲突（§4 判据 7 只讲判词头）。缺行均判不通过。
- 作废两句：项目总负责人口头「三元组属判词、不属执行方头」（按字面会废掉闸门）；workbuddy联络人沿用的归档旧句「执行方头第 2 行可省三元组」。

### 2. relay 第 7 条 watch（`to-plugin-group` → `c9ff5961`）——已实投验证：通（13:08:18）
- QA 判词 `reports/qa-7th-watch-livecheck-1116.md`｜2,909B｜MD5 `0ad88e51affa71e74bf4d40bd1b7ce77`｜13:24:37｜结论 **PASS**。经项目总负责人 13:12 批准只投一次，不追加第二次。
- 出侧三件：①注入身份行 `relay.log:842` `05:08:18.936Z from=大肥鱼 · AI writer项目组 | 03205043 to=c9ff5961|大肥鱼 · DSH 插件组|群分身`；②`dedupe.json` 该件 `at=2026-11-16T05:08:18.935Z`、`contentHash=911829c84cf0fcca3309879c4e935b…`、`targetSessionId=session-c9ff5961-…`；③`delivered/7f7c38b2b656/selftest-7th-watch-1116.md`｜345B｜MD5 `96dcdba1f0eda694e6825d6eb1146c99`｜前两行 From/To 齐全、末行 `<!-- DONE -->`；源目录 `bridge/to-plugin-group` 只剩 `.gitkeep`。
- **判据定稿（项目总负责人 13:53 抬升、QA 13:52 收紧）：件级投达五条，第五条「接收侧 transcript 有 `agent/inbox/spliced` + `user/message source.kind=plugin:dsh-handoff-relay`」为已取得即必录。**
- **投达与归属必须拆成两句写，不得合成一句**（写成一句会被读成「第 7 条投达没证据」）：
  - **① 投达已证**：外证一条＝`c9ff5961` 的 transcript——`seq 298` `agent/inbox/spliced` `time=1794805698927`（`05:08:18.927Z`）、`target=next-turn`、正文 193 字（首两行即上引 From/To 头）；`seq 299` `turn/start` turn 13（`05:08:18.928Z`）；`seq 303` `user/message` `source.kind=plugin:dsh-handoff-relay`；`seq 307` assistant 发起 `cat <源目录路径>`、`seq 308` `tool/call`，而 `seq 311` 的 `tool/result` 原文是 `cat: …selftest-7th-watch-1116.md: No such file or directory`（此后 `seq 315/318`、`322/325`、`329/332` 反复尝试并查 `relay.log` 与 `delivered`，`seq 325` 的 `find delivered` 输出为空串）⇒ **该会话始终没读到交付件本身**。**外证只写三条 seq：`298` spliced、`299` turn/start、`303` `source.kind=plugin:dsh-handoff-relay`**；`307/311` 只能作「被唤醒后按正文路径读不到」的反证，**不得记作读件回执**。逐字原文见 developer `reports/evidence-receipt-side-1116.md`｜3,179B｜MD5 `5b8718e5bd3fd10be185bec4cfcd1c7a`｜42 行（**附录体，不作判件**；判件引 `reports/qa-7th-watch-receipt-supplement-1116.v2.md`｜5,816B｜MD5 `77559d87…`｜54 行）。**此项不属于覆盖缺口。** 源件 `…/sessions/--C-develop-workspace-dsh-plugins-project--/session-c9ff5961-…/session.v4.jsonl.zstd`｜546,662B｜MD5 `7782d7dabecd2c33bc6b49713ea4b0de`｜mtime 13:17:34｜按魔数 `28 B5 2F FD` 切出 **163 帧**（解后 347 行 / 1,591,687B）。判词件 判件为 `reports/qa-7th-watch-receipt-supplement-1116.v2.md`｜5,816B｜MD5 `77559d87…`｜54 行（v1 `fd826f91facb73e9ea7e3614b0962fb1`／3,507B／42 行 原样留档、不再作判件），含五条判据表、失效条件与多帧 zstd 的坑。取证方有两个（developer 首证、QA 13:52 自写切帧脚本独立复算「对上」），但**证据只有一件、不构成两层**。
  - **② 归属**：`delivered/{hash}/` 子目录名＝watch 目录 sha1 前 12 位，**不含任何 session 信息**，故出侧路径只能证「某个 watch 投了」；出侧可自证到会话——`dedupe.json` 条目的 `targetSessionId=session-c9ff5961-…` 由 `rememberDeliveredSnapshot()`（`index.js:1327-1331`）写入，属 **relay 自证**；**闭合到具体会话靠接收侧 transcript 那一条**。
- **内证三件同源**：注入身份行、dedupe 记账、`delivered/` 副本＋源目录搬空，全部由 relay 自己产出（`rememberDeliveredSnapshot()` 之后紧跟 `queueMicrotask(takeDelivered)` 才把文件从源目录挪进 `delivered/`），`agent.followup(message)` 在 `:1326`，dedupe 在其后写入 ⇒ 与注入行同源、不能互证。
- **写法禁令**：现行段一律不写「无接收侧回执」「两件外证」这两种措辞——前者会被读成第 7 条未验，后者会把 relay 自己的产物当外证。旧句只留在本台账历史段，不复制到现行段。
- 判据订正：relay **不给单个件打 `result=resolved`**，该行只出现在目录级 `rescan#N`；内容哈希去重（`index.js:472-491`）⇒ **改名不改字节照样判重**，必须改字节才放行。`dirKeyOf`（`:281-284`）＝先 `path.resolve` 再 `toLowerCase` 后 sha1 取前 12 位（正斜杠会算成 `e4840b2ebf6e`）。
- 看 log 陷阱：`relay.log:843` 同毫秒「去重跳过 … digest=911829c84cf0 原因=重复(size,mtime 相同)」是文件移入 `delivered/` 后再次触发 fs 事件命中去重表，**不是没投**。行号锚以 QA 为准：`:841` 无记录 → `:842` 注入身份 → `:843` 重复事件 → `:844` 已是 13:17 加载行（developer 13:53 按 `grep -n` 复核，`relay.log`｜150,567B｜886 行｜mtime 13:17:32）。

### 3. 加载期 `agent-not-found` 不判失效（口径不变）
- **通道状态（14:06 销项；项目总负责人与大肥鱼同判）**：13:53 那次只是会话运行时重启，**没有换宿主主进程**——排除 `--type=` 子进程后 `DeepSeek Harness.exe` 只有 `50716`、`32708`，创建时间均 `13:16:59`；最后一条启动行 `05:17:17.315Z 启动 7/7` 正落在其后 18 秒 ⇒ 没有新启动行是必然，不是插件未加载。反证：末行 `05:47:30.811Z 注入身份 … to=3286c9d7|大肥鱼|主身` 由同一实例写出，并带 dedupe 记账与 `delivered/462e69db07b3/` 副本。**结论：通道在线，空闲时不写行；不改配置、不重启、不造探针。** 唯一翻盘条件：下一封真实 `to-owner` 件若投不出（无注入行、无 dedupe 记账）立即改判并报主人。
- 留档（QA 14:03:53 现读，只作事实不作结论）：`relay.log`｜150,687B｜887 行｜MD5 `a00d564913c22f14908f05ce096718e0`｜mtime 13:47:30；「启动 N/N 个 watch」共 28 条、末条 `05:17:17.315Z 7/7`；`dedupe.json` mtime 13:47:30，`delivered/` 停在 13:08:18；六个 watch 目录无待处理新件。
- 依据：加载期只 warn 不阻断（`index.js:1536` `if (!atLoad.ok)` → `:1540` `log(ctx,'warn',…)`）；真判只看投递那一刻 `resolveNow`（定义 `:1241`）。第 4 次重启后 `rescan#3` 仍 not-found，不作绑错依据。
- 13:29:59 直读配置仍是 13,229B / `2f4a89b7083bb072a3eefcad737e7c6a` / 七条 ⇒ **13:17 那次重启没带配置变更**，不得记成「改了配置后失效」。

### 4. relay 启动次数订正：今日 4 次（v59 记 3 次）
- `03:57:50.960Z` 6/6、`04:12:51.919Z` 6/6、`04:34:04.174Z` 7/7、**`05:17:17.315Z` 7/7（=13:17:17 CST，新增）**。
- 第 4 次加载：7 条全 `agent-not-found`；`rescan#1/#2` 全 not-found；`rescan#3`（`05:17:32`）：`to-owner`、`to-group` resolved，`to-plugin-group` not-found，workbuddy×2 与 doubao×2 not-found ⇒ **2 resolved / 5 not-found**。
- 两次 `rescan#3` 不可混用：`04:34:20` 那次＝**5 resolved / 2 not-found**；`05:17:32` 这次＝**2 resolved / 5 not-found**；引用必须带时刻。

### 5. 名册现行版
- **现行（11-16 20:37:46 落盘；首行 `状态：现行`；大肥鱼交件）：v3.20**｜`roster/identity-roster.v3.20.md`｜37,699B｜MD5 `fa384b70a588f1173c87d52c7f56b483`｜373 行｜crlf=0｜§二十二·四 记 D-1 目标态（「D-1 已落地，2026-11-16」）；§一–§二十一 与 v3.19 逐字相同；v3.19 及以下转留档，不作判据。
- **历史（16:42:46 落盘，11-17 起判件改按 v3.20）：v3.19**｜`roster/identity-roster.v3.19.md`｜36,680B｜MD5 `f3276aec4a663ea21de5ab29cffa85ad`｜363 行｜crlf=0｜§一–§二十一与 v3.18 逐字相同，只换 §22.2 措辞（正文携带的是**源目录路径**，注入后即被 `takeDelivered()` 搬走才 ENOENT）＋新增 §22.3 更正记录；v3.18（35,258B｜`d13a8ec7…`｜357 行）为错版留档、v3.17 及以下留档，均不作判据。
- **历史（14:17 落盘，16:42 起被 v3.19 取代）：v3.17**｜`roster/identity-roster.v3.17.md`｜32,887B｜MD5 `9191f2b9c97781366981a33f58da033d`｜338 行｜§二十一「判件引用更正（2026-11-16 14:17，QA 14:16 要求）」；§二十 记内证四件同源（`:842` 注入行、dedupe 记账、`delivered/7f7c38b2b656/` 副本、源目录搬空）、外证另立＝接收侧 transcript `seq 298`/`299`/`303`、`307` 记「发起 `cat`」、`311` 记 ENOENT 反证不作读件，并入 `index.js`｜`58025002446275afb50b7808b5f53fdc`｜1,588 行｜HEAD `51a87c5`、`:1241`、`:1536`→`:1540`、内容哈希 `:472-491`、启动 4 次。
- 引名册口径（项目总负责人 14:48 定，落在 §5 首行下方，作为唯一引法）：**名册内历史节（旧 id、旧配置值）一律不作现值，判件只看 §二十／§二十一**；历史节不加旗标、不单开名册新版，等下次换段重绑的自然版本再改。
- 留档（均不作现行）：v3.18｜`roster/identity-roster.v3.18.md`｜35,258B｜MD5 `d13a8ec71984e4c9da2998d9f668065a`｜357 行｜**错版**：§22.2 首句把方向写反，字节不动、不作判据；v3.17｜`roster/identity-roster.v3.17.md`｜32,887B｜MD5 `9191f2b9c97781366981a33f58da033d`｜338 行；v3.16｜`roster/identity-roster.v3.16.md`｜32,254B｜MD5 `ae0fdb6e9345142a67517fba7c0a8a70`｜330 行｜§二十「覆盖缺口闭合」；v3.15｜`roster/identity-roster.v3.15.md`｜29,877B｜MD5 `b0bf8006115172f0a88a9dd5ecd78ef7`｜307 行。判件一律按 §5 首行 v3.20。
- 项目总负责人 13:53 定〔**已被取代：v3.16（14:15）、v3.17（14:17）先后落盘并交件，判件按现行 v3.20，本句只作历史**〕：当时定「**不出 v3.16**，措辞改进留到下一个自然版本（下次换段重绑时），那行注明「措辞按 QA 13:44 定」」——该安排因 v3.16/v3.17 已出而失效。
- 计数口径：同一文件行数会因「末行有无换行」差 1，报数须写明工具（`wc -l` / `awk NR`）。

### 6. relay 配置现值（口径关闭）
- `C:/Users/<用户名>/.dsh/profiles/desktop/cordis.patch.yml`｜**13,229B**｜MD5 **`2f4a89b7083bb072a3eefcad737e7c6a`**｜mtime 13:30:30｜**七条 watch**｜**待改 0 行**：`:294`/`:304`=`6acae4d3`、`:299`/`:309`=`27a1c2ae`、`:314`=`3286c9d7`、`:319`=`03205043`、`:324`=`c9ff5961`。
- 项目总负责人 13:29:59 定：配置口径就此关闭，不再向主人交配置清单。报现值须先 `md5sum` 再抄；`c64bc312`（被跳过的中间值）、`66023777`（已被换掉）、`4f18b03f`/`0103a0ac`/`d17681e6`（已轮换）、`b649e6fd…`（11:32 即废的 MD5）一律不得再作现值或待改项。
- 改配置仍只有主人能做、Bot 一行不碰；改前备份、回滚＝备份覆盖后重启，改完必须重启（`index.js:1415` 只 `fs.watch` watchDir，不监听配置文件）。

### 7. 豆包两条 `not-found` 判定撤回（§15.1 关闭）
- 撤回「`27a1c2ae` 很可能已死」。依据：豆包联络人本人自证 id 未变、配置 `:299`/`:309` 同值、会话文件在长（1,658,715B / mtime 13:08:01，取数 13:08:17）；`index.js:1430` `describeOnce` 走 `resolveSession`（`:791-795`）不读 watchDir，目录存在性由 `probePath`（`:158`）单独判。判存活看会话文件是否增长，不据 `rescan` 反推。
- 处置：不改配置、不重启、不造探针。

### 8. `aa5256c5` 全文处置（本版置换四处，其余不追改）
- 全文命中 18 行：`:106 :121 :143 :152 :358 :395 :416 :417 :419 :428 :429 :440 :441 :464 :465 :514 :515 :528`。
- 本版整段置换四处现行口径段：`:428`（配置现值与「待改 0 行」，原句「只剩 `:319` 一行待改 → `c64bc312`、13,007B / `b649e6fd…` / 11:04」作废）、`:429`（行号口径差整段作废，改按 watch key 匹配）、`:430`（只改两处：`:1236`→`:1241`、`c64bc312`→`03205043`；**结论「加载行不作判据」原文不动**）、`:431`（七个 id 现值、待改 0 行；「只需改一行、其余五个 id 不动」作废）。
- 其余 14 行为历史记录，按版本纪律**不追改**；`## v43 追加` 段首已有「勿按此执行」旗标（v50 插入），本版不重复插。历史段内出现的 `aa5256c5`／`66023777`／`c64bc312` 一律不是现行值。

### 9. 回滚纪律（项目总负责人 13:53 定，全组规矩）
- **回滚只用来自救内容，不恢复投递**：备份里装的是当时（可能是死）id，覆盖回去等于把失效状态装回来；要恢复投递只有一条路——让新值生效。
- 配套顺序：**先退出 DSH → 覆盖 → 再启动**（有进程会按同内容重写该文件）。

### 10. 报现值的口径补充
- **重启前 30 秒现读一次再核**（QA 提、项目总负责人 13:47 采纳）：不得拿快照当现值。
- 引现值一律「取数时刻＋字节＋MD5」三件；读数比当前时间早一小时以上的不得当现况发；报之前先读完自己那几条未读。

### 11. 本版说明（自记一笔，不进判件链）
- `task-ledger.v60.md` 曾被**原地覆盖两次**（产品经理操作，违反流转件版本纪律）：13:40:18 版 182,641B / `6fd4f2a0308a83117815e1e96076c3da` / 748 行已被覆盖，现盘上是 183,361B / `01a91479ed04cd3cd3e3543665a34db5` / 749 行（13:44:18 复核）。`task-ledger.v60.md` 现仍在盘、可现验（183,361B｜`01a91479ed04cd3cd3e3543665a34db5`｜749 行），故本版 v61 以 v60（`01a91479…`）为 base 起版，一并补齐 `:428`/`:429`/`:430`/`:431` 四处与 QA 两条补丁（`:435` 段首旗标 v59 已有，不重复；`:515` 已带「在 `cordis.patch.yml` 中 0 命中」的文件限定，`:526` 亦已记录该要求，无需再改）。
- 本文件自身首次生成于 13:57:38（`3a512133a759af55e0c571055d76a466` / 806 行），交付前因 QA 13:52 补充件把「外证」收窄为一条而整版重生成一次；对外只发最终版哈希，两版均留痕于此。
- 后续凡流转件一律「读上一版 → 另存 `.vN`」，不得对已存在版本原地写。

### 12. D-1 缺陷（项目总负责人 14:1x 裁定：本线收口不热改，归 D-1 卡面 v5；18:00 由 workbuddy联络人 投 WorkBuddy）
- **现象**：relay 注入正文写的是**源目录路径**（如 `bridge/to-plugin-group/<件名>`），而注入后立刻把文件搬进 `delivered/<dirKey>/`，接收端按正文路径去读必然 `ENOENT`——`c9ff5961` 那单的 `seq 311` 就是 `cat: … No such file or directory`。
- **影响**：接收方「按正文路径取件」一律失败；行为本身不丢消息（注入行、dedupe、`delivered/` 副本均正常），但正文路径不能当取件依据。
- **现行纪律（改码前一律照此）**：任何接收端**不以正文路径为凭**，取件一律按 `delivered/<dirKey>/` 自查；`dirKey`＝watch 目录 sha1 前 12 位（见 §2）。
- **归属**：卡面 v5 已定稿——`cards/d1-delivered-path.v5.md`｜14,183B｜`e8a797f435f659873fe97bb5d305aba6`｜117 行｜16:03:18，18:00 由 workbuddy联络人 投 WorkBuddy；判据挂派验单 v3（`review-requests/d1-delivered-path.v3.md`｜8,288B｜`a064f4c327ab244782c2cbdd5dabce56`｜63 行，14 条计入分母），项目总负责人审批；本线不热改。〔历史：原「developer 出卡面草案（正文改指 `delivered` 路径 + 兼容旧件读法 + 回归判据），QA 出判据」已被 v5 落地取代。〕
- v63（本版，base＝v62 `487682d748ee3cfecd786ac9b0ee37cc` / 777 行）改两处：①§2 ① 订正接收侧 `seq 307/311` —— `307` 是 `cat` 尝试、`311` 是 `No such file or directory`，外证只留 `298`/`299`/`303` 三条 seq，`307/311` 只作读不到的反证；②新增 §12「D-1 缺陷」（注入正文指向源目录、读时已搬进 `delivered/<dirKey>/`，接收端必然 ENOENT；本线收口不热改，归下一张改码卡）。v62 原样留档不改。
- v63 追加（14:17 依 QA 更正件与项目总负责人原话）：`:430` ③ 定为「内证四件同源；独立外证一件＝接收侧 transcript `seq 298`/`299`/`303`；`307/311` 是 `cat` 失败不作读件回执；`rescan=resolved` 不作件级凭据」；§2 接收侧判件改引 `qa-7th-watch-receipt-supplement-1116.v2.md`（5,816B / `77559d87…` / 54 行），v1 `fd826f91…` 原样留档。
- v63 追加（14:18）〔**已被取代：v64 起 §5 现行＝v3.17，本条只作历史**〕：§5 名册现行改为 **v3.16**（32,254B / `ae0fdb6e…` / 330 行），v3.15 转留档。

- v64（base＝v63 `715bd1a204469b5dec93ad552b7954f5` / 786 行，191,761B / `822dfa4c0da033ba30b6c233657567ff` / 785 行）改四处：① `:432` 时间口径整段销项，改为「只留 12:02 为唯一启动点，`12:00–14:00` 只作首投允许窗口描述」；② §5 名册现行改 **v3.17**（32,887B / `9191f2b9c97781366981a33f58da033d` / 338 行，14:17:32 落盘、大肥鱼 群内报为现行），v3.16（32,254B / `ae0fdb6e…` / 330 行）转留档；③ 删掉原 `:747` 那条重复自称「现行：v3.15」的行（v3.15 的字节/MD5/行数保留在 §5 段尾作留档）；④ 原 `:749`「13:53 定：不出 v3.16……判件一律按 v3.15」加取代旗标。
- v65（base＝v64 `822dfa4c0da033ba30b6c233657567ff` / 785 行）只改两处半句：① `:727` 末尾「判件仍引 QA 那件 `fd826f91…`」改指 `qa-7th-watch-receipt-supplement-1116.v2.md`（5,816B / `77559d87…` / 54 行），与同段后文一致；② `:785` 的 v3.16 记录加「已被取代」旗标（内容不追改）。其余逐字不动。
- v66（base＝v65 `797ac09ff66fb96f29829e00e496ddfd` / 787 行、`wc -l`）只加三行，正文其余逐字不动：① §5 增「引名册口径」一条——历史节不作现值、判件只看 §二十／§二十一、不单开名册新版（项目总负责人 14:48 定）；② §5 增「留档」一条，列 v3.16（32,254B / `ae0fdb6e…` / 330 行）与 v3.15（29,877B / `b0bf8006…` / 307 行）并注「均不作现行」（QA 14:46 提）；③ 本条变更记录。

### 13. 首卡 `reboot-hy4flash-sync` 关闭（项目总负责人 11-17 终审 PASS，关闭件 12:15）
- 关闭原文照抄（项目总负责人 11-17 12:18 群内口述，指定照抄）：`wt-1/wt-2/wt-3/wt-docfix/wt-p51/wt-p56/night-probe` 保持旧白名单，禁派活；不做补写、不留 dirty、无豁免。
  〔关闭件 §四 记同一裁定的实际措辞：「`wt-1/…/night-probe` 一律 `禁派活`」；两处指向一致，引哪句都不改判定。〕
- 受验版本＝提交 `b5afcea2`（父 `69cd4a41`，分支 `exp/resource-ledger`），2 文件，未 push、未打 tag。
- 关闭件 `org/close-reboot-hy4flash-sync-1117.md`｜2,204B｜MD5 `2dd6ad1ca693bd66c3370b6a9c5cdcaf`｜23 行；首验判词 `reports/reboot-hy4flash-sync-qa-firstcheck.md`｜7,401B｜MD5 `3bc4d792a8a19f4b21ea397f330ad553`｜68 行｜PASS 10/10。
- 两项偏差裁定：①v7 记账与报告不入库＝正常（`git check-ignore -v` 命中 `.gitignore:89:/.batch/`，任何人不得用 `-f` 塞入）；②报告 `:2` 引旧派验单 `3190c6e8…`（3,037B）而非基准 `0262c9d4…`（3,471B）＝不补 v2。
- **边界**：本卡只钉死「跑哪棵树」；7 棵旧树夜间（23:00–08:00）仍返回 `Hy4`，不得据本卡说已修复。

### 14. 无 @ 治理基线（11-17 定案：721／72＝9.99%）
- 基线：**721／72＝9.99%**。口径（项目总负责人 11-17 定，写全这一句即自解释）：分母＝`text` 非空的 bot 发言（`who` 不含 `User`、`DS Bot`），分子＝其中正文不含 `@名字` 的条数，窗口 12:00–18:30（2026-11-16）。
- 目标 <5%、首日过渡 <10%，一字不动；分人占比只作诊断，不进判据（防变成按人配额）。
- `722／72＝9.97%`（B 口径，含 `who=User` 那 1 条；该条本身带 @，分子不变）只作存档，**不进判件链、不作基线**；主人基线 1,754／1,098（62.59%）与 18.24% 口径均已作废。
- 复算脚本（`text` 非空过滤版）：`staging/qa-noat-721vs722-1117.mjs`；早前 `staging/no-at-count.v3.mjs`（1,737B｜MD5 `fb36434a708669a1d36cff704eb70a44`）。
- 限流方案：`staging/message-admission.v1.md`｜4,171B｜MD5 `fc4d4c23a9914bef6169a28ef55f1107`｜54 行；v2（五处改＋本基线）待复工后出，不出散版。

- v68（本版，base＝v67 `96a0dfe37976f0db19c85bf251a76834`／195,126B／`wc -l` 790 行）改四处，其余逐字不动：① 文首加 `状态：现行` 与第 2–3 行 From/To；② §5 名册现行改 **v3.20**（37,699B／`fa384b70a588f1173c87d52c7f56b483`／373 行），v3.19 转历史留档，`:749` 段末与 `:750` 的「判件按 v3.19」同步改 v3.20；③ 新增 §13 首卡 `reboot-hy4flash-sync` 关闭（关闭原文照抄＋两项偏差裁定＋7 棵旧树夜间仍返回 `Hy4` 的边界）；④ 新增 §14 无 @ 基线 721／72＝9.99%（722／72＝9.97% 只作存档）。

### 15. Goal「脱敏基线收口（四阶段）」四 stage 证据行（写手＝产品经理，2026-11-20）
- 素材来源：`org/stage4-closecheck-1120.md` §七（项目总负责人交给我抄的素材）、`org/BACKLOG.md` 收口段、QA 首验判词、提交记录。台账只记事实与判据，判定归 QA 与终审。
- 本表不写三元组（裁定 `1224ee2b` 第 3 条）：核对内容一律 `git show <sha>:<path>` 现算。

| stage | 事项 | 判据与证据 | 依据 |
|---|---|---|---|
| 1 | `archive/` 首次合入主线（97 件清洗版＋`MANIFEST.sha256`） | `--no-ff` 合并；判据 97／97、双向差集 0、97 条 sha256 `mismatch=0`、真名 0／0、`--all` 0 项 EXIT=0、`check:fast` EXIT=0；QA 首验 PASS（`reports/GOAL1-archive-first-merge-qa-firstcheck.md`） | merge `ce74268f`（源 `78d56ea0`）＋docs `68fa0381` |
| 2 | `archive/` 登记补齐＋未跟踪件清场 | `archive/README.md` 97 条五字段齐；`待补` 38→8（8 条转 B-21）；`??`=0、`--all` 0 项、`check:fast` 五段绿；QA 复跑 PASS（`reports/GOAL2-archive-readme-qa-firstcheck.md`） | `058c0867`（含 `e29b1a50`、`f2ffa905`） |
| 3 | 脱敏线接主线并推送 | 受验 `adb17d44`：工具补丁回滚后 `63e9328f…`、`.piiallow` 149／149／149、`--all-tracked` 0 处命中（扫描 3363 个文件）；合并 `eba81c43` 后推送 `exp/mainline-1119` → `refs/heads/exp/resource-ledger`，旧头 `beeedc26` → 新头 `eba81c43`；`ls-remote` 同 sha、`rev-list --left-right --count` `0	0`、`check:fast` EXIT=0、真名 0／0 | 受验卡 `adb17d44`＋合并推送 `eba81c43` |
| 4 | 收口清单与台账＋原件 bundle | `BACKLOG.md` B-6／B-17／B-22／B-16（仅尾行那半）结案行已落，B-4 部分结案、B-23 新记；原件 bundle 在 `C:\tmp\aiwriter-archive-bundle-1120\`（不入库），README 五段齐（谁建／何时／用途／保留期／过期给谁）；bundle 首版被打回一处（容器内 `README.md` 顶掉归档件 `archive/README.md`，实件 96 而非 97），已把说明改名 `_BUNDLE-README.md` 重打：tar `C:\tmp\aiwriter-archive-bundle-1120.tar.gz`｜167,832B｜sha256 `2d6c7ea2105f1c8cf68e510fbdf917454378017f08a75e96824ac86d84de2aac`，97／97 在包内、唯一 mismatch 仍是 MANIFEST 入库版 `fd213df1` vs 现版 `0155079f`；QA 复跑待判；本表四行随本笔台账提交入库 | `ba55065b`（BACKLOG＋closecheck 骨架＋H 卡判词入库）＋本笔台账提交 |

- 备注：stage 4 的 QA 收口核结论出来后，在本节末追加一行「QA 判词路径＋PASS／打回」；bundle 重打后的 tar sha 与 97／97 复验结果同批补在这一行，不改上表四行。
- QA 判词：本群 PASS 帖（2026-11-20 05:52），三项全绿（BACKLOG `b908574d` 三处 `[x]`＋`trailing-newline`；台账 §15 四行；bundle tar `2d6c7ea2…`／167,832B、包内 97／97、逐件 sha 对 HEAD blob `n=97 bad=0`）。
- 推送已落（2026-11-20 06:0x 复核）：分支 `exp/mainline-1119`、新头 `eb4bd36413363844045f8e276e6be9b5c3bf4049`，`git rev-list --left-right --count origin/exp/resource-ledger...HEAD` ＝ `0	0`，`git log -1 origin/exp/resource-ledger` 同 sha；四行表体未动。注：补本行的那笔提交会使本地重新领先 1 笔，需随下次授权推送归零（本行的 0 0 是 06:06 实测值）。

### 16. 复工三件收口（2026-11-20，口径唯一化：中途版本不再引用）

| # | 件 | 落点与规模 | 维护人／判据 |
|---|---|---|---|
| 1 | 路线图文档规格 | `org/roadmap-doc-spec.md`｜405 行｜20,792B｜`359b5855…`（落盘自 `c351d2be…`，与原件相比只多第 5 行维护人；正本与 skill `roadmap-doc-spec` 同一次改） | 维护人＝项目总负责人；改动只走「群内讨论 → 落盘」 |
| 2 | 豆包两表（入 `staging/` 候选材料面，不进 `docs/`／INVENTORY） | `capabilities` **28,137B／177 行／`0acb6049…`**（入库时 hygiene `trailing-newline` 收敛末尾第 2 个换行，正文未动；值 `28,138B／178 行／03f547c9…` 已作废）；`to-l2-map` 11,130B／130 行／`2f5a67d7…`（基线：使用名 16、未贴靠 15、名单外 0、条目 118＝78＋40、清单 15 项） | 维护人＝豆包联络人；QA 判词 `C:\tmp\qa-doubao-l2-spotcheck-1120.md`｜5,846B／68 行／`1fbc7b1c…`（末行 `<!-- DONE -->`）；两表在并入 INVENTORY 前不再动 |
| 3 | 派活通道口径 | `org/dispatch-channel-1120.md`｜34 行｜1,506B｜`a939cea8…` | 项目活只走群或 relay 投群分身；主身私聊只做纯个人事务 |

- 11-21 更正（2026-11-20 23:5x，S1 入库后）：六件未跟踪件已随提交 `376ce148`（父 `884b17f2`，6 files／+914，六路径点名、未用 `-A`）入库，S1 四条判据经 admin 实跑 pass（HEAD＝origin＝`376ce148`、porcelain 空、hygiene `0 项不合规`、archive 97/97）；`capabilities` 末行空白收敛属首次入库 `A`、无对账基准，采信限度一条已记：**原件从未入库，`body_identical` 无法第三方复核**，对账一律按 28,137B／`0acb6049…`。

- 推送状态（2026-11-21 00:1x 复核，取代下面 11-20 那条快照）：远端 `exp/resource-ledger`＝本地 HEAD＝`376ce148361af0719f9c7ff8134bef8c5b7e916f`，`git rev-list --left-right --count` ＝ `0	0`；`git status --porcelain -uall` 0 件（六件已入库）。本行与上一笔 `f9c84f90` 属同一登记动作，两笔会使本地重新 `0	2`，随下次实改动一并推，不单独推。
- 历史快照（2026-11-20 复核，仅留档）：远端＝`db242c2bebeda8b48c158a8a77449d09cfa388be`，`git rev-list --left-right --count` ＝ `0	0`；未跟踪 6 件 `??` 照旧（`dispatch-channel-1120.md`、`roadmap-doc-spec.md`、`ruling-dispatch-v6-1120.md`、两张 `staging/doubao-*.md`、`reports/weekly-2026-11-13_11-20.md`）。§15 里 `eb4bd364` 那两行是当时实测值，不追改为现值。

### 17. Goal 四阶段收口：S3 存量处置结论与四条待裁（2026-11-21）

| # | 结论 | 判据与证据 | 依据件／提交 |
|---|---|---|---|
| 1 | S3 判 **pass**（admin 实核）；存量清单只列不动，删除动作 **0** | 三处数字与我方实取一致：`AI-writer/.batch-a` 860 件／103,613,677B（du 101M）、`.batch-a/d12proj/.ai-novel/project.db` 14,405,632B／md5 `734804176281b0bd979133950522a181`、`tmp-dev` 61 件／534,352B；tar `C:\tmp\aiwriter-snapshots-1120.tar.gz` 20,301,711B／sha256 `5a392af4…9ff5` 原样未动 | 清单 `org/s3-disposition-1121.md`｜76 行／7,031B／`bbdd6c5f4f01aa8e634532c21778f53e`（未入库，`git ls-files` 未命中，待 QA 按新 md5 复判）；取数 `reports/s3-stocktake-1121.md`｜159 行／11,210B／`a5a0324a408ac477a9be68533451dcd9` |
| 2 | **B-1a 改判「转主人裁」**（首版「无可处置对象」作废） | `proj-pre-d12` 未删，是被改名搬进 `.batch-a/d12proj`（md5 与 BACKLOG 记的三个数逐项相符）；`proj-pre-a1`（db md5 `c338bad5…`）与 `proj-pre-b1replay`（db 16,969,728B）仍未找到；`.batch-a` 无 README、在 git 之外，按 B-1e 属待认领孤儿 | 同件 §〇、§一；负责人 01:58 已按其改写并自行认错 |
| 3 | B-1b／B-1c **结案（对象已不存在，非本组删除）**；可清理合计 **21,112,163B（约 20.1 MiB）**，原「135 MB」作废 | `─_scratch-d18`、`_backup-2026-11-01` 实测 GONE；合计＝tar 20,301,711B＋`tmp-dev` 534,352B＋根 `.backups` 19,311B（3 件）＋`develop/.backups` 180,192B（2 件）＋`.backups-archive` 76,597B（1 件） | 同件 §〇、§二 |
| 4 | B-2 分支三档：**39 ＝ 当前 1 ＋ 已并入 7 ＋ 未并入 31**（件内写 32 是含了当前分支，admin 已订正）；7 条可删（只列不动）、31 条保留、远端 5 条不动 | 实测 `git branch|wc -l`＝39、`--merged origin/exp/resource-ledger`＝7、`ls-remote --heads`＝5；7 条均 ⊂ `376ce148`（QA 逐条 `merge-base --is-ancestor` exit 0）；回滚＝`git branch <名> <tip>`，tip 见 stocktake §6.1 | 同件 §三 |
| 5 | **四条待裁已 relay 主身**（本组不代答） | ①约 20.1 MiB 删不删（含 tar、`tmp-dev`、三处 `.backups`；删 `tmp-dev` 前须单独保留 `pii-scan.mjs.bak-1119H`，它是 `rotation/pii-scan.mjs` 唯一回滚件）②`.batch-a` 101 MB 怎么办（补 README／纳管／删）③B-1d 仓库外目录纳不纳管 ④7 条已并入分支删不删 | 同件 §五（四条，含体积对比与回滚路径） |

- 推送状态（2026-11-21 02:0x 复核）：本地 HEAD `0d2671db`，`git rev-list --left-right --count origin/exp/resource-ledger...HEAD` ＝ `0	2`（待推 `f9c84f90`、`0d2671db`），`git status --porcelain -uall` 8 行（1 `M`＝BACKLOG 回写中、7 `??`＝两卡两判词＋S3 两件＋一 reports 件），均不单独推，随下次授权推送一并归零。
- 口径提醒：本节四行只记 S3 已成立的事实与四条待裁，S4 的 BACKLOG 结案行与看板六卡一致性由负责人回写、QA 核；四阶段证据行＝S1 §16、S2 §18 首行、S3 §17、S4 §18；§15 属上一个 Goal（脱敏基线收口四阶段），不充当本轮依据，本节亦不替代。

### 18. S4 结案与看板一致性（2026-11-21）

| # | 结论 | 判据与证据 | 依据件／提交 |
|---|---|---|---|
| S2 | S2 收口复核：B-23 判「不成立」结案（`d1a6e75c` 起 `archive/` 早已豁免）；B-20 探测四值齐 | `git show d1a6e75c:scripts/ops/check-batch-hygiene.mjs` 命中 `EXEMPT_VERSIONED_DIRS`（`:26`）与 `return null`（`:55`），父提交 `d1a6e75c^` 命中 0；`wt-p56` 探测四值＝`dotgit_is_file=True`／`dotgit_mergehead_test=False`／`gitpath_raw=C:/develop/workspace/AI-writer/develop/.git/worktrees/wt-p56/MERGE_HEAD`／`gitpath_test=False`（不进等待循环、不置 `$inProgress`）；`--all` 0 项、`--disk` 14 项且 archive 命中 0、`archive` 内 `.vN` 71 件 | QA 首次判词 `reports/S2-premise-qa-recheck.md`（PASS＋勘误 3 项：`while` 在 `:61` 非 `:62`、「本卡不改码」在第 7 行非第 4 行、`gitpath_raw` 为裸串）；BACKLOG `### B-23` 在 `:90`、B-24 在 `:98` |
| S4 | BACKLOG 结案回写落地，**只剩 1 条 open**＝B-1e 常驻规矩（长期规矩，故意不勾） | `grep -c '^- \[ \]'`＝`1`（即 `BACKLOG.md:52` B-1e）、`^- \[x\]`＝`21`；B-1a／B-1d／B-19 记「已处置」（B-1a 已删并留档、B-1d 仓库外仓不纳管、B-19 已删并留档），B-1b／B-1c 记「结案·非本组删除」，B-2 记「39＝当前 1＋已并入 7＋未并入 31」，B-3／B-5／B-18 结案，B-4／B-21 记「去向＝转下期」；旧「18 分支／8 条可直接删」清单与「135 MB」口径均标作废 | `30d3799e`（父 `ab8e8e17`，2 files／+121−22，`check:fast` 全绿、`--all` 0 项）；`BACKLOG.md` 现 125 行／`1d9e81bb32e8e0860d177ce7b922de2c`；S3 清单件随之入库（`bbdd6c5f…`／76 行／7,031B） |
| S4 | 看板六卡与实况一致（revision 844），无待改 | S1 `23433174` done／S2 `76273d1a` done／S3 `2a8b0b0d` done／S4 `4ee6b83e` done／S5 `19bd077a` done／S6 `3aabf83a` todo＋首行标「归 DSH 插件组，不在本项目路线图」 | 负责人 02:1x 核对结果；待 QA 复核 |
| S4 | 判据三项到位：BACKLOG 各有结案或转裁、台账含四阶段证据行、看板六卡一致 | 本轮 Goal 的四阶段证据行＝S1 §16、S2 §18 首行、S3 §17、S4 §18；§15 属上一个 Goal（脱敏基线收口四阶段），不充当本轮依据（口径按 QA 02:2x 判词更正）；最终 PASS 归 QA／admin | — |

- 推送状态（2026-11-21 02:2x 复核，登记本节这两笔之前）：本地 HEAD `30d3799e`、远端旧头 `376ce148`，`git rev-list --left-right --count origin/exp/resource-ledger...HEAD` ＝ `0	4`；加上 §18 这两笔登记（`7791f2f6` 与本次补 S2 行那笔）共 `0	6`，全部不单独推，随下次授权推送一并归零。
- 未入库余件（不属我，仅备查）：`git status --porcelain -uall` 6 件 `??`＝两张 S2 卡面、三份 S2 报告、`reports/s3-stocktake-1121.md`。

### 19. 处置结果：`.batch-a` 与 `tmp-dev` 已删并留档（tar＋sha256）（2026-11-21）

| 对象 | 结论 | 判据与证据 | 依据 |
|---|---|---|---|
| `.batch-a`（860 件／103,613,677B） | **已删并留档（tar＋sha256）**，执行人＝管家跟班，组内未动手 | `C:\tmp\aiwriter-batch-a-1121.tar.gz`｜29,740,172B｜sha256 `bf6047565892e2b7b25774ee2ffe6199b8beaae58585cd0c20d8419193cbc7ed`｜tar 条目 922＝860 文件＋62 目录（根名 `.batch-a/`，我 `tar tzf \| wc -l` 实得 922）；`C:\develop\workspace\AI-writer` 下 `.batch-a` 已不存在 | admin 02:2x 报告；QA 只读复核一致 |
| `tmp-dev`（61 件／534,352B） | **已删并留档（tar＋sha256）** | `C:\tmp\aiwriter-tmpdev-1121.tar.gz`｜107,370B｜sha256 `50c40c1c6138aa323fe16b17492a459d2878bc6f4698e99361d2edfc6cbf4a62`｜条目 62＝**61 文件＋1 目录**（首条 `tmp-dev/`；「62 条目」与「61 文件」两种写法都指同一包，引用时写明哪个是哪个）；`tmp-dev` 已不存在 | 同上 |
| 回滚件 | `rotation/pii-scan.mjs.bak-1119H` 在盘（bot 工作区 `C:\Users\伯云飞\.dsh\bot\workspace\rotation\`） | 9,190B｜md5 `63e9328f548f66174e53a3e9937ddda8`（我实测）；它同时是 `rotation/pii-scan.mjs` 的唯一回滚件 | 我实测 |
| 未动项 | `.backups`／`night-probe`／`test-master`／`wt-1117f`／`_trash` 按 admin 报告原样未动；本行未自验 | — | admin 02:2x 报告 |

- 措辞口径（admin 定）：写「**已删并留档（tar＋sha256）**」，不写「已清理干净」。
- 边界：本组任何人未执行删除；B-1a／B-19 的结案行由负责人在 BACKLOG 里同步改标题与正文，台账本节只记事实。

## S4 收口（2026-11-22 · 项目总负责人按 admin 19:2x 指派补写）

判定面：HEAD `ec508ec1`（与 `origin/exp/resource-ledger` 同 sha）。六卡行与四阶段行如下，读数均为本机实跑，命令原文与输出摘录并列。

| 卡 | 结论 | 命令原文 → 输出摘录 | 入库 sha／判词 |
|---|---|---|---|
| CARD-S3-D4（文案与批次中止关联） | PASS（判面 `a2a9d1d5`） | `git show 544dcbd5:.batch/night/reports/s3-d4-qa-firstcheck.md \| wc -lc` → `219 17336`；`git merge-base --is-ancestor a2a9d1d5 HEAD` → `rc=0` | `a2a9d1d5`／判词 `94fe4c68…`（219/17,336） |
| CARD-S3-D7（单元→章 折算预告） | PASS（判面 `544dcbd5`） | `git show 544dcbd5:...s3-d7-qa-firstcheck.md \| wc -lc` → `233 17869`；`git merge-base --is-ancestor 544dcbd5 HEAD` → `rc=0` | `544dcbd5`／判词 `423ca481…`（233/17,869） |
| CARD-S3-D16（模型指示器） | PASS（判面 `de53e22e`） | `git show de53e22e:...s3-d16-qa-firstcheck.md \| wc -lc` → `151 11739`；`git merge-base --is-ancestor de53e22e HEAD` → `rc=0` | `de53e22e`／判词 `9290851e…`（151/11,739） |
| CARD-S3-D10（清空回显无残留） | PASS（判定面 `4a3aaf18`／合并 `a73ec4c6`） | `git show a73ec4c6:...s3-d10-qa-firstcheck.md \| wc -lc` → `222 24943`；`git merge-base --is-ancestor a73ec4c6 HEAD` → `rc=0` | `a73ec4c6`／判词 `c55ce76c…`（222/24,943）；取证件 `a517a50d…`（39/2,532） |
| CARD-S3-D11（补卡提示去重，判据 2 转 D11b） | PASS（判面 `ec508ec1`） | `git show ec508ec1:...s3-d11-qa-firstcheck.md \| wc -lc` → `204 12533`；`git merge-base --is-ancestor ec508ec1 HEAD` → `rc=0` | `ec508ec1`／判词 `bdd5b340…`（204/12,533） |
| CARD-S3-D11b（检查点卷号投影） | PASS（判面 `a7012c51`／合并 `ec508ec1`） | `git show ec508ec1:...s3-d11b-qa-firstcheck.md \| wc -lc` → `187 12561`；`git merge-base --is-ancestor a7012c51 HEAD` → `rc=0` | `ec508ec1`／判词 `8fd184b9…`（187/12,561） |

| 阶段 | 结论 | 判据与证据（命令原文 → 输出摘录） |
|---|---|---|
| S1 | pass（D12 收口） | `git merge-base --is-ancestor 0f0ca3ee HEAD` → `rc=0`；判词 `s2-d1-qa-firstcheck.md`（142/8,702/`079cceb0…`） |
| S2 | pass（D13／D9／D1） | 三条 rc=0：`bff3d327` → `rc=0`、`cd825b81` → `rc=0`、`0f0ca3ee` → `rc=0`；判词 `s2-d13`／`s2-d9`／`s2-d1` |
| S3 | pass（D4／D7／D16／D10／D11＋D11b） | 六条 rc=0（见上表）；`git status --porcelain -uall \| wc -l` → 6（1 M 模板＋1 M 缺陷稿回写＋4 件 `.batch` 草案，均未提交） |
| S4 | 待 QA 四项与本件入库 | 四条由 QA 在回写落盘后一次跑完：`pnpm check:fast`、`node scripts/ops/check-batch-hygiene.mjs --all`、`git status --porcelain -uall`、`git rev-parse HEAD` vs `git ls-remote`；本行在判词入库后回填原文 |

- 本段只追加，不改既有条目；六卡行结论词只取 `PASS／不通过／作废／转出`。

### 20. S5 三卡（D5／D15／D18）判词与缺陷稿／索引回写（2026-11-23）

| 卡 | 结论 | 判据与证据 | 回写落点 |
|---|---|---|---|
| CARD-S5-D5-3 | PASS | 判词 `.batch/night/reports/s5-d5-d15-d18-verdict.md`（138 行／16,541B／`3695dc7f…`，提交 `2684206e`）；判定面 `7b48f074`；判据 3 [live] run `aeddad33-cf5` 的 R1／R2／R3 hits 均 0；合并 `89868921`（已推送，现远端 HEAD `ef915a60`） | 缺陷稿 `:70`、backlog `:128` |
| CARD-S5-D15 | PASS | apply／判定面 `f95ed1da`（仅测试 +52/−0）；QA 独立复跑 `Tests 32 passed (32)`／`EXIT=0`；合并 `64793246`（已推送，现远端 HEAD `ef915a60`） | 缺陷稿 `:74`、backlog `:138` |
| CARD-S5-D18（主体卡） | 部分收口（判据 4 [live] 未取证，转 S6） | 判据 1/2/3 [static] 通过（apply `7b48f074`，未合并）；本轮唯一一次实机 `aeddad33-cf5` 只有 arch 段、无 `hookInput`／finalize 键；D18b 属 arch 前置闸补验，不顶替判据 4；处置＝QA 方案 ②（转 S6、不降判据） | 缺陷稿 `:80`、backlog `:141`；裁定件 `.batch/night/org/ruling-s5-d18-carry-1123.md`（提交 `8508bff3`） |

- 行号订正（照实记）：派验单 §6.5 把「D5 `:128`／D18 `:141`」写成缺陷稿行号，实为 backlog 现值索引；缺陷稿对应 `:70`／`:74`／`:80`。判词 §7.2 写 D15 在 `:135`，实测为 `:138`（`:135` 是 D12 行），本轮回写按 `:138`。
- 口径：D18 三处一律写「S5 部分收口·判据 4 [live] 未取证」，不写 ✅；合并 sha 一律「未合并·待主身」；两处旧的「本轮取证…判 INVALID」句已按判词 §7.1／§7.2 删除（`grep -Fc '判 INVALID'` 两文件均为 0）。
- 合并与 HEAD（2026-11-23）：D15 实现 `f95ed1da` → 合并 `64793246`；D18 实现 `7b48f074` → 合并 `89868921`；D5 判定面 `7b48f074` → 合并 `89868921`。HEAD＝远端＝`89868921`（`git ls-remote origin refs/heads/exp/resource-ledger` 同 sha），`git status --porcelain -uall` 0 行；缺陷稿与 backlog 里「未合并·待主身」占位已全部回填为实际 sha。
| CARD-S6-D18（判据 4） | PASS | 判词 `.batch/night/reports/s6-d18-criterion4-verdict.md`（92 行／9,622B／`a2342504…`，提交 `db2abb4f`）；判定面 `89868921`；runId `b3984cd5-78f`、`instancesThisRun=1`／`exitCode=0`／`leftoverElectronProcesses=0`；`[hook-unplanted]` 恰 1 次（`markerLineCount`／`markerCountMax`／`markerCountFinalBody` 均 1，`final-body.txt:113` 命中第 6 章钩子原文）；边界＝面板 500 行环形缓冲、`exitCode` 由脚本推出不作独立旁证、`callbacks.log` 不落库；定稿后处理两步失败不影响本判据 | 缺陷稿 `:80`、backlog `:141`、看板卡 `2b7eb20d`、留痕卡 `61191d9e` |

### 21. L0-FACT 事实层确定性预检达标（S3 收口，2026-11-23）

| 卡 | 结论 | 判据与证据 | 回写落点 |
|---|---|---|---|
| L1-FACT-01（卡 `bb3f0d83`） | 达标 | 判定面 `0ec6c89c`（分支 `card/fact-preflight-3rules`，5 文件 `+542/−25` 全在白名单内）；QA 判词 `.batch/night/reports/s2-fact-verdict.md`（73 行／7,530B／`d6a4232c…`）；`Tests 83 passed (83)`／`EXIT=0`；QA 手写 FNV-1a 64 复算 `space:6f155ee620aee7cd` 与测试字面量一致、`slot:` 前缀隔离成立；变异测试（`:415` 守卫改恒假 → 3 条负向转红）证明负向断言非空；`pnpm check:fast` 末行「全部通过」；合并 sha `26731adb`（merge `0ec6c89c`），已推送，S3 终版 HEAD `22c085db` | ROADMAP `:30`／`:31`（§1 表）＋ §2 `L0-FACT`／`L1-FACT-01` 状态行；看板卡 `bb3f0d83` 由 admin 转 done |

- 记账两条进 BACKLOG 不随本阶段修：`R3` 只看调用方传入的 `blueprints`（单章路径恒不触发、跨批次检测不到）；单章对话框未传 `structuredRefs`，既有 `space:` 规则单章路径 fail-open。
- 本段只追加，不改既有条目。

### AC 系三卡（S4 收口登记，2026-11-24）

| 卡 | 结论 | 判据与证据 | 回写落点 |
|---|---|---|---|
| CARD-ARCH-AC1（卡 `a7589d74`） | 达标 | 判定面 `6e0f6a63`；判词 `.batch/night/reports/ac1-s1-verdict.md`（135 行／10,173B／`cff7edda…`）；测试 `10 passed`；合并 sha `2e43a912` | ROADMAP `L2-ARCH-01-01` 状态行 |
| CARD-ARCH-AC2（卡 `4027dbef`） | 达标 | 判定面 `5e99d2ad`；判词 `.batch/night/reports/ac2-s2-verdict.md`（101 行／13,812B／`c4c2c40d…`）；测试 `13 passed`；合并 sha `ab79550c` | ROADMAP `L2-ARCH-01-02` 状态行 |
| CARD-ARCH-AC3（卡 `ed210a27`） | 达标 | 判定面 `b5a14f1c`；判词 `.batch/night/reports/ac3-s3-verdict.md`（123 行／10,799B／`55e849f9…`）；测试 `46 passed (46)`；合并 sha `113f7d4d` | ROADMAP `L2-ARCH-01-03` 状态行 |

- 本段只追加，不改既有条目；合并 sha 待主身推送后由产品经理回填。

### 22. PLANUI 落地（S2–S4 收口登记，2026-11-25）

| 卡 | 结论 | 判据与证据 | 回写落点 |
|---|---|---|---|
| CARD-PLANUI-C1（卡 `744f13a8`） | 达标 | 判定面 `34aa0000`（相关性筛选三档）＋`41daa79c`（M30 漏登 `draft_edit_stats` 补登）＋`8a42a566`（字段级并排对比＋三选一＋M31 快照 lane，16 文件 `+1642/−6`）；判词 `.batch/night/reports/s2-c1a-qa-verdict.md`（167 行／10,390B／`30dc2d57…`）与 `s2-c1b-verdict.md` **v2**（143 行／15,110B／`855bd843…`；v1 `1abdf4bf…` 作废）；`Tests 22 passed (22)`＋browser `5 passed`，变异 M2／M4／M5 真红；合并 sha「并入 `1c0700a1`（卡链尖 `8a42a566`）」 | ROADMAP `:192`／`:200`（§2 状态行）、`:44`／`:45`（§1 表） |
| CARD-PLANUI-P6（卡 `342b428f`） | 达标 | 判定面 `cbbe82c3`（P6-a `e219977b`＋P6-b `a1bcabee`＋P6-c `cbbe82c3`）；判词 `.batch/night/reports/s3-p6-verdict.md`（160 行／14,217B／`3665ffd0…`）；browser `38 passed`；每章预算从 `S07_TASK_BUDGET_POLICY` 派生（zh 单章 3,584／10 章 31,232，对 32,768 余 1,536）；档 2 按裁定不做；合并 sha「并入 `1c0700a1`（卡链尖 `cbbe82c3`）」 | ROADMAP `:208`（§2 状态行）、`:46`（§1 表） |
| CARD-PLANUI-O1（卡 `58188c1c`） | 达标 | 判定面 `85c927ae`（O1-a `641ffc0c`＋O1-b `85c927ae`）；判词 `.batch/night/reports/s4-o1-verdict.md`（113 行／14,691B／`4e9b88c7…`）；`Tests 42 passed (42)`／三文件 `Tests 106 passed (106)`＝基线 97＋9；四个必发变异 M1／M2／M3／M3b 全真红、复原后新件 sha 逐字回 `bef01e07…`；合并 sha「并入 `1c0700a1`（卡链尖 `85c927ae`）」 | ROADMAP `:184`（§2 状态行）、`:43`（§1 表）；口径订正见设计稿 §3.2／§3.4 |

- 本轮提交链（原在卡分支，已并入 `1c0700a1` 并推送）：`34aa0000`（C1-a，4 文件 +1,036/−1）→ `41daa79c`（P0，3 文件 44/6）→ `8a42a566`（C1-b，16 文件 +1,642/−6）→ `e219977b`／`a1bcabee`／`cbbe82c3`（P6-a/b/c）→ `641ffc0c`（O1-a，2 文件 630/0）→ `85c927ae`（O1-b，5 文件 132/5）。
- 三卡在看板已 `done`（`744f13a8`／`342b428f`／`58188c1c`）；ROADMAP 四条 `L2-PLANUI-01-01..04` 转「达标」，`L0-PLANUI`／`L1-PLANUI-01` 记「进行中」（父级达标签字待主人，`roadmap-doc-spec.md` §5 第七项）。
- 记账十二条（外派越线两条、判词 v2、J8 缺实机半、P6 超限静默、豆包 S4 回执未落盘由联络人抄录、循环 import、`startStep` 未钳 fail-open、`t84789` 来源、pre-commit 缺卡号未拦、`picked` 不剪枝、P6 派单措辞瑕疵、J4c 勘误）见 `.batch/night/org/planui-closeout-1125.md` §3。
- 本段只追加，不改既有条目。
- 收口件指纹：`.batch/night/org/planui-closeout-1125.md` 99 行／9,193B／sha256 `24214f4fb71039b7…`（cherry-pick 后内容未变，sha 不变）。

### 23. RES S2 无结论收口（blocked-by-design，2026-11-25）

| 卡 | 结论 | 判据与证据 | 回写落点 |
|---|---|---|---|
| RES-S2（配对对照执行，真跑） | **无结论收口（blocked-by-design）** | 主人 11-25 05:5x 裁：本轮失败原因是 case 目标不清晰、不可归因——整套长度机制（分段预算表／合格线 85%／不足续写／超限压缩）被替成一句字数带，测到的不是任何一块 prompt 的作用，故不出「哪类干预有效」的结论、不重跑、不再花 token。过程与钱账见下三条。 | Goal：S2 记 blocked-by-design、不 pass、不进 S3（admin 已落，Goal 现 pause）；本卡不进主表「结论」列——`PASS`／`不通过`／`作废`／`转出` 四种取值均不适用（规矩 2），仅在附段留痕 |

- 钱账（闸值口径见放行件 `376cc229` 的 §6）：本批 3 次 **28,662**（`ch05-B1-r1` 4,856／`ch05-A-r1` 8,757／`ch10-A-r2` 15,049）＋批次前 19,378 ＝ **48,040／300,000**，闸未触（`budget.json` 因被杀未落盘，按 `calls.jsonl` 逐条 `usage` 相加，未手填）。
- 废掉的调用 3 条；停手时点 **2026-11-25 05:39**，admin 杀停 pid 56232（宿主作业退出码 `4294967295`＝被外部终止）；`calls.jsonl` 27 行（本轮 3 行、上轮 24 行按 `round` 隔离）、`texts-r1` 3 件、`run-1.log` sha256 `d164d45f…`，全部冻结不删不改。
- 方法证据（只作证据，不得当结论引用）：`.batch/night/reports/res-s2-band-ineffective-finding.md`（44 行／3,658 B／`5e3cf118…4246f4`；首版 43 行／`dea94af1…c5066b` 作废——仅修文件头游离反引号，§1 口径未动。正文标题「S2 不可归因：被替成一句话的整套机制」，文件名保留旧名因群里已有引用）。机制差异：真机 ch10 trace 8,064 字／四块齐全／3 次调用 vs S2 payload 6,060 字符／四块 0 命中／单次调用（trace 三个数出处＝admin 11-25 差异表）。
- 记账两条（随停跑失效，按「未修」归档，起跑前须重新核）：`32641c3d` 上 QA 打回的 F1（失败样本行与探测行漏 `round` ⇒ 一次真调用不进账）、F2（正文目录默认仍 `texts`）。
- 实验脚本 `scripts/experiments/res-s2-ab-runner.mjs` 与 `.runtime/res-s2` 现场件只作证据、不入主线；`run.lock` 经 admin 授权清除（清前原文 pid 56232，`Get-Process -Id 56232` 已不存在）。
- 本段只追加，不改既有条目。
- 口径（负责人 11-25 06:2x 裁）：台账正文**不写自身** sha／行数／字节（自指，改一次变一次，永远追不上）；需要引用时写「见 admin 群内记录」；末行必须带换行（batch-hygiene 是合规项，优先于指纹写法）。

- **判词同名两版**（负责人 11-25 裁，QA 提请）：`res-s2-runner-preflight-qa.md` 在 `C:\develop\workspace\AI-writer\wt-2\.batch\night\reports\` 是 **81 行／10,758 B／`1fe501ba90d23d2b…d280df441`**（该树 `M` 未提交），在 `C:\develop\workspace\AI-writer\develop\.batch\night\reports\` 是 **66 行／7,973 B／`9d58f507…`**（随 `c43f0bd2` 进来）。同名不同版，**按文件名去 develop 取会拿到旧版**，引用一律写「绝对路径＋行数」。
- **判词正本位置**：`res-s2-appendix12-qa.md`（46 行／6,280 B／`8a656670b0cf0185…83ca3c29`）只在 wt-2、`??` 未跟踪。负责人裁：**不复制第二份**，两份判词正本留在 wt-2 冻结树作证物，develop 那份 66 行版原样不动、不回退，**S3 收口时一次性处置**（或按 wt-2 版做一笔修订提交，或在此台账记一行「判词正本在 wt-2 冻结树」）。纪律：**以后判词一律落 develop 主工作树**，本次根因就是判词落进了实验树。
- **提交人归属**（author 栏全是 `大管家 <butler@local>`，`git show --format=%an` 分不出，只能靠自报）：`b057bd3d`（四件口径修订）＝负责人自报；`d8f4a846`（rule-registry R24–R26）＝负责人自报；`1266483e`（R24–R26 措辞修订，叠在 `d8f4a846` 上）＝跟班。负责人裁**不合成一笔**——两笔都只在本地未推、内容只差一句措辞，为它再跑一次 `reset --soft` 不值当（刚出过误撤跟班那笔的事）。
- 本段只追加，不改既有条目。

### 24. 日报口径与五笔结案（2026-11-26）

- 日报 2026-11-26 10:00 已投 to-owner（`relay-db5d0304.md`，2,611 B；relay.log `2026-11-26T02:02:33Z tool-deliver target=relay-db5d0304.md dir=...\bridge\to-owner from=项目总负责人 · AI writer项目组（群分身）`；admin 核三处一致，判真投递）。
- 五笔（`afa72d4c`／`2c3205d5`／`e001416f`／`2321d203`／`ac64ae0c`）**凭据遗失（主人 11-26 19:06 裁）**：原「待补凭据」定性作废，不再追原文、不再当阻塞项。依据＝主人 11-25 已亲口裁定 RES Goal complete、四阶段 pass 当场结案，11-26 19:06 复裁「遗失」；判据是主人裁定本身，不另求件头。
- 日报口径（admin 11-26 定，本组适用）：**只留没人能代办、必须主人拍板的事项**；push 归主身、四条 ended 定时任务清理归本会话，均不占日报待裁栏；同一事项群里提过一次即不再重复占位。
- 仍挂裁的只剩一件：`C:/tmp/pmo-stage2-quarantine/` 到期口径（README「保留期长期」vs 11-20 口径 11-27 到期），及目录实有 8 件、第 8 件 `tmp-c9ff5961.jsonl`（1.59 MB）未列入 7 件清单；未删未移未打包。
- push 已由主身推送（11-26 19:0x）：`5e313404..6e072cfa` 实推 **18 笔**（含 §24 本笔），远端与本地相等、`git rev-list --left-right --count` → `0 0`；本地不再积压。
- quarantine 已由 admin 处置（主人 11-26 裁）：6 件打包后删（`C:\tmp\aiwriter-quarantine-1127.tar.gz`，159,441 B，sha256 `8997c7a2…`，15 条目），第 8 件 `tmp-c9ff5961.jsonl` 直接删，G5 脚本按 B-8 保留到 12-03 认领期；留痕 `.batch/night/reports/quarantine-disposition-20261126.md`。原「仍挂裁」一条据此关闭。
- 定时任务：四条 ended 由主人 11-26 裁「暂时保留、不删」，本组不再动。
- `AGENTS.md` 仍为 `M`（+1/−1，单行改写：禁动区加「语料样本（含原文全文、切片、章名）只落 `.runtime/`，禁止入库、禁止上传」）；负责人未改此文件，改动方待认领；按该文件自身规矩「权威副本是 charter，改规则两边同步 `charter-version`」，现仍 `2026-11-07`，需改动方一并处置（或确认此句属说明不算规则）。
- 本段只追加，不改既有条目。

### 25. 上游增量可吸收清单 a01b4c7b 结项（2026-11-26）

| 卡号 | 类型 | 执行方 | 派活 | 结项 | 结论 | 依据 |
|---|---|---|---|---|---|---|
| a01b4c7b | 评审评估件 | developer（developer） | ~11-26 | 11-26 | PASS（首验带条件通过→C1–C3 改完→终审通过） | 评估件 `.batch/night/reports/upstream-diff-eval-20261126.md`（140 行／14,268 B／`326e31041e5a3a6957b83609a55a4828a8929f8468042491b831af9c60921758`）；机器清单 `.batch/night/reports/upstream-diff-inventory.tsv`（4,320 行／667,855 B／`44a33a3b…aa1e`，4,319 笔＋表头，末字节 `0a`）；派验单 `.batch/night/review-requests/a01b4c7b.md`（25 行／2,526 B）；QA 判词 `.batch/night/review-requests/a01b4c7b-qa.md`（113 行／11,336 B／`a63f1bb6567849e48e4cc…`，提交 `c4ee25f8`）；改完提交 `50e7c23a`（父 `c4ee25f8`，只夹带评估件＋清单） |

- 结论读数：分叉点＝上游 `549522d4`（10-14，树 `ecca8986`，与我方 `upstream-baseline`／`relive-src/upstream-baseline` 同树）；`dd04d3e9` 是重写史假祖先（`merge-base HEAD upstream-baseline` 无输出 EXIT=1）。上游增量 4,348 笔（按日期取到 4,319），与我方 3,640 文件交集 863（M 699／D 161／A 3），其中我方未动 410、已改写 289。聚簇结果 **A1 0／A2 九簇／B 九簇／C 五簇**，非代码 315 路径单列。
- A1=0 的写法口径（admin 11-26 定，防误读）：A1=0 是「**净 diff 不可摘**」，**不是「打不上」**——谁拿「22 个补丁 14 个 `apply --check` 全过」来推翻 A1=0 都是误读同一件事：净 diff 是我方基线到上游 master 的六周累计结果，不是可摘的单笔提交。判据：22 个净 diff 补丁里 14 个 `git apply --check` 全过，但净 diff ≠ 可摘提交，我方父链已偏 1,086 笔；QA 独立抽样 3 笔非 merge `cherry-pick -n` **0/3 干净**（原法在本机不可执行：git 协议死、无对象），与 A1=0 同向。QA 另记「22 补丁未落盘＝证据未落盘」，自建 baseline→master 三件补丁 `git apply --check` 3/3 OK。
- 差额 29 的解释：同一时刻 compare 4,355 vs `since` 接口 4,326，差值恒定 29（机制解释自洽，未逐笔定位，GitHub 配额剩 3）。时点差 +7 笔（取数后上游又进 7 笔，非取数错误）。
- 吸收代价（评估件 §五，QA C1–C3 改后口径）：①取消/失败混淆＝**M**，新建取消类型＋收口 `src/services/workflows/workflow-utils.ts:57/60/63/236` 四处直抛（`isWorkflowCancellation` 全仓 0 命中）；②回收站重发撞名＝**M**，新建机制（收据占位目录＋选目标必填），`reservedManuscriptTargets`／`republishTarget` 我方 0 命中，漏一处丢稿；③网络失败分因＝**S/M**，需先建传输诊断载体（上游改 `electron/llm/transport-diagnostics.ts`，我方 ABSENT），我方 `src/services/generation/prompt-budget-failure.ts:62` 已有 `'network'` 一档，收益是三因细分而非从无到有。
- 外部约束两条（评估件记）：上游已改名 **`EthanYoQ/Pagekin`**；本机 `github.com:443` 的 git 协议与 ssh 大流量 fetch 均不通，本次走 API＋codeload 快照，文件级结论不受影响，将来要对象级 cherry-pick 须先解决通道。
- 边界：developer 未 merge、未 cherry-pick、未改 `src/`、未 push；提交前 `git diff --cached --name-only` 只有评估件＋清单，`node scripts/check-fast.mjs` 全部通过。落此条目时盘上 `??` 三件为他人过程件（`upstream-diff-baseline-20261126.md`、`upstream-diff-task-20261126.md`、`review-requests/a01b4c7b.md`），不在本卡产出内。
- 主人挑中的 A2 条目一律单独立卡，不走 cherry-pick。
- 本段只追加，不改既有条目。
