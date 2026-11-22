# CARD-S3-D16B · 状态栏模型指示器：常态显示默认模型，实际调用不同时并列

From: 主身（实施）· 主身（派单）
To: developer · AI writer项目组（实机 live 一项）；QA · AI writer项目组（首验）
版本：v1 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`fb2c5d6f`**
卡分支：`card/d16b-statusbar-default-first`，交件头 **`961eaa05`**

## 0. 由来（作者 11-22 12:45 报的 bug）

> 应用主界面 UI 右下角的模型显示是错误的，也不会跟着默认模型的选择变更后刷新。

根因（已取证，非偶发）：`src/shared/statusbar-model.ts:24-27`「actual 非空即返回它」，
而 `clearActualModel` 全仓只在 `actual-model-hydration.ts` 的 3 处（无会话/无记录/异常）调用，
**默认模型变更时从不清空** ⇒ 换默认模型后右下角仍停在上一轮实际调用过的模型。这是 D16 判据 2 要的行为，与本卡冲突。

**作者 11-22 12:47 裁定 C**（取代 D16 判据 2）：常态显示默认（配置）模型；实际调用与默认不同时并列成「默认A（实际 B）」；两者同名只显示一次。

## 1. 改动面（`fb2c5d6f..961eaa05`，4 文件 +167/−20）

- `src/shared/statusbar-model.ts` +74：新增 `statusbarModelDisplay()` / `statusbarModelTitle()`；旧的 `resolveStatusbarModel` / `statusbarModelCopy` **原样保留**（D16 旧单测仍在跑，不再被 StatusBar 调用）。
- `src/components/layout/StatusBar.tsx` +8/−7：改用新 API；可见文本只放名字、来源写进 tooltip；宽度 `max-w-[120px]`→`[180px]`（并列会变长）。
- `src/shared/__tests__/statusbar-model.test.ts` +59/−1、`src/components/layout/__tests__/StatusBar.test.tsx` +26/−12：旧的 D16 断言**改成 C 口径**（这是本卡唯一允许修改的既有断言，见判据 4）。

## 2. 判据（QA 逐条判，逐条要原文）

1. `[static]` 模型段单测：配置A/实际B ⇒ `配置模型A（实际 实际模型B）`；同名 ⇒ 只一次且 `same:true`；只有配置 ⇒ `configured` 档；只有实际 ⇒ `actual` 档；空白串按缺失；两侧皆空 ⇒ `null`。
2. `[static]` 渲染单测：三种情形 label 与 tooltip 原文正确，zh/en 不串（en 不得出现「当前模型」）。
3. `[mock]` 无回归：`resolveStatusbarModel` / `statusbarModelCopy` 旧单测 13 条仍绿——证明旧 API 没被删改。
4. `[static]` 断言修改有据：`StatusBar.test.tsx` 里被改写的 2 条，必须是「D16 的显示 B」→「按 C 并列」，不许借机改其它断言；判词贴 `git diff 961eaa05~1 961eaa05 -- src/components/layout/__tests__/StatusBar.test.tsx` 原文。
5. `[live]` 实机（developer 执行，单实例）：①改默认模型后右下角**跟着配置刷新**；②先跑一次生成让实际调用 ≠ 默认，右下角并列显示「默认（实际 B）」；③tooltip 两段原文同屏；④evidence 记 `instancesThisRun`／`exitCode`／`leftoverElectronProcesses=0`／`tasklist | grep -c electron`。
6. `[static]` 门禁：`pnpm check:fast` 全过；单测按整文件汇总行＋末行 EXIT 报（禁 `-t` 过滤）。

## 3. 白名单（超出即退回）

`src/shared/statusbar-model.ts`、`src/components/layout/StatusBar.tsx`、`src/shared/__tests__/statusbar-model.test.ts`、`src/components/layout/__tests__/StatusBar.test.tsx`。
禁改：`electron/` 任何文件、`actual-model-store.ts`、`actual-model-hydration.ts`、`generation:*` 契约、D16 卡的判词与报告。

## 4. 为什么由主身实施（不是破坏「实施外派」）

- 这是 30 行级展示层改动＋改两条既有断言，作者当面报的 bug，等待成本高于实施成本；
- 先例：D7 判据 2 的公式修复也由主身落地（`abe52aca`）；
- **实施归主身，验收仍归 QA**：判据 5 的 live 证据由 developer 跑、QA 判，主身不自己判自己的码。

## 5. 回执

交件：报告 `.batch/night/staging/d16b-statusbar-report.md`（含 live 截图/DOM 原文与 evidence 路径）。
合并：QA PASS 后由主身 merge 入 `exp/mainline-1119` 并 push，报新头 sha。
