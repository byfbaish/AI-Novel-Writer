From: QA · AI writer项目组
To: 大肥鱼 · AI writer项目组（群 admin）／项目总负责人

# S3-D4 开判前：三处口径冲突（未取数、未判定）

开判前核判据分母，发现卡面与派验单不同版；按「判据分母须唯一」的规矩，先报冲突，裁定前我不取数、不出判词。

## 冲突一：派验单引的卡面 sha 与盘上不一致

- 派验单 `.batch/night/review-requests/s3-d4-conflict-copy.md`（29 行 / 2,672B / sha256 `23f99b3f18ca96d9ada6f4ef347db5ae2e6a6e838d90609c8a4ff5d65324a144`）判定纪律段写：判据分母＝卡面 `5bc84e8b1f1fb4254c4d9044ae8e240fd702b024f3a36fe991a7fc92587e81e3`。
- 盘上现卡面 `.batch/night/cards/s3-d4-conflict-copy.md`：**67 行 / 5,103B / sha256 `0a70adebb593bf2fa99e4ebfa957b4122df4734c4c47838a71fc2352f44e29e0`**（mtime 11-22 10:20）。
- 两者不等 ⇒ 派验单要么引旧版，要么卡面在派验单后被改过，未回写。

## 冲突二：base 两个值

- 卡面 §1 现状读于 `5a285e83`、§6「分支从 `5a285e83` 起」、§8 R4 命令写 `5a285e83..card/s3-d4-conflict-copy`。
- 派验单写「起点/base：**`b4e8da53`**」。
- 实测：`git rev-parse --short HEAD` → `b4e8da53`，分支 `card/s3-d4-conflict-copy` 现在也停在 `b4e8da53`。即卡面的 base 已过期。

## 冲突三：卡面 §8 的 R4 判据与本卡改动自相矛盾

- 卡面 §8 判据一仍写「`git diff --numstat … -- src electron scripts` **输出为空**（无改动、无新增）」。本卡要改 `AIOutputPanel.tsx`、共享文案模块与其单测，工作区现值 `5 files changed, 133 insertions(+), 26 deletions(-)` ⇒ 照卡面字面判，必然 FAIL。
- 派验单已按 10:2x 裁定改成「改动面全落白名单 ＋ 无新增生产文件」，并注「原措辞只适用于零改码卡」。卡面未同步这段。

## 需裁定（一句话就够）

1. 判据分母以哪份为准：以派验单 6 条为准（我倾向，因它带最新裁定）／等负责人出卡面 v2 后再判。
2. base 统一为 `b4e8da53`（我按实测倾向此值）还是 `5a285e83`。
3. 卡面 §8 是否随 v2 改成「白名单＋无新增」措辞；改完请给新 sha，派验单同步引用。

## 另一件事实（不是冲突）

D4 代码目前只在工作区：`M` 5 个文件（`src/components/panels/AIOutputPanel.tsx` 4/7、`…/__tests__/AIOutputPanel.main-recovery.browser.tsx` 42/2、`src/components/ui/SourceConflictNotice.tsx` 23/9、`…/__tests__/SourceConflictNotice.test.tsx` 35/4、`src/shared/source-conflict-copy.ts` 29/4），分支 `card/s3-d4-conflict-copy` 无新提交；交件报告 `.batch/night/staging/s3-d4-conflict-copy-report.md` 尚不存在（同目录只有派单件 `s3-d4-dispatch.md`）。按派验单「判定面＝提交 sha，不许判工作区中间态」，现在无判面。

判面一到我就跑：两个测试文件整文件汇总行 + `EXIT=`、`pnpm check:fast`、白名单 `--name-status` 原文、界面四场景证据。

— QA，2026-11-22 11:0x
