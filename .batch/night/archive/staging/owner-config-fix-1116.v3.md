# 待主人执行的配置修正清单（relay watch 绑定）· v3

- 拟定：项目总负责人 · AI writer项目组（session 51aa9018）
- 时间：2026-11-16 11:20 (+08:00)
- 性质：**只剩一行改动，只有主人能改**；Bot 一行不碰。
- 本版相对 v2 的变更：**要改的行由三行缩到一行**（`:294`/`:304` 主人已于 11:04 改好）；`:319` 的目标值由 `66023777` 改为 `c64bc312`（`66023777` 在 11:03 之后已轮换、不在 `rooms` 现值里）。v1/v2 保留为当时交付物，不得再引用。

## 一、目标文件与改前基线

`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`

改前基线（三方独立读一致：我 11:08、developer 11:11、QA 11:11、大肥鱼 11:09）：

- 大小 13,007B
- mtime `2026-11-16 11:04:00 +08:00`
- MD5 `b649e6fda100983e04ddc5f863cd4820`

**改前先备份**：

```
copy cordis.patch.yml cordis.patch.yml.bak-20261116-1120
```

## 二、要改的唯一一行

| 位置 | watch 目录 | 现值 | 改成 |
|---|---|---|---|
| `:319` | `bridge\to-group` | `targetSessionId: session-66023777-5404-45e2-9561-eb5a152058ae` | `targetSessionId: session-c64bc312-f540-490c-b7a6-b0a8edcb2022` |

其余一律不动：`:294`/`:304` 已是 `session-4f18b03f-94e3-4f01-ab37-23e0f592ca50`（主人 11:04 已改好，核对即可、不要重复改）；`:299`/`:309` = `27a1c2ae…`；`:314` = `0103a0ac…`；以及 `exact`、`done.text`、`stableMs: 5000`。

定位方式：按「`bridge\to-group` 这一条里的 `targetSessionId`」定位，不按行号（行号随文件编辑会漂移；`:319` 是当前读数）。

## 三、依据（只写已证事实）

`state.json`（`C:\Users\<用户名>\.dsh\bot\state.json`，11:03 现场读）的 `rooms["AI writer项目组"].sessions` 八项现值：`c64bc312`（大肥鱼）、`51aa9018`（项目总负责人）、`4f18b03f`（workbuddy联络人）、`27a1c2ae`（豆包联络人）、`2ae0758e`（QA）、`4e6e07bd`（产品经理）、`332cfc5a`（developer）、`55617061`（金牌编辑）。**`66023777` 不在其中**，故现值指向的是已轮换的旧会话。

`index.js:1529` 只有同时写 `targetTitle` 才走标题目标；纯 id 形态走 `:1242`–`:1252` 只 `findAgentById`、无标题 fallback ⇒ id 失效时该条 watch 静默不投（`agent-not-found`）。故 `to-group` 现在大概率投不出去。

## 四、改完必须重启

改配置不热更（`relay.log` 最后一条 10:43:15，配置 mtime 11:04:00，无重载日志；只有 watch 目录的 `fs.watch`）。**改完需重启 DSH 才生效。**

## 五、验收（改完告诉群里，由 developer 只读复跑、QA 首验）

1. 现场 `md5sum` 与改前基线 `b649e6fd…` **不同**，且 `:319` 出现 `c64bc312`；
2. 重启后 `relay.log` 出现新的「启动 6/6 个 watch」行；
3. `state.json` 的 `rooms` 里 `c64bc312` 仍在；
4. 以上三项只能说「配置与目标都在」。要出 `resolved=` / `delivered=` 必须真投一件，**待主人明确授权**：投一件 `bridge\to-group`、首行标「测试件」，只看 `delivered`。

**不要据加载期 `agent-not-found` 回滚**：加载行两种状态历史上都出现过（11-15 08:38 六条全 resolved，11-16 10:43 六条全 agent-not-found，含当时仍在写的会话），加载期解析不到只 warn、不阻断，真判只看投递时 `resolveNow`。

## 六、回滚

用备份覆盖后重启：

```
copy cordis.patch.yml.bak-20261116-1120 cordis.patch.yml
```
