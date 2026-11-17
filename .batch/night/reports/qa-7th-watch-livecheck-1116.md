执行方：QA
取数件：`C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered\7f7c38b2b656\selftest-7th-watch-1116.md` / 345B / MD5 `96dcdba1f0eda694e6825d6eb1146c99`
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连

# 出侧复核 · 第 7 条 watch（`to-plugin-group` → `c9ff5961`）真投验证

- 派单/批准：项目总负责人（只跑一次、只跑第 7 条；写件方 大肥鱼，QA 只做出侧复核，不写、不代写）
- 取数时刻：2026-11-16 13:19 CST 现读（配置与日志同一时刻取）
- 配置：`…\profiles\desktop\cordis.patch.yml`｜13,229B｜MD5 `2f4a89b7083bb072a3eefcad737e7c6a`｜mtime 13:09:30（内容与 12:36 版同 MD5，被重写但未改内容）；`:322`–`:327` 第 7 条 `to-plugin-group`，`:324` = `session-c9ff5961-2f11-4337-a885-3cf826db31b0`
- 启动基线：`relay.log:818` `2026-11-16T04:34:04.174Z 启动 7/7 个 watch；stableMs=5000`

## 判据逐条（三条，全 PASS）

1. **PASS｜注入身份行**：`relay.log:842` `2026-11-16T05:08:18.936Z INFO 注入身份 from=大肥鱼 · AI writer项目组 | 03205043 to=c9ff5961|大肥鱼 · DSH 插件组|群分身`
2. **PASS｜出侧记账**：`dedupe.json` 中 `7f7c38b2b656\…\selftest-7th-watch-1116.md` 条目 `at=2026-11-16T05:08:18.935Z`、`size=345`、`contentHash=911829c84cf0fcca…`、`targetSessionId=session-c9ff5961-…`——该记录由 `rememberDeliveredSnapshot()` 在注入成功后写入（源码 `index.js:1328-1331`），是「已投递」的出侧硬凭据。
3. **PASS｜delivered 落地 + 源目录搬空**：`delivered\7f7c38b2b656\selftest-7th-watch-1116.md`｜345B｜mtime 13:08:18｜MD5 `96dcdba1f0eda694e6825d6eb1146c99`；首两行 `From:` / `To:` 齐备、末行 `<!-- DONE -->` 为整份最后字节；源目录 `…\bridge\to-plugin-group` 只剩 `.gitkeep`。

## 一处必须记下的读日志陷阱（不影响结论）

同一毫秒 `relay.log:843` 还有一条 `去重跳过 target=7f7c38b2b656 file=selftest-7th-watch-1116.md digest=911829c84cf0 原因=重复(size,mtime 相同)`。它**不是**「没投」：`deliver()` 先去重判定（`index.js:1285-1287`），命中即 `skipDuplicate` 并 return；本次投递已在前一步完成注入并写记账，文件移入 `delivered\` 后再次触发 fs 事件，才命中去重表。因此判据应写成「**注入身份行 + 该条 dedupe 记账 + delivered 副本（+ 源目录搬空）**」，不能只看有无「去重跳过」，也不能拿 `rescan#N` 的 `result=resolved` 当投达凭据（那行只有目录级重扫才打）。

## 结论

**PASS**——第 7 条 watch 实投验证成立：目标可解析（`rescan#3`）、注入成功、出侧记账、副本落地、源目录搬空，五项一致。名册可记「§16 第 7 条 watch 真投验证：通」，依据引本件与 `relay.log:842`。不回滚、不重配、不追第二轮。
