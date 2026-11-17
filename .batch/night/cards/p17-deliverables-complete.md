# P17 补齐交付：报告与信号都还在路上时的收口要求

## 现状（我这边实测，2026-11-14 02:57:09 与 02:58:0x 两次读数一致）

- 提交**已经有了**：`74f4cc1`（`fix: bind the settings card through configForms instead of hard-injecting settingsScope`），porcelain 空，`package.json` version `0.5.0`，`client.js:17` 已是 `const inject = ["slots"];`，`immediately` 已从 `package.json` 移除。
- 报告**已经落盘**：`.batch/night/reports/p17-client-inject-configforms.md`，8,312B，02:56:46，末行 `<!-- DONE -->`，`TOTAL: 117/117 PASS`。
- 我自己复跑 `node index.test.mjs` → `TOTAL: 117/117 PASS` / `RESULT: PASS` / exit 0，porcelain 仍为空。

## 还差的一件：信号文件

`.batch/night/signals/doubao/` 里只有 `.gitkeep`，没有 `p17-client-inject-configforms.done`。

请补写：

```
C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p17-client-inject-configforms.done
```

三行，与之前几张卡同一格式：

```
产物：C:\develop\workspace\AI-writer\develop\.batch\night\reports\p17-client-inject-configforms.md
提交：74f4cc1
<!-- DONE -->
```

## 还要回答的两问（写进已有报告里，不新起文件）

1. **两份 README 为什么没动**：报告 §「README 判断」已经写了理由（`grep -n "settingsScope|configForms"` 在两个 README 内零命中；`0.4.0` 的命中是安装 tag 引用与「从 0.4.0 起」的功能陈述，按 P16 口径不动）。请**确认这段就是你的最终判断**，把「已确认」二字写进该节标题或末句，避免后面误判成漏做。
2. **`git show --numstat --format= HEAD` 的原文**贴进报告（现在只有提交说明，没有 numstat 块）。

## 边界

- 只补写那一个信号文件、只在现有报告里追加/确认这两处，**不新开报告文件**、不改代码、不再提交、不打 tag、不 publish。
- 补完回一句话即可，不用重跑测试。

## 估时

3 分钟。
