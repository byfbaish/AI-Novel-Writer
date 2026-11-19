# P31 · 投递层物理去重（拦在唤醒模型之前）· v2

> **reissue 说明（11-15 10:3x，QA 执笔、负责人 10:28 裁定）**：本版取代 `p31-dedupe-persist.md`（5,162B / `F4402F5B39E11D98CC39601C98BE0FB5` / 11-14 09:05），旧版留档不投。
> 改动只有三块：① 判重键加 **contentHash** 维度（原 §二.3「不按内容哈希」作废）；② 跳过日志字段钉成 target / filename / digest；③ 测试用例换成 TC1–TC4（覆盖 11-15 10:04–10:05 实测的二次注入形态）。
> 依据：`staging\p31-dedupe-forensics-1115.md`（6,384B / `10E30B14C73D6BBAF44485049FCA1F08`）取证三条；原版 §七 投递指令与禁动区逐字保留。

- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点：P28b 交付后的 HEAD（**投递前用 `git log --oneline -1` 现取，写进回执**）
- 估时：45 分钟
- 来源：主人 11-14 要求「重复触发必须物理去重、拦在唤醒模型之前」；已实测 2 例（同一份 `.done` 通知 2 次）

## 一、根因（已由大肥鱼只读确认，作为卡面前提）

- `index.js:811` 的 `delivered` 是**纯内存 Set**，重载/重启即清空；今天改配置热重载过，表已重置一次。
- 对照 `failedRegistry`（`index.js:153-181`）是**落盘**的，重载后仍能去重 ⇒ 直接照抄这套模式。
- 「stable 触发」与「DONE 触发」在同一进程里对同一文件各推了一次，内存表没挡住；加上启动后 3 次重扫，历史文件有被重放的风险。
- **11-15 10:05 实测的第二次注入**：同一份内容被 `cp` 回 watch 目录，`size` 不变、`mtime` 变新，旧判重键 `(绝对路径, size, mtimeMs)`（`:382`/`:437`）认不出，30s 窗口（`:27`）也盖不住 71 秒间隔 ⇒ 这就是本版加 contentHash 的直接理由。`stable`/`DONE` 两条通道本身无并发缺陷（`consider()` 对同一 `(relName,sig)` 直接 return；`deliver()` 先 `clearTimeout` + `pending.delete`；`checkStable()` 首行查 `pending.get(relName) !== state`）。

## 二、必做（顺序固定：①→②→④→③）

1. **① 持久化 delivered（并带上内容摘要）**：把内存 `delivered` 换成落盘表，位置沿用 profile 状态目录（与 `relay.log` 同级，文件名 `dedupe.json`），内容为
   `{ "<dirKey>": { "<absPath>": {"size":n,"mtimeMs":n,"contentHash":"<sha256 十六进制>","at":iso} } }`；
   写入用「临时文件 + rename」的原子写法，失败只 warn 不阻断投递。
2. **② 启动只捞新文件**：「新」的定义＝`mtimeMs` **晚于状态表里该 dir 的最后一次成功投递时刻**（`lastDeliveredAt`），**不是**晚于本次启动时刻——否则停机期间投进来的合法文件会被吞掉。状态表里没有该 dir 记录时，按「全部视为新」处理（首次运行不吞文件），但要在 relay.log 记一条 info。**本版补充：②只决定「要不要看一眼」，命中 ③ 内容判重的仍跳过。**
3. **④ 跳过留痕**：命中去重而跳过时，`relay.log` 记一条 `info`，字段固定为
   `去重跳过 target=<dirKey> file=<文件名> digest=<contentHash 前 12 位> 原因=重复(内容)`；
   因 size/mtime 命中最小间隔的记 `原因=重复(size,mtime)`。**不得静默；三个字段缺一不可。**
4. **③ 内容判重（本版主判据）**：同一 `target` 下的同一文件名，`contentHash`（`sha256(文件字节)`）与落盘表里已投记录相同 ⇒ 跳过，**不看 mtime**；内容变动逾 1 字节（digest 变）**必须放行**。原「30 秒内同 size/mtime 跳过」保留作第二道，命中亦并入 ④ 日志。
   不按文件名跨目录去重（不同 target 投同名件是合法用法）；不做全局节流。

## 三、禁动区

- 不动「解析不到文件留原地不丢」（`index.js:876-880`）与 1s/5s/15s 重试节奏。
- 不动标题优先/id 兜底的解析顺序，不动 `client.js`，不动 `package.json`（版本号仍留给打 tag 那次）。
- 不新增依赖；文件读写只用 `node:fs`、`node:crypto`（内置）。
- 不碰 `cordis.patch.yml`、不碰在用 profile。

## 四、测试（`index.test.mjs`）

- 现有全绿。
- 新增四条（TC1–TC4），全部用同一套构造：临时 watch 目录 + 假 ctx + 调 `dirKeyOf()` 生成 target 键。
  - **TC1 源文件仍在的二次投**：同一文件连投两次 ⇒ 第二次不投，日志含 `去重跳过 target=… file=… digest=… 原因=重复(内容)`。
  - **TC2 已投件被拷回 watch（本次事故形态）**：投一次 → 把该文件从 watch 移走 → 用**同字节**内容重新写回同名文件（`mtime` 必然变新、`size` 不变）⇒ 仍不投，且日志走 `原因=重复(内容)`。
  - **TC3 内容改 1 字节必须放行**：同文件名、内容改 1 字节（`size` 可变可不变）⇒ 必须投。
  - **TC4 DONE 与 stable 同时触发只投一次**：同一快照先 `DONE` 后 `stable`（或反之）⇒ 只投一次，日志只有一条投递、无静默跳过。
- 保留原有回归用例：重载后落盘表仍挡住（原 b）、落盘表无该 dir 首次不吞（原 c）、停机期间写入的文件启动后仍被投（原 d）。
- 反证：把 ① 退回内存 Set，TC1 必须红；把 contentHash 从判重键里去掉，TC2 必须红。

## 五、交付要求

- 提交 `fix:` 前缀，`git add` 点名文件、禁 `-A`；回执贴 `git log --oneline -3`、`git status --porcelain`（空）、`git show --numstat HEAD`、`node index.test.mjs` 末行。
- 报告 `.batch/night/reports/p31-dedupe-persist.md`，末行 `<!-- DONE -->`。
- 报告落盘同一分钟内写 `.batch/night/signals/doubao/p31-dedupe-persist.done`。

## 六、QA 判据

- C1 改动面只含 `index.js`、`index.test.mjs`（新增落盘表逻辑）；`client.js` 与 `package.json` 未动。
- C2 落盘表是原子写、失败不阻断投递（有 try/catch 与 warn）。
- C3 「启动只捞新文件」的基准是 `lastDeliveredAt` 而不是启动时刻——读代码确认，不接受文案声明。
- C4 四条 TC1–TC4 真跑，两条反证真红（退内存 Set → TC1 红；去 contentHash → TC2 红）。
- C5 无新增依赖、无 `client.js` 改动、`cordis.patch.yml` 未动。
- C6 判重键含 `contentHash`，且「内容变必放行」在代码里成立（读代码确认，不看文案）。
- C7 跳过日志行含 `target` / `file` / `digest` 三个字段；成功投递不要求出现在 relay.log（该文件只写启动/移动失败/跳过/重扫）。

## 七、投递指令（联络人 2026-11-14 09:0x 投前核对）

投前基线（我实跑）：仓库 `C:\develop\workspace\dsh-handoff-relay` 的 `HEAD=6f655500c88b`、`git status --porcelain` 空、`node index.test.mjs` = `TOTAL: 138/138 PASS / RESULT: PASS`。卡面 §起点 要求你投后自己现取 `git log --oneline -1` 写进回执，照做。

1. **只动** `index.js` 与 `index.test.mjs`；`client.js`、`package.json` 不动；不新增依赖；`cordis.patch.yml` 不碰。
2. 顺序固定 ①→②→④→③，**②的「新」基准是 `lastDeliveredAt`，不是启动时刻**（这条是主人明确要求，写错等于吞文件）；**③ 的主键是 contentHash，不是 mtime**。
3. 每条跳过都必须落 `relay.log`，字段 `target` / `file` / `digest` 缺一不可；落盘写失败只 warn、不阻断投递。
4. **信号文件**（交付的一部分）：报告落盘后同一分钟内写
   `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p31-dedupe-persist.done`
   （三行：报告路径 / 提交 SHA / `<!-- DONE -->`）；写不进立刻在回执里说「信号未写 + 原因」。
5. 回执须含：`git log --oneline -3`、`git show --numstat HEAD` 原文、`node index.test.mjs` 末行、porcelain。
6. 交付后不要再往这张卡上加提交；报告数字以最终 HEAD 为准。

**纪律条（写进卡面、不写码）**：`delivered\` 里的件**禁止拷回 watch 源目录**；要重发就换新文件名或改内容。违反一次按违约记录一次（11-15 10:05:13 已记一笔，责任人：AI writer总负责人）。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
