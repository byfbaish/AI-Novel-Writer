执行方：developer
取数件三元组：卡面 `.batch/night/cards/reboot-hy4flash-sync.v2.md`｜10,616B｜`0714a372d4da7616f6f0fd52402905fc`｜119 行；派验单 `.batch/night/review-requests/reboot-hy4flash-sync.md`｜3,037B｜`3190c6e8c05c89a9dfa5ae9c7879bc59`｜39 行
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# reboot-hy4flash-sync 执行方报告

## 0. 工作区与开工三项校验（11:36:5x 逐条实跑，原文照抄）

1. `git rev-parse --show-toplevel` → `C:/develop/workspace/AI-writer/develop` ✓
2. `git branch --show-current` → `exp/resource-ledger` ✓
3. `git rev-parse --short HEAD` → `69cd4a41` ✓
4. `git diff --numstat HEAD` → `6	1	scripts/workbuddy/model-policy.mjs`（恰好一行）✓；`git diff --ignore-cr-at-eol --stat HEAD` → `scripts/workbuddy/model-policy.mjs | 7 ++++++-`、`1 file changed, 6 insertions(+), 1 deletion(-)` ✓
5. `git -c core.quotepath=false status --porcelain=v1` → 六项，与卡面 §0.5 白名单逐项相同：` M scripts/workbuddy/model-policy.mjs`、`?? .c/`、`?? reports/evidence-receipt-side-1116.md`、`?? reports/hy4-modelname-probe-20261117.md`、`?? reports/wo-hy4-modelname-20261117.md`、`?? scripts/workbuddy/space-readonly-check.mjs` ✓
6. 目标文件存在：`scripts/workbuddy/model-policy.mjs`（8,253B）、`scripts/workbuddy/__tests__/model-policy.test.mjs`（8,278B）、`.batch/night/org/ledger-append-1117-hy4flash-auth.v6.md`（9,927B）✓

起点 HEAD `69cd4a41`；未跑 `pnpm install` / `rebuild` / `pnpm dev`。

## 1. 改了什么（四处，一次改完）

### ① 测试同步 `scripts/workbuddy/__tests__/model-policy.test.mjs`
- `:170` 断言：`expect(ALLOWED_MODELS).toEqual([MODEL_DEEPSEEK_FLASH])` → `expect(ALLOWED_MODELS).toEqual([MODEL_HY4_FLASH, MODEL_DEEPSEEK_FLASH])`
- `:169` 用例名：`只放行 Hy4 和 DeepSeek-V4.1-Flash` → `只放行 Hy4 flash 和 DeepSeek-V4.1-Flash（Hy4 0.29x 仍禁用）`
- 文件头注释（原 `:23` 段）增两行：`Hy4 flash` 已放开（主人 2026-11-17 01:10 主身私聊授权，只开 `Hy4 flash`），与 0.29x 的 `Hy4` 是两条并列独立选项；`Hy4`(0.29x) 仍禁用
- 新增 import `MODEL_HY4_FLASH`
- **`rejectUnknownModel(MODEL_HY4)` 仍拒那条断言一字未动**（见 §4 判据 1 的 `git diff` 证据）

### ② `auth=` 出处行 `scripts/workbuddy/model-policy.mjs`
- 新增 `MODEL_AUTH`（`Hy4 flash` → `主人|主身私聊|2026-11-17T01:10+08:00`；其余 → `UNVERIFIED`）与 `authOf(model)`
- `describeModelPolicy()` 两个返回分支末尾各追加 `auth=<…>`（高峰分支为 `auth=UNVERIFIED`）
- 新增 `describeModelAuthLines()`：白名单逐条输出一行，行首即 `auth=`，供机检 `^auth=` 直接命中（与 `describeModelPolicy` 共用同一张 `MODEL_AUTH`，无第二份口径）

### ③ 记账件另存 v7 `.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md`
- 编号归位：原 `:62` 的 `## 7. 当日口径` → `## 11.`；原 `:70` 的 `## 8. 口径 A 的两处更正与补充` → `## 12.`；`:42` 的 `§7`、`:47` 的 `§8` 原名不动
- `§8`(`:47`) 版本说明在「本 v2 取代 v1」之后补 v3、v4、v5、v6 各一行，再补 v7 一行
- `§12` 口径改为实测定性（见下），**未写「已堵住」、未写「潜在风险」**
- v7：10,820B｜`91bdbf8ee88cc04d91ef500c3139df27`｜83 行（`wc -l`＝`awk NR`＝83，末行有换行）｜crlf=0｜无 BOM｜首行 `状态：现行`、2–3 行 From/To
- **v6 字节未动**：9,927B｜`e70654eebbbd09f56acca62990be5fd3`

`§12` 新口径（实测定性，`pickModel(date)` 注入时间点穷尽）：
- `23:30`／`02:00` → `model="Hy4"`（`window=hy4-free-night`）
- `12:30`／`20:00` → `DeepSeek-V4.1-Flash`（`window=deepseek-off-peak`）
- `15:00` → `blocked:true`（高峰闸门先拦，不落任何型号）
- 周六 `20:00` → `DeepSeek-V4.1-Flash`（周末无高峰段）
- 定性：**旧树只在 23:00–08:00 返回 `Hy4`**，成因＝夜间窗＋跑了旧树脚本；`HY4_PROMO_ALL_DAY_UNTIL='2026-11-15'` 已过期，走不到「全天限免」分支

### ④ 副本处置：7 棵一律不动（按卡面 §2④）
未对任何 worktree 写文件、未提交、未制造 dirty。只出下面的只读判定表。

## 2. 副本只读判定表（8 行含 develop，11:46 现测，逐棵独立命令）

复跑命令模板（每棵把 `<树>` 换成该树绝对路径）：
```
node --input-type=module -e "const m=await import('file:///C:/develop/workspace/AI-writer/<树>/scripts/workbuddy/model-policy.mjs');const p=m.pickModel(new Date('2026-11-17T23:30:00+08:00'));console.log(String(m.HY4_DISABLED),JSON.stringify(m.ALLOWED_MODELS),String(p.model))"
```
分支/HEAD 取 `git -C <树> branch --show-current`（空则 `detached@<short HEAD>`），md5 取 `md5sum <树>/scripts/workbuddy/model-policy.mjs`。

| 树绝对路径 | 分支或 HEAD | 文件 md5（前8） | HY4_DISABLED | ALLOWED_MODELS | pickModel(23:30) | 结论 |
|---|---|---|---|---|---|---|
| `C:/develop/workspace/AI-writer/develop` | `exp/resource-ledger` | `fda1e954`（本卡改后） | `true` | `["Hy4 flash","DeepSeek-V4.1-Flash"]` | `DeepSeek-V4.1-Flash` | **可派活** |
| `C:/develop/workspace/AI-writer/wt-1` | `agent/wt-1` | `8e0167aa` | `undefined` | `["Hy4","DeepSeek-V4.1-Flash"]` | `Hy4` | 禁派活 |
| `C:/develop/workspace/AI-writer/wt-2` | `agent/wt-2` | `8e0167aa` | `undefined` | `["Hy4","DeepSeek-V4.1-Flash"]` | `Hy4` | 禁派活 |
| `C:/develop/workspace/AI-writer/wt-3` | `agent/wt-3` | `8e0167aa` | `undefined` | `["Hy4","DeepSeek-V4.1-Flash"]` | `Hy4` | 禁派活 |
| `C:/develop/workspace/AI-writer/wt-docfix` | `docs/fix-workbuddy-links` | `8e0167aa` | `undefined` | `["Hy4","DeepSeek-V4.1-Flash"]` | `Hy4` | 禁派活 |
| `C:/develop/workspace/AI-writer/wt-p51` | `agent/p51-median` | `8e0167aa` | `undefined` | `["Hy4","DeepSeek-V4.1-Flash"]` | `Hy4` | 禁派活 |
| `C:/develop/workspace/AI-writer/wt-p56` | `agent/p56-wb-docs` | `0ace4a79` | `true` | `["DeepSeek-V4.1-Flash"]` | `DeepSeek-V4.1-Flash` | 禁派活（策略更严但非派活入口） |
| `C:/develop/workspace/AI-writer/night-probe` | `detached@13240ffd` | `8e0167aa` | `undefined` | `["Hy4","DeepSeek-V4.1-Flash"]` | `Hy4` | 禁派活 |

`test-master` 无该文件（`ls` 报 No such file）。派活入口纪律不变：只用 `C:/develop/workspace/AI-writer/develop/scripts/workbuddy/workbuddy-attach.mjs` 绝对路径发起。

## 3. 判据逐条

**判据 1 · 套件 25/25 全绿**
```
$ ./node_modules/.bin/vitest run scripts/workbuddy/__tests__/model-policy.test.mjs
 RUN  v4.1.11 C:/develop/workspace/AI-writer/develop
 ✓ scripts/workbuddy/__tests__/model-policy.test.mjs (25 tests) 6ms
 Test Files  1 passed (1)
      Tests  25 passed (25)
   Duration  866ms
exit=0
```
`rejectUnknownModel(MODEL_HY4)` 仍拒那条未变（`git diff` 该三行无 `-`/`+`）：
```
$ git diff -U0 scripts/workbuddy/__tests__/model-policy.test.mjs | grep -n "rejectUnknownModel(MODEL_HY4)"
（无输出 ⇒ 该行未被修改）
```
—— 该断言在改后文件里仍在原处：`expect(rejectUnknownModel(MODEL_HY4)).toContain('不在白名单')`。

**判据 2 · `auth=` 每条命中**
```
$ node --input-type=module -e "…describeModelAuthLines()…" + 正则 ^auth=(UNVERIFIED|\S+\|\S+\|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})
true auth=主人|主身私聊|2026-11-17T01:10+08:00 model=Hy4 flash
true auth=UNVERIFIED model=DeepSeek-V4.1-Flash
```
`describeModelPolicy()` 现测（三条分支均带 `auth=`）：
```
11:42 高峰 → 不派活（12:00 后可自动派活） auth=UNVERIFIED
13:00 → DeepSeek-V4.1-Flash（非高峰时段…） auth=UNVERIFIED
10:00 高峰 → 不派活（12:00 后可自动派活） auth=UNVERIFIED
```

**判据 3 · develop 树行为**
```
HY4_DISABLED= true
pick(23:30)= "DeepSeek-V4.1-Flash"   （≠ 'Hy4'）
reject(Hy4)= 模型「Hy4」不在白名单（只允许 Hy4 flash / DeepSeek-V4.1-Flash）
reject(Hy4 flash)= null
```

**判据 4 · 副本判定表 8 行齐全** — 见 §2，结论列只有 develop `可派活`、其余 7 行 `禁派活`。

**判据 5 · 记账件 v7**
```
$ grep -n "^## " …v7.md
42:## 7. 机制确认与开卡范围收敛（01:29，我实核）
47:## 8. 版本说明
67:## 11. 当日口径（11-17 10:10 增补，即时生效，不动盘）
75:## 12. 口径 A 的两处更正与补充（11-17 10:20，按 developer 实测定性重写）
（`## 7.`/`## 8.` 各只出现一次，无重号残留）
$ grep -n "^v[3-7]" …v7.md
49:v3：…  50:v4：…  51:v5：…  52:v6：…  53:v7＝由 v6 改来：…
$ md5sum …v6.md ; wc -c …v6.md
e70654eebbbd09f56acca62990be5fd3  9927
```

**判据 6 · `auth=` 计数与位置**
```
$ grep -c 'auth=' scripts/workbuddy/model-policy.mjs
4        （改前基线 0）
$ grep -n 'auth=' scripts/workbuddy/model-policy.mjs
180:  …' auth=UNVERIFIED'
182:  …' auth=' + authOf(picked.model)
186: * 白名单逐条的授权出处行：每行以 `auth=` 开头…
190:  return ALLOWED_MODELS.map(model => 'auth=' + authOf(model) + ' model=' + model)
```
180/182/190 均在 `describeModelPolicy`／`describeModelAuthLines` 段内。

**判据 7 · `pnpm check:fast`**
```
[check:fast] typecheck ✓ 29.8s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
exit=0
```

**判据 8 · 提交纪律** — 一次点名 `git add`，只加三个文件（见 §4）；未 `git add -A`；未 push／tag／publish。

**判据 9 · 报告头三行** — 见文件首三行，provider 命中 `^magpie/group/`。

## 4. 提交

```
$ git add scripts/workbuddy/model-policy.mjs scripts/workbuddy/__tests__/model-policy.test.mjs
$ git diff --cached --numstat
5	2	scripts/workbuddy/__tests__/model-policy.test.mjs
35	5	scripts/workbuddy/model-policy.mjs

$ git show --stat --oneline HEAD
b5afcea2 fix(workbuddy): 同步 Hy4 flash 白名单到测试与 auth 出处行
 scripts/workbuddy/__tests__/model-policy.test.mjs |  7 ++--
 scripts/workbuddy/model-policy.mjs                | 40 ++++++++++++++++++++---
 2 files changed, 40 insertions(+), 7 deletions(-)
```

- 提交 `b5afcea2`（父 `69cd4a41`，分支 `exp/resource-ledger`）；未 push／tag／publish。
- **第三件（记账件 v7）不入库，原因实测**：`git check-ignore -v` 报 `.gitignore:89:/.batch/` —— `.batch/` 整目录被忽略，v7 与本报告都在其中，按设计只在盘上留档、不进提交。故本条只 add 两个代码文件，未用 `-f` 强加、未 `git add -A`。
- commit 触发的 pre-commit 钩子（`check:fast`）通过：`typecheck ✓`、`doc links: checked 1468, broken 0`、`doc placement 新增 0`、`全部通过`。

## 5. 未覆盖边界（不写成「已堵住」）

- 7 份旧副本按卡面 §2④ **不动**，洞仍在树上；本次只是把「跑哪棵树」钉死并留判定表。
- 旧树的暴露段＝23:00–08:00，已用 `pickModel(date)` 注入时间点穷尽四个时点＋一个周末点；未做的是「旧树在真实夜间窗跑一次派活」的实机样本——卡面不要求，也不该为此派活。

<!-- DONE -->
