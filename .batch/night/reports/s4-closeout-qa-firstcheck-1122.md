# S4 收口复判（QA 首验 · 2026-11-22 19:4x）

- 判定人：QA · AI writer项目组 | 57c8bd18
- 判定面（代码面）：HEAD `ec508ec18c7f77decf1ad7b2645909816de6cd22`（分支 `exp/mainline-1119`，与 `origin/exp/resource-ledger` 同 sha）
- 判定面（文档面）：四件**均未提交**（工作树 `M`/`??`），本判词按盘上文件判；判据①只能按入库提交复核
- 依据：清单 `.batch/night/staging/s4-qa-checkplan.md`（121 行 / 9,457B / `e2f2cffcbc9460198b7f6f4fbd93edbe26c14717edcd3f6b69260d0cc2784166`）四项＋第⑤⑥闸；收口件 `.batch/night/reports/s4-closeout-draft.md`（136 行 / 14,781B / `4c4931335d089729a6e4a95d562df624ece72e30aaefafcff983afd1526ef3d4`）§1.1–§1.4
- 本件不复用 11-21 同名旧判词（`S4-closeout-qa-check.md` 属上一轮），另起本文件

## 0. 结论

**S4 收口复判：不通过（不 PASS）。** 六项判据 4 项成立、1 项不成立、1 项待入库后复核：

| # | 判据 | 结果 |
|---|---|---|
| ① | 树干净（`git status --porcelain -uall` 空）＋ HEAD = 远端 ＋ 非 detached | **待入库后复核**（前置读数见 §1；现在是 7 项未提交，入库前不可判 pass） |
| ② | `pnpm check:fast` EXIT=0 ＋ `check-batch-hygiene --all` 0 项 | **成立** |
| ③ | 台账六卡行各一行＋四阶段行各一行，且带命令原文 | **成立**（含 1 条观察项） |
| ④ | 看板与缺陷稿逐条一致 | **不成立**（10 条稿 ✅ 而板 todo；3 条板 done 而稿 🟡；D20 待统一；D14/D19 无卡） |
| ⑤ | 证据路径可打开 | **成立**（D10 用仓内替代件，两段齐全） |
| ⑥ | `[live]` evidence 副本在 ＋ sha 相符 | **成立**（三份） |

判据级缺口只有 ④ 一条；① 属「入库后才可判」，不记不通过。修法见 §6。

## 1. 判据① 树干净与 HEAD（前置读数，入库后须重跑）

```
$ git status --porcelain -uall
 M .batch/night/cards/_CARD-TEMPLATE.md
 M .batch/night/reports/task-ledger.md
 M docs/design/product/live-pipeline-acceptance-defects-assessment.md
?? .batch/night/reports/s4-closeout-draft.md
?? .batch/night/staging/s3-d11-live-recheck-report.md
?? .batch/night/staging/s4-plan-proposal.md
?? .batch/night/staging/s4-qa-checkplan.md

$ git rev-parse HEAD                                   → ec508ec18c7f77decf1ad7b2645909816de6cd22
$ git rev-parse --abbrev-ref HEAD                      → exp/mainline-1119        （未 detached）
$ git ls-remote origin refs/heads/exp/resource-ledger  → ec508ec18c7f77decf1ad7b2645909816de6cd22 ; LSREMOTE_EXIT=0
```

- 现盘 7 项＝3 `M`＋4 `??`（含我自己的清单件 `s4-qa-checkplan.md`）。按第 13 条模板闸与 hygiene 口径，入库后应只剩 batch-hygiene 判不许入库的件，须逐条列路径与理由。
- 收口件 §1.3 `:80` 写「现 1 项：`?? ...s3-d11-live-recheck-report.md`」，与现盘 7 项不符——属**写时快照**，入库前须重报，否则读数冲突。

## 2. 判据② 两条命令（本机实跑，当前树）

```
$ pnpm check:fast ; echo CHECKFAST_EXIT=$?
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓
[check:fast] batch-hygiene ✓
[check:fast] 全部通过。
CHECKFAST_EXIT=0

$ node scripts/ops/check-batch-hygiene.mjs --all ; echo HYGIENE_EXIT=$?
0 项不合规
HYGIENE_EXIT=0
```

**成立。** 说明：这是我 19:2x 与 19:3x 两次各自实跑的结果（第二次在缺陷稿/收口件改版之后），末行与退出码原文如上。

## 3. 判据③ 台账

- 六卡行：`886`–`891`，D4／D7／D16／D10／D11／D11b **各一行**，结论词全为 `PASS`，每行带 `git show <sha>:<判词> | wc -lc` 原文（如 `233 17869`、`151 11739`、`204 12533`、`187 12561`）。
- 四阶段行：`895`–`898`，S1／S2／S3 为 `pass（…）`＋rc=0 原文，S4 为「待 QA 四项与本件入库」——与本次判定的时点一致。
- **观察项**：全文件 `| S4 |` 共 4 行（`861`／`862`／`863` 属 11-21 上一轮 S4 记录，`898` 为本轮）；按「只追加不改既有条目」不得改动旧行，但**判据③「四阶段行各一行」在字面上会被读成 4 行 S4**。建议在本轮四行前加一句「以下 S1–S4 行为 11-22 口径，上方 `:860`–`:863` 属 11-21 上一轮」，否则收口时容易被误读为重复条目。
- **成立**（带上述观察项）。

## 4. 判据④ 看板与缺陷稿逐条一致 —— 19:36 首测不成立（改板后复判见 §8）

比对办法取收口件 `:85` 自订规则：①缺陷稿标 ✅ 的 D 项，看板不得留 todo/in-progress；②看板 done 的卡，缺陷稿该行必须 ✅ 或显式（作废/待裁）。

看板读数（只读接口 `task_board_list`，2026-11-22 19:36 取）：`revision 891`、`total 153`、`done 125`／`todo 22`／`backlog 3`／`running 2`／`failed 1`／`archived 1`。

### 4.1 违反规则①：稿 ✅ 而看板 todo（10 条）

| D | 缺陷稿 | 看板主卡状态 |
|---|---|---|
| D1 | ✅ S2 收口 | todo |
| D3 | ✅ 已实施（11-10 实机） | todo |
| D4 | ✅ S3 收口（`a2a9d1d5`） | todo |
| D7 | ✅ S3 收口（`544dcbd5`） | todo |
| D9 | ✅ S2 收口（`cd825b81`） | todo（另有三张 D9 子卡 done） |
| D10 | ✅ S3 收口（`a73ec4c6`） | todo |
| D11 | ✅ S3 收口（D11b 覆盖，`ec508ec1`） | todo |
| D12 | ✅ S1 收口（`d95821e4`） | todo |
| D13 | ✅ S2 收口（`bff3d327`） | todo（另有「D13 失败契约实施」卡 done） |
| D16 | ✅ S3 收口（`de53e22e`） | todo |

### 4.2 违反规则②：看板 done 而稿非 ✅（3 条）

| D | 缺陷稿 | 看板 |
|---|---|---|
| D5 | 🟡 本批不结案（仅单测级） | done |
| D15 | 🟡 本批不结案（仅单测级） | done |
| D18 | 🟡 本批不结案（仅单测级） | done |

### 4.3 其余

- **D20**：看板 `done`，缺陷稿按 admin 19:4x 裁记「状态口径待统一（结项不验、图标待统一）」——既非 ✅、也非显式「作废/待裁」，按规则②字面仍属未对齐，须在收口件或台账里显式写一句才算对齐。
- **D6**（板 done／稿 ⛔ 作废）与 **D8**（板 todo／稿 ⏸ 待裁）：均属「显式非 ✅」，不算违规。
- **D2／D17／D21**：稿 ✅ 且板 done，对齐。
- **D14／D19**：缺陷稿 ✅，但看板**无对应卡**（全表 153 张无 D14／D19 标题）。规则①只禁「留 todo/in-progress」，无卡不属违例，但「逐条一致」在字面上无从成立，须裁定是按「无卡即视为一致」还是须补卡。

**结论：不成立。** 差异合计 10＋3＝13 条（另 D20 待统一 1 条、D14/D19 无卡 2 条）。这不是文案问题，是要在任务板上把 10 张已完成卡落 done、把 3 张只到单测的卡退回非 done（或把缺陷稿该行改回不结案）之后才能判过；两边改哪一边，属项目层裁定，我不代裁。

## 5. 判据⑤ 证据路径可打开 ＋ ⑥ 副本闸

### 5.1 ⑤ 路径（`test -f` 逐条）

```
OK    129    9442   .runtime/.cache/s3-d4/945ff8a4-e3b/evidence.json
OK    156    4717   .runtime/.cache/s3-d16/af51f396-e79/evidence.json
OK     39    2532   .batch/night/staging/s3-d10-live-evidence.md   （D10 替代件；原件 246/10,526/`cd73444e…` 随 wt-d10 移除，摘录位置与原因在件内）
```

D10 原件路径已不可打开，按清单口径「仓内取证件可作替代、不因替代判 FAIL」处理，且替代件两段齐全（入库 sha `dd883c20`＋件内摘录）。**成立。**

### 5.2 ⑥ 三份副本

```
.batch/night/staging/s3-d4-evidence.json     129    9442   9354d68c121cc9f9…   == 原件 sha（逐位相同）
.batch/night/staging/s3-d16-evidence.json    156    4717   08ede9d41f0d79bf…   == 原件 sha（逐位相同）
.batch/night/staging/s3-d11b-evidence.json   337   11161   4e382026e46da17f…   == 判词记录 sha（原件已随 wt-d11b 移除）
```

D11b 的原件目录 `wt-d11b/.runtime/.cache/s3-d11b/0a2815bf-a6e/` 现已不存在——**这正是第 13 条要防的情形**，副本在且 sha 与判词记录一致，故该条 `[live]` PASS 不受影响。**成立。**

## 6. 记录项（不扣分，但收口前应处理）

1. 收口件 `:80`「现 1 项 `??`」与现盘 7 项不符——写时快照，入库前须重报。
2. 收口件 `:116` 报模板「132 行 / 15,686B / `ee8ee1c2…`」，与盘上（133 / 16,080 / `7ed11948…`）和 HEAD blob（130 / 14,928 / `d029de0c…`）**两个都不是**，属过期读数，须改为盘上值或入库后 blob 值。
3. 收口件 `:47`（四段式：🟡3＋D20 单列）与 `:53`（盘上实算：🟡4 含 D20）并存。两句都成立（一句是判定面、一句是表内图标实算），但并列易被读成矛盾，建议 `:53` 前加「（表内图标实算，含 D20）」。
4. 台账 S4 行重复见 §3 观察项。
5. 缺陷稿 `:18`（158,898B）与 `:57`（878/212,296）是 HEAD blob 读数、非盘上读数——**写法正确**（第 12 条口径），仅提醒入库后这两处应换成新提交的 blob 值。
6. 我的清单件 `s4-qa-checkplan.md` 目前 `??`，随本判词一并入库或按 batch-hygiene 裁定处置，请主身定。
7. **D20b 在缺陷稿无对应行**：容器卡 21 张子卡里多出 `45ef0936`「D20b 模板段收窄」（done），属 D20 的实施拆分卡，不是第 21 条缺陷。故后续比对一律按 D1–D20 编号、D20b 不参与；收口件已按 admin 19:5x 加一句「D20b 为 D20 的实施拆分卡，不入 D 条目比对」，故本项**只记录、不算缺口**。

## 7. 建议

- ④ 是唯一判据级缺口：先定「改板还是改稿」（10 张已完成卡落 done／3 张单测卡退回，或反向改缺陷稿三行为不结案），再由负责人改、我在入库提交上复核 ① 与 ④。
- ① 的复核口径：入库提交 sha 出来后跑 `git status --porcelain -uall`（应为空或只剩已声明例外）＋ `git rev-parse HEAD` 对 `git ls-remote`，我把三行原文贴进复判 §。
- 本判词与四件回写**同笔入库**，入库后我按新提交补 §8 复判（只重判 ① 与 ④）。

## 8. 复判（④ 成立；① 待入库提交）

### 8.1 判据④ 改板后复判 —— 成立

改板后读数（`task_board_list`，2026-11-22 19:55 取）：`revision 913`（改板前 891），counts `done 134`／`todo 15`／`backlog 3`／`running 2`／`failed 1`／`archived 1`。

容器卡 `61e4535d-0999-4dab-8c14-2e4bbc0b7fcc` 下 21 张子卡逐张状态（按 D 编号核，不按行序）：

| 状态 | D 编号 |
|---|---|
| done（17） | D1 D2 D3 D4 D6 D7 D9 D10 D11 D12 D13 D14 D16 D17 D19 D20；D20b（D20 拆分卡，不计条目） |
| todo（4） | D5 D8 D15 D18 |

对照缺陷稿 D1–D20：✅14（D1／D2／D3／D4／D7／D9／D10／D11／D12／D13／D14／D16／D17／D19）全部 done；🟡3（D5／D15／D18）全部 todo 且带 tag「本批不结案·仅单测级·S5候选」；⛔D6 done；⏸D8 todo；D20 done 且带 tag「结项不验·作者选项③」。14＋3＋1＋1＋1 ＝ 20 条，双向差异 0。

卡面描述那句（「本批不结案：仅单测级证据…」）未落到卡上：宿主拒改已执行卡的描述（`task has already been executed`），admin 19:5x 裁记收口件 §1.5、以 tags 为准——按裁定不扣分。

**结论：④ 成立（首测 13 条差异全部消解）。**

### 8.2 判据① 待补

① 须在新提交上判，不在脏树上判：`git status --porcelain -uall` 为空（或只剩已声明例外）、`git rev-parse HEAD` ＝ `git ls-remote origin refs/heads/exp/resource-ledger`。入库提交 sha 出来后在本节追加命令原文与输出。

<!-- DONE -->
