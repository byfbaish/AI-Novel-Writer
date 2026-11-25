# 补板 §E 25 张卡复核（QA 首核）

- 复核对象：`.batch/night/staging/board-backfill/board-backfill-list-v2.md` 99 行／11,583 B／sha256 `1d8eafb3211ef2582d9ee44c5ea98682dcc9d545db8c167174923f71d436796e`（§E 25 行对照）
- 看板读数：board revision 1017，total 188／done 177／todo 10／failed 1／archived 1；`query=补板` 命中 31 张（＝补板 25 张 ＋ 第一批 6 张）
- 工作区：HEAD `e61c60b2`、`git status --porcelain` 0 行
- 时间：2026-11-26 02:2x

## 1. 结论

25 张卡的「卡号—卡名—归属—状态」与 §E 逐条对得上，2 张 todo 与清单一致（#4 `794ada3d`、#12 `e16af433`）。
但同一批活被**建了两遍**：第一批 6 张与补板 25 张里的 6 张判定面相同，且第一批读数已过期。此为需裁决项，非 PASS。

## 2. 阻断项：6 组重复建卡

| 活 | 第一批（早建） | 补板卡（§E） | 判定面证据 |
|---|---|---|---|
| RES-R1 Q1 取证 | `5e5227c1` done | #1 `814c0690` done | 同一产物 `res-q1-evidence-1125.md` 138 行／17,802 B／`fe79f812…` |
| RES-R2 字段级 diff | `c378b6bb` done | #3 `60a1f8fb` done | 同一件 `docs/research/2026-11-25-c1-2-field-diff-spec.md` |
| RES-R3 改名＋断言 | `601e2b9e` **done** | #4 `794ada3d` **todo** | 同一备案件 137 行＋断言件 20,596 B |
| 需求正本 v3.2.8→v3.2.10 | `c5a01d8e` done | #13 `81c7a73d` done | 同一 `.batch/night/org/book-meta-requirements.md` |
| RES S1–S4 收口 | `74546d3a` done | #5 `3f21737c` done | 同一条提交链 `8be4a154`→`afa72d4c`→`2c3205d5` |
| 四源评审汇总 | `0124a09b` done | #9 `94755684` done | 同一件 `ext-review-1125-four-way-synthesis.md` 6,266 B |

影响：
1. `done` 计数虚增（同一活记两次）；
2. **R3 状态两说**：`601e2b9e` 记 done、`794ada3d` 记 todo（终审未落笔），终审按 done 那张走就会漏终审；
3. 终审引用会撞车——两版读数不同（见 §3）。

建议（去留由项目总负责人定，二选一，不许并存）：保留补板版 25 张（判据更细、带归属与出处），第一批 6 张归档；R3 一律留 `todo` 至终审落笔。

## 3. 第一批 6 张的读数已过期（盘上实取）

| 读数 | 第一批卡写的 | 盘上实测 | 补板卡写的 |
|---|---|---|---|
| A 件 `reports/planui-design-assessment.md` | 200 行／22,509 B | 200 行／**23,441 B** | #2 写 23,441 B ✓ |
| spec `docs/research/2026-11-25-c1-2-field-diff-spec.md` | 183 行／19,809 B／`9ba8db70…` | **185 行／20,455 B／`d18ee59aaf781afdc491ffa2236eb1ff0546500b4680a94beee38339baa9354e`**（成因：`6f26f42f` 补记 `cs_physical_state n=3`） | #3 写 185／20,455 ✓ |

即：补板卡读数是对的，第一批 6 张是旧值。若两版并存，终审会引到过期 sha。

## 4. 文字项（不影响裁定，改一句即可）

1. **#16 notice 卡判据与清单不一致**：卡面只记「原版 1,349 字八块已从 state 快照找回」，判据写「定稿须主人点头；写入前 dump 现文、写入后核新长度＝旧长度＋增量」；清单 `:34` 与 admin 02:24 口令要求的是「现文 1,621 字／10 块、`identical: true`、三处并入、`relay-4261d313` 凭据＋`.runtime/ntc/` 三件」。→ 建议卡面补这三项读数。
2. **清单 `:31` 指针错**：「需求件版本演进见卡 5」，应为卡 4（`CARD-1125-R3`）；卡 #13 已写对（「见卡 1 系列 / CARD-1125-R3」），是清单正文没同步。
3. **「出处」文件名四种写法**：`board-backfill-list-v2.md §A #1`（#1/#2）、`board-backfill-list-v2.1.md §A #3/#4`、`board-backfill-list-v2.2.md §A #5`、裸 `v2.2 §A #6`。盘上真名是 `board-backfill-list-v2.md`，`v2.1.md` 不存在。→ 统一成 `board-backfill-list-v2.md §X #n`。
4. **判据分层标不一致**：带标只有 #1 `[static]`、#2 `[static]`、#3 `[static]`、#4 `[live] 不改码`、#21 `[static]`，其余 20 张无标。补板卡属记录非新卡，按成本建议二选一：统一补 `[static]`，或在 §E 表头写明「补板记录卡免分层标」。

## 5. 已核过、无异议

- #2 三处行号 `:1212`／`:1218`／`:722-733`、`grep -c ':1153'`＝0 与清单一致；
- #21 八份判词齐全、`[static]` 在、`68ab4281` 夹带正文已排除；
- #22 MANIFEST 写「schema 契约由 developer 出、现值以盘上为准，不写死 sha」，符合 admin 口径；
- #12 前置写明「主身重交修正版样件七项」、状态 todo；
- #4 写有「现行判据看备案件 137 行版（`265b460f` 是过程件）」。
