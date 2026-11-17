# P11 · 启动期存量补投：首个文件事件到达时全量重扫一次

卡号：P11
仓库：`C:\develop\workspace\dsh-handoff-relay`
基线：P10 已提交后的 HEAD（派卡时由联络人现查，并把 `git log --oneline -1` 原文写进回执）
执行方：豆包（经豆包联络人派卡）
预估工时：30 分钟

## 为什么单开这张卡

P10 修的是「先解析后标记 + 解析不到写 WARN + 加载期每条 watch 一行解析结果」。它让启动期的问题**可见**，但没让漏投**自动补回来**：
- 启动扫描只在 `index.js:567` 跑**一次**，之后没有重扫、没有重试；
- `setTimeout` 两处（`:522`、`:549`）都是 stableMs 静默计时，必须先有 pending 才存在；
- `queueMicrotask` 只有 `:506`；`fs.watch` 回调只在有事件时触发，事件里也不带旧文件。

结果：进程启动那一刻已躺在 watch 目录里的文件，如果当时目标会话还没注册上，就会一直躺着，直到文件 mtime 变化或再次重启。实测过：2026-11-13 22:36 那次重启，`wake-later.done`（176B）躺了 6 分钟没被投，碰一下 mtime 才投出去。

## 目标（只做一件事）

**首个 `fs.watch` 事件到达时，对该 watch 目录做一次 `listFiles()` 全量重扫。**

具体要求：
1. 复用现有 `fs.watch` 事件，**不新增定时器、不新增轮询**。
2. 用 latch 保证**每个 watch 每次加载只重扫一次**；同一 watch 的后续事件不再触发第二次重扫。
3. 重扫走现有 `consider()` 路径，不做第二套投递逻辑；已投递的由内存 `delivered` 天然挡掉，未投递的照常投。
4. 重扫这件事本身**不打日志**；解析失败仍由 P10 的 WARN 负责留痕。
5. 别的 watch 不受影响：A 目录的事件不许触发 B 目录的重扫。

## 判据（提交前自己跑，报告里贴原始输出）

1. `node index.test.mjs` 的 `TOTAL:` 行 **≥ P10 交付时的数量，且一条不许删**（等价改写允许，须逐条说明）。
2. 新增用例至少覆盖三条：
   ① 加载时文件已存在、`listFiles` 当时解析目标失败（模拟注册表未就绪），首个文件事件到达后重扫并**补投成功**；
   ② 同一 watch 的**第二个**事件不再触发重扫（latch 生效）；
   ③ A watch 的事件**不触发** B watch 重扫。
3. `source:` 那行**逐字不变**——按内容比对，不看行号、不看 `git diff` 行数（仓库无 `.gitattributes`、`core.autocrlf=true`）。
4. `git status --porcelain` 只允许 `M index.js`、`M index.test.mjs`；测试一律用临时目录。
5. 报告落 `.batch\night\reports\p11-startup-rescan.md`，贴 `git diff --numstat` 原文，末行 `<!-- DONE -->`；信号 `.batch\night\signals\doubao\p11-startup-rescan.done`。

## 边界（违反即返工）

- 只改 `index.js`、`index.test.mjs`。
- `git add` 点名两个文件，**禁止 `-A`**，**禁止 `git commit`**（负责人验证后提交）。
- **禁止重启 DSH**、禁止改 `cordis.patch.yml`、禁止动 `~\.dsh\profiles\desktop\dsh-handoff-relay\` 下任何状态文件。
- 不许在真实 watch 目录（`scripts\dsh\wakeup-inbox*`、`.batch\night\signals*`、`.batch\night\bridge*`）里放任何文件。
- 芯片切不动就用「自动」跑，回执里写明芯片原文，不要为它停卡。

## 真机验收（负责人做，不用你）

重启一次（由主人点），在 watch 目录里**预先**放一个探针再重启，验「重启后不碰 mtime 也能自己投出去、文件被移走、目标会话恰好 1 条、`relay.log` 有对应 WARN 或保持 1 行 INFO」。

---

**本卡作废（2026-11-13 22:53，负责人）**：目标 6 已在 P10 交付内实现并纳入 P10 派验单，本卡不派，仅留档。
