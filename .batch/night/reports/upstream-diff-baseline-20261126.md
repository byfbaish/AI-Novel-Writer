# 上游差异评估 · 分叉点定案与分类口径

- 出单：项目总负责人（AI writer项目组群分身）· 2026-11-26 21:05
- 依据件：`.batch/night/reports/upstream-diff-task-20261126.md`（大管家派活，主人原话：不能完全 merge，某些路线已完全不同，但上游修的 bug 与新增 feature 可用）
- 性质：只读评估，不 merge、不 cherry-pick、不 push、不动 develop

## 一、分叉点定案（每条可复算）

1. **上游仓已改名**：`EthanYoQ/AI-Novel-Writer` → `EthanYoQ/Pagekin`（API `repositories/1275436512` 200，`full_name: EthanYoQ/Pagekin`，`pushed_at: 2026-11-26T12:38:57Z`）。旧名靠 301 重定向仍可用，但口径按新名记。
2. **我方基线 = 上游 `549522d4`**（`#381 rd-4-run-sheet`，2026-10-14 03:43 +0800）。
   - 上游该提交树：`ecca898653fcd98b69c9870ec6ecf4063be26a4d`
   - 本地 `upstream-baseline`（`8afec2a1`）树 = `ecca8986…`
   - 本地 `relive-src/upstream-baseline`（`5ee50c2a`）树 = `ecca8986…`
   - ⇒ 两个本地 baseline 都是上游同一快照的副本，**树完全相同**；`549522d4` 与 `5ee50c2a` 在上游 API 均 200，`8afec2a1` 返回 422（上游不存在，是重写副本）。
3. **禁用两个假分叉点**：`git merge-base HEAD upstream-baseline` 无解（重写史无共同祖先）；`git merge-base HEAD relive-src/upstream-baseline` = `dd04d3e9`（10-10，`#337`）——这是重写史造成的假祖先，**不是**真实分叉点，不得据此算增量。
4. **增量**：`compare/549522d4...master` → `status ahead / ahead_by 4348 / behind_by 0 / total_commits 4348`；master 尖端 `32f4f7f8`（`#851`，2026-11-26T12:38Z）。注意 compare 的 `commits[0]` 是**最旧**一笔（`dec32be0`，10-14），别当尖端。
5. **我方相对基线**：`git diff --name-only upstream-baseline HEAD | wc -l` = **2750** 文件；`git diff --shortstat` = **+321,128 / −27,782**。

## 二、取数通道（实测，别重试死路）

| 通道 | 实测 | 用法 |
|---|---|---|
| `api.github.com` | 通，0.3s；未认证 60/h（已用 12） | 用 MCP GitHub 工具（认证 5000/h）拿提交清单与 patch；裸 curl 省着用 |
| `codeload.github.com` | 通且快：master tarball 114.85MB / 9.5s | 需要整棵上游树做逐文件对照时用 |
| `github.com:443`（git 协议） | 不通：connect 20s 超时 | 别试 |
| `ssh git@github.com` | 小查询通；大流量 fetch 到 ~4MB 静默失败、ref 未更新 | 别在这条路上等 |

本地 `upstream/*` refs 只到 2026-10-14（`8afec2a1`/`5ee50c2a`），**没有**新对象；不要假定 `upstream/master` 是新的。

## 三、分类口径（4348 笔 → 可评集）

不逐笔评 4348 笔，先聚簇再定性：

- **P0 去 merge**：只对 master 上的非 merge 提交定性；merge 提交只在清单留一行标题，不单列判断。（4348 里含大量 agent 分支 merge，是虚高主因。）
- **P1 路径映射**：上游改到的路径 ∩ 我方 HEAD 树中存在的路径；交集为空 ⇒ 整簇直接归 C（方向冲突/我方没有的目录）或 B（方向有价值），不逐笔评。我方重命名过的路径要建映射表，映射不出按 C 记并注明。
- **P2 逐条定性**：只有「触碰我方已有文件」的提交进逐条表，每条必须落 **A1 / A2 / B / C**，不许「待定」。
  - **A1**：隔离 worktree 里 `git apply --check` 或 `git cherry-pick -n` 真能打上；落点指到函数/内容。
  - **A2**：需改写，写明改写点与原因。
  - **B**：方向有价值、实现绑在 RD 重设计线（`src/components/run/`、`scripts/redesign/`、新外壳）；写「借什么、为何不能直取」。
  - **C**：与现行路线冲突或已被我方更先进方案取代；写冲突点与替代物。
- **禁**：凭标题定性（标题写 fix 实际只改名的降 C 或单列）；按行号定位（我行号对不上是常态，一律按内容）；语料/密钥/PII 类一律 C，不给吸收建议；破坏 worktree 隔离或加新依赖的单独列风险段。

## 四、输出规模上限

- 逐条表 ≤ 120 行；超出部分按簇一行汇总（簇名、笔数、代表 sha、方向判定、A 类条数）。
- 机器可读清单另存 `upstream-diff-inventory.tsv`（`sha<TAB>date<TAB>title<TAB>files_n<TAB>theme<TAB>class`），全量 4348 行都在这里，正文只放可评集。

## 五、分工与交付

- **developer**：主笔，按本口径出可评集与逐条定性（只读，不写生产码、不 commit 进 develop）。
- **QA**：只核 A 类「真能打上」的实证（apply/cherry-pick 结果），不评上游好坏。
- **项目总负责人**：分叉点与口径（本件）、统筹、台账与看板。
- 交付：`.batch/night/reports/upstream-diff-eval-20261126.md` + `upstream-diff-inventory.tsv`；群里回报 ≤200 字；不直接打扰主人（主人在盲评）。
