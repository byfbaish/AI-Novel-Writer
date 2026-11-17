# P31 首验（QA）· 投递层物理去重（落盘 dedupe.json）

- 判定对象：`801dc38b84f3eb3bc8b73858e8bf1a92ff6f708b`（父 `6f65550`）
- 派验单：`.batch/night/review-requests/P31.md`（1,123B，09:04:05，已登记）；判据卡面 §六 C1–C5
- **结论：PASS 5/5**
- 判定时刻：2026-11-14 09:2x

## C1 改动面只含两个文件 —— PASS

```
$ git diff --numstat 6f65550 801dc38
135     10      index.js
169     0       index.test.mjs
$ git rev-parse 6f65550:client.js     801dc38:client.js
3248f499a43d1051542bbbe2cdf5fcc1da52f906  3248f499a43d1051542bbbe2cdf5fcc1da52f906
$ git rev-parse 6f65550:package.json   801dc38:package.json
1b04240d94d3b8fe97094cb06224d1717a2eb20b  1b04240d94d3b8fe97094cb06224d1717a2eb20b
$ git status --porcelain → (空)；git tag --points-at HEAD → 空（tag 仍 4 个）
```

## C2 原子写 + 失败不阻断投递 —— PASS

`index.js:247 persistDedupeRegistry`：写 `${file}.${pid}.${uuid}.tmp` → `fs.renameSync(tmp, reg.file)`；`catch` 里 `fs.rmSync(tmp, {force:true})` + `log(warn, '写 dedupe.json 失败（不影响本次投递）')`；调用点 `:1013` 在 `agent.followup()` 成功之后，异常被本函数吞掉，不冒泡到投递路径。

实测（用例 f，我在提交树上复跑通过）：把 `fs.renameSync` 打桩抛 `EACCES: dedupe write blocked` → `calls.length === 1`（投递照常）且 warnings 含「写 dedupe.json 失败」。注意该桩打的是 **rename 阶段**（临时文件已写成功），比「写文件就失败」更贴近真实最坏情形，仍不阻断。

`renameSync` 在 Windows 上对已存在目标用 MoveFileEx 替换语义，覆盖旧档成立。

## C3 「新文件」基准是 `lastDeliveredAt`，不是启动时刻 —— PASS（读代码确认）

- `index.js:301 isStartupNew`：`const last = lastDeliveredAtMs(bucket)`；`if (last === null || state.mtimeMs > last) return true;` 否则 `relayLog(info, '去重跳过 … 原因=启动前旧文件(mtime<=lastDeliveredAt)')` 并返回 false。
- `lastDeliveredAtMs`（`:276`）= 该 dir 桶内所有条目 `at`（投递时刻 ISO）的**最大值**，与本次启动时间无关。
- 表里无该 dir 桶：`bucket` 为 null ⇒ 走 `onFirstRun()` 记一条 `首次运行全部视为新` 并返回 true（不吞文件），且 `firstRunNoted` 保证每 watch 只记一次（`:1055`）。
- 判为旧的快照记进 `startupOld`（`:1060`），后续同 `relName|sig` 的事件在 `:1049` 直接返回，不会二次投递。

边界（写清以免误读）：用例 d 用的是 `mtime = now+60s` 的停机文件，这个构造在「按 lastDeliveredAt」和「按启动时刻」两种实现下都会通过 ⇒ **用例 d 不能单独证明 C3**；C3 的依据是上面这段代码本身（卡面也要求读代码、不接受文案声明）。

## C4 五条用例真跑；反证 b 真红 —— PASS

提交树（`git archive 801dc38 | tar -x`）跑：

```
PASS  P31 a 同 size/mtime 再放同一文件 → 不重复投递，relay.log 有去重跳过
PASS  P31 b 重新加载后落盘表仍挡住同快照 → 不投递
PASS  P31 c 表里没有该 dir → 首次运行全部视为新，启动照投
PASS  P31 d 停机期间写入且 mtime > lastDeliveredAt → 启动后仍投
PASS  P31 e size/mtime 变了 → 不判重，照常投递
PASS  P31 f dedupe.json 写失败 → 只 warn，投递照常
TOTAL: 144/144 PASS / RESULT: PASS / exit 0
```

反证（①退回内存 Set）独立复跑：`6f65550` 的 `index.js` + HEAD 的 `index.test.mjs`：

```
FAIL  P31 b 重新加载后落盘表仍挡住同快照 → 不投递 :: 重载后不应再投，实际 2
FAIL  P31 a … :: 缺去重日志
FAIL  P31 c … :: 缺首次运行日志
FAIL  P31 f … :: 写失败桩打到了 rename（旧代码无 dedupe 写）
TOTAL: 140/144 PASS / RESULT: FAIL / exit 1
```

**b 的失败信息 `实际 2` 正是「重载后仍投了一次」**，与卡面要求的红法一致；a/c/f 同红属预期（旧实现无该能力）。

## C5 无新依赖、禁动区未动 —— PASS

- `git diff 6f65550 801dc38 -- package.json` 0 行（无依赖/版本变动）。
- `cordis.patch.yml` 不在本次 diff 中（仓库里那份文件两版一致；在用 profile 的 yml 未碰，卡面禁动区）。
- `RETRY_DELAYS_MS = [1000, 5000, 15000]`（`:34`）未变；「解析不到留原地不丢」段（`resolveNow` 失败分支 + `relayLog(warn)` + `return`）与旧版逐字一致。
- 只用了 `node:fs`/`node:path`/`node:crypto`（`randomUUID` 原已引入）。

## 附注（不拦，交负责人排期）

1. **`dedupe.json` 无剪枝**：每次成功投递都追加一条且永不删除，`rememberDeliveredSnapshot` 每次都整表 `JSON.stringify` 同步落盘 ⇒ 条目随时间线性增长（`delivered/` 有 1000 条/7 天清理，去重表没有对应策略）。量级还小，但建议后续卡按 `at` 剪枝（与 `MAX_DELIVERED_AGE_MS` 同口径）。
2. **被判定重复的文件留在 watch 目录**：`skipDuplicate` 只跳过不动文件，用户会看到文件一直在原处（内容不变就不会再投）；重启后按「启动前旧文件」再跳过。无丢失风险，属设计后果，记录备查。
3. **`dedupe.json` 坏档会整表丢弃**（`:211` 起，warn 明示「会重新记录」）：此时该 dir 变成「无记录」⇒ 启动按首次运行处理，残留在 watch 目录的旧文件会被投一次。概率低（需坏档 + 有残留），记录备查。
4. 用例 d 的构造区分不了 C3 两种基准（见上），若以后要防回归，建议加一条「停机文件 mtime 早于启动时刻、但晚于 lastDeliveredAt」的用例。

## 判后交接

- PASS 5/5，交 AI writer总负责人 终审。
- 真机重复触发复现按派验单属「不在范围」（真机轮另做）。
