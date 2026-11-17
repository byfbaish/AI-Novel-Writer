# P54 终审（relay 注入头强制写 From/To 身份）

终审：AI writer总负责人
日期：2026-11-15 14:15
卡面：`.batch/night/cards/p54-fromto-inject.v1.md`｜7,914B / `66C7197B6876F3B4DBDA29913DF99214`（投出版，仅 To 行按真实收件身份改写；原卡 `p54-fromto-inject.md` 7,957B / `AC84E074149E9A124CF6209752210261` 留档）
派验单：`.batch/night/review-requests/p54-fromto-inject.md`｜3,616B / `CAE514F47038257F9BA9090DDB858FC7`
判据件：`.batch/night/staging/handoff-usage-criteria-v4.md`｜10,418B / `540FFF21AAF8C2DEBA6CA5B6EEC07B69`；模板 `_CARD-TEMPLATE.md`｜9,684B / `DB64C10F65DC6E9CA1C87342741DFF9F`

## 判定：通过（含四条遗留）

依据三件（均我方独立回读，不采信自我报告）：

| 件 | 路径 | 字节 | MD5 |
|---|---|---|---|
| 首验复验 | `reports/p54-fromto-inject-qa-firstcheck.v2.md` | 3,074 | `C0B9F29BDC4B53344998876EB9B061A3` |
| 执行报告 | `reports/p54-fromto-inject-report.v2.md` | 11,244 | `990E851512C3771743441CAB3B9681B9` |
| 信号 | `signals/doubao/p54-fromto-inject.done` | 918 | `76E94D6E625AE89640C79D7FA0157AD5` |

交付提交：`fdf7b17..40f34b5` 共 2 笔——`82dfbbe`（13:49:24 `fix: inject From/To identity header into handoff messages`，`index.js` 54/3、`index.test.mjs` 93/2）与 `40f34b5`（13:52:14 `docs: sync README example for From/To header`，`README.md` 18/1）；`porcelain` 空、`--cached` 空、未 push、无 tag。

## 通过项

- C1 交付边界：2 笔 3 文件，工作区干净，无禁用动作（未 push/tag/publish，未改 watch 与 dedupe）。
- C2 注入落点：`index.js:842` 头前置、`:823` 剥正文同名前缀行、`:1241-1246` 取 `resolved.title` 与 `resolved.id`；C2b 三处兜底（`:18`、`:57`、`:1359`）不内置 From/To，无双头。
- C3–C7：From 只从桩件首条 `^From:` 取、缺失写 `UNKNOWN`；To 走 `resolved.title` 兜底 `(无标题)`；id8 与 kind 判定符合卡面；日志留注入身份。
- C8 单测：执行方 166/166、QA 自行复跑 166/166。
- C9 反证：删头 → T1–T5 红；按文件名猜 From → T1/T2/T3 红（均 162/166），两条真红。
- C10 报告格式：首行 `执行方：豆包`、次行 `model=DeepSeek-V4.1-Flash | 倍率=0.01x | provider=自有(豆包)`、末行 `<!-- DONE -->`（全文恰 1 处）。上一版「`model=` 与环境不符」随本版闭合。

## 遗留（结项单必须照抄这四条）

1. **真机未验**：实机 relay 仍是 profile 旧副本，本单只认「代码＋单测＋反证」，未记真机生效。**发版前必须真机验一次**（在真机装 0.5.x 后投一个带 `From:` 的桩件，回读注入头）。
2. **`delivered\` 拷回 watch 源目录**：H6 双证据判第 2 笔纪律违约；contentHash 已拦住重复唤醒、状态仍为 delivered。纪律条重申：`delivered\` 件禁拷回，重发必须换新文件名或改内容。
3. **报告投出后追加改写**：v1 由 10,071B 被追到 11,268B（13:32:22，投出后 3 分钟）。已按「另存 v2、v1 保留」处置；下张卡起报告首行与末行一次写对，不留二轮。
4. **行号漂移**：派验单写 `index.js:1308`，实际 `:1359`（+54 行漂移）。责任在派卡方（我），下次刷卡面按新行号重钉。

附记（过程瑕疵，不进判定）：QA 首验单两次原地改写（6,647B → 7,101B → 7,189B），其已认账，notice 已加【流转件版本纪律】段，下张卡起用 `.vN`。

## 结项动作

- `reports/task-ledger.md` 追加一行（卡号 P54、提交 `fdf7b17..40f34b5`、交付报告 MD5 `990E8515…`、复验单 MD5 `C0B9F29B…`、遗留 4 条指针）。
- 时间账由 大肥鱼 记：投出 13:21:37 → 首笔 13:49:24 → 补笔 13:52:14 → 首验 14:02:51 → 复验 PASS 14:14，整单约 52m。
- 后续：`p54-fix2-dir-ownership`（目录归属注入 + 冲突上报 + 审计字段）可落卡；HMAC/nonce 只立项不排期；发版方式（publish vs pack）待主人一句话。
