执行方：QA · AI writer项目组
model=未取到（本会话不暴露 model 标识，不编） | 倍率=未取到 | provider=未取到

# p55 合回 exp/resource-ledger · 首次验收判词

- 受判对象：`C:\develop\workspace\AI-writer\develop`，分支 `exp/resource-ledger`，HEAD＝`69cd4a41cf5f89a813d09104bcf744959922dc7c`
- 派验单：`.batch/night/review-requests/merge-p55-into-develop.v1.md`（2,719B / MD5 `571346a76526b4baf764a76b521a167a`，派单方自报，本单不重核其哈希）
- 验收性质：只验「合回后语义未变」；p55 原判词（`reports/p55-pinned-cwd-allowlist-qa.md` / `5498905b…`）不重判、不改写
- 判定时间：2026-11-16 07:49–07:53 CST

## 〇、起点核验（复跑入口）

```
$ git rev-parse --abbrev-ref HEAD
exp/resource-ledger
$ git rev-parse HEAD
69cd4a41cf5f89a813d09104bcf744959922dc7c
$ git cat-file -p HEAD | head -5
tree c877af69f8e2e262231e7f4febf7ab3c05f3e312
parent 545988b260160fa495abd9046f2d433157961cf3
parent 51e95bf8e3a3f903e2ffc217f338332e00c7d0ec
author baiyunfei <947875122@qq.com> 1794786088 +0800
committer baiyunfei <947875122@qq.com> 1794786088 +0800
$ git log -1 --format='%s'
merge: bring wt-2 whitelist card p55 into exp/resource-ledger
```

树对象 `c877af69` 与 developer 合回方案 §三 里 dry-run `merge-tree --write-tree` 的预测值一致，说明合并前预演与实做同一棵树。

## 一、逐条判据

### 1. 父与身份 —— 通过
`git log -1 --pretty=%P` 输出两个父：`545988b2…`（develop 侧，回滚锚点）与 `51e95bf8…`（wt-2 侧，p55 受判提交）；`git log --oneline -3` 首行为 merge commit，作者/提交者 `baiyunfei <947875122@qq.com>`，时间 `1794786088 +0800`（＝07:41:28 CST）。

### 2. 祖先关系 —— 通过
```
$ git merge-base --is-ancestor 51e95bf8 HEAD ; echo $?
0
```
p55 判词绑定的 SHA 仍在祖先链上，未因合并被 rebase 改写。

### 3. 提交计数 —— 通过，实测 5
```
$ git rev-list --count 26627655..HEAD
5
$ git log --oneline --graph 26627655..HEAD
*   69cd4a41 merge: bring wt-2 whitelist card p55 into exp/resource-ledger
|\
| * 51e95bf8 feat(workbuddy): allow extra pinned cwds via WORKBUDDY_ALLOWED_CWDS
* 545988b2 feat: disable Hy4 across workbuddy model policy
* e3dafb51 fix: count empty chapters as zero in last-10-chapter median
* 747fdbb4 docs: 修 2 条指向 .workbuddy 的断链（改为代码块引用）
```
构成＝develop 侧 3 条（`747fdbb4` / `e3dafb51` / `545988b2`）＋ wt-2 侧 1 条（`51e95bf8`）＋ merge 1 条。派单方「按实数 5 为准」的更正成立，方案 §4 第 3 项写 4 确为算错。

### 4. 变更集 —— 通过
```
$ git diff --numstat 545988b2..HEAD
103	0	scripts/workbuddy/__tests__/attach.test.mjs
57	9	scripts/workbuddy/attach.mjs
15	3	scripts/workbuddy/workbuddy-attach.mjs
```
恰三文件，行数与 p55 卡面判据逐条对上；无第四文件，与禁改区（`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目）交集为空。

### 5. 工作区与 R4 —— 通过
```
$ git status --porcelain | wc -l
0
$ git diff --ignore-cr-at-eol --stat        # 空
$ git diff --numstat                        # 空
```

### 6. Hy4 断言 —— 通过
```
$ grep -n 'HY4_DISABLED = true' scripts/workbuddy/model-policy.mjs
26:export const HY4_DISABLED = true
$ node -e "import('./scripts/workbuddy/model-policy.mjs').then(m=>console.log(...))"
ALLOWED_MODELS= ["DeepSeek-V4.1-Flash"] HY4_DISABLED= true
```
`:26` 命中，运行时白名单只剩 Flash，Hy4 不再出现。p55 报告 §三 记的「wt-2 侧仍含 Hy4」这条技术债在合回后**确已消失**，与 developer 的方案结论一致。

### 7. 回归 —— 通过（三项全绿）
G1（不设 `WORKBUDDY_ALLOWED_CWDS` 投非 wt-2 仍拒）：
```
$ node scripts/workbuddy/workbuddy-attach.mjs status --cwd 'C:\develop\workspace\dsh-group-rules-prompt'
[refuse] 目标目录不在本通道的归属白名单里…
  请求=C:\develop\workspace\dsh-group-rules-prompt
  允许=
    C:\develop\workspace\AI-writer\wt-2
g1_exit=1
```
点名套件：
```
$ node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/attach.test.mjs scripts/workbuddy/__tests__/model-policy.test.mjs
✓ attach.test.mjs (74 tests)   ✓ model-policy.test.mjs (25 tests)
Test Files 2 passed (2)   Tests 99 passed (99)
```
闸门：
```
$ pnpm check:fast
[check:fast] typecheck ✓ 15.7s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
```

### 8. 边界（无 tag、未推送）—— 通过
`git tag --points-at HEAD | wc -l` ＝ 0；`git log --oneline origin/exp/resource-ledger..HEAD` 输出 5 条（旧 3 + 新 2），仅本地领先、未推送。

## 二、非阻断记录（不影响判词）

1. `docs/agents/workbuddy-channel.md:130` 与 `scripts/workbuddy/workbuddy-attach.mjs:807` usage 仍写「默认仍是固定归属／只允许 wt-2」，与白名单语义不符。G1 拒绝文案里也照旧打印该措辞。归合回后的文档债，本单不验、不阻断。
2. 合并提交作者为 `baiyunfei`（工作区 git 身份），本单只看父子链与内容，不据此判执行方身份；合回执行方为 developer（负责人 07:34 授权）。
3. 起点树 `c877af69` 与 dry-run 预测一致，属额外旁证，非派验单要求项。

## 三、结论

**PASS**。八条判据全部按派单方原始命令复跑通过，判词绑 `69cd4a41cf5f89a813d09104bcf744959922dc7c`。HEAD 离开该 SHA 则本判词失效。不重开 p55、不验 `dev_byf`/`master`、不推送。

## 四、版本变更

- v1（本件，2026-11-16 07:53）：首次出具。此前无同路径文件。

<!-- DONE -->
