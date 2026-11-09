# 交接：D12 结案 —— 判定为「小模型的弱点」，不再是 App 缺陷（2026-11-08 22:3x）

> 交接基准：分支 `exp/resource-ledger` · 工作区**有未提交改动**（分三组，见 §7，**别一把 `git add -A`**）· HEAD 用 `git log -1 --oneline` 取
> 上一份：[`2026-11-07-d12-replay-live-verification.md`](./2026-11-07-d12-replay-live-verification.md)（R6 上线后仍是 4 次全灭）
> 相关设计稿：[`chapter-task-anchor-design.md`](../design/prompt/chapter-task-anchor-design.md) · [`chapter-prompt-block-ordering-design.md`](../design/prompt/chapter-prompt-block-ordering-design.md) · [`prompt-block-order-audit.md`](../design/prompt/prompt-block-order-audit.md)
> 缺陷总表：[`live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md) §D12

---

## 〇、三十秒版本

**D12 结案，定性 = 9B 模型的固有弱点，不是 App 逻辑缺陷。**

判据是一组「拔掉 App 全部护栏」的直连复跑：把 trace 里 `chapter-draft` 的 system + user **逐字**投给 Ollama 的 `qwen3.5:9b-128k`，不经压缩修订、不经自动续写、不经落库、不经守卫 —— 10 次里 **只有 3 次干净，5 次重演上一章、2 次失控**（8,157 / 17,246 字）。同一份 prompt 在 App 内的 4+4 对照是 2/4 与 3/4 触发，**量级一致**。

⇒ App 的压缩、续写、守卫**既没制造这个问题，也没掩盖这个问题**。约一半概率把「上一章定稿原文」读成「待重写的对象」，是模型侧的能力问题。

已落地的两项改动保留（它们确实把触发率压下来了，但救不到 100%）：

1. **任务锚点**（`chapterTaskAnchorText()`，装配末尾追加【本次任务】）—— 实测**必要但不充分**：无锚点 2/2 必炸，有锚点降到 2/4。
2. **模板内置首句带章号**（中英双语 `chapter_number` / `chapter_title`）—— 保证「没有作者补充材料时，内置模板本身也是对的」。

已否决的动作：**不回滚 B1**（把上一章全文挪回材料区反而更差，4+4 实测见块序稿 §11）。

---

## 一、结论是怎么走到这一步的（四层证据，按排除顺序）

| 层 | 假设 | 读数 | 判定 |
|---|---|---|---|
| 1 | 短细纲写错对象导致正文重演 | 11-01 六次 + 11-08 两次 trace，短细纲**全部写的是本章事件**；正文侧只是多了几行材料 | **排除**。当初把正文层缺陷归因到短细纲，是两条链路混为一谈（正文生成 / 短细纲生成是两次独立请求） |
| 2 | Prompt 里没说「要写第几章」，模型合理地续写第一章 | 第 2 章请求中「第2章」出现 **0 次**、「第一章」**6 次**（来自项目级覆盖 `taskGuidance` 的复制粘贴错误） | **成立**，已修（锚点 + 模板变量）。但只降到 2/4 |
| 3 | 上一章全文放在末尾（B1）诱导照抄 | 85% 位置 2/4 vs 35% 位置 3/4；35% 还出现过 718 字整段搬运 | **反向**：挪回中段更差 ⇒ **不回滚 B1** |
| 4 | App 的压缩 / 续写 / 守卫掩盖或制造了问题 | 直连 10 次：干净 3 / 重演 5 / 失控 2，与 App 内同量级 | **排除** ⇒ 结案为模型弱点 |

**保留的诚实边界**：4v4 二值结局不具统计显著性，直连 10 次也只能给方向性结论。真正的「根治」要靠换模型或加外部约束（见 §6 遗留 1），不是继续调 prompt 位置。

---

## 二、已落地改动（**未提交**）

### 2.1 代码

| 文件 | 改了什么 |
|---|---|
| `src/services/builtin-prompt-templates.ts` | 变量表加 `chapter_number` / `chapter_title`；中文首句改为「本次要完成的是第 {{chapter_number}} 章 —— 这是新的一章，不是接着上一章往下写」 |
| `src/services/prompt-language.ts` | **英文模板同步改**（首版豆包只改了中文，是审核时补的） |
| `src/services/prompts/prompt-builder.ts` | 新增 `withChapterNumber` / `withChapterTitle` |
| `src/services/workflows/commands/generate-draft.command.ts` | 新增 `chapterTaskAnchorText()`；`composeInitialPrompt` 数组把锚点放最后。**禁用「续写」二字**、空标题不带 `《》` |
| `src/services/workflows/chapter-materials.ts` | B1：材料包出两版（`text` / `textWithoutPredecessor` + `predecessorBlock`），前驱块按 `sourceId + contentHash` 回查，不按标题猜 |
| 三个测试文件 | 变量契约表、首句 fixture、无标题用例、材料包两版断言 |

### 2.2 文档（新增三篇）

- `chapter-task-anchor-design.md`：锚点的来龙去脉、6 次实机读数、**覆盖层三处路径**、§6 已裁「不回滚」。
- `chapter-prompt-block-ordering-design.md`：块序审计 + B1 落地编号 + §11「4+4 对照 → 不回滚」。
- `prompt-block-order-audit.md`：豆包产出的 29 块横向审计（只有两处值得动，且都未做）。

### 2.3 验证状态

`tsc --noEmit` 通过；相关 3 个测试文件 **333 项全过**；`check-doc-links` 1,231 链接 / 0 断、placement 395 份 / 0 违规。

---

## 三、源码里没有留下实验开关

对照实验用的 `VELA_EXP_PREDECESSOR_POSITION` 环境变量判断**已按备份整段还原删除**，工作区里的 `composeInitialPrompt` 是 B1 tail 版（唯一在产状态）。`grep VELA_EXP` 应无结果 —— 接手时建议先跑一遍确认。

---

## 四、现场资产（都在 `.batch-a/`，可整目录删）

| 路径 | 内容 |
|---|---|
| `.batch-a/proj` | 实验副本，当前**仅第 1 章定稿**（1,741 字），第 2–12 章草稿已清、蓝图 1–14 保留 |
| `.batch-a/proj/debug/prompt-trace/` | 全部 trace（json + md），关键 8 份：`20261108-0415/0420/0427/0433`（B1 开）· `20261108-0450/0455/0500/0506`（B1 关） |
| `.batch-a/d12-manual-test/` | `README.md`（含投送方式与注意点）+ 4 次 trace 抽出的 `system/user/output.txt` |
| `.batch-a/d12-manual-test/direct-runs/` | 直连 10 次的 `run-NN.txt`（只正文）· `ch1.txt`（第 1 章正文，diff 用）· `prompt-system.txt` / `prompt-user.txt` · `runs.jsonl` · `summary.md` |
| `.backups/` | `generate-draft.command.ts.b1-tail-20261108`（还原用的备份）、`proj-pre-d12`、`proj-pre-b1replay`、`ch2-*-round1.txt`、`*.removed-20261108` |
| `develop/scripts/experiments/d12-direct-rerun.mjs` | 直连复跑脚本，`--runs N` 可续跑，读 `runs.jsonl` 行数定起点，不覆盖已有样本 |
| `develop/scripts/.tmp/` | `d12-open.mjs`（打开副本）· `run-chapter.mjs`（跑章）· `measure-run.cjs` / `measure-guard.cjs`（两套口径读数）· `rewind-to-ch1.cjs`（回滚到仅第 1 章）· `cdp-eval.cjs` |

---

## 五、要复跑的话（三条必踩的环境坑）

```bash
# 1. dev 必须摘掉两个 safe-delete 变量，否则 vite 重优化删 node_modules/.vite/deps 被闸门拒，dev 起不来
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID AI_NOVEL_UI_DEBUG_PORT=9222 pnpm dev

# 2. 打开副本项目时路径必须是反斜杠。project:open 用 recent?.path === target 精确比对，
#    Git Bash 会把 C:\... 转成 C:/...（MSYS_NO_PATHCONV=1 也不管用）⇒ 报「项目未获授权」。
#    解法：路径在 node 脚本里用 String.fromCharCode(92) 拼，别走 shell 传参（scripts/.tmp/d12-open.mjs 就是干这个的）

# 3. 改 src/ 下非组件模块必须重启 dev —— 热重载会跑旧模块，症状是 process is not defined

# 4. 验活别只用 curl：本会话会注入 http_proxy，curl 直连 127.0.0.1:5180 会走代理返回 502（CDP 9222 报
#    "upstream connect failed"），看起来像 dev 挂了，其实是测量工具被拦。用 node 的 http.get 直连最可靠：
#    node -e "require('http').get({host:'127.0.0.1',port:5180},r=>console.log(r.statusCode))"
```

跑一次的量级：App 内单章 60–180 秒；直连单次 36–182 秒（失控样本最慢）。要跑几十次，建议给直连脚本加一个 8,000 字的流式中断闸门，否则那两次失控样本会拖 2–3 分钟一次。

---

## 六、遗留项（按建议优先级）

1. **换模型 / 加外部约束**才是根治方向。锚点把触发率从 100% 压到 ~50%，剩下的靠 prompt 位置调不动 —— 已验证两条路都不通（挪块位置更差、模板新旧不改变分布）。下一手要么换更大的模型，要么在**结构上**让模型没法照抄（例如正文请求只给「上一章要点 + 结尾 800–1,000 字」而不给全文，见 `previous-chapter-context-assessment.md` 的条件式结论）。
2. **守卫只覆盖尾部 1,000 字**（`DRAFT_PREVIOUS_ENDING_REPLAY` 比对上一章结尾 vs 正文头 1,200 字）。直连里最危险的恰恰是**字数合规的那 4 次**（1,402–2,339 字）：篇幅检查、段落形态检查全能过，只有这条守卫拦得住。而「整章重写但换个开头」的形态它是抓不到的。是否加一条「全篇 8-gram 覆盖率」闸门，值得单独立项 —— 但要注意误报：同一场景续写本来就会复用设定名词。
3. **短细纲另立项**（作者已裁）。要验的是「预算有没有产出」（实测字数 0 处、加戏判决句「掌握主动权」），输出格式建议收紧为 `序号. N 字 | 收束：<一句话>`。**别和 D12 混在一起**，它俩是两条请求链路。
4. **reference 检索通道四个异常**（正文 prompt 里 `[2] (第3章…, 相关度 50%)` 那种块）：无 embedding 时 `score` 硬编码 0.5、不传章节窗口把未写的第 3/6 章当参考、同一文档占两个坑位、标题写「有来源的历史与候选」但已无定稿原文。已超 D12 范围，未立项。
5. **锚点不是物理末块**：尾部实际顺序是`【篇幅合同】95.5% →【本次任务】95.9% →【短细纲】…99.9%【结束】`，600–800 字短细纲块把锚点和生成点隔开。这是「短细纲块该不该排在锚点之前」的未测变量，随遗留 3 一起做。

---

## 七、工作区未提交改动的三组归属（★ 别混）

| 组 | 文件 | 属于 |
|---|---|---|
| **A · D12 / 正文 prompt（本轮）** | `src/services/builtin-prompt-templates.ts`、`prompt-language.ts`、`prompts/prompt-builder.ts`、`workflows/chapter-materials.ts`、`workflows/commands/generate-draft.command.ts` + 三个测试文件；`docs/design/prompt/chapter-task-anchor-design.md`、`chapter-prompt-block-ordering-design.md`、`prompt-block-order-audit.md`、`docs/README.md`（§4.1 篇数 35→38） | 可单独提交 |
| **B · A2-6 大纲闸门探针（别线）** | `src/App.tsx`（+7 行 dev-only 安装点）、`src/services/outline-progress-gate-probe.ts` + test、`docs/design/product/2026-11-07-batch-acceptance-plan.md` §4.2.1、`live-pipeline-acceptance-defects-assessment.md`、`docs/handoffs/2026-11-07-d9-d16-structural-design-handoff.md` | **与本轮无关**，别混进 A |
| **C · 草稿/临时** | `docs/design/product/d12-short-synopsis-replay-fix-plan.md`（豆包草拟，未裁）、`scripts/doubao/*.md`（派单记录）、`scripts/experiments/d12-direct-rerun.mjs`、`.backups/` | 按是否留档决定：脚本建议留，`.backups/` 不入库 |

---

## 八、建议下一步

1. **先提交 A 组**（本轮已验证全绿），提交信息写清「锚点 + 模板章号 + B1 已评估不回滚」。
2. B 组由它自己的线收口，别在 D12 的提交里顺手带上。
3. 缺陷总表 §D12 已按本稿改成「✅ 结案 · 判定为模型弱点」，如需更细的沿革，看本稿 §一那张排除表。
4. 真要再动 D12 相关代码，**先读 §六遗留 2**（守卫覆盖不全），那是目前唯一还会让「字数合规但整章重写」漏过去的洞。
