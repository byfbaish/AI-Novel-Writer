# GitHub Projects 适配评估（P52 · 核 + 补）

> 执行方：产品经理｜类型：B 类（只写 staging，无仓库提交）
> 上游资料篇：`.batch/night/staging/github-projects-eval-notes.md`（5,507B / 52 行 / `53A5267762504EE65D99701909C8D724`，下称「资料篇」）
> 方法：只读官方文档与官方 changelog，未创建 Project、未点任何按钮、未动 issue。时间为 2026-11-15。

## 0. 结论先说

**Projects 装得下「看得见」，装不下「该交什么」与「不许过」。** 六问里只有 2 条可判「能」，2 条「部分能」，2 条「不能」——决定用不用它的是后两条（门禁、结项留痕），而那正是主人真正缺的那层。

## 1. 逐条核资料篇的八条事实

| # | 资料篇结论（行号） | 核验结果 | 差异 |
|---|---|---|---|
| 1 | 表格/看板/路线图三视图，架在 issue/PR 上，可多视图（:12） | **成立**。官方原文：a project is "an adaptable table, board, and roadmap"，可 filter/sort/slice/group 并存多视图 | 无。补充：除三布局外还有「insights 图表」 |
| 2 | 与 issue/PR 双向同步（:13） | **成立**。"This integration works both ways"，在 Project 改 assignee，issue 同步变 | 无 |
| 3 | 条目上限 1,200 → 50,000（:14） | **成立**。正式文档也写了「maximum of 50,000 items」，不只 changelog | 无 |
| 4 | Insights 全套餐免费（:15） | **成立**。changelog 原文 "removing paid gating entirely" | 无 |
| 5 | 内建 workflow 只动 Status：加入→Todo、关闭→Done、PR 合并→Done，另有自动加入/自动归档（:16） | **成立**。官方第一句就是 "update the **Status** of items" | 无 |
| 6 | 更复杂自动化只能 GraphQL 或 Actions，**没有 REST**（:17） | **前半成立、后半部分成立**。文档只给 GraphQL（含 curl/gh 示例）；REST 侧只有已弃用的 Projects (classic) | 「没有 REST」是**推断**（v2 未提供 REST 文档），不是文档原句；写脚本时按 GraphQL 规划即可 |
| 7 | 子 issue 每父最多 100 个、最多 8 层（:18） | **成立**。原文 "up to 100 sub-issues per parent issue and ... up to eight levels" | 无 |
| 8 | issue 侧已有依赖、类型、字段；types/fields 2026-11 起对个人账号开放（:19） | **成立**（changelog 2026-11-11 标题即此） | 无。补一句：issue fields 是**组织级/用户级**，跨仓库共享同一套字段定义 |

**核不动的**：资料篇未写「模板会复制什么」，我补核为「视图与自定义字段可复制，items / 协作者 / 团队与仓库链接不复制」（官方 copying-an-existing-project）。除此之外**无 unknown**。

## 2. 补四项（负责人点名）

### 2.1 一个「阶段」能不能承载「进阶段要哪些件 / 出阶段要交哪些件」，且能被检查

**能承载，不能自检。**

- 承载方式：阶段做成 `single select` 字段（选项=阶段名），条目上再用 `text`/`number` 字段挂「输入件」「输出件」的**说明或链接**；每个阶段一套 view 用 filter 切出来。文档确认这些字段类型都存在，且 single select 的每个选项可带描述与颜色。
- 局限性（关键）：字段只能存**文本或链接**。我们说的「件」是文件——规格卡、派验单、报告、信号。Project 不装文件，链接能把人送过去，但**「链接指向的文件是否真的存在、是否齐」Project 不知道**，也不会去核。
- 「能被检查」的程度：**只有我们自己写的脚本或 Actions 能检查**（GraphQL 读字段值，再回本地/仓库核文件）。Projects 自身不做任何文件校验。

### 2.2 清单未齐时能不能**阻止**进入下一阶段

**不能。内建自动化里没有任何「校验/阻止」语义。**

- 内建 workflow 的动作集合是封闭的：改 Status（加入→Todo、关闭→Done、合并→Done）、按筛选条件自动加入、按条件自动归档。文档中**没有**「字段必填」「某字段为空则不允许改状态」「条件不满足则拦截」这类能力（这是文档中查不到，属有据推断，不是文档否定句）。
- 它没有「阶段顺序」概念：Status 就是一个 single select，谁都能把它从「开发」直接拖到「结项」。Project 不管顺序、不管前后依赖。
- 要真挡住，只能二选一：① 自己写 GitHub Actions（监听 `projects_v2_item` 事件或定时，在字段不全时把状态改回去并评论）；② 不指望 GitHub，把门禁留在我们自己的脚本里，GitHub 只当显示层。**这两种都不是「Projects 的功能」，是我们自己补的。**

### 2.3 结项时能否**逐项勾选并留痕**

**部分能：勾选能做，留痕只到「状态变更」这一层。**

- 勾选：issue 正文里的 task list 是原生 Markdown，能勾；Projects 侧能看到子 issue 的进度（父/子进度字段可筛、可分组）。
- 留痕：官方明确 timeline 会记录「加入/移出 Project」与「`status` 字段的变更」，由内建 workflow 改的会署名 `@github-project-automation`。也就是说**改状态有痕，改别的字段（比如「结项清单已勾」这种自定义字段）不在官方承诺的 timeline 事件里**。
- 因此「逐项勾选 + 谁在什么时候勾的」这件事，GitHub 只能给到 issue 编辑历史与状态 timeline，**做不到我们台账那种「一行一列、可 diff、可复算」**。要那种留痕，仍得落文件。

### 2.4 一个 Project 装两个仓库；GraphQL 具体能读出什么

**跨仓：能。** 官方原文明确可以加「issues and pull requests from any organization」，一个 Project 装多仓 issue 是设计内用法；条目是**引用**不是复制（加进 Project 会在 issue 时间线留一条事件，删掉也有）。

**GraphQL 可读出的（写脚本核对够用）**：

| 读什么 | 怎么读 |
|---|---|
| 项目本身 | `organization(login){projectsV2}` / `user(login){projectsV2}` → `id`、`title` |
| 字段定义 | `node(id: PROJECT_ID){... on ProjectV2 { fields }}` → `ProjectV2Field`(文本/数字/日期)、`ProjectV2SingleSelectField`(带 options id+name)、`ProjectV2IterationField`(带 iterations) |
| 条目 | `items(first: N)` → `id`、`fieldValues`（文本值/日期值/单选值各带 `field.name`）、`content`（`Issue` 标题与 assignees / `PullRequest` / `DraftIssue`） |
| 写 | `addProjectV2ItemById`、`updateProjectV2ItemFieldValue`（单选传 optionId，迭代传 iterationId；**不能一次调用同时加条目和写字段**） |
| 事件 | webhook `projects_v2_item`（条目被编辑时推送） |
| 凭据 | 只读用 `read:project`，要写再加 `project` 作用域 |

与 `.batch/night/` 台账对接的可行性：**读得到**（阶段、状态、自定义字段、条目对应哪个 issue），所以「本地台账 → 只读镜像」在技术上没有障碍；**写回去**也做得到，但那就是双写，风险见结论。

## 3. 匹配度结论（六问）

| # | 问题 | 结论 | 一句为什么 |
|---|---|---|---|
| 1 | 能不能表达有序阶段 | **部分能** | Status/single select 能装阶段名，但「顺序」只是人的约定，系统不知道谁在前谁在后，也没法禁止跳级 |
| 2 | 输入/输出清单能否挂在阶段上并被检查 | **部分能** | 能挂文本或链接，但文件不在 Project 里；「齐不齐」只能靠我们自己的脚本去核 |
| 3 | 门禁能否挡住进入下一阶段 | **不能** | 内建自动化只有「改 Status / 自动加入 / 自动归档」三种动作，没有校验与拦截；要挡得自己写 Actions，等于把群纪律再实现一遍 |
| 4 | 结项清单能否逐项勾选留痕 | **部分能** | 能勾（task list + 子 issue 进度），但只有 `status` 变更进 timeline；「谁勾的、什么时候勾的」拿不到台账级的可复算留痕 |
| 5 | 两仓能否一个视图 | **能** | 官方支持加入任意组织的 issue/PR，一个 Project 多仓是设计内用法 |
| 6 | 机器可读 | **能** | GraphQL 能读字段定义、条目、字段值、内容对象，另有 `projects_v2_item` webhook；仅 v2 无 REST |

**合计：能 2（跨仓、机器可读）／部分能 3（阶段、清单挂载、结项留痕）／不能 1（门禁）。**

一句话：**Projects 是「看得见」的层，不是「守得住」的层。** 拿它当全局视野可以，拿它当门禁会失望——我们真正缺的那张「阶段 → 输入件 → 输出件 → 结项依据」总表，GitHub 只能显示，不能替我们定义、更不能替我们检查。

## 4. 如果不能用，缺的那层该由什么补（只写方向）

1. **清单本体**：一份文件式总表，一行一个阶段，四列「阶段 / 进入前必须有 / 出阶段必须交 / 结项依据」，每格写**文件路径或卡号**而不是描述。它是唯一事实源。
2. **可检查性**：判定器读清单、按路径核文件是否存在与是否带完成标记（我们已有 `.done` 信号与 `<!-- DONE -->` 的先例），输出「齐 / 缺哪几件」。这才叫「能被检查」。
3. **门禁**：挡在**流程入口**而不是看板上——比如说，派验单未登记就不进 QA 判定（这条我们已经在跑）。Projects 上的状态只作为镜像，不参与判定。
4. **留痕**：仍用台账文件（可 diff、可复算），GitHub 侧只在需要给外部看时做单向镜像。
5. **可视化**：等清单定稿后，再做「本地 → GitHub 单向镜像」（只推不发），避免双写；这一层可以晚做，不影响前面四件。

<!-- DONE -->
