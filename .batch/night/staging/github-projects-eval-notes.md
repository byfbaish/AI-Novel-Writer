# GitHub Projects 适配评估 · 资料篇（v1）

- 作者：大肥鱼（大管家）
- 时间：2026-11-15 03:20
- 目的：主人提出「项目长线规划管理」缺全局视野，需先查 GitHub Projects 是否适合我们；**本篇只摆事实来源，不下用法结论，不实操**。
- 方法：官方文档 + 官方 changelog 只读检索，未在工作区或仓库里创建任何 Project。

## 一、硬事实（带来源）

| # | 事实 | 来源 |
|---|---|---|
| 1 | Project 是「表格 / 看板 / 路线图」三种视图，架在 issue 与 PR 之上；可按字段筛选、排序、分组、切片，可存多个视图 | [About Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) |
| 2 | 与 issue/PR **双向同步**：在 Project 改 assignee、状态，issue 里同步变；反之亦然 | 同上 |
| 3 | 每个 Project 条目上限 **1,200 → 50,000**（2025-02 起公开预览） | [changelog 2025-02-26](https://github.blog/changelog/2025-02-26-increased-items-in-github-projects-now-in-public-preview/) |
| 4 | Insights（当前态 + 历史图表）**对全部套餐免费**，不再按付费档位限制 | 同上 |
| 5 | 内建 workflow **只动 Status 字段**：条目加入→Todo、issue 关闭→Done、PR 合并→Done；另有「按筛选条件自动加入」「按条件自动归档」 | [Using the built-in automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations) |
| 6 | 更复杂的自动化只能走 **GraphQL API** 或 **GitHub Actions**；Projects **没有 REST 接口** | [Using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects) |
| 7 | **子 issue**：每个父 issue 最多 **100 个**子 issue，最多 **8 层嵌套**；父/子进度在 Project 里可见、可筛可分组 | [Adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) |
| 8 | issue 侧已有：依赖关系（issue dependencies）、issue 类型（types）、issue 字段（fields）；types/fields 2026-11 起对个人账号开放 | 文档导航 + [changelog 2026-11-11](https://github.blog/changelog/2026-11-11-issue-types-and-fields-are-available-for-personal-accounts) |

## 二、对照我们的实际需求（我的判断，供主人参考）

### 能补上的
1. **全局视野**：路线图视图 + 依赖关系 + 8 层子 issue，正好补「现在不知道处在哪个阶段」这件事——阶段可以当字段，卡号可以当 issue 标题前缀。
2. **与 bug 流程天然对齐**：我们刚定的 `bug-lifecycle-v1` 状态机（open→triaged→fixing→in-review→verified→closed）可以直接映射成 Project 的 Status 选项，不用另造一套词。
3. **可脚本化**：GraphQL 能读能写，我们已经有脚本化习惯（relay、attach、ledger），接得上。
4. **零成本**：私有仓库 + 全部视图 + insights 都免费。

### 补不上的（关键）
1. **它不装资料**。我们的输入/输出是**文件**：规格卡、派验单、报告、信号、台账。Project 条目只能写标题、正文、字段、链接；产物仍要在仓库或本地。所以「阶段该交什么资料」这件事，Projects 帮不上，仍要一张**清单**（这才是主人真正缺的那件东西）。
2. **门禁要靠人守**。内建 workflow 只能改 Status，做不到「没派验单不许进 QA」「没回读远端不许算发布」这类规则；要自动拦，得自己写 Actions/GraphQL，等于把群里的纪律再实现一遍。
3. **状态会双写**。状态一旦同时存在 `GitHub Project` 和 `.batch/night` 台账里，就是两次写、两个事实源——和 11-14 的 #5 双写事故同型。要么单向（本地写 → GitHub 只读镜像），要么承认 GitHub 是唯一源、本地台账停写。
4. **它驱动不了群**。Project 变了不会唤醒 Bot，通知仍要走 relay / 群消息。

## 三、三种可选路径（都不动手，等主人点）

**A. 只读镜像（我倾向）**
本地 `.batch/night` 仍是唯一事实源；脚本每天/每次结项把卡与状态单向推成 GitHub issue + Project 条目，给主人一个「打开就能看全局」的窗口。好处：零双写风险，可视化立刻有；坏处：GitHub 上是只读，不能在上面拖。

**B. GitHub 为唯一源**
卡、状态、阶段全搬到 issue/Project，本地台账改为缓存。好处：真正单一源、天然可审计、外部协作友好；坏处：改动量大，群内流程要重写一轮，且离线/断网时全停。

**C. 只做「资料清单」不碰 Project**
先解决主人点出的真问题——每个阶段 input 什么、output 什么、结项交什么——落成一份清单（可以挂在 bug-lifecycle 旁边）。Project 暂时只当可视化候选。好处：最省、直接命中痛点；坏处：全局视野仍是文件里的，不是看板。

## 四、若要试，怎么试才不伤主线

1. 先用**一个项目**（插件线已结项，适合当样本，或主线 AI-writer）建一个只读镜像 Project，**只放已完成的历史卡**，验证「视图是否有用」。
2. 不接任何自动写回；不新增双写。
3. 观察一周：主人是否真的会打开它。若一周不开，说明要的不是看板，是清单（走 C）。

<!-- DONE -->
