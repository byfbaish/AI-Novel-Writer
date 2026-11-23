# QA 首次验收判词 · ARCH S2（三件前置裁定落设计稿 + ADR-0027）

- 判词作者：QA · AI writer项目组
- 判词时间：2026-11-23 21:0x（Asia/Shanghai），末次复验于 `21c43e62`
- **两个判定面**（交件分两笔，结论句一字未改，§3 分别取证）：
  - 主提交 `22894f788d2ff6717b713af12d0fc729dbbc1a8d`（父 `5d301150`）＝三条判据全部成立的面；
  - 补充提交 `21c43e62c2349f32a6ec702023eb7b1deff0b3dd`（父 `22894f78`）＝记账①＋developer 末轮三处引注修正＋核对件入库，补项复验面。
- 交件方 sha 漂移史：`b6391e7b`（同 message、同父的 amend 前悬空提交，作废）→ `22894f78` → `8459862d`（后又被 amend 掉，已不在 HEAD 祖先链）→ `21c43e62`（现行 HEAD）。
- 裁定出处件：`.batch/night/org/ruling-arch-1123.md`（24 行／2,556B／sha256 `8579a5b0763f0ed00377bc4702268210583997dc850a3a1519f2cef6c6341aff`，`git show HEAD:` 取出的 blob 同值）
- 结论：**PASS**（三条判据全过；补充提交复验亦过）；非阻塞记账 4 条见 §4。

## 1. 判据①三节结论有裁定出处 —— PASS [static]

| 节 | 行（`architecture-consistency-design.md`，404 行／27,511B／sha256 `1979aade…b2e17a`） | 裁定句 | 专有字样 |
|---|---|---|---|
| S1 | `:199` | 主人裁定 1（架构定型） | `deriveRosterStatus()` ✓ |
| S2 | `:219` | 主人裁定 2（最小锚点） | 「匹配只做逐字包含、名单空即显式未判」✓ |
| S3 | `:232` | 主人裁定 3（弧层形状） | `UNKNOWN_NODE` ✓ |

```
$ grep -n '^\*\*裁定结论' docs/design/architecture/architecture-consistency-design.md
199:**裁定结论（2026-11-23，主人裁定 1，出处 `.batch/night/org/ruling-arch-1123.md`）：**「散文层（L0／L1 除登记名／L3）不做层间校验，全书只有角色名／登记名／章节号三类键，`characters_arch` 按投影校验（校验对象 `deriveRosterStatus()`）」…
219:**裁定结论（2026-11-23，主人裁定 2，出处 `.batch/night/org/ruling-arch-1123.md`）：** 最小锚点**是**「世界观第 4 维的两类登记（空间名 ＋【具名人物登记】行）」；**匹配只做逐字包含、名单空即显式未判**…
232:**裁定结论（2026-11-23，主人裁定 3，出处 `.batch/night/org/ruling-arch-1123.md`）：** 弧层的可引用实体**是**「结构位 ID 即弧层可引用实体，不建表，**重排报 `UNKNOWN_NODE`**」…
```

ADR 0027（63 行／10,158B／sha256 `64414de5…2c614e39`）「## 主人的四句裁定（原样）」四行与裁定件 `:14`–`:17` **逐行全等**（两条判定面各测一次，均为 1）：

```
$ for n in 14 15 16 17; do a=$(sed -n "${n}p" .batch/night/org/ruling-arch-1123.md); grep -Fxc "$a" docs/adr/0027-architecture-shape-three-decisions.md; done
1 / 1 / 1 / 1
```

边界（判格式、不算改写）：S2／S3 裁定句在引号内嵌了 `**…**` 强调（`:219`「**匹配只做逐字包含、名单空即显式未判**」、`:232`「**重排报 `UNKNOWN_NODE`**」），**文字未增删改**，判为 Markdown 强调。若主人要求连强调也不加，去掉即可，不影响判据成立。

## 2. 判据②ADR 记理由与代价 —— PASS [static]

- 「## 事实基础」四段事实＋出处（`baseline-schema.ts:43-46` 四散文列、三类键 `:76`/`:58`/`builtin-prompt-templates.ts:688`、`characters_arch` 投影 `character-roster-repository.ts:863-870`＋`deriveRosterStatus()` `:817`、结构位 ID `arc-node.ts:112-120`）。
- 「## 决定」D1–D4，D1／D2／D3 各带「落地边界」：取用方式二选一（IPC 或下沉 `src/shared`）、投影源 JOIN `character_relationships`（`:848-857`）、逐字包含≠trim 后全等（`space-time-consistency.ts:286`，`:285` 实测是 `refs.flatMap(...)`）、名单未判须新增字段（`consistency-preflight.ts:260-265`，文案三支 `:277-301`）、`UNKNOWN_NODE` 未接预检（`arc-node.ts:251` ← `:238` ← `:449` ← `architecture.command.ts:812`，不进 `consistency-preflight.ts:146-172`）。
- 「## 为什么不是另外两条路」B／C 两案不选理由各一段；「## Consequences」含章号缺口的处理要求（`ConsistencyFinding.sourceChapter` 必填 `:17`、面板 `:39`）。
- 「## 边界」第一条**逐字**含要求句：

```
$ grep -n "散文层永久不做层间校验，扩就要改 ADR" docs/adr/0027-architecture-shape-three-decisions.md
54:- **D1 是公开承诺：散文层永久不做层间校验，扩就要改 ADR。** 将来若要扩，**必须改这份 ADR**，不能靠「顺手加个校验」绕过——这是本条唯一的外部约束力。
```

## 3. 判据③check:fast 绿 —— PASS [static]

`22894f78`（主判定面）我自跑一次；`21c43e62`（补充提交）再跑一次，两次均全过：

```
$ node scripts/check-fast.mjs; echo "CF_EXIT=$?"     # 21c43e62
[check:fast] typecheck ✓ 23.6s
doc links: checked 1468, broken 0
doc placement: 扫描 440 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CF_EXIT=0
```

同一笔提交与卫生（`21c43e62`）：

```
$ git show --stat --format='%s' HEAD
docs(arch): 修正 ADR-0027／设计稿引用与依据（285→286、:277-301 三支、D1–D21 换可核依据）
 .batch/night/org/arch-s2-design-source-check-developer.md | 90 ++++++++++
 docs/adr/0027-architecture-shape-three-decisions.md       |  6 +-
 docs/design/architecture/architecture-consistency-design.md | 2 +-
$ git status --porcelain -uall
?? .batch/night/reports/s2-arch-verdict.md
$ git show HEAD:.batch/night/org/arch-s2-design-source-check-developer.md | sha256sum
91a8e29e5311a3e63a22d05b0ebb4ae93bcf02c89a574e1a96dacdbb34ae0801  -
$ git ls-remote origin refs/heads/exp/resource-ledger
5d3011503a1d09e3532f0d9e5ffcb7bd2c0d3827	refs/heads/exp/resource-ledger
```

五份材料在 `22894f78` 一笔内（`A`：80／139／283／151／24 行）＋ ADR（`A` 63 行）＋设计稿（`M`）＋`docs/plans/00-OVERVIEW.md`（`M`，`1/1`）。

## 4. 记账（不阻塞）

1. **ADR `:3` 引文错位（已在 `21c43e62` 闭合）**：原引 `plans/00-OVERVIEW.md:109`「顺延到架构定型后」，该行实为「⑤ AC1 层内一致性…」，短语不在 `:108`／`:109` 任一行。现改引 `:108`「阶段三：架构定型后的校验（时机后移）」＋`ROADMAP.md:132`，与 `:108` 原文一致 ⇒ **已闭合**。
2. **节号处置已核**：`## ★ 实机样本`（`:271`）去号、`:273` 有编号说明；`docs/plans/00-OVERVIEW.md:51` 活引用已改「「★ 实机样本」节已补实机核对」⇒ 不悬空。仍可解析的子节引用两处：`docs/plans/prompt-assembly-backlog.md:1265`（§6.1）、`docs/design/architecture/ac5-numeric-resource-consistency-design.md:292`（§6.3）。另 `docs/design/prompt/p0-0-upstream-projection-design.md:288`「设计稿 §6 验收 3」在设计稿里搜不到「验收」二字，**属既有失真、与本次去号无关**，不追改。
3. **amend 痕迹**：`b6391e7b`、`8459862d` 均为同 message 的 amend 前悬空提交，不指向任何分支；收口与台账以 `21c43e62` 为准。
4. **未 push**：远端仍 `5d301150`（push 归主身）；本判词自身为未跟踪件，等我方改完后由群 admin 入库。

## 5. 未判与不判（边界声明）

- **不判** developer 的 A–H 八条是否源码正确（他自核、项目总负责人逐条核过）；只抽查其落地存在性：`character-roster-repository.ts:817` `function deriveRosterStatus(`、`:848-850` JOIN `character_relationships`、`:863`「never acts as an identity write source」、`space-time-consistency.ts:285`/`:286` 两行性质。
- **不判** AC1／AC2／AC3 的实施接线（Goal 规则：解阻塞不实现校验代码）。
- 终审归项目总负责人；本判词只覆盖判据 ①②③。

## 6. 复验记录（判定面变更史）

| 面 | 时点 | 覆盖 | 结果 |
|---|---|---|---|
| `22894f78` | 20:5x | 判据①②③全部（自跑 `check:fast`，typecheck 23.0s） | PASS |
| `8459862d` | 21:0x | 只核 blob（工作树已脏，未跑 `check:fast`） | 承继成立；随后被 amend 掉 |
| `21c43e62` | 21:0x | ①四句逐字＋三句锚点 ②`:54` 边界句 ③自跑 `check:fast`（typecheck 23.6s） | PASS |

按「验收必须对新 HEAD 重取证」：旧面的 PASS 不自动继承到新 sha；本判词以 `21c43e62` 为准，前两面仅作过程留痕。
