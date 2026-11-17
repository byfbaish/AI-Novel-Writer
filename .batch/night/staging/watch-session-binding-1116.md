# watch → session → Bot 归属清单（已按主人/大肥鱼更正为 6/6 正确）

取证时间：2026-11-16 12:39–12:45（Asia/Shanghai）
取证方式：读 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml:286–315` 取 watch 与 `targetSessionId`；到 `C:\Users\<用户名>\.dsh\sessions\<workspace>\<session>\session.v4.jsonl.zstd` 逐帧解 zstd（magic `28 B5 2F FD`，`zlib.zstdDecompressSync`）取 `"title"` 与 `session.cwd`。
未改任何配置，未重启宿主。

## 结论

**6 条 watch 全部正确，无需改绑。**
`to-owner` 绑 `a1d48adb`（主身）是明确例外，不是绑错——该口子的消费者就是主身，主人不在群里时唯一能走 IM 联系到他的是主身会话。

## 清单

| # | watch 目录 | targetSessionId | 会话标题 | cwd | 身份 | 判定 |
|---|---|---|---|---|---|---|
| 1 | `scripts\dsh\wakeup-inbox\workbuddy` | `session-7730f863-9bb6-4072-836a-c4dedc632cb2` | workbuddy联络人 · AI writer项目组 | `…\AI-writer\develop` | 群分身 | ✅ |
| 2 | `scripts\dsh\wakeup-inbox\doubao` | `session-c12ee7f6-6cf1-4c23-bdb7-9421627b2496` | 豆包联络人 · AI writer项目组 | `…\AI-writer\develop` | 群分身 | ✅ |
| 3 | `.batch\night\signals\workbuddy` | `session-7730f863-…` | 同上（与 #1 同一会话） | 同上 | 群分身 | ✅ |
| 4 | `.batch\night\signals\doubao` | `session-c12ee7f6-…` | 同上（与 #2 同一会话） | 同上 | 群分身 | ✅ |
| 5 | `.batch\night\bridge\to-owner` | `session-a1d48adb-037e-42b5-8436-c14aa468a9f1` | Chief \| 大肥鱼 | `C:\Users\<用户名>\.dsh\bot\workspace` | **主身（例外）** | ✅ |
| 6 | `.batch\night\bridge\to-group` | `session-74a01c9a-bc1b-4422-abf8-8932414987ba` | 大肥鱼 · AI writer项目组 | `C:\Users\<用户名>\.dsh\bot\workspace` | 群分身 | ✅ |

唯一 target 共 4 个（workbuddy 与 doubao 各被两个目录共用）。

## 存活

日志 mtime：`7730f863` 12:36:57、`c12ee7f6` 12:37:49、`a1d48adb` 11:44:04、`74a01c9a` 12:36:52 —— 均在写盘，四个会话都活着。

## 判定口径（供判据草案引用）

- 「角色＋群名后缀」（如 `大肥鱼 · AI writer项目组`）＝群分身，跨群/群内投递一律绑它。
- 判主身看两点：① 标题无 `· <群名>` 后缀；② cwd 为 `C:\Users\<用户名>\.dsh\bot\workspace`（Bot 主身根工作区）。
- **例外仅一条**：需要 IM 直达主人时绑主身（当前只有 `to-owner`）。除此之外不得绑主身。

<!-- DONE -->
