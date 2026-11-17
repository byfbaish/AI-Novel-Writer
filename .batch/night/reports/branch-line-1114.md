# 分支线取证（2026-11-14 · developer · 只读）

任务来源：负责人 m00495。只读取证，未做任何 `checkout` / `merge` / `rebase` / `push`，工作区未动（原本就有的未提交项原地保留，见 §4）。

## §0 三句话结论

1. **包含关系是单链**：`master ⊆ dev_byf ⊆ origin/dev_byf? 否` —— 实际是 `master ⊆ dev_byf ⊆ origin/exp/resource-ledger ⊆ exp/resource-ledger`。全部 10 个分支里只有 `exp/resource-ledger` 同时含「主线产品 108 条」与「10-18 之后 541 条继续开发」。
2. **108 条没有一条是插件/夜班工具链**：62 条改 `src/`+`electron/`，46 条只改 `docs/`+`scripts/`，且 46 条全是产品设计稿/交接稿（P1/P7/P8/P12、keyEvents、R5/R6）。按「插件/夜班 vs 主线产品」归类 = **0 / 108**。
3. **主线应从 `exp/resource-ledger` 继续**（现 HEAD `151d0fea`，11-14 14:24）。`master` 停在 10-09，`dev_byf` 停在 10-18，二者都是过去时。

## §1 问 ①：三支两两包含关系

`git rev-list --left-right --count A...B`（左独 / 右独）：

| A | B | 左独 | 右独 | 含义 |
|---|---|---|---|---|
| master `8c934037` | dev_byf `615d5577` | 0 | 245 | master 全在 dev_byf 里 |
| master | exp/resource-ledger `151d0fea` | 0 | 796 | master 全在 exp 里 |
| dev_byf | exp/resource-ledger | 0 | 551 | dev_byf 全在 exp 里 |
| origin/dev_byf `4aa1cafb` | dev_byf | 0 | 108 | 108 条**没推到 origin/dev_byf** |
| origin/exp/resource-ledger | exp/resource-ledger | 0 | 10 | 本地比远端多 10 条 |

再补两条判定（同一 `rev-list` 口径）：

- `origin/exp/resource-ledger...dev_byf` = **0 / 541** ⇒ dev_byf 的 245 条**只经 exp 分支到了远端**，`git branch -r --contains dev_byf` 的唯一命中就是 `origin/exp/resource-ledger`。也就是说 origin/dev_byf 是个落后 108 条的孤儿远端分支。
- `origin/exp/resource-ledger...exp/resource-ledger` 的左独 = 0 ⇒ 本地 exp 是远端的严格超集，无分叉，`push` 即可快进。

链：`master(10-09) ⊆ dev_byf(10-18) ⊆ origin/exp(11-12) ⊆ exp(11-14)`。

## §2 问 ②：`dev_byf` 领先 origin 108 条归类计数

口径：`origin/dev_byf..dev_byf`，逐条 `git show --name-only` 判是否触 `^(src|electron)/`。

- **62 条动了 `src/` 或 `electron/`**（产品代码：弧光提示词、characters、蓝图层 keyEvents、prompt 降载 P1/P7/P8、审稿链、批次工作流）。
- **46 条没动代码**，只动文档/脚本：`docs/design` 115 文件次、`docs/handoffs` 20、`docs/plans` 13、`docs/README.md` 6、`scripts/` 4。逐条看 subject 全是主线产品设计稿与交接稿（P1-1/P1-2/P1-3/P7/P8/P12-1/P11-1、keyEvents 四份设计稿、R5/R6 语义、M08 迁移段），**没有一条是插件或夜班产物**。
- 关键词扫描（`relay|handoff-relay|plugin|插件|wake|夜班|batch|豆包|workbuddy`）对 subject 零命中。
- 日期区间 2026-10-14 → 10-18（5 天 108 条，是 10 月中旬那波主线冲刺）。

⇒ 结论：dev_byf 是**纯主线产品分支**，不含工具链包袱；它没有"脏"的问题，只是**旧**。

## §3 问 ③：`exp/resource-ledger` 领先 origin 的 9+1 条

`origin/exp/resource-ledger..exp/resource-ledger` 现在 10 条（取证期间 HEAD 又前进一格，多出 `151d0fea`）。逐条：

| # | sha | 日期 | subject | 性质 |
|---|---|---|---|---|
| 1 | `151d0fea` | 11-14 | chore(git): 夜班运行账本 `.batch` 与唤醒残留不入库 | 仓库卫生（本次取证期间由他人在 develop 提交，非我） |
| 2 | `27a557dd` | 11-13 | feat(scripts): wake-later 一次性调度器 | 夜班工具链 |
| 3 | `0cf92bee` | 11-13 | chore(dsh): 移除误入的唤醒插件目录（已迁 dsh-file-watch） | 夜班工具链（删 5 文件 −428） |
| 4 | `fadd95ef` | 11-12 | feat(dsh): WB-P1 唤醒插件最小探针（+报告 291 行） | 夜班工具链 |
| 5 | `a960d709` | 11-12 | test(h3): 裸 `rmSync` 改用 `discardTree` | 测试卫生（EPERM） |
| 6 | `bc5ab681` | 11-12 | test(qm-run): 两处 git-init 临时目录改 `discardTree` | 测试卫生 |
| 7 | `2bf24dd6` | 11-12 | test(temp-dir): rename 重试 + 按路径分流删除 | 测试卫生 |
| 8 | `2a98cbf3` | 11-12 | test: 消掉 7 条 ENOTEMPTY 噪声 | 测试卫生 |
| 9 | `1ba4819e` | 11-12 | vite.config 排除 `scripts/.tmp`（642→641） | 测试收集面一致性 |
| 10 | `978502e2` | 11-12 | test(hygiene): 修 ADR-0025 过时断言 | 测试卫生 |

`git cherry dev_byf exp/resource-ledger`：**`+` 543 条、`-` 0 条**。即这 10 条（及 exp 上其余提交）在 dev_byf 里**没有等价补丁**——它们只活在 exp 这条线上，dev_byf 上找不到。所以「把 exp 的 9 条 cherry-pick 回 dev_byf」是唯一能保住它们的搬法，但见 §5：不必搬。

性质归类：**零条主线产品代码**，10 条全是工具链/测试卫生/仓库卫生。

## §4 问 ④：工作区两处 + 未跟踪项，该提交还是 ignore

取证时（14:2x）实际状态已经变了——`.gitignore` 的改动**已被提交**为 HEAD `151d0fea`（14:24:59，`chore(git): 夜班运行账本 .batch 与唤醒残留不入库`）。所以现在：

**已干净**：`.gitignore`（+7 行：`/.batch/` 与 `/scripts/dsh/wakeup-inbox/*.md`，带两行注释）已入库。

**仍待处理（1 项已跟踪改动 + 13 项未跟踪）**：

| 项 | 判定 |
|---|---|
| `M docs/README.md`（+6/−2） | **该提交**。新增「写/调 DSH 插件翻车了」行指向 `design/harness/dsh-plugin-pitfalls/`；`design/product/` 14→15 篇加 `2026-11-13-relay-multicast-reflection.md`；`design/harness/` 2→4 篇加 pitfalls 与 `dsh-file-watch-plugin-design.md`。这三份新文档本身也是未跟踪项，须同批提交，否则 README 里的链接 404。 |
| `?? docs/design/harness/dsh-plugin-pitfalls/`、`?? .../dsh-file-watch-plugin-design.md`、`?? docs/design/product/2026-11-13-relay-multicast-reflection.md` | **该提交**（README 已引用） |
| `?? reports/*.md` 9 篇（共 116KB：db-d1-three-classes、fix-bare-rmsync、fix-collect-642、fix-hygiene-test、fix-temp-dir-eprem、implemented-not-verified-audit、p1b-migrate-plugin、p1c-close、weekly-2026-11-06_11-13） | **该提交**。`reports/` 是正式交付报告落点（`.gitignore` 注释明写「正式交付报告走 reports/ 入库」），现仅 1 篇在库。 |
| `?? scripts/dsh/wakeup-inbox/.gitkeep` | **该提交**（目录占位；同目录的 `dsh-wake-*.md` 投递残留已被新 ignore 规则挡住，不入库） |
| `?? .batch/**`、`?? .batch/doubao*/` | **ignore**，已被 `/.batch/` 覆盖。注意 `.batch` 里原有 4 个文件仍在索引中（`night/reports/CLAIM-WB-E1.md`、`S0.txt`、`S1.txt`、`fix-enotempty.md`）——ignore 规则不影响已跟踪文件，要清得单独 `git rm --cached`，**建议不折腾**（历史已入库、删了徒增噪音）。 |

工作区之外：`wt-1`、`wt-3` 各有未提交项，`night-probe`/`test-master` 是 detached 探测用 worktree。

## §5 问 ⑤：主线从哪条继续 + 理由

**建议：主线 = `exp/resource-ledger`，不搬、不改名、不重建。**

理由（按重要性）：

1. **只有它同时含全部产出**。`master` 0/796、`dev_byf` 0/551 都落在它里面；反过来切到 dev_byf 就丢 10-18 之后 541 条主线开发（弧光三修、结局四问、D 系列、Q4 计划都在里面）。这是唯一无争议的硬约束。
2. **它是远端唯一"活"的追投点**。`origin/exp` 已是 dev_byf 的超集，`origin/dev_byf` 是落后 108 条的孤儿；选 dev_byf 就意味着还要把 108 条重新推一遍、再 cherry 9 条工具链。
3. **10 条尾巴全是卫生类**，无产品代码，不存在"experiment 污染主线"的顾虑；名字里的 `resource-ledger` 是历史命名，不影响内容。

**落地手顺序（等负责人点头再动，我只是建议）**：

1. 先把 §4 那批（`docs/README.md` + 3 份新文档 + `reports/` 9 篇 + `.gitkeep`）在 `exp/resource-ledger` 上提交——**只在这个分支提交**，否则又要搬。
2. `git push origin exp/resource-ledger`（远端是本地严格子集，快进，无冲突）。
3. 分支名要不要"扶正"（如新建 `main-line` 并让它指向 `exp`）属组织口径，非技术必需；我建议**暂不改名**：改名要动 `wt-*` 与看板里写死的分支引用，收益只是好看。
4. `origin/dev_byf` 的 108 条只差不在远端，**维持现状即可**，不必为它单推一次；若一定要对齐，用 `git push origin exp/resource-ledger:dev_byf` 之外的显式做法前先问一句，避免误覆盖别人的分支。

**另有一条与主线选择无关、但须登记的既有分叉**（不在本卡范围，只给事实）：`upstream-baseline` 上的 143 条不在 `exp` 里（`upstream-baseline...exp` = 143/783），`master` 是 `upstream-baseline` 的祖先（146 条差距）。即用 upstream 做对齐基准这条路**现在就断着**，和分支选择是两件事，不要混在一轮里改。

## §6 证据命令（可原样复跑）

```powershell
cd C:\develop\workspace\AI-writer\develop
git rev-list --left-right --count master...dev_byf                  # 0 245
git rev-list --left-right --count master...exp/resource-ledger      # 0 796
git rev-list --left-right --count dev_byf...exp/resource-ledger     # 0 551
git rev-list --left-right --count origin/dev_byf...dev_byf          # 0 108
git rev-list --left-right --count origin/exp/resource-ledger...exp/resource-ledger  # 0 10
git branch -r --contains dev_byf                                    # 仅 origin/exp/resource-ledger
git cherry dev_byf exp/resource-ledger | Group-Object { $_.Substring(0,1) }   # + = 543, - = 0
git log --format="%h %ad %s" --date=short origin/exp/resource-ledger..exp/resource-ledger
git status --porcelain -uall
```

<!-- DONE -->
