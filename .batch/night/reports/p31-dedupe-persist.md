# P31 v2 · 投递层物理去重（判重键加 contentHash）

- 执行：豆包（自动档）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点（投前现取）：`15e9d835a6c1`「docs: fix settings card entry wording」
- 提交：**未提交**（跨 agent 红线 2：禁止任何 git 写操作，提交权不在我）。改动留在工作区：` M index.js`、` M index.test.mjs`
- 卡面：P31 v2（取代 11-14 那版；v1 报告原文另存 `p31-dedupe-persist-v1-1114.md`）

## 0. 与卡面基线的差异（先说清楚）

1. **起点已前进**：卡面写「起点＝P28b 后的 HEAD / 138 条」，实测 HEAD 是 `15e9d83`，其中 `801dc38`「fix: persist delivered snapshots for physical dedupe」就是 P31 v1 的落盘表（①落盘、②启动基准、④跳过日志已落地），基线测试是 **156/156**。所以本版做的是增量：补 contentHash 维度、钉日志字段、换 TC1–TC4。
2. **一处文案与卡面字面不一致**：卡面 §二.3 把 size/mtime 命中的原因钉成 `原因=重复(size,mtime)`；既有回归 `index.test.mjs:3209` 断言的是 `原因=重复(size,mtime 相同)`。红线 3 要求既有断言一律不动，故**保留旧文案**，`target` / `file` / `digest` 三个字段照样补齐。这是本版唯一的字面偏差，其余判据逐条对齐。

## 1. 改动（只动 `index.js` 与 `index.test.mjs`）

### ① 落盘表加 contentHash

- `dedupe.json` 条目：`{"size":n,"mtimeMs":n,"contentHash":"<sha256 hex>","at":iso}`（`rememberDeliveredSnapshot`，`index.js:421`）。
- 摘要取在「投递成功那一刻」——文件还没被微任务搬走，读的就是被投的那份字节。
- 原子写（临时文件 + rename）、写失败只 warn 不阻断：v1 的 `persistDedupeRegistry` 原样保留，未改。

### ③ 内容判重（本版主判据）

`dedupeVerdict()`（`index.js:456`）：

- 表里没有该绝对路径 ⇒ 不判重（**不读文件**，无额外 IO）。
- 表里有摘要 ⇒ 现算 `sha256(文件字节)`：
  - 相同 ⇒ 判重跳过；
  - **不同 ⇒ 直接放行**（不看 mtime / size，"内容变逾 1 字节必须放行"）。
- 表里没有摘要（v1 旧条目）或文件读不到 ⇒ 退回「30 秒内同 size/mtime」第二道。

`contentHashOfFile()`（`index.js:417`）只用内置 `node:crypto`（该模块早已 `import { createHash }`），读失败返回空串。

### ④ 跳过留痕

`skipDuplicate()`（`index.js:478`）固定格式：

```text
去重跳过 target=<dirKey> file=<文件名> digest=<contentHash 前 12 位> 原因=<原因>
```

- 原因取值：`重复(内容)` / `重复(size,mtime 相同)`（见 §0.2）；读不到内容时 `digest=unreadable`，字段不缺。
- 启动判旧那行（`isStartupNew`，`index.js:485`）也补齐 `target` / `file` / `digest`，口径统一。
- 调用点：`deliver()`（`index.js:1175`）、`consider()`（`index.js:1237`）。

实测原文（主跑，`dfw-profile-DXhKUI`）：

```text
2026-11-15T04:04:27.885Z INFO 去重跳过 target=14a4d42bcbf7 file=tc1.txt digest=2bda5f183b7d 原因=重复(内容)
2026-11-15T04:04:28.135Z INFO 去重跳过 target=6a5b92ee37cf file=tc2.txt digest=2bda5f183b7d 原因=重复(内容)
```

### ② 启动只捞新文件

v1 已实现（基准是 `lastDeliveredAtMs(bucket)`＝该 dir 所有条目 `at` 的最大值，不是启动时刻），本版未动。本版补一句语义：②只决定「要不要看一眼」，`consider()` 里**先判重、后 `isStartupNew`**，命中 ③ 内容判重的仍跳过。

## 2. 测试

全量：156 → **160/160 PASS**（新增 4 条）。

```text
PASS  P31 TC1 重载后同名同字节二次投（mtime 变新）→ 不投，日志含 target/file/digest 与 原因=重复(内容)
PASS  P31 TC2 已投件拷回 watch（size 不变、mtime 变新）→ 不投，走 原因=重复(内容)
PASS  P31 TC3 同 size 同 mtime 但内容改 1 字节 → 必须放行
PASS  P31 TC4 DONE 与 stable 对同一快照只投一次，跳过有留痕
TOTAL: 160/160 PASS
RESULT: PASS
```

构造与判据（`index.test.mjs:3346` 起）：

- **TC1**：投一次 → `dispose()` → 同名同字节写回原路径（`mtime = base+30s`，`size` 不变）→ 用**全新模块实例**（`?p31tc1=…`，内存表为空）再 `apply` ⇒ 仍只 1 次投递，日志 `… 原因=重复(内容)`，`digest` 等于 `sha256(body)` 前 12 位。做成跨重载，才能让「退回内存 Set」真的红（见 §3-A）。
- **TC2**（11-15 10:05 的事故形态）：投一次 → 从 `delivered` 把该件 `copyFileSync` 拷回 watch（同字节）→ `mtime` 改成 `base+60s` ⇒ 不投，走 `原因=重复(内容)`。
- **TC3**：先投 `AAAA…DONE`，再写 `AAAB…DONE`（同长度，`size` 完全一致），并把 `mtime` 设成与记录**一模一样** ⇒ 必须投第 2 次。这条证明「内容变必放行」压过 size/mtime 第二道。
- **TC4**：同一快照先触发 `DONE`（当拍投递），紧接着同一快照再来一次事件（本该进 `stable` 计时）⇒ 仍只 1 次；第二次触发有 `去重跳过` 留痕（不是静默丢）。等过 `stableMs` 后再断言，防"迟到的第二次"。

原有的 P31 a–f（含重载后仍挡住、首次不吞、停机期间仍投、写失败只 warn）全绿，未改断言。

## 3. 反证（临时副本里改，仓库未被碰）

脚手架：把 `index.js` / `index.test.mjs` / `client.js` / `package.json` / `cordis.patch.yml` 复制到临时目录，打桩后在那里跑。

**A 退回内存表**（`persistDedupeRegistry` 首行 `return`，不落盘留档）：

```text
FAIL  P31 b 重新加载后落盘表仍挡住同快照 → 不投递 :: 重载后不应再投，实际 2
FAIL  P31 f dedupe.json 写失败 → 只 warn，投递照常 :: （内存版没有落盘写失败这条 warn）
FAIL  P31 TC1 重载后同名同字节二次投（mtime 变新）→ 不投，… :: 期望 1，实际 2
TOTAL: 157/160 PASS
RESULT: FAIL
```

TC1 红＝`期望 1，实际 2`，正是「内存表重载即清空」的故障形态。

**B 去掉 contentHash**（`const stored = '';`）：

```text
FAIL  P31 TC1 重载后同名同字节二次投（mtime 变新）→ 不投，… :: 期望 1，实际 2
FAIL  P31 TC2 已投件拷回 watch（size 不变、mtime 变新）→ 不投，… :: 拷回不应再投，实际 2
FAIL  P31 TC3 同 size 同 mtime 但内容改 1 字节 → 必须放行 :: 期望 2，实际 1
TOTAL: 157/160 PASS
RESULT: FAIL
```

TC2 红＝拷回件被再投一次（事故复现）；TC3 反着红，说明没有内容维度时，同 size 同 mtime 的 1 字节改动会被 size/mtime 那道抢走吞掉。

## 4. 判据核对（C1–C7）

- **C1** 改动面：`git status --porcelain` 只有 ` M index.js`、` M index.test.mjs`；`client.js` / `package.json` 不在其中。
- **C2** 落盘表原子写 + 失败不阻断：`persistDedupeRegistry` 未改（tmp + `renameSync`，`try/catch` 内 `log(warn)`）；实测用例 f 绿（打桩 `renameSync` 抛 `EACCES`，投递照常 1 次）。
- **C3** 启动基准：读代码确认 `isStartupNew`（`index.js:485`）取 `lastDeliveredAtMs(bucket)`，判据 `state.mtimeMs > last`；代码里没有「启动时刻」参与。无桶时返回 true（首次运行全部视为新）。**这是读代码结论，不拿 TC1 当证据**（TC1 用的是 mtime 变新形态）。
- **C4** 四条 TC 真跑（§2），两条反证真红（§3）。
- **C5** 无新增依赖（只用内置 `node:fs` / `node:crypto`）；`client.js`、`package.json`、`cordis.patch.yml` 未动（porcelain 为空于三者）。
- **C6** 判重键含 `contentHash`（`dedupeVerdict` 在 `stored` 非空时以内容为准），「内容变必放行」在代码里是 `if (current !== stored) return null;`——先于任何 size/mtime 判断返回；TC3 就是这条的实测。
- **C7** 跳过日志行含 `target=` / `file=` / `digest=`（§1 实测原文）；成功投递不进 `relay.log`（该文件仍只写启动 / 移动失败 / 跳过 / 重扫）。

## 5. 工作区状态（红线 2：未提交）

```text
$ git log --oneline -3
15e9d83 docs: fix settings card entry wording
8778233 docs: align README with 0.5.0 and settings card entry
8df4e76 feat: probe directories via main-process route

$ git rev-parse --short=12 HEAD
15e9d835a6c1

$ git status --porcelain
 M index.js
 M index.test.mjs

$ git diff --numstat
45      13      index.js
123     0       index.test.mjs
```

没有 `git show --numstat HEAD`：本轮没有提交，HEAD 还是别人交的 `15e9d83`；`git diff --numstat` 是「本次改动面」的等价读数。未 `git add`、未 `commit`、未 tag、未 push。

## 6. 文件读数

```text
index.js          65,760 B  MD5 54A7FF5CD367F40A55F16EA4FAE990E4  （已改）
index.test.mjs   159,773 B  MD5 2AB0A244FACEFFBAA13D1964BFD5D1B4  （已改）
client.js         29,447 B  MD5 C34D10F59F4854C87AF4181E3D9F5A41  （未动）
package.json       1,085 B  MD5 C36CA3EA257CBAB8B18AF20FC1D2A6C7  （未动）
cordis.patch.yml     520 B  MD5 A2B855BF272C66CBE9B2C131AE30E491  （未动）
```

## 7. 未做 / 不确定

- **未提交**（红线 2）。信号文件里的「提交 SHA」只能写「未提交」。
- 未在真实桌面宿主上重启验证；测试是真实临时目录 + 真实文件字节 + 真 `fs.watch`（部分用例用 `capturingWatch` 桩驱动回调），没覆盖宿主热重载进程。
- `dedupe.json` 仍无剪枝（v1 记账第 1 条未处理，本卡未要求）；条目随投递件线性增长。
- 每件投递多一次整文件读算 sha256：只在「表里已有该路径记录」时才读（判重路径），首次投递的读发生在记快照时。对 `.done` 通知这类小件可忽略；大文件会多一次全量读，未做流式哈希。
- v1 遗留的无 `contentHash` 条目按 size/mtime 兼容，等下一次投递才会升级成带摘要。
- **不确定（表述层面）**：TC1 卡面写「源文件仍在的二次投」，但投递成功后文件必被微任务搬走，"仍在"只能用「同名同字节重新写回原路径」构造；被测语义（同内容 ⇒ 不投）一致，但这一表述与字面的贴合度我不打包票。

<!-- DONE -->
