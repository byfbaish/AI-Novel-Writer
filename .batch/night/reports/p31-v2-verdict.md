# P31-v2 终审单 · 投递层物理去重（contentHash）

执行方：AI writer总负责人
判定对象（派验单）：`.batch/night/review-requests/p31-v2.md` 3,125B / `359CFDA0F3E22CEC1D941DDB5F0F346C`
执行方（首验）：QA｜报告 `reports/p31-v2-qa-firstcheck.md` 7,823B / 80 行 / `128722E91FB0F531930D7B364B017B5D`
执行方（派卡）：豆包
判定时间：2026-11-15 12:41（Asia/Shanghai）

## 一、结论

**通过（PASS）**。C1–C7 七项 7/7；判据只认 `15e9d83..fdf7b17`。

## 二、判定对象三元组

- 卡面：`cards/p31-dedupe-persist.v2.md` 8,240B / 80 行 / `6A6A1FECA14A2F95CD7FE11FCDE77F90`
- 提交：`fdf7b1735bddf42937cd82a7ae824a9e38219f17`，`fix: dedupe handoffs by content hash before waking the model`
- 差异：`git show --numstat` = `45/13 index.js`、`123/0 index.test.mjs`；`porcelain` 空、`--cached` 空；仅领先 origin 一笔，未推送、无 tag

## 三、逐项依据（取 QA 首验）

- C1–C7 全过；套件由 QA 自行复跑 `node index.test.mjs` = `TOTAL: 160/160 PASS / RESULT: PASS`（不采信执行方自报）
- 反证真红（QA 在副本内做，仓库未动）：持久化改 no-op → TC1 红（期望 1 实际 2）；去掉 contentHash → TC2 红（拷回又投）
- 真机取证：`relay.log` 有 `去重跳过 target=… file=… digest=b395bf35f608 原因=重复(内容)`；`dedupe.json`（6,352B）27 条中 7 条带 64 位 contentHash，其余 20 条为升级前旧条目、走第二道 size/mtime
- 卡面前提过期已由我方裁定承认：基线按实际 `15e9d83`（上游含 `801dc38`），卡面写的 138/`6f65550` 作废、不返工；报告名按实际路径 `reports/p31-dedupe-persist.md`（10,236B / 159 行 / `2556533F8EF982CEC204197E82426195`）判，不要求改名

## 四、限定与保留

- QA 限定：卡面 `index.js:876-880` 行号已漂移（现为 watch 序列化段），按内容核「留原地不丢＋1s/5s/15s 重试」未动，判通过。行号漂移属卡面陈旧，不追罚。
- 派卡方（我）认责：卡面写的基线与测试数（138/`6f65550`）在投出时已过期，未在投前核对 HEAD 上游；下张卡起，A 类卡 §0 必须核 `git log --oneline -6` 确认卡面基线仍在 HEAD 上游。

## 遗留

1. **提交未推送**：`origin/master..HEAD` 1 笔（`fdf7b17`）。推送属对外写动作，等主人点头后单独执行；本卡不因此扣分。
2. **重启重扫重复唤醒**（5 条 replay：`p31-dedupe-persist.done`×2、`p31-probe-test.txt`、`zz-test-a.done`、`zz-test-b.txt`）不在本卡范围，另轮开卡处理；形态与本卡 §二.2「启动只捞新文件」相邻但不同源。
3. **`delivered\` 件禁拷回 watch 源目录**已写入纪律，未落机检；下次模板 reissue 时补为硬字段。
4. `index.js` 行号引用需在下次卡面更新时刷新，不单独出补丁。
