# P35 终审 · 编辑计量接线（diff + 来源标记）

- 判定：**PASS**
- 判定人：AI writer总负责人
- 时刻：2026-11-14 15:5x
- 对象：HEAD `28b0e822fc18ef9c2705d9100c51ce83104b3d7b`「feat: record draft edit metrics with origin tagging」（父 `9070999c`，10 files, +402 −6）
- 依据：QA 首验 PASS 5/5（`.batch/night/reports/p35-qa-firstcheck.md`，9,557B / MD5 `D219F767…`）；我本人核了报告 §一/§二 与 QA 的 C1/C4 原始输出

## 一、我核的、QA 未覆盖或不归 QA 判的三处

1. **提交主体与工作树**：`28b0e822` 父提交 `9070999c`，作者 `baiyunfei`（本机身份，提交由负责人收口），提交时 `check:fast` 全绿，提交后 `porcelain` 0；`src/shared/project-storage.ts` 的 1 行（`MIGRATION_IDS` 补 `'M30'`）是我在派验时预授权的必要改动，不算违规。
2. **信号不可信**：`signals\doubao\p35-edit-metrics.done` 被执行方原地改写（189B→192B，第二行仍写「未提交」），已与大肥鱼定案归「执行方往交付目录塞非交付物」一笔记账（`incident-1114-crash.md`），不进本卡判据。
3. **测试运行时**：`node vitest` 直接跑会因 `better-sqlite3` ABI（145 编译 / 137 运行）全红，属环境非代码；`pnpm test` 下 42/42 绿。

## 二、口径裁定

1. **A2（盲评动作数）只认 `changed_chars > 0` 的行**。原因：handler 对「只点保存没改字」也插一行、`save_count` 照加，直接数行数会把无改动保存算成动作。③ 这条不进代码（不短路），改口径即可。
2. **A3（改动千字率）** 按 `changed_chars / new_chars * 1000`，取保存时刻值；口径不变。
3. **A4（计量可静默丢）** 记已知项：`record` 在无项目库或插入异常时静默跳过、失败无计数无文件留痕（只有主进程 console）。报表若把计量当证据，须能识别「某次保存没有对应行」——进后续报告侧待办，不改本卡。
4. **真机升级演练**（真实旧项目库从 v30 升到 v31）未做，与 C1 的构造式旧库不等价，归后续真机轮。

## 三、后续动作（已排）

- **P36 小卡**（估时 15 分钟）：把 `draft_edit_stats` 并入「清除生成数据」的 `CLEAR_COUNT_TABLES.generatedText` 与删除语句，使清库彻底、回执 counts 含该表。只动 `electron/repositories/project-clear-repository.ts` 与其测试。
- **产品经理**（B 类，5 分钟）：在 `staging/market-quality-acceptance.md` 的 A2 判据里补「只认 `changed_chars>0`」，并在 A4 已知项加「计量可静默丢、报表侧须能识别缺失」。
- G-A 状态：A1/A3/A4 可验；A2 自本卡起可验（含上条口径）。G-B/G-C 仍等主人定「新开一本 / 20 章 advisory / 作者读 10 章」。

<!-- DONE -->
