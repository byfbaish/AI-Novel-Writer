执行方：QA
`d1-delivered-path-report.md` / 11,467B / `3893ed4ffe310fb09977af06ebf9e9b3` / 145 行
model=未采集（QA 侧不读自身档位） | 倍率=未提供 | provider=未提供（首验方，不适用判据 11/12）

# D-1 首验（QA）· 注入正文指向 delivered 落点

> 判词：**限条件通过（不打回代码）**——14 条中 9 条 PASS、1 条不成立但归因卡面自相矛盾（判据 7）、1 条须补正格式（10a）、1 条部分不成立但归因 relay 机制与执行方会话产物（14）、1 条待追认（12）、1 条不适用（11）。
> 判件基准（项目总负责人 16:42 口径）：名册 **v3.19**｜台账 **v67**；卡面 v5（14,183B / `e8a797f4…` / 117 行）、派验单 v3（8,288B / `a064f4c3…` / 63 行），**分母 14 不动**。
> 取证方式：全部由我在 worktree `C:\develop\workspace\dsh-handoff-relay-wt-d1` 只读复跑，不采信报告自述。
> 版本：v1（首版）。后续改动另存 `.vN`，本文件字节不动。

## 结论

1. **实现本身成立**：`{path}` 已改为 delivered 落点、新增 `{sourcePath}`、兜底行固定追加且只出现一次；`node index.test.mjs` 我在树上实跑 `TOTAL: 182/182 PASS` / `RESULT: PASS`（基线 178，+4）。判据 1–6、8、9、13 全部 PASS。
2. **不打回代码**。未决的 4 项都不是代码错：一条是**卡面自己前后矛盾**（判据 5 要求兜底行追加 → 判据 5 点名复用的 `index.test.mjs:326` 必红，而判据 7 只许判据 6 那条改），一条是**我给判据 14 写的「信号两项并存」与 relay「投完即搬走」机制冲突**，一条是执行方会话目录 `?? .workbuddy/`，一条是报告头行位。
3. **交负责人裁 3 条 + 须补正 1 条**（详见文末「待裁与补正」）。补正成本：报告另存 `.v2` 挪头行，约 2 分钟；其余三条是口径裁定，不需要执行方返工。

## 0. 前置复核（卡面 §0，开工条件，历史时点不可重放）

| 项 | 我的实跑 | 判定 |
|---|---|---|
| `git rev-parse --show-toplevel` | `C:/develop/workspace/dsh-handoff-relay-wt-d1` | 一致 |
| `git branch --show-current` | `d1-delivered-path` | 一致 |
| `git rev-parse --short HEAD` | `a5bd33d`（= 终点提交；起点 `51a87c5` 为其父） | 一致 |
| `git diff --numstat HEAD` / `--ignore-cr-at-eol --stat HEAD` | 双空 | 一致 |
| `status --porcelain=v1` | 仅 `?? .workbuddy/`（18:31 生成，未 add） | 见判据 14；该项属**收工时点**事实，§0 是开工条件，不据此判执行方过错 |
| `git ls-files` 四件 | 四条齐全 | 一致 |

## 1. 判据逐条

### 判据 1 · 同一函数产出路径 — **PASS**

```
551:export function deliveredTargetFor(deliveredRoot, watchDir, relName) {
552-  return path.join(deliveredRoot, dirKeyOf(watchDir), path.basename(relName));
553-}
592:  const target = deliveredTargetFor(deliveredRoot, watchDir, relName);
916:    ? deliveredTargetFor(p.deliveredRoot, p.watchDir, relName)
```
两处调用点所在函数：`takeDelivered` 定义 `index.js:589`（调用点 `:592`）；`buildMessage` 定义 `index.js:912`（调用点 `:916`）。派验单原文写 `:580` / `:897-909`，为**新增代码导致的行号漂移**（+9 / +15），函数归属与派验单一致，不判不符。

### 判据 2 · 默认模板指向 delivered — **PASS**

`index.test.mjs` D1 T1（commit `a5bd33d` 新增）逐条断言：正文逐字含 `deliveredTargetFor(deliveredRoot(), d, relName)` 现算值；`text.split(sourcePath).length - 1 === 1`；含源路径的行以 `取件位置：` 开头；兜底行 `text.split('取件位置：').length - 1 === 1`。我实跑 182/182 PASS，无 `assert.ok(!text.includes(watchDirAbs))` 式负例。

### 判据 3 · 落点真实性 — **PASS**

D1 T2：`assert.doesNotThrow(() => fs.statSync(expected))` + `fs.existsSync(sourcePath) === false`，同一用例内、`await` 一拍后断言；实跑通过。

### 判据 4 · 兜底行两种情形 — **PASS**

① 正常：T1 断言全句 `取件位置：优先 ${expected}；若不存在，退回 ${sourcePath}。`，出现次数 1。
② 失败：T3 在用例内同签名替换 `fs.renameSync` 抛 `EACCES`，`finally` 复原；断言 stdout 含 giveUp 日志且 `relay.log` 同有记录；源仍在、无副本；兜底行次数 1。代码侧日志串在 `index.js:595` `移动已投递文件失败（${stage}，已重试 ${RENAME_RETRIES} 次）`，`RENAME_RETRIES = 3`（`index.js:31`），与断言 `已重试 3 次` 相符。

### 判据 5 · 自定义模板仍生效 — **PASS**

D1 T4 传 `message: 'F={file}|R={reason}|S={size}|M={mtimeMs}|SRC={sourcePath}'`，断言含 `F=…|R=DONE|S=${size}|M=`、含 `SRC=${sourcePath}`、`trimEnd()` 以兜底行结尾、兜底行唯一。`{file}/{reason}/{size}/{mtimeMs}` 语义未变。

### 判据 6 · 就地改既有断言 — **PASS**

`grep -c 'P6 投递文案含文件绝对路径' index.test.mjs` ＝ **1**；该用例（`index.test.mjs:1110-1120`）`endsWith` → `includes`，断言目标改为 `deliveredTargetFor(deliveredRoot(), d, 'abs.txt')`，用例标题与条数未减。

### 判据 7 · 回归三行 — **不成立（归因卡面自相矛盾，不建议据此打回）**

报告三行齐：`N`=182（`TOTAL: 182/182 PASS` / `RESULT: PASS`，我实跑同值）；`N − 178` = 4，四条用例名列全；第三行写明原 178 中有**两处**改了断言，其中 `index.test.mjs:326`（自定义模板那条）卡面未列举。
**矛盾点**：判据 5 明写「复用现有 `:326` 那组模板」且要求兜底行**追加在末尾**；该用例原断言是 `text.endsWith('F=…|M=…')`，兜底行一追加必红。判据 7③ 又只允许判据 6 点名那条改 ⇒ **判据 5 与判据 7 互斥，执行方无论如何都满足不了**。执行方走了唯一能走的路并在报告 §5 列为待裁决项，处置正确。
建议：负责人追认「`:326` 一并允许改 `endsWith`→`includes`」，或把判据 7③ 改成「除判据 5、6 点名的两条外不许变红」。

### 判据 8 · 点名套件 — **PASS**

我在 worktree 根跑 `node index.test.mjs`；未见 `pnpm test:browser`／其它仓套件痕迹。

### 判据 9 · 提交纪律 — **PASS**

`git show --numstat --format='' a5bd33d`：`README.md 1/1`、`README.zh-CN.md 1/1`、`index.js 31/5`、`index.test.mjs 113/4` —— 只有四个点名文件。`git branch -r --contains a5bd33d` 空（未 push）；`git log --oneline -1 master` ＝ `51a87c5`（未合 master）；无 tag/publish 痕迹。

### 判据 10a · 执行方报告头（硬） — **不通过（须补正，数据对、位置错）**

实测报告前三/五行：
```
1: # D-1 执行方报告：注入正文指向 delivered 落点
2: （空行）
3: 执行方：WorkBuddy
4: 输入件：index.js / 74243B / 58025002446275AFB50B7808B5F53FDC
5: model=DeepSeek-V4.1-Flash | 倍率=未提供（宿主不暴露，不臆造） | provider=官方直连
```
卡面 §5／判据 10a 要求：第 1 行 `执行方：…`、第 2 行 = 输入件三元组、第 3 行 = `model=…`。报告多一行标题与一个空行，整体下移 2 行 ⇒ 字面不符。**三元组本身正确**（`index.js` / 74243B / `58025002…` 与卡面一致）。
补正方式（成本最低）：另存 `d1-delivered-path-report.v2.md`，删标题行与空行即可；是否豁免由负责人定。

### 判据 10b · 本首验单头 — **PASS（自钉）**

第 1 行 `执行方：QA`；第 2 行 = 被验报告三元组 `d1-delivered-path-report.md` / 11,467B / `3893ed4ffe310fb09977af06ebf9e9b3` / 145 行；第 3 行 `model=…`。

### 判据 10c · 三元组只作核对 — 不计条数。

### 判据 11 · 档位机检 — **不适用**（执行方为 WorkBuddy，非 DSH 内 Bot；不占分母）。

### 判据 12 · 外部执行方改钉 — **待追认**

`model=DeepSeek-V4.1-Flash` 合规（非 Hy4）；`provider=官方直连`、`倍率=未提供`。卡面要求「倍率高或走官方直连须先经负责人确认」，我在本群留痕里**未找到该确认**。执行方如实写「宿主不暴露，不臆造」，处置正确，不判过错；需负责人补一句确认或追认既往口径即可判 PASS。

### 判据 13 · 文档同步 — **PASS**

```
grep -c '{sourcePath}' README.md          → 1
grep -c '{sourcePath}' README.zh-CN.md    → 1
grep -c '被投递文件的绝对路径' README.zh-CN.md → 0
```
原文：`README.md:335`「`{path}` (absolute path of the delivered copy, i.e. the delivered landing spot), `{sourcePath}` (absolute path of the original file in the watched directory)」；`README.zh-CN.md:247`「`{path}`（投递后副本的绝对路径，即 delivered 落点）、`{sourcePath}`（原文件在监控目录里的绝对路径）」。正例/负例均成立。

### 判据 14 · 产物落点机检 — **部分不成立（归因 relay 机制 + 执行方会话产物）**

| 子项 | 实测 | 判定 |
|---|---|---|
| 报告落 develop 绝对路径 | `…\.batch\night\staging\d1-delivered-path-report.md` 11,467B / `Nov 16 18:32` | 成立 |
| 信号落 `…\signals\workbuddy\…` | 该目录现只有 `.gitkeep`（0B） | **不成立**：relay `takeDelivered` 把信号搬到 `delivered\83e63d6cfdfa\`，源必然不在原位 |
| delivered 副本 | 105B / `Nov 16 18:31` / `bdd596847f4954f1161355f0c4e822a6`，三行：`D-1` / 报告绝对路径 / `<!-- DONE -->` | 成立 |
| `tail -c 13` 最后字节 | `od -c` 输出 `< ! - - D O N E - - >` 共 13 字节，末字节 `>`，其后无换行 | 成立 |
| worktree `status --porcelain` 为空 | 仅 `?? .workbuddy/` | **不成立**：WorkBuddy 会话自身记忆目录，18:31 生成，未 add、不在 §4.9 四件内 |
| worktree 内 `ls -d .batch` | 无输出 | 成立 |

**本条的「两项并存」是我拟派验单时的写法错误**：relay 投递成功即把信号 rename 到 delivered，源文件不可能还在。建议改为「delivered 副本三行齐 + 投出侧 resolved/delivered 留痕」。`?? .workbuddy/` 建议由负责人定：接受为例外，或另开一张改码卡把它写进 `.gitignore`（本卡禁改，不在此处动）。

## 2. 待裁与补正（交项目总负责人）

| # | 项 | 我的建议 | 谁动手 |
|---|---|---|---|
| 1 | 判据 7③ 与判据 5 互斥（`:326` 必红） | 追认 `:326` 一并可改，判据 7 判 PASS；或修订判据 7③ 措辞 | 负责人一句裁定，执行方不动 |
| 2 | 判据 14「信号两项并存」与 relay 机制冲突 | 改为「delivered 副本 + 投出侧留痕」，本条判 PASS | 负责人裁定，我下版派验单改 |
| 3 | `?? .workbuddy/` 导致判据 14 的 porcelain 子项不成立 | 接受为执行方会话产物例外；长期解法另开小卡写 `.gitignore` | 负责人裁 |
| 4 | 判据 12 `provider=官方直连` 无确认留痕 | 负责人补一句追认即 PASS | 负责人 |
| 5 | 判据 10a 头行下移 2 行 | 要求另存报告 `.v2` 挪位（约 2 分钟）；若负责人豁免则 PASS | 联络人转执行方或豁免 |

**若 1–4 按建议裁定、5 补正完成，本卡我判 PASS（14 条：11 PASS / 1 不适用 / 2 按裁定成立）。** 当前状态：**限条件通过，代码不返工**。

## 3. 复跑留痕（可复核）

- `node index.test.mjs`（cwd=worktree 根）→ `TOTAL: 182/182 PASS` / `RESULT: PASS`
- `git show --numstat --format='' a5bd33d` → 四文件行数见判据 9
- `git status --porcelain=v1` → `?? .workbuddy/`
- `ls -l` 报告 / 信号目录 / delivered 副本 → 见判据 14 表
- `md5sum` delivered 副本 → `bdd596847f4954f1161355f0c4e822a6`
