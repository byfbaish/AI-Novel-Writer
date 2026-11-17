# 删除源结论：`electron/` 是被测试自己删的，删了 6 轮基线的元凶

- 时间：2026-11-12 13:12
- 环境：一次性检出 `C:\develop\workspace\AI-writer\r3-probe`（`git worktree add ../r3-probe --detach HEAD`，HEAD `13240ffd`，2535 文件），`node_modules` 为 junction 指向 develop，其余全部干净。
- 判据（`git ls-files electron/` / `git status --porcelain electron/` / 文件数）：

| 阶段 | tracked | `.ts` 文件 | porcelain |
|---|---|---|---|
| 跑前 | 455 | 448 | 0 |
| 跑后 | 455 | **0** | **455**（全是 ` D`） |

## 三步定位

1. **整文件跑**：`node scripts/run-tests-electron.mjs scripts/__tests__/quality-modernization-r3-native.test.mjs` → `Tests 17 failed | 21 passed (38)`，5.11s，`electron/` 归零。
2. **单测试跑**（`-t "saved first-review continuation"`）→ `1 failed | 37 skipped`，5.11s，`electron/` 同样归零 ⇒ 元凶就是这一个用例：`scripts/__tests__/quality-modernization-r3-native.test.mjs:604` 起的 `saved first-review continuation …`。
3. **A/B 对照**：把 :611 的 junction 列表从 `['src','electron','node_modules']` 改成 `['src','node_modules']`（只去掉 electron），跑前 `git checkout -- electron` 恢复 →
   - `Tests 1 failed | 37 passed (38)`，**`448 .ts` / `porcelain=0`，electron 完好**
   - 同一批用例从「17 红」变成「1 红」：另外 16 条红是 electron 被删后的连带污染。

## 机制

`scripts/__tests__/quality-modernization-r3-native.test.mjs:611`
```js
for (const name of ['src', 'electron', 'node_modules']) fs.symlinkSync(path.join(ROOT, name), path.join(adapter, name), 'junction')
```
目录建在 `ROOT/.runtime/.cache/novel-quality-modernization/saved-continuation-*`，junction 指向仓库根的**真实** `electron/`。用例末尾 `fs.rmSync(directory, { recursive: true, force: true })`（`quality-modernization-r3-native.test.mjs:870`）在 Windows 上顺着 junction 递归进真实目录，删的是仓库源码，不是链接本身。

同型第二处：`scripts/__tests__/quality-modernization-planning-resume.test.mjs:32`，junction 列表是 `['src','electron','node_modules','test']`——同样风险，尚未单独跑验证，但代码形态一致。

对照组：直接 `fs.rmSync` 一个只含 junction 的临时目录，Node 只 unlink 链接、目标完好（`target exists= true`），所以不是「Node rmSync 一律跟随」，是这个用例的目录结构 + 清理路径触发的。

## 残余

去掉 electron junction 后，该用例本身仍红，原因是老问题：
```
Error: EPERM, Permission denied: \\?\…\r3-probe\.runtime\.cache\novel-quality-modernization\saved-continuation-qoBYMg
```
Windows 句柄延迟，与 `quality-modernization-run.test.mjs:7206` 同族真实 flake，与删除源无关。

## 建议修法（待裁定，未动 develop）

- 最小修：:611 与 planning-resume:32 的 junction 列表里删掉 `'electron'`。实测去掉后 37/38 通过、electron 完好；没有用例读 `adapter/electron`。
- 更稳：清理改成先 `fs.unlinkSync` 掉 adapter 下的 junction、再 `fs.rmSync(directory)`，防止以后再加别的项又踩上。
- 修完才能跑 baseline-4：现在全量跑不完不是「跑得慢」，是跑到一半源码被这个用例删掉。
