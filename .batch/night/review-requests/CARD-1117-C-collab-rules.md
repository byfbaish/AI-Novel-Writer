From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# 派验单：CARD-1117-C（协作规则并版）

执行方：产品经理
受验对象：卡面 `.batch/night/cards/CARD-1117-C-collab-rules.md`（判件基准，字节冻结）
受验版本：报告 `.batch/night/reports/CARD-1117-C-report.md` 所指提交（以 `git log` 实读 sha 为准）

## 一、必验（缺一条即不通过）

1. `git ls-files '.batch/night/org/collab-rules.md'` 非空；文件名无 `.v`、无数字版本号。
2. 裁定 §二 八条逐条在文件里可指认：核对报告里的「八条 → 段号」对照表，逐行翻文件确认，八行齐全。
3. 冲突条款有取代标注：`grep -n "1224ee2b" .batch/night/org/collab-rules.md` 命中并落在冲突句之后。
4. 头部机检：`sed -n '1p'` 为 `状态：现行`，`sed -n '2p;3p'` 逐行匹配 `/^(?:From|To): .+$/`。
5. 本卡提交不含 `reports/task-ledger.md`（14:1x 改订：该件是未跟踪件，随 B 卡首次入库）；报告须给出指针行逐字原文一行。
6. 旧件搬迁（若有）：`git status` 呈 `R` 不呈 `D`；无旧件则报告写明「不存在」，不得出现指向 archive 的空指针。
7. `pnpm check:fast` 全绿（贴 exit code）。
8. 提交信息含 `CARD-1117-C`；无 push、无 tag、无合并。

## 二、红线（任一触发即不通过）

1. 改群 notice 文本或任何通知类配置。
2. 改 `.batch/night/org/ruling-git-workflow-1117.md`（裁定原件）。
3. 新建带 `.vN`／数字编号的文件名。
4. `git add -A`／`-f`／`--no-verify`。
5. 在 `develop` 主工作区改文或提交。

## 三、判词要求

- 另存 `.batch/night/reports/CARD-1117-C-qa-firstcheck.md`：首行 `执行方：QA`，逐条「命令 → 输出摘要 → 成立/不成立」，末行 `<!-- DONE -->`。
- 只判不修；判据歧义写进判词交我终裁。
