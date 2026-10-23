# P1-1 期 1 · 关键物品宿体（possession continuity）

> **状态**：✅ 已落地（2026-10-23，M14 · 独立登记页 · 写前查阅第三小节）
> **依据**：`long-form-readiness-review.md` §3（四类事实无宿体）· §5（P1-1）· 台账 §12.13
> **行业名**：possession continuity（物品连续性），属 story bible 的事实分区，**不是账本**

---

## 0. 四问（`industry-alignment-and-stage-goals.md` §5）

| 问 | 答 |
|---|---|
| 行业里叫什么 | possession / object continuity。长篇里最常见的崩法不是写错名字，而是**东西已经交出去又被拿出来用** |
| 谁消费产出 | ① 写前查阅（生成第 N 章时进上下文）② 将来的 findings（「这把刀按登记在别人手里」）③ 作者扫表自查 |
| 失败形态属哪类 | 事实缺失 + 事实过期（不是算术错）：登记了却没注入 = 白记；登记了但正文转过手没回填 = 陈旧 |
| 已有产品做过什么 | story bible 里的「物品/道具」分区；写作软件一般只提供清单，不提供校验。本项目第一步只做**清单 + 带出处注入**，校验留给 findings |

---

## 1. 形状：三件套 + 出处，不做枚举

一条记录 = **一件有名字的关键物品**：

| 列 | 说明 | 能为空 |
|---|---|---|
| `name` | 物品名，**UNIQUE** | 否 |
| `holder_character` | 持有者角色名（`characters.name` 就是主键） | ✅ 空 = 非角色持有 |
| `holder_label` | 展示用持有者：角色名 / 地点 / 无主 | 否 |
| `status_note` | **作者原话**的状态短语：`已签`、`剩两副`、`被扣在执法殿` | ✅ |
| `chapter_number` | 出处章 | ✅ 空 = 作者登记，不伪造章号 |
| `evidence` | 出处逐字引文 | ✅ |
| `source` | `author` / `derived`（本期只有 author） | 否 |

**为什么状态是短语而不是枚举**：本书真实物品混着四种形态 —— 「有无」（欠条）、
「归属」（裁员名单备份）、「剩余份数」（活气散）、「签署状态」（入职合同）。
四种形态的校验规则完全不同，定枚举等于**替作者写设定**，而且「押在典当行」「不在身上但属于他」
这类真实状态塞不进任何枚举。台账 §12.13 原本就写着「形状未定前不谈表」，本期定的形状是
**「作者怎么写就怎么存，注入时原样带上」**。

**为什么同名不拆多行**：三副药拆成三行就得回答「哪一行是哪一副」，而正文里从来没有这个 ID。
一条记录 + 状态短语写「剩两副」，是唯一能跟正文对上的粒度。

---

## 2. 与资源的划界（ADR-0022 之后最容易搞混的一处）

| | 资源（`resources`，M11） | 关键物品（`key_items`，M14） |
|---|---|---|
| 问题 | 这东西怎么获得、怎么消耗、总量多少 | 这东西**现在在谁手里** |
| 有数量增减吗 | 有（`unit` + `period` + 变动） | **没有** |
| 算术 | 曾经有（余额），已按 ADR-0022 下线为词汇表 | 永远没有 |
| 典型 | 下品灵石、贡献点、聚气丹 | 欠条、裁员名单备份、串着灵石的麻绳 |

ADR-0022 下线的是**余额**（派生数值），不是**事实**。物品归属是事实（谁拿着），
所以它不受那条 ADR 限制，也**不做**任何加减。

---

## 3. 落点与接线（19 处，照 W6 的形状）

| 层 | 文件 |
|---|---|
| 迁移 | `electron/migrations/m14-key-items.ts`（表 + `idx_key_items_holder` + apply/verify/工厂） |
| 版本 | `registry.ts`（`LATEST_SCHEMA_VERSION = 15` + M14 槽位）· `desktop-registry.ts`（import / apply / `schemas(15)` / 工厂 / 数组 / 指纹 / `CURRENT_DESKTOP_SCHEMA_VERSION = 15`）· `src/shared/project-storage.ts`（`MIGRATION_IDS`） |
| 便携 | `portable-project-field-policy.json`（`m14Tables` + 逐字段 `D`）· `portable-project-format.ts`（`m14-delta` 分支） |
| 契约 | `src/shared/key-item.ts`（实体 / 入参 / `renderKeyItemLine`）· `ipc-channels.ts`（3 条通道） |
| 主进程 | `electron/repositories/key-item-repository.ts` · `db-controller.ts`（3 个 handler + `MUTATING_DATABASE_CHANNELS`） |
| 渲染 | `KeyItemRegistryPanel.tsx` · `KeyItemRegistryEditor.tsx` · `editor-store.ts`（`EditorTab['type']` + **`PROJECT_SCOPED_BUILTIN_TYPES`**）· `sidebar-file-openers.ts` · `ProjectTree.tsx` · `EditorArea.tsx` |
| 注入 | `prewrite-consultation.ts`（第三小节 `【关键物品】`）· `chapter-materials.ts`（`prewrite.items`）· `generate-draft.command.ts`（`readKeyItems` + 日志） |

> **两个必须同时改的名字**：`EditorTab['type']` 与 `PROJECT_SCOPED_BUILTIN_TYPES`。
> 后者决定 tab id 是否按项目隔离，漏了会让两个项目共用同一个 tab（W6a-6 已踩过）。

---

## 4. 注入口径

```
【关键物品（作者登记：谁拿着什么）】
标了章号的归属按那一刻理解，不是永久状态；没标章号的是作者登记。没有写出转交过程，不得把物品换到别人手里。
- 裁纸刀 — 林岚持有（刃口崩了一角）；出处：第3章：『刀口崩了一角』
- 名单备份 — 王浩持有（红笔标注）；出处：作者登记
```

三条硬规则：

1. **不伪造章号**（判据 DN 同型）：没有章号就写「作者登记」，不写「第 0 章」「当前章」。
2. **归属按时点理解**，与六槽同一措辞 —— 它是「截至某章」的快照，不是永久约束。
3. **不做推断**：注入文本不判断「该不该在他手里」，那属于 findings（P2-1）。

排序只有一条规则：**本章蓝图点名的角色持有的排前面**，其余兜在后面，由条数上限（8 条 / 640 字）裁掉。

---

## 5. 验收

| 项 | 结果 |
|---|---|
| 注册一件物品 → 生成下一章 | 材料块里出现一行，带状态与出处；日志「已注入写前查阅：… 关键物品 N 条 …」 |
| 续写轮 | 同一份材料块 ⇒ 续写请求里**同样有**（这是 P0-2 期 1 建的通路） |
| 没登记任何物品 | 整节不出现，材料块逐字节不变（parity 哈希未变） |
| 重名 / 章号为 0 / 缺持有者 | 本地就拦住，一行都不提交 |
| 单元与集成 | M14 lane 6 例 · 仓储 7 例 · 渲染 18 例（含三种出处分支）· 面板 7 例 · 生成链 1 例 |

---

## 6. 不做（写在这里，防止下一轮自己发明）

- ❌ **数量/余额**：物品不做加减，四枚灵石还是四枚灵石是正文的事。
- ❌ **转手历史**：不建 `key_item_movements`。物品不是账本，改持有者就是改一行；
  真要历史，先回答「谁消费这份历史」。
- ❌ **从正文自动抽取**：本期只有作者登记。抽取要解决幂等/中断/引文定位（W6b 那一整套），另立项。
- ❌ **状态枚举与校验**：见 §1。
- ❌ **世界状态页展示**：目前只有独立登记页 + 注入。若作者需要「随时间变化」的视图，
  那是 W5 只读视图的扩展，不是新事实源。
- ❌ **删角色时联动**：刻意不加外键。物品归属是快照，角色改名/删卡不该由数据库改写历史；
  对不上的由归位表（W4a）与作者复核处理。
