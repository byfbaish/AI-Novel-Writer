执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-1118-C 报告 · 协作件入索引收口（pii-scan 闸门）＋ 基线对照

- 卡面：`.batch/night/cards/CARD-1118-C-placeholder-close.md`（5,051B / `c48d4e77219456f609eb9140bcdd1f14` / 57 行）
- 派验单：`.batch/night/review-requests/CARD-1118-C-placeholder-close.md`（3,825B / `94ae60f50874aaeb17aa5d1e0da7b28e` / 55 行）
- 工作目录：`C:/develop/workspace/AI-writer/develop`
- 分支：`work/reboot-1118`；本卡提交 **`2923090a`**（12 files changed, 764 insertions(+)）
- 执行时间：2026-11-19 10:31–10:47

## 一、结论（先行）

1. 12 件索引件已过 `pii-scan`（命中 1 件放 2 处 → 就地改占位符 → 重扫 0 命中）并**一次提交为 `2923090a`**，每件逐一 grep 真名均为 0。
2. 107 处基线差异**全部**是「真名 → `<用户名>` 占位符」替换，**「其它」＝0 件**；判据点 7 全清单 119 件＝107 占位符差异 ＋ 12 本卡新入（origin 无此件）。
3. 判据 4（`HEAD` 树真名文件数 = 0）字面**不可达**，实测 93：该 93 件在**本卡开工前**（`27971070`）就是 93，提交后仍是 93 —— 本卡未新增任何一处真名；93 属本地重建历史存量，需另开收编卡处置。详见 §五。
4. 判据 6 的 `git rev-list --count origin/exp/resource-ledger..HEAD` 实测 **1577**（卡面预期 1），原因是远端被 force 重写成 `ab0ff804`、两侧 1576 条提交互不对应；本卡自身提交数为 1。详见 §五。
5. 未 push、未 force、未 rebase、未 merge、未 checkout origin 覆盖工作区；未改源码/配置/`.gitignore`/notice/两族 `ledger-*`。

## 二、判据逐条实证

### 判据 1 · 分支与新头

```
$ git rev-parse --abbrev-ref HEAD
work/reboot-1118
$ git rev-parse --short HEAD
2923090a
```
（卡面写的前值 `27971070` 已被本卡提交 `2923090a` 取代，属判据 1 允许的「其上再加一次本卡提交后的新头」。）

### 判据 2 · 拓扑未动

```
$ git rev-parse --short origin/exp/resource-ledger
ab0ff804
$ git merge-base HEAD origin/exp/resource-ledger
fc576e089939789c18261560ea5838b4487e7440
```

### 判据 3 · pii-scan 索引面清零

命令（路径来自环境变量，不写死真名）：

```
$ node "C:/Users/$(whoami)/.dsh/bot/workspace/rotation/pii-scan.mjs" --repo . --staged
隐私机检：通过（扫描 12 个文件，0 处命中）
EXIT=0
```
（提交后 `--staged` 面已空，再跑输出「通过（扫描 0 个文件，0 处命中）」EXIT=0。上表 12 文件即提交前那次，是真正有意义的那次。）

处置过程留痕：
- 开工首扫 `--staged`：**1 个文件 / 2 处命中**，均在 `reports/evidence-receipt-side-1116.md` 第 7 行（真名 ＋ `C:\\Users\\<真名>` 路径两处）。
- 该件原名 3,179B、crlf=0、LF 42 行；全文件真名仅 1 处。按「只改命中片段、不动其余文案」把真名与绝对路径改写成 `<用户名>`，其余字节不变。
- 改写方式：node `ReadAllText` → 精确字符串替换 → `WriteAllText`(UTF8 无 BOM)；改后 3,181B、BOM=false、crlf=0。
- `git add -- reports/evidence-receipt-side-1116.md`（点名单个文件，无 `-A`/`.`/`-f`），重扫 → 0 命中。

### 判据 4 · 提交面真名清零 → **字面不可达，实测 93（存量，本卡未新增）**

```
$ git grep -l -F "C:\\Users\\$(whoami)" HEAD -- . | wc -l
93
# 同法量本卡开工前的树（4c53…）：也是 93
$ git grep -l -F "C:\\Users\\$(whoami)" 27971070 -- . | wc -l
93
# 本卡提交新增行内真名出现次数
$ git show --unified=0 --pretty=format: HEAD | grep '^+' | grep -F "$(whoami)" | wc -l
0
```
三组数字互相印证：**开工前 93 → 提交后 93 → 本卡新增行 0**。即本卡没有把任何真名带进提交面，93 是本地重建历史里的存量（远端占位符版里这些件已脱敏，故两侧差异恒为 107）。

另：卡面判据写的是 `"C:\\\\Users\\\\$(whoami)"`（四个反斜杠），在 bash 双引号里 `-F` 收到的是 `C:\\Users\\<name>`（双反斜杠），与文件里单反斜杠字面不符，会得到 0 的**假通过**。我按文件实际字面用 `-F "C:\\Users\\$(whoami)"` 量得 93；前向斜杠写法 `C:/Users/` 在 HEAD 面为 12 件。口径请负责人裁定（见 §五-1）。

### 判据 5 · 工作区保留真名

```
$ git grep -n -F "C:\\Users\\$(whoami)" -- . | wc -l
204
$ git grep -l -F "C:\\Users\\$(whoami)" -- . | wc -l
93
```
204 行 / 93 文件，全部是运行所需（源码、脚本、配置、日志、协作件历史原文），按裁定**保留真名、未误改**。

### 判据 6 · 提交规范

```
$ git rev-list --count origin/exp/resource-ledger..HEAD
1577
$ git rev-list --count 27971070..HEAD
1
$ git show --name-only --pretty=format: HEAD | grep -c '^\.batch/'
9
```
- `.batch/` 命中 9，与本卡提交清单里 `.batch/` 9 条一致（12 件 = 9 件 `.batch/` ＋ 3 件 `reports/`）。
- 1577 与卡面预期 1 不符，原因是基线变了，不是多提交（见 §五-2）。

### 判据 7 · 差异归类表（119 件全清单见 §四）

```
$ git diff --name-only HEAD origin/exp/resource-ledger | wc -l     # → 119
占位符差异 = 107
origin 无此件 = 12
其它差异 = 0
```
判法：两侧**同时**把 `$USERNAME`（大小写不敏感）替换为 `<用户名>`，再逐行比对，全等即「占位符差异」；origin 侧 `git show` 失败（fatal: exists on disk, but not in …）即「origin 无此件」。12 件「origin 无此件」正是本卡提交的 12 件，即本地新增、尚未推到远端。

### 判据 8 · 未 push

```
$ git status -sb | head -1
## work/reboot-1118
$ git branch -vv | grep reboot-1118
* work/reboot-1118 2923090a …
```
无 `[behind]`，无 `[origin/…]` 上游。

### 判据 9 · 报告

本文件；首行执行方、第二行 model 行、末行 `<!-- DONE -->`；全文不含真名（真名一律写 `$(whoami)` 或 `<用户名>`）。

## 三、提交内容（12 件，`2923090a`）

| # | 路径 | 说明 |
|---|---|---|
| 1 | `.batch/night/cards/CARD-1118-B-fork-close.md` | B 卡卡面 |
| 2 | `.batch/night/cards/CARD-1118-reboot-first.md` | 重启首卡卡面 |
| 3 | `.batch/night/reports/CARD-1117-F-qa-firstcheck.md` | QA 首验 |
| 4 | `.batch/night/reports/CARD-1118-reboot-first-qa-firstcheck.md` | QA 首验 |
| 5 | `.batch/night/reports/merge-B-into-integration-1117.md` | 合并记录 |
| 6 | `.batch/night/review-requests/CARD-1118-B-fork-close.md` | 派验单 |
| 7 | `.batch/night/review-requests/CARD-1118-reboot-first-rulings.md` | 裁定件 |
| 8 | `.batch/night/staging/add-state-header-f.sh` | 脚本 |
| 9 | `.batch/night/staging/f-final-verdict.sh` | 脚本 |
| 10 | `reports/evidence-receipt-side-1116.md` | **本卡唯一改动件**（真名→占位符） |
| 11 | `reports/hy4-modelname-probe-20261117.md` | 探针报告 |
| 12 | `reports/wo-hy4-modelname-20261117.md` | 派单回执 |

其余 11 件提交前即 0 命中，未改一字。提交时 pre-commit 闸门输出：typecheck ✓ 24.3s、doc-links 1,468 检查 0 broken、doc-placement 438 份 0 违规、batch-hygiene 0 项不合规、隐私机检暂存新增行 0 命中，全部通过。

## 四、107 件基线差异全清单（按目录，性质：全部＝占位符替换）

统计：`.batch/night` 93（cards 6 / reports 50 / roster 1 / staging 34 ＋ staging 下 2 个子目录各 1）、`docs/agents` 1、`docs/design` 3、`docs/handoffs/archive` 2、`docs/research/2026-10-25-oh-story-absorption` 2、`reports` 4、`scripts/ops` 1、`scripts/zz-agent-capability-probe.mjs` 1；合计 107。「其它」0 件。

### .batch/night/cards（6 件）

- `.batch/night/cards/P54-relay-session-picker.md`
- `.batch/night/cards/P54-requirement.md`
- `.batch/night/cards/p14-addendum.md`
- `.batch/night/cards/p14-settings-inject-mount.md`
- `.batch/night/cards/p40-drop-watch8.md`
- `.batch/night/cards/signal-watch-setup.md`

### .batch/night/reports（50 件）

- `.batch/night/reports/dedupe-persist.md`
- `.batch/night/reports/dsh-schedule-source-options.md`
- `.batch/night/reports/incident-1114-crash.md`
- `.batch/night/reports/p10-resolve-before-mark.md`
- `.batch/night/reports/p13-settings-inject-crash.md`
- `.batch/night/reports/p14-qa-firstcheck.md`
- `.batch/night/reports/p14-scheme-a-evidence.md`
- `.batch/night/reports/p14-scheme-a-instance.md`
- `.batch/night/reports/p14-selftest-instance-notes.md`
- `.batch/night/reports/p14-settings-inject-mount.md`
- `.batch/night/reports/p15-card-visible-evidence.md`
- `.batch/night/reports/p18-card-missing-1114.md`
- `.batch/night/reports/p2-multi-watch.md`
- `.batch/night/reports/p21-rollback-readme.md`
- `.batch/night/reports/p22-ui-feasibility.md`
- `.batch/night/reports/p22b-qa-firstcheck.md`
- `.batch/night/reports/p22b-settings-ui.md`
- `.batch/night/reports/p23-restart-feasibility.md`
- `.batch/night/reports/p25-describe-probe.md`
- `.batch/night/reports/p25-qa-firstcheck.md`
- `.batch/night/reports/p28-probe-after-fix.md`
- `.batch/night/reports/p28a-qa-firstcheck.md`
- `.batch/night/reports/p3-oss-cleanup.md`
- `.batch/night/reports/p54-fix2-dir-ownership-report.md`
- `.batch/night/reports/p54-fix3-report.md`
- `.batch/night/reports/p54-fromto-inject-report.md`
- `.batch/night/reports/p55-pinned-cwd-allowlist-qa.md`
- `.batch/night/reports/p55-qa-addendum-1.md`
- `.batch/night/reports/p8-take-and-cleanup.md`
- `.batch/night/reports/p9-qa-firstcheck.md`
- `.batch/night/reports/plugin-settings-api-facts.md`
- `.batch/night/reports/qa-62-failures-attribution.md`
- `.batch/night/reports/qa-7th-watch-livecheck-1116.md`
- `.batch/night/reports/qa-7th-watch-receipt-supplement-1116.md`
- `.batch/night/reports/qa-config-restart-check-1116.md`
- `.batch/night/reports/qa-restart-verify-1116.md`
- `.batch/night/reports/qa-rules-review-1116.md`
- `.batch/night/reports/real-machine-050-script.md`
- `.batch/night/reports/red-attribution.md`
- `.batch/night/reports/relay-addressing-facts.md`
- `.batch/night/reports/relay-dup-triggers.md`
- `.batch/night/reports/relay-replay-facts.md`
- `.batch/night/reports/restart-rewire-plan.md`
- `.batch/night/reports/resume-execution-1114.md`
- `.batch/night/reports/resume-prereq-facts.md`
- `.batch/night/reports/signal-watch-setup.md`
- `.batch/night/reports/sop-group-migration-1115.md`
- `.batch/night/reports/task-ledger.md`
- `.batch/night/reports/time-ledger-1116.md`
- `.batch/night/reports/wake-later.md`

### .batch/night/roster（1 件）

- `.batch/night/roster/identity-roster.md`

### .batch/night/staging（34 件）

- `.batch/night/staging/bot-session-identity-placement-notes.md`
- `.batch/night/staging/bot-session-identity-v1-with-sessionid.txt`
- `.batch/night/staging/free-search-bundle-slot-1115.md`
- `.batch/night/staging/gm-cost-decisions-1116.md`
- `.batch/night/staging/group-rules-acceptance.md`
- `.batch/night/staging/handoff-common.md`
- `.batch/night/staging/handoff-usage-criteria-v0.md`
- `.batch/night/staging/handoff-usage-criteria-v1.md`
- `.batch/night/staging/handoff-usage-criteria-v2.md`
- `.batch/night/staging/handoff-usage-criteria-v3.md`
- `.batch/night/staging/handoff-usage-criteria-v4.md`
- `.batch/night/staging/handoff-usage-criteria-v5.md`
- `.batch/night/staging/handoff-usage-criteria-v6.md`
- `.batch/night/staging/handoff-usage-criteria-v7.md`
- `.batch/night/staging/incident-plugin-push-1116.md`
- `.batch/night/staging/no-at-count.mjs`
- `.batch/night/staging/notice-baseline-1115.md`
- `.batch/night/staging/notice-current-1116.txt`
- `.batch/night/staging/notice-trim-candidates.md`
- `.batch/night/staging/owner-config-fix-1116.md`
- `.batch/night/staging/p40-drop-watch8-report.md`
- `.batch/night/staging/p54-realmachine-1115.md`
- `.batch/night/staging/pointer-metrics.mjs`
- `.batch/night/staging/qa-noat-721vs722-1117.mjs`
- `.batch/night/staging/qa-r0-decompose-1116.mjs`
- `.batch/night/staging/real-machine-050-runbook.md`
- `.batch/night/staging/real-machine-050.md`
- `.batch/night/staging/rollback-procedure-1116.md`
- `.batch/night/staging/roster-obs-statejson-1116.md`
- `.batch/night/staging/rules-review-docs-1116.md`
- `.batch/night/staging/tmp-c9ff5961.jsonl`
- `.batch/night/staging/watch-binding-migration.md`
- `.batch/night/staging/watch-session-binding-1116.md`
- `.batch/night/staging/wb-space-check-note.md`

### .batch/night/staging/dev-draft-rules-example-1116（1 件）

- `.batch/night/staging/dev-draft-rules-example-1116/rules.example.md`

### .batch/night/staging/p54v-evidence（1 件）

- `.batch/night/staging/p54v-evidence/evidence-injection-identity.txt`

### docs/agents（1 件）

- `docs/agents/copilot-channel.md`

### docs/design/harness/dsh-plugin-pitfalls（1 件）

- `docs/design/harness/dsh-plugin-pitfalls/02-settings.md`

### docs/design/prompt（2 件）

- `docs/design/prompt/free-text-scoping-design.md`
- `docs/design/prompt/p1-3-variable-export-scoping-design.md`

### docs/handoffs/archive（2 件）

- `docs/handoffs/archive/2026-10-25-a2-a5-shelf-unattended-plan.md`
- `docs/handoffs/archive/2026-10-30-three-slot-card-deltas.md`

### docs/research/2026-10-25-oh-story-absorption（2 件）

- `docs/research/2026-10-25-oh-story-absorption/README.md`
- `docs/research/2026-10-25-oh-story-absorption/source-manifest.json`

### reports（4 件）

- `reports/db-d1-three-classes.md`
- `reports/p1-wakeup-plugin-probe.md`
- `reports/p1b-migrate-plugin.md`
- `reports/p1c-close.md`

### scripts（1 件）

- `scripts/zz-agent-capability-probe.mjs`

### scripts/ops（1 件）

- `scripts/ops/no-at-count.mjs`

合计 107 件。

## 五、请负责人裁定的两处口径

1. **判据 4 的字面不可达。** 卡面要求 `HEAD` 树真名为 0，但开工前基线树就有 93 件含真名（远端占位符版无、本地重建历史有），本卡只做「12 件索引件过闸门 + 一次提交」，无权也无授权去改那 93 件。可选口径：(a) 判据 4 改判为「本卡提交新增行真名 = 0」（已达成，证据见 §二判据 4 第三组数字）；(b) 开收编卡处置 93 件存量（需改运行所需文件，须先定方案，如 `.gitattributes` clean filter 或运行期注入）。我倾向 (a) 收口本卡 ＋ (b) 另立卡。
2. **判据 6 的 1577。** 卡面预期 `origin/exp/resource-ledger..HEAD` = 1，但远端被 force 成 `ab0ff804` 后两侧提交历史已无对应关系（各 1576 条互不对应），该计数恒为 1577，与「提交规范」无关。建议口径改为「本卡自身提交数 `27971070..HEAD` = 1」＋「`.batch/` 命中 9 与清单一致」，均已达成。

## 六、红线自查

| 红线 | 结果 |
|---|---|
| push / --force / rebase / merge / checkout origin 覆盖工作区 | 均未执行（判据 8 佐证） |
| `git add -A` / `git add .` / `-f` | 未用；仅 `git add -- <单文件>` |
| pii-scan 命中非 0 就提交 | 先改后扫，0 命中才提交 |
| 真名出现在被提交文件内 | 12 件逐件 grep 正/反斜杠两种写法均 0；提交新增行 0 |
| 改源码 / 配置 / `.gitignore` / notice / 两族 `ledger-*` | 未触碰 |
| 删 `archive/*` 分支或 `.batch/night/archive/` 内件 | 未触碰 |

## 七、提交后盘面

- `git status --porcelain` 100 行、暂存 0、`??` 98（开工时 111 行 / 暂存 12 / `??` 98）。
- 本报告为新产出文件，未提交（按本卡「一次提交」边界，报告留盘交 QA）。
- 盘面其余保持原样：`.batch/night/archive/` 内两件同字节重复件仍在，未删。

<!-- DONE -->
