# P29 · dir 目录校验提示 + 「选择目录…」

- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点：`801dc38b84f3`（P31 终审 PASS 后）
- 估时：40 分钟
- 依据：P32 取证（`.batch/night/reports/p32-dir-validate-feasibility.md`）
- 只动 `client.js` + `index.test.mjs`

## 一、关键约束（照着做，别自行改）

1. **不加硬 inject**。`client.js` 导出数组仍为 `["slots","sessions"]`。`remoteAccess` / `workspaceFiles` 一律用 `ctx.get(...)` **惰性取**，取不到就静默降级（照 P17 的模式）。理由：硬 inject 一个当前运行时可能不存在的服务＝条目永久 pending＝整页 `web boot: 1 entry did not activate`，本周已经吃过一次。
2. **校验只提示、不阻断保存**。目录不存在/不可读画红点 + 行内文案，但保存按钮照常可用（网络盘、权限临时失败不该锁住用户）。
3. 探测失败（服务不可用、IPC 抛错、超时）**不得**把行画成红点，也**不得**打 console 错误；降级为「无徽标」。

## 二、必做

1. `dir` 输入框右侧加「选择目录…」按钮：命中 `globalThis.__DSH_DIRECTORY_PICKER__` 且 `typeof pick === 'function'` 才渲染；点了 `await pick()`，返回字符串且非空才写入该行 `dir`；`null`、抛错、取消一律静默保持原值。
2. `dir` 有值时异步探测可读性：取 `ctx.get('remoteAccess')`，再取 `workspaceFiles`，调 `list(sessionId, dir)`；`ok===true` ⇒ 绿点（tooltip「目录可读」）；`ok!==true` 或抛错 ⇒ 红点（行内文案「目录不可读或不存在」）。每个 dir 只探一次，值变化才重探；探测加 3 秒超时。
3. 探测进行中显示灰点（tooltip「检查中…」）；服务不可用则不显示任何点。
4. 空 `dir` 不探测、不显示点。

## 三、禁动区

- `index.js` 一个字节不动；写回路径（`controller.mutate` / `set`）不动；三列结构、10 条上限、查看更多、搜索框不动。
- `package.json` 不动（版本号留给打 tag 那次）；不新增依赖。
- 不碰 `cordis.patch.yml`、不碰在用 profile。

## 四、测试（`index.test.mjs`）

- 现有 144/144 全绿。
- 新增至少五条：
  a) 无 `__DSH_DIRECTORY_PICKER__` ⇒ 不渲染按钮；
  b) 有该全局且 `pick` 返回 `C:\x` ⇒ 该行 `dir` 变成 `C:\x`；
  c) `pick()` 返回 `null` ⇒ `dir` 保持原值、不报错；
  d) `ctx.get('remoteAccess')` 抛错 / 返回 undefined ⇒ **不崩、不显示点**（这条是 K21 保险丝）；
  e) `list` 返回 `ok:true` ⇒ 绿点；`ok:false` ⇒ 红点且文案出现。
- 反证：把 2 的探测改成「硬 inject `remoteAccess`」后，用例 d 必须红。

## 五、交付要求

- 提交 `feat:` 前缀，`git add` 点名文件、禁 `-A`；回执贴 `git log --oneline -2`、`git status --porcelain`（空）、`git show --numstat HEAD`、`node index.test.mjs` 末行。
- 报告 `.batch/night/reports/p29-dir-check.md`，末行 `<!-- DONE -->`。
- 报告落盘同一分钟内写 `.batch/night/signals/doubao/p29-dir-check.done`。

## 六、QA 判据

- C1 改动面只含 `client.js`、`index.test.mjs`；`index.js`、`package.json` blob 与 `801dc38` 同。
- C2 导出数组仍是 `["slots","sessions"]`（没有偷偷加 `remoteAccess`）。
- C3 用例 d 真跑，反证那条真红。
- C4 保存未被阻断（代码里没有因校验失败 disable 保存的分支）。
- C5 测试全绿且总数 > 144。
## 七、投递指令（联络人 2026-11-14 09:4x 投前核对，两条硬约束原样在此）

投前基线（我实跑）：仓库 `C:\develop\workspace\dsh-handoff-relay` 的 `HEAD=801dc38b84f3`、`git status --porcelain` 空、`node index.test.mjs` = `TOTAL: 144/144 PASS / RESULT: PASS`。

**两条硬约束（负责人要求原样执行，不许自行改）**：
1. 导出数组仍是 `["slots","sessions"]`，**禁止硬 inject `remoteAccess`**——硬 inject 会让条目 pending → 整页 `web boot: 1 entry did not activate`，本周已经吃过一次。`remoteAccess`/`workspaceFiles` 一律 `ctx.get(...)` 惰性取，取不到静默降级。
2. **校验只提示、不阻断保存**——红点出现时保存按钮照常可用。

其余：
- 只动 `client.js` 与 `index.test.mjs`；`index.js`、`package.json` 不动；三列结构、10 条上限、查看更多、搜索框不动。
- 探测失败/服务不可用一律降级为「无徽标」，不画红点、不打 console 错误。
- **信号文件**（交付的一部分）：报告落盘后同一分钟内写
  `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p29-dir-check.done`
  （三行：报告路径 / 提交 SHA / `<!-- DONE -->`）；写不进立刻在回执里说「信号未写 + 原因」。
- 回执须含：`git log --oneline -2`、`git show --numstat HEAD` 原文、`node index.test.mjs` 末行、porcelain。
- 交付后不要再往这张卡上加提交；报告数字以最终 HEAD 为准。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
