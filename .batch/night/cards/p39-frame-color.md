# P39 · 设置卡路径框沿标色（A 类 · 改码）

- 卡号：P39
- 起点：插件仓库 `C:\develop\workspace\dsh-handoff-relay`，分支 `master`，HEAD `d535dc1`（feat: add directory picker and readable dir hints）。**不碰 AI-writer 仓库**。
- 派卡时刻：2026-11-14 19:2x
- 估时：**45 分钟**（改码 + 自查）；QA 首验 15 分钟另计；真机复验要主人关开一次 DSH，约 10 分钟，另计。
- 授权：可改码、可提交（仅本仓库 master）。**禁 push、禁打 tag、禁 publish**。

## 背景（主人 19:05 拍板）

原 U1–U6 判据靠「每行右侧圆点」，主人真机反馈：**圆点根本没有**，且圆点本身不直观。改为：**路径输入框的框沿标色**——核验通过绿沿、不通过红沿。

## 现状证据（我已核过，不用重查）

- `client.js:243-258` `DirStatusDot`：`ok` 绿 `●`、`bad` 红 `●`＋「目录不可读或不存在」、`checking` 灰 `●`、**`none` 直接 `return null`（什么都不渲染）**。
- `client.js:207-215` `probeDirectory`：`!sessionId`、取不到 `ctx.get("remoteAccess")`、或拿不到工作区文件时，**一律返回 `{ kind: "none" }`**。
- `client.js:533-541` 输入框在 `row.dir` 非空时挂 `DirStatusDot`。

⇒ 真机「一个圆点都没有」的最可能解释是 `kind === "none"`（宿主侧 `remoteAccess` 取不到），**不是 CSS 或布局问题**。本卡不要求你改判定逻辑，但必须把 `none` 显式化。

## 要做的（四条，缺一不算完）

1. **框沿标色**：`ok` → 绿沿 `#2e7d32`；`bad` → 红沿 `#d33`；`checking` → 中性灰沿。作用在路径 `<input>` 的 `border`/`boxShadow` 上，不动布局尺寸。
2. **`none` 不许静默**：框沿用中性灰，并在该行下方给一行小字「宿主未提供目录核验」，`unknown` 不得当成通过。**严禁把 `none` 渲染成绿沿。**
3. 保留原先的 `title` 提示（「目录可读」/「目录不可读或不存在」），红沿时那行「目录不可读或不存在」文案保留。
4. 若同一行还有其他校验（目标会话缺失等）已有提示，别覆盖、别删除。

## 落点自证（先做，不做完不许动手）

1. 第一步跑 `git rev-parse --show-toplevel`，必须是 `C:/develop/workspace/dsh-handoff-relay`；**以 toplevel 为准**，豆包的项目 chip 显示 `AI-writer-wt-1` 属正常，不许据此改落点。
2. 核 `git rev-parse HEAD` 必须是 `d535dc1…`、`git status --porcelain` 必须为空。任一条不符：**停下报实况**，禁止 `reset` / `checkout` / `stash` / `--force`。
3. 测试命令：**`node index.test.mjs`**（= `package.json` 的 `scripts.test` 原文，自跑式断言脚本，不是 node:test）。禁用 `node --test`、禁用 `pnpm test`、禁用 AI-writer 仓库的任何测试脚本。原样贴出实际运行的命令与 exit code。

## 禁改

- `index.js` 的投递/去重/扫描逻辑一行不动。
- `cordis.patch.yml`、`package.json` 版本号不动（发版另行决定）。
- README 两个语言版本本卡不动。

## 交付

- 一次提交，点名 `git add client.js`（有测试再加测试文件名），**禁 `git add -A`**。
- 报告落 `.batch/night/staging/p39-frame-color-report.md`：首行写起点 HEAD 与提交 SHA；写清四个 `kind` 分支各自的渲染结果（贴行号）；说明 `none` 的成因判定（`remoteAccess` 是否存在，取不到就写取不到，不许猜）。
- 报告末行 `<!-- DONE -->`。
- 提交后 `git status --porcelain` 必须是空；`git rev-parse HEAD` 贴原文。

## 真机判据（重启后由主人点，一次 8 步）

1. 入口：设置 → 插件 → 已安装 → `dsh-handoff-relay` → README 页最下方「包含的组件」→ 点组件名。
2. 有效路径（`C:\develop\workspace\AI-writer\develop`）→ 框沿**绿**。
3. 改成 `C:\no-such-dir-050` → 框沿**红**，行内有「目录不可读或不存在」。
4. 改回有效路径 → **绿**。
5. 若全程框沿只有灰、且出现「宿主未提供目录核验」→ 判**未通过**（`none` 没消掉），不是通过。
6. 保存 → 重开设置卡，值仍在；放弃修改 → 回原值。
