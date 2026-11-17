# P6 终审（会话寻址 + 通知带路径）

- 判定：**PASS**
- 提交：`ed6ca81`（"feat: 会话寻址支持 targetTitle 包含匹配，通知带文件绝对路径"）
- 依据：QA 首验（2026-11-13 06:35 前后），我不重复复验。

## 判据与证据（均引自 QA）

1. 包含匹配生效：`title.includes(targetTitle)`，「简报 → 周简报」实测投递 1 条（P6-C）。
2. 命中 0 / >1 不投递且告警：0 条时含 watch 名、`targetTitle`、命中数、dir；2 条时列出候选与标题。
3. 无 `cwd` 兜底：全文无 `process.cwd()`，告警文案明写「不按 cwd 兜底」。
4. `{path}` 占位符带绝对路径（`path.isAbsolute` 断言通过），`{file}` 保留、自定义模板行为未变。
5. `TOTAL: 56/56 PASS`、exit 0；基线 49，只加不删（`index.test.mjs` 删除行 0）。
6. `source:` 行逐字相同（行号 :150 → :198），用例断言 `source.kind = plugin:dsh-handoff-relay`。

## 只记录、不拦截（转二期 backlog）

- `targetSessionId` 分支未 `trim`（title 分支已 trim），带空格的 id 会静默解析失败。
- `deliver` 先记 `delivered` 再解析，解析不到的文件不会重试（旧行为，非本卡引入）。

## 发布口径

- npm `0.3.1` 的 tarball 内容等于 `ed6ca81`，但 GitHub tag `v0.3.1` 指向 `0ec84d0` ⇒ 补 `v0.3.2` 指向 `ed6ca81` 并发布，`0.3.1` 保留但 `deprecate`。
- 新增发版硬门（本次漏掉的）：`git rev-parse HEAD` 必须等于 `git rev-parse v<版本>^{commit}`，且 `porcelain` 必须为空。
