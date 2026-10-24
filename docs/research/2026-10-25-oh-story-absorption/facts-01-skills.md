# 批 1 · 13 个 skill 职责表（机械事实）

> 状态：已采集（2026-10-25）
> 来源：`oh-story-claudecode` v0.9.0（MIT，zenstory-ai）· 采集时原件路径见 [`README.md`](README.md)
> 采集方式：Copilot CLI `DocGuard`（只读）分批读取 13 个 `skills/*/SKILL.md`，每批 3–6 个文件；逐条要求「路径:行号」出处
> 校验：抽检 3 条出处全部逐字相符；**1 处被核实推翻，见 §4「采集缺陷与修正」**
> 纪律：本文件只放**事实**。价值判断与吸收结论在 [`assessment.md`](assessment.md)

---

## 1. 13 个 skill 一览

| skill | 触发方式（字面） | 输入 | 产出 | 依赖脚本 | 关键设计点 |
|---|---|---|---|---|---|
| `story`（主路由） | `/story`、`$story`、`/story dashboard`、`/网文`、「我想写小说」「打开工作台」 | 写作需求；篇幅或书目 | 调用匹配 skill；当前书目写 `.active-book`；Dashboard 返回 URL | `scripts/dashboard-server.mjs`（仅 Dashboard） | 按意图路由 + 判定书目录 |
| `story-setup` | `/story-setup`、「准备写书」「配置写作项目」「检查写作环境」 | 检查/部署请求；无法判断时需选宿主 | `.story-deployed`；按宿主部署文件；安装报告 | `merge-claude-settings.py`、`merge-codex-hooks.py`、`merge-antigravity-hooks.py`、`generate-antigravity-agents.mjs`、`deploy-antigravity-skills.py`、`merge-project-instructions.py`、`copy-path-safety.py` | 按宿主部署 + 验收 + 写部署标记 |
| `story-review` | `/story-review`、`/审查`；模式 `full` / `lean` / `solo` | 待审章节；可选模式与目标平台 | 审查报告；`full`/`lean` 可维护 `追踪/`；分批审写 `.story-review/state.md` | `normalize-punctuation.js`、`check-ai-patterns.js`、`check-degeneration.js` | 按模式并行审查 + 降级 solo |
| `story-deslop` | `/story-deslop`、`/去AI味`、「这篇太AI了」 | 正文或路径；范围；改故事需授权 | 改正文；原稿备份 `.story/work/去味原稿/{YYYYMMDD}_{原名}` | `check-ai-patterns.js`、`check-degeneration.js`、`normalize-punctuation.js` | 三层扫描 + 按授权改稿 |
| `story-long-write` | `/写长篇`、「帮我开书」「出卷纲」「补细纲」「日更」「续写」「重写第X章」 | 规划/写作/改稿请求；按任务读设定·卷纲·细纲 | 按请求交付；排纲底稿 `大纲/排纲底稿_{单元ID}.md` | `author_memory_commit.py`、`outline_view.py`、`tracking_commit.py` | 按确认点分阶段 |
| `story-long-analyze` | `/长篇拆文`、「帮我拆这本书」「分析黄金三章」 | 小说原文或已有拆文成果 | `拆文报告.md`、`概要.md`、`快速预览.md`、`章节/`、`剧情/`、`角色/`、`设定/`、`人物关系图/`、`文风.md`、`chapter_index.csv`、`_progress.md`、`_analysis_cache/` | `inspect_existing_assets.py`、`manage_analysis_run.py` | 索引复用 + 分阶段续跑 |
| `story-import` | `/story-import`、「导入小说」「反向解析」 | 已有小说原文 + 确认的书籍信息 | `.story/work/导入记录.md`；`拆文库/{书名}/`；`设定/`、`正文/`、`大纲/`；长篇另有 `追踪/` | `tracking_commit.py` | 五阶段：分析后迁移，长短篇分流 |
| `story-long-scan` | `/长篇扫榜`、「长篇什么火」「起点排行」 | 平台/频道/榜单方向；可给榜单文字或截图 | `选题决策.md`；中间件 `扫榜聚合.md` | `scripts/aggregate-rank.js` | 多榜重复样本判趋势 |
| `story-short-scan` | `/短篇扫榜`、「短篇什么火」「知乎故事排行」 | 平台/男女频/方向；截图或链接；可附征稿要求 | `短篇扫榜结论.md`；`扫榜聚合.md`；可有 `征稿要求.md` | `scripts/aggregate-rank.js` | 情绪归类 + 同口径对比 |
| `story-short-analyze` | `/短篇拆文`、「拆这篇短文」「盐言故事拆解」 | 短篇原文 + 标题/平台 | `拆文报告.md`、`情节节点.md`、`写作手法.md`、`_meta.json`、`原文/` | 本次读取文件内未找到 | 分阶段落盘续跑 |
| `story-short-write` | `/写短篇`、「帮我写一篇短篇」「写个盐言故事」 | 目标情绪/题材；故事核、人物、反转、付费点 | `设定.md`、`小节大纲.md`、`正文.md` | `author_memory_commit.py`、`check-ai-patterns.js`、`check-degeneration.js` | 分阶段加载 + 落盘交接 |
| `story-cover` | `/封面`、「帮我做个封面」「生成封面图」 | 书名、笔名、目标平台；可选参考图 | `封面_vN.png` + 同名 `.prompt.txt`；有参考图时 `.ref.txt`；另存 `_上传.png` | 本次读取文件内未找到 | 三层提示词 + 平台裁切 |
| `browser-cdp` | `CDP`、`agent-browser`、「复用登录态」 | Chrome 连接与已有登录态 | 本次读取的文件内未找到 | `scripts/setup-cdp-chrome.js` | 复用登录态经 CDP 操作 |

---

## 2. 逐 skill 出处索引（原文行号，便于回查）

| skill | 出处 |
|---|---|
| `story` | `skills/story/SKILL.md:2-3,9-37,114-131` |
| `story-setup` | `skills/story-setup/SKILL.md:4,15-18,24,54-59,88-94,108-111,117,124` |
| `story-review` | `skills/story-review/SKILL.md:4,25-27,127-128,138,153-160,196-208` |
| `story-deslop` | `skills/story-deslop/SKILL.md:4,17,20,32,45,80,95-96,106,115` |
| `story-long-write` | `skills/story-long-write/SKILL.md:20,51-53,72` |
| `story-long-analyze` | `skills/story-long-analyze/SKILL.md:80-86,93` |
| `story-import` | `skills/story-import/SKILL.md:30-35,101-111` |
| `story-long-scan` | `skills/story-long-scan/SKILL.md:4,9,19,35-39,49,58,60,91` |
| `story-short-scan` | `skills/story-short-scan/SKILL.md:4,13-17,33,46,54,56,72,88` |
| `story-short-analyze` | `skills/story-short-analyze/SKILL.md:4,23-28,87,99,122,130` |
| `story-short-write` | `skills/story-short-write/SKILL.md:4,15-25,19-21,53,59-67,109-110` |
| `story-cover` | `skills/story-cover/SKILL.md:4,27,31,47,78-115,84,92,99` |
| `browser-cdp` | `skills/browser-cdp/SKILL.md:3,10-14,27,53,88-126` |

---

## 3. 结构化补充（长篇三件套，原文有明确答案）

### 3.1 长篇层级关系

原文（`skills/story-long-write/references/artifact-protocols.md:10`）：

> **层级关系（全书 › 卷 › 剧情单元 › 章 › 情节点；故事线横向贯穿多个剧情单元）**

单元与卷的区间（`skills/story-long-write/references/workflow-volume.md:42`）：

> | 剧情单元 | 1.5–3 万字，约 5–15 章；开篇单元偏短，但要讲完首个矛盾的因果 | 一个矛盾从起到收；单元里有两个以上独立高潮就拆成两个，不按字数拆 |

### 3.2 卷纲「作用域」机制

原文（`skills/story-long-write/references/artifact-protocols.md:50-51`）：

> 排纲底稿不进卷纲：供给自查、建纲追加写在 `大纲/排纲底稿_{单元ID}.md`
> 落盘后跑 `outline_view.py --check --strict {卷纲路径}`……取段器输出全部卷级常任段和该单元的单元级段，逐章表按单元章区间裁行，退役行默认不输出（看历史加 `--history`）

### 3.3 长篇写作的批次约束

原文（`skills/story-long-write/references/agent-calls.md:13,17`）：

> 只取输出里的任务包路径，**不读包的内容**
> 新卷纲跑 `outline_view.py --check --strict`……细纲每章跑 `check-outline-contract.js`；失败把报错原样交回**同一 agent 修一次**

---

## 4. 采集缺陷与修正（重要，防后手误用）

### 缺陷 1 · 受限检索范围内得出全局否定结论

Copilot 在只被允许读 3 个 `SKILL.md` 的情况下，对「长篇是否有卷/单元字数章数区间」回答：

> 也没有卷或单元的字数、章数区间

**该结论错误。** 原文明确写着 `1.5–3 万字，约 5–15 章`，位置在 `references/workflow-volume.md:42`——而 `SKILL.md` 只是入口，真机制在 `references/`。

- 处置：后续派活 prompt 强制区分「本次读取的文件内未找到」与「不存在」，第三组已生效
- 教训：**「没读到」不等于「没有」**。这与本项目 `DocGuard` body 里「不得凭常识补写」是同一条纪律的另一面——它不补写，但会把检索边界当成事实边界

### 缺陷 2 · 出处给的是行号区间而非单行

示例：`skills/story/SKILL.md:2-3,9-37,114-131`。核对时需读整段，抽检成本略高，但**不构成错误**（抽检 3/3 相符）。

---

## 5. 本文件未覆盖的内容（不在此处下结论）

- skill 之间的路由优先级与冲突消解规则
- 各 skill 的 `references/` 方法论文档内容（如 `story-deslop` 的三层方法）
- 脚本的量化判据（见 [`facts-02-scripts.md`](facts-02-scripts.md)）
