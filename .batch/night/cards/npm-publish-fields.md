# 卡：补齐 npm 发布字段（package.json）

## 背景

仓库 `C:\develop\workspace\dsh-handoff-relay`（已发布 GitHub，HEAD 在 `master`，tag `v0.3.0`）。本插件即将发布到 npm（包名 `dsh-handoff-relay`，npm 上确认未被占用；本机已登录 npm，`npm whoami` = `byfbaish`）。

现在 `package.json` 缺 5 个字段，不补会有两个实际后果：`npm pack` 会把 `index.test.mjs`、`.gitignore` 一起打进 tarball；插件市场缺少仓库/关键词/作者信息。

## 要做的事（只改 `package.json`）

1. 增加 `files`，白名单只放这 5 项：
   ```json
   "files": ["index.js", "cordis.patch.yml", "README.md", "README.zh-CN.md", "LICENSE"]
   ```
2. 增加：
   ```json
   "repository": { "type": "git", "url": "git+https://github.com/byfbaish/dsh-handoff-relay.git" },
   "homepage": "https://github.com/byfbaish/dsh-handoff-relay#readme",
   "author": "byfbaish",
   "keywords": ["dsh", "deepseek-harness", "plugin", "file-watch", "session", "notify", "handoff"]
   ```
3. 其余字段一律不动：`name`、`version`（保持 `0.3.0`）、`description`、`type`、`main`、`exports`、`engines`、`dsh.bundle.patch`、`license`、`scripts.test`。
4. 自检并贴原始输出：
   - `npm pack --dry-run` → 打出的包内容应只有 5 个文件（外加 npm 自动附带的 `package.json`），不得出现 `index.test.mjs`、`.gitignore`、`node_modules`
   - `node index.test.mjs` → 仍应 `TOTAL: 49/49 PASS`
   - `npx --no-install npm-package-json-lint package.json`（有就贴，没有就跳过，不要为此装依赖）
5. 提交：**点名** `git add package.json`，**不许** `git add -A` / `git add .`；commit message 自拟（英文，`chore:` 开头）。不要 push。

## 禁忌

- **不许碰 `README.md` / `README.zh-CN.md`**——另一个人正在改安装段，碰了会冲突。
- 不许改 `index.js`、`index.test.mjs`、`cordis.patch.yml`。
- 不许 `git push`、不许 `npm publish`、不许重启 DSH、不许往 `scripts\dsh\wakeup-inbox` 丢文件。
- 不许因为 `npm pack` 报警就去改 `version`。

## 产物

`.batch/night/reports/npm-fields.md`，末尾 `<!-- DONE -->`：
- 改动前后的 `package.json` diff（`git show --stat` + 关键片段）
- `npm pack --dry-run` 原始输出（文件清单那几行）
- `node index.test.mjs` 的 TOTAL 行
- 本地 commit sha

## 判定线

1. `npm pack --dry-run` 的文件清单恰好只含白名单里的 5 个文件 + `package.json`。
2. 49/49 测试仍 PASS。
3. 除新增 5 个字段外，`package.json` 无其他改动（diff 可证）。
4. `README*` 未被本卡改动。
