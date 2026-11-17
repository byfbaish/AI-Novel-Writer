执行方：QA
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连

# 首验判词 · p56 补件（报告头部重排，另存 v2）

- 派单：`C:\develop\workspace\AI-writer\develop\.batch\night\cards\p56-fix-report-header.v1.md`｜1,560B｜MD5 `6657af782dda0d252c6835040e1eeb4a`（B 类：只产产物，不建提交）
- 裁定依据：项目总负责人 12:53 裁定「报告头按 notice＋§4 第 8 条：首行 `执行方：`、第二行 `model=`；三元组是判词首行的要求，不必搬到执行方报告首行」
- 判据分母：6 条（卡面「只做一件事」3 条 ＋「禁改区」2 条 ＋ 回报 1 条）

## 一、判据逐条（证据为我自己从盘上算，未采信自述）

**1 PASS｜v2 存在、路径与卡面一致**
```
$ ls -l .batch/night/staging/p56-report.v2.md
12,080B  2026-11-16 12:42
$ md5sum p56-report.v2.md
bf08891d7e81d4493733c0a932ba1b2e
```

**2 PASS｜首行 / 第二行按口径**
```
$ head -2 p56-report.v2.md
执行方：WorkBuddy
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连
```

**3 PASS｜第三行起与 v1 逐字相同（字节级，我按偏移量核的，不用执行方给的方法）**
```
$ python -c "..."
v2 12080, v1 11983, diff 97
v2 endswith v1 全字节段: True
v1 首 60 字节在 v2 中的位置: 97
```
⇒ v2 = 97 字节新增头（两行）＋ v1 全文，零增删零改写。

**4 PASS｜末行完成标记**
```
$ tail -1 p56-report.v2.md
<!-- DONE -->
```

**5 PASS｜v1 未被原地改（版本纪律）**
```
$ ls -l p56-report.md ; md5sum p56-report.md
11,983B  2026-11-16 12:14      ← mtime 仍为 12:14:01
d1bd3396b86aca06190dbaf6d2e2c523
```

**6 PASS｜仓库零改动、无新提交**
```
$ git -C wt-p56 status --porcelain
（空）
$ git -C wt-p56 rev-parse HEAD
050abd1057938fa609c2d9ffcdba64a0c4e65a3c    （仍为 12:12:34 那条，未新增提交）
```

## 二、一条遗留（需卡面出 v6，不影响本件通过）

卡面 `p56-wb-docs-stale.v5.md` 的 **§4 判据 7 原文仍写「报告首行钉『路径+字节数+MD5』三元组」**，判据 8 写「报告正文第二行钉 `model=`」。按 12:53 的裁定，三元组属判词首行要求，执行方报告首行改为 `执行方：`——**裁定与卡面原文在这一条上不一致**：v2 的三元组落在第 3 行（正文首行），满足判据 7 的「正文复写同一组值」这半句，不满足「首行」那半句。

本次按裁定判 PASS；但卡面 v5 若照旧使用，下一张卡会再撞一次。建议卡面出 v6 把判据 7 改成「判词首行钉三元组、报告正文复写同值」，与裁定同口径。

## 三、结论

**PASS**（6/6）。补件达成目的：v1 的「头行序反了」这一笔由此销掉，p56 主卡首验结论不变（原判词 `qa-p56-firstcheck-1116.md`，本件为其补件的首验，不改原判词）。

## 四、数字冻结

本件：落盘后不再改；后续改动另存 `.v2` 并重报全套数字。

<!-- DONE -->
