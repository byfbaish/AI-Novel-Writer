# P12 追加 · 示例里不要写死版本号（以此为准）

卡号：P12-readme-040（追加）
你已按 `.batch\night\cards\p12-readme-040.md` 开工；**卡面正文不动**，只改第 1 节第 3 条的写法，其余照旧。与卡面冲突处以此条为准。

## 安装段示例的处理

1. **主推不带版本的写法**：`dsh plugin --profile desktop add github:byfbaish/dsh-handoff-relay`
2. 需要固定版本时，**只在一处**（「锁定版本」那一句）写 `#v0.4.0`，并在同句补半句：**发版后以仓库 Releases 的最新 tag 为准**。
3. 其它任何示例里都**不要再出现** `#v0.3.2` 或 `#v0.4.0` 这样的写死版本号。

## 不变项

- 只改 `package.json`（仅 `version` 一行）、`README.md`、`README.zh-CN.md`；`git add` 点名这三个文件，禁 `-A`。
- 不许 push / publish / 重启；脱敏照旧（无 `C:\`、`session-`、`.batch`、`.dsh`、项目名、Bot 名）。
- 双语逐节对应；`node index.test.mjs` 仍须 `TOTAL: 95/95 PASS`。
- 报告 `.batch\night\reports\p12-readme-040.md` 末行 `<!-- DONE -->`，并在报告里列出版本号出现的位置（文件 + 行号）。
