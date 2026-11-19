执行方：QA · AI writer项目组（群分身）
model=deepseek-v4.1 | 倍率=1x | provider=deepseek

# CARD-1119-H 推送前脱敏前置 · 首次验收判词

卡号 CARD-1119-H｜受判 HEAD **`adb17d44`**（分支 `card/1119-H`，父 `2680f8b7`，起点 `058c0867`，三笔提交）｜取数 2026-11-20T04:1x–04:2x +0800｜工作区 `C:\develop\workspace\AI-writer\develop`
受判件：`.batch/night/cards/CARD-1119-H-pii-preflight.md`（`exp/mainline-1119` 版，6,944B／84 行）、`.batch/night/review-requests/CARD-1119-H-pii-preflight.md`（29 行）、交件报告 `.batch/night/reports/CARD-1119-H-report.md`（33,031B／259 行／`dbff91b7842d784e45cfb9e088d824fa`／crlf=0／末行 `<!-- DONE -->`）
判据 4 按项目总负责人 2026-11-20 裁定读作：`grep -c '^# 依据：'` ＝ 正则行数 ＝ 报告表行数（卡面 §四 原文字面改尚未同步，等 H 合并后书面补；本条不因此扣分）。

## 一、结论

**PASS**。七条判据全部成立，六条红线零触发。可进入合并与推送环节；推送仍按 Goal rules 第 2 条只由主身或授权执行人做。

## 二、判据逐条（命令原文 ＋ 关键输出 ＋ exit）

| # | 命令原文 | 实测输出 | 判定 |
|---|---|---|---|
| 1 | `node "<rotation>/pii-scan.mjs" --repo . --all-tracked` | `隐私机检：通过（扫描 3363 个文件，0 处命中）`，`SCAN_EXIT=0` | 成立 |
| 2 | `git ls-files \| grep -c 'tmp-c9ff5961.jsonl'` | `0`（grep 无命中，exit 1 属 grep 语义，非失败） | 成立 |
| 3 | `md5sum C:/tmp/pmo-stage2-quarantine/tmp-c9ff5961.jsonl`；`git cat-file blob b5cbf42a \| md5sum`；`ls -la C:/tmp/pmo-stage2-quarantine/` | 两条均 `8a16b866cf6e453e407abcb7f6550c7a`；文件在（1,591,957B）；目录另有 `README.md`（1,776B）、`delivered/`、`scripts/`、`.batch/` | 成立 |
| 4 | `grep -vE '^[[:space:]]*(#\|$)' .piiallow \| wc -l`；`grep -c '^# 依据：' .piiallow`；报告 §四 表行数 | `149`／`149`／`149`（`wc -l` ＝ `302`＝4 表头＋149 依据＋149 正则） | 成立（三处相等） |
| 5 | `git diff --name-only 058c0867 HEAD -- .batch/night/archive \| wc -l`；`git show HEAD:.batch/night/archive/MANIFEST.sha256 \| sha256sum` | `0`；`ab1119a28ff94b38825da188feb228eea456a151efdd134fa5567f51d98426b0`（未变） | 成立 |
| 6 | `node scripts/ops/check-batch-hygiene.mjs --all`；`pnpm check:fast` | `0 项不合规` `HYG_EXIT=0`；`typecheck ✓ 16.2s`／`doc links: checked 1468, broken 0`／`doc placement … 新增 0 条`／`[check:fast] 全部通过。` `CHECKFAST_EXIT=0` | 成立 |
| 7 | `git status --porcelain -uall \| wc -l` | `0` | 成立 |
| 附 | `git log --oneline -4` | `adb17d44`／`2680f8b7`／`34a20bc6`／`058c0867` | 成立（`rev-list --count 058c0867..HEAD`＝3） |

## 三、红线 6 条

| # | 红线 | 实测 | 判定 |
|---|---|---|---|
| 1 | push／force／rebase／merge／reset --hard | 无远端含 `adb17d44`（`git branch -r --contains` ＝ 0 行）；`git status -sb` 仅 `## card/1119-H`（无上游）；`exp/mainline-1119` 仍 `c398ee76` | 未触发 |
| 2 | 改 archive 96 件字节或 `MANIFEST` | 判据 5 面差异 0、MANIFEST 哈希 `ab1119a2…` 未变 | 未触发 |
| 3 | `git add -A`／`.`／`-f` | 三笔提交改动面逐一核对：`34a20bc6` 12 件（T1 8＋jsonl 删除＋`.gitignore`＋`.piiallow`＋报告）、`2680f8b7` 2 件（`.piiignore`＋报告）、`adb17d44` 2 件（`.piiallow`＋报告）——全部具名路径，无夹带 | 未触发 |
| 4 | `.piiignore` 整目录掩盖／真名或真密钥进 allow | `.piiignore` 全文 4 行，唯一规则 `.piiallow`；`.piiallow` 中 `$USERNAME`／`$USERPROFILE` 命中 0／0；`sk-proj-`／`sk-ant-`／`nvapi-`／`AIza`／`ghp_`／`xoxb-` 命中 0 | 未触发 |
| 5 | 改 notice／`AGENTS.md`／`src/` 业务逻辑 | 三笔提交改动面不含 notice、`AGENTS.md`；`src/` 零改动 | 未触发 |
| 6 | 删除 quarantine 件 | 件在（md5 与 blob 一致） | 未触发 |

## 四、勘误与观察（不改结论）

1. **报告 §五 判据 1 写「扫描 3362 个文件」，实测 3363**（`git ls-files | wc -l` ＝ 3363，脚本 `:157` 就是用 `ls-files` 计数）。同报告 §六 回滚段自己写的是 3363，前后不一致，属笔误。建议合并后一笔顺带改正。
2. **卡面 §四 判据 4 的字面仍是旧读法**（`grep -c '^[^#]*# 依据：'`）。负责人已明示书面同步等合并后补；本次按新读法判，**不构成打回理由**，但同步前任何人对卡面照抄会得到 0 而不是 149，属已知坑。
3. `secret` 类 22 条 allow 行（合计 37 处）我抽 3 条复核：`sk-reuse-coverage-20261109`、`sk-board-access-design`、`sk-capsule--complete`——均为内部方案编号／测试夹具字面量，非密钥；全表未见真密钥形状（见红线 4）。派验单 §三.2 的抽 3 要求已满足。
4. allow 面无宽泛正则（`.*`／`\w+`／`\S+` 结尾等命中 0），不会把未来真实泄漏一并吞掉。
5. `tmp-c9ff5961.jsonl` 的 `.gitignore` 例外写在 `.batch` 反向包含段内（`.gitignore:102`），`git check-ignore -v` 命中该行，语义正确。

## 五、采信限度

1. `pnpm check:fast` 的 `typecheck` 时长与 developer 报告不同（我 16.2s、报告 36.0s），属机器负载差异，不影响 exit 0。
2. 判据 1 的「`.piiallow` 生效后才归零」我只做了等价性核对：同一脚本、同一 `--all-tracked` 口径，在 `058c0867` 上为 90 文件／289 处，在 `adb17d44` 上为 0 文件／0 处，期间唯一变量是 T1 改文本＋T2 出跟踪面＋`.piiallow`／`.piiignore`；工具 md5 已回到补丁前 `63e9328f548f66174e53a3e9937ddda8`（9,190B），可排除工具侧放水。未做「抽掉 allow 后复现 289」的反证（会临时改动工作区，不做）。
3. 红线 3 只能由提交内容反推，无法证明 developer 当时敲的是哪条 `git add` 命令。

## 六、遗留（不属本卡判据）

1. `wt-1117f`（120 行）、`wt-p56`（14 行）、`night-probe`（68 行）、`test-master`（0 行）四棵 worktree 仍在 `git worktree list` 里，前二棵有未提交改动，按 admin 口径 stage 4 统一清、清前先确认归属。
2. 本判词落盘时为 `??` 未入库，与 stage 2 判词同样待后续一笔一并 `git add`（字节不动）。

<!-- DONE -->
