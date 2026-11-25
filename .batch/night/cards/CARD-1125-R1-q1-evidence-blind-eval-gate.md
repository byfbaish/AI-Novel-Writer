From: 项目总负责人 · AI writer项目组
To: 产品经理 · AI writer项目组 · 群分身

# CARD-1125-R1（唯一优先）：Q1 取证 ＋ 盲评准入／轮次预算／最迟决策日

状态：**可投**（前置＝无；与 R2 可并行，与 R3 不并行——R3 等本卡第 0 步落地）
估时：取证 40 分钟 + 三格 40 分钟 + 首验 20 分钟
执行方：产品经理；首验方：QA；终审：项目总负责人
类型：**A 类**（产出 docs 提交，须配派验单 `review-requests/CARD-1125-R1.md`）

依据：`.batch/night/staging/res-next/next-round-card-allocation.md`（28 行／2,711 B／`84e68d8f…`）；`.batch/night/reports/ext-review-1125-four-way-synthesis.md` §一·3、§四（53 行／6,266 B／`3407a484…`；早前 6,244 B／`9735ea2d…` 已作废，见提交 `c0855f6c`）。

## 0. 前置【硬】

- 工作目录 `C:\develop\workspace\AI-writer\develop`，分支 `exp/mainline-1119`；禁建 worktree、禁改 `src/`。
- 开工第一动作三条，任一不符即停手回执：
  1. `git rev-parse --show-toplevel` ＝ `C:/develop/workspace/AI-writer/develop`；
  2. `git status --porcelain -uall | wc -l` ＝ `0`**（豁免 A-1，2026-11-25 20:53 起生效，见 §0.1；本卡执行时按 §0.1 的基线口径核，不按 0 行核）**；
  3. `test -f .batch/night/reports/ext-review-1125-four-way-synthesis.md` 为真。
- 本卡只动 `.batch/night/reports/` 与 `docs/research/` 下的**新增**文件，不改判据清单（已 S4 收口）、不改 ROADMAP。

### 0.1 前置豁免 A-1（项目总负责人 2026-11-25 20:53 签，最小豁免）

**为什么豁免**：盘上那 3 行是 `scripts/doubao/doubao.mjs`、`scripts/workbuddy/model-policy.mjs`、`scripts/workbuddy/workbuddy-attach.mjs`——归属已清楚（主身 20:22 后台任务会话 `k_552984`），入库在等实跑证据，与本卡（纯文档）无关；等它们会让唯一优先卡无限期停摆，代价大于收益。

**豁免范围**：只豁免 §0 第 2 条（porcelain 0 行）。其余前置照旧（toplevel、依据文件在位、不动 `src/`）。

**开工必记基线**（写进交付头，缺一即按未交处理）：
1. `git rev-parse --short HEAD`；
2. `git status --porcelain -uall` 三行原文；
3. 这三件的 `sha256sum`（各一行）。

**判据 7 随之改口径**：收工时 porcelain 仍须是**同一组 3 个路径**、且三件 sha256 与开工基线逐个相等（＝这三行在卡执行期间没被动过）。若三件中任一 sha 变了，或出现第 4 行，本卡按「基线漂移」打回，不认结果。

**不豁免的事**：不得 `git add`／`commit`／`stash` 这三件，不得以「反正要入库」为由替它们补证据。卡交付自己那笔提交只含本卡新增件。

## 1. 起因

四家非同源评审自评「结论最可能错的一条」全落在 Q1——A 件三条核心判断是全包证据最薄的一段（汇总 §四）。而 C1-②（R2）与 P6 都要动这一段，故先取证再改设计。同时四家 3/4 指出：盲评的唯一不可扩资源是主人本人，准入条件／轮次预算／最迟决策日一个都没写，必然滑成「永远排不上的最后一步」（汇总 §一·3，实证 A-1.3 卡 `134acb2f` executionCount 0）。

## 2. 要交什么（两节同卡，缺一节算未交）

### 第 0 步 · Q1 取证表
新增 `.batch/night/reports/res-q1-evidence-1125.md`，三行判断各配**一行可核依据**：

| 判断（A 件原文编号） | 可核依据 | 可核性 |
|---|---|---|
| 判断 1 | `文件:行` 或可点 URL | 能直接打开 |
| 判断 2 | 同上 | 同上 |
| 判断 3 | 同上 | 同上 |

`A:160` 的 Novelcrafter 一条：**要么给可点链接，要么删句**——两选一，写清选了哪个。

### 第 1 件 · 盲评准入三格
同一文件新增一节，三格写满：
1. **准入条件**：什么样的稿子进盲评、什么样不进（至少给两条排除项）。
2. **轮次预算**：每轮最多几篇、每篇判定时长上限、每轮由谁发起。
3. **最迟决策日**：写具体日期；写不出来就写「需主人定」，**不许留空**。

## 3. 判据（每条带分层标）

1. `[static]` 三行判断各有依据，且依据能被 QA 按 `文件:行` 打开或 URL 可达；无依据的判断标「待证」，**标待证即不进结论**。
2. `[static]` `A:160` Novelcrafter 一项明确二选一（链接在位／该句已删），`grep -n 'Novelcrafter'` 结果与该选择一致。
3. `[static]` 准入三格无空值；出现「需主人定」的格必须写明缺什么才能定（一句话）。
4. `[static]` 轮次预算里「每篇判定时长上限」有数字，不是「尽快」「视情况」。
5. `[static]` 最迟决策日是 `YYYY-MM-DD` 或「需主人定」，两种之外不接受。
6. `[static]` 本卡不改判据清单与 ROADMAP：`git diff --name-only` 只含 `docs/research/`、`.batch/night/reports/`、`.batch/night/review-requests/` 三处。
7. `[static]` `node scripts/check-fast.mjs` EXIT=0；提交后 `git status --porcelain -uall` 为**开工基线同一组 3 个路径**（`M scripts/doubao/doubao.mjs`／`M scripts/workbuddy/model-policy.mjs`／`M scripts/workbuddy/workbuddy-attach.mjs`），且三件 sha256 与交付头所记基线逐个相等（见 §0.1）。

（本卡无 mock／live 项：不跑生成、不动数据。）

## 4. 回执四行头

```
From: CARD-1125-R1 · 产品经理
To: 大肥鱼@主身
卡号：CARD-1125-R1｜会话：<会话标识>｜起点 sha：<HEAD 短 sha>
模式：工作模式｜模型：<派单指定模型原文>
```

## 5. 交付后

QA 首验按 §3 七条逐条给判词（每条一行，`PASS`／`打回＋行号`），判词落 `.batch/night/reports/res-r1-qa.md`；我终审只补两处——三格是否能被主人一眼判、取证表里有没有「待证」被当成结论用。
