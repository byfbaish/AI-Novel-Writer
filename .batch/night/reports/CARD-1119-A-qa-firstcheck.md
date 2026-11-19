执行方：QA · AI writer项目组（首验）
依据：派验单 `review-requests/CARD-1119-A-pii-line-landing.md`（2,646B / 45 行，状态 待判）｜卡面 `cards/CARD-1119-A-pii-line-landing.md`（受验时 4,963B / 66 行）
受验：`wt-1119a` 分支 `work/pii-1119` 上唯一提交 `f8728c8d`（父 `beeedc26`）＋ 报告 `.batch/night/reports/CARD-1119-A-report.md`（6,597B / 144 行 / `60756b978ffaabc5058b22ab47a384ab`）
取证时刻：2026-11-19 11:56–12:01｜被审 worktree 只读，未改动其中任何文件

## 一、结论

**PASS。** 九条判据全部成立、五条红线零触发；核心判据 4（搬过去的字节与 C 卡验收件相同）我用**逐件 blob OID 全同**复核，比 `diff` 更强。

## 二、起点核验（复跑用）

```
$ cd C:/develop/workspace/AI-writer/wt-1119a
$ git rev-parse --abbrev-ref HEAD      → work/pii-1119
$ git log --format='%h %ad %an %s' -2
f8728c8d 2026-11-19 11:48:07 大管家 chore(batch): 收编 12 件协作件入索引（CARD-1118-C 原样搬至脱敏线）
beeedc26 2026-11-17 21:21:27 大管家 merge(card/git-track-ops-1117): 工作方式回到标准 Git 流程（A/D/E/B/F 五卡，验收后落主线）
$ git cat-file -p HEAD | head -3
tree 3a8337d1e8bb3d802ff39e300a6f1b31ab8c961f
parent beeedc2630c01bda5e1774f0f30f602a8d904e01
author 大管家 <…> 1795060087 +0800
```
父提交全值＝`beeedc2630c01bda5e1774f0f30f602a8d904e01`，与脱敏线 ref 头同值。

## 三、判据逐条

### 判据 1 · 起点正确 → 成立
`git log --format=%h -2` 第一行 `f8728c8d`、第二行 `beeedc26`，与通过线一致。

### 判据 2 · 只一条提交 → 成立
```
$ git rev-list --count beeedc26..HEAD
1
```

### 判据 3 · 12 件齐 → 成立
```
$ git show --name-only --pretty=format: HEAD | sort > a_head; …2923090a… > a_src
$ wc -l a_head a_src        → 12  12
$ diff -q a_head a_src      → 无输出（LIST_IDENTICAL）   exit 0
```
12 件 = `.batch/night/` 9 件 ＋ `reports/` 3 件。

### 判据 4 · 字节等同 → 成立（两种量法，后者更硬）
```
$ git diff 2923090a HEAD -- $(git show --name-only --pretty=format: 2923090a) | wc -l
0
$ for f in <12 件>; do [ "$(git rev-parse 2923090a:$f)" = "$(git rev-parse HEAD:$f)" ] || echo BLOB_DIFF $f; done
（无 BLOB_DIFF 输出）
```
12/12 件在 `2923090a` 与 `f8728c8d` 中 **blob OID 完全相同** ⇒ 逐字节一致，不存在「顺手改一行」。

### 判据 5 · 树面 PII → 成立
```
$ git grep -l -F "C:\\Users\\$USERNAME" HEAD -- . | wc -l
0
```
（按文件实际单反斜杠字面量取证；双反斜杠写法见 §五.1。）

### 判据 6 · 新增行 PII → 成立
```
$ git show HEAD --unified=0 --pretty=format: | grep '^+' | grep -c -F "C:\\Users\\$USERNAME"
0
```

### 判据 7 · 未 push → 成立
```
$ git status -sb | head -1     → ## work/pii-1119
$ git branch -vv | grep pii-1119
* work/pii-1119  f8728c8d chore(batch): 收编 12 件协作件入索引（…）
```
无 `[behind]`、无 `[origin/…]` 上游。

### 判据 8 · 机检 → 成立
```
（在 wt-1119a 实跑）$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规            EXIT=0

（在 develop 检出实跑，2026-11-19 12:00）$ pnpm check:fast
[check:fast] typecheck ✓ 17.0s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.1s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。            EXIT=0
```

### 判据 9 · 报告 → 成立
```
$ head -2 .batch/night/reports/CARD-1119-A-report.md
执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot
$ tail -1 …   → <!-- DONE -->
$ grep -c -F "$USERNAME" 该报告   → 0
```
报告含开工四项校验实值、`CHERRY_PICK_EXIT=0`、pii-scan 原始输出（`扫描 12 个文件，0 处命中`）、两条机检末行、§八 确认句——派验单 §二 第 9 条与卡面 §五 要求的项逐条齐。

**附加复核（判据外，用于支撑判据 4/5）**：12 件在脱敏线 ref `beeedc26` 上全部 `git cat-file -e` 失败（absent 12/12），与报告 §一.4 一致；`wt-1119a` 工作区 `git status --porcelain` ＝ 0 行。

## 四、红线核查（五条）

| 红线 | 核法 | 结果 |
|---|---|---|
| push／`--force`／rebase／merge／checkout origin | 判据 7；`git status -sb` 无上游；`work/pii-1119` 只有 1 条提交且父为 `beeedc26` | 未触发 |
| 改 `refs/heads/relive-src/*`、`work/reboot-1118`、`archive/local-rebuilt-1118` | `git for-each-ref` 实测：`relive-src/exp/resource-ledger`＝`beeedc26`、`work/reboot-1118`＝`2923090a`、`archive/local-rebuilt-1118`＝`1dd9e948`（该件是 `refs/heads/` 下的分支，不是 tag） | 未触发 |
| `git add -A`／`.`／`-f` | 提交 12 件全为 `A`，无其它路径；报告 §三 记 `cherry-pick -n` ＋ 点名 add | 未触发 |
| 冲突不报自改 | 报告 §三 贴 `CHERRY_PICK_EXIT=0`、`git diff --cached --name-only`＝12、无 UU/AA/DU；判据 4 的 blob 全同从内容侧排除改写 | 未触发 |
| 报告写真实用户名 | 报告内真名 0 命中 | 未触发 |

## 五、勘误、采信限度与观察（不改结论）

1. **卡面 `:17`／`:38`／`:39` 与旧派验单的双反斜杠 `-F` 写法仍是老坑。** 本卡在脱敏线上单/双写法都是 0（执行方 §一.3b 已两种都量），故不影响判据 5/6 的结论；但双写法在「含真名的线」上会假通过（C 卡实测双 6／单 93）。已入 BACKLOG B-13，本卡不据此打回，下一张卡统一订正为单反斜杠写法。
2. **`--no-verify` 属采信限度**：我无法从盘上证明当时钩子被跳过。替代证据成立：`wt-1119a` 现跑 hygiene `0 项不合规` exit 0；`develop` 现跑 `check:fast` 全绿 exit 0；判据 4 的 12/12 blob OID 全同 + 提交只含 12 个新增件（零改源码配置）从内容侧封住风险。卡面 §七 裁定一接受该处置，我记同结论；「此后 worktree 优先挂 junction 共享 `develop/node_modules`」这条新规请出卡时写进卡面，别只留在裁定文字里。
3. **判据 8 的 `check:fast` 跑在 `develop` 检出**，严格说验的是 `develop` 树而非 `f8728c8d` 树；等价性靠「本卡零改源码配置 ＋ 12 件 OID 全同」支撑。此为环境限制（新 worktree 无 `node_modules`，`pnpm install` 有打断槽位风险），单列不计入判据分母。
4. **报告引用的卡面尺寸已过期**：§头写「卡面 3,744B / 58 行」，我受验时卡面为 4,963B / 66 行 —— 差额是负责人 11:55/11:56 补的 §七 与 11:40 勘误，发生在交件之后，非执行方改件，不扣分。
5. **报告 §七.2 的建议我认可**：再搬时以 `f8728c8d` 作新对照锚点比继续用 `2923090a` 稳（后者随旧线留档会越来越远）。留给后续卡执行。

## 六、环境失败

一条，不计入判据分母：`pnpm check:fast` 在 `wt-1119a` 无法运行 —— 预置失败：该 worktree 无 `node_modules`（`找不到 node_modules\typescript\bin\tsc`），按 AGENTS.md §2.8 不做 per-worktree 安装以免重建 better-sqlite3 打断在跑槽位。反例条件：若后续某卡在 `develop` 检出的 `check:fast` 也红，则本条的等价性论证当场失效，判据 8 改记为不通过。

## 七、数字冻结

本文件：**已冻结，不再改。** 落盘后一次报出字节数／行数／MD5／`tail -1`（见同日群消息），此后改动须重新报全套数字并说明动了什么。

## 八、版本记录

- v1（2026-11-19）：首验判词，按派验单九条判；结论 PASS。

<!-- DONE -->
