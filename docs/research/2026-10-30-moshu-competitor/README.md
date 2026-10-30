# 竞品评估 · 墨枢 Moshu

> 状态：初评完成（2026-10-30）· 结论见 [`assessment.md`](assessment.md)
> 这是什么：对一个**同题材竞品**（中文长篇网文 AI 写作工作台）的机制梳理与对照评审。不是设计稿，不是待办；结论要动手时另出设计稿。
> 为什么放 `docs/research/` 而不是 `docs/design/`：它不改我方代码或行为，属「外部材料消化」（[`docs/README.md`](../../README.md) §3.1 第 4 条）。
> 采集时间：2026-10-30 01:05（GMT+8）；采集时上游 `main` 最新提交日期 **2026-09-27**。

---

## 1. 评估对象

| 项 | 值 |
|---|---|
| 名称 | 墨枢 · Moshu |
| 仓库 | `github.com/huihuijiangqiang/moshu` |
| 许可 | **MIT**（`LICENSE` 1073 字节，2026-09-09 切换） |
| 在线体验 | `https://ms.moshu-novel.com/`（**未登录实测，仅据 README 自述**） |
| 形态 | **Web 应用**：Vue 3 前端 + FastAPI 后端 + PostgreSQL/pgvector + Redis/Celery，Docker Compose 自部署；另有 `Moshu.exe` 启动器（仍依赖 Docker Desktop） |
| 规模 | 479 文件 / 11.4 MB（tar.gz）；**py 277 / ts 100 / vue 41**；md 仅 **9 篇** |
| 代码量 | 后端 ≈ 7.5 万行 Python（含测试 3.45 万）；前端 ≈ 3.08 万行 TS/Vue（`app/src`） |
| 数据模型 | **69 张表**，Alembic 增量到 `045_character_full_body`（47 个迁移文件） |
| 自述测试 | 后端 1737 passed / 38 skipped；真实 PG+pgvector 集成 38 passed；前端 215 passed（**均为项目自述，未复核**） |
| 采集方式 | `codeload.github.com` 直连下载（本机沙箱对 `github.com` 主域超时，见 `notes/env-and-conventions.md`） |
| 原件 sha256 | `d77267869ca55b068a4b92fd24be85844a9ad822739370d67ff2105ad74764ea` |

---

## 2. 本目录文件

| 文件 | 内容 |
|---|---|
| [`assessment.md`](assessment.md) | **对照评审**：14 维度对照表、三个互相印证的判断、该抄与不该抄、对我方的三条警告 |
| [`facts-01-architecture.md`](facts-01-architecture.md) | 技术形态、目录分层、69 表分组、生成与一致性两条主链路的**端到端流程** |
| [`facts-02-mechanisms.md`](facts-02-mechanisms.md) | 关键机制的**常量与契约**：四层预算、claim 字段、七类规则、证据锚点、检索五级降级、章级 8 变体 |
| `vendor/moshu-main-2026-09-27.tar.gz` | 第三方原件归档（11.4 MB），含 `LICENSE` 与 `README.md` |

---

## 3. 一句话结论

**它是参照系，不是威胁。** 它把「长篇能持续推进」押在**事实不一致可机检**上（claim 层 + 七类规则 + 证据锚点），我方把同一件事押在**结构塌陷 + 角色不可判定**上（弧光 + 性格四层 + 世界状态）。两条路线不冲突、几乎不重叠，各自治的病也不是同一种病。

真正该拿走的只有 **3 个机制 + 1 条文档纪律**（见 `assessment.md` §5–§6），其余 9 成是服务端多租户基建，与我方桌面前提不相干。

---

## 4. 取证方法与可信度边界

| 做了什么 | 得到什么 | 局限 |
|---|---|---|
| 读 README（417 行）与 3 篇架构文档全文 | 设计意图、外部方案取舍、评测门槛 | 自述，可能含未落地计划 |
| 读 `server/docs/IMPLEMENTATION_STATUS.md`（1024 行）全文 | 逐模块「已实现 / 已知缺口」，**含多处自我否证** | 同样是自述 |
| **交叉验证代码**：`rule_scanner.py` / `memory/assembler.py` / `writing_skills.py` / `generation_coverage.py` / `db/models_codex.py` 等逐个 grep 常量与函数签名 | 确认自述与代码一致的地方、不一致的地方（见 `assessment.md` §2 注 2） | 抽样，非全库通读 |
| 统计行数/文件数与测试数 | 量化对照基线 | 行数≠质量 |

**没做的**（决定本稿结论强度的三个缺口）：

1. **没有登录在线站点做功能实测** —— 所有交互与 UI 结论来自 Vue 视图文件与 README 截图。
2. **没有跑它的测试** —— 1737/215 是自述数字，本稿不为其背书。
3. **没有读完全部 47 个迁移与 54 个 service** —— 结论依据 12 个关键文件的交叉验证，若某个未被抽到的 service 内含相反设计，本稿可能漏判。

> 采集自上游 `main` 最新提交日 **2026-09-27**；若其后续提交已改变本文所述机制，以原件归档为准重读。

---

## 5. 与既有外部评估的关系

本目录与 [`../2026-10-25-oh-story-absorption/`](../2026-10-25-oh-story-absorption/README.md) 构成一组对照：

| | oh-story（skill 包） | 墨枢（Web 产品） |
|---|---|---|
| 形态 | Markdown 契约，装进别人的 Agent | 完整应用，自带后端与 UI |
| 强项 | **文本质检**（AI 味 22 类、字数口径） | **连续性工程**（claim/规则/证据） |
| 弱项 | 连续性 | 创作方法论（弧光、角色可判定性） |
| 与我方关系 | 互补，已吸收 A2–A5 | 互补，本轮只取 3 机制 |

三者重合的空白是同一个：**「写得好」没有可机检判据**。我方 [`design/product/writing-capability-assessment.md`](../../design/product/writing-capability-assessment.md) 早已把这条诊断为「所有质量判据必然降级的共同根因」，这两个外部样本都没有推翻它，反而各自从不同角度复现了它。
