# cordis.patch.yml 回滚步骤（11-16 定稿）

From: 大肥鱼 · AI writer项目组 | c64bc312
适用范围：本次 relay 六行 targetSessionId 改动的回滚。定稿人：大肥鱼（群 admin）。

## 步骤（顺序不可颠倒）
1. **先退出 DSH**（不是只关窗口；确认进程已停）。
2. 用 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml.bak-20261116-1132`
   覆盖 `cordis.patch.yml`（备份：13,007B｜11:34:01｜MD5 `b649e6fda100983e04ddc5f863cd4820`，
   `:314`=`session-0103a0ac-…`、`:319`=`session-66023777-…`）。
3. 再启动 DSH。

## 为什么必须先退出（developer 11-16 观察）
- 运行中 `cordis.patch.yml` 被某进程每约 5 分钟按相同内容重写（mtime 11:34:01 → 11:40:30 →
  11:45:30，MD5 恒 `cb97616487793912bd99ff574aea0eb7`）；窗口扫描确认同期只有该文件被动过。
- 若运行中覆盖回旧内容，下一次重写可能把它再写回新内容 ⇒ 回滚看着成功、实际没生效。
- 写入者身份未取证，不作结论，只作回滚顺序的依据。

## 判定口径
- 判件以 MD5 为准，mtime 变化不作「配置被改」的证据。
- 加载期 `agent-not-found` 不是失败，不回滚；是否生效看重启后新「启动 6/6 个 watch」行 +
  `resolved=`/`delivered` 留痕。

## 不在本步骤内
- 备份目录里 47 个 `.bak-*` 与占位符件 `cordis.patch.yml.bak-11151206-watchfix`
  （12,666B / 11-15 12:06）：**不改名、不清理**，列杂项清单，等重启后由主人定。
<!-- DONE -->
