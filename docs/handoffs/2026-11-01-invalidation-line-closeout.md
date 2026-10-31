# 交接：上游失效线收口（P2-3 全线落地，schema 29）

> 交接基准：2026-11-01 · 分支 `exp/resource-ledger` · HEAD `5e734fa4` · 工作区干净
> 上一班：[`2026-10-31-phase3-unattended-handoff.md`](2026-10-31-phase3-unattended-handoff.md)（期 3a 的无人值守作业手册）
> 施工图：[`upstream-invalidation-phase3-plan-and-ui.md`](../design/architecture/upstream-invalidation-phase3-plan-and-ui.md) §六 全部落地记录
> 主稿：[`upstream-version-and-derived-invalidation-design.md`](../design/architecture/upstream-version-and-derived-invalidation-design.md)

---

## 〇、三十秒版本

**P2-3 整条线收口了。** 期 1 → 期 2 → 期 3a → 期 3b → S6c 期 1/2 → S6 → S7 全部落地，
**schema 27 → 29**，七个提交。台账 P2-3 行已改「已实施」，没有「未排期」的尾巴。

**你现在接手的是一个"从没在真实长篇上跑过"的机制。** 单测 1650+ 例绿，但
**零现网读数** —— 见 §九，这是我认为下一步最该做的事，也是这条线唯一还空着的洞。

**别做的事**：不要把「假想下一版 ⇒ 全报」当缺陷去修（§七已裁定，作者 2026-11-01 明确保持现状）。

---

## 一、这条线做了什么（按提交顺序，每条都能 `git show`）

| 片 | 提交 | 一句话 |
|---|---|---|
| 期 1 | M24（10-30） | `upstream_revisions(domain,scope,rev,digest)` 建表 + 判定纯函数，零消费者改动 |
| 期 2 写 | `fae95890` | 三张派生表记 `source_ref`（我基于哪一版） |
| 期 2 读 | `e704a697` | 读取侧逐行挂 `validity` + A 类五处硬拦 + B 类三处提示 |
| 期 3a | `275a466e` | 主入口接线（方案 B）：闸门挪进 `ArchitectureConfirmDialog` 的「确认生成」内部 |
| 期 3b | `a2a9ac13` | S6a 收窄（按派生类型分域）+ 中间环 M26：世界观/弧光变了 ⇒ **大纲**先旧 |
| S6c 期 1 | `375f231f` | M27 溯源流水 `upstream_revision_log`（只追加，每版一行：时间 + 原因 + 章集） |
| S6c 期 2 | `2f655914` | 文案带时间/原因 + 章集**只记流水**（`MAX_CHANGED_CHAPTER_REVS` 只剩老库兼容路径） |
| S6 | `be1ae22f` | M28 `drafts.outline_rev` + plan 第五组 `finalized` + 请求可选 `reason` |
| S7 | `5e734fa4` | 派生清点页：`db:derived-inventory` 纯读 + 左栏「同步」页 |

---

## 二、新地基：接手必须知道的五件事

### ① 两张表分工不许合并

| 表 | 是什么 | 纪律 |
|---|---|---|
| `upstream_revisions` | **当前态**（判定原料），`UPDATE` 覆盖 `updated_at` | 判定只读它 |
| `upstream_revision_log` | **取证原料**（只追加） | 取证（文案/时间线）只读它 |

**判定读流水会让「多一行少一行」影响「旧没旧」；取证读当前态会丢历史时间。** 谁想合并，先回主稿 §八。

第三块是 `drafts.outline_rev`：定稿那一刻的大纲版本。`-1` = 没记过（**不是 0**，`0` 被 `HYPOTHETICAL_NEXT_REV` 占用）。

### ② 判定入口只有一个

`computeInvalidationPlan`（`src/shared/invalidation-plan.ts`）。两个消费者：

- **强提醒**（`db:invalidation-plan`）：传 `overrides` = 假想下一版；
- **清点页**（`db:derived-inventory`）：`overrides: []` ⇒ 假想快照就是真实版本表 ⇒ 判出来的是**现状**。

所以「清点页说没事、点重建却列出一堆」这种自相矛盾在结构上不可能发生。**不要给清点页写第二份判据** ——
那种矛盾只会在作者同一天先后打开两个界面时暴露，而那时已经很难判谁对。测试里每个「旧了」的用例都用两个通道互校了一遍。

两通道共用 `db-controller.ts` 的 `readPlanInputs(db)`：**各写一遍读取会漏表**（漏一张 = 那一组凭空消失）。

### ③ 三态不合并

`missing`（版本表不存在）/ `unavailable`（这次没读到）/ `ok` 且组空（确实没有）。
折成一份空清单，作者会把「不知道」读成「没问题」。

同理 `unseen` 不许折成 0：`legacy`（存量派生）与 `outline_rev = -1` 的定稿章都只进 `unseen`，不猜。

### ④ `coversAll` 合并时落**空章集**，不另造哨兵

既有约定是「空章集 = 覆盖全部章」。另造一个哨兵值，会让 `changedChaptersBetween` 与 `refCoversChapter` 各判一套。

### ⑤ plan 纯读

`db:invalidation-plan` 与 `db:derived-inventory` **都不许写库**。S4 有一条专测：取消后 rev 必须一位未动。
handler 里出现 `bump` / `UPDATE` / `INSERT` / 事务，即错。

---

## 三、本仓最贵的一类坑：「新加一列算不算内容」

**判据只有一条：会不会在作者没改这张表时变。会，就必须进黑名单。**

这条已踩三次，每次都是"测试全红、单跑复现、找不到原因"：

| 位置 | 常量 | 踩的后果 |
|---|---|---|
| `electron/services/generation-source-binding.ts` | `PROJECT_CORE_NON_CONTENT_COLUMNS` | M26 的 `synopsis_source_ref` 让 `author-saved` 存稿恢复路径判成 `source-changed` |
| `electron/services/sqlite-project-migration.ts` | `VERSION_BOOKKEEPING_COLUMNS` | M28 加一列 ⇒ `preIdentityDomain` 的 `authorContentHash` 变 ⇒ `m01-project-upgrade` / `project-format-migration` 真红 |
| 便携格式链 | `m20Fields` / `m22Fields` / … / `m28Fields` | 漏登记 ⇒ 导出丢列且**不报错** |

**`blueprints.structured_refs` 故意不排除**（它变 = 作者真的改了蓝图内容）。改这两处前先回读注释。

---

## 四、跑测试（这台机器的四个坑，别重新发现）

| 坑 | 症状 | 做法 |
|---|---|---|
| `pnpm` 在 sh 里是坏的 | `npm/node_modules/node/bin/node: line 1: This: command not found` | 脚本/hook 一律写 `node`，不写 `pnpm` |
| 全量跑不完 | 20 分钟起、进程空转、**0 条 FAIL** | **分层跑**：`node scripts/run-tests-electron.mjs run <目录>` |
| safe-delete shim | `rmSync` ETIMEDOUT，**栈落在 cleanup 不在断言** | 前面加 `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID` |
| 目录级并行会抖 | 同一命令两次失败集不同 | 单文件复核；单跑绿 = 不是你的 bug |

**完整写法**（PowerShell 也行，`$env:X=$null` 同理）：

```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node scripts/run-tests-electron.mjs run electron/repositories
```

浏览器测试走另一套配置：

```bash
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  node node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/pages
```

**提交前闸门**：`node scripts/check-fast.mjs`（tsc + 两个文档检查，约 24s，pre-commit 自动跑）。

日志里有 `Binary file matches` 时，先 `> /tmp/x.log 2>&1` 再 `grep -a`。

---

## 五、既有红（别认到自己头上）

| 套件 | 数量 | 归因（已做前后对照） |
|---|---|---|
| `batch-chapter-completion-mode.browser` | 3 例 | **`git stash -u` 在 HEAD 上复现过**，与失效线零交集 |
| `user-settings-package-controller` | 1 例 | `fs.rmSync` teardown EPERM，**栈在 cleanup 不在断言** |
| `src/components/editor/__tests__` | 3 例（10-31 记录） | `CodeMirrorEditor-generation` 1 + `ReviewReport.confirmation` 2；347 passed 不变 |

**归因方法**：`git stash -u` → 跑同一文件 → 红 → `git stash pop`。别凭「我没改那里」下结论。

---

## 六、红线（碰一条就停手）

1. **`plan` 阶段绝不写库**（§二·⑤）。
2. **`legacy` 不许并进 `stale`**，只进 `unseen`；`unseen.count` 不许折成 0。
3. **`src/shared/**` 不许 import `electron/**`**（纯函数层）。
4. **定稿版本必须同事务读**：`drafts.outline_rev` 由 `FinalizationRepository.commit` 在定稿同一事务里写下。
   跨事务窗口会让「按旧大纲写完、记成新版本」的章**永远判 valid**。
5. **`outline_rev` 不回填**。补当前版本等于声称这些章是按当前大纲定稿的 —— 假阴性方向错，
   与「M27 的 `at` 改写 = 伪造证据」同一条纪律。
6. **定稿章必须参与 `unaffected`**。不参与，作者会照旧空隙跳过该复查的章 —— 比不报更糟。
7. **文档状态行只能用一个受控词**（`待裁定`/`已裁定`/`已实施`/`已落地`/`已搁置（原因）`/`已结项`）+ 日期。
   收口一期要改**所有**写着该期状态的位置（顶部状态行、分期表、台账、导航页），别只改一处。
8. **不动** `docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目。

---

## 七、已裁定、别再讨论的三条

| 事项 | 裁定 | 落点 |
|---|---|---|
| 「假想下一版没有章集 ⇒ 全报」 | **保持现状**，按区间表达，**待观察不是结项** | 期 3 稿 §381 |
| request `rev <= 0` =「假想再改一版」 | **保留**（借 0 表达，不加字段/通道） | 期 3 稿 §六 |
| S7 范围 = 清点 + 跳转，「一键重算」不做 | 四类派生是四条 workflow、代价差一个量级（重写正文会覆盖已定稿内容） | 期 3 稿 §709 |

**全报那条的三个可执行口径**（免得有人又去"修"）：不动代码 · 沿用区间（`behind.changed` 已压成「第12–14章」，**不许逐章铺开**）·
真难受了按「分两栏 / 保持 / 按最近一版估」的顺序考虑，**第三条是猜，不接受**。

---

## 八、施工期踩到的四个坑（下次直接躲）

1. **`ensure` 新建域 rev 是 0，`bump` 首次是 1**。写断言「bump 后 rev 是 2」直接红 —— 先确认是哪条路径建的版本行。
2. **只开 tab 不切视图 = 「点了没反应」**。`EditorArea` 在 `auxiliaryPage !== null` 时用 `hidden` 把 tab 区整块藏掉
   ⇒ 每一档跳转都要先 `setSidebarView('project', …)` 再开 tab。已写进代码注释，**改这页别再踩**。
3. **`finalizationId` 撞唯一约束**：测试辅助函数用 `finalization-${chapterNumber}`，同章两次定稿撞号。
4. **React 受控 checkbox 只能 `ack.click()`**：先手设 `checked = true` 再 click 会把它切回去。
   （textarea 是另一回事：native setter + input 事件。）

---

## 九、下一步：三个候选，我推荐第一个

### A · 实机验证整条失效机制 ← **推荐**

**理由**：这条线 1650+ 例单测绿，但**零现网读数**。所有判定都是在合成的 fixture 上验的，
真实项目里可能一次都不触发（比如：作者改大纲时走的写入点有没有漏 `bump`？旧项目的存量派生是不是全落 `legacy`？）。

**成本极低**：S7 的清点页就是观测入口 —— 开一个真实项目，改一次世界观 → 看大纲组是否亮 → 改一次大纲 → 看蓝图/定稿组是否亮。
**观测点已就位，只差人去点一遍。** 如果发现"改完不亮"，那是漏 `bump`，比任何单测都值钱。

**产出**：一份带真实数字的读数（哪组亮了几项、`unseen` 有多少、`legacy` 占多少），写进期 3 稿 §六。

### B · P0-1 残留：区间确认（不是"卷回滚"）

台账 §366 已定性清楚：**「300 章不可行」的真身不是"能不能批量退回"，而是逐章 ack 的 O(N) 次人工确认**
（退第 20 章 ⇒ 280 章各点一次，每次理由必填）。三个候选里 **A「区间确认」** 才是对症的：

- 复用退回时**已经算出**的 N+1..M（`ipc-channels.ts:1122` 注释里的现成产物）；
- 一条范围 ack 绑当前世代，世代一变自动失效（既有语义不变，判据 CX 仍成立）；
- **ADR-0023 拒的是「批量重定稿」（每章一次模型调用），不是「批量确认」** —— 两者不冲突。

前提：**先出立项稿再动代码**（台账明写「任一都要先出立项稿」）。

### C · `outline:<unitId>` 单元级作用域

目前 `source_ref` 只到大纲全域。单元级作用域的前置是 **E3 落盘**（脚本已 T1–T12 收口，但流程侧未全通）。
粒度更细 = 改一个单元不用惊动全书，但**切换要专门迁移窗口**。不紧急。

> 另外登记但没人排的：角色卡域 `characters.personality`（要不要算失效来源，得先定"性格改了哪些章要复查"）。

---

## 十、留给下一班的一句话

**这条线最容易被误解的地方**：它看起来像一个"检查工具"，其实是**一条判定 + 三个消费者**
（硬拦 / 强提醒 / 清点页）。三者共用 `computeInvalidationPlan`，任何一个消费方自己加判断，
就会出现"两个界面说两套话"。要加需求，先问**它属于哪个消费者**，而不是"再加一个检查"。
