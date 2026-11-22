# 派验单 · CARD-S3-D16B（状态栏模型指示器：常态显示默认、实际不同时并列）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方）
执行方（apply 位）：developer · AI writer项目组——已表决 **①采纳参考实现**；只做 apply 与判据 5 的 live，不许自行改法
外派位：**本卡不宜外派**。理由：参考实现已存在（`961eaa05`），改动面仅 4 个前端文件，判据 5 的 live 必须在本机真实 Electron＋真实 SQLite 上跑，外派只能交结论不交读数。
分母（三处，报出时现算）：
- 卡面 `.batch/night/cards/d16b-statusbar-default-first.md` 49 行 / 4,681B / sha256 `594d7691941d472776dcdf0ad191c90198bd9f5cabb2167727384a7ca7059c23`
- 借卡件 `.batch/night/staging/d16b-card-borrow.md` 39 行 / 3,706B / sha256 `f0ad77938f4d84af5634f5cca9e8bda21f6ba08a1d6a9e1edc93eaed892811c8`
- 派单件 `.batch/night/staging/d16b-dispatch.md` 43 行 / 3,479B / sha256 `a583de754a6a1d120a896d5760e14b574d8e0931804f1e1df085e77fe2930faf`
- 本单 sha 由报出时现算（互引会循环，此处不写死）
已出首验：`.batch/night/reports/d16b-qa-firstcheck.md` 147 行 / 9,312B / sha256 `164bffdd5188ec485a5e13a188dbda810f1ce2bd101d271e8aae7899bdd5be19`——判据 1／2／3／4／6 已判 PASS，判据 5 待补；本单要求在**该件 §8 记 developer 的选择、§10 出复判**，不另起文件。
起点/base：**`9f31562f`**（admin 11-22 12:5x 定）。实况补一条：主线现头已到 `57a526a1`（只改本卡卡面文档）；R4 取 `57a526a1`，评审作用域仍 `fb2c5d6f..961eaa05`，这段文档差记观察项、不判 FAIL。
分支：`card/d16b-statusbar-default-first`，头 **`961eaa05`**＝参考实现；`git merge-base --is-ancestor 961eaa05 9f31562f` → 非祖先（未入主线）。
排期：D10 在前（包 `f268ca86…`），本卡 apply 排其后；**一次一张**，不与 D11 并行。

## 判据（逐条要原文；缺一条即不出总判）

**本卡判据分层（照卡面原标签，只加标签、判据文字不动）：第 1、2、4、6 条 `[static]`；第 3 条 `[mock]`；第 5 条 `[live]`。第 5 条只认 developer 在 `develop` 起的真实实例，mock 与 static 推断一律不许顶；其余条不得冒充实机结论。**

1. **[static] 模型段单测**：配置A／实际B ⇒ `配置模型A（实际 实际模型B）`；同名 ⇒ 只一次且 `same:true`；只有配置 ⇒ `configured` 档；只有实际 ⇒ `actual` 档；空白串按缺失；两侧皆空 ⇒ `null`。需贴整文件汇总行＋末行 `EXIT=`（禁 `-t` 过滤）。
2. **[static] 渲染单测**：三种情形 label 与 tooltip 原文正确；zh／en 不串，en 不得出现「当前模型」。同样要整文件汇总行＋`EXIT=`。
3. **[mock] 无回归**：`resolveStatusbarModel`／`statusbarModelCopy` 旧单测仍绿、旧 API 未被删改。**数字口径（admin 11-22 12:5x 裁，记录项放行）**：卡面写「旧单测 13 条」，实测 **6 条**（13 是整文件现有用例总数）；按实测判，判据语义不变。
4. **[static] 断言修改有据**：`StatusBar.test.tsx` 里被改写的断言必须是「D16 的显示 B」→「按 C 并列／配置档」，不许借机改其它断言；判词须贴 `git diff 961eaa05~1 961eaa05 -- src/components/layout/__tests__/StatusBar.test.tsx` 原文。**数字口径同上**：卡面写「2 条」，实测改写 **3 条**（zh 显示 B→并列、en 显示 B→并列、无实际记录时 `当前模型：`→`当前模型（配置）：`）。
5. **[live] 实机（developer 执行，单实例）**：①改默认模型后右下角**跟着配置刷新**；②先跑一次生成让实际调用 ≠ 默认，右下角并列「默认（实际 B）」；③tooltip 两段原文同屏；④evidence 四项原文齐全：`instancesThisRun`／`exitCode`／`leftoverElectronProcesses=0`／`tasklist | grep -c electron`。跑不起来照实写「未跑成＋原文报错」，不许改判据绕过。
6. **[static] 门禁**：`pnpm check:fast` 全过（贴末行原文）；白名单四文件之外零改动（`git diff --stat fb2c5d6f..961eaa05` 须为 4 files +167/−20，或给出等价原文）。

## 记录项（不判 FAIL，判词里各记一行）

- developer 已表决 ①采纳参考实现，理由：改动全落在白名单 4 文件、旧 API 未删改、与作者裁定 C 逐条对得上；判词 §8 须记这条选择。
- 旧 API 变死代码（仅单测引用）——建议另开清理卡，本卡不判。
- `same` 按显示名判等而非 model id，同名不同模型会折叠成一条——已知边界，本卡不判。
- `max-w-[180px]` 为经验宽度，窄窗并列会被截断、完整信息只在 tooltip——判据 5③ 要验到三段同屏。
- 主线 `57a526a1` 只含卡面文档；R4 取它，评审面仍 `fb2c5d6f..961eaa05`。

## 交付与判词落点

- 交件报告：`.batch/night/staging/d16b-statusbar-report.md`（须含二选一与理由、判据 5 三段界面原文、evidence 四项、单测汇总行＋`EXIT=`、`check:fast` 末行、署名句「代码由主身提供（参考实现 `961eaa05`），developer 仅 apply 与验收」）。
- 判词：就写在 `.batch/night/reports/d16b-qa-firstcheck.md` 的 §8／§10（新内容追加），不另起文件；判完直投 `.batch
ightridge	o-owner`。
- 合并与 push 只由主身做：QA PASS 后 merge ＋ `post-merge-check` ＋ push 并报新头 sha；在此之前任何人不得并入主线。
