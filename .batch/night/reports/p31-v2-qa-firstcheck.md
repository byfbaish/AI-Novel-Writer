# P31 v2 首验报告 · 投递层物理去重（contentHash 判重）

执行方：QA
判期：2026-11-15 12:20–12:45（DSH 12:3x 重启后复跑一遍）
首验依据：`.batch/night/review-requests/p31-v2.md`（3,125B / `359CFDA0F3E22CEC1D941DDB5F0F346C` / 46 行）
卡面（唯一依据）：`.batch/night/cards/p31-dedupe-persist.v2.md`（8,240B / `6A6A1FECA14A2F95CD7FE11FCDE77F90` / 80 行）
判定：**PASS（限 p31-v2 判据 C1–C7）**

## 0. 取数件与判据件（首行钉版）

| 件 | 字节 | MD5 |
|---|---|---|
| 被测提交 | `fdf7b1735bddf42937cd82a7ae824a9e38219f17`（12:16:10 `fix: dedupe handoffs by content hash before waking the model`） | — |
| `index.js`（提交后） | `git show HEAD:index.js` 见 §1 | 见 §1 |
| `index.test.mjs`（提交后） | 同上 | 见 §1 |
| 执行方报告（`.batch/night/reports/p31-dedupe-persist.md`） | 10,236B / 158 行 | `2556533F8EF982CEC204197E82426195` |
| 信号（`signals/doubao/p31-dedupe-persist.done`） | 174B | `2A3782FE53458EC3A92BF261E08CE4F9` |

判据只认 `15e9d83..fdf7b17` 的 numstat（负责人 12:14 裁定：卡面 §七 的 138/`6f65550` 基线作废，按现行 HEAD 裁决）。

## 1. 首验第一步（四项）

1. `git rev-parse --short HEAD` = **`fdf7b17`**；`git branch --show-current` = `master`；`toplevel` = `C:/develop/workspace/dsh-handoff-relay`。
2. `git status --porcelain` = **空**（提交后干净；ds 重启后再核仍空）。
3. `git diff --numstat` 与 `git diff --ignore-cr-at-eol --stat` = **双空**；`git diff --cached --numstat` 亦空（R4 双读口径）。
4. `git ls-files index.js index.test.mjs` = 两文件均命中，测试文件是 HEAD 内既有文件（非执行方新建）。

提交面：`git show --numstat fdf7b17` = `45 13 index.js`、`123 0 index.test.mjs`；`git diff 15e9d83 fdf7b17 --stat` = 2 files changed, 168 insertions(+), 13 deletions(-)。`origin/master..HEAD` = 1 笔（未推送），HEAD 无 tag。

## 2. 判据逐条

**C1 改动面只含点名两文件 — 通过。**
`git show fdf7b17 --numstat` 只有 `index.js`、`index.test.mjs`；`client.js`、`package.json`、`cordis.patch.yml` 在 `15e9d83..fdf7b17` 内 0 行改动（`git show --numstat` 对这三路径输出为空）。

**C2 落盘表原子写、失败只 warn 不阻断 — 通过。**
`index.js:403-414` `persistDedupeRegistry()`：`writeFileSync(tmp)` → `renameSync(tmp, reg.file)`，catch 内 `rmSync(tmp)` + `log(ctx,'warn', …写 dedupe.json 失败（不影响本次投递）…)`，全函数无 throw。
实测佐证：用例「P31 f dedupe.json 写失败 → 只 warn，投递照常」在 160/160 中为 PASS（我复跑）。

**C3 启动基准是 `lastDeliveredAt` 而非启动时刻 — 通过（读码，不认文案）。**
`index.js:485-497` `isStartupNew()`：取 `dirEntriesOf()` 的 `lastDeliveredAtMs(bucket)`（`:492`），`last === null || state.mtimeMs > last` 才判新（`:493`）；表内无该 dir 时 `onFirstRun()` 后 `return true`（`:488-491`）。本次提交对该函数只改日志行（`:494-495`），基准逻辑未动。

**C4 TC1–TC4 真跑 + 两条反证真红 — 通过（我自己跑，不认自报）。**
- 套件：`node index.test.mjs` → `TOTAL: 160/160 PASS` / `RESULT: PASS`（exit 0）。四条新用例如原文：
  - `PASS  P31 TC1 重载后同名同字节二次投（mtime 变新）→ 不投，日志含 target/file/digest 与 原因=重复(内容)`
  - `PASS  P31 TC2 已投件拷回 watch（size 不变、mtime 变新）→ 不投，走 原因=重复(内容)`
  - `PASS  P31 TC3 同 size 同 mtime 但内容改 1 字节 → 必须放行`
  - `PASS  P31 TC4 DONE 与 stable 对同一快照只投一次，跳过有留痕`
  TC1 的「重载」是真的换模块实例（`index.test.mjs:3374` `import('./index.js?p31tc1=…')`），不是同进程重放。
- **反证 1（退回内存 Set）**：把 `persistDedupeRegistry()` 首行插 `return`（不落盘，仅内存 Map）→ `TOTAL: 157/160 PASS`，**TC1 红**：`期望 1，实际 2`；同时 `P31 b`（重载后落盘表仍挡住）红、`P31 f`（写失败仍投递）红。
- **反证 2（去掉 contentHash 判重）**：把 `dedupeVerdict()` 里 `const stored = …entry.contentHash…` 改成 `''`（强制退回 size/mtime 第二道）→ `TOTAL: 157/160 PASS`，**TC2 红**：`拷回不应再投，实际 2`；TC1 红、TC3 红（`期望 2，实际 1`）。
- 反证在副本 `develop/.batch/night/tmp/p31rev/`（拷 `index.js`/`index.test.mjs`/`client.js`/`package.json`）内做，**仓库工作区未被改动**（反证后 `git status --porcelain` 仍空）。脚本：`.batch/night/tmp/p31-reverse-proofs.mjs`、`p31-reverse1.mjs`。

**C5 无新增依赖、禁动区未动 — 通过。**
`package.json` 0 行改动，全文无 `dependencies` 段；`cordis.patch.yml` 0 行改动；`client.js` 0 行改动。
重试节奏 `RETRY_DELAYS_MS = [1000, 5000, 15000]`（`index.js:35`）与 `RENAME_RETRIES`/`RENAME_RETRY_DELAY_MS`（`:32`）未在 diff 内；「解析不到留原地、不按 cwd 兜底」的告警仍在 `index.js:1150`。
**注**：卡面写的 `index.js:876-880` 现已漂移到 watch 序列化处（该段与「留原地」无关）——按内容核，不按行号核，判通过。

**C6 跳过日志三字段齐全 — 通过。**
`skipDuplicate()`（`index.js:466-471`）输出 `去重跳过 target=<dirKey> file=<basename> digest=<前12> 原因=<reason>`，三字段缺一不可；`isStartupNew()` 的跳过行（`:495`）同样补齐三字段。真机 `relay.log` 实读（`%USERPROFILE%\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`）：
```
2026-11-15T04:09:57.070Z INFO 去重跳过 target=dad6df13f302 file=p31-dedupe-persist.done digest=b395bf35f608 原因=重复(内容)
2026-11-15T04:32:15.514Z INFO 去重跳过 target=dad6df13f302 file=p45-readme-050.done digest=47b929c2b4c8 原因=启动前旧文件(mtime<=lastDeliveredAt)
```

**C7 判重键含 contentHash、内容变必放行 — 通过（读码 + 真机数据）。**
`rememberDeliveredSnapshot()`（`index.js:421-436`）写入 `contentHash`（`state.contentHash` 或现算 `contentHashOfFile`，`:416-419` 为 `createHash('sha256')`）；`dedupeVerdict()`（`:448-476`）有摘要时按内容比：不等 → `return null`（放行），相等 → `{reason:'重复(内容)'}`；仅在无摘要（v1 旧条目）或读不到内容时退回 30s 同 size/mtime 第二道。
真机 `dedupe.json` 实读：27 条记录中 **7 条含 64 位十六进制 `contentHash`**（如 `b395bf35f608ca795fdd50519e6b2ab8f6cd9166676cb04ffc04fc895a17a612`），其余 20 条是升级前旧条目（仅 `size/mtimeMs/at`），走第二道——属设计内的兼容路径。

## 3. 附带事实（不影响判定）

- 同一文件在同毫秒有两条 `去重跳过`（`04:09:57.070` / `.071`）：DONE 通道与启动扫描各记一条，**投递只发生一次**，符合「不得静默」，非重复投递。
- 真机仍有已投件被反复唤醒的现象（豆包联络人静默期间累计 5 条 replay 通知），但那些是 **DSH 重启后的重扫通知**，日志记录为 `原因=启动前旧文件(mtime<=lastDeliveredAt)` 的跳过；本卡范围不含「真机重复触发复现」（派验单 §明确不在本卡范围），故**不据此判不通过**，留档另轮。
- 执行方自报 `node index.test.mjs` = 160/160 与我的复跑一致；自报的芯片档位（「豆包·自动档」）与联络人读回的 `DeepSeek V4.1 Flash 高` 不符，属记录性问题，不是本卡判据。

## 4. 判定

C1–C7 **7/7 通过**，`node index.test.mjs` 160/160（我自己跑），两条反证分别打红 TC1 / TC2。**首验 PASS**，限 `p31-v2.md` 判据 C1–C7 与卡面 `:18-63` 范围；真机重复触发复现不在本卡，另轮。

<!-- DONE -->
