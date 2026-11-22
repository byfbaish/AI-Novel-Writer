# 借卡件 · CARD-S3-D16B（借既有卡面走群内标准流程）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（实施/apply 方）；QA · AI writer项目组（首验方）
日期：2026-11-22（S3）

## 1. 借什么、不借什么

本卡**不新起卡面**，直接借 `.batch/night/cards/d16b-statusbar-default-first.md`（v1，49 行 / 4,681B / sha256 `594d7691941d472776dcdf0ad191c90198bd9f5cabb2167727384a7ca7059c23`）。

- 借：该卡面的 §0 由来与作者裁定 C、§1 改动面、§2 判据 1–6、§3 白名单。
- 不借：卡面页首「已实施入库」的叙述按 admin 11-22 12:5x 更正为「`961eaa05` 是参考实现、不入主线」，这句话在本件与派单件里写明，卡面字节不动（判据文字与白名单不许改）。
- 任何人不得改判据文字；口径不一致 → 先报负责人补留痕，判据不让给提案。

## 2. 三处定位（以后件一律引这三行）

- 卡面：`.batch/night/cards/d16b-statusbar-default-first.md` 49 行 / 4,681B / `594d7691941d472776dcdf0ad191c90198bd9f5cabb2167727384a7ca7059c23`
- 起点：**`9f31562f`**（admin 11-22 12:5x 定）。补一条实况：主线现头已到 `57a526a1`（只改本卡卡面文档），故 R4 取 `57a526a1`、评审作用域仍是 `fb2c5d6f..961eaa05`；这三者之间的文档差记观察项，不判 FAIL。
- 分支头：**`961eaa05`**＝参考实现（4 文件 +167/−20，`git merge-base --is-ancestor 961eaa05 9f31562f` → 非祖先，未入主线）

## 3. 判据分层（照卡面原标签，不改文字）

第 1、2、4、6 条 `[static]`；第 3 条 `[mock]`；第 5 条 `[live]`（只认 developer 在 `develop` 起实例跑的那次，mock 不许顶 live）。

## 4. 数字口径（admin 11-22 12:5x 裁：记录项放行）

判据 3 卡面写「旧单测 13 条」、实测 **6 条**；判据 4 卡面写「被改写的 2 条」、实测 **3 条**（zh 显示 B→并列、en 显示 B→并列、无实际记录时 `当前模型：`→`当前模型（配置）：`）。判据语义不变，按实测判；卡面数字随本卡收口**一次性新提交更正**，禁 `git checkout --`／`git restore` 抹。

## 5. 必读确认三行（本件签发时已读；developer 在交件报告里照抄并补自己那份）

① 读了哪几份：仓库根 `AGENTS.md`（charter-version 2026-11-07）、`.batch/night/cards/d16b-statusbar-default-first.md`（v1 · 2026-11-22 · 49 行 / 4,681B）、`.batch/night/reports/d16b-qa-firstcheck.md`（2026-11-22 · 147 行 / 9,312B）。
② 各自当前版本或日期：AGENTS.md charter-version 2026-11-07；卡面 v1 · 2026-11-22 · `594d7691941d472776dcdf0ad191c90198bd9f5cabb2167727384a7ca7059c23`；QA 首验件 2026-11-22 · `164bffdd5188ec485a5e13a188dbda810f1ce2bd101d271e8aae7899bdd5be19`。
③ 据此要遵守的三条口径：一卡一分支＋点名路径 `git add`（禁 `-A`）、不 commit／不 push／不动 `develop` 主区；判据 5 的 live 单实例、跑完即关、evidence 四项（`instancesThisRun`／`exitCode`／`leftoverElectronProcesses`／`tasklist | grep -c electron`）齐；判据文字与 §3 白名单四文件之外一律停手报，不许扩。

## 6. 署名与交接

- 采纳参考实现这条路上：**代码作者署主身**，apply 与 live 署 developer；交件报告须原句写明「代码由主身提供（参考实现 `961eaa05`），developer 仅 apply 与验收」。
- 若 developer 判「要求重做」：实施包单独出、认可件另签，代码作者署实施包提供方。
- 入库归主身：QA PASS 后 merge ＋ `post-merge-check` ＋ push，报新头 sha；在此之前任何人不得并入主线。
