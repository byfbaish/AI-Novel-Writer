# 交接：豆包实例一键启动（`bootstrap.mjs`）+ markers 误判修复

> 交接基准：2026-11-03 · 分支 `exp/resource-ledger`（未提交，无 git 写操作）
> 通道手册：[`docs/agents/doubao-channel.md`](../agents/doubao-channel.md) §2 / **§2.1（新）** / §3 / §4.2 / §8
> 前置约束：当晚 9331 实例正被主 agent 占用跑真任务 ⇒ 全程只跑 `status` / `markers` / `--check` / `--keep`，**未杀进程、未 `task`、未 `ask`**

---

## 一、改动清单

| 文件 | 改动 |
|---|---|
| `scripts/doubao/bootstrap.mjs` | **新增**。一键拉起：实例在线检测（缺则调 `start-doubao-cdp.cmd` 并等端口就绪）→ 新建工作任务线程 → 模式切「本地电脑」→ 档位切「自动 高」→ 项目路径核对 → 打印 `[ok]/[skip]/[fail]` 每步证据 + JSON 自检。`--check` 只读、`--keep` 不新建线程、`--project` 可选切项目、`--port` / `--launch-timeout` 可调。退出码 `0/1/2`。**只做「没有就起」，不含杀进程/重启；端口在但找不到聊天页（登录页/崩溃）时不重复启动，直接报 2 并指路**。复用 `cdp.mjs` 的 `withChat` / `listTargets` / `pickChatPage` / `sleep`，未另写 CDP 层；启动只调现成的 `.cmd`，未复制其路径逻辑 |
| `scripts/doubao/markers.mjs` | **新增**。把 markers 解析抽成零依赖纯函数：`MARKER_LINE` / `ISO_STAMP` / `isTemplateMarker` / `parseMarkerLine` / `extractMarkers`。新增两条模板行判据（① 状态后紧跟 `\|` 的枚举残片；② note 只是 `<一句话说明>` / `（…）` / `(…)` 占位符） |
| `scripts/doubao/__tests__/markers.test.mjs` | **新增**。11 条用例（vitest），回归样本用真实页面文本（含任务书里的格式示例行） |
| `scripts/doubao/doubao.mjs` | 删掉本地 `MARKER_LINE` / `ISO_STAMP` / `extractMarkers`，改为 `import { extractMarkers } from './markers.mjs'`；补一段注释说明「切片起点在用户消息锚点之后，所以任务书正文仍会进切片，靠模板行过滤兜住」。**对外行为不变**（`markers` / `task` 输出格式未动） |
| `docs/agents/doubao-channel.md` | 状态行改 `已实施（2026-11-03）`；§0 加 bootstrap 先行；§1 表格与 mermaid 从「Explorer 代启」改为「保持存活的后台 shell」；§2 换成实测有效的启动方式 + 新增「已失效/被拦截的启动方式」表（含 explorer 失效验证方法与 2026-11-03）；**新增 §2.1 一键启动（bootstrap）**（三种用法、五步顺序及原因、自检 JSON、幂等、退出码、保活责任）；§3 速查加 bootstrap 一行；§4 的 `task` 复用线程警告指向 bootstrap；§4.2 改写为「三项检查已由 bootstrap 自动完成」+ 对话模式无文件权限 + 顺序陷阱；§7 加 2026-11-03 验证记录（含未测项）；§7.2 markers 说明补「格式示例行不算标记」；§8 加三行失效判据（explorer 代启不执行 / runMode 是「对话」/ 新建线程把档位打回「中」）+ 一行 markers 幽灵标记（**该行中 explorer「已失效」的说法已于 2026-11-04 推翻，见 §5.5 顶部更正**） |

未动：`cdp.mjs`、`start-doubao-cdp.cmd`、`probe.mjs`、`inspect-click.mjs`、`task-queue-20261103.md`（后者是本班开工前就存在的未跟踪文件，非本班产出）。未做任何 git 写操作、未改 `config.json` / `models.json`。

---

## 二、执行记录（命令 + 退出码）

| # | 命令 | 退出码 | 说明 |
|---|---|---|---|
| 1 | `node scripts/doubao/doubao.mjs status` | 0 | 开工取证：9331 在线、`taskMode=true`、`runMode=本地电脑`、`turnCount=2` |
| 2 | `node --check scripts/doubao/bootstrap.mjs` / `markers.mjs` / `doubao.mjs` | 0 | 语法检查（三次均 0） |
| 3 | `node scripts/run-tests-electron.mjs scripts/doubao/__tests__/markers.test.mjs` | 0 | **11 tests passed**（原始输出见 §3.2） |
| 4 | `node scripts/doubao/bootstrap.mjs --check` | 0 | 只读诊断，见 §3.1 |
| 5 | `node scripts/doubao/bootstrap.mjs --keep` | 0 | 幂等 + 项目路径解析，见 §3.3 |
| 6 | `node scripts/doubao/doubao.mjs markers` | 0 | 确认 `doubao.mjs` 改 import 后 `markers` 仍正常（`markers: []`） |
| 7 | 探针：`node "…/Temp/bsp probe/variant-probe.mjs"` | 1（脚本内对比） | 三种 `cmd` 调用形式对比，见 §3.4 —— **发现并修正了初版的启动写法** |
| 8 | `node scripts/check-doc-links.mjs` | 0 | `checked 1090, broken 0` |
| 9 | `node scripts/check-doc-placement.mjs --strict` | 0 | `扫描 370 份 md，当前违规 0 条，基线内 0 条，新增 0 条` |
| 10 | `git status --short` / `git diff --stat` | 0 | 只读核对改动范围：`M docs/agents/doubao-channel.md`、`M scripts/doubao/doubao.mjs`、`?? scripts/doubao/{bootstrap.mjs,markers.mjs,__tests__/}` |

**为什么用 vitest 而不是 `node --test`**：本仓 `scripts/__tests__/*.test.mjs` 用 vitest（如 `draft-generation-startup-acceptance.test.mjs`）、`scripts/task-board/test/*.test.mjs` 才用 `node --test`。实测 vitest 默认 include **覆盖 `scripts/`**（本次 11 条被正常发现并执行），所以放在 `scripts/doubao/__tests__/` 用 vitest 能被 `pnpm test` 主集合收纳，不必另建入口。

**未执行（受硬约束）**：`doubao.mjs task` / `ask`、任何 `taskkill`、任何 git 写操作。

---

## 三、原始输出（原样粘贴）

### 3.1 `node scripts/doubao/bootstrap.mjs --check`（退出码 0）

```text
[skip] 实例在线 38451277716136450
[ok] 工作任务模式 输入框就位
[ok] 运行模式 runMode=本地电脑
[ok] 推理档位 model=自动 高
[skip] 项目路径 AI-writer-wt-1（chip 常只显示项目名；绝对路径要开项目菜单，--check 不点击）
[ok] 当前线程 turnCount=1 title=AI-writer-wt-1 任务执行 - 豆包
{
  "port": 9331,
  "online": true,
  "dryRun": true,
  "thread": {
    "turnCount": 1,
    "href": "chrome://doubao-chat/chat/38451277716136450",
    "title": "AI-writer-wt-1 任务执行 - 豆包"
  },
  "runMode": "本地电脑",
  "model": "自动 高",
  "project": {
    "label": "AI-writer-wt-1",
    "hasAbsolutePath": false,
    "verified": false
  },
  "ready": true,
  "steps": [
    {
      "step": "实例在线",
      "status": "skip",
      "evidence": "38451277716136450"
    },
    {
      "step": "工作任务模式",
      "status": "ok",
      "evidence": "输入框就位"
    },
    {
      "step": "运行模式",
      "status": "ok",
      "evidence": "runMode=本地电脑"
    },
    {
      "step": "推理档位",
      "status": "ok",
      "evidence": "model=自动 高"
    },
    {
      "step": "项目路径",
      "status": "skip",
      "evidence": "AI-writer-wt-1（chip 常只显示项目名；绝对路径要开项目菜单，--check 不点击）"
    },
    {
      "step": "当前线程",
      "status": "ok",
      "evidence": "turnCount=1 title=AI-writer-wt-1 任务执行 - 豆包"
    }
  ]
}
```

> `turnCount` 从开工时的 2 变成 1：这期间主 agent 在同一个实例上继续干活，**不是本脚本改的**（`--check` 不点击、不发消息）。

### 3.2 单元测试（退出码 0）

```text

 RUN  v4.1.11 C:/develop/workspace/AI-writer/develop

 ✓ scripts/doubao/__tests__/markers.test.mjs (11 tests) 6ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  22:25:32
   Duration  411ms (transform 92ms, setup 158ms, import 23ms, tests 6ms, environment 0ms)
```

11 条覆盖：真标记（`##` 已渲染丢失）、`##` 保留、**任务书格式示例行（真 bug 回归样本）**、纯占位符 note、真 note 含竖线、时间戳后 1–2 行有效/第 3 行无效、大小写与空白归一化 + note 截 160、未知状态 / 裸 `DONE` 不算、空输入与 `undefined`、`parseMarkerLine`/`isTemplateMarker` 单行视角。

### 3.3 `node scripts/doubao/bootstrap.mjs --keep`（退出码 0）

```text
[skip] 实例在线 38451277716136450
[skip] 新建线程 --keep，复用当前线程 turnCount=1
[skip] 运行模式 → 本地电脑 runMode=本地电脑
[skip] 推理档位 → 自动 高 model=自动 高
[ok] 项目路径 AI-writer-wt-1 C:\develop\workspace\AI-writer\wt-1
{
  "port": 9331,
  "online": true,
  "launched": false,
  "thread": {
    "kept": true,
    "turnCount": 1,
    "href": "38451277716136450"
  },
  "runMode": "本地电脑",
  "model": "自动 高",
  "project": {
    "label": "AI-writer-wt-1 C:\\develop\\workspace\\AI-writer\\wt-1",
    "hasAbsolutePath": true
  },
  "ready": true,
  "steps": [
    {
      "step": "实例在线",
      "status": "skip",
      "evidence": "38451277716136450"
    },
    {
      "step": "新建线程",
      "status": "skip",
      "evidence": "--keep，复用当前线程 turnCount=1"
    },
    {
      "step": "运行模式 → 本地电脑",
      "status": "skip",
      "evidence": "runMode=本地电脑"
    },
    {
      "step": "推理档位 → 自动 高",
      "status": "skip",
      "evidence": "model=自动 高"
    },
    {
      "step": "项目路径",
      "status": "ok",
      "evidence": "AI-writer-wt-1 C:\\develop\\workspace\\AI-writer\\wt-1"
    }
  ]
}
```

### 3.4 启动命令行形式探针（含空格 + 中文目录的 `.cmd`）

探针脚本放在 `%TEMP%\bsp probe\probe script.cmd`（带空格、用户目录含非 ASCII），三种 `cmd` 调用方式逐一跑，看目标文件是否生成：

```text
--- A verbatim /s /c "path"
  status=1 created=false
  stdout=""
  stderr="'C:\\Users\\���Ʒ�\\AppData\\Local\\Temp\\bsp' 不是内部或外部命令，也不是可运行的程序或批处理文件。"
--- B /c "path" (node quotes)
  status=1 created=false
  stdout=""
  stderr="'\\\"C:\\Users\\���Ʒ�\\AppData\\Local\\Temp\\bsp probe\\probe script.cmd\\\"' 不是内部或外部命令…"
--- C /c call path
  status=0 created=true
  stdout=""
  stderr=""
  content="launched"
```

结论：**`cmd /d /s /c call <脚本路径>` 是唯一稳的形式**（`A`/`B` 都被 cmd 的引号规则坑掉）。`bootstrap.mjs` 的 `startInstance()` 已按 `C` 实现，注释里写明了对照结果。

---

## 四、结论与未做的事

### 已实测成立

1. **`--check` 纯只读**：不启动、不点击，退出码 0/2，输出端口、`runMode`、`model`、`turnCount`、项目 chip。
2. **`--keep` 幂等**：四步 `[skip]`，退出码 0；项目绝对路径从项目菜单行读出（`AI-writer-wt-1 C:\develop\workspace\AI-writer\wt-1`），未改动线程（`turnCount` 不变）。
3. **markers 误判已修**：任务书正文里的 `## [T1] DONE|BLOCKED|SKIPPED <一句话说明>` 不再被当成标记，11 条单测锁定；`doubao.mjs` 改为 import 纯函数后 `status` / `markers` 均正常。
4. **启动命令行形式已实测**（探针脚本，见 §3.4），初版写法（`windowsVerbatimArguments` + `cmd /s /c "path"`）**实测失败**，已改。
5. 文档检查：`check-doc-links` 0 断链、`check-doc-placement --strict` 0 违规。

### 没测 / 不确定（必须按「不确定」读）

> ⚠️ **本表前三行已于 2026-11-03 22:5x 由主 agent 补测完毕**，结论见 §五；表中保留原「没测」记录，是为了让读者看到「谁在什么条件下验的」，不是当前状态。

| 项 | 状态 | 原因 |
|---|---|---|
| **冷启动（从零拉起实例）** | ✅ **主 agent 已补测**（原：没测） | 原阻塞原因是「要测冷启动只能先杀实例」。实际不必杀：实例当晚因保活 shell 到期自然回收，空出了冷启动窗口。补测结果见 §五 |
| 新建线程点击（`create_office_task_button`） | ✅ **主 agent 已补测**（原：没测） | 同上一行；含 `--force` 降级恢复路径，四步全 `[ok]` |
| 模式切「本地电脑」/ 档位切「自动 高」 | ✅ **主 agent 已补测**（原：没测，采信主 agent 当日实测） | 用 `--force` 强制重跑：先把 `runMode` 降到「对话」、档位降到「快速」，再跑 `bootstrap --force`，两项都被切回目标值 |
| `--project` 切换 | **没测** | 切换会改动主 agent 的项目指向；`--project` 代码路径未单独跑过 |
| 「保活」是否真的只能靠活着的 shell | ✅ 反证成立 | 保活 shell 到期（sleep 900 结束）后 9331 立即 `ECONNREFUSED`，实例随父 shell 一起走 |
| marker 模板行的其他形态 | 不确定 | 目前只挡「状态后接 `\|`」与「整段占位符」两类。若任务书写成 `## [T1] DONE（一句话说明）` 之外的花样（如 `DONE - 一句话`），**仍可能误判**；判据是启发式，不是语法级的 |

### 已知设计取舍

- `--check` 拿不到项目绝对路径（chip 常只显示项目名，路径只在项目菜单里）。这是刻意的：`--check` 不点击。要路径就裸跑或 `--keep`，JSON 里 `verified: false` 明示这一点。
- `bootstrap.mjs` 不 sleep 保活、不杀不重启，只保证「有且就绪」；保活责任写进文档 §2.1。
- 项目 chip 的定位是**位置锚点**（模式 chip 右侧第一个有文字的按钮），不是文字匹配 —— 选中项目后它显示的是项目名而非「项目」二字。

---

## 五、主 agent 验收记录（2026-11-03 22:45–22:55）

### 5.1 补测过程中改了什么（子 agent 交回后、主 agent 动的手）

| 文件 | 改动 | 为什么 |
|---|---|---|
| `scripts/doubao/bootstrap.mjs` | 新增「等待界面就绪」步骤：轮询 `snapshot` 直到**编辑器**出现（上限 `DOUBAO_UI_TIMEOUT_MS`，默认 45s） | 首次冷启动实测 `[fail] 新建线程 找不到「新工作任务」按钮` —— 端口通了但页面还在渲染（`title` 为空、`taskMode=false`）。只等端口的判据不够 |
| 同上 | `snapshot` 增加 `hasEditor` 字段，等待条件用它而不是 `taskMode` | 实例可能停在「对话」模式，那时任务输入框本就不存在；等 `taskMode` 会白等到超时 |
| 同上 | 新增 `--force` 参数（模式/档位两步跳过 `[skip]` 判定） | 幂等跳过**验不了「切得动」**：不 `--force` 时两步永远 `[skip]`，等于没测 |

### 5.2 实测结论

| 场景 | 结果 |
|---|---|
| 冷启动（实例未运行） | 六步全过：启动实例 → **等待界面就绪 约 2s** → 新建线程 → 本地电脑 → 自动 高 → 项目路径带绝对路径 |
| 降级恢复（对话 + 快速 → 跑 `--force`） | 四步全 `[ok]`：新建线程 → 本地电脑（`method=dom-click`）→ 自动 高（推理强度 → 高）→ 项目路径 `AI-writer-wt-1 C:\develop\workspace\AI-writer\wt-1` |
| 保活 | **反证成立**：保活 shell 的 `sleep 900` 结束后 9331 立即 `ECONNREFUSED`，实例随父 shell 一起回收 |

### 5.3 验收 T1–T3 的产物（wt-1，主 agent 复跑，不采信自报）

| 项 | 证据 |
|---|---|
| 测试 | 复跑三个文件：**132 passed**（`source-ref` 61 / `narrative-thread-generation-pure` 49 / `arc-placeholder-guard` 22），与它自报逐项一致 |
| 类型 | `npx tsc --noEmit` 退出码 0、无输出 |
| 落点 | `git status` 只多 4 个文件：`source-ref.test.ts`、`narrative-thread-generation-pure.test.ts`、`arc-placeholder-guard.ts`、`arc-placeholder-guard.test.ts`；既有源文件一个未动 |
| 代码抽查 | `arc-placeholder-guard.ts` 逐行扫描、`index` 用行偏移累计、豁免按「去首尾 `/` 后小写全等」判。**已知边界**：`<span class="x">` 不豁免（内部非纯标签名），JSDoc 里明示这是有意为之；接线时若输入含 markdown 生成的 HTML 需另行处理 |

### 5.4 T4 已补派完成，并推翻了 D7 的一半判断

第一轮 T4 被保活 shell 到期打断（实例回收）。22:46 重起实例 + 重新 bootstrap 后补派，22:50 完成（`[T4] DONE` / `[QUEUE] EMPTY`），三项结论主 agent 已逐处核对：

| 论断 | 核对结果 |
|---|---|
| 对话框侧调用 `computeSynopsisUnitRange` | ✅ `synopsis-unit-launch.ts:298` |
| 生成侧调用同一函数 | ✅ `architecture.command.ts:2948`，`:3052` 用其 `maxChapters` 推批次上界 |
| prompt 侧精度不同 | ✅ `arc-position.ts:960` → `Math.round(stats.maxChapters * 10) / 10` |

⇒ **D7「与对话框预告不符」不成立**（同源，只是显示精度差）；「偏保守」成立但属模型行为（写完即收），不是算法 bug。结论已写回缺陷稿 D7 的取证节与 §2 表格状态列。

### 5.5 explorer 代启失败的追查（四次对照，2026-11-03 23:00）

> **⛔ 本节结论已被推翻（2026-11-04，`662bc2d6`）—— 读之前先看这段。**
>
> 作者实测：把脚本换成**只写 `Hello World` 的空脚本，同样弹「未知发布者 / 是否运行」** ⇒ 与脚本内容无关，是 Windows 对脚本执行的策略。
>
> 所以真相是：`explorer.exe` **确实执行了目标**，只是停在那个确认框上；无人点，标记文件自然不生成、`exit=1`。**不是 shell execute 被整体阻断。** 下文表 3/4 的两条判据也一并作废：Windows 11 记事本**多标签共用进程**，新窗口不反映到进程数，`MainWindowTitle` 只读主窗口 —— 作者肉眼确认那些窗口确实打开了。
>
> 保留下文原文只为记录当时的推理链；**结论以下面 292 行那句为准**（实例必须在工具会话之外启动），这一点没变。现行口径见 `docs/agents/doubao-channel.md` §2 / §2.2。

起因：作者质疑「昨天是我做的验证，不是你手动起的」，且实测发现实例并未停 —— 逼出对启动方式的重新核对。

| # | 实验 | 结果 |
|---|---|---|
| 1 | `explorer.exe "C:\develop\...\probe-ascii.cmd"`（**ASCII 路径**，内容只写一个标记文件） | `exit=1`，标记文件未生成 |
| 2 | `assoc .cmd` / `ftype cmdfile` | `.cmd=cmdfile` / `cmdfile="%1" %*` —— **文件关联正常** |
| 3 | `explorer.exe "...\probe.txt"` 与 `explorer.exe "...\AI-writer"`（文件夹） | 两者均 `exit=1`；记事本进程数不变、无新窗口 |
| 4 | `cmd /c start "" "...\probe.txt"` | `start_exit=0`，但**无新窗口/进程** ⇒ 依赖 shell 关联的路也不通 |

**排除**：文件关联损坏 · 路径含中文 · `.cmd` 类型特有。

**结论**：explorer 的 shell execute 被整体阻断，与豆包无关。能起进程的只剩 `cmd /c start "" <exe> <参数>`（`CreateProcess` 不过 shell），但该进程仍在工具会话的 job 内。

**进程寿命实证**：两次断点精确落在保活 shell 的 `sleep` 到期时刻（22:31 / 22:56），`netstat` 从 `LISTENING` 直接变 `TIME_WAIT`。中途查到的「还在」是清理延迟窗口——这也解释了为什么「实例是停的」这个判断会说早。

**未确定（不许写成结论）**：2026-11-02 当日为何 explorer 有效。两个候选都未能证伪：① 当时进程恰好 detach 成功、未触发清理；② WorkBuddy / 沙箱策略在两日之间变化。文档按「当前不可用」写。

**由此得出的唯一解**：实例必须在**工具会话之外**启动（人手动双击 / 开机自启），本脚本此后只用 `--check` 或幂等连接。
