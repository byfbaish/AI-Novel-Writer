# Goal stage 2 首验判词 · archive 登记补齐（README 97 条五字段 + 未跟踪件清场）

首验方：QA · AI writer项目组
判词对象：**HEAD `e29b1a50`**（分支 `exp/mainline-1119`，工作区 `develop`，取数时刻 2026-11-20T00:30+0800，工作区 `??`＝0、已跟踪改动＝0）
　· 受验提交：`f2ffa905`（登记与清场，65 files ＋6539/−104）＋ `e29b1a50`（交件报告）；前一基线 `68fa0381`（stage 1 收口）
　· 判词落点：`.batch/night/reports/GOAL2-archive-readme-qa-firstcheck.md`（本文件，`??` 未入库，按群规由 developer/负责人 add）

**结论：PASS**（stage 2 的 done-when 三条全部成立，无红线触发）

---

## 一、done-when 逐条判定

### 1. `archive/README.md` 登记条目数 ＝ 97（排除 MANIFEST）

| 口径 | 命令 | 输出 |
|---|---|---|
| 表内条目行 | `grep -c '^| [0-9]' .batch/night/archive/README.md` | **97** |
| 树内件数（排除 MANIFEST） | `git ls-tree -r --name-only HEAD -- .batch/night/archive \| grep -vc 'MANIFEST\.sha256$'` | **97** |
| MANIFEST 条数 | `git show HEAD:.batch/night/archive/MANIFEST.sha256 \| wc -l` | **97** |

三项相等，且 README「路径集」与「树件集」双向差集为空：

```
grep -E '^\| [0-9]+ \| `' README | sed -E 's/^\| [0-9]+ \| `([^`]+)`.*/\1/' | sort   # 97
git ls-tree -r --name-only HEAD -- .batch/night/archive | sed 's|^\.batch/night/archive/||' | grep -v '^MANIFEST\.sha256$' | sort   # 97
comm -13 tree readme → 空        # tree-only 0
comm -23 tree readme → 空        # readme-only 0
uniq -d  → 空                    # 无重复路径
```

`README.md` 自身条目在表内（#17，`:33`），MANIFEST 不入表——与 §一「计数口径」行自述一致。

### 2. 五字段齐（谁建／何时／用途／保留期限／是否清洗版）

```
grep -E '^\| [0-9]+ \| `' README | awk -F'|' '{for(i=3;i<=8;i++){g=$i; gsub(/^[ \t]+|[ \t]+$/,"",g); if(g=="") print NR": 空 col"i}}'
→ 无输出（0 处空字段）
```

五列（`| # | 路径 | 谁建 | 何时 | 用途 | 保留期限 | 是否清洗版 |` 的第 3–8 段）97 行全非空。

`待补` 的出现是**裁定允许值**（`.batch/night/org/stage2-disposition-1119.md`：取不到写 `待补` 并进 §四，不追平不算不通过）。实测：

- 表内 `| 待补 |` 行 ＝ **38**
- §四（README `:125` `## 四、\`待补\` 清单（38 条）`）编号条目 ＝ **38**
- 两者路径集双向差集 = **0 / 0**（`comm` 皆空）→ 38 条逐条在 §四 列全，每条写「缺哪个字段＋建议补法」

抽查 5 件（含 `roster/` 2 件、`staging/` 2 件、`cards/` 1 件），逐件核「树内存在 + README 行五字段齐」：

| 件 | 树内 | README 行 | 谁建 | 何时 |
|---|---|---|---|---|
| `roster/identity-roster.v3.10.md` | 存在 | `:71`（#55） | 大肥鱼（项目管家） | 2026-11-16 |
| `roster/identity-roster.v3.12.md` | 存在 | `:73`（#57） | 大肥鱼（项目管家） | 2026-11-16 |
| `staging/owner-config-fix-1116.v2.md` | 存在 | `:100`（#84） | 待补（§四 #34） | 2026-11-16 |
| `staging/d1-delivered-path-report.v2.md` | 存在 | `:91`（#75） | WorkBuddy | 待补（§四 #33） |
| `cards/p51-median-gap.v3.md` | 存在 | `:36`（#20） | 豆包 | 待补（§四 #19） |

用途、保留期限（`长期（项目生命周期内）；过期处置见 …B-1e`）、是否清洗版（`是（与 MANIFEST.sha256 一致）`）五件均齐。

### 3. `git status` 无未跟踪件残留

```
git status --porcelain -uall | grep -c '^??'          → 0
git status --porcelain | grep -v '^??' | wc -l        → 0      # 已跟踪改动也为 0
```

清场前 71 件（我 11-19 那份清单 69 件 ＋ 负责人裁定后新增 2 件）已按 §三 四组归位，README `:115` `## 三、stage 2 未跟踪件清场记录` 六行齐：G1 入库 27 件 / G2 归位 37 件 / G3 移出 5 件 / G4 移出 1 件 / G5 移出 1 件。

`git ls-files .batch/night/staging/vn-history-1119 | wc -l` ＝ **37**（G2 确已入库，且 `staging/` 对 `versioned-filename` 豁免，故 `--all` 仍 0 项——与我开工前那份清单的诊断一致）。

---

## 二、门禁复跑（我在 `e29b1a50` 上重跑，不采信自报）

```
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规                      ALL_EXIT=0

$ pnpm check:fast
[check:fast] typecheck ✓ 18.1s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。          CHECKKFAST_EXIT=0
```

## 三、禁改面与冻结面

- 归档面**只有 README 变化**：`git diff --stat 68fa0381 HEAD -- .batch/night/archive` → `.batch/night/archive/README.md | 267 ++++---`，`1 file changed, 163 insertions(+), 104 deletions(-)`。
- `MANIFEST.sha256` 零改动：`git diff --stat 68fa0381 HEAD -- .batch/night/archive/MANIFEST.sha256 | wc -l` ＝ **0**。
- 除 README 外的 96 件字节零改动：`git diff --name-only 68fa0381 HEAD -- .batch/night/archive | grep -vc 'README\.md$'` ＝ **0**（stage 1 冻结的 97 件未被撞动，未出现 97→134 的扩容）。
- README 元数据：35,902B／173 行／md5 `a04b349d6f8ca64bf02d78f3bd68536b`／末字节 `0a`／`grep -c $'\r'`＝0／首三字节 `232060`（无 BOM）。与 developer 自报逐项一致。
- 本阶段两笔提交未 push；旧线 `work/reboot-1118` 未并入（`rev-list --left-right --count beeedc26...HEAD` 在 stage 1 为 `0 5`，本阶段续接同一分支，无旧线祖先混入）。

## 四、对 developer 两项待裁问题的意见

1. **4 件 trailing-newline 改动是否改走 baseline 冻结**——建议**不改走**，保持现有「只收敛尾部空白」的做法。依据：
   - 四件均为**首次入库**（清场前是 `??`，无历史提交可比），不是在被冻结的归档件上改字节；
   - 字节差恰为 ±1，与「补一个行尾换行 / 去掉一个多余空行」一致：`cards/CARD-1118-D-version-files.md` 11,475→**11,474**、`cards/CARD-1119-A-pii-line-landing.md` 5,847→**5,846**、`review-requests/CARD-1119-A-pii-line-landing.md` 2,880→**2,879**、`staging/vn-history-1119/staging/dispatch-schedule.v1.md` 1,742→**1,743**（我逐件实测 `wc -c` 与 `tail -c 1 | xxd -p`＝`0a`，与自报完全吻合）；
   - 若改走 baseline，等于把 4 条历史账永久冻结进门禁清单，与 stage 1 已确立的「豁免 + 门禁 0 项」方向相反，且 baseline 是**旧路径**冻结表，混入新路径会模糊其语义。
2. **判词由谁 add**——我按群规只写不 add（本文件现为 `??`）。请 developer 在下一笔提交里连同判词一起 add，或由负责人指定执行人；`--all` 不受影响（`reports/` 下 `.md` 尾行合规）。

## 五、采信限度与观察项

- **采信限度**：`f2ffa905` 的 65 文件改动中，G1 27 件的「移入前字节」我无法独立复现（原件已在提交内，无第二份副本）；我以「树内字节 vs 报告/清单所记字节」核对，未见不符。README 的「五字段取数依据」正确性（谁建/何时是否取对）属内容判断，我核的是**依据链自洽 + 待补有清单**，不核每个历史人名是否历史真值。
- **观察项 1（不扣分）**：§四 38 条里「谁建」32 条、「何时」6 条为 `待补`，按裁定属允许值，但需要在 BACKLOG 有一条补登记卡承接（负责人裁定 §四「交下一张补登记卡追平」），否则 stage 4 收口时仍是历史账。
- **观察项 2（不扣分）**：`C:/tmp/pmo-stage2-quarantine/` 已建（`README.md`／`delivered`／`scripts` 三入口），G3/G4/G5 共 7 件为库外件，无 git 保护，建议其在 BACKLOG 里写明保留期（与 B-1e 同口径），避免 tmp 被清后失档。
- **观察项 3（不扣分）**：README `:36` 的 `cards/p51-median-gap.v3.md` 用途文案与 `v2` 行逐字相同（都写「v2 重投版」），属文案继承未改；不影响五字段成立，建议下一张卡顺手订正。

## 六、判定

stage 2 done-when 三条全部成立，`--all` 与 `check:fast` 我复跑全绿，归档面冻结件零改动，清场后工作区零残留 —— **PASS**，可交终审；本判词 `??` 待入库。

<!-- DONE -->
