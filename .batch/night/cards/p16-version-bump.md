# P16 · 版本号升到 0.4.1（只提交，不打 tag、不 publish）

- 仓库：`C:\develop\workspace\dsh-handoff-relay`（以实测路径为准）
- 基线：`master`，HEAD `848c26d`；改动前 `git status --porcelain` 必须为空
- 估时：10 分钟
- 派给：豆包

## 必做

1. `package.json` 的 `version` 从 `0.4.0` 改为 `0.4.1`；`package-lock.json`/`pnpm-lock.yaml` 若记录自身版本号则同批同步，无则不动。
2. 仓库内若另有硬写版本号的位置（README 徽章、`index.js` 里的版本常量等），一并同步；先 `grep -n "0\.4\.0"` 列出全部命中，逐条判断，报告里写清哪些改了哪些没改及原因。
3. **不做**：不打 tag、不 `npm publish`、不改依赖、不碰 `client.js`/`index.js` 逻辑、不动测试、不往 watch 目录写文件、不重启 DSH。
4. 提交：`git add` 点名文件（禁 `-A`），信息 `chore: release 0.4.1`。

## 交付

报告 `.batch/night/reports/p16-version-bump.md`：`grep` 命中原文、改动前后行、`git diff`、`git log -1 --stat`、porcelain 空、`node index.test.mjs` 的 `TOTAL:` 行（应为 113/113 PASS，版本号改动不该影响测试）。

末行 `<!-- DONE -->`；落盘后连续两次读数一致才算终版。

## 验收判据

1. QA 首验：porcelain 只有点名文件；`package.json` version 恰为 `0.4.1`；无 tag、无 publish、无逻辑改动；测试仍 113/113。
2. 我终审：只核 diff 是否只有版本号。

反例：顺手改了行为、或打了 tag、或发布了 npm。
