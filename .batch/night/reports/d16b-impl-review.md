# D16B 实施评审 · developer ①采纳参考实现（判据编号对齐卡面 §2 1–6）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方，按本版编号开判）；抄送 admin
版本：v2 · 2026-11-22 · 取代我在群里 13:00 那条混号表述（判据编号以本件为准）
被评对象：developer 表决 **①采纳参考实现** 及其逐条实施评审（群内发言，未单独出件）
分母（现算）：
- 卡面 `.batch/night/cards/d16b-statusbar-default-first.md` 49 行 / 4,681B / sha256 `594d7691941d472776dcdf0ad191c90198bd9f5cabb2167727384a7ca7059c23`（判据清单在 §2）
- 派验单 `.batch/night/review-requests/d16b-statusbar-default-first.md` 41 行 / 5,552B / sha256 `828aea01914aac3094f5c81393b2591c3c1a3eb2c11b5aee019cf6eddcd0933a`
- QA 首验件 `.batch/night/reports/d16b-qa-firstcheck.md` 147 行 / 9,312B / sha256 `164bffdd5188ec485a5e13a188dbda810f1ce2bd101d271e8aae7899bdd5be19`
基准面：起点 `9f31562f`、主线头 `36b29a81`、参考实现 `961eaa05`（未入主线）、评审面 `fb2c5d6f..961eaa05`

## 1. 编号对齐表（本件要点：只许 1–6，节号写 §2）

| developer 原表述 | 正确归属 | 说明 |
|---|---|---|
| 「判据 1：模型段 …」 | §2 判据 1 | 编号正确，依据 `statusbar-model.ts:75` `same = configured === executed`、`:76-83` 并列文案 |
| 「判据 2：渲染 …」 | §2 判据 2 | 编号正确，依据 `StatusBar.tsx:122` 可见文本只放 label、来源进 `title` |
| 「判据 4：只替换了模型段那一处渲染与 import，`actualLabel`／store 取值链未动」 | **§1 改动面口径（不是判据）** | 判据 4 是「改写断言有据」；他这段描述的是改动面最小，不构成判据 4 的证据 |
| 「判据 3 的 13 条 vs 实测 6 条」 | §2 判据 3 | 数字偏差，admin 11-22 12:5x 已按记录项放行 |
| 「判据 5 live 只能实机看」 | §2 判据 5 | 编号正确，仍待做 |
| （未提）门禁 | §2 判据 6 | QA 首验件已取 `[check:fast] 全部通过。`／`CHECKFAST_EXIT=0` |
| 主身件里「判据 6 的 diff」 | §2 判据 4 | 笔误，以卡面 §2 为准 |

## 2. 逐条评审（1–6，按卡面 §2 原文顺序）

1. **模型段单测**：提案依据对得上——正常／同名／只有配置／只有实际／空白／皆空六档由 `statusbarModelDisplay()` 分层返回，`same` 在 `:75` 由配置名与实际名相等判定。能判否：**能，[static]**；缺：整文件汇总行＋末行 `EXIT=`（不得 `-t` 过滤），QA 判时取。
2. **渲染单测**：`StatusBar.tsx:122` 可见文本仅 `modelDisplay.label`，来源文案进 `title`；en 分支不出「当前模型」。能判否：**能，[static]**；缺同上。
3. **旧 API 无回归**：`resolveStatusbarModel`／`statusbarModelCopy` 原样保留（`statusbar-model.ts:20`／`:43`），旧单测仍在跑。卡面写「13 条」，实测 **6 条**——13 是整文件现有用例总数。**按实测 6 条判，判据语义不变**（数字偏差记记录项）。
4. **改写断言有据**：developer 本次**没有提供**判据 4 要求的 diff 原文，其「只改模型段渲染与 import」属改动面，不能顶。缺：`git diff 961eaa05~1 961eaa05 -- src/components/layout/__tests__/StatusBar.test.tsx` 原文，且须证明改写是「D16 显示 B」→「按 C 并列」、未借机动其它断言（卡面写 2 条、实测 3 条：zh 显示 B→并列、en 显示 B→并列、无实际记录时 `当前模型：`→`当前模型（配置）：`）。
5. **实机 live**：唯一待验项。`StatusBar` 现只订阅 `effectiveConfigured`，改默认后是否真重渲染只能实机看，不能由 static 推。缺：三段界面原文＋四项 evidence（`instancesThisRun`／`exitCode`／`leftoverElectronProcesses=0`／`tasklist | grep -c electron`）。
6. **门禁**：QA 首验件已取原文（`Tests 20 passed (20)`／`TEST_EXIT=0`、`[check:fast] 全部通过。`／`CHECKFAST_EXIT=0`）。能判否：**能，[static]**。

## 3. 观察项（不判 FAIL，判词各记一行）

- 旧 API 变全仓只有单测引用的死代码——建议另开清理卡，本卡不判；否则后人再调它会把同一 bug 带回来。
- `same` 按**显示名**判等而非 model id，两个不同模型同显示名会折叠成一条；符合「同名只显示一次」，但属已知边界。
- `max-w-[180px]` 为经验宽度，窄窗并列会被截断、完整信息只在 tooltip——判据 5③ 必须验到三段同屏。

## 4. 结论与顺序

- **采纳①成立**：改动全落白名单 4 文件（`git diff --stat fb2c5d6f..961eaa05` → 4 files +167/−20）、旧 API 未删未改、与作者裁定 C 逐条对上；重做只是同一份实现再写一遍。
- 判据 1／2／6 证据齐、3 按实测 6 条放行、**4 缺 diff 原文、5 待 live**——故本件**不是 PASS**，只是评审对齐；PASS 权在 QA。
- 顺序（admin 11-22 13:0x 裁定，apply 先行、PASS 只卡入库）：D10 developer 按包 `f268ca86…` 在 `card/s3-d10-clear-reset`（自 `9cd24897`）逐行落盘 → 跑 `pnpm test electron/repositories/__tests__/project-clear-receipt.test.ts`＋`check:fast`＋一次实机（单实例、跑完即关）→ 交交件报告 → QA 用四件分母开判（2/3/4/6 贴 run id 与三项实例读数）→ PASS 才交主身入库 push。本张同规：apply → 判 → PASS 入库（不是 PASS 才 apply）；D16B 判据 5 live 回后，QA 在 `164bffdd…` 的 §10 复判（分母换新卡）→ 我终审 → D11（包由 developer 自出）。
- `961eaa05` 在 QA PASS 与主身 merge 之前不得入主线，谁并谁负责。

## 5. 取证命令

```
git diff --stat fb2c5d6f..961eaa05        # 4 files changed, 167 insertions(+), 20 deletions(-)
git merge-base --is-ancestor 961eaa05 36b29a81   # 期望非 0（未入主线）
sha256sum .batch/night/cards/d16b-statusbar-default-first.md
```
