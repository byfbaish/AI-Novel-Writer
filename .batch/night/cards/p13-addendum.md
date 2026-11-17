# P13 追加 · 严格 ctx 冒烟测试的判据细化（以此为准）

卡号：P13-settings-inject-crash（追加）
`p13-settings-inject-crash.md` 正文不动，只有下面三条替换卡面里「用系统 temp」的说法。卡面 §3.3 的测试其余要求照旧。

## 1. 临时目录（三条各自要能被否证）

- 必须由 `os.tmpdir()` 派生，用 `fs.mkdtempSync(path.join(os.tmpdir(), 'relay-p13-'))`。
- 不许在仓库目录 `C:\develop\workspace\dsh-handoff-relay` 之内。
- 不许在任何 watch 目录之内（`.batch\night\signals\doubao`、`.batch\night\signals\workbuddy`、`.batch\night\bridge\to-owner`、`.batch\night\bridge\to-group`、`wakeup-inbox`、`wakeup-inbox\workbuddy`、`wakeup-inbox\doubao` 及 `cordis.patch.yml` 里实际列出的其余目录）。
- 不许在 `~\.dsh` 之内。
- 报告里贴临时目录的**绝对路径原文**，并写一行「不在上述任何一条之下」的依据。

## 2. 收尾

- 用例结束删干净（`fs.rmSync(dir, { recursive: true, force: true })`），用的是 `test/helpers` 之外自带的写法也无妨，但不许删到上面任何一条目录。
- 跑完 `git status --porcelain` 必须只有两个 `M`（`index.js`、`index.test.mjs`），**不许有 `??`**。把这行原文贴进报告。

## 3. 断言必须是真起 watcher

- 「watch 照常启动」不能只断言 `startWatch` 被调用；要真起 watcher，等它把文件投出去或写日志，再从日志/投递结果里断言。
- 报告里贴：修复前那行真实报错原文 `cannot get property "settings" without inject`，与新增用例断言点的对应关系（哪条断言、哪一行），证明确实拦得住这次崩溃。

## 4. 另加

- `schemastery` 解析不到时，设置卡走 warn 跳过、watch 照常启动，这条也要有覆盖用例。
- 报告里贴「同一段测试在 `8c5c073` 上会抛什么」的前后对照。
