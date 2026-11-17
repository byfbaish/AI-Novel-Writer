# D-1 执行方报告：注入正文指向 delivered 落点

执行方：WorkBuddy
输入件：index.js / 74243B / 58025002446275AFB50B7808B5F53FDC（1588 行，实测 MD5 小写 58025002446275afb50b7808b5f53fdc，与卡面一致）
model=DeepSeek-V4.1-Flash | 倍率=未提供（宿主不暴露，不臆造） | provider=官方直连

## 0. 工作区前置核对（开工第一动作，全部通过）

工作目录 `C:/develop/workspace/dsh-handoff-relay-wt-d1`，逐条实测：

1. `git rev-parse --show-toplevel` → `C:/develop/workspace/dsh-handoff-relay-wt-d1`（与期望规范化后相等）✓
2. `git branch --show-current` → `d1-delivered-path` ✓
3. `git rev-parse --short HEAD` → `51a87c5` ✓
4. `git diff --numstat HEAD` 空；`git diff --ignore-cr-at-eol --stat HEAD` 空；`git diff --cached --numstat` 空 ✓
5. `git -c core.quotepath=false status --porcelain=v1` 空（无 M/A/D/R/U，`??` 白名单为空）✓
6. `git ls-files index.js index.test.mjs README.md README.zh-CN.md` 四条齐全 ✓

未在 `C:\develop\workspace\dsh-handoff-relay` 真身仓改码；未 `pnpm install/rebuild/dev`；未重启 DSH、未动 profile。

> 补充：上述六项是**开工第一动作、早于任何写盘**时跑的，全绿。收工时工作树内新增一条 `?? .workbuddy/`（WorkBuddy 会话自身的记忆文件，非本卡产物、不在 §4.9 的四个点名文件里、未 `git add`）。QA 复跑 §0 若见这一条，请按“执行方会话数据”排除，不构成 `??` 白名单违规。

改前基线：`node index.test.mjs` → `TOTAL: 178/178 PASS` / `RESULT: PASS`（本机实测，与卡面出具日基线一致）。

## 1. 改了什么

- 新增 `deliveredTargetFor(deliveredRoot, watchDir, relName)`（`index.js:545-553`，导出供测试现算期望值），实现 `path.join(deliveredRoot, dirKeyOf(watchDir), path.basename(relName))`。
- `takeDelivered`（`index.js:589`）内 `index.js:592` 改调该函数，`dirKey` 仍保留供 failed.json 记录。
- `buildMessage`（`index.js:912`）新增第 7 个入参 `paths = { sourcePath, deliveredRoot, watchDir }`：`{path}` 替换值为 delivered 落点（由 `deliveredTargetFor` 现算），新增 `{sourcePath}` ＝ 源路径；`{file}/{reason}/{size}/{mtimeMs}` 不变；`DEFAULT_MESSAGE`（`:18`）字面未动。
- 正文末尾固定追加 `取件位置：优先 <deliveredPath>；若不存在，退回 <sourcePath>。`（身份头之后、模板文本之后，不受自定义 `message` 影响）。
- 调用点 `index.js:1345-1347` 传 `{ sourcePath: full, deliveredRoot, watchDir }`。
- 文档：`README.md:335`、`README.zh-CN.md:247` 模板变量表补 `{sourcePath}`，`{path}` 改为「delivered 落点」口径。
- 测试：新增 4 条（D1 T1/T2/T3/T4），改 2 条既有断言的定位方式（见 §5 待裁决项）。

落点一致性：注入正文与真实搬移由**同一函数**产出路径，`queueMicrotask(takeDelivered)`（`index.js:1369`）时序未动，`dirKeyOf`、`dedupeVerdict`、`deliver()` 判定顺序、`buildIdentityHead`、`resolveFromText`、`resolveNow` 均未动。

## 2. 判据逐条指认

**判据 1 — 同一函数产出路径**：`grep -n -A2 'deliveredTargetFor' index.js` 原文：

```
551:export function deliveredTargetFor(deliveredRoot, watchDir, relName) {
552-  return path.join(deliveredRoot, dirKeyOf(watchDir), path.basename(relName));
553-}
--
592:  const target = deliveredTargetFor(deliveredRoot, watchDir, relName);
593-  const errText = (err) => String(err);
594-  const giveUp = (stage, err) => {
--
910: * paths = { sourcePath, deliveredRoot, watchDir }；落点一律经 deliveredTargetFor 产出。
911- */
912-function buildMessage(relName, fullPath, state, reason, template, identity, paths) {
```

逐条归类：`551` 为定义/导出行（非调用点）；`592` 在 `takeDelivered`（`:589`）函数体内；`916`（下一段命中）在 `buildMessage`（`:912`）函数体内 —— 见下方第二段原文：

```
916:    ? deliveredTargetFor(p.deliveredRoot, p.watchDir, relName)
917-    : sourcePath;
918-  const text = template.replaceAll('{file}', relName).replaceAll('{path}', deliveredPath)
...
910-911 为 buildMessage 的文档注释，非调用点。
```

两处调用点分别落在 `takeDelivered`（`:592`）与 `buildMessage`（`:916`）体内 ✓。

**判据 2 — 默认模板指向 delivered**：用例 `D1 T1`。`expected = deliveredTargetFor(deliveredRoot(), d, relName)` 现算，断言 `text.includes('文件 ' + expected + ' 已就绪（触发=DONE），请继续。')`；源路径计数 `text.split(sourcePath).length - 1 === 1`；含源路径的那一行以 `取件位置：` 开头。未使用 `!text.includes(watchDirAbs)`。

**判据 3 — 落点真实性**：用例 `D1 T2`，同一投递 `await` 后 `fs.statSync(expected)` 成功、`fs.existsSync(sourcePath) === false`。

**判据 4 — 兜底行两种情形**：
① `D1 T1` 断言正文含整行 `取件位置：优先 <expected>；若不存在，退回 <sourcePath>。`；
② `D1 T3` 唯一注入法：用例内替换 `fs.renameSync` 为抛 `EACCES` 的同签名函数，`await sleep(500)` 后复原（`finally`）。断言 stdout 捕获里出现 giveUp 分支日志（原文见 §3）、`relay.log` 同文、正文仍同屏两条路径、源文件仍在源目录、目标副本不存在。
两情形均断言 `text.split('取件位置：').length - 1 === 1`（只许出现一次）。

**判据 5 — 自定义模板仍生效**：用例 `D1 T4`，`cfg.message = 'F={file}|R={reason}|S={size}|M={mtimeMs}|SRC={sourcePath}'`，断言模板段成立、`SRC=<源路径>` 替换成功、`trimEnd().endsWith('取件位置：优先 …；若不存在，退回 …。')`、兜底行唯一。

**判据 6 — 就地改既有断言**：`index.test.mjs:1112`（原文行号）的 `endsWith` 改为 `includes`，断言目标改为 `deliveredTargetFor` 现算的 delivered 落点；用例标题未改，`grep -c 'P6 投递文案含文件绝对路径' index.test.mjs` → `1`；条数未减。

**判据 7 — 回归（分母分开）**：见 §4。

**判据 8 — 点名套件**：仅 `node index.test.mjs`（worktree 根）；未跑 `pnpm test:browser` 或其它仓套件。

**判据 9 — 提交纪律**：一次 `git add` 只点名 `index.js`、`index.test.mjs`、`README.md`、`README.zh-CN.md`；未 push／tag／publish／合入 master（本分支 `d1-delivered-path` 原地提交）。

**判据 10 — 两个头各钉各的件**：10a 本报告第 2 行为本卡输入件三元组（见页首）；10c 三元组仅作核对，不计判据条数。

**判据 11 — 不适用**：执行方为 WorkBuddy，非 DSH 内 Bot。

**判据 12 — 外部执行方档位**：本报告第 3 行已钉 `model=… | 倍率=… | provider=官方直连`；备注明细见「待裁决项 3」。

**判据 13 — 文档同步机检**：`grep -c '{sourcePath}' README.md` → `1`，`grep -c '{sourcePath}' README.zh-CN.md` → `1`（改前基线均 `0`）；负例 `grep -c '被投递文件的绝对路径' README.zh-CN.md` → `0`，该格现写「投递后副本的绝对路径，即 delivered 落点」。

## 3. 关键输出原文

`grep -n "移动已投递文件失败" <测试输出>`（D1 T3 的 giveUp 分支日志，经 ctx.logger.warn 直通 stdout）：

```
[dsh-handoff-relay] watches[0] 移动已投递文件失败（rename，已重试 3 次）：Error: EACCES: 模拟搬家失败（file=…\d1-t3.md，target=…\delivered\588dc71554e4\d1-t3.md）
```

`git diff --numstat HEAD`（提交前）：

```
1	1	README.md
1	1	README.zh-CN.md
31	5	index.js
113	4	index.test.mjs
```

起点 HEAD：`51a87c5417c61372210c14c1c362b8830e1621e7`（51a87c5）
终点 HEAD：`a5bd33d9acd8b0689b192e74bbabe10aaf959e68`（a5bd33d，分支 d1-delivered-path）
提交后 `git status --porcelain=v1` 为空。

## 4. 判据 7 三行

1. `N` ＝ **182**：`node index.test.mjs` → `TOTAL: 182/182 PASS` / `RESULT: PASS`（182 条 `PASS` 行，无 `FAIL`）。
2. 新增用例 `N − 178` ＝ **4**，逐条列名：
   - `D1 T1 默认模板 {path} 指向 delivered 落点，源路径只在「取件位置：」那一行出现一次`
   - `D1 T2 落点真实性：正文给的路径 stat 得到，源文件已不在源目录`
   - `D1 T3 搬家失败：giveUp 分支日志出现在 stdout，正文仍同屏两条路径且兜底行唯一`
   - `D1 T4 自定义模板照旧生效，{sourcePath} 可替换，兜底行仍追加在末尾`
3. 原 178 条里变红的只有两处，且都是断言定位方式改动、用例标题与语义均未变：判据 6 点名的 `P6 投递文案含文件绝对路径（默认模板 {path}）`；**另一处为卡面未列举的 `自定义 message 模板替换 {file}/{reason}/{size}/{mtimeMs}`（`index.test.mjs:326`）**，详见待裁决项 1。其余 176 条断言未变、全绿。

## 5. 待裁决项（执行中发现的卡面问题，均不阻塞交付）

1. **判据 6/7 漏列一条必红用例**：`index.test.mjs:326` 原为 `text.endsWith('F=tpl.txt|R=DONE|S=…|M=…')`。判据 3 要求兜底行**追加在模板文本之后**，故该 `endsWith` 必然永远不成立，与判据 5「兜底行仍追加在末尾」在同一用例内自相矛盾。处置：与 `:1112` 同一处理口径（`endsWith` → `includes`），标题与条数不变。若 QA 认定此举越权，请回退该行并另行裁定。
2. **判据 1 与 §2.2 的入参建议不一致**：§2.2 建议 `paths = { sourcePath, deliveredPath }`，但若在调用点先算好 `deliveredPath` 再传入，`buildMessage` 体内就不会出现 `deliveredTargetFor` 调用点，与判据 1「两处调用点分别在 `takeDelivered`／`buildMessage` 体内」直接冲突。处置：按判据 1（硬验收）执行，`paths` 传 `{ sourcePath, deliveredRoot, watchDir }`，由 `buildMessage` 内部调 `deliveredTargetFor` 现算；「禁两处各算一遍」仍满足（两处共用同一函数）。
3. **判据 12 的「倍率」无实际值可填**：WorkBuddy 宿主不暴露倍率，按「不确定不臆造」写「未提供」。provider 为官方直连，按判据 12 须先经负责人确认——本次已如实标注，请负责人追认或改判。
4. 本卡不产生「已生效」结论：代码改动在 DSH 下次启动时加载，重启归主人；实投验证另开卡且须在重启之后。
5. **信号路径两处口径冲突**：卡面 §5 写 `signals\workbuddy\d1-delivered-path.signal`（3 行、`<!-- DONE -->` 为末字节），已存在的派验单写 `signals/doubao/D-1.done`（且属另一执行方目录）。本次按卡面 §5 落盘，未造第二份别名件，未覆盖既有派验单（其第 4–9、48–51 行属 QA 稿件，执行方无权改）。请负责人裁定以哪份为准。
6. 报告头第 3 行的 `model=DeepSeek-V4.1-Flash` 取自派验单判据 12 的括注与本次会话实际档位；`倍率` 无值可填，仍待负责人追认。

## 6. 测试输出原文（首尾）

```
PASS  D1 T1 默认模板 {path} 指向 delivered 落点，源路径只在「取件位置：」那一行出现一次
PASS  D1 T2 落点真实性：正文给的路径 stat 得到，源文件已不在源目录
PASS  D1 T3 搬家失败：giveUp 分支日志出现在 stdout，正文仍同屏两条路径且兜底行唯一
PASS  D1 T4 自定义模板照旧生效，{sourcePath} 可替换，兜底行仍追加在末尾
…
TOTAL: 182/182 PASS
RESULT: PASS
```

<!-- DONE -->
