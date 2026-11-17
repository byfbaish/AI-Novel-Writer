# 待主人执行的配置修正清单（relay watch 绑定）

- 拟定：项目总负责人 · AI writer项目组（session 64419d69）
- 时间：2026-11-16 10:18 (+08:00)
- 性质：**三行改动，只有主人能改**；Bot 一行不碰。
- 取证方：QA（只读核对）、developer（代码级 + 行号独立复核）、workbuddy联络人（自证现行 id）

## 一、目标文件

`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`

**改前先备份**（同目录，带时间戳）：

```
copy cordis.patch.yml cordis.patch.yml.bak-20261116-1018
```

## 二、要改的三行（按「含目标 id 的行」定位，不按行号）

| 位置 | watch 目录 | 现值 | 改成 | 依据 |
|---|---|---|---|---|
| `:294` | `wakeup-inbox\workbuddy` | `targetSessionId: session-d17681e6-d7d6-4488-8649-2ad6bcc46a33` | `session-4f18b03f-94e3-4f01-ab37-23e0f592ca50` | workbuddy联络人 10:15 自证：`DSH_SESSION_ID` 直读 + `state.json` `rooms["AI writer项目组"].sessions` 两源一致 |
| `:304` | `signals\workbuddy` | 同上（同一个旧 id） | 同上 | 同上 |
| `:319` | `to-group` | `targetSessionId: session-aa5256c5-40d7-48a2-b3e0-12359c3b1433` | `session-66023777-5404-45e2-9561-eb5a152058ae` | 大肥鱼 报 + 负责人独立读 `state.json` 复核，`rooms` 第一项即 `66023777` |

其余全部不动：另五条 watch 的 id（`:299`/`:309` → `27a1c2ae`、`:314` → `0103a0ac`）、`exact`、`done.text`、`stableMs: 5000`。

## 三、不改会怎样

- `index.js:1529` 只有同时写 `targetTitle` 才走标题目标；纯 id 形态走 `:1242`–`:1252` 只 `findAgentById`，**无标题 fallback**，id 失效即 `:1250` `agent-not-found`，静默不投。
- 故 `:294`/`:304` 断的是 **WorkBuddy 信号回流唤醒联络人的唯一入口**：A 类卡信号会全部静默丢失（定时任务不受影响，它绑的已是 `4f18b03f`）。
- `:319` 断的是群内转投，影响面小于前者。

## 四、改完的验收（改完告诉群里，由 developer 只读复跑、QA 首验）

1. developer 只读复跑 `resolveNow` 并对 `watches[]` 逐条打 resolved/delivered 留痕；
2. `to-group` 不再出现 `aa5256c5`；
3. workbuddy 两条 watch 解析结果 = `4f18b03f`；
4. 上面四项交 QA 首验，判词绑本次配置文件的哈希（改后现场 `md5sum`）。

## 五、附带（不属配置改动）

- 名册 `roster/identity-roster.v3.2.md` 已过期：`6441a6cb`（大肥鱼）、`d17681e6`（workbuddy联络人）均非现行。建议由大肥鱼另存 `v3.3`，旧 id 处标「已轮换·非现行」，不原地改。
