结论：PASS ｜ 产物：2a3504b4a3319f394e5e81a3c6c5d5ccf874e29b ｜ 判定线：六条逐条 ｜ 证据：见下文

# WB-P3 · dsh-file-watch 开源清理 · 执行报告

- 仓库：`C:\develop\workspace\dsh-file-watch`（独立 git 仓库）
- 本轮授权：可改码 + 可提交，不可推送。**未推送**。
- 改前 HEAD：`4d5d3a7`；改前工作区：` M .gitignore`（一行 `reports/`，已按要求一并提交）。
- 改后提交：本轮 **2 笔**，`54220e8`（主体六件事）→ `2a3504b`（README 安装段路径写法收口）。首段「产物」= 最终 HEAD `2a3504b4a3319f394e5e81a3c6c5d5ccf874e29b`；判定线 6 的 diff 以 `4d5d3a7..HEAD` 累计口径举证。
- 时间盒：02:18 起，02:50 收口，约 32 分钟，在 60 分钟内完成，无超时硬凑。
- 依据优先级：卡面定稿 > 豆包只读审查 `doubao-oss-readiness.md`（后者只作线索）。与报告有出入处以本卡为准，已在 §6 列明。

---

## 1. 六件事逐条落地

| # | 要求 | 落地 | 文件 |
|---|---|---|---|
| 1 | 清 `index.js:3` 悬空内部引用 | 只删「，取证见 reports/p2-multi-watch.md」半句，改为 `source 用 Session Format v4 的生产者自有 kind`；前两行技术说明原样保留 | `index.js:3` |
| 2 | 清测试里的内部字样 | `// 假 ctx 形状按任务给定：` → `// 最小假 ctx 形状：`。「按任务给定」这一派活口吻全仓仅此一处（更宽口径另扫出既有的 `// 判定线：` 与 T1–T8 标签，见 §6.1 单列待裁决）；**未改任何编号** | `index.test.mjs:4` |
| 3 | README 安装段可执行 + 三字段说明 + 硬要求句 | 补「本地目录 → `file:` 依赖 → `dsh.profile.bundles` 注册 → `pnpm install` → `cordis.patch.yml` 同名 id 配置 → 重启宿主」五步；`file:` 值给出 POSIX 与 Windows 盘符两种已验证形态；`watches` / `stableMs` / `doneMarker` 各自独立一句说明 + 复用 YAML 示例；补 `targetSessionId` 会话 id 硬要求句。两份内容对齐、双向互链核对后保持 | `README.md`、`README.zh-CN.md` |
| 4 | 补 LICENSE | MIT 标准全文，版权行 `Copyright (c) 2026 the dsh-file-watch authors`。`package.json:19` 原已为 `"license": "MIT"`，核对一致、**未改动** | `LICENSE`（新增）、`package.json`（未改） |
| 5 | 补测试覆盖 | 19 条分支逐条自查，全部确为未覆盖，补 23 条断言；只加测试、判定逻辑零改动。`node index.test.mjs` 31/31 PASS，失败 0 | `index.test.mjs` |
| 6 | 提交 `.gitignore` | 与其余改动同批提交，`+reports/` 那行在提交 diff 内 | `.gitignore` |

**安装写法的来源与验证**：`file:` 依赖 + `dsh.profile.bundles` 注册 + `cordis.patch.yml` 同名 id 覆盖 config，取自本机已生效的 profile 配置（可查证的实际在用形态，非推测）。另在隔离临时 profile 目录实测 `file:` 依赖经 `pnpm install` 可链接、`require.resolve('dsh-file-watch/package.json')` 可解析，临时目录已删除。**未做实机重启加载验证** —— 卡面禁止重启 DSH。测试全部使用 `os.tmpdir()` 下 `dfw-*` 临时目录，未往 `scripts/dsh/wakeup-inbox/` 丢任何文件。

---

## 2. 判定线六条逐条

### 判定线 1 · 全仓脱敏 grep 0 命中 —— **PASS**（除 1 处允许项）

命令（12 个口径词全覆盖，排除 `.git/` 与 `node_modules/`）：

```
grep -rnF --exclude-dir=.git --exclude-dir=node_modules -e 'C:\develop' -e 'AI-writer' -e '.batch' -e 'night' -e 'reports/' -e 'WB-' -e 'DB-' -e '豆包' -e 'WorkBuddy' -e 'workbuddy' -e 'QA' -e '产品经理' .
```

**改前基线输出原文（2 处，与派卡方基线一致）**：

```
./.gitignore:3:reports/
./index.js:3:// DONE 命中立即投递；source 依 Session Format v4（生产者自有 kind），取证见 reports/p2-multi-watch.md。
```

**改后输出原文（仅 1 处）**：

```
./.gitignore:3:reports/
[grep exit=0]
```

唯一残留即卡面第 6 条明令提交、并允许保留的 `.gitignore:3` 的 `reports/`；`index.js:3` 那处已清。除这一行外全清。

补充更宽口径的自查（非卡面口径，主动加扫）：

```
grep -rnE --exclude-dir=.git --exclude-dir=node_modules '按任务给定|取证见|内部验收|派卡|wakeup-inbox|session-[0-9a-f]{8}|p2-multi-watch|判定线：' .
→ ./index.test.mjs:7:// 判定线：
```

这一处及既有 T1–T8 标签**按卡面第 2 条「不要为了凑数去改编号，找不到就不改」原样保留**，详见 §6 待裁决。它们不在卡面 12 词口径内，也不是本次新增。

### 判定线 2 · README 无背景叙述 / 无内部项目人名卡号 —— **PASS**

两份 README 安装段均为纯技术步骤（本地目录、`file:` 依赖、bundle 注册、patch 层、重启），无「这是给多 agent 派卡流程做的」类背景叙述，无内部项目名、人名、卡号、真实路径、真实会话号（会话 id 仍是占位符 `session-xxxx…`）。扫描原文：

```
grep -rniE 'background|multi-agent|task board|card number|internal' README.md README.zh-CN.md
→ (无命中)
```

互链核对：`README.md:1` = `[中文](README.zh-CN.md)`；`README.zh-CN.md:1` = `[English](README.md)` —— **双向互链本就齐全，无需补，保持原样**。两份安装段/配置字段说明/测试段/许可证段内容对齐。

### 判定线 3 · git log / status 原文，status 干净 —— **PASS**

`git log --oneline -3` 原文：

```
2a3504b docs: document the Windows drive-letter form of the file: dependency
54220e8 chore: prepare repository for open-source release
4d5d3a7 feat: support multiple watch targets; add Chinese README
```

`git status --porcelain` 原文（提交后，二次确认）：

```
[status 输出结束（空）]
```

即输出为空，工作区干净，无残留。提交内容累计 `6 files changed, 581 insertions(+), 54 deletions(-)`，`create mode 100644 LICENSE`。

### 判定线 4 · 测试输出原文、失败 0、PASS 行数 ≥ 基线、逐条说明分支 —— **PASS**

**改前基线**：`TOTAL: 8/8 PASS`，汇总区 **8 行 PASS**（T1 / T2a / T4 / T2b / T3 / T5 / T7 / T8），`RESULT: PASS`，exit 0。基线完整输出见 §4。

**改后**：`TOTAL: 31/31 PASS`，汇总区 **31 行 PASS**（8 行原有 + 23 行新增），失败 0，`RESULT: PASS`，exit 0。31 ≥ 8，达标。完整输出原文见 §4（含逐行 `PASS` 与汇总，未做任何节选）。

**新增 23 条逐条说明覆盖哪个分支**：豆包报告 §5.1 点名 19 项未覆盖分支，我逐条自查**全部确为未覆盖**（无一属于「报告说没覆盖但实际有测试」），故无跳过项。逐一说明：

| 审查分支 | 自查结论（为什么确实没覆盖） | 新增断言（测试标签原文） |
|---|---|---|
| B1 `stableMs` 非有限/≤0 回退 5000 | 原有测试全用合法值 5000/500 | `stableMs 非正数 / 非有限值回退到默认 5000` |
| B2 `message` 四占位符替换 | T4 只验默认消息形状，未传自定义模板 | `自定义 message 模板替换 {file}/{reason}/{size}/{mtimeMs}` |
| B3 `doneMarker` 自定义值 | 原有只验默认 `<!-- DONE -->` | `自定义 doneMarker 命中即投递，默认标记不再立即投递`；`未命中自定义标记的文件在静默窗口到期后按 stable 投递`（2 条） |
| B4 `watches` 非数组/空 → warn 未启动 | T8 是反向断言「不应整插件不启动」，未测正向空数组 | `watches 缺失 / 空 / 非数组 → 写「未启动」warn 且不抛` |
| B5 `dir` 非绝对路径跳过 | T8 测的是「目录不存在」，不是相对路径 | `dir 非绝对路径、targetSessionId 空或非字符串 → 逐条跳过并点名`（与 B6 同一条，内含 3 个配置变体） |
| B6 `targetSessionId` 空/非字符串 | 同上，未测 | 同 B5 那条断言 |
| B7 `agents.get` 抛错 → warn 继续 | 原有无抛错注入 | `agents.get 抛错 → 写 warn，并经 roots 兜底继续投递` |
| B8 `agents.roots` 抛错 → warn 继续 | 原有 roots 恒为 `() => []` | `agents.roots 抛错 → 写 warn、不抛、不投递` |
| B9 `get` 返 undefined 但 `roots()` 命中兜底 | T5 只测 roots 为空 | `get 返回 undefined 但 roots 中有该 id → 兜底命中并投递` |
| B10 `followup` 抛错 → warn | 原有 followup 恒成功 | `followup 抛错 → 写 warn 且不向调用方抛` |
| B11 `fs.watch` 启动失败 / watcher error | 原有目录均真实存在 | `fs.watch 启动失败 → 写 warn、自行 dispose、不抛`；`watcher error 事件 → 写 warn 且不抛`（2 条） |
| B12 `filename` 为 null → `listFiles()` 全扫 | 真实 fs.watch 事件不可控，未测 | `filename 为 null → listFiles 全扫并投递目录内文件` |
| B13 空文件 / 尾部读失败 | 原有文件均非空且可读 | `空文件（尾部长度 ≤ 0）不误判 DONE，静默到期后按 stable 投递`；`尾部读失败（openSync 抛错）→ 不误判 DONE、不立即投递`（2 条） |
| B14 子目录被跳过 | 原有目录里只有文件 | `目录里的子目录被跳过（!isFile），不投递` |
| B15 事件后 / 到期时 stat 失败 | 原有未做删除竞态 | `事件后 stat 失败（文件不存在）→ 不投递、不残留 timer`；`到期时 stat 失败（文件被删除）→ 不投递、清除 pending`（2 条） |
| B16 同文件第二快照再投递 | T2b 只证「不重复」，未证「变了要再投」 | `同一文件第二快照（size 变化）再投递一次` |
| B17 `checkStable` 过期 state 早退 | 原有无竞态构造 | `checkStable 收到过期 state → 早退、不投递` |
| B18 `dispose` 幂等 / `ctx.effect` 注册 | 原有每次只 dispose 一次，且 ctx 无 `effect` | `ctx.effect 注册、dispose 幂等、卸载后不再投递` |
| B19 标记在尾部 2048 字节之外不立即投递 | 原有标记都在尾部 | `标记落在尾部 2048 字节之外 → 不立即投递`；`静默窗口到期后按 stable 投递`（2 条） |

合计 19 个分支 → 23 条新增断言（B3/B11/B13/B15/B19 各拆 2 条，B5+B6 合并 1 条）。**判定逻辑一行未改**：`index.js` 全程只有第 3 行注释变动（判定线 5 证据）；新增代码全在 `index.test.mjs`，为精确触发边界临时替换 `node:fs` 方法 / `setTimeout`，均在 `finally` 还原。

`index.test.mjs` 的 diff 为 `424 增 / 2 删`，这 2 行删除都在测试文件内部、与判定逻辑无关，如实列明：① 第 4 行内部字样注释（六件事第 2 条）；② 原清理循环 `for (const d of [dirA, ...])` 那一行被「边界与容错分支的覆盖」注释块替换（循环本身仍在，数组末尾追加了 `...extraDirs`）。故「只加测试、没碰实现」成立，但**不是零删除**。

### 判定线 5 · `source` 构造与 `watches` 解析零改动 —— **PASS**

`git diff 4d5d3a7 -- index.js` 完整原文：

```diff
diff --git a/index.js b/index.js
index e8a670b..d29e170 100644
--- a/index.js
+++ b/index.js
@@ -1,6 +1,6 @@
 // dsh-file-watch · 每个 watch 独立 fs.watch，各自持 (size, mtimeMs) 与 marker 状态。
 // 判定：事件记快照 → 重置静默 timer → 到期再 stat，两值没变才投递；变了重新计时、不投递、不排队。
-// DONE 命中立即投递；source 依 Session Format v4（生产者自有 kind），取证见 reports/p2-multi-watch.md。
+// DONE 命中立即投递；source 用 Session Format v4 的生产者自有 kind。
 
 import fs from 'node:fs';
 import path from 'node:path';
```

全文仅 1 删 1 增两行、都是同一行注释。`source` 构造（`plugin:${PLUGIN_NAME}`，`index.js:48`）与 `watches` 解析（`index.js:162-187`）零改动。过滤校验原文：

```
git diff 4d5d3a7 -- index.js | grep -E '^[+-][^+-]' | grep -vE 'DONE 命中立即投递'
→ (除注释外 0 行)
```

`cordis.patch.yml` 也零改动：`git diff 4d5d3a7 HEAD -- cordis.patch.yml` 输出为空。

### 判定线 6 · diff 含 LICENSE 新增与 `.gitignore` 的 `reports/` —— **PASS**

提交后工作区干净、`git diff`（工作区 vs HEAD）为空，故以相对改前 HEAD 的提交 diff 举证。

`git diff 4d5d3a7 HEAD --stat` 原文：

```
 .gitignore      |   1 +
 LICENSE         |  21 +++
 README.md       |  99 +++++++++----
 README.zh-CN.md |  86 ++++++++----
 index.js        |   2 +-
 index.test.mjs  | 426 +++++++++++++++++++++++++++++++++++++++++++++++++++++++-
 6 files changed, 581 insertions(+), 54 deletions(-)
```

`git diff 4d5d3a7 HEAD -- .gitignore` 原文：

```diff
diff --git a/.gitignore b/.gitignore
index e964d23..5070a5e 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,2 +1,3 @@
 node_modules/
 inbox/
+reports/
```

`git diff 4d5d3a7 HEAD -- LICENSE` 原文（前 12 行，全文 21 行）：

```diff
diff --git a/LICENSE b/LICENSE
new file mode 100644
index 0000000..e070a0e
--- /dev/null
+++ b/LICENSE
@@ -0,0 +1,21 @@
+MIT License
+
+Copyright (c) 2026 the dsh-file-watch authors
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
```

---

## 3. 六条判定线汇总

| 判定线 | 结论 | 关键证据 |
|---|---|---|
| 1 脱敏 grep 0 命中 | PASS | 改前 2 处 → 改后仅 `.gitignore:3:reports/`（卡面允许保留） |
| 2 README 无背景叙述 / 内部词 | PASS | 扫描无命中；双向互链核对齐全；两份对齐 |
| 3 log/status 原文、status 干净 | PASS | `2a3504b` 在顶（本轮 2 笔）；`git status --porcelain` 空 |
| 4 测试全绿、PASS ≥ 基线、逐条说明 | PASS | 基线 8 → 改后 31，失败 0；19 分支逐条核过全为未覆盖 |
| 5 `source`/`watches` 零改动 | PASS | `index.js` diff 仅注释 1 行；`cordis.patch.yml` 空 |
| 6 diff 含 LICENSE + `.gitignore` | PASS | `LICENSE` new file、`+reports/` 均在提交 diff 内 |

---

## 4. `node index.test.mjs` 完整输出原文

### 4.1 改前基线（改任何文件之前先跑，记录 PASS 行数）

```
=== BASELINE TEST ===
[18:20:21.585] 场景 A 开始：watches[0].dir=C:\Users\<用户名>\AppData\Local\Temp\dfw-a-y6qDci，stableMs=5000
[18:20:24.632] PASS  T1 持续写 3 秒不产生任何 followup
[18:20:30.347] PASS  T2a 停止写 5 秒后产生恰好 1 次
[18:20:30.348]        消息原文：文件 growing.txt 已就绪（触发=stable），请继续。
[18:20:30.348]        消息 JSON：{"id":"386eb3fd-6ee8-4aed-8d3e-5efdaf23f6e1","role":"user","content":[{"type":"text","text":"文件 growing.txt 已就绪（触发=stable），请继续。"}],"source":{"kind":"plugin:dsh-file-watch"}}
[18:20:30.348] PASS  T4 UserMessage 形状（id/role/content/source）
[18:20:31.552] PASS  T2b calls.length 稳定（不重复触发）
[18:20:31.553] 场景 B 开始：写入含 <!-- DONE --> 的文件
[18:20:32.005]        触发原因："文件 done.txt 已就绪（触发=DONE），请继续。"
[18:20:32.006] PASS  T3 DONE 立即产生 1 次（真实投递耗时 6ms << stableMs=5000ms）
[18:20:32.461]        日志：[dsh-file-watch] 会话未加载：get(NO-SUCH-SESSION) 返回 undefined，roots() 中亦无匹配；文件 orphan.txt 未投递。当前可用 roots id: []
[18:20:32.461] PASS  T5 会话未加载：写日志、不抛、不投递
[18:20:32.464] 场景 D 开始：两个 watch 同时各写一个普通文件（stableMs=500）
[18:20:34.376]        S-D1 消息：文件 only-in-d1.txt 已就绪（触发=stable），请继续。
[18:20:34.376]        S-D2 消息：文件 only-in-d2.txt 已就绪（触发=stable），请继续。
[18:20:34.376] PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
[18:20:34.991]        跳过日志：[dsh-file-watch] 跳过 watches[0]：dir 不可读（Error: ENOENT: no such file or directory, stat 'C:\Users\<用户名>\AppData\Local\Temp\dfw-missing-14976-1794507634378'，dir=C:\Users\<用户名>\AppData\Local\Temp\dfw-missing-14976-1794507634378）
[18:20:34.992] PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作

===== 自测汇总 =====
PASS  T1 持续写 3 秒不产生任何 followup
PASS  T2a 停止写 5 秒后产生恰好 1 次
PASS  T4 UserMessage 形状（id/role/content/source）
PASS  T2b calls.length 稳定（不重复触发）
PASS  T3 DONE 立即产生 1 次（真实投递耗时 6ms << stableMs=5000ms）
PASS  T5 会话未加载：写日志、不抛、不投递
PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作
TOTAL: 8/8 PASS
RESULT: PASS
=== EXIT: 0 ===
```

### 4.2 改后最终输出（最终 HEAD `2a3504b` 上复跑，完整原文，未节选）

```
[18:49:39.314] 场景 A 开始：watches[0].dir=C:\Users\<用户名>\AppData\Local\Temp\dfw-a-504YeE，stableMs=5000
[18:49:42.373] PASS  T1 持续写 3 秒不产生任何 followup
[18:49:48.083] PASS  T2a 停止写 5 秒后产生恰好 1 次
[18:49:48.084]        消息原文：文件 growing.txt 已就绪（触发=stable），请继续。
[18:49:48.084]        消息 JSON：{"id":"51aa93ce-db99-4ff2-abda-1cbcfd9511f0","role":"user","content":[{"type":"text","text":"文件 growing.txt 已就绪（触发=stable），请继续。"}],"source":{"kind":"plugin:dsh-file-watch"}}
[18:49:48.084] PASS  T4 UserMessage 形状（id/role/content/source）
[18:49:49.294] PASS  T2b calls.length 稳定（不重复触发）
[18:49:49.296] 场景 B 开始：写入含 <!-- DONE --> 的文件
[18:49:49.751]        触发原因："文件 done.txt 已就绪（触发=DONE），请继续。"
[18:49:49.751] PASS  T3 DONE 立即产生 1 次（真实投递耗时 2ms << stableMs=5000ms）
[18:49:50.219]        日志：[dsh-file-watch] 会话未加载：get(NO-SUCH-SESSION) 返回 undefined，roots() 中亦无匹配；文件 orphan.txt 未投递。当前可用 roots id: []
[18:49:50.219] PASS  T5 会话未加载：写日志、不抛、不投递
[18:49:50.222] 场景 D 开始：两个 watch 同时各写一个普通文件（stableMs=500）
[18:49:52.134]        S-D1 消息：文件 only-in-d1.txt 已就绪（触发=stable），请继续。
[18:49:52.134]        S-D2 消息：文件 only-in-d2.txt 已就绪（触发=stable），请继续。
[18:49:52.134] PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
[18:49:52.747]        跳过日志：[dsh-file-watch] 跳过 watches[0]：dir 不可读（Error: ENOENT: no such file or directory, stat 'C:\Users\<用户名>\AppData\Local\Temp\dfw-missing-62816-1794509392135'，dir=C:\Users\<用户名>\AppData\Local\Temp\dfw-missing-62816-1794509392135）
[18:49:52.747] PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作
[18:49:52.750] PASS  stableMs 非正数 / 非有限值回退到默认 5000
[18:49:52.752] PASS  自定义 message 模板替换 {file}/{reason}/{size}/{mtimeMs}
[18:49:52.755] PASS  自定义 doneMarker 命中即投递，默认标记不再立即投递
[18:49:53.219] PASS  未命中自定义标记的文件在静默窗口到期后按 stable 投递
[18:49:53.219] PASS  watches 缺失 / 空 / 非数组 → 写「未启动」warn 且不抛
[18:49:53.221] PASS  dir 非绝对路径、targetSessionId 空或非字符串 → 逐条跳过并点名
[18:49:53.224] PASS  agents.get 抛错 → 写 warn，并经 roots 兜底继续投递
[18:49:53.227] PASS  agents.roots 抛错 → 写 warn、不抛、不投递
[18:49:53.229] PASS  get 返回 undefined 但 roots 中有该 id → 兜底命中并投递
[18:49:53.231] PASS  followup 抛错 → 写 warn 且不向调用方抛
[18:49:53.232] PASS  fs.watch 启动失败 → 写 warn、自行 dispose、不抛
[18:49:53.233] PASS  watcher error 事件 → 写 warn 且不抛
[18:49:53.235] PASS  filename 为 null → listFiles 全扫并投递目录内文件
[18:49:53.531] PASS  空文件（尾部长度 ≤ 0）不误判 DONE，静默到期后按 stable 投递
[18:49:53.533] PASS  尾部读失败（openSync 抛错）→ 不误判 DONE、不立即投递
[18:49:53.534] PASS  目录里的子目录被跳过（!isFile），不投递
[18:49:53.535] PASS  事件后 stat 失败（文件不存在）→ 不投递、不残留 timer
[18:49:53.829] PASS  到期时 stat 失败（文件被删除）→ 不投递、清除 pending
[18:49:53.833] PASS  同一文件第二快照（size 变化）再投递一次
[18:49:53.836] PASS  checkStable 收到过期 state → 早退、不投递
[18:49:53.837] PASS  ctx.effect 注册、dispose 幂等、卸载后不再投递
[18:49:53.968] PASS  标记落在尾部 2048 字节之外 → 不立即投递
[18:49:54.217] PASS  静默窗口到期后按 stable 投递

===== 自测汇总 =====
PASS  T1 持续写 3 秒不产生任何 followup
PASS  T2a 停止写 5 秒后产生恰好 1 次
PASS  T4 UserMessage 形状（id/role/content/source）
PASS  T2b calls.length 稳定（不重复触发）
PASS  T3 DONE 立即产生 1 次（真实投递耗时 2ms << stableMs=5000ms）
PASS  T5 会话未加载：写日志、不抛、不投递
PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作
PASS  stableMs 非正数 / 非有限值回退到默认 5000
PASS  自定义 message 模板替换 {file}/{reason}/{size}/{mtimeMs}
PASS  自定义 doneMarker 命中即投递，默认标记不再立即投递
PASS  未命中自定义标记的文件在静默窗口到期后按 stable 投递
PASS  watches 缺失 / 空 / 非数组 → 写「未启动」warn 且不抛
PASS  dir 非绝对路径、targetSessionId 空或非字符串 → 逐条跳过并点名
PASS  agents.get 抛错 → 写 warn，并经 roots 兜底继续投递
PASS  agents.roots 抛错 → 写 warn、不抛、不投递
PASS  get 返回 undefined 但 roots 中有该 id → 兜底命中并投递
PASS  followup 抛错 → 写 warn 且不向调用方抛
PASS  fs.watch 启动失败 → 写 warn、自行 dispose、不抛
PASS  watcher error 事件 → 写 warn 且不抛
PASS  filename 为 null → listFiles 全扫并投递目录内文件
PASS  空文件（尾部长度 ≤ 0）不误判 DONE，静默到期后按 stable 投递
PASS  尾部读失败（openSync 抛错）→ 不误判 DONE、不立即投递
PASS  目录里的子目录被跳过（!isFile），不投递
PASS  事件后 stat 失败（文件不存在）→ 不投递、不残留 timer
PASS  到期时 stat 失败（文件被删除）→ 不投递、清除 pending
PASS  同一文件第二快照（size 变化）再投递一次
PASS  checkStable 收到过期 state → 早退、不投递
PASS  ctx.effect 注册、dispose 幂等、卸载后不再投递
PASS  标记落在尾部 2048 字节之外 → 不立即投递
PASS  静默窗口到期后按 stable 投递
TOTAL: 31/31 PASS
RESULT: PASS
=== EXIT: 0 ===
```

（输出里的 `C:\Users\…\AppData\Local\Temp\dfw-*` 是 `os.tmpdir()` 运行时临时目录，来自测试自身，不是仓库文件内容，脱敏 grep 不计入。）

---

## 5. 提交内容

本轮 2 笔提交，均未推送：

- `54220e8` · `chore: prepare repository for open-source release` —— 六件事主体，6 个文件：

```
 .gitignore      |   1 +
 LICENSE         |  21 +++
 README.md       |  96 +++++++++----
 README.zh-CN.md |  84 +++++++----
 index.js        |   2 +-
 index.test.mjs  | 426 +++++++++++++++++++++++++++++++++++++++++++++++++++-
```

- `2a3504b` · `docs: document the Windows drive-letter form of the file: dependency` —— 收口修正：安装段的 `file:` 示例原先只写 POSIX 路径，而实测验证过的是 Windows 盘符形式（`file:C:/...`），补成双平台写法并同步两份 README。2 files changed, 12 insertions(+), 7 deletions(-)。

累计（`4d5d3a7..HEAD`）：`6 files changed, 581 insertions(+), 54 deletions(-)`。

未改目录名/包名；未重启 DSH；未往产线通道丢文件。

---

## 6. 与豆包报告的差异、保留项与待裁决

以下按「卡面为准」处理，并如实列出，供裁决：

1. **内部验收编号（豆包 P3）**：报告建议把 `// 判定线：` 段与 T1–T8 标签改成行为描述、并修 T6 跳号。卡面第 2 条明确「我全仓扫过，只有这一处；豆包报告说的『内部验收编号』我没找到，**不要为了凑数去改编号，找不到就不改**」。实际核对：`index.test.mjs:7` 确有 `// 判定线：`，标签 T1–T8 存在且 T6 跳号。**按卡面原样保留，未动一字**。它不在卡面 12 词口径内；若后续决定清理，属独立一轮改动。
2. **`.gitignore` 的 `inbox/`（豆包 P4）**：报告建议合并注释。卡面第 6 条只要求提交既有的 `+reports/` 一行，未授权改其他行，故 `inbox/` 与注释均**未动**。
3. **测试段 `8/8 PASS` 表述**：两份 README 原写死 `8/8 PASS`，测试增至 31 条后该数字会失真。改为不写死数字的中性表述「预期每一条都报 `PASS`，汇总以 `RESULT: PASS` 结尾」，两份对齐。属必要同步，非擅自扩范围。
4. **豆包 §4.3 附注（package.json `files`/`repository`、默认文案为中文）**：不在本卡六件事内，未处理，留待后续裁决。
5. **安装段的可执行性边界**：`file:` 依赖 + `pnpm install` 已在隔离临时目录实测链接成功；bundle 注册与 patch 层写法取自本机已生效 profile 的在用形态。因卡面禁止重启 DSH，**未做实机加载/真实投递验证** —— 这是本轮唯一未实机闭环的环节，如实标注。
6. **为何 2 笔提交**：第一笔 `54220e8` 收口六件事后，自查发现安装段 `file:` 示例只写了 POSIX 路径，而我实测验证过的是 Windows 盘符形式，与卡面「写实际可执行的那一种，不确定就写你验证过的」有落差，故补双平台写法并同步两份 README，形成第二笔 `2a3504b`。**未 amend 已有提交**（避免改写已落盘产物），最终 HEAD 即首段产物 SHA；判定线 6 的 diff 用 `4d5d3a7..HEAD` 累计口径，LICENSE 与 `+reports/` 均在范围内。

---

## 6b. 上下文隔离复核（签字换身份）

按项目 T0「干完 ≠ 完成」，另派一个只读复核者（不接触本轮执行上下文、只给要求与判定线），独立重跑命令取证。其结论：**总结论 PASS，六条判定线逐条 PASS**，实测 HEAD `2a3504b4a3319f394e5e81a3c6c5d5ccf874e29b` 与报告首段一致；独立跑 `node index.test.mjs` 得 `TOTAL: 31/31 PASS` / `RESULT: PASS` / exit 0、汇总区 31 行 PASS；12 词口径脱敏 grep 独立得同一条允许残留；`git status --porcelain` 空；`cordis.patch.yml` diff 空；`LICENSE` 经 `git cat-file -e 4d5d3a7:LICENSE` 确认为真新增。

复核者提出的措辞问题已就地修正：① §1 第 2 条「全仓仅此一处」收紧为「『按任务给定』这一派活口吻全仓仅此一处」；② 判定线 4 补注 `index.test.mjs` 是 `424 增 / 2 删`、列明 2 行删除的出处，不再笼统写「只加测试」。其余提示（判定线 1 口径本身「0 命中 vs 允许 1 处」的字面张力、基线为历史自述无法在当前工作区复现、安装段未实机闭环、既有 T 编号体系）本报告已分别在 §2 判定线 1、§4.1、§6.5、§6.1 如实标注，均不影响判定。

复核为只读，**未修改仓库任何文件、未提交、未推送**；此后仅编辑本报告。

---

## 7. 一句话

六件事全部落地、六条判定线逐条有原文证据、测试 31/31 全绿、提交干净未推送；唯一按卡面明令保留的是既有 T 编号体系，已单列待裁决。

<!-- DONE -->
