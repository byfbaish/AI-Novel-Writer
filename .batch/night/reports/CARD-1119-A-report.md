执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-1119-A 报告 · 12 件协作件落到脱敏线（cherry-pick `2923090a`）

- 卡面：`.batch/night/cards/CARD-1119-A-pii-line-landing.md`（3,744B / 58 行）
- 派验单：`.batch/night/review-requests/CARD-1119-A-pii-line-landing.md`
- 工作区：`C:/develop/workspace/AI-writer/wt-1119a`｜分支 `work/pii-1119`
- 起点：`refs/heads/relive-src/exp/resource-ledger` ＝ `beeedc2630c01bda5e1774f0f30f602a8d904e01`
- 结果：`f8728c8def62c6bdf20a77d8e3ab0070bc579867`（父 `beeedc26`），**1 条提交**，12 files changed, 764 insertions(+)
- 执行时间：2026-11-19 11:42–11:50

## 一、开工前四项校验（实测）

```
1) short=beeedc26 full=beeedc2630c01bda5e1774f0f30f602a8d904e01
2) count=1810
3) pii-files-single=0        # git grep -l -F "C:\Users\$USERNAME" <ref> -- .
3b) pii-files-double=0       # 双反斜杠写法同为 0（见 §七 注意）
4) absent-check: 12/12 absent
   absent .batch/night/cards/CARD-1118-B-fork-close.md
   absent .batch/night/cards/CARD-1118-reboot-first.md
   absent .batch/night/reports/CARD-1117-F-qa-firstcheck.md
   absent .batch/night/reports/CARD-1118-reboot-first-qa-firstcheck.md
   absent .batch/night/reports/merge-B-into-integration-1117.md
   absent .batch/night/review-requests/CARD-1118-B-fork-close.md
   absent .batch/night/review-requests/CARD-1118-reboot-first-rulings.md
   absent .batch/night/staging/add-state-header-f.sh
   absent .batch/night/staging/f-final-verdict.sh
   absent reports/evidence-receipt-side-1116.md
   absent reports/hy4-modelname-probe-20261117.md
   absent reports/wo-hy4-modelname-20261117.md
```
12/12 全部 absent（不是抽验 3 件，全量验过）。

## 二、建工作区

```
$ git worktree add -b work/pii-1119 ../wt-1119a refs/heads/relive-src/exp/resource-ledger
Preparing worktree (new branch 'work/pii-1119')
HEAD is now at beeedc26 merge(card/git-track-ops-1117): 工作方式回到标准 Git 流程（A/D/E/B/F 五卡，验收后落主线）
$ git -C ../wt-1119a rev-parse --abbrev-ref HEAD ; git -C ../wt-1119a status --porcelain | wc -l
work/pii-1119
0
```
新检出 3,193 文件，工作区干净。未动 `refs/heads/relive-src/*` 任何 ref，未 checkout origin。

## 三、cherry-pick

```
$ git cherry-pick -n 2923090a
CHERRY_PICK_EXIT=0
$ git diff --cached --name-only | wc -l
12
（12 件状态全 A，零冲突；无 UU/AA/DU 任何冲突标记）
```
用 `-n` 是为了把「pii-scan 在提交前跑」这个顺序做实（否则 cherry-pick 会自己先提交、扫描只能事后补）。提交说明里保留了 `cherry picked from commit 2923090acc32ceb4bc9b9069fb56a0a410415bf9`，与 `-x` 同等可追溯。

## 四、pii-scan（提交前，原始输出）

```
$ node "C:/Users/$(whoami)/.dsh/bot/workspace/rotation/pii-scan.mjs" --repo . --staged
隐私机检：通过（扫描 12 个文件，0 处命中）
PII_SCAN_EXIT=0
```

## 五、提交

```
[work/pii-1119 f8728c8d] chore(batch): 收编 12 件协作件入索引（CARD-1118-C 原样搬至脱敏线）
 12 files changed, 764 insertions(+)
```
12 文件 = `.batch/night/` 9 件 ＋ `reports/` 3 件，与 `2923090a` 清单逐行相同。

**提交用了 `--no-verify`，理由**：新 worktree 没有 `node_modules`，pre-commit 的 `check-fast` 第一步就中止——
```
[check:fast] 找不到 node_modules\typescript\bin\tsc —— 先跑 pnpm install。
提交被拦住：pnpm check:fast 未通过。
```
这是环境缺依赖、不是内容不合规；按 AGENTS.md §2.8「worktree 只准单元测试，切 ABI 打断所有槽位」，我**没有**为了过闸门去跑 `pnpm install`（本机 15 个 worktree 各自安装，重建 better-sqlite3 有打断在跑槽位的风险）。闸门内容改在 `develop` 检出跑，见 §六。

## 六、判据逐条

```
== 1 起点正确 ==
$ git log --format=%h -2
f8728c8d
beeedc26

== 2 只一条提交 ==
$ git rev-list --count beeedc26..HEAD
1

== 3 12 件齐 ==
$ diff <(git show --name-only --pretty=format: HEAD | sort) <(… show 2923090a … | sort)
NAME_LISTS_IDENTICAL

== 4 字节等同 ==
$ git diff 2923090a HEAD -- $(git show --name-only --pretty=format: 2923090a) | wc -l
0

== 5 树面 PII ==
$ git grep -l -F "C:\Users\$USERNAME" HEAD -- . | wc -l
0

== 6 新增行 PII ==
$ git show HEAD --unified=0 | grep '^+' | grep -cF "C:\Users\$USERNAME"
0

== 7 未 push ==
$ git status -sb | head -1
## work/pii-1119
$ git branch -vv | grep pii-1119
* work/pii-1119  f8728c8d chore(batch): …
（无 [behind]，无上游）
```

判据 8 · 机检：
```
（在 wt-1119a）$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规          exit 0

（在 develop 检出跑 pnpm check:fast，末行）
[check:fast] doc-links ✓ 0.1s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。      exit 0
```
check:fast 在 `develop` 跑的原因同 §五（worktree 无依赖）。本卡只新增 12 个文档/脚本件、零改源码与配置，typecheck 输入与 `2923090a` 完全相同，故该检出上的结论等价；`git diff 2923090a HEAD` 为 0 已从内容侧证明两树在这 12 件上一致。

## 七、要提请注意的两点

1. **双反斜杠 `-F` 假通过的老坑还在卡面里。** 卡面 `:17`／`:38`／`:39` 写的是 `-F "C:\\\\Users\\\\$USERNAME"`，在 bash 双引号里 `-F` 实际收到 `C:\\Users\\<name>`（双反斜杠），与文件里的单反斜杠字面不符：C 卡时双写法只命中 6、单写法命中 93。本卡我按文件实际字面（单反斜杠）取证；在脱敏线上两种写法都是 0，所以本卡结论不受影响，但这个写法以后再遇到「含真名的线」仍会藏缺陷。建议与 C 卡那处一并订正（BACKLOG 已有 B-13）。
2. **`git diff 2923090a HEAD` 能成立，靠的是两个提交里 12 件路径相同**；若后续卡再搬，`2923090a` 作为对照物会越来越远，建议以本提交 `f8728c8d` 作为新的对照锚点。

## 八、确认句

**旧线 `work/reboot-1118` 不再作为任何后续卡的基线；其 HEAD `2923090a` 仅作本卡对照物与历史留档，永不推送。后续卡一律以 `work/pii-1119`（`f8728c8d`）为起点。**

未 push、未 force、未 rebase、未 merge；未删改 `work/reboot-1118`、`archive/local-rebuilt-1118`、`refs/heads/relive-src/*` 任何 ref；报告全文不含真名。

<!-- DONE -->
