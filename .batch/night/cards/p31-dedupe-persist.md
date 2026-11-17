# P31 · 投递层物理去重（拦在唤醒模型之前）

- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点：P28b 交付后的 HEAD（**投递前用 `git log --oneline -1` 现取，写进回执**）
- 估时：45 分钟
- 来源：主人 11-14 要求「重复触发必须物理去重、拦在唤醒模型之前」；已实测 2 例（同一份 `.done` 通知 2 次）

## 一、根因（已由大肥鱼只读确认，作为卡面前提）

- `index.js:811` 的 `delivered` 是**纯内存 Set**，重载/重启即清空；今天改配置热重载过，表已重置一次。
- 对照 `failedRegistry`（`index.js:153-181`）是**落盘**的，重载后仍能去重 ⇒ 直接照抄这套模式。
- 「stable 触发」与「DONE 触发」在同一进程里对同一文件各推了一次，内存表没挡住；加上启动后 3 次重扫，历史文件有被重放的风险。

## 二、必做（顺序固定：①→②→④→③）

1. **① 持久化 delivered**：把内存 `delivered` 换成落盘表，位置沿用 profile 状态目录（与 `relay.log` 同级，文件名 `dedupe.json`），内容为 `{ "<dirKey>": { "<absPath>": {"size":n,"mtimeMs":n,"at":iso} } }`；写入用「临时文件 + rename」的原子写法，失败只 warn 不阻断投递。
2. **② 启动只捞新文件**：「新」的定义＝`mtimeMs` **晚于状态表里该 dir 的最后一次成功投递时刻**（`lastDeliveredAt`），**不是**晚于本次启动时刻——否则停机期间投进来的合法文件会被吞掉。状态表里没有该 dir 记录时，按「全部视为新」处理（首次运行不吞文件），但要在 relay.log 记一条 info。
3. **④ 跳过留痕**：命中去重而跳过时，`relay.log` 记一条 `info`：`去重跳过 <dir> <文件名> 原因=重复(size,mtime 相同)`；不得静默。
4. **③ 最小间隔**：同一 `dir` 同一文件路径，`size` 与 `mtimeMs` 都相同且在 **30 秒**窗口内，第二次及以后跳过（并入④的日志）。不做全局节流、不按内容哈希。

## 三、禁动区

- 不动「解析不到文件留原地不丢」（`index.js:876-880`）与 1s/5s/15s 重试节奏。
- 不动标题优先/id 兜底的解析顺序，不动 `client.js`，不动 `package.json`（版本号仍留给打 tag 那次）。
- 不新增依赖；文件读写只用 `node:fs`。
- 不碰 `cordis.patch.yml`、不碰在用 profile。

## 四、测试（`index.test.mjs`）

- 现有全绿。
- 新增至少五条：
  a) 同 size/mtime 的同一文件投一次后再放同一文件 ⇒ 不投，且日志有「去重跳过」；
  b) 进程内清空内存模拟**重载**后，落盘表仍能挡住 ⇒ 不投；
  c) 落盘表里没有该 dir ⇒ 首次运行不吞（照投）；
  d) 停机期间写入的文件（mtime > lastDeliveredAt）在启动后仍被投；
  e) 30 秒窗口外（或 size/mtime 变了）⇒ 照投。
- 反证：把 ① 退回内存 Set，用例 b 必须红。

## 五、交付要求

- 提交 `fix:` 前缀，`git add` 点名文件、禁 `-A`；回执贴 `git log --oneline -3`、`git status --porcelain`（空）、`git show --numstat HEAD`、`node index.test.mjs` 末行。
- 报告 `.batch/night/reports/p31-dedupe-persist.md`，末行 `<!-- DONE -->`。
- 报告落盘同一分钟内写 `.batch/night/signals/doubao/p31-dedupe-persist.done`。

## 六、QA 判据

- C1 改动面只含 `index.js`、`index.test.mjs`（新增落盘表逻辑）；`client.js` 与 `package.json` 未动。
- C2 落盘表是原子写、失败不阻断投递（有 try/catch 与 warn）。
- C3 「启动只捞新文件」的基准是 `lastDeliveredAt` 而不是启动时刻——读代码确认，不接受文案声明。
- C4 五条用例真跑，反证 b 真红。
- C5 无新增依赖、无 `client.js` 改动、`cordis.patch.yml` 未动。
## 七、投递指令（联络人 2026-11-14 09:0x 投前核对）

投前基线（我实跑）：仓库 `C:\develop\workspace\dsh-handoff-relay` 的 `HEAD=6f655500c88b`、`git status --porcelain` 空、`node index.test.mjs` = `TOTAL: 138/138 PASS / RESULT: PASS`。卡面 §起点 要求你投后自己现取 `git log --oneline -1` 写进回执，照做。

1. **只动** `index.js` 与 `index.test.mjs`；`client.js`、`package.json` 不动；不新增依赖；`cordis.patch.yml` 不碰。
2. 顺序固定 ①→②→④→③，**②的「新」基准是 `lastDeliveredAt`，不是启动时刻**（这条是主人明确要求，写错等于吞文件）。
3. 每条跳过都必须落 `relay.log`，不许静默；落盘写失败只 warn、不阻断投递。
4. **信号文件**（交付的一部分）：报告落盘后同一分钟内写
   `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p31-dedupe-persist.done`
   （三行：报告路径 / 提交 SHA / `<!-- DONE -->`）；写不进立刻在回执里说「信号未写 + 原因」。
5. 回执须含：`git log --oneline -3`、`git show --numstat HEAD` 原文、`node index.test.mjs` 末行、porcelain。
6. 交付后不要再往这张卡上加提交；报告数字以最终 HEAD 为准。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
