执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-1118-B 报告 · 分叉收口（A 方案）＋未跟踪件归位

- 卡面：`.batch/night/cards/CARD-1118-B-fork-close.md`（4,418B）
- 派验单受验版：`.batch/night/review-requests/CARD-1118-B-fork-close.v4.md`（6,553B / 76 行），v1–v3 留档不采用
- 分支：`work/reboot-1118`　HEAD：`27971070`　提交数：本卡 **0**
- 报告时刻：2026/11/18 10:58:53

## 一、开工校验（四项，含 v4 新增的「目标族 ls」）

| 项 | 实做 | 输出 |
|---|---|---|
| 1 拓扑起点 | `git rev-parse --short HEAD` / `--abbrev-ref HEAD` | `1dd9e948` / `exp/resource-ledger` |
| 2 未跟踪件基线 | `git status --porcelain \| grep -c '^??'` / `wc -l` | **100 / 101**（10:34 快照；卡面原写 96 系估计值，v4 已作废） |
| 3 目标族 `ls` | `ls .batch/night/cards/CARD-1118-B-fork-close.md` 等目标族 | 卡面 4,418B 存在；`.batch/night/archive/` 在本分支**不存在** |
| 4 分支命名占用 | `git branch --list 'archive/local-rebuilt-1118'` / `'work/reboot-1118'` | 均为 0 条（新建前） |

**切分支是谁做的：我（developer）本人**，10:33–10:36 在 develop 一次跑完：

```
$ git branch archive/local-rebuilt-1118 1dd9e948
$ git rev-parse --short archive/local-rebuilt-1118
1dd9e948
$ git switch -c work/reboot-1118 origin/exp/resource-ledger
Switched to a new branch 'work/reboot-1118'
M       .batch/night/org/BACKLOG.md
```

切分支后 `BACKLOG.md` 的本地改动（B-7／B-8／B-9 三条）**未丢**（`M` 保留）。`git switch` 自动建立的 upstream 已 `git branch --unset-upstream work/reboot-1118` 解除，以满足判据 8。

## 二、判据（命令 + 实输出 + exit）

| # | 命令 | 实输出 | exit | 结论 |
|---|---|---|---|---|
| 1 | `git branch --list 'archive/local-rebuilt-1118'`；`git rev-parse --short archive/local-rebuilt-1118` | `archive/local-rebuilt-1118`；`1dd9e948` | 0 / 0 | 恰一条，指向 `1dd9e948` |
| 2 | `git rev-parse --abbrev-ref HEAD`；`git merge-base HEAD origin/exp/resource-ledger` | `work/reboot-1118`；`27971070` | 0 / 0 | 等于 `origin/exp/resource-ledger` 的 `27971070` |
| 3 | `git rev-list --count origin/exp/resource-ledger..HEAD` | `0` | 0 | **0**，本卡未产生任何提交 |
| 4 | 开工前后 `grep -c '^??'` / `wc -l` | 开工 `100 / 101`；切分支瞬间 `100 / 101`；交件前 `92 / 103` | 0 | 总数不减；开工那 100 件逐件仍在（见 §四 全量清单，暂存 12 件以 `A ` 形式在） |
| 5 | `git diff --quiet HEAD origin/exp/resource-ledger` | 无输出（零差异） | 0 | 零差异（`--stat` 空输出，非失败） |
| 6 | `grep -rn '<用户名>' scripts/ops/ \| wc -l`（等价：逐文件计数 `scripts/ops/*.{js,mjs}`） | `0` | 0 | 0 |
| 7 | 本报告 §四／§五／§六 三类清单 | 见下 | — | 齐 |
| 8 | `git status -sb \| head -1`；`git branch -vv \| grep reboot` | `## work/reboot-1118`；`+ agent/p51-median           c6c064ff (C:/develop/workspace/AI-writer/wt-p51) fix: count empty chapters as zero in last-10-chapter median
+ agent/p56-wb-docs          7478b44a (C:/develop/workspace/AI-writer/wt-p56) docs(agents): 修正 --cwd 判据并清 Hy4 残档（p56）
+ agent/wt-1                 ed02e707 (C:/develop/workspace/AI-writer/wt-1) docs(handoff) 夜班 digest 补作者六条裁定与两张夜间卡
+ agent/wt-2                 23942f08 (C:/develop/workspace/AI-writer/wt-2) feat(workbuddy): allow extra pinned cwds via WORKBUDDY_ALLOWED_CWDS
+ agent/wt-3                 e2ecf348 (C:/develop/workspace/AI-writer/wt-3) docs(handoff) R2 存量红收尾与验证交接：三阶段 browser 命令 + 两项实机判定树 + 回滚点
  archive/local-rebuilt-1118 1dd9e948 merge(card/git-track-ops-1117): 工作方式回到标准 Git 流程（A/D/E/B/F 五卡，验收后落主线）
+ card/1117-A                66fbe0ee (C:/develop/workspace/AI-writer/wt-1117a) docs(ops): 产出脚本去三元组、机检去行数（CARD-1117-A）
+ card/1117-B                4fa4a4bd (C:/develop/workspace/AI-writer/wt-1117b) CARD-1117-B 收编 .batch/night 协作件：首次入库、历史件归档、baseline 195→194
+ card/1117-C                6770841a (C:/develop/workspace/AI-writer/wt-1117c) docs(ops): 裁定工作方式回到标准 Git 流程（CARD-1117-git-track-ops）
+ card/1117-D                c7595e0a (C:/develop/workspace/AI-writer/wt-1117d) CARD-1117-D pre-commit 机检：尾行换行/禁 vN 文件名/缺卡号提醒
+ card/1117-E-hygiene-scope  f7355255 (C:/develop/workspace/AI-writer/wt-1117e) fix(ops): 机检生效面改为已跟踪路径，历史件走 baseline 冻结（CARD-1117-E）
+ card/1117-F                1ee92e87 (C:/develop/workspace/AI-writer/wt-1117f) chore(ops): CARD-1117-F 机检收尾——删 baseline 机制、archive 尾行豁免、版本号改同目录主件判据
  card/git-track-ops-1117    0988f274 docs(batch): 入库 CARD-1117-F 终审快照与 rulings，BACKLOG 记 B-6
  dev_byf                    b9342be9 docs: 合并 README 里重复的插件指路句
  docs/bot-session-identity  92ae6cba docs: 修正 bot-session-identity 关于重启与 session id 的两处错误表述
+ docs/fix-workbuddy-links   9b654d96 (C:/develop/workspace/AI-writer/wt-docfix) docs: 修 2 条指向 .workbuddy 的断链（改为代码块引用）
  exp/arc-tree-v2            9533d878 docs(architecture): AC5 数值一致性立项 + 世界状态评审与接线方案
  exp/resource-ledger        1dd9e948 merge(card/git-track-ops-1117): 工作方式回到标准 Git 流程（A/D/E/B/F 五卡，验收后落主线）
  exp/world-state            bb672f42 docs(world-state): W6 资源账本与 W7 前置注入立项；六槽闭环总纲；补齐 5 个评审缺口
  keep/d9-d16                a800192f feat(D9): 单次调用超时三态 + 失败终态落库（机制就绪，未接线）
  keep/night-w1-w5           78e1c17c On agent/wt-2: night w1-w5 snapshot 2026-11-09
  master                     dbad51d7 Merge pull request #331 from EthanYoQ/codex/intel-unit-budget
  upstream-baseline          8afec2a1 Merge pull request #381 from EthanYoQ/claude/rd-4-run-sheet
* work/reboot-1118           27971070 merge(card/git-track-ops-1117): 工作方式回到标准 Git 流程（A/D/E/B/F 五卡，验收后落主线）` | 0 / 0 | 无 `[behind]`、无 `[origin/…]` 上游 |
| 9 | 首行／第二行／末行 | 见文件头尾 | — | 逐字一致 |

补充（判据 5 的另一种写法，同样为空）：

```
$ git diff --stat HEAD origin/exp/resource-ledger | tail -1
(空输出)
```

## 三、红线自检

| # | 红线 | 自检 | 结论 |
|---|---|---|---|
| 1 | `push`／`--force`／`rebase`／merge 无关历史 | 全流程未执行 | 未触发 |
| 2 | `git add -A`／`git add .`／`-f` | 仅 `git add -- <逐条路径>`（见 §七） | 未触发 |
| 3 | 删除任何文件或目录 | 本卡 0 删除（`git status` 无 `D` 行） | 未触发 |
| 4 | 产生提交 | `rev-list --count`＝0 | 未触发 |
| 5 | 改 `.gitignore`／notice／源码语义／两族 `ledger-*` | `git status` 里无 `.gitignore` 改动；`ledger-append-1117-hy4flash-auth*` 与主件字节未动（只有既有 `??` 版本件，本卡未 ack／未暂存） | 未触发 |
| 6 | 同字节 `.vN` 重复件入库 | 2 件（`v7`、`rules-review-docs-1116.v2.md`）**未入库**，见 §六.1(a) | 未触发 |

## 四、三类归位清单

计数口径（v4 §二.4）：`git status --porcelain` 共 **103 行** = `??` **92** ＋ `A ` **12**。细分（92 件未跟踪）：真历史版本件 47、无主件版本件 36、db 类 5、voided 1、其余待判 3；另 2 件同字节重复件已移入 `archive/`（不计入 `??`）。

### 4.1 第一类 `.batch/night/**`

**（1）现行件 —— 入库（暂存 12 件，未提交）**

| 路径 | 字节 | MD5 | 类别 |
|---|---:|---|---|
| `.batch/night/cards/CARD-1118-B-fork-close.md` | 4,440 | `7cbeff53ade7292c13f676434575c340` | `.batch/night` 现行件 |
| `.batch/night/cards/CARD-1118-reboot-first.md` | 4,055 | `d20721b9cd4e223bebdfaae80d883992` | `.batch/night` 现行件 |
| `.batch/night/reports/CARD-1117-F-qa-firstcheck.md` | 8,563 | `ce8a87a47522eee87ab1ffedc87293ea` | `.batch/night` 现行件 |
| `.batch/night/reports/CARD-1118-reboot-first-qa-firstcheck.md` | 8,534 | `5a6535139ff04f27b953444596590881` | `.batch/night` 现行件 |
| `.batch/night/reports/merge-B-into-integration-1117.md` | 4,707 | `5708d89a903e29d582dd391a508abd6a` | `.batch/night` 现行件 |
| `.batch/night/review-requests/CARD-1118-B-fork-close.md` | 3,864 | `ec346c3cc1b13838235e582bdee2b739` | `.batch/night` 现行件 |
| `.batch/night/review-requests/CARD-1118-reboot-first-rulings.md` | 3,114 | `be7266b53b411ac79c38ac3f704caf5c` | `.batch/night` 现行件 |
| `.batch/night/staging/add-state-header-f.sh` | 1,331 | `2e3ea26817fe2f218bb8644a6ae6fcf3` | `.batch/night` 现行件 |
| `.batch/night/staging/f-final-verdict.sh` | 3,973 | `d8a98226f1e72af8c384196a73b00854` | `.batch/night` 现行件 |
| `reports/evidence-receipt-side-1116.md` | 3,179 | `5b8718e5bd3fd10be185bec4cfcd1c7a` | `reports/` 说明件 |
| `reports/hy4-modelname-probe-20261117.md` | 4,512 | `8088caa261db2bb5f66562688308956a` | `reports/` 说明件 |
| `reports/wo-hy4-modelname-20261117.md` | 2,412 | `9b6d6346ff5e96e8b7a4b8ffca29702d` | `reports/` 说明件 |

**（2）`*.vN` 与主件同字节重复件 —— 不入库、不删，已按 §6.1(a) 移入 `archive/` 留盘待去重（2 件）**

| 重复件（新位置） | 字节 | MD5 | 同字节主件 | 主件 MD5 |
|---|---:|---|---|---|
| `.batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md` | 10,820 | `91bdbf8ee88cc04d91ef500c3139df27` | `.batch/night/org/ledger-append-1117-hy4flash-auth.md` | `91bdbf8ee88cc04d91ef500c3139df27` |
| `.batch/night/archive/staging/rules-review-docs-1116.v2.md` | 3,703 | `353ca52c653d4db109bd65ff83f5d72b` | `.batch/night/staging/rules-review-docs-1116.md` | `353ca52c653d4db109bd65ff83f5d72b` |

`md5sum` 两行自证（移入后原地复算，字节未变）：

```
$ md5sum .batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md
91bdbf8ee88cc04d91ef500c3139df27  .batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md
$ md5sum .batch/night/org/ledger-append-1117-hy4flash-auth.md
91bdbf8ee88cc04d91ef500c3139df27  .batch/night/org/ledger-append-1117-hy4flash-auth.md
$ md5sum .batch/night/archive/staging/rules-review-docs-1116.v2.md
353ca52c653d4db109bd65ff83f5d72b  .batch/night/archive/staging/rules-review-docs-1116.v2.md
$ md5sum .batch/night/staging/rules-review-docs-1116.md
353ca52c653d4db109bd65ff83f5d72b  .batch/night/staging/rules-review-docs-1116.md
```

原路径 → 现路径：`.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md` → `.batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md`；`.batch/night/staging/rules-review-docs-1116.v2.md` → `.batch/night/archive/staging/rules-review-docs-1116.v2.md`。`archive/` 在 `.gitignore` 的 `/.batch/night/*` 之下（未放行），故「移入」＝不入库、仅留盘；目录已按「留档目录须有 README」补 `.batch/night/archive/README.md`（谁建/何时/用途/保留期/过期归属）。

**（3）真历史版本件（与主件不同字节）—— 不入库、留盘原地（47 件）**

| 路径 | 字节 | MD5 |
|---|---:|---|
| `.batch/night/cards/p31-dedupe-persist.v2.md` | 8,240 | `6a6a1feca14a2f95cd7fe11fcde77f90` |
| `.batch/night/cards/p51-median-gap.v2.md` | 4,279 | `146c148b43027626c9feb2c4625200b7` |
| `.batch/night/cards/p51-median-gap.v3.md` | 6,866 | `9276adeb74c8cb9f9b5a4d57605e7cb3` |
| `.batch/night/cards/p54-fix3-to8.v2.md` | 3,762 | `83f53ec0427ad642d8d6e70f25438c9f` |
| `.batch/night/cards/p54-fix3-to8.v3.md` | 3,762 | `83f53ec0427ad642d8d6e70f25438c9f` |
| `.batch/night/cards/p54-fromto-inject.v1.md` | 7,914 | `66c7197b6876f3b4dbda29913df99214` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v1.md` | 4,288 | `8b4e25730a7ccf0c0d2544d730114a11` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v2.md` | 5,438 | `9896c4ead87af99a36ff112ba2707d27` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v3.md` | 7,098 | `01642169fd33a256e304e32ca1502d92` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v4.md` | 7,830 | `64dc885381eca032d8301b9eaae9a3b1` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v5.md` | 8,973 | `4587a4b00aef07245b613d1c62faea60` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v6.md` | 9,927 | `e70654eebbbd09f56acca62990be5fd3` |
| `.batch/night/org/ledger-append-1117-hy4flash-auth.v8.md` | 10,632 | `d05701dc6b6046bb17064213a87755a8` |
| `.batch/night/review-requests/CARD-1118-B-fork-close.v2.md` | 4,141 | `e4b62d7de65f2be66c186faeb212ee6c` |
| `.batch/night/review-requests/CARD-1118-B-fork-close.v3.md` | 4,446 | `348076af228a41cae5f555c1e986274b` |
| `.batch/night/review-requests/CARD-1118-B-fork-close.v4.md` | 6,553 | `7e5ac3223c3f06334c12111fd1c0674c` |
| `.batch/night/review-requests/d1-delivered-path.v2.md` | 6,802 | `24f8104fccd151d57cda7724dcfab22e` |
| `.batch/night/review-requests/d1-delivered-path.v3.md` | 8,288 | `a064f4c327ab244782c2cbdd5dabce56` |
| `.batch/night/review-requests/p31-v2.md` | 3,125 | `359cfda0f3e22cec1d941ddb5f0f346c` |
| `.batch/night/review-requests/p51-v2.md` | 3,778 | `fa150db9da0bc5d141380163c574c722` |
| `.batch/night/review-requests/p54-fix3-to8.v2.md` | 4,624 | `fab885d7e76fbe7e92ad0907c385145f` |
| `.batch/night/review-requests/p56.v2.md` | 3,660 | `52c000c2278c28479166b54d26683f5d` |
| `.batch/night/review-requests/p56.v3.md` | 3,976 | `94587fc0a6009e5e8118a2b0b3f07f33` |
| `.batch/night/review-requests/p56.v4.md` | 4,087 | `7eab7507f9c6eaaf29f7d5e4e4813339` |
| `.batch/night/review-requests/p56.v5.md` | 4,370 | `67246cd61b5db7cd5e5e01d6a32ad1a5` |
| `.batch/night/review-requests/reboot-hy4flash-sync.v2.md` | 3,471 | `0262c9d4bdfbdd92b2ec030bcb0e7c2a` |
| `.batch/night/staging/d1-delivered-path-report.v2.md` | 11,466 | `51ce510fc5b57f4923fd01dd9cbaeea0` |
| `.batch/night/staging/d1-precheck-1117.v2.md` | 7,135 | `83dbd11a5175a7463f42d6a99c6b6b55` |
| `.batch/night/staging/d1-precheck-1117.v3.md` | 8,032 | `fed2788c40403c49dc75813191f0a34e` |
| `.batch/night/staging/d1-precheck-1117.v4.md` | 8,305 | `7f4348e70c13a85f50b1347cec3afb5c` |
| `.batch/night/staging/doubao-liaison-handoff.v2.md` | 2,258 | `33d057e32884fff03ecbae2d14830f83` |
| `.batch/night/staging/doubao-liaison-handoff.v3.md` | 2,643 | `22c4e7955a537781f58c23be89aeb454` |
| `.batch/night/staging/incident-plugin-push-1116.v2.md` | 7,089 | `944403fb10df3c3b90694693432193af` |
| `.batch/night/staging/no-at-count.v2.mjs` | 1,833 | `fd145ba9d80b1b7c46031017d818a22a` |
| `.batch/night/staging/no-at-count.v3.mjs` | 1,737 | `fb36434a708669a1d36cff704eb70a44` |
| `.batch/night/staging/owner-config-fix-1116.v2.md` | 3,341 | `9a40f7d2331f5bc4f80131c64930ac3e` |
| `.batch/night/staging/owner-config-fix-1116.v3.md` | 3,489 | `95f4204a67479dc5c432fab2af2a34f0` |
| `.batch/night/staging/owner-config-fix-1116.v4.md` | 1,631 | `a098fb729227e4a05cfcf016ff4c132b` |
| `.batch/night/staging/owner-config-fix-1116.v5.md` | 1,851 | `cc3a771e7ce1bf628d1d037df0643cda` |
| `.batch/night/staging/p54-realmachine-1115.v2.md` | 6,718 | `3c177c60fe42994f8b79efa3ce518a90` |
| `.batch/night/staging/p56-report.v2.md` | 12,080 | `bf08891d7e81d4493733c0a932ba1b2e` |
| `.batch/night/staging/rules-example-acceptance.v2.md` | 5,780 | `2524ba6abde3e2209036adf4ddb9e906` |
| `.batch/night/staging/rules-example-acceptance.v3.md` | 6,438 | `8d823ee860f788cd91f363947329b797` |
| `.batch/night/staging/to-owner-watch-diagnosis-1116.v2.md` | 6,071 | `74128bd0c0d55fe11f0692bfcf9e1936` |
| `.batch/night/staging/wt2-merge-backout-plan-1116.v2.md` | 11,421 | `c10a30b8d2a19b287712c738ab01b03e` |
| `.batch/night/staging/wt2-merge-backout-plan-1116.v3.md` | 13,825 | `efca7f3aa4421145488b7d992dca4b19` |
| `.batch/night/staging/wt2-merge-backout-plan-1116.v4.md` | 15,513 | `85d31ce0405a17f32ea2f789af1531e2` |

**（4）无主件的版本件（主件缺失，属 §6.1 唯一例外，**报负责人逐件裁、未改名、未动字节**）（35 件）**

| 路径 | 字节 | MD5 |
|---|---:|---|
| `.batch/night/cards/d1-delivered-path.v1.md` | 11,297 | `5fcb27765620391c461194b28ca37cff` |
| `.batch/night/cards/d1-delivered-path.v2.md` | 13,188 | `f6c168e3992ab5236aebd1d50deb0cfb` |
| `.batch/night/cards/d1-delivered-path.v3.md` | 13,853 | `f52a88f1df5ad938f78d9948dae3b3b1` |
| `.batch/night/cards/d1-delivered-path.v4.md` | 13,854 | `c24ecb09a17b3514c647157c7efce752` |
| `.batch/night/cards/d1-delivered-path.v5.md` | 14,183 | `e8a797f435f659873fe97bb5d305aba6` |
| `.batch/night/cards/p55-pinned-cwd-allowlist.v1.md` | 10,041 | `72592e3aba155b0978cac12dbb33ce29` |
| `.batch/night/cards/p55-pinned-cwd-allowlist.v2.md` | 10,216 | `a3203be6ed830045dbb9b34b40507a36` |
| `.batch/night/cards/p56-fix-report-header.v1.md` | 1,560 | `6657af782dda0d252c6835040e1eeb4a` |
| `.batch/night/cards/p56-wb-docs-stale.v1.md` | 7,946 | `c6758d19accfaf9cbe474bca5e1a307a` |
| `.batch/night/cards/p56-wb-docs-stale.v2.md` | 8,343 | `3fc6c277cdf08626ccbc92f285435502` |
| `.batch/night/cards/p56-wb-docs-stale.v3.md` | 8,844 | `05732b3bc6fb0f2127f84287446a88fb` |
| `.batch/night/cards/p56-wb-docs-stale.v4.md` | 8,855 | `deb5ce3ea244e8fb534cef4b1d96dcb0` |
| `.batch/night/cards/p56-wb-docs-stale.v5.md` | 8,952 | `e87714c5bb41732ad52d0dd8c7b7ea47` |
| `.batch/night/cards/reboot-hy4flash-sync.v1.md` | 9,820 | `34ebdc46e22ff9af34ca05c612acb90f` |
| `.batch/night/cards/reboot-hy4flash-sync.v2.md` | 10,616 | `0714a372d4da7616f6f0fd52402905fc` |
| `.batch/night/cards/wb-rules-example.v1.md` | 6,983 | `62bcf6efddc61e31e0ce82b307fc0706` |
| `.batch/night/org/process-efficiency-assign-1116.v1.md` | 6,435 | `c253c67d74ebcbb1554c57cceec7c274` |
| `.batch/night/org/process-efficiency-draft-v1.md` | 6,201 | `410e8eaec10ed7a53b46c2daaf64e782` |
| `.batch/night/review-requests/merge-p55-into-develop.v1.md` | 2,719 | `571346a76526b4baf764a76b521a167a` |
| `.batch/night/staging/dispatch-schedule-endorse-doubao.v1.md` | 2,833 | `5f66b1e13dcd93da20d760d576c75e2f` |
| `.batch/night/staging/dispatch-schedule-endorse-doubao.v2.md` | 3,581 | `a65d0e26c7668ba4b7da4d12faf896ca` |
| `.batch/night/staging/dispatch-schedule-endorse-doubao.v3.md` | 6,471 | `26ec80e56d4bde0d64f8d24274908ae2` |
| `.batch/night/staging/dispatch-schedule-endorse-doubao.v4.md` | 7,157 | `7bec4ef6fbf478cf1a347095051658ca` |
| `.batch/night/staging/dispatch-schedule.v1.md` | 1,742 | `e5cdf73caa981c4f51ec766345878855` |
| `.batch/night/staging/dispatch-schedule.v2.md` | 7,030 | `27d365a3813833b841817ae135f18b2a` |
| `.batch/night/staging/dispatch-schedule.v3.md` | 8,749 | `2cb471cbd7d910bdd7bc9c6484965385` |
| `.batch/night/staging/identity-copies/bot-session-identity.v2.md` | 4,252 | `cde2d475561326808f0ac915855fa2d3` |
| `.batch/night/staging/identity-copies/bot-session-identity.v3.md` | 4,252 | `cde2d475561326808f0ac915855fa2d3` |
| `.batch/night/staging/identity-copies/bot-session-identity.v4.md` | 4,528 | `679246f9550f12110de8817bd87abf72` |
| `.batch/night/staging/message-admission.v1.md` | 4,171 | `fc4d4c23a9914bef6169a28ef55f1107` |
| `.batch/night/staging/pointer-plan.v1.md` | 10,809 | `76edbd09e289c51704a9e5f4c5f969aa` |
| `.batch/night/staging/pointer-plan.v2.md` | 8,096 | `f615c3ae6b250a7ce98cae7931622ffc` |
| `.batch/night/staging/pointer-plan.v3.md` | 8,107 | `d7b4e27d06871ddafae51b451690bb25` |
| `.batch/night/staging/pointer-plan.v4.md` | 7,826 | `2152c8042a0de45a42e2f92427181cda` |
| `.batch/night/staging/wb-quota-schedule-1117.v1.md` | 4,896 | `662ca0441fb4762999f79b8ea0656e90` |

**（5）db／wal／shm 留盘不入库（5 件）与 voided（1 件）**

| 路径 | 字节 | MD5 |
|---|---:|---|
| `.batch/night/staging/project.db-shm` | 32,768 | `b7c14ec6110fa820ca6b65f5aec85911` |
| `.batch/night/staging/project.db-wal` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `.batch/night/staging/samples-02/.ai-novel/project.db` | 1,261,568 | `3a6d6ee13fdda0779fae87abfc9e0d7b` |
| `.batch/night/staging/samples-02/.ai-novel/project.db-shm` | 32,768 | `b7c14ec6110fa820ca6b65f5aec85911` |
| `.batch/night/staging/samples-02/.ai-novel/project.db-wal` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `.batch/night/staging/voided/owner-config-fix-1116-correction-1128.md` | 1,606 | `2d95686d36ad9fc6701c6e690924a102` |

### 4.2 第二类 `.c/` ＋ `reports/hy4-*`

| 路径 | 字节 | 处置 |
|---|---:|---|

| `.c/develop/workspace/AI-writer/develop/.batch/night/staging/message-admission.v1.md` | 4,143 | 路径转义影子件 ⇒ 留盘不动、不入库、不删，按 §6.2 报负责人裁 |

### 4.3 第三类 其余

| 路径 | 字节 | 处置 |
|---|---:|---|
| `.gitignore.bak-20261117-gitwhitelist` | 1,871 | 留盘不入库；无「谁建/保留期/过期归属」说明 ⇒ 进 BACKLOG 待认领（§6.2） |
| `scripts/workbuddy/space-readonly-check.mjs` | 5,012 | 有用途注释但缺保留期与过期归属 ⇒ 留盘待认领（B-8 已登记），本卡未入库、未改字节 |
| `reports/wo-hy4-modelname-20261117.md` | 2,412 | 有派单出处 ⇒ 入库（已暂存） |
| `reports/hy4-modelname-probe-20261117.md` | 4,512 | 有执行方标头 ⇒ 入库（已暂存） |
| `reports/evidence-receipt-side-1116.md` | 3,179 | 有执行方标头 ⇒ 入库（已暂存） |

## 五、§6.3 已暂存 12 件的复核

12 件暂存件逐件比对 §6.1 二分口径：**无一属（a）同字节重复件**（全部为无版本号的现行件或说明件），故全部保留暂存，无需 `git restore --staged`。

```
$ git diff --cached --name-only | wc -l
12
A  .batch/night/cards/CARD-1118-B-fork-close.md
A  .batch/night/cards/CARD-1118-reboot-first.md
A  .batch/night/reports/CARD-1117-F-qa-firstcheck.md
A  .batch/night/reports/CARD-1118-reboot-first-qa-firstcheck.md
A  .batch/night/reports/merge-B-into-integration-1117.md
A  .batch/night/review-requests/CARD-1118-B-fork-close.md
A  .batch/night/review-requests/CARD-1118-reboot-first-rulings.md
A  .batch/night/staging/add-state-header-f.sh
A  .batch/night/staging/f-final-verdict.sh
A  reports/evidence-receipt-side-1116.md
A  reports/hy4-modelname-probe-20261117.md
A  reports/wo-hy4-modelname-20261117.md
```

## 六、§6.1 与 §6.2 裁定的执行情况

### 6.1（a）同字节 ⇒ 见 §4.1(2)，2 件，已移入 `archive/`（不入库、不删、字节未变）。
### 6.1（b）真历史版本 ⇒ 见 §4.1(3)，47 件，原地留盘、清单已进本报告与 BACKLOG。
### 6.1 唯一例外 ⇒ 见 §4.1(4)，35 件无主件版本件，逐件列出待裁，未改名顶替。
### 6.2 ⇒ `.gitignore.bak-20261117-gitwhitelist` 留盘＋BACKLOG；`.c/` 影子件留盘待裁；`space-readonly-check.mjs` 留盘待认领（B-8）。

**§6.1(a) 的落地方式**：2 件同字节重复件已**物理移入** `.batch/night/archive/`（`org/`、`staging/` 两个子目录），移动前复算 MD5、移动后原地复算，字节未变（见 §4.1(2) 的两行 `md5sum` 自证）。`archive/` 在 `.gitignore` 的 `/.batch/night/*` 之下未放行，故「移入」＝不入库、仅留盘；目录已按「留档目录须有 README」补 `.batch/night/archive/README.md`（谁建/何时/用途/保留期/过期归属）。回滚方式：`mv` 回原路径即可，原路径见 §4.1(2) 的「原路径 → 现路径」行。

## 七、逐条 `git add` 命令原文

```
git add -- .batch/night/cards/CARD-1118-B-fork-close.md
git add -- .batch/night/cards/CARD-1118-reboot-first.md
git add -- .batch/night/reports/CARD-1117-F-qa-firstcheck.md
git add -- .batch/night/reports/CARD-1118-reboot-first-qa-firstcheck.md
git add -- .batch/night/reports/merge-B-into-integration-1117.md
git add -- .batch/night/review-requests/CARD-1118-B-fork-close.md
git add -- .batch/night/review-requests/CARD-1118-reboot-first-rulings.md
git add -- .batch/night/staging/add-state-header-f.sh
git add -- .batch/night/staging/f-final-verdict.sh
git add -- reports/evidence-receipt-side-1116.md
git add -- reports/hy4-modelname-probe-20261117.md
git add -- reports/wo-hy4-modelname-20261117.md
```

## 八、偏差与待办

1. 本卡 **0 提交**：12 件只进索引，等收编卡连同本次归位一起落库。
2. §6.1(a) 的 2 件已物理移入 `archive/`（`org/`、`staging/`），MD5 前后一致，见 §4.1(2)；`archive/README.md` 为留档说明，本身被 ignore、不入库。
3. `BACKLOG.md` 追加了 B-10／B-11／B-12 三条（见同目录 BACKLOG），属本地 `M`，本卡不提交。
4. 判据 4 的「后值总数」口径按 v4 执行：总数从 101 变为 103（含新增派验单 v4 与本次 staging），开工那 100 件逐件在列。

<!-- DONE -->
