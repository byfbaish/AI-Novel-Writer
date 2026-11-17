结论：PASS ｜ 产物：C:\develop\workspace\dsh-file-watch\reports\p2-multi-watch.md ｜ 判定线：8/8 测试通过 + 配置已改 + 双语 README 已建 ｜ 证据：`node index.test.mjs` → `TOTAL: 8/8 PASS` / `RESULT: PASS`（EXITCODE=0）；`index.js` 261→197 行（`node --check` OK）；desktop `cordis.patch.yml` 已换成 `watches:` 形状；脱敏 grep 0 命中；提交 `4d5d3a7b251c02cb05f335d0ab23fa427d2a11fc`。

## 0. 本轮授权与边界

`本轮授权：可改码、可提交（仅 C:\develop\workspace\dsh-file-watch）、不推送`。未推送；未重启 DSH、未杀进程、未 `taskkill`；未往 inbox 丢任何文件；未改 `test/helpers`；未动 `C:\develop\workspace\AI-writer` 下任何文件及其 git；未引入任何第三方依赖（`package.json` 无 `dependencies` 属性）。

## 1. 改前取证：Session Format v4 的 `MessageSource` / `source.kind`

任务指定的 glob `C:\Users\<user>\.dsh\profiles\desktop\node_modules\@//deepseek-ai/\*\lib\**\*.d.ts` 下**没有命中**：desktop profile 的 `@deepseek-ai` 目录里只有 6 个包（`cosmokit` / `dsh-computer-use` / `dsh-experimental-computer-use-cua-driver-native` / `dsh-mcp-client` / `dsh-util-values` / `schemastery`），不含 `dsh-llm`；其 `node_modules/.pnpm` 下只有 `lock.yaml`。因此按「desktop profile 已安装源码」这一实质要求，继续在 `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules` 内全量扫描 **6798 个 `.d.ts`**，命中的 v4 依据如下（原文照录）。

**① 权威定义（`dsh-better-sidebar/lib/types/sidechat-core.d.ts:39-46`）**

```ts
/** The plugin's producer-owned source kind, stamped on the source of
 *  context-injection messages (boundary prompt + parked snapshot) so the
 *  transcript recognizes them structurally — not by text prefix. Session
 *  format v4 retired the bare `kind: 'plugin'` + `plugin` pair; a plugin is
 *  now identified by its own `plugin:<name>` kind, which is exactly what
 *  DSH's own v3→v4 migration derives for rows this plugin wrote earlier, so
 *  both generations read back under one shape. */
export declare const SIDE_INJECTION_SOURCE_KIND = "plugin:dsh-better-sidebar";
```

**② 声明合并（`dsh-better-sidebar/lib/types/sidechat-routes.d.ts:29-45`）**

```ts
/**
 * The plugin's producer-owned message source kind. Message sources are a
 * merge-extensible sum type — DSH 0.1.7 has no shared catch-all `plugin`
 * kind, so every producer declares its own in its own module (the same
 * `declare module` seam dsh-time-context / dsh-tmux-context use). The kind
 * itself is {@link SIDE_INJECTION_SOURCE_KIND}: exactly the `plugin:<name>`
 * value DSH's own v3→v4 migration derives for the rows this plugin wrote
 * under 0.1.6, so old and new logs carry one shape.
 */
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        /** Side-chat context injection (boundary prompt + parked in-progress snapshot). */
        'dsh-better-sidebar': {
            kind: typeof SIDE_INJECTION_SOURCE_KIND;
        };
    }
}
```

**③ 第三个生产者的同类声明（`dsh-ops/lib/prompt-injection/types.d.ts:44-54`）**

```ts
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'dsh-ops:step-tail': {
            readonly kind: 'dsh-ops:step-tail';
            readonly contributor: string;
            readonly revision: string;
            readonly turn: number;
            readonly step: number;
        };
    }
}
```

**④ 运行时 v3/v4 分派（`dsh-vision-router/lib/session-message-source-compat.js:1-7, 72-80`）**

```js
const LEGACY_SOURCE = Object.freeze({ kind: 'plugin', plugin: 'dsh-vision-router' })
const PRODUCER_SOURCE = Object.freeze({ kind: 'plugin:dsh-vision-router' })

function sourceKindForSession(session) {
  const version = Number(session?.header?.version)
  return Number.isInteger(version) && version >= 4 ? PRODUCER_SOURCE : LEGACY_SOURCE
}
```
```js
/**
 * DSH Session V3 requires the historical {kind:'plugin', plugin:...} source,
 * while V4 rejects that wrapper in favor of producer-owned source kinds.
```

**⑤ 两处「旧版」反证（按任务要求，均未采纳）**

- `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-llm/lib/types/message.d.ts:94-104` 与 `AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm/lib/types/message.d.ts:94-104` **SHA256 完全相同**（`52D6881EE83E61B30B775243BE6B3410E0A8FE1F321156478B03EEC8070661BD`），内容仍是 v3 形状：
  ```ts
  export interface MessageSourceMap {
      user: { kind: 'user'; };
      plugin: { kind: 'plugin'; plugin: string; } & ContextFormed;
      model: ModelMessageSource;
      tool: ToolMessageSource;
  }
  ```
  → 即 `index.js` 旧头部注释引用的那份并非 v4 依据；本轮已把该注释改为指向本报告，未改 `source` 值。
- `~/.dsh/profiles/node_modules/@deepseek-ai/dsh-schedule/lib/index.js:831-832` 实测为 `kind: "plugin",` / `plugin: "schedule"`，确为旧写法，未照抄。

**结论**：`source: Object.freeze({ kind: \`plugin:${PLUGIN_NAME}\` })` 保持不动（`index.js:L48`）；测试里的 `assert.notEqual(m.source.kind, 'plugin', ...)`（`index.test.mjs:L91`）与 `assert.equal(m.source.kind, 'plugin:dsh-file-watch')`（L92）均未改、未删。

## 2. `index.js` 改前改后行数

| 口径 | 改前（git `fa6a8f4`） | 改后（提交 `4d5d3a7`） |
|---|---|---|
| `Get-Content` 行数 | **261** | **197** |

减少 64 行，达标（≤200）。任务书写的「256 行」与本机实测 261 行有 5 行差异，属计数口径/末尾空行差异，未做猜测性调整。`node --check` 通过。

砍行**只砍了注释与重复代码**：`buildMessage` 的四次 `replaceAll` 合并为两行、`resolveAgent`/`deliver` 的多行 `try` 块压平、`cfg` 三行展开压平、函数间空行与旧头部 34 行取证注释块（其引用的是旧版路径，见 §1⑤）。判定逻辑逐行未动，逐语句计数对照（old / new）：

| 稳定判据语句 | old | new |
|---|---|---|
| ``const sig = `${st.size}:${st.mtimeMs}` `` | 2 | 2 |
| `if (sig !== state.sig)` | 1 | 1 |
| `state.size = st.size` / `state.mtimeMs = st.mtimeMs` / `state.sig = sig` | 1/1/1 | 1/1/1 |
| `tailHasDone(full, st.size, cfg.doneMarker)` | 3 | 3 |
| `checkStable(relName, state), cfg.stableMs` | 2 | 2 |
| ``delivered.has(`${relName}|${sig}`)`` | 1 | 1 |
| `state && state.sig === sig && state.timer` | 1 | 1 |
| `if (state) clearTimeout(state.timer)` / `pending.set(relName, state)` | 1/1 | 1/1 |
| `deliver(relName, state, 'stable')` | 1 | 1 |

旧单值字段残留（`config.watchDir` / `config.targetSessionId` / `cfg.watchDir` / `cfg.targetSessionId`）：**0**。

**多目标实现要点**：`apply` 校验 `watches` 为长度 ≥1 的数组后逐条 `forEach`，每条独立校验 `dir`（绝对路径 + 已存在目录）与 `targetSessionId`（非空字符串），任一不合格则**跳过该条**并写日志点名 `watches[i]`，其余条继续启动；每条调用 `startWatch()` 得到**独立的 `fs.watch`** 与闭包内独立的 `pending` / `delivered` / `watcher` / `closed`（不存在共享快照状态）。`stableMs` 与 `doneMarker` 在 `apply` 里解析一次作为**全局值**传给所有 watch，未实现单条覆盖、无继承链。`dispose()` 统一关闭全部 watcher 与 timer。

## 3. 8 条测试逐条名称与结果

`node index.test.mjs`（UTF-8 输出）：

| # | 名称 | 结果 |
|---|---|---|
| 1 | T1 持续写 3 秒不产生任何 followup | PASS |
| 2 | T2a 停止写 5 秒后产生恰好 1 次 | PASS |
| 3 | T4 UserMessage 形状（id/role/content/source） | PASS |
| 4 | T2b calls.length 稳定（不重复触发） | PASS |
| 5 | T3 DONE 立即产生 1 次（真实投递耗时 2ms << stableMs=5000ms） | PASS |
| 6 | T5 会话未加载：写日志、不抛、不投递 | PASS |
| 7 | T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复 | PASS |
| 8 | T8 一个 watch 目录不存在时，另一个 watch 照常工作 | PASS |

T7 特意**不带 DONE**，让两个 watch 各自走完整的 `(size, mtimeMs)` + 静默 timer 判定（共用状态会让至少一个目标判不出稳定）；等待超过两个静默窗口后仍各恰好 1 条，同时验证不串（消息各含自己的文件名）与不重复。T8 验证坏条目只被跳过（日志点名 `跳过 watches[0]：dir 不可读`），另一个 watch 仍投递 1 条，插件未在启动阶段整体不启动。

### 完整输出（原文照录）

```text
[17:36:19.334] 场景 A 开始：watches[0].dir=C:\Users\<用户名>\AppData\Local\Temp\dfw-a-hOvGzR，stableMs=5000
[17:36:22.399] PASS  T1 持续写 3 秒不产生任何 followup
[17:36:28.101] PASS  T2a 停止写 5 秒后产生恰好 1 次
[17:36:28.102]        消息原文：文件 growing.txt 已就绪（触发=stable），请继续。
[17:36:28.102]        消息 JSON：{"id":"237dac6b-e2c9-40e0-932f-a37e1dca51d2","role":"user","content":[{"type":"text","text":"文件 growing.txt 已就绪（触发=stable），请继续。"}],"source":{"kind":"plugin:dsh-file-watch"}}
[17:36:28.102] PASS  T4 UserMessage 形状（id/role/content/source）
[17:36:29.310] PASS  T2b calls.length 稳定（不重复触发）
[17:36:29.311] 场景 B 开始：写入含 <!-- DONE --> 的文件
[17:36:29.764]        触发原因："文件 done.txt 已就绪（触发=DONE），请继续。"
[17:36:29.764] PASS  T3 DONE 立即产生 1 次（真实投递耗时 2ms << stableMs=5000ms）
[17:36:30.220]        日志：[dsh-file-watch] 会话未加载：get(NO-SUCH-SESSION) 返回 undefined，roots() 中亦无匹配；文件 orphan.txt 未投递。当前可用 roots id: []
[17:36:30.220] PASS  T5 会话未加载：写日志、不抛、不投递
[17:36:30.224] 场景 D 开始：两个 watch 同时各写一个普通文件（stableMs=500）
[17:36:32.140]        S-D1 消息：文件 only-in-d1.txt 已就绪（触发=stable），请继续。
[17:36:32.140]        S-D2 消息：文件 only-in-d2.txt 已就绪（触发=stable），请继续。
[17:36:32.140] PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
[17:36:32.746]        跳过日志：[dsh-file-watch] 跳过 watches[0]：dir 不可读（Error: ENOENT: no such file or directory, stat 'C:\Users\<用户名>\AppData\Local\Temp\dfw-missing-52124-1794504992141'，dir=C:\Users\<用户名>\AppData\Local\Temp\dfw-missing-52124-1794504992141）
[17:36:32.746] PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作

===== 自测汇总 =====
PASS  T1 持续写 3 秒不产生任何 followup
PASS  T2a 停止写 5 秒后产生恰好 1 次
PASS  T4 UserMessage 形状（id/role/content/source）
PASS  T2b calls.length 稳定（不重复触发）
PASS  T3 DONE 立即产生 1 次（真实投递耗时 2ms << stableMs=5000ms）
PASS  T5 会话未加载：写日志、不抛、不投递
PASS  T7 两个 watch 同时各丢一个文件：两个目标各收到恰好 1 条，不串、不重复
PASS  T8 一个 watch 目录不存在时，另一个 watch 照常工作
TOTAL: 8/8 PASS
RESULT: PASS
EXITCODE=0
```

（首次运行 `TOTAL: 8/8 PASS` 亦通过；控制台中文乱码，故以 UTF-8 编码重跑取上表输出，两次结果一致。）

## 4. 脱敏 grep 命令与结果（0 命中）

对两份 README 执行（PowerShell 7）：

```powershell
$r='C:\develop\workspace\dsh-file-watch'
$targets=@((Join-Path $r 'README.md'),(Join-Path $r 'README.zh-CN.md'))
$banned=@('C:\develop','AI-writer','.batch','WB-','wakeup-inbox','session-ad0a0ad1','dsh-ops','dsh-win-notify','ds-bot','派卡','多 agent 派卡流程','internal pipeline')
foreach($w in $banned){ Select-String -LiteralPath $targets -SimpleMatch -Pattern $w }
# 词边界补充：\b(?:Bot|bot)\b|\bWB-\d+\b|\b\d{4}-\d{4}-\d{4}\b
```

结果：

```text
=== 脱敏 grep：固定串精确匹配 ===
TOTAL HITS = 0
=== 词边界正则：Bot 名 / 卡号样式 ===
regex hits = 0
=== 顶部互链 ===
README.md: [中文](README.zh-CN.md)
README.zh-CN.md: [English](README.md)
```

逐项复核：`C:\develop` 0、`AI-writer` 0、`.batch` 0、`WB-` 0、`wakeup-inbox` 0、`session-ad0a0ad1` 0、`派卡` 0。

> 说明：初版 grep 用了含 `bot` 的宽松正则，误命中英文单词 `both`（README 的 "both values are unchanged" / "needs both"），属子串误报而非真实泄漏；改用固定串精确匹配 + 词边界后为 0 命中。README 中的示例路径一律为 `/absolute/path/to/{first,second}-outbox`，session id 为 `session-xxxxxxxx-…` 占位符。

中文版按「翻译不是重写」处理：`stableMs` 译为**静默窗口（单位毫秒）**、`doneMarker` 译为**完成标记**、`quiet period` 译为**静默期**，未出现「稳定毫秒」类硬译；章节顺序、配置项表、技术事实与英文版逐条对应。

## 5. `cordis.patch.yml` 改动前后 config 段落全文

目标文件：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`（仓库外，**未纳入提交**）。

**改前（L289-295）**

```yaml
# --- dsh-file-watch -------------------------------------------------------
- id: dsh-file-watch
  name: dsh-file-watch
  config:
    watchDir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox'
    targetSessionId: 'session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2'
    stableMs: 5000
```

**改后（L289-296）**

```yaml
# --- dsh-file-watch -------------------------------------------------------
- id: dsh-file-watch
  name: dsh-file-watch
  config:
    watches:
      - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox'
        targetSessionId: 'session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2'
    stableMs: 5000
```

保留现有第一条（inbox 目录 + `session-ad0a0ad1-24dd-4d83-ad98-aad562136ae2`）与 `stableMs: 5000`；`doneMarker` 走全局默认 `<!-- DONE -->`，未新增。紧邻的 `dsh-ops` 条目 `- id: dsh-ops` / `disabled: true` 与其他插件条目、`disabled` 字段均未改动。仓库内自带的 `cordis.patch.yml`（bundle patch layer，`config: {}`）也未改动，且不在提交点名清单内。

## 6. 其他改动与提交

- `README.md`：保持英文，顶部加 `[中文](README.zh-CN.md)`；配置示例换成 `watches:` 数组，补「独立 fs.watch / 独立快照」「全局值不支持单项覆盖」「坏条目跳过并点名」等与新实现一致的事实；测试期望 `6/6` → `8/8`。
- `README.zh-CN.md`：新建中文翻译，顶部加 `[English](README.md)`。
- `package.json`：`version` 0.1.0 → **0.2.0**；`description` 保持英文一句原文不动；`dependencies` 属性不存在（无第三方依赖）。
- 提交（点名 `git add -- index.js index.test.mjs README.md README.zh-CN.md package.json`，**未用 `-A`**）：
  - **sha：`4d5d3a7b251c02cb05f335d0ab23fa427d2a11fc`**
  - `feat: support multiple watch targets; add Chinese README`
  - `5 files changed, 268 insertions(+), 154 deletions(-)`；提交那一刻 `git status --short --branch` 为 `## master`（干净）。未推送。
  - 本报告作为产物写在仓库内 `reports/p2-multi-watch.md`，**不在**任务点名的 5 个文件清单里，故未 `git add`、未提交；当前 `git status --short` 因此显示 `?? reports/`（仅此一项，非代码改动遗漏）。

## 7. 待裁决 / 未做

1. **真实投递未验证**：按硬禁止，未重启 DSH、未往 inbox 丢文件。配置改完后即停，重启与真实投递由主人在重启后验。
2. **第二条产线**：desktop 配置按「保留现有第一条」只写了 inbox 一条；schema 示例里的第二条占位目录/`session-xxxxxxxx-…` 未写入本机配置，避免写入不存在的路径。
3. **行数口径差异**：任务书 256 行 vs 实测 261 行，见 §2，未做猜测性对齐。
4. **取证 glob 未命中**：任务指定的 `@//deepseek-ai/*/lib/**/*.d.ts` 在 desktop profile 下无 `dsh-llm`，已改从同 profile 的 `dsh-better-sidebar` / `dsh-ops` / `dsh-vision-router` 取 v4 原文（§1），请确认此取证口径可接受。
