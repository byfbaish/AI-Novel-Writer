# Bot 身份名册（v2）

- 用途：handoff-usage-criteria v7 §3.1 / H7-A1 的判定输入。名册不是权限表，只作「From 里的角色名与 8 位 id 是否对得上」的核对依据。
- 生成人：大肥鱼（项目管家）｜生成时刻：2026-11-15T16:15+08:00｜依据：`C:\Users\<用户名>\.dsh\bot\state.json` 的 `rooms["session-4f78136d-…"].sessions` 主身→群分身映射 ＋ `C:\Users\<用户名>\.dsh\sessions\--C-develop-workspace-AI-writer-develop--\session-<8位>\` 实体目录（尺寸与 mtime 为 16:14 实测）。
- 取代：`identity-roster.md`（v1，43 行 / `913687D555956E57CAEE8D0749296946`）自本版生效起转历史件，不再作判定输入。

## 一、在群（8）

| 角色 | 群内称谓 | 主身 session | 群分身 session（前 8 位） | 分身目录实测 | 状态 |
|---|---|---|---|---|---|
| 大肥鱼（项目管家） | 大肥鱼 · AI writer项目组 | a1d48adb | 74a01c9a | 4,279KB / 16:14:36 | 已确证（本人即此分身） |
| AI writer总负责人 | AI writer总负责人 · AI writer项目组 | 69c32e8e | **08b720e9** | 271KB / 16:14:32 | 已确证（现行 part，rooms 映射） |
| workbuddy联络人 | workbuddy联络人 · AI writer项目组 | 7e88a033 | 7730f863 | 1,287KB / 15:57:40 | 已确证 |
| 豆包联络人 | 豆包联络人 · AI writer项目组 | 3769c181 | c12ee7f6 | 4,189KB / 15:55:06 | 已确证 |
| QA | QA · AI writer项目组 | 1586edd1 | 5d4057a5 | 819KB / 16:14:29 | 已确证（QA 16:13 供映射，本机实测同值） |
| 产品经理 | 产品经理 · AI writer项目组 | 090e6e7d | 54f674e2 | 1,558KB / 16:14:17 | 已确证（同上） |
| developer | developer · AI writer项目组 | 585a879b | ba2b3946 | 2,693KB / 16:14:35 | 已确证（同上） |
| 金牌编辑 | 金牌编辑 · AI writer项目组 | 3460ca40 | c883ffa3 | 2,538KB / 15:53:46 | 已确证（同上） |

## 二、已移出群（0）

无。

## 三、弃用 id

| id | 归属 | 弃用理由 |
|---|---|---|
| 33494f59 | workbuddy联络人 | 旧群分身，11-15 00:57 起停写，已弃用（INC-20261115-01 诱因之一） |
| daeb834f | wakeup-inbox watch 孤儿目标 | 无对应在群分身，watch 已删 |
| 6dc4ab20 | AI writer总负责人 | **上一 part 群分身**：4,307KB / 最后写 16:05:43；rooms 映射已于本 part 指向 `08b720e9`。不入弃用黑名单，只标「非现行」，A1 判 `08b720e9`。 |

## 四、判定口径

1. 群内成员在群里发起的投递，`From:` 写「角色 · AI writer项目组 | <本表群分身 8 位>」。
2. 已移出群者（本版为 0）写「角色 | <8 位>」，不带群后缀。
3. `From` 与 `To` 均为发件方自写文本，是标识不是凭据；真伪只认通道（relay 注入行 ＋ 落在本组 watch 目录 ＋ 投出侧 resolved/delivered 两条）。
4. 名册随群成员变动更新；分身 id 会随会话 part 轮换，**以最新一次本机实测为准**，不在表内即判「From 不在清单」。
5. 若 8 位对不上但角色名在表内，按「id 过期／part 轮换」处理：不判可疑执行，先在群里报项目管家回读改名册。

## 五、待核与轮换风险

- 负责人群分身存在 part 轮换（`6dc4ab20` → `08b720e9`）：以 rooms 映射＋目录持续写入为准；若发现 A1 假阴，先回读本表再判。
- 名册本身不含主身 id 的判定用途：主身只用于 `to-owner` 通道（大肥鱼 `a1d48adb`）。

<!-- ROSTER-VERSION: v2 -->