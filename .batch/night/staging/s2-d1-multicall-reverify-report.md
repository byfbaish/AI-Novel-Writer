执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-S2-D1 · 同 run 多调用复验 · 交付报告（零改码）

- 卡面：`.batch/night/cards/s2-d1-multicall-reverify.md`（58 行 / 4,837B / sha256 `53e85f34ef218ac0d1757c98a255b3e767a449a33cde7d1ad00c1eb9f88b709c`）
- 派单件：`.batch/night/staging/s2-d1-dispatch.md`（42 行 / 2,468B / sha256 `b44316f67be9b41ea850d9ab83ec1cbf841b3fb1956ad7b78598d0b97dafcdde`）——本报告所读派单件即此版本
- 分支：`card/s2-d1-multicall-reverify`，HEAD `0f0ca3ee8dfd6488ff1fe682dc781c3c4fae0926`（**分支上零提交**，`git log --oneline -1` 仍是 D12 的合入提交）
- 改码：**零**。`git status --porcelain -- src electron scripts` 输出为空。
- 取证脚本：`.runtime/s2-d1-multicall.mjs`（按卡面 §3，**不入库**）；产物 `.runtime/.cache/s2-d1/ddcfaef9-fca/evidence.json`

## 0. 开工件必读确认（卡面 §0 三行）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡与派单件。
② 版本或日期：`README.md` 现版（11-14 15:01 / 13,777B）；`AGENTS.md` 现版（11-07 21:18 / 5,633B，`charter-version: 2026-11-07`）；`ruling-dispatch` 现行 v6 · 2026-11-20（8,483B）。
③ 三条口径：授权边界最窄执行（本卡零改码，只跑不提交）；实机复验在 `develop` 由 developer 执行、不外派；证据只认命令与输出原文，push 只由主身。

## 1. 判据 1 · 同 run 内两次调用都发生

命令（`python` 直读 `project.db`：better-sqlite3 是 Electron ABI 145，纯 node 打不开）：

```
python - "$DB" <<'PY'
import sqlite3,sys
db=sqlite3.connect(sys.argv[1]); db.row_factory=sqlite3.Row
for r in db.execute("select attempt_id, run_id, json_extract(usage_receipt_json,'$.purpose') purpose, "
                    "json_extract(usage_receipt_json,'$.result.finishReason') finish, "
                    "json_extract(usage_receipt_json,'$.result.failureCode') failure "
                    "from generation_attempts order by rowid"):
    print(dict(r))
PY
```

输出原文：

```
{'attempt_id': 'bd1fd258-ffc2-4b6e-9f59-517ca58aa277', 'run_id': '7adc1993-23d8-4bf5-8f88-0bf9c570a535', 'purpose': 'chapter-draft-short-outline', 'finish': 'stop', 'failure': None}
{'attempt_id': 'd0fa4e1b-d84c-43c3-bed0-78c26594e3a7', 'run_id': '7adc1993-23d8-4bf5-8f88-0bf9c570a535', 'purpose': 'chapter-draft', 'finish': 'stop', 'failure': None}
```

两行 `run_id` 相同（`7adc1993-…`）、`purpose` 分别是短细纲（`chapter-draft-short-outline`，ordinal 1）与正文（`chapter-draft`，ordinal 2），两次都 `finishReason=stop`、无 `failureCode`。
主进程侧同时记录到两次真实出网请求（合成 fetch 拦截器，`globalThis.__d1.intercepted`）：`outline stream=true promptLength=2393`、`draft stream=true promptLength=5315`；`physicalModelRequests=0`（无任何真实外部请求）、`unclassified=0`。

## 2. 判据 2 · 全程无 `GENERATION_SOURCE_CHANGED`

命令（同一脚本族，把 `generation%` 各表所有行 JSON 化后数该码）：

```
tables = [r[0] for r in db.execute("select name from sqlite_master where type='table' and name like 'generation%'")]
hits = 0
for t in tables:
    rows = db.execute(f'select * from {t}').fetchall()
    hits += json.dumps([dict(r) for r in rows], ensure_ascii=False).count('GENERATION_SOURCE_CHANGED')
    print(t, 'rows', len(rows))
print('GENERATION_SOURCE_CHANGED hits =', hits)
```

输出原文：

```
generation_roots rows 1
generation_runs rows 1
generation_attempts rows 2
generation_artifacts rows 2
GENERATION_SOURCE_CHANGED hits = 0
```

应用侧日志同样为 0：脚本把 Electron 主进程 stdout/stderr 逐行收下，`logSourceChangedHits = 0`（`[provider] stream failed` 也没有出现，见 evidence 的 `providerLog`）。

## 3. 判据 3 · run 有终态

命令 / 输出原文：

```
-- select run_id, root_action_id, status from generation_runs
{'run_id': '7adc1993-23d8-4bf5-8f88-0bf9c570a535', 'root_action_id': 'b6b90c8c-4287-4feb-b842-b9ea7cf1e823', 'status': 'completed'}
```

终态为 `completed`（非 `running`，也非无码 `paused`）；`stepLog` 里 `run-terminal · status=completed` 于草稿落库后 1.0s 采到。

## 4. 判据 4 · 第二次产出被采用

命令 / 输出原文：

```
-- select d.id, d.chapter_number, d.version, d.status, d.word_count, length(c.body) content_len
--   from drafts d left join contents c on c.id=d.content_id order by d.id
{'id': 1, 'chapter_number': 1, 'version': 1, 'status': 'finalized', 'word_count': 903, 'content_len': 1046}
{'id': 2, 'chapter_number': 2, 'version': 1, 'status': 'draft', 'word_count': 175, 'content_len': 202}
```

第 2 章草稿行存在（`status=draft`，`word_count=175`，正文 `contents.body` 202 字符），与正文请求的产出同长——即第二次调用的产出被真实采用，不是「调用发生但结果被丢」。
界面读数（同一次运行，`readPanel()` 抓 `.writer-ai-panel`）：「第 2 章候选」「预计字数」「第 2 章 细纲」「正文 7 段」「确认并采用候选」等，正文与库内 `contents.body` 一致；`recovery_candidates` 本次为空（成功路径不落候选）。

## 5. 判据 5 · 实例纪律三项

evidence（`.runtime/.cache/s2-d1/ddcfaef9-fca/evidence.json`）三项原文：

```
{"instancesThisRun": 1, "exitCode": 0, "leftoverElectronProcesses": 0}
```

- 单实例复用：一次 `_electron.launch`，三档流程同一实例；`finally` 里 `quit()`（`Promise.race([app.close(), 20s])` 后 `app.process()?.kill()`）。
- 残留扫描命令与输出：`Get-CimInstance Win32_Process -Filter "name='electron.exe'" | Where-Object { $_.CommandLine -like '*--user-data-dir=<本次 roots.userData>*' }` → `0`。
- 本轮完整 `ok` JSON（脚本末行）：

```
{"ok":true,"runId":"ddcfaef9-fca","evidencePath":"C:\\develop\\workspace\\AI-writer\\develop\\.runtime\\.cache\\s2-d1\\ddcfaef9-fca\\evidence.json","head":"0f0ca3ee8dfd6488ff1fe682dc781c3c4fae0926","branch":"card/s2-d1-multicall-reverify","checks":{"twoCallsSameRun":true,"purposesDistinct":true,"noSourceChangedInDb":true,"noSourceChangedInLog":true,"runTerminal":true,"secondCallAdopted":true,"noExternalFetch":true,"noUnclassifiedRequest":true},"runStatus":"completed","attempts":["chapter-draft-short-outline:stop","chapter-draft:stop"],"draftChapter2":["draft:202"],"sourceChangedHits":0,"instancesThisRun":1,"leftoverElectronProcesses":0,"error":null}
EXIT=0
```

## 6. 复现命令

```
npx vite build                                        # 本分支 dist 必须从 0f0ca3ee 重建（EXIT=0）
node .runtime/s2-d1-multicall.mjs                     # 全流程约 8s，末行 JSON 的 ok=true、EXIT=0
```

脚本做的事：隔离 roots（`.runtime/.cache/s2-d1/<runId>`）→ 起单实例 → 建项目（`悬疑`/`zh-CN`）→ 存合成模型 → 两章蓝图 → 导入第 1 章定稿 → 写 `summary_snapshots` 与角色卡 → 写作面板点「写作第2章」、目标字数 200 → 主进程 fetch 拦截器按提示词特征分派（短细纲/要点/角色卡/正文，全部合成、真实外部请求一律拒绝）→ 轮询 DB 等草稿与 run 终态 → 落 evidence → 关闭并扫残留。

## 7. R4 双空

```
$ git diff --ignore-cr-at-eol --stat
 .batch/night/org/BACKLOG.md                        | 15 ++++++++++++++-
 .../live-pipeline-acceptance-defects-assessment.md |  6 +++---
 2 files changed, 17 insertions(+), 4 deletions(-)

$ git diff --numstat
14      1       .batch/night/org/BACKLOG.md
3       3       docs/design/product/live-pipeline-acceptance-defects-assessment.md

$ git status --porcelain -- src electron scripts
（空）
```

两个改动文件都是他人（项目总负责人／产品经理）在 `develop` 上的在办件，与本卡无关；本卡零改码，`src/`、`electron/`、`scripts/` 三项 0 行。

## 8. 既有相关单测整文件汇总行（本卡无新单测）

```
$ node scripts/run-tests-electron.mjs src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 Test Files  1 passed (1)
      Tests  254 passed (254)
EXIT=0
```

（本分支源码停在 `0f0ca3ee`，未含 D13 增补的 1 条用例，故为 254；这是本分支的基线值，非回归。）

## 9. 已知边界与口径

1. 本卡是复验卡：**没有改码、没有新单测、没有提交**；分支 `card/s2-d1-multicall-reverify` 上零提交，判据 5 的「新提交面」对本卡不适用，等价证据是 `git status --porcelain -- src electron scripts` 为空。
2. 判据 1 的 `purpose` 取值来自 `generation_attempts.usage_receipt_json` 的 `$.purpose`（`attempt_json` 只有 `PhysicalAttempt` 字段，不含 purpose）；两条 `purpose` 为 `chapter-draft-short-outline` 与 `chapter-draft`。
3. `drafts.word_count`（175）与 `length(contents.body)`（202）不同名不同值：前者是计字单位（`countDraftUnits`），后者是字符数，二者口径不同不构成矛盾。
4. 本轮顺带修掉的取证脚本坑（不影响仓库代码）：`app.evaluate` 带参必须写成 `(_, arg)`；项目落盘根须用 `%LOCALAPPDATA%\VibeCodingScratch\d1\p<6位>`（否则 `ProjectStoragePreflight` 报「项目路径过深」>85 字符）；合成 SSE 的换行必须是真实换行（`\n\n` 写成 `\\n\\n` 会被 provider 判 `STREAM_INVALID`，短细纲当场失败）。

<!-- DONE -->
