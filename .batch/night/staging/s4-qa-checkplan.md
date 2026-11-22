# S4 收口复判 · 四项检查清单（QA）

From: QA · AI writer项目组 | 57c8bd18
To: 项目总负责人 · AI writer项目组（收口件到货后按本清单一次跑完）
落盘：2026-11-22 19:2x｜状态：**清单件，未跑判词**

## 0. 判定面写法（先钉）

- 判定面＝**收口件入库后的 final doc 提交 sha**（不是提案期工作树）。收口件首行须写明 HEAD sha 与远端 sha，我按同一 HEAD 取全部证据，禁止混用旧快照。
- 判定面变更即换件重报；同一清单不在两个 HEAD 上拼读数。

## 1. 树干净与 HEAD = 远端

```
git rev-parse --abbrev-ref HEAD
git status --porcelain -uall
git rev-parse HEAD
git ls-remote origin refs/heads/exp/resource-ledger | cut -f1
git rev-list --left-right --count origin/exp/resource-ledger...HEAD
```

- `HEAD` 必须是分支名（`exp/mainline-1119`），**不许 detached**；空输出＝干净。
- 已知例外只有 batch-hygiene 判为「不许入库」的 `??` 件（如 `s3-d11-live-recheck-report.md`）：收口件须逐条列出其路径＋`ls -l` 读数＋不入库理由，未列即按「树不干净」退回。
- 两个 sha 必须相等，`rev-list --left-right --count` 必须打 `0	0`。
- `git ls-remote` 若 120s 无输出被超时打断，记「**命令未完成**」——不记 pass，也不许拿本地 `git rev-parse HEAD` 顶替远端核对；这一条只能我现场跑。

## 2. 两条命令原文（缺末行 EXIT= 不可判）

```
pnpm check:fast ; echo CHECKFAST_EXIT=$?      # 末行须为 [check:fast] 全部通过。
node scripts/ops/check-batch-hygiene.mjs --all ; echo HYGIENE_EXIT=$?   # 末行须为 0 项不合规
```

- `check-fast` 若改走 `node scripts/check-fast.mjs`，须在收口件里写明用的是哪条命令，两条不许混着报。
- 我 19:1x 在本机预跑 `node scripts/ops/check-batch-hygiene.mjs --all` 已是 `0 项不合规`；收口件到货后须在**其判定面**上重跑，不认我这半条预跑。
- raw 输出贴进收口件（typecheck 耗时、doc placement 扫描份数、broken 0 三行都要在）。

## 3. 台账「每卡一行」核对

- 真实件：`.batch/night/reports/task-ledger.md`（现 **878 行 / 212,296B**）。Goal 的 Done when ② 写的是 `reports/task-ledger.md`（缺 `.batch/night/`），**收口件须写真实路径并引 Goal 原句**，不得去造那个空路径。
- 卡行机检：`grep -cE '^\| *(D4|D7|D16|D10|D11|D11b) *\|' .batch/night/reports/task-ledger.md`——本批六卡每卡**有且仅有一行**（卡号唯一键，同卡两行即退）。
- 每行三查：①结论 ∈ `PASS`／`不通过`／`作废`／`转出`；②依据栏须含**判词路径＋行数/字节/sha** 或 **提交 sha**（写「已确认」即退）；③缺陷稿 D 编号与卡号能对上。
- 四阶段行（S1／S2／S3／S4）各一行，写范围＋收口 sha＋判词指针；缺任一阶段行退回。

## 4. 缺陷稿 ↔ 看板 逐条一致

- 缺陷稿真实件：`docs/design/product/live-pipeline-acceptance-defects-assessment.md`（现 **1,241 行 / 158,898B**）。
- D 行清点：`grep -nE '^\| *D[0-9]+ *\|'` → 现 20 行（D1、D12、D2、D13、D14、D19、D3、D4、D5、D6、D7、D8、D15、D9、D10、D11、D16、D17、D18、D21）。
- 状态词清点：`grep -o '✅\|🟡\|🔍\|❌' | sort | uniq -c` → 现 `41 ✅ / 28 🟡 / 8 🔍 / 0 ❌`。收口后本批五行（**D4、D7、D10、D11、D16**）必须离 🟡/🔍；其余 🟡 若不在本批，收口件须逐条列「不在本批」名单与理由。
- 五行每行必须带：evidence 绝对路径＋run id、判词路径＋sha、判定面 sha；D11 行还要写「判据 2 由 D11b 覆盖，判定面 `ec508ec1`」。
- D6 作废／D8 待作者另裁须**显式标注**，不许留 ✅ 冒充实机通过。
- 与看板一致：比对键＝D 编号，逐条对看板卡状态。两类差异必须为 0：①缺陷稿 ✅ 而看板仍 todo/doing（「已实施却挂 todo」）；②看板 done 而缺陷稿非 ✅。看板件路径以收口件点名为准；若看板为 DSH 任务板（`index.md:29` 记「只有 Lead 能读」），由主身导出清单作证据，QA 不代读。
- 抽查证据真实存在：每条实机复验路径 `ls -l`＋`wc -lc`，至少 3 条对 sha，路径不存在即按「证据虚挂」退。

## 4b. 范围与措辞（admin 19:2x 定死，判词按此写）

- **判定范围＝D1–D20 二十条**；`D21` 注「另立条目，不计入本 20 条」（文件 `:5` 原文）；**不补 D20 行**。
- 索引表清点必须按内容算、不按我先前那条窄 grep：`:67` 是 `| **D20** | **高** | 🟡 …`，加粗 `**D20**` 匹配不上 `^| D20 `。正确机检：`grep -nE '^\| *\*{0,2}D[0-9]+' docs/design/product/live-pipeline-acceptance-defects-assessment.md` → 索引表 `:61–:81` 共 **21 行**＝20 条 + D21。
- 回写面三处，缺一即退：①索引表 `:61–:81` 对应行；②各条正文里的 `> 状态：` 指针行（文件 `:94` 自己写明「条目 `> 状态：` 行只写指针」）；③`D6` 作废、`D8` 待作者另裁的显式标注。**`:100–:104` 那张表是 2026-11-07 历史实施记录**，按文件 `:92`「表格是索引、正文是记录」，只读不改写。
- 结论措辞**只能是**「结构性收口完成；判定面 **17 ✅／3 不结案（🟡，仅单测级）**」；**禁写「Goal 达成」「D1–D18 全 ✅」**。D5／D15／D18 进候选卡清单（各一行性质＋前置条件），末尾留一句给主人的裁定请求（改判据移出本批／补一张 S5 实机卡），只写不问、不自裁。
- Goal 字面的「D1–D18」与文件 20 条的差集（D19、D20）由收口件在 §范围 说明，由主身报主人；文档里不许悄悄抹平。
- 顺序：回写先落盘（工作树内、不 commit）→ 我对盘上实际文件出判词（逐条引盘上行号）→ 判词与回写同笔入库（主身核过再提）。



## 5. 判定规则

四项全绿＝PASS；任一红＝退回，判词里贴命令原文＋末行 EXIT=＋对应行号。命令原文缺项与读数不符一律按红处理，不给「口头已实现」的余地。

## 5b. 追加项⑤：证据路径必须可打开（admin 19:2x 追加）

判词与取证件里引的每个 `.runtime/...` 路径，逐条 `test -f`（PowerShell 用 `Test-Path`）一遍，并把 `wc -lc`／`sha256sum` 一起贴上：

```
for p in <收口件与判词引到的每个 .runtime 路径>; do
  test -f "$p" && echo "OK $p $(wc -lc < "$p")" || echo "MISS $p"
done
```

- 指向盘外／已被 worktree 移除的路径＝**死路径**，该条判据的「实机输出路径」视为未附。
- **仓内取证件可作替代路径，不因代替而判 FAIL**：替代须同时给「取证件路径＋行/字节/sha（已入库）」与「原始 evidence 的行/字节/sha ＋ 原路径 ＋ 移除原因 ＋ 读数摘录位置」两段，缺任一段按死路径处理。
- 仅整数条替代即可，不要求所有 `.runtime` 路径都存活；但每条 D 行的证据必须至少有一个**现在能打开**的落点。

我 19:2x 的预检读数（收口件到货后须在其判定面重核）：

```
OK   .runtime/.cache/s3-d4/945ff8a4-e3b/evidence.json     129 行 / 9,442B
OK   .runtime/.cache/s3-d16/af51f396-e79/evidence.json    156 行 / 4,717B
MISS .runtime/.cache/s3-d10/b96d57c6-7c9/evidence.json    （worktree wt-d10 已 remove）
MISS ../wt-d10/.runtime/.cache/s3-d10/b96d57c6-7c9/evidence.json
现存 .runtime/.cache/s3-d10/ 仅 533b5007-d45、91018151-f88（13:2x 早期 FAIL run，不承担判据 2）
替代 .batch/night/staging/s3-d10-live-evidence.md  39 行 / 2,532B / a517a50dfe79d4782cd90972d4bde1dcfad9de231d149f7702e11a8e405c7a9a（随 dd883c20 入库，可打开）
```


## 5c. 追加项⑥：`[live]` 取证的 staging 副本闸（管理 19:2x 定，S4 起执行）

判词（含本收口判词）里凡是引了 `evidence.json` 原件路径的那条 `[live]` 判据，必须同时满足：

1. `.batch/night/staging/<卡号>-evidence.json` **存在**（同名副本，随判词同笔入库）；
2. 副本 sha256 **等于**判词里写的原件 sha256，且副本 `wc -lc` 与原件一致；
3. 判词里原件路径、原件 sha、副本 sha 三者都写全。

逐条打：

```
for card in s3-d4 s3-d16 s3-d10 s3-d11b ...; do
  f=.batch/night/staging/$card-evidence.json
  test -f "$f" && echo "COPY $f $(wc -lc <"$f" | tr '\n' '/') $(sha256sum "$f" | cut -d' ' -f1)" || echo "NOCOPY $f"
done
```

判定：**找不到副本、或副本 sha 与原件不符 ⇒ 该判据不得标 `[live] PASS`**（记「不可判（副本缺）」，不得以「历史上已 PASS」顶替）。已入库的历史判词不追溯；从 S4 起执行，此闸只作用于 S4 判词与 S4 收口件引用的证据。

我 19:2x 预检：`.batch/night/staging/` 现只有 `s3-d11b-evidence.json`（337/11,161/`4e382026…`）；D4、D16 的副本尚未落盘，但**原件仍在盘上可拷**（`129/9,442`、`156/4,717`），须在 S4 判词入库前由主身同笔拷入，否则这两条的 `[live]` 在 S4 判词里只能记「不可判（副本缺）」。D10 无原件，按 §5b 用仓内取证件替代。

## 6. 本件性质

清单件，不跑判词、不判任何卡。等负责人收口件与我报的 sha 对齐后，在同一判定面一次跑完四项，判词另落 `.batch/night/reports/s4-closeout-qa-firstcheck.md`。

<!-- DONE -->
