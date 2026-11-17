结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/wb-19-develop.md ｜ 判定线：文件型（1 条反转行带实现行号 + 关键代码原文；4 条仍成立带现值行号；≥3 处为 `git -C develop grep` 实取） ｜ 证据：`check-ledger-snapshot.mjs:63-87`（`expandIdCell`）与调用 `:160/:166` 实读确认复合编号**已展开参与判定**，旧结论反向；其余 4 行现值行号已逐条重取

# DB-T3-② · 重做 `wb-19.md` 里被 `8bc4f61f` 反转的那一行

口径：`wb-19.md` 原件写在 `wt-1@8c0bd657`，**原件保持不动**。本文件只重做反转行 + 给其余 4 行的现值行号。

## 0. 前提（已自证）

```
git -C C:\develop\workspace\AI-writer\develop rev-parse --short HEAD
→ 13240ffd
```

## 1. 反转行：`check-ledger-snapshot` 的「复合编号是否参与判定」

### 1.1 现实现（develop `13240ffd`，实读）

```
$ git -C <develop> grep -n "function expandIdCell\|expandIdCell(" -- scripts/check-ledger-snapshot.mjs
scripts/check-ledger-snapshot.mjs:63:export function expandIdCell(cell) {
scripts/check-ledger-snapshot.mjs:160:        const idRows = table.rows.filter(row => row.cells.some(cell => expandIdCell(cell) !== null))
scripts/check-ledger-snapshot.mjs:166:                const expanded = expandIdCell(cell)
```

`scripts/check-ledger-snapshot.mjs:63-87` 关键代码原文：

```
63: export function expandIdCell(cell) {
64:     const raw = String(cell ?? '').replace(/\*\*/g, '').trim()
66:     const parts = raw.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
69:     for (const part of parts) {
70:         const range = /^D(\d+)\s*[–—\-~]\s*D?(\d+)$/.exec(part)
71:         if (range) {
74:             // 反向区间或跨度过大都当「不是编号格」，宁可漏判也不凭空造编号
75:             if (to < from || to - from > 50) return null
76:             for (let i = from; i <= to; i++) ids.push('D' + i)
79:         const single = PURE_ID.exec(part)
80:         if (single) {
81:             ids.push(single[1])
84:         return null
86:     return ids.length ? ids : null
```

调用与登记（`:160`、`:163-175` 原文）：

```
160:         const idRows = table.rows.filter(row => row.cells.some(cell => expandIdCell(cell) !== null))
165:             for (const cell of row.cells) {
166:                 const expanded = expandIdCell(cell)
167:                 if (expanded) ids.push(...expanded)
169:             if (!ids.length) {
170:                 // 只记录「含 D 编号但不是编号格」的行（派生编号如 D18-①），作为附注
```

规则说明（`:54-62` 原文摘要，逐字）：

```
54:  *   单编号 `D17` / `**D17**`；区间 `D4–D8`（en dash、hyphen、`~`、`—` 都认）；
55:  *   逗号/顿号并列 `D9–D11、D16`。
56:  * 返回 null 表示「这一格不是纯编号格」——包括 `D18-①` 这类派生编号，
57:  * 它不参与判定（判的是「编号行是否齐全」，派生项本来就该挂在主项里）。
59:  * 为什么必须展开区间：2026-11-11 首次运行时 11 条 MISSING-SNAPSHOT 里有 9 条
60:  * （D4–D8、D9–D11、D16）都是因为整行写成区间、旧实现按「整格等于单个编号」匹配
61:  * 而整行跳过，纯属假阳性。假阳性会让这个脚本接不进闸门。
```

同时确认**未被反转**的那半句仍成立：

```
$ git -C <develop> grep -n "不做状态词匹配" -- scripts/check-ledger-snapshot.mjs
scripts/check-ledger-snapshot.mjs:242:    out.push('判据：整格是编号表达式（含 `D4–D8` 区间）定位缺陷行；列头含「快照」=快照区、列头含「现值」=现值区；不做状态词匹配。')
```

### 1.2 反转前后的行为差（一句话）

**旧实现：整格必须恰好等于单个编号，写着区间/并列的整行被当成「不是编号格」直接跳过，于是 `D4–D8`、`D9–D11、D16` 这类行的快照格与现值格两侧都被记为缺失、报出 9 条假 `MISSING-SNAPSHOT`；新实现把这些区间/并列展开成逐编号（`D4`…`D8`、`D9`…`D11`、`D16`）后逐个比对两格，同一批假阳性清零。**

### 1.3 旧结论错在哪

`wb-19.md` 第 28 行（对照表第 4 行）写的「编号以『整格 = `D\d+`』认定，`D4–D8`/`D9–D11、D16` 这类复合编号**只进「未识别」附注**（`:18-22`）」——

- **错在判定**：复合编号现在**展开后参与判定**（`:66` 拆分 + `:76` 展开 + `:166-167` 登记），不再进附注；
- **错在范围**：进「未识别」附注的只剩**派生编号**（`D18-①` 这类，`:22`、`:169-170`）；
- **对的部分**：「`check-ledger-snapshot` 不做状态词匹配、语义冲突报 OK」这半句**仍成立**（`:242` 逐字「不做状态词匹配」），`wb-19.md` 第 37 行的 B2 边界条目**不受影响**。

### 1.4 顺带发现（措辞残留）

`scripts/check-ledger-snapshot.mjs:269` 的打印标签仍写 `未识别的编号型行（复合/派生编号，不参与判定）：` —— 但按现实现，**复合编号已经会被展开、不会再落到这个桶里**，只有派生编号会。标题里的「复合」二字是 `8bc4f61f` 未同步更新的残留，会误导读报告的人。建议改「（派生编号，不参与判定）」。**这是脚本文案问题，不是判定错误**，故不影响本卡结论。

## 2. 其余 4 行：仍成立 + 现值行号

| 脚本 | 现值行号（本次实取） | 仍成立的判定 |
|---|---|---|
| `scripts/check-fast.mjs` | 3 步在 **`:24-26`**（`typecheck` / `doc-links` / `doc-placement --strict`）；缺依赖时 `:32` 打印「先跑 pnpm install」、`:33` `process.exit(1)` | **仍是 3 步**（不是 6，也不是 5）；不串 `check-ledger-snapshot` / `check-i18n-coverage` / `check-prompt-wiring` 的结论不变。原件写 `:23-27`，现值应为 `:24-26`（`8bc4f61f` 前是 `:23-27`，本次上移 1 行） |
| `scripts/check-doc-links.mjs` | `:55` `process.exit(broken.length === 0 ? 0 : 1)` | 退出码仍**只有 0/1、没有 2**；「不拦外部 URL / 锚点 / `src/` 旁 md」不变 |
| `scripts/check-doc-placement.mjs` | `:246` `const strict = process.argv.includes('--strict')`、`:247` `if (strict && fresh.length > 0) process.exit(1)`、`:248` `process.exit(0)`；`--status-of` 用法错 `:193` `exit(2)`，命中 `:208` / `:224` `exit(0)` | 行号**与原报告完全一致**（`:246-247`/`:248`/`:193`/`:208`）；「不带 `--strict` 必 0」「查询成功与闸门通过共用 0」不变 |
| `scripts/run-tests-electron.mjs` | `:45-46`（未显式给 `run`/`watch` 时补 `run`）、`:48-53` `spawnSync`、`:51` `env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }`、`:55` `if (result.error) throw result.error`、`:56` `process.exit(result.status ?? 1)` | 行号**与原报告完全一致**；「runner 不拦任何东西、退出码 = vitest status」不变 |

## 3. 给 `wb-19.md` 的改法（不改原件，仅列清单）

| `wb-19.md` 行 | 改成 |
|---|---|
| 第 25 行（表 1） | `check-fast.mjs:23-27` → **`:24-26`**；`先跑 pnpm install` 的 `:31-34` → **`:32-33`** |
| 第 28 行（表 4） | 按 §1.3 重写「拦什么」：**「编号格支持单编号 / `**粗体**` / 区间 `D4–D8`（`–`/`—`/`-`/`~` 都认）/ 顿号并列 `D9–D11、D16`，解析函数 `expandIdCell`（`:63-87`），展开后逐编号参与判定（`:160`、`:166-167`）；只有派生编号（`D18-①`）返回 null、进「未识别」附注（`:22`、`:169-170`）」。「不拦状态词」半句保留（`:242`） |
| 第 28 行末（退出码） | `:40` → **`:42`**（退出码说明行）；`:249/:261/:265` 的 exit 2 分支未逐条重核，标**不确定** |
| 第 34 行（B1） | `check-fast.mjs:23-27` → **`:24-26`** |
| 第 37 行（B2） | 保留（`:31-37` 的「不做状态词匹配」理由在 develop 为 `:242`，结论不变；`prompt-assembly-backlog.md:113` 这个引用点本身已过期，应改成 `:114`——见 DB-T1/`db-topup-1.md`） |
| 第 46 行（B5） | 引用 `check-prompt-wiring.mjs:50/:51/:715-716` 本次**未重核**，标**未复核**，不宣称仍成立 |

## 4. 未做 / 边界

- **未改** `wb-19.md` 原件（卡明令禁改），只新建本文件。
- **未重跑任何脚本或测试**（`pnpm test` / `check:fast` / 各 `check-*.mjs` 一律未执行；红线 1 + 本卡禁令）。上述「拦什么 / 不拦什么」全部来自实读源码，不是运行结果。
- **未逐行重核** `check-i18n-coverage.mjs` 与 `check-prompt-wiring.mjs` 的判定细节（原件本身也只读了头部），`wb-19.md` 第 46 行与第 50 行的登记项保持**未复核**。
- **未核** `check-ledger-snapshot.mjs` 的 `--json` 模式退出码（原件第 60 行标的「不确定」继续沿用）。
- **不确定**：`8bc4f61f` 是否只改了 `expandIdCell` 相关段落（本次按现值实读判定行为，未逐 diff 该提交；只确认现值行为与原件相反）。

DONE
