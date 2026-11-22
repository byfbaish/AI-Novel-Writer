# D10 口径裁定（主身）· CARD-S3-D10

日期：2026-11-22　裁定人：大肥鱼（主身 / admin）

## 一、实施与外派

- **实施成果＝实施包 `s3-d10-impl-package.md`（102 行 / 12,388B / `f268ca863c29…`）**，本卡不另派外派 Agent。
- **落盘归 developer 的 apply 位**：按包逐行落盘、跑单测、跑一次实机、交件；不许自行改法，认为包有问题即停手报 admin 裁定，裁完包 sha 重报。
- 纠正一处措辞：包内 §「外派位」写作「本卡不宜外派（admin 11-22 裁）」。我的原话是**「不外派新实施、落盘归 apply 位」**，理由是可外派面小（1 个生产文件＋1 个测试文件、删除路径真删数据走 FK 事务、落盘人须自跑单测与实机，外派只交 patch 多一轮往返不省时）。两者结论一致，但**「admin 裁：本卡不宜外派」不可被后人当先例引用**——外派与否按改动面与可验证性逐卡判断，不是 D10 开的口子。
- 交件报告必须写明：`代码由实施包 f268ca86… 提供，developer 仅 apply 与验收`。

## 二、外键次序（本卡的硬约束）

`electron/database.ts:28/47` 均为 `PRAGMA foreign_keys = ON`，外键真实生效。
`electron/migrations/m03-review-cycle.ts:56-61` 三列性质：

- `:56` `root_action_id … REFERENCES generation_roots(root_action_id)`——无 `ON DELETE`（RESTRICT）：决定「`review_cycles` 必须在删 `generation_roots` 之前清」。
- `:57` `review_id … REFERENCES reviews(id) ON DELETE CASCADE`——有级联，但救不了 `:61`。
- `:61` `confirmation_review_id … REFERENCES reviews(id)`——**无 `ON DELETE`（默认 RESTRICT）**：库里只要有一行指向 `reviews`，`electron/repositories/project-clear-repository.ts:175` 的 `DELETE FROM reviews` 就被挡住、整笔回滚。

故次序定死：**清 `review_cycles`（`:174` 之后、`:175` 之前，`hasTable` 守卫）→ `DELETE FROM reviews`（`:175`）→ 删 generation 四表（`generation_roots` 收尾）**。
锚点：`:176` 是 `DELETE FROM revisions`，不是 reviews；`:54-58` 是 `emptyCounts()`，不是 `CLEAR_COUNT_TABLES`（声明在 `:45`，三档 `:46-48`）。

## 三、签名

签名不进包：认可件独立为 `.batch/night/staging/s3-d10-impl-ack.md`（第二版，签 `f268ca86…`）。包再改则本件作废、须按新包 sha 重签。

## 四、R4 观察项

`dcddcb08`（文档）与 `27d70e07`（pre-commit 分支闸门脚本）在 `9cd24897..分支头` 区间内出现，属协作基建与文档，**记观察项、不判 FAIL**。
