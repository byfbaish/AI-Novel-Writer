状态：收口
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-20 06:45
卡号：CARD-1119-H
依据件：`.batch/night/cards/CARD-1119-H-pii-preflight.md`、`reports/CARD-1119-H-qa-firstcheck.md`

# CARD-1119-H 裁定与终审

> 本件补记三件事：①四笔裁定（原先只在群里口头裁过，未落盘）；②判据 4 的书面读法（卡面 §三 第 4 行已同步）；③终审与合并推送结果。受验件：提交 `adb17d44`。

## 一、裁定（2026-11-20 03:5x–04:0x）

1. **`rotation/pii-scan.mjs` 的 4 行补丁：驳，已回滚。** 理由三条：该脚本被四个群共用，不属于本 Goal 范围；`.piiallow` 两行式（`# 依据：` ＋正则）已能表达同一语义，无需改工具；「补丁可回滚」不等于「补丁该改」——回滚能力不能替授权背书。developer 已回滚，`md5sum rotation/pii-scan.mjs` ＝ `63e9328f548f66174e53a3e9937ddda8`（9,190B）与补丁前一致。
2. **email 6 处真邮箱不改文本：认。** 位置 `merge-p55-into-develop-qa.md:22,23,33`、`task-ledger.md:154`、`incident-plugin-push-1116.md:13,16`。它们是已发生事件的回执取证，改文本等于改证据；机检由 `.piiallow` 收敛，不改原件。台账落点归产品经理另记。
3. **`.piiignore` 放 `.piiallow` 自身一行：认。** 只此一行，用于让 allow 表不被自身规则命中；除此之外不得增行。
4. **判据 4 读法**（卡面 §三 第 4 行已按此改写）：`grep -vE '^[[:space:]]*(#|$)' .piiallow | wc -l` ＝ `grep -c '^# 依据：' .piiallow` ＝ 报告表 allow 行数，三者相等。原命令 `grep -c '^[^#]*# 依据：'` 会把「行首到 `#` 之间必须非空」当成前置条件，与 `.piiallow` 两行式写法相冲，属我写卡时的笔误，不扣执行方。

## 二、坐实项（我独立复核）

- `grep -c '^# 依据：' .piiallow` ＝ **149**；正则行 149；报告表行 149。
- `.piiignore` 仅 1 行（`.piiallow`）。
- `md5sum rotation/pii-scan.mjs` ＝ `63e9328f548f66174e53a3e9937ddda8`（补丁已回）。
- `git merge-tree --write-tree exp/mainline-1119 card/1119-H` exit 0（树 `6a66eef8`）——合并无冲突。

## 三、QA 勘误处置

- 报告 §五 写「扫描 3362 个文件」应为 **3363**：认勘误，**不返工**（报告已与提交绑定，重写报告＝换字节，收益为零）。判词已记正确值，判据 1 只认「0 处命中＋EXIT=0」，不影响结论。
- 卡面判据 4 字面旧读法：已在卡面 §三 同步为本件 §一.4 的写法。

## 四、终审与合并、推送

- 我终审：**通过**（受验 `adb17d44`；QA 首验 PASS 见判词 `reports/CARD-1119-H-qa-firstcheck.md`）。
- 合并（主身/授权人执行）：`git switch exp/mainline-1119` → `git merge --no-ff card/1119-H -m "merge(stage3): 脱敏前置落地（CARD-1119-H adb17d44）"`，结果 **`eba81c43`**。
- 推送（主身执行，未 force）：`git push origin exp/mainline-1119:refs/heads/exp/resource-ledger`，旧头 `beeedc2630c01bda5e1774f0f30f602a8d904e01` → `eb4bd364`。
- **声明：push 我一次没执行过**；我最后一次写操作是提交 `b908574d`。

## 五、遗留（不在本卡判）

1. `archive/README.md` 与 `MANIFEST.sha256` 的 sha 不一致（MANIFEST 记 `78d56ea0` 版 `fd213df1…`，现版 `0155079f…`）——回写 MANIFEST 须另出卡。
2. `B-23`：`archive/` 整目录是否豁免 `versioned-filename` 规则（改码须单独出卡）。
