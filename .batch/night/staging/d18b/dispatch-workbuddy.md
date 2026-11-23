From: 大肥鱼 · AI writer项目组（admin）
To: WorkBuddy · AI writer项目组（经 workbuddy联络人 投递）
卡号：D18b｜派单方：大肥鱼 · AI writer项目组（群 admin）｜起点：`ff914aea`（develop 主线，只读，不改）

# 外派件标准头（S5 起，豆包与 WorkBuddy 逐字带，不分成两套）

## 0 必读与确认（先回四行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/{copilot,workbuddy,doubao,task-board}-channel.md` 中与本次任务对口的一份；⑤派单正文点名的卡面或设计稿。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：是否「工作模式」（不是「对话模式」）、当前模型名与档位（派单点名要求 `DeepSeek v4.1 Flash`，写成「快速」或其它低档一律算不合格）

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node node_modules/vitest/vitest.mjs run <单文件>`，或派单点名的 `pnpm test <单文件>`。
- 只改本卡白名单文件，不新增文件，不动 `.batch/*` 任何件；不 push 到 mainline，不 tag，不 `git add -f`，不 `--no-verify`；分支与 push 权限以派单明写为准。
- 改删除语义，不扩白名单，不串别的卡；**一卡一会话**，做完即停，不在同一会话里接下一张。
- **模式闸**：开局必须是「工作模式」＋派单指定模型（默认 `DeepSeek v4.1 Flash`）。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞，除非派单明写允许落地。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行是身份头，第四行是 §0 的第四问（模式与模型），缺任一行按可疑件退回：

```
From: <卡号>-<豆包|WorkBuddy>
To: 大肥鱼@主身
卡号：<卡号>｜会话标识：<新会话首次时间或会话 id>｜起点：<sha>
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

> **回执落点（11-23 补注，按主身实测）**：`.batch/night/*` 整树已被 `.gitignore:93` 忽略，回执**直接落** `.batch\night\bridge\to-owner`，写进去 `git status` 看不见、不会破「porcelain 零行」。此前「留暂存目录等派单方代落」的自保做法作废，不必再提。

---

# 任务：D18b 的 seed 夹具脚本与取证脚本（只写脚本 + Dry-run，**不跑实机**）

## 定位

你是本卡**唯一外派位**（草案 `.batch/night/staging/d18b-arch-pregate-draft.md` §4.3 的 ②）。实机取证由组内 developer 跑，**不归你**：你交脚本，他跑。你不起 Electron、不出判据、不写 evidence、不写判词、不碰仓库文档与看板。

## 先读这三份（都在本仓，只读）

1. `.batch/night/staging/d18b-arch-pregate-draft.md`（v1，113 行／15,275B／`sha256 cb0bc4d0…`）——卡面口径，尤其 §2（三件 seed）、§4.1（唯一 `[live]` 判据）、§4.3②（你的交付边界与验收）。
2. `.batch/night/staging/d18b/impl-package.md`（v1，127 行／11,867B／`sha256 47a2a4a8…`）——**字段与取值的唯一依据**，已给到「`文件:行`＋字段＋取值」。凡与卡面冲突，以本包为准并回报冲突点。
3. 基线脚本 `../wt-d18/.runtime/s5-live.mjs`（另 `../wt-d18/.runtime/s5-live2.mjs` 可作写作入口种子参考）——**只准读，不准改**。

## 交什么（三件，落 `C:\tmp\s5-outbound\d18b\workbuddy\`）

1. `seed-pre.mjs`
   - 自建临时项目目录 `C:\tmp\s5-outbound\d18b\workbuddy\proj\`（含独立 `.ai-novel/` 与临时库副本），**不得写作者真实项目目录、真实库、`develop` 的 `.ai-novel/`**。
   - 按 impl-package §2 落三件：`.ai-novel/partial_arch.json`（两键取值以 `planUnitStats` 算通为准）、`plotStructurePlan`（2 卷 12 章、卷 1 两个单元各 3 章的最小形态）、以及 D5 同趟需要的 1–5 章 finalized 连续序列＋第 6 章蓝图（impl-package §2.3；本卡 D18b 本身可省，但两卡共用一趟实机，必须 seed）。
   - 打印 `synopsis_covered_to`、`synopsis_unit_cursor`、`planUnitStats` 三个实际值。
2. `run-live.mjs`
   - 以 `s5-live.mjs` 为基线改：arch 段按 impl-package `:366-372` 改法——点「AI 生成」前先取 `seedSha256`（`sha256sum` 原文）、`generateOpened` 取点击返回、`gapTextSeen` 用 `/单元定位失败|没读到.*partial_arch\.json/` 判命中并截 200 字原文；**不再点「开始生成」**。D18 写作段（`:202-:362`）按 impl-package `:92` 处理：D5 需要的写作入口段保留且排在 arch 段之后。
   - 脚本要能被 developer 一键单实例跑完即关，evidence 字段按草案 §5 列全。
3. `seed-dryrun.log`：`node --check` 两个脚本的输出原文 ＋ Dry-run 打印的上面三个实际值。

## 验收（你自己跑完再交）

- `node --check seed-pre.mjs && node --check run-live.mjs` 通过；
- Dry-run（只跑 seed 与打印，**不启动 Electron**）输出三件实际值原文；
- 仓内零改动：`git -C C:\develop\workspace\AI-writer\develop status --porcelain` 不含你任何一行，`git diff --numstat HEAD` 为空。

## 硬边界（违一条即退回）

- 不起 Electron 实机、不跑全量测试、不 `pnpm install`、不切 ABI；
- 不 commit、不 push、不 tag、不动 `develop` 与任何 worktree、不动 `.batch/` 里任何件；
- 不自改 impl-package 的字段与取值；发现取不通就**停手回报**，不许自己换一套；
- 一卡一会话，做完即停；产物目录只写你自己的 `workbuddy\`（豆包不与你共目录）。

## 回报

四行回执头（§0.2）＋ 三行正文：产物三元组（路径／行数或字节／sha256 前 8）＋ `node --check` 结果 ＋ Dry-run 三值原文。回执走 `.batch\night\bridge\to-owner`，并在群里 @ 大肥鱼 一行摘要。

**时限：25 分钟**。到点没交，群里代落并写明原因。
