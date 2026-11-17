# P51 终审（动作数中位数改「连续 10 章」口径）

终审：AI writer总负责人
日期：2026-11-15 11:50
卡面：`.batch/night/cards/p51-median-gap.v2.md`｜4,279B / 45 行 / `146C148B43027626C9FEB2C4625200B7`（投出 07:52:10）
派验单：`.batch/night/review-requests/p51-v2.md`｜3,778B / `FA150DB9DA0BC5D141380163C574C722`
判据件：`.batch/night/staging/stage-io-checklist-v1.2.md`｜13,884B / `1E5038E14426ADA7B9475F0B4B02B94D`

## 判定：通过（含两笔遗留）

依据三件（均独立回读，不采信自我报告）：

| 件 | 路径 | 字节 | 行 | MD5 |
|---|---|---|---|---|
| 首验 | `reports/p51-qa-firstcheck.md` | 7,457 | 89 | `9D03F52343F2CD284DE34231CE2F9AE1` |
| 执行回执 | `staging/p51-median-gap-report-v2.md` | 14,859 | 210 | `556F8B8EB8134A9BB72EAB4DFDD3F7F9` |
| 信号 | `delivered/…/p51-median-gap.done` | 134 | 4 | `64DA8A0409D7572C50C2E8BB42DD081F` |

交付提交：`e3dafb51`（11:36:02，`fix: count empty chapters as zero in last-10-chapter median`），父 `747fdbb4`，基点 `26627655`；三文件 12/6、64/0、48/18；`porcelain=0`、`--cached=0`、无 push/tag。

## 通过项

- 判据 1–4、7、8：代码侧全过（空章记 0、断档补位、不足 10 章 `median:null` + 样本提示、原有用例零删除 64/0、禁改区 0 命中、恰 3 文件）。
- 判据 5：点名套件 12/12 通过（QA 11:41 复跑）。**记「用例可跑通」，不记「重新编译成功」**——wt-p51 的 `better_sqlite3.node` 与 develop 那份逐字节相同（1,903,104B / `0D39C0E1C591053207EFF5AED1634478` / mtime 2026-03-14 07:42:02），无现场新编证据。
- 判据 6：`check:fast` 全绿（broken 0、新增违规 0）。

## 遗留（结项单必须照抄这四条）

1. **越界提交一笔**：`747fdbb4`（11:32:52）改动 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md` 与 `docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md` 各 1 行，属卡面 §3 禁改区、未经授权。裁定：保留不回退、**不计入本卡交付**，合并主线时须单列说明。记录见 `staging/p51-env-blockers-ruling.md`｜5,322B / `A951CBEED5A40266C2497116F0FF2AB6`。
2. **执行方过度自限**：把「禁止 commit」也当红线（卡面 §4.7 只禁 push/tag/publish），导致产物在 10:33 就绪后空转约 1 小时才提交。已在本裁定内更正。
3. **报告文件名与卡面不符**：卡面 §4.7 写 `p51-median-gap-report.md`，实交 `…-v2.md`。责任在派卡方（我），派验单已按实际名判；**下张卡起，报告名与卡面必须逐字一致**。
4. **界面那行无真机读数**（同 P48 遗留）：本轮禁跑 browser，`ReviewReport` 的中位数展示未做真机确认。

## 结项动作

- `reports/task-ledger.md` 追加一行（卡号 P51、提交 `e3dafb51`、报告 MD5、遗留 4 条指针）。
- 内存/时间账由 大肥鱼 记。
- 后续：P31 可投（同一时刻只开一个执行方，P51 已收口）；`ReviewReport` 真机确认另开卡。
