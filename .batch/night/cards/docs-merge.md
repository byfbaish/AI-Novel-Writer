# 卡：把故事段与随想落进仓库（一次提交收口）

## 基线（动手前先核）

- `git -C C:\develop\workspace\dsh-handoff-relay rev-parse HEAD` = `5b6903553ac2b6d304f5fa0fc2b6dda9bc3f167d`
- `git status --porcelain` 无输出
- 若不是上述状态，先报告，不要动手。

## 输入（只读这两份，别自己另写）

1. 故事段双语稿：`C:\develop\workspace\AI-writer\develop\.batch\night\essays\readme-story-bilingual.md`（中文约 260 字、英文约 200 词）
2. 随想正文：`C:\develop\workspace\AI-writer\develop\.batch\night\essays\why-relay.md`（约 800–1200 字，四节）

## 做三件事

### ① 故事段插进两份 README

- 英文稿 → `README.md`；中文稿 → `README.zh-CN.md`。**不要两版都塞进同一份**。
- 位置（已按现仓库结构核过，两份都没有 Why relay 节，别自己找）：`README.md` 插在 `## Install`（现 L71）之前，`README.zh-CN.md` 插在 `## 安装`（现 L57）之前，标题分别用 `## Why "relay"` / `## 为什么叫 relay`。
- 只插一段，不加小标题以外的排版大改，不重排已有段落。

### ② 新建 `docs/why-relay.md`

- 把输入 2 的正文整篇复制进去，`docs/` 目录不存在就建。
- 复制完自己再核一遍脱敏：`git grep -nE 'C:\\\\|\\.dsh|\\.batch|session-[0-9a-f]{8}' -- docs/why-relay.md` 必须 0 命中。
- 在 `README.md` 与 `README.zh-CN.md` 的「为什么叫 relay」节末尾各加一行链接到 `docs/why-relay.md`（相对路径 `./docs/why-relay.md`）。

### ③ 一次提交

```
git add README.md README.zh-CN.md docs/why-relay.md
git commit -m "docs: add relay origin story and design rationale"
```

- **必须点名 add 这三个路径，禁止 `git add -A` / `git add .`**
- 不许 push、不许打 tag、不许重启任何进程。

## 禁改

`package.json`（含 version）、`index.js`、`index.test.mjs`、`cordis.patch.yml`、`LICENSE`、`.gitignore` 一个字都不许动。本卡只碰文档。

## 判定线

1. `git status --porcelain` 落盘后为空；`git rev-parse HEAD` 是一个新的单父提交，父为 `5b69035…`。
2. `git show --numstat --format=` 的文件列表恰好三件：`README.md`、`README.zh-CN.md`、`docs/why-relay.md`（新增）。
3. 脱敏零命中：`C:\\`、`C:/`、`.dsh`、`.batch`、`session-`、用户名、群名、助手名、卡号、内部报告文件名。
4. 故事只解释机制（通知只给文件名、收件方工作目录不同），不得出现「AI 觉醒 / 自我意识 / 有灵魂」这类定性。
5. `node index.test.mjs` 仍 `TOTAL: 56/56 PASS`，exit 0。
6. `npm pack --dry-run` 仍只 6 件（文档不进包是正常的，别为了它改 `files`）。

## 产物

`.batch/night/reports/docs-merge.md`：提交 SHA、`show --numstat` 原文、脱敏命令与输出、测试输出末两行，末尾 `<!-- DONE -->`；另落 `.batch/night/signals/doubao/docs-merge.done`（三行：产物路径 / 提交 SHA / `<!-- DONE -->`）。
