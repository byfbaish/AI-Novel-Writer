# S5 PLANUI 终验判词（QA · 2026-11-25）

> 判定面：`develop` 主工作树，分支 `exp/mainline-1119`，HEAD `1c0700a1d2fbf24fac67b9e3943dea59c5792db4`（父 `85c927ae`）。
> 清单正本：`.batch/night/staging/s5/s5-checklist.md`（63 行／5,388B／sha256 `6443ba4571ae2b52de559530b86b8a45cee342864bdeb6f713163121d6b6834b`）。
> 收口件：`.batch/night/org/planui-closeout-1125.md`（99 行／9,193B／sha256 `24214f4fb71039b7f5261b2f1f17b4bc69d6085261abae168cec8296ad24c378`）。
> 本判词所有读数均由 QA 自己跑到，未引用 admin 与项目总负责人的贴数。

## 0. 结论

**建议 PASS（带两条时序条件与三处文档缺口，见 §5）**。

三行闸全绿：`CF_EXIT=0`、`git status --porcelain -uall` 0 行、`git rev-parse HEAD` ＝ `git ls-remote origin refs/heads/exp/resource-ledger` 两行同 sha。八笔卡提交全部为 HEAD 祖先（`5d1ccd98` 不在，属被 cherry-pick 成 `1c0700a1` 的正常换笔）。acceptance 四条中 ①③ 成立、②待 admin 置卡、④部分（行数在、字节与 sha256 未随件）。

## 1. 三行闸（我自己跑的原文）

```
$ cd /c/develop/workspace/AI-writer/develop && git rev-parse --abbrev-ref HEAD
exp/mainline-1119

$ git rev-parse HEAD
1c0700a1d2fbf24fac67b9e3943dea59c5792db4

$ git ls-remote origin refs/heads/exp/resource-ledger
1c0700a1d2fbf24fac67b9e3943dea59c5792db4	refs/heads/exp/resource-ledger

$ git status --porcelain -uall | wc -l
0

$ node scripts/check-fast.mjs ; echo CF_EXIT=$?
[check:fast] typecheck ✓ 22.7s
doc links: checked 1472, broken 0
[check:fast] doc-links ✓ 0.4s
doc placement: 扫描 443 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.6s
[check:fast] 全部通过。
CF_EXIT=0
```

祖先核验（`git merge-base --is-ancestor <sha> HEAD`）：

| sha | 阶段 | 是否 HEAD 祖先 |
|---|---|---|
| `34aa0000` | S2 C1-a | YES |
| `41daa79c` | S2 P0 | YES |
| `8a42a566` | S2 C1-b | YES |
| `e219977b` | S3 P6-a | YES |
| `a1bcabee` | S3 P6-b | YES |
| `cbbe82c3` | S3 P6-c | YES |
| `641ffc0c` | S4 O1-a | YES |
| `85c927ae` | S4 O1-b | YES |
| `1c0700a1` | S5 收口笔（cherry-pick 自 `5d1ccd98`） | YES |
| `5d1ccd98` | 落错基线的旧收口笔 | NO（内容已在 `1c0700a1`） |

`src/shared/o1-event-progress.ts` 在树上存在（11,020 B），确认代码已进主线。

收口笔内容：`git show --numstat --format= HEAD` → 25 文件 `+3147 −33`，其中文档五处 `docs/roadmap/ROADMAP.md` 18/15、`docs/plans/prompt-assembly-backlog.md` 23/3、`docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md` 1/1、`docs/design/architecture/o1-unit-event-progress-design.md` 28/14、`.batch/night/reports/task-ledger.md` 13/0，其余为 `.batch/night/` 下的件；**无 `src/` 文件**，符合 §F 边界。

## 2. acceptance 四条逐条

| # | done-when 原文 | 判定 | 证据 |
|---|---|---|---|
| ① | ROADMAP 四条 L2 转达标且删掉「阻塞」证据行 | **成立** | `docs/roadmap/ROADMAP.md:43-46` 四条 `L2-PLANUI-01-01..04` 全为 `达标`；§2 状态行 `:184`／`:192`／`:200`／`:208` 已换成判定面 sha＋判词＋测试数，原「看板卡标注」阻塞句已无；`L0-PLANUI` `:168`／`L1-PLANUI-01` `:176` 记「进行中」并写明父级达标签字待主人（未代签，符合 `roadmap-doc-spec.md` §5 第七项）。全文 `grep 阻塞` 余下 9 处均属其他条目（ARCH-02、RES、OPS 系），与 PLANUI 无关 |
| ② | 三卡 done | **未成立（待 admin 动作）** | `task_board_get` 原文：`744f13a8-7a5c-49dc-beab-9e0d7259cc4e` → `status: "todo"`；`342b428f-9bff-4c6b-95eb-97ae75a9f4e4` → `status: "backlog"`；`58188c1c-5c3b-4d40-93d2-2477a29e9fb8` → `status: "todo"`。三卡均 `executionCount: 0` |
| ③ | 台账与 BACKLOG 同步 | **成立** | `docs/plans/prompt-assembly-backlog.md:9-31` 新增 2026-11-25 PLANUI 收口节（已完成四行＋建议两条）；`:888`／`:890`／`:895` 三行落地指针；`.batch/night/reports/task-ledger.md:933-944` 第 22 段（三卡结论表＋八笔链＋十二条指针），历史条目未改 |
| ④ | 收口件落 `.batch/night/org/` 并带行数字节 sha | **部分成立** | 落盘与行数在（§1 逐文件给 18/15、23/3、1/1、28/14、13/0），且 §4 贴了 push 前三行闸原文；但**未给各文档的字节数与 sha256**，本文件自身亦明写「不在此自引 sha」（§4 末行）。按 done-when 字面缺字节与 sha 两项 |

## 3. 清单 §A 三卡证据（我复核的指纹）

| 卡 | 提交链（均 HEAD 祖先） | 判词指纹（我重算） |
|---|---|---|
| `744f13a8`（C1） | `34aa0000`＋`41daa79c`＋`8a42a566` | `s2-c1a-qa-verdict.md` 167 行／10,390 B／`30dc2d57…`；`s2-c1b-verdict.md` 143 行／15,110 B／`855bd843…` |
| `342b428f`（P6） | `e219977b`＋`a1bcabee`＋`cbbe82c3` | `s3-p6-verdict.md` 160 行／14,217 B／`3665ffd0…` |
| `58188c1c`（O1） | `641ffc0c`＋`85c927ae` | `s4-o1-verdict.md` 113 行／14,691 B／`4e9b88c7…` |

四份判词的行数、字节、sha256 前 8 位与清单 §A 与收口件 §2 所写**逐字相符**；C1-b 用的是 v2（`855bd843…`），未见 v1（`1abdf4bf…`）被引用。

## 4. 清单 §C 十二条逐条

收口件 §3（`:54-67`）十二条齐备，无漏项：

| # | 条目 | 判定 | 行号 |
|---|---|---|---|
| 1 | 两次外派越线（`41daa79c` 17:17:08、`8a42a566` 17:38:07） | 已记 | `:56` |
| 2 | C1-b 用 v2、v1 作废 | 已记 | `:57` |
| 3 | J8 缺实机半，另开卡 | 已记 | `:58` |
| 4 | P6 超限静默无提示 | 已记 | `:59` |
| 5 | 豆包 S4 回执未落盘、联络人抄录 | 已记 | `:60` |
| 6 | 循环 import 技术债 | 已记 | `:61` |
| 7 | `startStep` 未钳 fail-open | 已记 | `:62` |
| 8 | `t84789` 缺独立出处 | 已记 | `:63` |
| 9 | pre-commit 缺卡号只提醒不拦 | 已记 | `:64` |
| 10 | C1 `picked` 不随筛选剪枝 | 已记 | `:65` |
| 11 | P6 派单与实施包措辞不一致 | 已记 | `:66` |
| 12 | J4c 括号算例勘误 | 已记 | `:67` |

第 6 条在收口件里记了，但设计稿正文未落（见 §5-F3）；第 12 条所引 `erratum-01.md` 27 行／1,824 B 在本笔提交内，文件在盘。

## 5. 发现（均不单独阻断收口，需 admin 裁一次）

- **F1〔事实错误·时序〕**「三卡在看板上已 `done`」这句已进库三次：`docs/plans/prompt-assembly-backlog.md:24`、`.batch/night/reports/task-ledger.md:943`、收口件 `:8`。实况是 `todo`／`todo`／`backlog`（§2-② 原文）。若 admin 在判 PASS 后置 done，该句即变真；若不置则为假。建议：置 done 后由 admin 回一句「三卡已置 done」作为该句的生效凭据，不为此再提交一笔（与停手令一致）。
- **F2〔同文档自相矛盾〕** `docs/design/architecture/o1-unit-event-progress-design.md:201`（§7 开放问题第 1 条）仍写「分母＝单元内**已写章数**」，与本次订正后的 `:60-72`（分母＝本批章数 `b`、带 `s0` 偏移）冲突，且该句尾部就写着「见 §3.2」，指向的正是被订正的那节。
- **F3〔清单 §B 未做全〕** §B 第 2 条要求「同时写明快照表归 O1-b、循环 import 为已接受技术债」。前半在（`:88`「快照表归 O1-b 实现」），后半缺失：全文 204 行 `grep -c "循环"`＝0、`"技术债"`＝0、`"import"`＝0。该项现只存在于收口件 §3.6。
- **F4〔待回填〕** 合并 sha 仍写「未合并·待主身」：`docs/roadmap/ROADMAP.md:184`／`:192`／`:200`／`:208`、`task-ledger.md:938-940`、`prompt-assembly-backlog.md:24`。而八笔已是 `1c0700a1` 的祖先、`1c0700a1` 已等于远端——该措辞已与事实不符，按 admin 口径由产品经理随下一笔回填。
- **F5〔历史读数，不追改〕** 收口件 §4 第二、三行是 push 前读数（porcelain 25 行、HEAD `95a30ae6`、远端 `f2fd6d04`）；admin 已定保留原文不追改，push 后相等读数以本判词 §1 为准。

## 6. 建议

1. 三处文档缺口（F2／F3）与 F4 回填合成**一笔**文档整理提交，走正常合并闸，不为赶收口单开；F1 只需 admin 置 done 的群内回执。
2. 收口件 done-when 里的「字节与 sha」下次在文件头自引一行（`行数／字节／sha256`）即可闭环，本笔不追改。
3. `roadmap-doc-spec.md` §5 第七项的父级达标签字仍待主人：`L0-PLANUI`／`L1-PLANUI-01` 保持「进行中」是对的，别因收口笔顺手改成「达标」。

---

判词自述：本文件由 QA 在本轮终验中写就；所有命令在同一工作树 `C:\develop\workspace\AI-writer\develop` 上执行，未改动任何被验文件（porcelain 0 行）。
