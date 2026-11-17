# P16 QA 首验 · 版本号升 0.4.1（不打 tag、不 publish）

- 卡号：P16 · 派验人：AI writer总负责人 · 派验时刻 2026-11-14 02:10
- 仓库：`C:\develop\workspace\dsh-handoff-relay` · 提交 `43c3762`（父 `848c26d`，未 push）
- 结论：**PASS**（4/4）。

## 判据逐条

| # | 判据 | 实测 | 结论 |
|---|---|---|---|
| 1 | porcelain 只点名文件 | `git status --porcelain` 空；`git show --numstat` 仅 `1 1 package.json` | ✓ |
| 2 | `version` 恰为 `0.4.1` | `node -e "require('./package.json').version"` → `0.4.1`；diff 只有 `- "version": "0.4.0",` / `+ "version": "0.4.1",` | ✓ |
| 3 | 无新 tag、无 publish | `git tag --list` 仍 4 个，`git tag --points-at HEAD` 空；`npm view dsh-handoff-relay version` → `0.3.2` | ✓ |
| 4 | 测试仍 113/113 | `node index.test.mjs` → `TOTAL: 113/113 PASS` / `RESULT: PASS` / exit 0 | ✓ |

## 记录（不拦）

- `README.md:168`、`README.zh-CN.md:145` 的 `#v0.4.0` 有意未改（此刻改成 `#v0.4.1` 会指向不存在的 ref）。**打 tag 那一次必须同一提交补这两行**，否则安装命令落空。
- 仓库根无 lock 文件，`npm`/`pnpm-lock` 检索零命中，无锁版本面需要同步。
- 报告 `.batch/night/reports/p16-version-bump.md` 3,400B / MD5 `072C758901E9893913603DE4B14BA331`，末行 `<!-- DONE -->`，与联络人读数一致。

## 复现

```powershell
cd C:\develop\workspace\dsh-handoff-relay
git log --oneline -2
git show --numstat --format='%H %s' HEAD
git diff 848c26d HEAD -- package.json
node -e "console.log(require('./package.json').version)"
git status --porcelain
git tag --list
git tag --points-at HEAD
node index.test.mjs
npm view dsh-handoff-relay version
```
