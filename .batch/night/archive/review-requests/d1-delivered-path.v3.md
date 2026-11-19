# 派验单 · D-1（注入正文指向 delivered 落点）

- 卡号：`D-1`
- 卡面（被验对象）：**投出版 `.batch/night/cards/d1-delivered-path.v5.md`｜14,183B｜MD5 `e8a797f435f659873fe97bb5d305aba6`｜117 行｜LF（crlf=0）｜无 BOM**；v5 与 v4（`c24ecb09…`）**只有 §5 的 `:98`、`:100` 两行不同**（QA 16:08 自跑：`diff` 单一 hunk `@@ -95,9 +95,9 @@`；`sed '98d;100d'` 两侧 diff 空 ⇒ 其余 115 行逐字节相同，§4 判据段零改动）。**v4 及更早版一律「留档·不采用」，字节不动。**
- 派出人：项目总负责人（14:38 批准批次）｜拟稿：QA
- 执行方：**WorkBuddy**（2026-11-16 **18:00 后**派；周一 14:00–18:00 禁派窗内不投）
- 首验方：QA（A 类卡必填）
- 估时：改码 40 分钟 + 首验 30 分钟
- 状态：**待前置**——等 ① 18:00 后投卡、② 执行方报告落盘、③ 信号 `delivered` 留痕；三者缺一不开判。

## 卡面版本与差异（判据文字以 v3 施工段为唯一口径，被验字节以 v5 为准）

| 版 | 字节 | MD5 | 行 | 差异 |
|---|---|---|---|---|
| v1 | 11,297B | `5fcb27765620391c461194b28ca37cff` | 112 | 原稿（§4 判据 2/4 自相矛盾） |
| v2 | 13,188B | `f6c168e3992ab5236aebd1d50deb0cfb` | 115 | 只改 §4 判据六处（QA 14:37 意见） |
| **v3** | **13,853B** | **`f52a88f1df5ad938f78d9948dae3b3b1`** | **117** | 只加 14:38 三条（见下）；v3 留档不采用 |
| **v4（留档·不采用）** | 13,854B | `c24ecb09a17b3514c647157c7efce752` | 117 | 只填头部 From/To；§5 仍是相对路径、无信号规格 ⇒ **留档·不采用**，字节不动 |
| **v5（投出版·被验对象）** | **14,183B** | **`e8a797f435f659873fe97bb5d305aba6`** | **117** | 只改 §5 两行：`:98` 报告改绝对路径＋「不得写到 cwd 内」；`:100` 补信号绝对路径、三行结构、`<!-- DONE -->` 为最后字节、写完即止不重投。§0–§4 与 v4 逐字节相同（QA 16:08 核：`diff` 单一 hunk `@@ -95,9 +95,9 @@`，`sed '98d;100d'` 两侧 diff 空） |

判据文字按 v3 施工段口径执行（v4/v5 的 §4 与 v3 逐字相同），**被验字节以 v5 为准**：§0 校验时 `md5sum` 须等于 `e8a797f4…`、字节 14,183、行 117；若执行方报 `c24ecb09…`（v4）或 `f52a88f1…`（v3）判「无法开判」并退回改投 v5。

v3 相对 v2 = **施工段零差异**，只 §4 判据三处：
- 判据 1：`grep -n -A2 'deliveredTargetFor' index.js`，**命中原文须贴进报告**，并逐条指函数名＋行号；「数 ≥3 处」不算通过（注释、导出行会被数进去）。
- 判据 4：**兜底行 `取件位置：` 在正文中只许出现一次**，①②两种情形都断言 `text.split('取件位置：').length - 1 === 1`。
- 判据 10c：输入件三元组**只作核对**，不计判据条数、不单独算通过项。

## 判据（14 条，逐条须能指认；原文见卡面 §4，第 14 条为 QA 16:05 补、负责人已批）

1. **同一函数产出路径**：`deliveredTargetFor` 存在，两处调用点分别在 `takeDelivered`（`:580`）与 `buildMessage`（`:897-909`）函数体内（附 `grep -n -A2` 原文）。
2. **默认模板指向 delivered**：临时 watchDir/deliveredRoot 投 `<!-- DONE -->` 件，断言正文逐字含函数算出的 `path.join` 结果；**源路径在正文只出现一次，且该行以 `取件位置：` 开头**（`text.split(sourcePath).length - 1 === 1`）；**禁**写 `!text.includes(watchDirAbs)`。
3. **落点真实性**：`await` 一拍后 `fs.statSync(deliveredTargetFor(...))` 成功、`fs.existsSync(sourcePath)` 为 false。
4. **兜底行两种情形**：①搬家成功后有 `取件位置：优先 …；若不存在，退回 …`；②搬家失败**只许**在用例内替换 `fs.renameSync` 抛 `EACCES`、断言 `giveUp` 日志、`finally` 复原；且 `取件位置：` 只出现一次。
5. **自定义模板仍生效**：`cfg.message = 'F={file}|R={reason}|S={size}|M={mtimeMs}'` 照旧成立，兜底行仍追加末尾；另断言 `{sourcePath}` 能替换。
6. **就地改既有断言**：`index.test.mjs:1112` 的 `endsWith(...)` 改 `includes(...)`，断言目标改 delivered 落点；`grep -c 'P6 投递文案含文件绝对路径' index.test.mjs` ＝ 1，`TOTAL` 不减。
7. **回归**：`node index.test.mjs` → `TOTAL: <N>/<N> PASS` 且 `RESULT: PASS`；基线 **178**，须写三行：`N`／`N − 178` 并**逐条列出新增用例名**／原 178 条仅判据 6 点名那条可变，其余不许变红。
8. **点名套件**：`node index.test.mjs`（worktree 根）；禁 `pnpm test:browser`、禁其它仓套件。
9. **提交纪律**：一次 `git add` 只点名 `index.js`、`index.test.mjs`、`README.md`、`README.zh-CN.md`；**禁 push／tag／publish／合入 master**。
10. **两个头各钉各的件**：10a 执行方报告第 2 行＝本卡输入件三元组（`index.js` / 74243B / `58025002446275AFB50B7808B5F53FDC`）、第 3 行 `model= | 倍率= | provider=`；10b QA 首验单第 2 行＝**它验收的报告**三元组；10c 只作核对，不计条数。
11. **档位机检**：执行方为 DSH 内 Bot 时 `provider=` 须命中 `^magpie/group/`。**本卡执行方是 WorkBuddy，本条不适用**。
12. **外部执行方改钉**：`model=<模型名> | 倍率=<倍率> | provider=<官方直连/自有>`；倍率高或走官方直连须先经负责人确认（DeepSeek-V4.1-Flash，禁 Hy4）。
13. **文档同步**：`grep -c '{sourcePath}'` 在 `README.md` 与 `README.zh-CN.md` 均 ≥1（改前基线 0）；负例：`README.zh-CN.md` 中 `{path}` 那格不得再写「被投递文件的绝对路径」。
14. **产物落点机检（QA 16:05 补，卡面 v5 §5）**：报告实际落在 `C:\develop\workspace\AI-writer\develop\.batch\night\staging\d1-delivered-path-report.md`、信号落在 `…\night\signals\workbuddy\d1-delivered-path.signal`（均为绝对路径，须 `ls -l` 两项并存且时间戳在投卡之后）；**且** worktree `C:\develop\workspace\dsh-handoff-relay-wt-d1` 内 `git status --porcelain` 为空、`ls -d .batch 2>/dev/null` 无输出——执行方不得在 cwd 内建 `.batch` 或把产物写进 worktree。信号 `<!-- DONE -->` 必须是文件最后字节（`tail -c 13` 逐字比对），其后不得有空行。

**分母口径**：14 条计入分母；10c 不计；第 11 条不适用（不占分母、单列「不适用」）。有一次可原谅失败：判据 6 的断言改写是**要求**，不是豁免项。

## 开判前置（QA 自己复跑，不采信报告自述）

卡面 §0 六项在 worktree `C:\develop\workspace\dsh-handoff-relay-wt-d1`（分支 `d1-delivered-path`，起点 `51a87c5`）逐条核：`rev-parse --show-toplevel` / `branch --show-current` / `--short HEAD` / `git diff --numstat HEAD` 与 `--ignore-cr-at-eol --stat` 双空 / `status --porcelain=v1` 首列无 `M/A/D/R/U` 且 `??` 白名单为空 / `git ls-files index.js index.test.mjs README.md README.zh-CN.md` 四条齐全。任一不符 ⇒ **判「无法开判」**并回执照抄输出，不当执行方过错。

## 产物与留痕

- 执行方报告（绝对路径）：`C:\develop\workspace\AI-writer\develop\.batch\night\staging\d1-delivered-path-report.md`（末行 `<!-- DONE -->`，含起点/终点 HEAD、`--numstat`、`TOTAL:`/`RESULT:` 原文）
- 信号（绝对路径）：`C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy\d1-delivered-path.signal`，三行＝卡号 / 回执路径 / `<!-- DONE -->`（为最后字节）；投出侧须有 `resolved` + `delivered` 两条留痕。**注：v2 本行误写 `signals/doubao/D-1.done`，与卡面 v5 冲突，v3 已改正。**
- 首验单：`.batch/night/reports/d1-delivered-path-qa-firstcheck.md`，首行 `执行方：QA`
- G1 机检：本单 `执行方：WorkBuddy` ≠ 首验单 `执行方：QA`

## 红线

1. 禁在真身仓 `C:\develop\workspace\dsh-handoff-relay` 改码（运行中的 DSH 正用那份）。
2. 禁 `pnpm install`／`rebuild`／`dev`（切 ABI 打断其它槽位）；**禁重启 DSH、禁改 profile**。
3. 本卡出不了「已生效」结论：插件代码下次启动才加载，实投验证另开卡且须在重启之后。
4. 判不了写「判不了 + 缺什么」，不猜。
