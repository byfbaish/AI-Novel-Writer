# S3 · D10／D11 外派报告评审裁定（2026-11-22 10:5x）

From: 项目总负责人 · AIwriter项目组
To: 大肥鱼 · AI writer项目组（转主身提交卡面）／workbuddy联络人、豆包联络人（转外派方知悉）

依据：`C:\tmp\s3-outbound\s3-d10-clear-reset\report.md`（sha256 `dcc10057…9160`，93 行）、`C:\tmp\s3-outbound\s3-d11-nudge-dedup\report.md`（sha256 `219371fa…855e`，141 行）。

## 一、D10：选方案 A（扩白名单到清空仓库层）

裁定：**取 A**。理由：卡面 §3 禁「面板层隐藏卡片」，而三类卡片宿主就是三张表，白名单内无法闭环；B 要新增 IPC 与三处生产接口，改动面更大、还要多一条回执链。

授权扩白名单（本卡新增）：
- `electron/repositories/project-clear-repository.ts`：仅在 `clearGeneratedData` 事务内追加删除，外键顺序 `generation_artifacts → generation_attempts → generation_runs → generation_roots`；并在 `:46` 的 `generatedText` 计数清单补同名四表，使 `diffClearCounts`（`:80-92`）自动把删除行数算进回执（判据 3 对账无需另写代码）。
- 允许沿用 `hasTable(db, …)` 守卫写法。禁改：既有 `blueprints`/`drafts`/`volumes`/`volume_units`/`volume_handoffs`/`summary_snapshots` 删除语句、事务边界、三档语义。

`generation_runs`／`generation_roots` 属「本次清空范围内的生成内容」：作者点清空即不可恢复，删掉不改变语义；但不作为默认行为扩散到其它入口（只挂在本清空路径上）。

判据口径收紧（写入卡面）：判据 2 的「卡片数为 0」只认 `generation:list` 三类卡片；`db:recovery-candidate-list` 未查，按记录项处理，不判 FAIL 也不判 PASS。

## 二、D11：卡面口径不变，实现路径二选一

裁定：**唯一判据仍是检查点 `synopsis_incomplete === false`**，不回退到 `chain.status` 投影（投影语义不等价）。「现行代码只用投影、没有定稿闸」＝本卡要改的缺口，不是判据要迁就的现状。

实现路径（apply 前须在实施说明里写明选了哪条、文件:行）：
1. 渲染层经既有「读检查点」IPC 直读该布尔；
2. 若既有路径拿不到，则由主进程把该布尔投影进既有 snapshot 字段（不新增表/列/IPC 通道）。

两条都不可行 → 停手报，禁退回 `chain.status`。

## 三、卡面留痕文案（请主身与 D7 两处一并提交）

### D10 §1「缺口」条整行替换

```
- 缺口（2026-11-22 外派复核更正）：①渲染层重置钩子**已存在**（`src/services/project-clear-service.ts:171-199`：关 Tab、`useDraftStore.reset()`、`clearAllArchProgress`、`notifySynopsisCandidateDiscarded`、重载角色卡、刷新文件树）；②`PROJECT_DATA_CLEARED` 已于 2026-11-09 移除（`project-clear-service.ts:164-167`，原文「生产订阅方为零…现已移除发射与事件类型」），现存订阅为 `system-notice-toast.ts:33` 的通用 `SYSTEM_NOTICE`；③**残留宿主＝`generation_runs`＋`generation_attempts`＋`generation_artifacts`**（`AIOutputPanel.tsx:320-344,356-359,423,476,504`；`main-generation-owner.ts:332-336`），不含 localStorage 键。
```

### D10 §2 第 1 条整行替换

```
1. **残留宿主清单**：外派已给出（三类卡片同源＝上条③三表）；apply 时按同一路径复核一遍，逐条列宿主。
```

### D10 §2 第 2 条后插入一行

```
- **修法（负责人 11-22 裁 A）**：扩白名单到 `electron/repositories/project-clear-repository.ts`，在 `clearGeneratedData` 事务内按 `generation_artifacts → generation_attempts → generation_runs → generation_roots` 追加删除，并把四表补进 `:46` 计数清单。禁在面板层隐藏卡片、禁改既有删除语句与三档语义。
```

### D11 §2「定稿态取法」条末追加一行

```
- 实现路径（apply 前须写明所选与文件:行）：①渲染层经既有读检查点 IPC 直读；②由主进程把该布尔投影进既有 snapshot 字段（不新增表/列/IPC）。两条都不可行则停手报，禁退回 `chain.status`。
```

## 四、apply 顺序（不变，一次一张）

D4 → D7 → D16 → D10 → D11。前置：D7 卡面（A 口径＋行号）与 D10／D11 上述留痕先由主身提交；未提交不进 apply。
