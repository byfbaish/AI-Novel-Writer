From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: WorkBuddy · AI writer项目组 · 群分身

# D-1 注入正文指向 delivered 落点（改码卡 · v3 定稿 · 待派）

> 定稿状态：**未投放**。批次已由项目总负责人批准（14:38），执行方＝WorkBuddy，**18:00 后派**（周一 14:00–18:00 为禁派窗）。第 1–2 行 To 与 id 在派卡那刻再填。
> 执行方若为 WorkBuddy／豆包，第 2 行改形态 B（`To: <角色> · AI writer项目组 · 群分身`，不写 session 前 8 位）。
> **v3 相对 v2 只加项目总负责人 14:38 的三条**：判据 1 改 `grep -n -A2` 并附原文；判据 4 补「兜底行只许出现一次」断言；判据 10 注明三元组只作核对、不计判据条数。其余逐字同 v2。
> **v2 相对 v1 只改 §4 判据六处 + 本行说明**（按 QA 14:37 复核意见）：判据 1 改为「两处调用点分别在 `takeDelivered`／`buildMessage` 体内」；判据 2 负例改「源路径只出现一次且落在兜底行内」（原 `!includes(watchDirAbs)` 与判据 4① 自相矛盾）；判据 4② 钉死单一失败注入法（替换 `fs.renameSync` + 断言 `giveUp` 日志，`finally` 复原）；判据 6 `endsWith`→`includes`；判据 7 分母分开（`N − 178` 须列名）；判据 10 拆成 10a 执行方报告头／10b QA 首验单头。其余条款、§0、§5、§6 与 v1 逐字相同。

状态：**待前置**——① 项目总负责人审批次；② 主人点头；解除判据＝本卡进入批次且 §0 三项校验通过。
估时：改码 40 分钟 + 首验 30 分钟
执行方：WorkBuddy（2026-11-16 18:00 后派；禁派窗内不投）；首验方：QA（A 类卡必填）
类型：**A 类**——会产生仓库提交，必须配派验单

## 0. 工作区前置【硬】

- 工作目录：**`C:\develop\workspace\dsh-handoff-relay-wt-d1`**（新建 worktree），分支 `d1-delivered-path`，起点 HEAD **`51a87c5`**（`51a87c5417c61372210c14c1c362b8830e1621e7`，master）。
- **禁在 `C:\develop\workspace\dsh-handoff-relay` 里改码**：那是插件真身，`C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\dsh-handoff-relay` 是指向它的 junction，运行中的 DSH 正在用这份文件。
- 建 worktree 的命令（在真身仓内执行，只加工作树、不动 master）：
  `git -C C:\develop\workspace\dsh-handoff-relay worktree add -b d1-delivered-path C:\develop\workspace\dsh-handoff-relay-wt-d1 51a87c5`
- 开工第一动作（早于任何写盘）逐条核，任一不符即停手、回执照抄实质输出：
  1. `git rev-parse --show-toplevel` ＝ `C:/develop/workspace/dsh-handoff-relay-wt-d1`（两侧规范化后比较）。
  2. `git branch --show-current` ＝ `d1-delivered-path`。
  3. `git rev-parse --short HEAD` ＝ `51a87c5`。
  4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` 双空；`git diff --cached --numstat` 也须为空。
  5. `git -c core.quotepath=false status --porcelain=v1` 无 `M/A/D/R/U` 首列；`??` 白名单**为空**。
  6. 目标文件存在：`git ls-files index.js index.test.mjs README.md README.zh-CN.md` 四条齐全。
- 环境约束：本仓测试**不依赖 node_modules**（`node index.test.mjs` 用系统 node，本机基线已跑通）。**禁 `pnpm install` / `pnpm rebuild` / `pnpm dev`**（切 ABI 会打断别的槽位）；**禁重启 DSH、禁改 DSH profile**。

## 1. 起因与背景

12:08:18Z 第 7 条自投验通时，接收会话按注入正文给的路径去取件，`tool/result` 原文为：

```
cat: /c/develop/workspace/AI-writer/develop/.batch/night/bridge/to-plugin-group/selftest-7th-watch-1116.md: No such file or directory
```

成因（两级证据都在 relay 自己身上）：
- 正文路径由 `index.js:18` 默认模板 `'文件 {path} 已就绪（触发={reason}），请继续。'` 经 `buildMessage`（`index.js:897-909`）的 `.replaceAll('{path}', fullPath)`（`:898`）填入，`fullPath` 是**源目录**路径。
- 注入调用 `agent.followup(message)`（`index.js:1326`）之后，`queueMicrotask`（`:1343`）立刻跑 `takeDelivered()`（`:580-583`），把文件 `rename` 到 `path.join(deliveredRoot, dirKeyOf(watchDir), basename)`。
- 于是接收端按正文读必然 ENOENT；文件其实在 `delivered\<watchDir sha1 前12位>\<文件名>`。

另据文档口径，这是**代码与文档不一致**，不是单纯文案问题：`README.md:335` 与 `README.zh-CN.md:247` 都写 `{path}` ＝「absolute path of the delivered file / 被投递文件的绝对路径」。当前实现给的是源路径。

裁定（项目总负责人 14:12）：记为 D-1，本线不热改，改法归本卡。

## 2. 要改成什么（唯一口径）

四条一起改，缺一条判不通过：

1. **抽出唯一落点函数**：新增 `function deliveredTargetFor(deliveredRoot, watchDir, relName)`，实现即现有 `:582-583` 两行的等价式
   `path.join(deliveredRoot, dirKeyOf(watchDir), path.basename(relName))`；
   `takeDelivered()`（`:580`）内部改用该函数，**注入正文与真实搬移必须由同一函数产出路径**（禁在两处各算一遍）。
2. **`{path}` 语义对齐文档**：`buildMessage`（`:897-909`）里 `{path}` 替换值改为 **delivered 落点**（即 `deliveredTargetFor(...)` 的结果）；新增 `{sourcePath}` ＝ 原源路径。`{file}`／`{reason}`／`{size}`／`{mtimeMs}` 行为不变。
   - `buildMessage` 增加一个入参（建议 `paths = { sourcePath, deliveredPath }`），调用点 `:1319` 传入；`DEFAULT_MESSAGE`（`:18`）**字面不动**。
3. **模板无关的固定兜底行**：正文末尾（身份头之后、模板文本之后）固定追加一行，不受自定义 `message` 模板影响：
   `取件位置：优先 <deliveredPath>；若不存在，退回 <sourcePath>。`
   —— 这一行同时覆盖两种真实情形：搬家成功（件在 delivered）与搬家失败/旧件（件仍在源目录）。
4. **文档同步**：`README.md:335` 与 `README.zh-CN.md:247` 的模板变量表补 `{sourcePath}`，并把 `{path}` 描述改成「投递后副本的绝对路径（delivered 落点）」。

## 3. 落点与禁改区【硬】

- 改：`index.js:18`（仅注释或不动字面）、`index.js:580-583`（改调 `deliveredTargetFor`）、`index.js:897-909`（`buildMessage`）、`index.js:1319`（传参与兜底行）、**新增** `deliveredTargetFor`（放在 `:542-543` `deliveredDirFor` 之后）
- 补：`index.test.mjs`（新增/改动用例，见 §4）
- 文档：`README.md:335`、`README.zh-CN.md:247`
- **禁改**：
  - `cordis.patch.yml`、`client.js`（本卡不涉设置卡）
  - 去重判据 `dedupeVerdict`（`index.js:472-491`）与 `deliver()` 的判定顺序（`:1283-1287`）
  - 身份头 `buildIdentityHead`（`:888-895`）、`resolveFromText`（`:873`）、`resolveNow`（`:1241`）
  - `dirKeyOf`（`:281-284`）——`delivered\` 目录名仍按 watch 目录 sha1 前 12 位
  - `index.js:1343` 的 `queueMicrotask(takeDelivered)` 时序（**不得**改成先搬后注入，那会改变既有投递归属证据链）
  - 本仓之外的一切：DSH profile、`node_modules` junction、任何仓外临时目录

## 4. 验收判据【硬】

每条必须能指认（文件:行 或 命令输出），缺一条即不通过：

1. **同一函数产出路径**：`deliveredTargetFor` 存在且**两处调用点分别落在 `takeDelivered` 与 `buildMessage` 函数体内**（`grep -n -A2 'deliveredTargetFor' index.js`，**须把命中原文贴进报告**并逐条指出所在函数名与行号；只数 ≥3 处不算通过——注释与导出行也会被数进去）。
2. **默认模板指向 delivered**：新用例——临时 watchDir/deliveredRoot 投一个 `<!-- DONE -->` 件，断言注入正文**逐字含** `deliveredTargetFor(deliveredRoot, watchDir, relName)` 的 `path.join` 结果（`assert.ok(text.includes(expected))`，`expected` 由函数算，不许手写字符串），且**源路径在正文中只出现一次、且该次出现落在以 `取件位置：` 开头的那一行内**（`assert.equal(text.split(sourcePath).length - 1, 1)`，并断言含该路径的那一行以 `取件位置：` 开头）——**不要写 `assert.ok(!text.includes(watchDirAbs))`**：兜底行必含源路径，该式必然红，v1 判据 2/4 自相矛盾即此。
3. **落点真实性**：同一用例里 `await` 一拍后 `fs.statSync(deliveredTargetFor(...))` 成功、`fs.existsSync(sourcePath)` 为 false —— 证明正文给的是真实可读位置，不是又一处算出来的字符串。
4. **兜底行两种情形都在**：① 正常搬家后正文含 `取件位置：优先 …；若不存在，退回 …`；② 搬家失败情形**只许用这一种注入法**——在用例内替换 `fs.renameSync` 为「抛 `EACCES`」的同签名函数，`await` 一拍后断言 stdout 里出现 `giveUp` 分支日志（`index.js:580-583` 那段），且正文仍同屏给出两条路径。**禁止**在 `queueMicrotask`（`:1343`）之外 monkeypatch 后期待进程崩溃；用例必须是断言失败／通过，不是异常中断。替换完须在 `finally` 里复原原函数。另：**兜底行 `取件位置：` 在正文中只许出现一次**，①②两种情形都要断言 `assert.equal(text.split('取件位置：').length - 1, 1)`。
5. **自定义模板仍生效**：`cfg.message` 传 `'F={file}|R={reason}|S={size}|M={mtimeMs}'`（复用现有 `:326` 那组模板）时，该段照旧成立，且兜底行仍追加在末尾；另加一条断言 `{sourcePath}` 能替换出源路径。
6. **必须就地改的既有断言（不是删用例）**：`index.test.mjs:1112` 的 `endsWith('文件 ${f} 已就绪（触发=DONE），请继续。')` 在 `{path}` 改成 delivered 且追加兜底行后必红——**改为 `includes(...)`**（正文首段仍是默认模板句，只是后面多了兜底行，故 `endsWith` 永远不成立），断言目标改成 delivered 落点；**用例标题与条数不变**：`grep -c 'P6 投递文案含文件绝对路径' index.test.mjs` ＝ 1，且 `TOTAL` 不因这条减少。
7. **回归（分母分开报）**：`node index.test.mjs` 结果 `TOTAL: <N>/<N> PASS` 且 `RESULT: PASS`。基线 `178`，改后 `N ≥ 178`；报告须写三行：① `N`；② 新增用例条数 `N − 178` 并**逐条列出用例名**；③ 原 178 条里仅第 6 项点名那条允许改断言，**其余一条不许变红**。判词须附改前基线（本卡出具日实测 `TOTAL: 178/178 PASS`）。
8. 点名套件：`node index.test.mjs`（在 worktree 根执行）；禁 `pnpm test:browser`／禁全量其它仓套件。
9. 提交纪律：一次 `git add` 只点名 `index.js`、`index.test.mjs`、`README.md`、`README.zh-CN.md`；**禁 push／tag／publish／合入 master**（合入与发版另裁）。
10. **两个头各钉各的件（按模板 §5，13:11 收口，不追溯）**：
    - 10a 执行方报告头：第 2 行＝**本卡输入件**三元组 `index.js` / `74243B` / `58025002446275AFB50B7808B5F53FDC`；第 3 行＝`model=… | 倍率=… | provider=…`。
    - 10b QA 首验单头：第 2 行＝**它验收的报告**三元组（`d1-delivered-path-report.md` 的字节数 / MD5 / 行数），不是 `index.js` 的三元组。
    - 10c 三元组只作**核对**用，不计入判据条数、也不单独算一条通过项。
11. **档位机检（执行方为 DSH 内 Bot 时）**：报告正文第二行钉 `provider=<实际值>`，须命中 `^magpie/group/`，出现 `deepseek-official`／`deepseek-account` 直连判不通过。
12. **外部执行方（WorkBuddy／豆包）不适用第 11 条**：改钉 `model=<模型名> | 倍率=<倍率> | provider=<官方直连/自有>`；倍率高或走官方直连须先经负责人确认。
13. **正例机检（文档同步）**：`grep -c '{sourcePath}' README.zh-CN.md` ≥1 且 `README.md` ≥1（改前基线 0）；负例：`README.zh-CN.md` 中 `{path}` 那一格不得再写「被投递文件的绝对路径」，须写成 delivered 落点。

## 5. 交付物与信号【硬】

- 报告：`.batch/night/staging/d1-delivered-path-report.md`，末行 `<!-- DONE -->`，写明起点 HEAD、终点 HEAD、`--numstat`、`node index.test.mjs` 输出原文（含 `TOTAL:` 与 `RESULT:` 两行）。
- **报告头三行定式**（模板 §5）：第 1 行 `执行方：<名字>`；第 2 行取数件三元组（本卡输入件 `index.js` 74243B / `58025002…`）；第 3 行 `model=… | 倍率=… | provider=…`。
- 信号文件正文只写三行：卡号 / 回执路径 / `<!-- DONE -->`。
- **本卡不产生「已生效」结论**：插件代码改动在 DSH 下次启动时才被加载，重启归主人；本卡只交仓库提交与测试证据。实投验证（真投一件、看接收端能否按正文读到）另开一张卡，且必须等重启之后。

## 6. 派验单与首验【A 类必填】

- 派验单：`.batch/night/review-requests/d1-delivered-path.md`
- 首验单：`.batch/night/reports/d1-delivered-path-qa-firstcheck.md`
- G1 机检：派验单 `执行方：<执行方>` 与首验单 `执行方：QA` 取值不相等。

## 7. 版本纪律

- 卡面改动另存 `.vN.md`；投出版与现行版两行并记哈希；差异只在溯源段时标注「施工段零差异」。

## 8. 身份与投递（From/To）【硬】

- 本卡产出的卡面与信号走**形态 B**（投外部执行方时）：`To:` 只写角色·群名·群分身，**不写 session 前 8 位**。
- 若执行方是 DSH 内 Bot，卡面走**形态 A**：`To: <角色> · AI writer项目组 | <session 前 8 位> | 群分身`。
- 投出侧须有 `resolved` + `delivered` 两条留痕（CLI 直投按三件套）；接收侧先核 `To` 与本会话身份一致、`From` 在已知清单内，否则按可疑件只在群里报项目管家。
