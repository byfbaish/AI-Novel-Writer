From: workbuddy联络人 · AI writer项目组 | 7730f863
To: WorkBuddy · 主身

# WB-01 · `rules.example.md` + 两份 README「从 notice 迁移」节

状态：**待前置**——归属护栏待授权（见 §0 末条），授权后即可投
估时：写文档 30–40 分钟 + 首验 15 分钟
执行方：WorkBuddy；首验方：QA（A 类卡，交件即开判）
类型：**A 类**——会产生仓库提交，必须配派验单

## 0. 工作区前置【硬】

- 工作目录：**`C:\develop\workspace\dsh-group-rules-prompt`**（绝对路径），分支 `master`，起点 HEAD **`951c39f`**。
- **禁在 `C:\develop\workspace\AI-writer\develop` 里改任何文件**；本卡与该仓无关，那边只是判据与草稿的所在。
- 开工第一动作（早于任何写盘）逐条核，任一不符即停手并回执照抄输出：
  1. `git rev-parse --show-toplevel` ＝ `C:/develop/workspace/dsh-group-rules-prompt`（两侧规范化后比较，不做裸字符串相等）。
  2. `git branch --show-current` ＝ `master`。
  3. `git rev-parse --short HEAD` ＝ `951c39f`。
  4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` **双空**，并同时读 `--cached`；三项任一非空即停手。
  5. `git -c core.quotepath=false status --porcelain=v1` 必须完全为空（`??` 白名单留空＝不许有未跟踪项）。
  6. `git ls-files` 应为 7 个文件：`LICENSE`、`README.md`、`README.zh-CN.md`、`cordis.patch.yml`、`lib/index.js`、`lib/index.test.mjs`、`package.json`。
- 环境：本卡不跑 `pnpm install` / `rebuild`；只在收尾按 §4-G5 从提交树导出跑一次 `node --test lib/index.test.mjs`。
- **归属护栏（唯一前置）**：本通道 `checkPinnedCwd` 默认只放行 `C:\develop\workspace\AI-writer\wt-2`，本卡目标仓在 `dsh-group-rules-prompt`，未授权时会 `[refuse]` 退出。**放行方式由负责人书面指定**（一次性 `--force` 或改归属表），未指定前本卡不投。

## 1. 起因与背景

群规则目前只活在群 notice 里，2000 字符上限且改一次全群重读，新群从零起时无处可抄。本卡把这套规则搬成仓内可复用的模板与文档：`rules.example.md` 给新群当起点，两份 README 教「怎么从 notice 迁移到配置文件」。判据与基线由 QA 于 11-16 05:42 实测（`.batch/night/staging/rules-example-acceptance.v2.md`）。

## 2. 要改成什么（唯一口径）

三份文件，一条口径：

1. **新增 `rules.example.md`**（入库）：把现行群 notice 的六块＋「发言」段的每条硬约束，逐条改写为模板正文；不得新增 notice 里没有的口径。
2. **`README.md` 与 `README.zh-CN.md` 各加恰好一节**，标题语义为「从 notice 迁移」/「Migrating from the notice」，小节数与顺序一一对应。

**比对源（唯一）**：`C:\develop\workspace\AI-writer\develop\.batch\night\staging\notice-current-1116.txt`
（3,468B / MD5 `2bea7f8874991666ad37394ccebf232b`；1,504 字符；六块偏移 165/448/614/1108/1259/1437）。
**基准以该文件为准，不以 WorkBuddy 界面或群界面显示为准。**

参考件（**只作参考，不是交付物，不许直接抄进仓**）：
`C:\develop\workspace\AI-writer\develop\.batch\night\staging\dev-draft-rules-example-1116\`
（developer 未提交草稿；必须自己对 notice 现盘逐条核一遍再写。）

## 3. 落点与禁改区【硬】

- 改：`README.md`、`README.zh-CN.md`（各加一节，位置在现有章节之后，不重排既有章节）。
- 增：`rules.example.md`（仓根）。
- **禁改**：`lib/`（任何文件）、`package.json`、`cordis.patch.yml`、`LICENSE`；群 notice 本身（只读、不改）；`C:\develop\workspace\AI-writer\develop` 下任何文件。
- 禁在本仓写死本机绝对路径、盘符、用户名。

## 4. 验收判据【硬】（QA 原文，逐条要能指认文件:行或命令输出）

- **G1 产物齐全且在版本控制内**：`git ls-files rules.example.md` 命中；两份 README 各**恰有一节**迁移说明（`grep -n "从 notice 迁移\|From the notice\|Migrating from"`），不许多节重复。只落盘未 `git add` → FAIL。
- **G2 模板与 notice 逐条对得上（唯一定性判据）**：出**映射表**（notice 块 → 条目 → example 行号 → 判定），六块＋「发言」段逐条落位。两条同时成立：①**无遗漏**（语义不丢，把「同议题每 bot ≤1 次」写成「尽量少说」＝丢失）；②**无新增口径**（每条祈使句都能指回 notice 某行并写出偏移；指不回的列出原文与行号，交负责人裁，**不自行删改**）。
- **G3 不污染配置面、不绑本机**：配置键仍只有 `enabled/defaultFile/fileByRoom/maxChars/refreshMs` 五个，无第 6 键；example 内无本机绝对路径/盘符/用户名（`grep -nE "C:[/\\\\]|伯云飞"` 空）；安装示例仍写 `<克隆目录>`。
- **G4 两份 README 迁移节一一对应**：小节数与顺序一致、同一步命令与配置键逐字一致、指向的 example 文件名一致；允许译文差异，不许英文节多出或缺少一步。
- **G5 不动代码、测试不退化**：本卡 diff 不碰 `lib/`；从**提交树**导出跑 `node --test lib/index.test.mjs` 仍 **14/14 pass、fail 0、skipped 0**。
- **G6 提交纪律**：提交说明与实际 diff 一致；`git add` **点名三个文件**（禁 `-A`）；三份文件 `crlf=0`；`git status --porcelain` 交件后为空。

## 5. 交付物与信号【硬】

1. 仓库里一次提交（报 **提交 SHA**）。
2. 回执三件套：三份文件各自 **字节 / MD5 / mtime**，加 `crlf` 计数。
3. **G2 映射表**（行号对行号）——不附映射表的，QA 不开判。
4. 落盘报告首行 `执行方：WorkBuddy`，第二行 `model= | 倍率= | provider=`，末行 `<!-- DONE -->`。
5. 报告路径：`C:\develop\workspace\AI-writer\develop\.batch\night\reports\wb-rules-example-report.v1.md`。

## 6. 派验单与首验【A 类必填】

- 派验单：`.batch/night/staging/rules-example-acceptance.v2.md`（QA 出，G1–G6＋裁量条款）。
- 首验方：QA；首验结论落 `.batch/night/reports/rules-example-qa-firstcheck.md`。
- 首验 3 条反证要真红：G1 不 `git add` 必须 FAIL；G2 缺映射表必须判「不可判」；G3 写进本机路径必须 FAIL。

## 7. 版本纪律

本卡与报告如需改动，一律另存 `.vN`，不原地覆盖；原文件按当时交付物留档。

## 8. 身份与投递（From/To）【硬】

- 本卡第 1 行为 `From:`、第 2 行为 `To:`，机检只看前两行：
  `sed -n '1p' <本卡> | grep -qE '^From:' && sed -n '2p' <本卡> | grep -qE '^To:'`
- 对外执行方 `To:` 不写 session 前 8 位；真伪只认通道（落盘＋投出侧 resolved/delivered 两条），正文头只作误投核对。
- 派单模型**显式指定** `--model DeepSeek-V4.1-Flash`（禁 Hy4，主人 11-16 全面禁用）。
