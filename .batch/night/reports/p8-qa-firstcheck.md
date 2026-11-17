# P8 首验（QA）

> 状态：已裁定（2026-11-13 · QA 首验 PASS，附一条卡面口径冲突待总负责人修正）· 日期：2026-11-13

## 结论

**PASS** —— 四条判定线（移动 / 降级 / 清理 / 同目录去重）逐条落到代码与用例，提交范围与工作区干净，`source:` 行逐字未动。

同时**拦一条卡面缺陷**（不影响本次代码判定，影响下一次复用这张卡）：卡面「基线：一条都不许删」与「做什么 3：删除状态表的测试钩子」互斥，实际执行按后者。口径须由总负责人改。

## 复跑

```
TOTAL: 69/69 PASS
RESULT: PASS
EXIT=0
```

基线 `f33748e` = `TOTAL: 67/67`。净 +2 不是「新增 2 条」，而是 **+13 / −11**。

## 判定线逐条

### ① 投递后移走，保留原文件名，`.gitkeep` 不动 —— 过

- 落点 `index.js:99`：`path.join(deliveredDirFor(deliveredRoot, watchDir), path.basename(relName))`；`deliveredDirFor` = `deliveredRoot/dirKeyOf(watchDir)`，dirKey = 规范化路径 sha1 前 12 位（win32 先小写）。
- 移动 `index.js:104` `fs.renameSync(full, target)`；仅 `EXDEV` 才 `copyFileSync + rmSync`。
- 时机 `index.js:362`：`queueMicrotask(() => takeDelivered(...))`，同步投递路径不受影响。
- `.gitkeep`：`index.js:388` 在 `consider()` 入口直接 return，启动扫描同样走这条。
- 用例：`index.test.mjs:1129`（delivered 下同名 + 按 dirKey 分桶）、`:1136`（移走后重扫不再投）、`:1145`（重载不重放）、`:1160`（停机存量启动补发一次）、`:1165`（补发的同样被移走）、`:1285`/`:1291`（.gitkeep 不投不移动）。

### ② 移动失败只 warn，投递照常 —— 过

- `index.js:110` warn 文案含「移动已投递文件失败（投递已完成，不重试）」，返回 null，不动 `delivered` 集合、不回滚投递。
- 用例 `index.test.mjs:1186`：先打桩 `fs.renameSync` 抛 `EACCES`，`await sleep(100)` 等微任务跑完后断言 ①`calls.length === 1` ②warn 命中 ③文件仍在原处。断言在等待之后，非空转。

### ③ 清理只动 `delivered/`（>1000 删最旧 / >7 天删）—— 过

- `index.js:82` 先按 `mtimeMs < cutoff` 删过期；再按 mtime 升序删到 1000。只 `walk(deliveredRoot)`，不碰 watch 目录；整体 try 包住，失败只 warn。
- 常量 `MAX_DELIVERED_FILES=1000`、`MAX_DELIVERED_AGE_MS=7*24*60*60*1000` 写死，未进 schema。
- 用例 `index.test.mjs:1215`（1000 种子 + 1 新投 → 总量回 1000，seed-0 删、seed-999 留、本次件留）、`:1243`（utimes 置 8 天前 → 删除）。

### ④ 同目录两条 watch 只留第一条并 warn —— 过

- `index.js:457` `seenDirs`（按 dirKey），命中即 `跳过 watches[i]：一个目录只支持一个目标，多播需走发布订阅模式，本期不支持`。
- 用例 `index.test.mjs:1266`：第一条收 1、第二条收 0，warn 同时含「跳过 watches[1]」「一个目录只支持一个目标」「多播需走发布订阅模式」。

## 附加核验

| 项 | 结果 |
|---|---|
| `git status --porcelain`（落盘后） | 空 |
| 提交范围 `6563d27` | 只 `index.js` + `index.test.mjs` |
| `TOTAL:` 行 / exit code 原文 | 见上，69/69 + exit 0 |
| `source:` 行（`index.js:296`） | 与 `f33748e` 逐字相同，diff 无该 hunk |
| 状态表残留 | `index.js` 中 `STATE_/fingerprint/isDelivered/stateFile` 0 命中；`index.test.mjs` 中 `DSH_RELAY_STATE_FILE` 0 命中 |
| 加载日志 | 新增 `delivered=<dirKey 路径>`（`index.js:420` 附近），用例 `:1307` |

## 卡面冲突（拦）

- 卡面第 6 行「现有测试 67/67（**一条都不许删**）」与「做什么 3：删除 `8514269` 引入的落盘表与 `DSH_RELAY_STATE_FILE` 相关的测试钩子」互斥。
- 实际删除的 11 条用例**全部**是 P7 状态表用例，无一条非状态表用例被删：
  `P7 首次投递成功并落盘`、`P7 重载后同一文件同一目标不再投递`、`P7 指纹随 mtime/size 变化`、`P7 同指纹新目标可投`、`P7 裁剪 500 个指纹`、`P7 损坏容错`、`P7 写失败降级`、`P7 未投不记`、`P7 原子写`、`P7 状态文件不在 watch 目录内`、`P7 加载日志：状态文件路径 + 条目数`。
- 建议改法（下一张卡复用）：把基线条款写成「**除被退役机制自身用例外的用例一条不许删**，删了哪些须在报告里逐名列指」，并把总负责人的验收语从「多出的 2 条必须是新增」改成「净增 ≥2，且新增用例覆盖判定线列出的 N 类，删除用例须全部属于被退役机制」。

## 记（不拦，成本内可接受）

1. **子目录同名互覆**：`index.js:99` 用 `path.basename(relName)`，递归 watch 下 `a/x.txt` 与 `b/x.txt` 会落到同一 delivered 目标，`index.js:102` 先 `rmSync(target, force)` 再 rename → 后到的覆盖先到的存档（投递本身不丢）。
2. **过期判定用文件 mtime 而非投递时刻**：`index.js:82` 直接读 delivered 文件 mtime，而 rename 保留原 mtime。停机很久后补投的老文件会在投递完成后被立刻当「>7 天」删掉，存档不保。若要留档，应改用 `birthtimeMs` 或在 takeDelivered 后 `utimesSync` 刷新。

<!-- DONE -->
