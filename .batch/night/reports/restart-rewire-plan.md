# 重启后 watch 重新接线清单（developer 自查用）

配置：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`（第 289–308 行，`- id: dsh-handoff-relay`）
重启后 session id 会变，7 条 watch 的 `targetSessionId` 必须全部重填。

## 角色 ↔ 目录（id 待重填）

| # | dir | 角色 | 现 targetSessionId（重启后作废） |
|---|---|---|---|
| 1 | `…\develop\scripts\dsh\wakeup-inbox` | AI writer总负责人 | daeb834f… |
| 2 | `…\wakeup-inbox\workbuddy` | workbuddy联络人 | 33494f59… |
| 3 | `…\wakeup-inbox\doubao` | 豆包联络人 | 4380d607… |
| 4 | `…\.batch\night\signals\workbuddy` | workbuddy联络人（交付信号） | 33494f59… |
| 5 | `…\.batch\night\signals\doubao` | 豆包联络人（交付信号） | 4380d607… |
| 6 | `…\.batch\night\bridge\to-owner` | 大肥鱼 私聊窗口 | a1d48adb… |
| 7 | `…\.batch\night\bridge\to-group` | 大肥鱼 群窗口 | f6f51eef… |

注：#2/#4 同属一人、#3/#5 同属一人，但仍要各写一条（一目录一条 watch，不做多播）。

## 取新 id 的方法

1. 重启后让成员在群里各说一句（或本群任意活动），使各自会话落盘。
2. 按 mtime 排 `C:\Users\<用户名>\.dsh\sessions\*\session.v4.jsonl.zstd`，最新几个即本轮活跃会话。
3. 对照群成员发言顺序区分；不确定时用「发一条→看哪个文件被写」逐条确认，不猜。

## 改完后必查

- 首三字节 `23 20 59`（UTF-8 无 BOM）、`- dir:` 计数 = 7
- 备份：`cordis.patch.yml.bak-rewire`
- 插件无落盘日志可自证（apply 只打 stdout「已启动 N/N 个 watch」），**唯一判据是一次真实投递**：
  - 放一个探针到 `bridge\to-owner` 与 `bridge\to-group`，确认两边窗口都被写、且文案带**绝对路径**（即 P6 的 `{path}`，本次重启的核心收益）
  - 投完删探针，两个 bridge 目录只留 `.gitkeep`

## 附带确认（本次重启的新增收益）

- 通知文案应从 `文件 <名> 已就绪` 变为 `文件 <绝对路径> 已就绪（触发=…）`
- 若重启后仍是旧文案 → 说明 profile 的 junction 没指向新代码或进程没真正重启，立即查而不重试
