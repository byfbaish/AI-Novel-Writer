# 验收口径：`rules.example.md` + README 迁移节（卡 1，执行方＝WorkBuddy）

> **版本**：v2（2026-11-16 05:47，增补 §1 G2 裁量条款）。v1 保留为 05:43 交付物，未改动。

- 判据来源：`.batch/night/backlog/group-rules-prompt-plugin.md:23-24`（卡 1 两条验收）＋现行群 notice。
- 判定方：QA（群分身）。**改的人不自证**：WorkBuddy 只交产物与命令输出，判定与回读由 QA 做。
- 本文件只定义判据与取证方式，不含结论；结论落 `.batch/night/reports/rules-example-qa-firstcheck.md`。
- 起点 `951c39f`；仓 `C:\develop\workspace\dsh-group-rules-prompt`（无 origin，本卡不涉及推送）。

## 0 基线（QA 已于 2026-11-16 05:42 实测，非设想）

现行群 notice 取值：`~/.dsh/bot/state.json` → `rooms["session-4f78136d-2080-4806-ba83-0e5295209594"].notice`

| 指标 | 值 |
|---|---|
| 字符数 | 1,504 |
| 字节数 | 3,468 |
| 块清单（偏移） | `【团队边界·三条底线】@165`、`【身份锚定·主身 vs 群分身】@448`、`【投递身份 From/To（硬规则·可机检）】@614`、`【@ 硬规则（可机检）】@1108`、`【对外执行方 To 行】@1259`、`【流转件版本纪律】@1437` |

notice 全文已冻结到 `.batch/night/staging/notice-current-1116.txt`（3,468B），作为「逐条对得上」的唯一比对源；不以群界面显示为准。

## 1 判据

### G1 产物齐全且在版本控制内

```bash
cd <克隆目录> && git ls-files rules.example.md
grep -n "从 notice 迁移\|From the notice\|Migrating from" README.md README.zh-CN.md
```

判定线：`git ls-files` 命中 `rules.example.md`（未被 ignore、确实入库）；两份 README 各恰有一节，节标题语义对应（中英文各一，不许多节重复）。
反例：只落盘未 `git add` / 被 `.gitignore` 吞掉 → FAIL。

### G2 模板与 notice 逐条对得上（本卡唯一定性判据）

比对源：`notice-current-1116.txt`。做法不是对字数，而是**出映射表**：

| notice 块 | notice 内条目 | example 行号 | 判定 |
|---|---|---|---|
| 【团队边界·三条底线】 | ①②③ | | |
| 【身份锚定·主身 vs 群分身】 | 整段 4 句 | | |
| 【投递身份 From/To】 | From/To 两行格式＋机检＋可疑判据＋拒绝清单 | | |
| 【@ 硬规则】 | 正文含 @、机检、漏 @ 处置 | | |
| 【对外执行方 To 行】 | 不写 session 前 8 位、真伪只认通道 | | |
| 【流转件版本纪律】 | 四类流转件、另存 .vN、哈希对账 | | |

判定线（两条同时成立）：
1. **无遗漏**：六个块与「发言：默认不主动…主动 ≤200 字」段的每条硬约束，在 example 里都有对应行；允许换行/改写句式，不允许语义丢失（例：把「同议题每 bot ≤1 次」改成「尽量少说」＝丢失）。
2. **无新增口径**：example 里每条祈使句都能指回 notice 的某一行（在映射表里写出 notice 偏移）。指不回的一律计入新增，逐条列出交负责人裁，不自行删改。

**裁量条款（负责人 11-16 定，v2 增补）**：G2 里「指不回 notice 某行」的祈使句**不判 FAIL、不卡住 WorkBuddy**——QA 只列原文与行号，交负责人裁：
- 裁「保留」→ 要求执行方补一句来源说明（该条出自哪次会议/哪份文件），补上即计入通过；
- 裁「删」→ 执行方删掉该句即可；
- 无论哪种，QA 在报告里单列「需裁决项」一节，结论行不受其影响，等负责人裁完再出终判。

### G3 不污染配置面、不绑本机

```bash
grep -nE "debugFile|rulesPath" rules.example.md README.md README.zh-CN.md
grep -nE "C:[/\\\\]|<用户名>|dsh-group-rules-prompt\b" rules.example.md
```

判定线：配置键仍只有 5 个（`enabled/defaultFile/fileByRoom/maxChars/refreshMs`），无第 6 键；example 内**不出现**本机绝对路径、盘符路径、用户名；安装示例仍写 `<克隆目录>`。出现即 FAIL（模板是给新群起的起点，写死本机路径等于把别人的路径带过去）。

### G4 两份 README 的迁移节一一对应

判定线：中英两节的**小节数与顺序一致**、同一步命令/配置键逐字一致、指向的 example 文件名一致。允许译文差异，不允许英文节多出或缺少一步（这是「一一对应」的可机检形式）。

### G5 不动代码、测试仍绿

```bash
git diff --numstat 951c39f -- lib/            # 期望空
git archive <HEAD> | tar -x -C /tmp/qa-ex && cd /tmp/qa-ex && node --test lib/index.test.mjs
```

判定线：本卡 diff 不触碰 `lib/`；从**提交树导出**跑测试 14/14 pass（不在工作区跑，避免被本地未提交状态污染）。

### G6 提交卫生

判定线：`git status --porcelain` 空（除交付物本身）；提交前 `git add` 点名具体文件；提交说明与 diff 一致（不许「docs」里夹代码）；三份文件 `crlf=0`，与仓内既有文件一致。

## 2 不可判与不作数的情形

- example 与 notice 存在**半改冲突**（同一规则两种口径）→ 不判 FAIL，判「需裁决」：列出差异原文与行号交负责人，由人类定哪版为准。
- 拿不到 README 双语中的一份 / example 未入库 → 「无法开判」，写明缺哪件。
- WorkBuddy 自报「已按 notice 全量搬入」而不给映射 → 只采信 QA 实跑，自报值仅用于对账。
- 本卡不验真机加载（卡 2）、不动 notice（卡 3，须主人本人）。

## 3 报告口径

报告落 `.batch/night/reports/rules-example-qa-firstcheck.md`，逐条给：命令原文、关键输出行（含文件:行号）、PASS/FAIL/需裁决＋一句理由；末附 G2 映射表全文。报告首行 `执行方：QA`。

## 4 换版（卡改 .vN）时的复核范围（v3 增补，负责人 11-16 采纳）

卡面因换群等原因另存 `.vN` 时，**已过审的内容项不重验**，QA 只重读三处：
1. 首两行 `From:` / `To:` 是否与新群身份、新群分身 session 前 8 位一致（`To` 仍不写 id）；
2. 卡内指向的比对源（`notice-current-1116.txt`）与派验单路径是否仍有效；
3. 版本纪律：v1 原文是否原封保留、v2 是否只改了首两行（`diff v1 v2` 只允许这两行）。

G1–G6 与映射表要求沿用 v1/v2 的既有判定，不重复核；若 v2 除首两行外还有任何改动，则恢复正常全验。
