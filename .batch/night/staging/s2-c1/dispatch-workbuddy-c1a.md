# 外派派单 · PLANUI S2 · C1-a 相关性筛选＋排序（卡 744f13a8）

## 0 必读与确认（先回四行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/workbuddy-channel.md`；⑤本派单点名的设计稿 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md`（只读 §3、§5、§6 的判据 1–2、§7）与实施包 `.batch/night/staging/s2-c1-impl-package.md`（§2.1 第 1／2／11 项、§2.2 第 12 项、§4.1、§5 的 M1）。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：是否「工作模式」（不是「对话模式」）、当前模型名与档位（派单点名要求 `DeepSeek-V4.1-Flash`，写成「快速」或其它低档一律算不合格）

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node scripts/run-tests-electron.mjs <单文件>` 与 `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <单文件>`。
- 只改本卡白名单文件（§2），不新增白名单外文件，不动 `.batch/*` 任何件；不 `git add -f`，不 `--no-verify`，不 tag。
- **必须新开会话**：本次一律开新会话，不得复用任何既有会话（含 `80d99a74`、`60e73cbf`）；复用旧会话的产出不采信。
- **模式闸**：开局必须是「工作模式」＋ `DeepSeek-V4.1-Flash`。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 分支只准 `card/s2-c1-relevance-and-diff`：可在该分支 `commit`／`push`；**禁 merge、禁 rebase、禁 tag、禁 push 任何其它分支**（含 `main`／`master`／`exp/*`）；禁碰 `C:\develop\workspace\AI-writer\develop` 目录。
- 一卡一会话，做完即停，不在同一会话里接下一张。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行是身份头，第四行是 §0 的第四问（模式与模型），缺任一行按可疑件退回：

```
From: C1A-S2-WorkBuddy
To: 大肥鱼@主身
卡号：744f13a8-7a5c-49dc-beab-9e0d7259cc4e｜会话标识：<新会话首次时间或会话 id>｜起点：95a30ae6
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

## 0.3 步骤 0 · 起点闸门（已由联络人预置，开工第一件事是核它）

wt-2 已由联络人切好：分支 `card/s2-c1-relevance-and-diff`、HEAD `95a30ae6`、工作树 `porcelain 0` 行。**你不再 `git switch -c`，也不要 `git switch` 到任何别的分支。**

开工第一条命令（三项原文必须贴回执）：

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | wc -l
```

判据：分支名逐字 `card/s2-c1-relevance-and-diff`、HEAD 逐字 `95a30ae6`、行数 `0`。**任一项不符 → 立即停手，不写文件、不 `git add`、不 commit、不 push**，回执只写三项原文与停手原因。

---

## §1 任务一句话

只做 **C1-a**：在角色列表加「三档相关性筛选 + 命中原因标签 + 两档排序」，判据只到 J1／J2；**不碰 C1-b** 的字段级 diff、三选一、快照表 M31、回退与任何 IPC 新通道（C1-b 在本卡回执后另派）。

## §2 白名单（4 文件：3 新增 1 修改，多一个文件都算越界）

**明文例外**（覆盖 §0.1 的「不新增文件」）：本卡必须新增下面 3 个文件，除此之外不得新增任何文件。

| # | 路径 | 动作 |
|---|---|---|
| 1 | `src/shared/character-relevance.ts` | **新增**：纯函数三档命中 + 两档排序比较器 + 每行原因（最多 2 条，其余收 `+N`） |
| 2 | `src/shared/__tests__/character-relevance.test.ts` | **新增**：J1／J2 的单测（含 5 卡夹具与排序） |
| 3 | `src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx` | **新增**（admin 11-24 05:2x 裁 A 追加授权）：组件面 J2 断言，harness 结构照同目录既有 `CharactersView.search.browser.tsx` |
| 4 | `src/components/panels/sidebar/CharactersView.tsx` `:143-167`、`:196-205`、`:208-245` | **修改**：顶部三档勾选 + 排序单选；行内在 `:239` 副标题下方加命中原因一行 |
| 5 | 回执文件（§7） | 新增，放 `C:\tmp\c1-s2\workbuddy\receipt-to-owner.md`，**不在仓内** |

**第 3 项的三条边界**（admin 原话口径）：①只能落在 `src/components/panels/sidebar/__tests__/` 下，只新增这一个文件；②**不得修改既有的 `CharactersView.search.browser.tsx`**，也不得改动该目录下除 `__screenshots__` 以外的任何既有文件；③只允许单文件运行，禁全量 `test:browser`，跑不起来按 §4 写「未跑成＋报错原文」并标 `[mock]`，不许拿 mock 冒充 `[live]`。

**禁改**（出现即越界）：`src/components/panels/sidebar/CharactersView.tsx` 的 `:62-71` 搜索/分页结构、`:96-101` 全选语义；`src/components/characters/CharacterProposalSelectionPanel.tsx`、`src/services/character-proposal-choices.ts`、`src/shared/ipc-channels.ts`、`electron/controllers/db-controller.ts`、`electron/migrations/**`、`electron/services/character-proposal-service.ts`、`src/components/dialogs/ArchitectureConfirmDialog.tsx`（P6 独占）、`src/shared/character-roster.ts`、`src/shared/character-proposal.ts`、任何 `.batch/*`。

白名单内**不得新增 IPC 通道、不得改 preload**。若现有 preload 已暴露的读通道拿不到档②／③ 数据（蓝图同步记录、项目核心三串），**先停手回报**，不许扩白名单、不许自己加通道。

## §3 口径（五条，逐条照做）

1. **三档并集，默认全开＝不筛**：① 有关系对象＝`relationships` 非空；② 被蓝图声明＝名字出现在蓝图角色同步记录；③ 名字出现在项目核心 `synopsis`／`plot_structure_plan`／`worldbuilding` 三串之一。任一命中即「有剧情」，不做交集／排除器。
2. **只标不勾**：三档只决定「显示与标签」，`picked` 只能由作者点选或全选按钮改变；`:96-101` 语义不动。
3. **匹配口径**：中文逐字子串；英文大小写不敏感；v1 不做别名／代称。每行最多 2 条原因，其余收「+N」，可展开完整原因。
4. **档②数据未就绪（新项目无蓝图）时该档命中恒空**：不报错、不当作全不中、不隐藏任何卡；全部未命中的卡显示「无剧情线索」，**仍在列表**。
5. **排序两档**（单选，默认「有剧情优先」）：`有剧情优先`＝命中档数降序 → 名字；`名字`＝按名字排序。v1 **不做「最近出场」**（无该字段、不做正文扫描）。

## §4 判据（只这两条属本卡）

| # | 层 | 判据（可判形态） | 证据 |
|---|---|---|---|
| J1 | [static] | `src/shared/character-relevance.ts` 导出纯函数 `characterRelevanceHits(entry, ctx)`，返回 `('relationship'｜'blueprint'｜'outline')[]`；无 IO、无 `import` 自 `electron/`／store／`window` | 文件 + `tsc --noEmit` `EXIT=0` |
| J2 | [mock] | 5 张卡（仅关系／仅蓝图／仅大纲／全不中／全中）→ 命中标签逐行符合设计稿 §3.1、§3.2；每行最多 2 条 + `+N`；未命中显示「无剧情线索」且仍在列表；三档全开时结果集＝未筛；关掉某档只减不隐；排序两档各有用例；全选语义不变 | `character-relevance.test.ts` + 组件侧断言 |

J2 至少覆盖这 8 个断言点并在回执里逐条对号：①三档全开结果集＝全集；②关档只减不增、不隐藏未命中；③仅关系命中只出「有 N 条关系」；④仅蓝图命中只出「蓝图声明过」；⑤仅大纲命中只出「出现在大纲／世界观」；⑥全不中出现「无剧情线索」；⑦原因最多 2 条 + `+N`；⑧排序「有剧情优先」按命中档数降序、「名字」按名字，并保持稳定。档②空数据（无蓝图）单列一条：不抛错、不误判为全不中。

> `CharactersView` 是 `.tsx`，组件级断言可用既有 browser 测试配置跑新增用例；若不能在不改白名单外文件的前提下加载组件，就在回执里写明「J2 的组件面未跑成 + 报错原文」，**不得用纯函数单测冒充组件断言**。

## §5 变异（至少 2 发，每发必须转红并写红掉的用例号）

| 号 | 靶 | 改法 | 期望转红 |
|---|---|---|---|
| M1 | 档② 蓝图未就绪守卫 | 删掉「同步记录为空 ⇒ 该档不产命中」守卫，改成抛错或恒标命中 | J2 的「无蓝图不报错」用例 |
| M2 | 三档并集语义 | 把并集改成交集（`hits.length === 3` 才显示），或把默认全开改成默认全关 | J2 的「三档全开＝全集」用例 |
| M3（可选） | 只标不勾 | 初始化时把命中卡自动塞进 `picked` | J2 的「全选语义不变」用例 |

两发全部 `git checkout --` 回滚后复跑同值，回执里贴「变异前红行 → 回滚后绿行」原文与 `git rev-parse HEAD`。只红 0 条按「断言空」退回。

## §6 命令（自测原文贴回执）

```
node scripts/run-tests-electron.mjs src/shared/__tests__/character-relevance.test.ts
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
node scripts/check-fast.mjs
```

汇总行必须出现 `Tests N passed`（不接受 `-t` 过滤）与 `CF_EXIT=0`。`pnpm check:fast` 在无 TTY 会 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，此时用上面的 `node scripts/check-fast.mjs` 等价入口并在回执注明。

> 已裁（admin 11-24 05:2x，A 追加授权）：第 2 条可跑，文件见 §2 第 3 项，**只准单文件运行**，禁全量 `test:browser`；跑不起来按 §4 写「未跑成＋报错原文」并标 `[mock]`，不得把 mock 写成 `[live]`。

## §7 交付形态与回执

- 起点：`95a30ae6`（`git rev-parse HEAD` 原文贴回执）；分支 `card/s2-c1-relevance-and-diff` **已存在且已检出**（见 §0.3），直接在其上工作，禁止新建／切换分支；在该分支上**一笔 commit**，commit message 以 `C1-a:` 开头，正文写明 J1／J2 与本卡号。
- 不做 C1-b、不建 M31、不写快照、不改 IPC；不合并、不 tag。
- 回执落 `C:\tmp\c1-s2\workbuddy\receipt-to-owner.md`（本卡产物目录；`.batch/*` 你不可写），内容至少：四行头、`git rev-parse HEAD` 与父 sha、`git diff --numstat <起点> HEAD`、porcelain 原文、J1／J2 逐条对号、两发变异红/绿原文、§6 三条命令汇总行、`check:fast` 原文、未做项与原因。
- **另加五行（admin 11-24 05:2x 要的，缺一按未交）**：`git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD`、`git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD`、`git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | wc -l`、`git diff --stat 95a30ae6 HEAD` 原文、三个新增文件各自 `sha256sum` 原文。
- 若发现自己在 `switch -c` 或切到了别的分支，立即停手并把三项原文报回，不得继续。
- 自报「已落盘」不算交件：我会自己核路径、字节、sha256、提交与 porcelain，核不过按未交处理。

## §8 本卡不做

- 不做字段级 diff、三选一、逐字段回退、快照表（C1-b 另派）。
- 不做「最近出场」排序、不做别名／代称、不做交集／排除、不加索引表、不改决策类型、不动 `ArchitectureConfirmDialog`、不碰 P6 章区间。
- 不需要真实模型调用；如确实需要，只准走 Magpie `group/ai-novel`（`http://127.0.0.1:3425/v1`），禁 `group/deepseek`。

## §9 admin 口径

- C1 拆两笔提交、C1-a 先交先验：C1-b 不得在本卡回执前开工。
- 回退入口留在确认屏（属 C1-b），本卡不涉及。
