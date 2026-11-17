# dsh-handoff-relay 0.5.0 结项结论

- 结项人：AI writer总负责人
- 结项时刻：2026-11-14 23:2x（北京时间）
- 仓库：`C:\develop\workspace\dsh-handoff-relay`，分支 `master`，本地 HEAD `15e9d83`
- 远端：`master` 停在 `74f4cc1`（分支未推），tag `v0.5.0` = `bc5aea1b` → 提交 `15e9d835`
- npm：`dsh-handoff-relay@0.5.0`，`dist-tags.latest = 0.5.0`

## 一、本版解决的是什么

主人原话口径：设置卡「圆点不直观，改成路径输入框框沿标色——通过绿、不通过红」。
真机第一轮验出两件事：①框沿恒灰、无红绿；②旧版设置卡只验格式、**不验目录是否存在**（主人手填 `C:\deve` 被存进去，是活样本）。

定性结论（P41）：染色代码没坏，是**取数死了**——渲染层 `probeDirectory` 拿不到探测能力，`kind` 恒 `none`。
根因（P43）：`remote.workspaceFiles` 的 `stat` 能查任意绝对路径的**文件**，但目录只有 `list`，且被 `api-workspace-files/lib/index.js:581` 的 `ctx.fs.contains()` 锁在工作区内。

## 二、交付链（三笔提交）

| 提交 | 内容 | numstat |
|---|---|---|
| `8df4e76` | feat: probe directories via main-process route | `157 0 index.js` / `112 63 client.js` / `106 7 index.test.mjs` |
| `8778233` | docs: align README with 0.5.0 and settings card entry | `16 4 README.md` / `12 2 README.zh-CN.md` |
| `15e9d83` | docs: fix settings card entry wording | `1 1` × 两份 README |

方案：主进程注册 `GET /handoff-relay/probe`（同源校验 + `fs.stat`/`fs.access`），渲染层 debounce 350ms 后同源 fetch，接已有三色 `dirFrameStyle`。顺带补上「存在性不验」的洞。

## 三、验收证据

- QA 首验（P44）：9/9 通过；反证——把 `index.js:115` 改 `return true;` → 155/156，唯一红「跨源必须 403」，还原后 156/156。
- 我的终审：`.batch/night/reports/p44-verdict.md` PASS。
- **主人真机（权威）**：「绿/红。很完美，包括已存在的9条记录，7条绿色、2条红色……下方还有目录可读和不可读的文字提示」。判定单 `.batch/night/reports/real-machine-verdict-p39-p44.md`。启动行 `7/9 → 7`（主人自删两条试验路径后）。
- QA 首验（P45）：8 条里第④条不通过（英文标签实为 `Components`、「最下方」不成立）→ P45-fix 只改两处字 → 复验通过 → 我终审 PASS（`.batch/night/reports/p45-fix-verdict.md`）。
- 发布面（我独立回读）：线上 `shasum = bdcb15462be895a5e3eb70e4661ebbc257fddfcb`，与发布前 `npm pack --dry-run` 基准逐字一致；`fileCount 7`、`unpackedSize 123439`；`time['0.5.0'] = 2026-11-14T14:55:07.543Z`（北京 22:55），主人另收到 npm 邮件。
- 脱敏自检：包内无本机路径、无 `<用户名>`、无 `session-<uuid>`、无 `AI-writer`。

## 四、遗留（不属本版，已入 `.batch/night/reports/plugin-backlog.md`，3,317B / `C4EA4EE96967948705E2FCD9CBA78299`）

B1 逻辑键改「标题 + cwd」唯一命中自动重绑 · B2 同名会话可区分（B1 前提）· B3 rescan 21 秒窗口 · B4 `触发=` 日志缺失 · B5–B7 QA 三条备注（三色无单测、debounce 误报、`probeReason` 文案）· B8 探测路由安全项 · B9 「目标会话（文本输入）」与选择器矛盾。

是否继续做、何时做，待主人定。

## 五、结论

**P44 / P45 结项：通过。** 0.5.0 已发布，主进程目录探测 → 框沿三色 → README 对齐 → tag → publish 全链闭环。本条线到此收口，回到主线。

两点记账，交下一位接手的人：
1. `npm whoami` 返 E401 不等于 token 过期（细粒度 Automation token 不支持 whoami），判过期要看 publish/`--prefer-online` 回读；凭据名 `NPM`，约 2027-02-11 到期。
2. ~~`master` 分支未推远端（远端停在 `74f4cc1`）~~ → **已于 11-15 00:10 补推**：`74f4cc1..15e9d83 master -> master`（fast-forward，无改写），回读 `refs/heads/master = 15e9d835a6c1816f42cb6eb2d16693790bacdfa5`。
   教训：整条链只推了 tag、没推分支，GitHub 首页一直停在 11-13 那版，主人以为代码没上去。**发版后除了 tag/publish，必须回读 `refs/heads/<分支>` 是否已到发布提交。**
