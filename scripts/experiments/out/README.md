# 实验输出索引

> 全部由 `scripts/experiments/golden-trait-minimal-loop.mjs` 或其子 Agent 变体产出，一行一条 JSON。
> 字段：`group` `chapter` `declaration`（引用/申报） `action`（生成的行为） 其余为元信息。

## 汇总文件（判读主要看这些）

| 文件 | 是什么 | 跑法 |
|---|---|---|
| `golden-trait-loop.jsonl` | 第 1 轮：四组 A/B/C/D × 20 章，只给「对方 + 要求」 | 本地 9B，隔离 |
| `golden-trait-loop-v2*.jsonl` | 第 2 轮：补「他要付出 / 不做会怎样」；`-s101` `-s202` 是另两个 seed；`-t0.2` 是温度 0.2；`-pp0-c8192` 是**关掉 presence_penalty 并显式设上下文**（这一组才是有效读数）；`-gptoss20b128k` 是换 20B | 本地，隔离 |
| `agent-subject*.jsonl` | 云端被试 6 份（A/A2/B/C/D/D2），**连续跑法**（一个会话 20 章）；`agent-subject.jsonl` 是六份合并 | 子 Agent，连续 |
| `iso-D.jsonl` | 旧卡（三条并列 D1/D2/D3）20 章，**隔离跑法** | 子 Agent，隔离 |
| `new-D.jsonl` | 四层新卡 24 章（含第 21–24 章四个新测点） | 子 Agent，隔离 |
| `v3-D-ch17/18/21/24.jsonl` | 例外改「挂第 1 条底线」后的四章复测 | 子 Agent，隔离 |
| `personality-card-*.jsonl` | **2026-10-29 卡生成实验**（测 prompt 能不能一次生成对的四层卡）：A 现版 / B +4 句 / C +6 句带例句 / D +6 句零举例。`-qwen3.59b128k` 是本地，`-subagent` 是子 Agent | 见 `../personality-card-prompt-loop.mjs` |
| `agent-card-{A,D}-c{1,2}.txt` | 上表子 Agent 那四份的**原始纯文本**（子 Agent 直接落盘，未转 JSON） | 子 Agent |

> ⚠️ 卡生成实验和前面几轮**不是同一类实验**：前面测「给定卡 → 模型怎么选」（演绎），
> 这一轮测「给定前提 → 模型怎么造卡」（生成）。判读脚本也不同（`../check-personality-card.mjs`）。

## 逐章原始文件

`iso-D-ch01..20` · `new-D-ch01..24` · `v3-D-ch17/18/21/24` · `two-D-ch03..09` —— 每个文件一章，是上面汇总文件的来源，保留以便回溯单章。

## 材料

- `../iso-materials.md`：旧卡材料（卡 D + 20 章）
- `../iso-materials-v2.md`：四层卡 + 24 章
- `../iso-materials-v3.md`：例外挂底线的修订卡 + 4 章
- `prompts/`：dry run 导出的完整 prompt（A 组、B 组）

## 判读注意（踩过的坑）

1. **`presence_penalty` 不关掉，读数全部作废**——某模型自带 1.5，稳定率会从 15/20 掉到 3/20。
2. **连续跑法与隔离跑法不能并列比较**：连续跑法里模型看得见自己前面的答案，塌缩会被天然压住。
3. **第 17/18 章相似是"好"**（同类处境同一人），不是复读；跨 tag 相似高才是塌缩。
4. 全部数据来自**单一被试**（本环境子 Agent），换模型需重跑。
