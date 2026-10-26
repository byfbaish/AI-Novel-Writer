# 交接：P20-2 秘密宿体（M21 + 审稿守卫 + 作者登记）

> 状态：**已交付**（2026-10-26 夜）。分支 `exp/resource-ledger`。
> 提交链：`fa1c6bb9`（P20-1a 补洞）→ **`7c06a5af`**（本期，28 文件 / +2185 −29）。
> 设计稿：`docs/design/architecture/p20-2-secrets-design.md`。排期：`docs/plans/prompt-assembly-backlog.md` §P20-2。

---

## 1. 一句话

秘密从**世界观第 3 维**里被承认成一个一等宿体：谁在捂什么、谁还不知道、第几章穿。
**它只进审稿守卫，一个字都不进正文提示词。**

## 2. 作者裁定（本期唯一的架构决策）

| 问题 | 选项 | 裁定 |
|---|---|---|
| 秘密放哪 | A 新表 `secrets` / B 并入 M16 `knowledge_states` | **A** |
| 消费面 | 只做登记页 / **审稿守卫 + 作者登记** / 正文负向约束 | **审稿守卫 + 作者登记** |

**为什么不并 M16**（四条逐列对照，已写进 `secret.ts` 与 `m21-secrets.ts` 文件头）：

| 维度 | M16 `knowledge_states` | 本表 `secrets` |
|---|---|---|
| 粒度 | 人粒度（某人知道某事） | 秘密粒度（一件事 + 一组人） |
| 方向 | 正向知情 | **负向隐瞒**（谁不知道才是关键） |
| 期界 | 无 | **有揭穿章**（`reveal_chapter`，NULL 有语义） |
| 状态 | 派生自定稿事实 | 由 `reveal_chapter` 推导，**不入列** |

并进去就要给 M16 加「全域事实」键，而 M16 的封闭默认是「键必须可回查定稿」—— 一破，抽取漂移会连带污染知情格。

## 3. 落点

| 层 | 文件 | 要点 |
|---|---|---|
| 迁移 | `electron/migrations/m21-secrets.ts` | M21 · v21→v22 · `UNIQUE(title)` · `CHECK(reveal_chapter IS NULL OR > 0)` · **无 `status` 列** · 幂等靠 `sqlite_master` 探测 |
| 注册 | `electron/migrations/registry.ts` + `desktop-registry.ts` | `LATEST_SCHEMA_VERSION` / `CURRENT_DESKTOP_SCHEMA_VERSION` = **22** |
| 共享层 | `src/shared/secret.ts` | `SecretDefinition` / `SecretInput` / `secretChapterState` 四态 / `renderSecretReviewSection` |
| 仓储 | `electron/repositories/secret-repository.ts` | **同步函数**（不像 M16 被迫用 `crypto.subtle`）；读侧 `parseNameList` 容错、写侧 `toStringList` 严格 |
| IPC | `src/shared/ipc-channels.ts` §7i | `db:secrets-list` / `-upsert` / `-delete`；**刻意没有**给正文链用的任何一个 |
| 控制 | `electron/controllers/db-controller.ts` | list 走 `hasSecretSchema` 降级空列表（fail-open） |
| 登记页 | `SecretRegistryPanel.tsx` + `SecretRegistryEditor.tsx` | 作者唯一写入口；删除需二次确认；失败**不重载**（见 §5） |
| 接线 | `editor-store.ts` / `sidebar-file-openers.ts` / `ProjectTree.tsx` / `EditorArea.tsx` | tab 类型 `'secret-registry'` 进 `PROJECT_SCOPED_TAB_TYPES`；树项「秘密（谁在捂什么）」 |
| 消费 | 审稿链三处 | `review-continuity-canon.ts` 五项并行读 → `review-continuity-bible.ts` 渲染第六节 → `review-chapter.command.ts` 日志 |
| 便携 | `portable-project-field-policy.json` / `-format.ts` | `m21Tables: ["secrets"]`、`origin: 'm21-delta'`、10 列全 `D`；计数 63/604 → **64/614** |

## 4. 期界四态（本表的核心语义，别看漏）

| `revealChapter` | 与当前章关系 | 状态 | 进不进审稿守卫 |
|---|---|---|---|
| `null` | — | `undecided` | ✅（但只判「有没有把真相写出来」，不得反推章号） |
| `n` | `n === 当前章` | `revealed-now` | ✅ **且豁免**（本章本该揭穿） |
| `n` | `n > 当前章` | `pending` | ✅ |
| `n` | `n < 当前章` | `already-revealed` | ❌ 不渲染 |

**`null` 不等于「永不揭穿」**，只等于「还没定」。渲染文案与规则里都写了这一条。

## 5. 实现中发现的真缺陷（已修，值得记住）

**`SecretRegistryPanel` 保存失败时的重载会把作者输入冲掉。**
原实现 `await save(); await load()` —— 后端报 `SECRET_DUPLICATED` 时，`load()` 用库里的数据替换
`rows`，失败行当场消失，作者刚填的名字与真相全没了，而且错误消息也不显示（被覆盖后的重渲染抹掉）。

修法：**有失败行就不重载**（`if (kept.length === 0) await load(); else setRows(kept)`）。
不重载的代价是「已成功的新行下次保存会再提交一次」，对这张表是**幂等**的
（同名报 `SECRET_DUPLICATED`，不会产生第二条）—— 这个安全性论证写进了代码注释，别删。

## 6. 三处有意偏离验收口径（都已写死在设计稿 §5 与排期表）

1. **「写前查阅只注入本章可能被触碰的秘密」→ 实际一节都不注入正文。**
   第 3 维在正文链里**整维跳过**（判据 DP 防剧透），而 `detail` 比第 3 维原文更直白，注入等于把谜底交给写手。
   守卫只进审稿链；有测试钉住 `generate-draft.command.ts` **不许 import** 本模块。
   同时否决了「正文负向约束」（『不要写出 X』在中文模型上会反向激活）。
2. **「揭穿章之后降级为普通事实」→ 本期不降级、直接不渲染。**
   降级成普通事实需要另建一条事实登记 —— 那是把秘密又抄一份进 M16，正是判据 DE 那类双真相。
3. **本期不做抽取，登记全手工。**
   第 3 维模板只给两个自由问句，**没有机读表面**。要做抽取先得给第 3 维加机读行 —— 那要改 prompt 且撞判据 AO，另立一项。

## 7. 验证

| 命令 | 结果 |
|---|---|
| `electron/migrations/__tests__` 全量 | **22 文件 / 148 例 ✅** |
| `src/shared/__tests__` 全量 | **86 文件 / 1417 例 ✅** |
| `generate-draft.command` + `review-revision-runtime` + `context-entry-parity` | **319 例 ✅** |
| `npx tsc --noEmit` | **exit 0** |
| `check-doc-links` | checked **975**, broken **0** |
| `check-doc-placement` | 基线内 33 / **新增 0** |
| `src/components/editor/__tests__` 浏览器全量 | 30 文件 / 324 例，**3 例失败 = 既有基线失败集**（`CodeMirrorEditor-generation` 1 + `ReviewReport.confirmation` 2），与本期无关 |

本期新增/扩充的用例：m21 lane **6** · 仓储 **9** · 共享层 **13** · 审稿链 **24→29** · 登记页浏览器 **8** · 便携格式 **29**（改计数断言）。

## 8. 明天验收怎么验（三步）

1. **看 diff**：`git show 7c06a5af --stat` —— 应 28 文件，且**没有** `generate-draft.command.ts`（那正是设计意图）。
2. **跑这四条**：
   ```
   node scripts/run-tests-electron.mjs electron/repositories/__tests__/secret-repository.test.ts
   npx vitest run --config vitest.browser.config.ts src/components/editor/__tests__/SecretRegistryPanel.browser.tsx
   npx tsc --noEmit
   node scripts/check-doc-placement.mjs
   ```
3. **GUI 上验一次（真正的裁判）**：
   打开项目 → 左侧树「秘密（谁在捂什么）」→ 登记一条（秘密名 / 真相 / 隐瞒者 / 尚不知情 / 揭穿章）→ 保存 →
   跑一次**审稿**（不是生成正文）→ 报告材料里应出现第六节【秘密守卫（未揭穿的真相）】，
   且**正文生成的提示词里搜不到 `detail` 的任何字** —— 这是本期最该验的一条。

   ⚠️ **库版本要先到位**：`secrets` 表是 v22，旧库启动会自动迁移一次；若面板一直说「本库还没有秘密表」，
   说明迁移没跑（看迁移日志），不是面板坏了。

## 9. 未做 / 留给下一期

- **P20-3 章末后处理提议**（P20 系列最后一项）：复用本期与 P20-1 建立的「候选 → 逐条采纳」面，
  但幂等 / 中断可续 / 引文定位要用上 W6b 那一整套，**风险最高**。开工前必须先出设计稿讨论。
- **第 3 维机读化**：任何「秘密抽取」的前置条件，撞判据 AO（改内置模板必须同步全局覆盖版）。
- 秘密**跨项目作用域**（伏笔五态同款待办）不在本期范围。
