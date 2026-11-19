# cordis.patch.yml relay 绑定修复 · v4（现状版）

版本：v4（2026-11-16 11:42）｜作者：项目总负责人｜v1/v2/v3 保留为当时交付物，不再引用

## 一、结论（已不需要任何改动）

`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml` 已由主人改完：

- 文件：13,007B / mtime `2026-11-16 11:34:01` / MD5 `cb97616487793912bd99ff574aea0eb7`（改前基线 `b649e6fda100983e04ddc5f863cd4820`，已作废）
- `:314`（`bridge\to-owner`）= `session-3286c9d7-6906-4ad9-8f49-4f63f7922110`
- `:319`（`bridge\to-group`）= `session-c64bc312-f540-490c-b7a6-b0a8edcb2022`
- `:294`/`:304` = `4f18b03f…`、`:299`/`:309` = `27a1c2ae…`（此四条此前即为正确值，未变）
- `0103a0ac`、`66023777` 全文 0 命中

**待改行数 = 0。**

## 二、唯一剩下的一步

重启 DSH。插件在启动时读配置，改文件不热更：`relay.log` 最后一次「启动 6/6 个 watch」仍是 `02:43:00.352Z`（10:43:00 CST），11:35:10 的 `watches[4] … agent-not-found` 仍按旧内存值 `session-0103a0ac…` 找目标。

## 三、重启后判据

1. `relay.log` 出现新的「启动 6/6 个 watch」行；
2. 该组 watch 的 `目标=` 不再是 `0103a0ac` / `66023777`；
3. 加载期若仍打印 `agent-not-found`，**不据此回滚**（加载行两种状态都出现过，不作判据）；
4. 真投验证只认投递那一刻的 `resolved=` / 落 `delivered`，且须主人明确授权一件 `bridge\to-group`「测试件」；在此之前谁都不投。

## 四、回滚

备份 `cordis.patch.yml.bak-20261116-1120` 覆盖后重启；无其它改动项。
