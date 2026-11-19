执行方：WorkBuddy
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连
# p56 回执 · workbuddy 文档陈旧判据与 Hy4 残档清理

取数件：`.batch/night/staging/verdict-wb-docs-debt-1116.md` / 3,334B / `6daf9c9a45be01c794a80a5506803051`
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连

执行方：WorkBuddy　卡面：`p56-wb-docs-stale.v5`（以 v5 为执行件）
工作目录：`C:/develop/workspace/AI-writer/wt-p56`　分支：`agent/p56-wb-docs`
起点 HEAD：`69cd4a41`　终点 HEAD：**`050abd10`**（`050abd1057938fa609c2d9ffcdba64a0c4e65a3c`，2026-11-16 12:12:34 +0800）
取数件复核：`wc -c` 3334 字节、`md5sum` `6daf9c9a45be01c794a80a5506803051` —— 与卡面三元组逐字一致，证据有效。

## 0. §0 六项前置（开工第一动作，全部通过）

| # | 检查 | 输出 |
|---|---|---|
| 1 | `git rev-parse --show-toplevel` | `C:/develop/workspace/AI-writer/wt-p56` ✓ |
| 2 | `git branch --show-current` | `agent/p56-wb-docs` ✓ |
| 3 | `git rev-parse --short HEAD` | `69cd4a41` ✓ |
| 4 | `git diff --numstat HEAD` / `--ignore-cr-at-eol --stat HEAD` | 双空 ✓ |
| 5 | `git -c core.quotepath=false status --porcelain=v1` | 空（无 `??`，无 M/A/D/R/U）✓ |
| 6 | 目标文件存在 | `docs/agents/workbuddy-channel.md`(31058B) / `scripts/workbuddy/workbuddy-attach.mjs`(39620B) ✓ |

行号无漂移：改前 `grep -n 'Hy4'` 命中恰为 8 行（139/143/144/188/208/274/296/303），与卡面 §4.2 期望集合完全一致。

## 1. 判据 1 · `--cwd` 判据（负例 + 正例双检）

**负例**（`scripts/` 下无残留绝对说法）：
```
$ grep -n '只允许 wt-2\|指到别处' docs/agents/workbuddy-channel.md scripts/workbuddy/workbuddy-attach.mjs
（无输出，exit 1）
```
说明：`:5` 通道定位句原文为「工作目录固定 `wt-2`」、`:130` 前半句「归属固定、不抢…」均未触发该模式，且按卡面不在本判据范围内，两句均**未改动**。

**改前基线**（08:44 口径复现）：`grep -c 'WORKBUDDY_ALLOWED_CWDS' docs/agents/workbuddy-channel.md` = `0`；`scripts/workbuddy/workbuddy-attach.mjs` 该词命中原为 66/71/798/841，`:810` 无命中。

**正例（硬）**：
```
$ grep -c 'WORKBUDDY_ALLOWED_CWDS' docs/agents/workbuddy-channel.md
3
```
```
$ grep -n 'WORKBUDDY_ALLOWED_CWDS' docs/agents/workbuddy-channel.md
116:选项：`--session <id>` · `--timeout 秒`（默认 900）· `--json` · `--no-wait` · `--port` · `--model <名字>`（见 §4）· `--cwd <目录>`（默认 wt-2；可先 `set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>]` 注册额外目录，未注册的目录 exit 1）· `--force`（越过归属护栏，排障用，报告里写明）。
130:- 归属固定、不抢：WorkBuddy 不许在 develop 或 wt-1 里改文件；`--cwd` 默认 wt-2；未注册的目录**直接 exit 1 拒绝**（`checkPinnedCwd`），要先 `set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>]` 注册；`--force` 可越过但须写明原因。
225:| 「侧栏找不到空间 wt-2 的新建按钮」 | 该目录还没在 WorkBuddy 里打开过：让作者打开一次该目录；要投非 wt-2 目录**先注册再投**——`set WORKBUDDY_ALLOWED_CWDS=<绝对路径>`，未注册的目录一律 exit 1。**不要**换目录迁就（归属固定） |
```
命中行号集合 = {116, 130, 225}，**包含**卡面要求的三行；计数 3 ≥ 3 ✓

```
$ grep -n 'WORKBUDDY_ALLOWED_CWDS' scripts/workbuddy/workbuddy-attach.mjs
66:/** 额外归属白名单：环境变量 `WORKBUDDY_ALLOWED_CWDS`，绝对路径清单，`path.delimiter`（Windows=;）分隔。
71:const ALLOWED_CWDS = String(process.env.WORKBUDDY_ALLOWED_CWDS ?? '')
798:    '归属：默认固定 wt-2；要投别的目录先 set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>] 注册，用完即失效',
810:    '     --cwd <目录>（默认 wt-2；要投别的目录先 set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>] 注册，未注册的目录 exit 1） · --force（越过归属护栏，排障用，报告里写明）',
841:  // 归属护栏：--cwd 默认只准指向 wt-2，另可用 WORKBUDDY_ALLOWED_CWDS 注册额外目录
```
`:810` 命中 ✓

## 2. 判据 2 · Hy4 判据行与加注

```
$ grep -c 'Hy4' docs/agents/workbuddy-channel.md
8
```
八行原文：
```
139:**2026-11-07 20:2x 作者订正（历史）**：Hy4 在 **2026-11-15 之前全天候免费，但日内有额度上限**。~~促销期优先于原时段表 ⇒ 促销期内任何时段都走 Hy4~~ **该指引已于 2026-11-16 作废**：**Hy4 已全线禁用**，依据 `scripts/workbuddy/model-policy.mjs:26` `HY4_DISABLED = true`（白名单里也不再有它）⇒ 现行不分时段、不分促销期，一律不出 Hy4。
143:| ~~**≤ 2026-11-15 全天（促销期，含末日）**~~ **历史行** | ~~**Hy4**~~ 已禁用 | 全天候限免促销（作者 2026-11-07 订正，2026-11-15 已到期），**不作为当前可选模型** | ~~自动切到 Hy4~~ 已随全线禁用作废；现行不分时段走 **DeepSeek-V4.1-Flash** |
144:| ~~促销期后 · 每天 23:00–次日 08:00~~ **历史行** | ~~**Hy4**~~ 已禁用 | Hy4 preview 夜间限免（腾讯公告，IT之家 2026-10-02 转载），已随 2026-11-16 全线禁用作废 | ~~自动切到 Hy4~~ 作废；**现行夜间档同走 DeepSeek-V4.1-Flash**（非高峰 5 折） |
188:- **烧积分**：Hy4 夜间 0.00x、DeepSeek 0.11x×5 折才便宜；高峰原价已由脚本拦住。一条长任务动辄几十万 token。（Hy4 已于 2026-11-16 全线禁用，`model-policy.mjs:26` `HY4_DISABLED = true`；本段仅留历史）
208:- 模型自动切换：Hy3 → Hy4 切换 + 读回校验通过。（Hy4 已于 2026-11-16 全线禁用，`model-policy.mjs:26` `HY4_DISABLED = true`；本段仅留历史）
274:## 13. 能力画像与派活分工（2026-11-05 实测，Hy4 夜间档）（Hy4 已于 2026-11-16 全线禁用，`model-policy.mjs:26` `HY4_DISABLED = true`；本段仅留历史）
296:| 代码、脚本、接口、复算、环境验证 | **WorkBuddy / Hy4** | 工具与代码执行稳，报告证据链完整（Hy4 已于 2026-11-16 全线禁用，`model-policy.mjs:26` `HY4_DISABLED = true`；本段仅留历史） |
303:- Hy4 夜间免额是**产品侧额度**，`status` 不返回剩余额度、也没有结构化错误码；CLI 会在拿不到回复时把兜底文案当普通回复返回，**退出码仍 0**。（Hy4 已于 2026-11-16 全线禁用，`model-policy.mjs:26` `HY4_DISABLED = true`；本段仅留历史）
```
- `:139`/`:143`/`:144`：「促销期内任何时段都走 Hy4」已删除/划废，只剩历史标记 + 禁用依据 ✓
- `:188`/`:208`/`:274`/`:296`/`:303`：每行均含「已禁用」与「仅留历史」，原文保留 ✓
- `:148`（只列常量名）**未改** ✓；`:5`、`:130` 前半句、`worktree-parallel.md`、`model-policy.mjs` **未改** ✓

依据核对：`scripts/workbuddy/model-policy.mjs:26` 实为 `export const HY4_DISABLED = true`；`:32` `ALLOWED_MODELS = HY4_DISABLED ? [MODEL_DEEPSEEK_FLASH] : [...]`。

## 3. 判据 3 · 脚本语法与 usage

```
$ node --check scripts/workbuddy/workbuddy-attach.mjs
（无输出，exit 0）
$ node scripts/workbuddy/workbuddy-attach.mjs help | grep -n 'ALLOWED_CWDS'
3:归属：默认固定 wt-2；要投别的目录先 set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>] 注册，用完即失效
15:     --cwd <目录>（默认 wt-2；要投别的目录先 set WORKBUDDY_ALLOWED_CWDS=<绝对路径>[;<绝对路径>] 注册，未注册的目录 exit 1） · --force（越过归属护栏，排障用，报告里写明）
```
usage 行命中 ✓

## 4. 判据 4 · 回归闸门

```
$ pnpm check:fast
[check:fast] typecheck ✓ 44.9s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 2.2s
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
EXIT=0
```
提交时 pre-commit 钩子重跑同一闸门，同样全绿（typecheck ✓ 24.3s / broken 0 / 违规 0）。

## 5. 判据 5 · 改动面

```
$ git diff --name-only HEAD
docs/agents/workbuddy-channel.md
scripts/workbuddy/workbuddy-attach.mjs
```
（该命令在提交前采集；提交后工作区已干净）

提交后 `git diff --numstat HEAD` 为空（树干净）；对起点取差异：
```
$ git diff --numstat 69cd4a41 HEAD
11	11	docs/agents/workbuddy-channel.md
1	1	scripts/workbuddy/workbuddy-attach.mjs
$ git diff --stat 69cd4a41 HEAD
 docs/agents/workbuddy-channel.md       | 22 +++++++++++-----------
 scripts/workbuddy/workbuddy-attach.mjs |  2 +-
 2 files changed, 12 insertions(+), 12 deletions(-)
```
文档侧恰 11 行（= 卡面 §3 点名的 11 个行号），脚本侧 1 行（`:810`）。`worktree-parallel.md`、`model-policy.mjs` 均不在列表 ✓

## 6. 判据 6 · 提交纪律

```
$ git add docs/agents/workbuddy-channel.md scripts/workbuddy/workbuddy-attach.mjs   # 点名，未用 -A
$ git -c core.quotepath=false status --porcelain=v1
M  docs/agents/workbuddy-channel.md
M  scripts/workbuddy/workbuddy-attach.mjs
$ git rev-parse HEAD
050abd1057938fa609c2d9ffcdba64a0c4e65a3c
```
**未 push / 未 tag / 未 publish**（无远端写操作）。

## 7. 判据 7 / 8 · 三元素与执行方口径

判据 7：首行已钉 `.batch/night/staging/verdict-wb-docs-debt-1116.md` / 3,334B / `6daf9c9a45be01c794a80a5506803051`，本节复写同组值，`wc -c` 与 `md5sum` 实测一致。
判据 8：第二行已钉 `model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连`（本次派活走官方直连，无转售 provider）。

## 8. 投递留痕（等价三件套）

① 会话库行（`~/.workbuddy/workbuddy.db` `sessions` 表）：`dc1f3156-3e45-420c-83f4-b5c0b61840c2` / 标题「修复 WorkBuddy 文档判据与清理 Hy4 残留」/ `cwd=C:/develop/workspace/AI-writer/wt-p56` / `model=deepseek-v4.1-flash` / 起 2026-11-16 12:08:48 / status `working`
② 提交 SHA：`050abd1057938fa609c2d9ffcdba64a0c4e65a3c`
③ 回执（`read --session <id> --json`，报告落盘时刻快照，`messageCount=2`，终态以会话库为准）：
```json
{
  "reply": "本轮授权：可改码 + 可提交（禁 push / tag / publish）——按卡面 §3/§4.6 范围执行。\n先核 §0 的六项前置。",
  "messageCount": 2,
  "agentCount": 1,
  "chips": {
    "workspace": null,
    "branch": null,
    "permission": "允许完全访问",
    "model": "DeepSeek-V4.1-Flash"
  }
}
```

## 9. 待裁决（只报不擅动）

1. **`:810` 措辞偏离卡面字面**：卡面写「只允许 wt-2 或 `WORKBUDDY_ALLOWED_CWDS` 已注册的目录」，但该字面含「只允许 wt-2」，会再次命中判据 1 负例 grep。故按卡面「**与 `:798` 对齐**」这一主指令，采用 `:798` 原句式（默认 wt-2 + 先注册），语义等价且负例 grep 干净。若裁定必须逐字照抄，需同时修正判据 1 的负例模式。
2. **`pnpm check:fast` 触发了一次非显式安装**：`pnpm run` 在本目录发现 `node_modules` 不同步，自动执行了链接安装（输出含 `+ electron 41.10.7` 等，35s，无原生重编译日志）。核对 `node_modules/better-sqlite3/build/Release/better_sqlite3.node` mtime 仍为 2026-03-14，**未切 ABI**；`git status` 无 lockfile 变化。若卡面「禁 pnpm install」要覆盖此类隐式安装，建议后续在该卡给出等价的 `node scripts/check-fast.mjs` 直调写法。
3. **派验单位置**：`.batch/night/review-requests/p56.v5.md` 已在 `develop/.batch/night/` 下（08:56/09:00 落盘，`执行方：WorkBuddy`），wt-p56 侧无该件；本卡未复制第二份，避免双源。回执与信号也统一写在 `develop/.batch/night/`（`.batch` 已在 `.gitignore:89`，不产生提交）。
4. **`--force` 与归属护栏的旧叙述**：`:101`、`:192`、`:200`、`:131` 仍按「越过归属护栏」讲 `--force`，与「可注册白名单」并存但不冲突，本卡未列入改动范围，故未动。

<!-- DONE -->
