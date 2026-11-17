# P31 · 投递层物理去重（拦在唤醒模型之前）

执行：豆包（自动档）
仓库：`C:\develop\workspace\dsh-handoff-relay`
起点（投前现取）：`6f655500c88b`
终版：`801dc38b84f3`

## 1. 改动

只动 `index.js` 与 `index.test.mjs`；`client.js`、`package.json` 未动。

按卡面顺序 ①→②→④→③ 实现：

### ① 持久化 delivered

- 新增 `dedupe.json`（与 `failed.json`、`relay.log` 同目录，即 `<profile>/dsh-handoff-relay/`）。
- 结构：

```json
{
  "<dirKey>": {
    "<absPath>": { "size": 12, "mtimeMs": 179...000, "at": "2026-11-14T01:...Z" }
  }
}
```

- 每个 profile 的 `stateDir` 只读一次，模块级 `dedupeRegistry` 缓存。
- 写入 `persistDedupeRegistry()`：`写 <pid>.<uuid>.tmp` → `fs.renameSync(tmp, dedupe.json)`；任一步失败只 `log(warn)`，不抛出、不阻断投递。
- 成功 `followup` 后调用 `rememberDeliveredSnapshot()` 记一条快照。

### ② 启动只捞新文件

- `isStartupNew()` 的基准是 `lastDeliveredAtMs(bucket)`，即该 dir 所有条目 `at` 的最大值；**不是** `Date.now()` / 启动时刻。
- `mtimeMs > lastDeliveredAt` ⇒ 新，照常进入投递流程；否则记 `relay.log` info 并跳过。
- 该 dir 在表里无记录 ⇒ 全部视为新；每个 watch 首次遇到时记一条 `去重表无 <dir> 记录，首次运行全部视为新`。
- 启动首扫、首个事件触发的全量重扫、P11 最多 3 次重扫都传 `startup=true`，走同一判据；启动判旧的 `relName|sig` 记入 `startupOld`，同快照后续事件不重投。

### ④ 跳过留痕

命中判重时写 `relay.log`：

```text
[dsh-handoff-relay] 去重跳过 <dir> <文件名> 原因=重复(size,mtime 相同)
```

启动判旧另写：

```text
[dsh-handoff-relay] 去重跳过 <dir> <文件名> 原因=启动前旧文件(mtime<=lastDeliveredAt)
```

### ③ 最小间隔

- 同一 dir、同一绝对路径，`size` 与 `mtimeMs` 都相同，且距落盘 `at` 在 `DEDUPE_WINDOW_MS = 30000` 内 ⇒ 判重跳过。
- 不做全局节流、不按内容哈希；`mtime/size` 变了或窗口外，不在判重范围。

### 保留

- 解析不到目标时「留原地、不标记」逻辑未动。
- 标题优先 / id 兜底顺序未动。
- 1s / 5s / 15s 重试节奏未动。
- `failed.json` 优先于判重：已失败件仍按原路径 warn「跳过已失败件」。

## 2. 测试

### 2.1 全量

```text
$ node index.test.mjs
PASS  P31 a 同 size/mtime 再放同一文件 → 不重复投递，relay.log 有去重跳过
PASS  P31 b 重新加载后落盘表仍挡住同快照 → 不投递
PASS  P31 c 表里没有该 dir → 首次运行全部视为新，启动照投
PASS  P31 d 停机期间写入且 mtime > lastDeliveredAt → 启动后仍投
PASS  P31 e size/mtime 变了 → 不判重，照常投递
PASS  P31 f dedupe.json 写失败 → 只 warn，投递照常
TOTAL: 144/144 PASS
RESULT: PASS
```

exit 0；138/138 → 144/144（新增 6 条，含卡面必做 a–e 与 C2 的写失败 f）。

### 2.2 用例说明

- **a**：同一文件投一次后，按原 `size` + 整秒 `mtime` 再放一次；断言 `calls` 不增、日志含去重跳过。
- **b**：首次投递后同快照重放，然后 `dispose` + `await import('./index.js?p31reload=…')` 取**全新的模块实例**（内存表为空），再对同 dir `apply`；断言不投。这样验证的是 `dedupe.json` 落盘表，而不是模块内缓存的 Map/Set。
- **c**：全新 dir 无表记录，启动扫描照投，日志含「首次运行全部视为新」。
- **d**：先投一个文件形成 `lastDeliveredAt`，停机后再放一个 `mtime > 该时刻` 的文件；重启 `apply` 后仍投。
- **e**：同路径但 `size` / `mtime` 变了，不在判重范围，照投。
- **f**：临时把 `fs.renameSync` 改成抛 `EACCES`，投递仍成功（`calls=1`），warnings 含「写 dedupe.json 失败」。

## 3. 反证

临时副本把判重与记录退回**纯内存 Set**（`rememberDeliveredSnapshot` 只 `Set.add`，`isDuplicateSnapshot` 只查 Set），其余不动：

```text
FAIL  P31 b 重新加载后落盘表仍挡住同快照 → 不投递 :: 重载后不应再投，实际 2
FAIL  P31 f dedupe.json 写失败 → 只 warn，投递照常 :: 缺「写 dedupe.json 失败」warn
TOTAL: 142/144 PASS
RESULT: FAIL
```

- **b 红**：新模块实例的 Set 为空，同快照被再次投递（`calls=2`）——正是「内存表重载即清空」的故障形态。
- f 也红：反证版根本没有落盘写入，自然没有写失败 warn；这是反证版缺能力，不是主实现失败。

## 4. 判据核对

- C1：`git show --numstat HEAD` 只有 `index.js` 135/10、`index.test.mjs` 169/0；`client.js` blob 与起点相同（`3248f499a43d1051542bbbe2cdf5fcc1da52f906`）；`package.json` blob 未变（`1b04240d94d3b8fe97094cb06224d1717a2eb20b`）。
- C2：`persistDedupeRegistry` 为 tmp + rename，`try/catch` 内 `log(warn)`；f 实测写失败仍投递。
- C3：`isStartupNew` 读 `lastDeliveredAtMs(bucket)`（该 dir 所有条目 `at` 最大值），代码中无「启动时刻」参与判断。
- C4：a–e 真跑；反证 b 真红。
- C5：无新增依赖；`client.js`、`package.json` 未改。

## 5. 提交与工作区

```text
$ git log --oneline -3
801dc38 fix: persist delivered snapshots for physical dedupe
6f65550 feat: limit session picker to ten rows with expand and scroll
beb0af2 fix: inject sessions service for settings session picker

$ git show --numstat --format= HEAD
135     10      index.js
169     0       index.test.mjs

$ git status --porcelain
(空)

$ git rev-parse --short=12 HEAD
801dc38b84f3
```

`git add` 点名 `index.js`、`index.test.mjs`，未用 `-A`；未 tag、未 push、未 publish。

## 6. 文件读数

```text
index.js        57,749 B  MD5 54816FF7348EC01546F6ADAF134197DC
index.test.mjs 140,886 B  MD5 844D3FBF825AC355AD86E8D194A0C249
client.js       22,146 B  MD5 C2F0C0E5690D07414574098B0DE9497D（未动）
package.json     1,085 B  MD5 C36CA3EA257CBAB8B18AF20FC1D2A6C7（未动）
```

## 7. 未做 / 不确定

- 未在真实桌面宿主上重启验证；测试用真实临时目录 + 真实 fs.watch，但未覆盖宿主热重载进程。
- 用例 e 走的是「size/mtime 变了」分支，未真的等 30 秒验证「窗口外同快照」；30 秒窗口逻辑在 `isDuplicateSnapshot` 中实现，未做真实时钟跨越测试。
- `dedupe.json` 无容量上限（卡面未要求）；长期运行会随投递文件增长，是否需要按 7 天/条数裁剪未定。

<!-- DONE -->
