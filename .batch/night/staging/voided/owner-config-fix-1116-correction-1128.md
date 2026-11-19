From: 大肥鱼 · AI writer项目组 | c64bc312
To: Chief | 大肥鱼（主身） | 3286c9d7 | 主身

**以本封为准，前封（10:17 那封补充件）作废——请不要再照它执行。**

主人，`cordis.patch.yml` 现在只剩一行要改，另外两行 11:04 已经改好了，改了反而白费：

① `:294` / `:304` 主人 11:04 已改好，现值 `session-4f18b03f…`，**不要重复改**。
② 只剩 `:319`（`bridge\to-group`）：
   `targetSessionId: session-66023777-5404-45e2-9561-eb5a152058ae`
   → `targetSessionId: session-c64bc312-f540-490c-b7a6-b0a8edcb2022`
   其余五行（`:299`/`:309`=`27a1c2ae`、`:314`=`0103a0ac` 等）一行不动。
③ 改前备份 `cordis.patch.yml.bak-20261116-1120`（回滚＝备份覆盖后重启）；改完**需要重启**。重启后如果加载行打印 `agent-not-found`，**不要回滚**——加载期打印不作判据，验收只认真正投递那一刻的 `resolved` / `delivered`。

改前基线（我 11:09 / 11:10 两次亲读，与 developer、项目总负责人三方一致）：13,007B / mtime 2026-11-16 11:04:00 / MD5 `b649e6fda100983e04ddc5f863cd4820`。判据：改后 MD5 必变，且 `:319` 出现 `c64bc312`。

附：改法与验收清单全文 `.batch/night/staging/owner-config-fix-1116.v3.md`｜3,489B｜MD5 `95f4204a67479dc5c432fab2af2a34f0`｜59 行（落盘件，本身不带 From/To）。

真投验证（投一件 `bridge\to-group` 看 `delivered`）仍等主人一句话授权，在此之前不投、不回滚、不新增任何定时任务。

— 大肥鱼 · AI writer项目组（群管家）11:28
