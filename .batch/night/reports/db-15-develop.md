结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-15-develop.md ｜ 判定线：文件型（5 处行号 + 1 条失效子行，每处给旧→新→新行原文；≥3 处为 `git -C develop grep` 实取） ｜ 证据：HEAD=`13240ffd` 自证通过；5 处全部用 develop grep 重取，其中第 5 处（常量）复核后**不是位移而是原件指错行**，已回正

# DB-T3-① · `db-15.md` 在 develop 现值上的补正

口径：`db-15.md` 原件写在 `wt-1@8c0bd657`，**原件保持不动**（历史记录）。本文件只给「在 `13240ffd` 上该改成什么」。

## 0. 前提（已自证）

```
git -C C:\develop\workspace\AI-writer\develop rev-parse --short HEAD
→ 13240ffd
```

取数方法：`git -C develop grep -n <pattern> -- <path>`（现值）；旧树对照用 `git -C develop show 8c0bd657:<path>`（同一仓库对象，等价只读）。

## 1. 五处逐条复核

| # | 原报告锚点 | develop 现值 | 新行原文（首 20 字 + 结尾特征） | 位移量 / 性质 |
|---|---|---|---|---|
| 1 | `CodeMirrorEditor.tsx:821`（气泡 `select-none`） | **`:831`** | `className="fixed z-5…`，结尾 `-translate-y-full` | **+10 行**（`90770846`/`c073159f` 在气泡上方插了代码） |
| 2 | `CodeMirrorEditor.tsx:874`（只有「继续原运行」） | **`:884`** | `{canResumeAI && <butt…` | **+10 行** |
| 3 | `CodeMirrorEditor.tsx:887`（「替换」`disabled`） | **`:897`** | `disabled={aiResult =…`，尾部 `|| aiError !== null}` | **+10 行** |
| 4 | `CodeMirrorEditor-generation.browser.tsx:281` / `:335` / `:336` | **`:283` / `:339` / `:340`** | `:283` = `if (changedFile) awai…`；`:339` = `await expect.element(pag…`；`:340` = 同样以 `await expect.element(` 开头但尾部是 `.not.toBeInTheDocument()` | **+2 / +4 / +4**（**不是统一平移**，见 §1.1） |
| 5 | `generation-call-timeout.ts:14`（`DEFAULT_SINGLE_CALL_TIMEOUT_MS`） | **`:12`** | `export const DEFAULT_S…`，`10 * 60 * 1000` | **不是位移 —— 是原件指错行**（见 §1.2） |

实取命令与原始输出（未改写）：

```
$ git -C <develop> grep -n "disabled={aiResult" -- src/components/editor/CodeMirrorEditor.tsx
src/components/editor/CodeMirrorEditor.tsx:897:                  disabled={aiResult === '' || aiError !== null}

$ git -C <develop> grep -n "select-none" -- src/components/editor/CodeMirrorEditor.tsx
src/components/editor/CodeMirrorEditor.tsx:831:          className="fixed z-50 flex items-center gap-0.5 p-1 rounded-xl border select-none shadow-xl transform -translate-x-1/2 -translate-y-full"

$ git -C <develop> grep -n "继续原运行" -- src/components/editor/CodeMirrorEditor.tsx
src/components/editor/CodeMirrorEditor.tsx:184:      setAiError(applicable ? null : uiText('恢复的候选尚不可应用，可复制或继续原运行', ...))
src/components/editor/CodeMirrorEditor.tsx:884:                {canResumeAI && <button onClick={handleResumeAI}>{uiText('继续原运行', 'Continue original run')}</button>}

$ git -C <develop> grep -n "仍可复制\|请重新选中后再试\|后续单元不再执行" -- src/components/editor/__tests__/CodeMirrorEditor-generation.browser.tsx
…:283:  if (changedFile) await expect.element(page.getByText('正文或原目标已变化，结果未应用；请重新选中后再试')).toBeVisible()
…:315:  await expect.element(page.getByText('正文或原目标已变化，结果未应用；请重新选中后再试')).toBeVisible()
…:338:  // B16：内联气泡只承载产物层一句；批次层「后续单元不再执行」属批次场景，不得出现在单次调用里。
…:339:  await expect.element(page.getByText('来源已变化：这一稿不能保存，请重新选中后再试。')).toBeVisible()
…:340:  await expect.element(page.getByText('后续单元不再执行', { exact: false })).not.toBeInTheDocument()

$ git -C <develop> grep -n "DEFAULT_SINGLE_CALL_TIMEOUT_MS" -- src/shared/generation-call-timeout.ts
src/shared/generation-call-timeout.ts:12:export const DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000
```

### 1.1 为什么第 4 处不能用「整体加 N 行」推

旧树（`8c0bd657`）实读：

```
281:   if (changedFile) await expect.element(page.getByText('来源已变化：这一稿不能保存，仍可复制。')).toBeVisible()
335:   await expect.element(page.getByText('来源已变化：这一稿不能保存，仍可复制。')).toBeVisible()
336:   await expect.element(page.getByText('来源已变化：后续单元不再执行，需重新发起。')).toBeVisible()
```

`:281 → :283` 是 **+2**（这段之前插了 2 行），`:335 → :339` / `:336 → :340` 是 **+4**（`:284` 与 `:334` 之间又插了 2 行）。**同一文件里两个偏移量并存**，所以任何「文件整体 +N」的换算都会错一半。改行号必须逐条按内容定位。

### 1.2 第 5 处：原件本来就指错行，不是「位移」

旧树实读（同一仓库取 `8c0bd657` 版本）：

```
12: export const DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000
13:
14: /** D9 单次调用超时的稳定失败码：判据是**时长**，与传输层超时（NETWORK_ERROR）分档。 */
15: export const GENERATION_CALL_TIMEOUT_FAILURE_CODE = 'GENERATION_CALL_TIMEOUT' as const
```

即：`DEFAULT_SINGLE_CALL_TIMEOUT_MS` 在**旧树就在 `:12`**，`:14` 一直是那句失败码注释。所以 `db-15.md` 第 10 行写的 `generation-call-timeout.ts:14` 从来不是位移问题，而是**原件把注释行当成了常量行**。

同时更正我在 `db-topup-1.md` 里的说法：那里写的「develop 是 `:12`（我写 `:14`）」把它记成了一次位移，**这个描述是错的** —— 现值 `:12` 与旧值 `:12` 相同，位移量为 0。正确表述：**原件指错行，两树常量都在 `:12`。**

## 2. 1 条已失效子行（`db-15.md` 第 41 行，对照表第 14 行）

- **原判定**：「一致（**在本树**，见 §2-B 的版本风险）」——依据是旧树 `:281`/`:335` 两处都是「来源已变化：这一稿不能保存，**仍可复制**。」，`:336` 是「来源已变化：后续单元不再执行，需重新发起。」（**正向存在断言**）。
- **现值实际**（`13240ffd`）：
  - `:283` = `正文或原目标已变化，结果未应用；请重新选中后再试`（文案整体换了，「仍可复制」四字**消失**）；
  - `:339` = `来源已变化：这一稿不能保存，**请重新选中后再试**。`（同一位置，尾句从「仍可复制」换成「请重新选中后再试」）；
  - `:340` = `后续单元不再执行` + **`.not.toBeInTheDocument()`**（**极性反转**：旧树要求这句出现，新树要求这句**不得出现**）。`:338` 的注释把理由写死了：「内联气泡只承载产物层一句；批次层『后续单元不再执行』属批次场景，不得出现在单次调用里。」
- **应改成什么**：这一行从「一致」改为——
  > **不一致（2026-11-12 起）**：手册 `:37` 说的「三处文案」在 `13240ffd` 上已是两套东西 —— 内联层只剩产物层一句「来源已变化：这一稿不能保存，请重新选中后再试。」，批次层「后续单元不再执行」被明确要求**不得**内联出现；且原文案里的「仍可复制」已不存在（气泡 `select-none`，本就没有复制控件）。手册须按现值改写，不能再写「三处文案」+「仍可复制」。

## 3. 给原件的改法（不改原件，仅列清单）

| `db-15.md` 行 | 现值应写 |
|---|---|
| 第 37 行（表第 10 行） | `generation-call-timeout.ts:14` → **`:12`**（并注明「原件曾误指 `:14`（注释行），两树常量均在 `:12`」）；同行的 `generation-run-service.ts:203` 在 develop 生产调用在 **`:206`**，注释在 `:205` 一带（未逐字核，标**不确定**） |
| 第 41 行（表第 14 行） | 按 §2 的「应改成什么」整行重写 |
| 第 42 行（表第 15 行） | `:821`→**`:831`**、`:874`→**`:884`**、`:887`→**`:897`**（结论「不一致」不变：仍无「查看当前输出」「复制」按钮，`select-none` 仍在） |
| 第 69 行（§2-C 正文） | 同上三处行号；`CodeMirrorEditor.tsx:184` 那句「可复制或继续原运行」在 develop **仍是 `:184`**（未位移，本次 grep 实见） |
| 第 88–89 行（§3 表） | `:887`→**`:897`**、`:821`→**`:831`** |

## 4. 附带发现（不属本卡 5 处，但同属原件指错行）

- `db-15.md` 第 38 行（表第 11 行）写「`generation-call-timeout.ts:17`（常量）」——旧树 `:17` 实为 `export type GenerationCallTimeoutFailureCode = ...`（**类型别名**），失败码常量在 **`:15`**。同样属「指错行」，建议一并改。
- `db-15.md` 第 63 行（§2-B）里那句「同一文件在该提交下是 `:283`」**是对的**（本卡复核确认 `90770846` 后该文案断言在 `:283`）；但同段说「本树尚未含该提交」已过期 —— 现值分支**已含**。

## 5. 未做 / 边界

- **未改** `db-15.md` 原件（红线 + 卡要求），只新建本文件。
- **未重跑任何测试**（含 `pnpm test`；本卡明令禁跑）。
- **未逐条复核** `db-15.md` 其余 15 行（如手册 `:25`/`:34`/`:37` 条目的行号、`:146` 的 `findFromDOM` 断言、`:181-186` 的界面文案）在 develop 是否位移 —— 本卡只要求这 5 处 + 1 条子行，其余标**未复核**，不据此宣称「其余均仍成立」。
- **不确定**：`generation-run-service.ts` 在 develop 的注释行号（只 grep 到生产调用 `:206`，未 grep 注释），故第 3 节里对 `:203` 只写「应向 `:205` 一带核对」。

DONE
