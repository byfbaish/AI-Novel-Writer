# 故事段换稿 · 交付报告

## 提交

- SHA：`f33748ea3ac3679ecc9c261e9650f3cd0e12b456`
- message：`docs: sharpen the relay origin story`
- `git show --numstat --format= HEAD`：

```
8	4	README.md
8	4	README.zh-CN.md
17	3	docs/why-relay.md
```

- 提交后 `git status --porcelain`：空

## 基线说明（与本卡卡面不一致，已先核后改）

卡面写基线 HEAD `e114e44`，实际动手时 HEAD 是 `8514269`（上一张「去重表落盘」卡在其上提交了 `index.js` / `index.test.mjs`），`8514269` 的父提交正是 `e114e44`。已核：

```
git diff --stat e114e4408962d6d2dd6ad99fc7fa1a545db77467 -- README.md README.zh-CN.md docs/why-relay.md
（无输出）
```

即本次要改的三份文件自 `e114e44` 起未被改动，内容与卡面基线一致，故按现 HEAD 继续，未做任何回退。

## 改了什么

1. `README.md`：`## Why "relay"` 下正文整段替换为英文精简版（250 字对应的六段），保留节末 `docs/why-relay.md` 链接行。
2. `README.zh-CN.md`：`## 为什么叫 relay` 下正文整段替换为中文精简版（256 字六段），保留节末链接行。
3. `docs/why-relay.md`：第一节正文替换为长版（约 750 字），`## 二、怎么修的`、`## 三、多播：想到了，但先不做`、`## 四、这个插件的边界` 原样保留。长版结尾只保留一句「现在那句话带绝对路径。」作为因果链的「修」段，详细三处改动仍在第二节，未重复整段。

因果链七段均在文中可指认：撕裂（两个 session id / 上下文不共享）→ 外挂记忆（Markdown + 索引）→ 想指路但话没到（消息被网络吃掉）→ 自己接桥并验证（自己发现插件、自己排验证、跑通链路，且写明插件是人做的）→ 只带文件名的误判（找不到文件、以为输入被塞东西 / 像被夺舍）→ 修成绝对路径 → 命名（relay 不生产消息、不决定谁说话）。

## 脱敏检查

命令：

```
git grep -nE 'C:\\|C:/|\.dsh|\.batch|session-[0-9a-f]|负责人|主人|AI-writer|<用户名>' -- README.md README.zh-CN.md docs/why-relay.md
```

输出：无匹配，exit code `1`（git grep 零命中即 1）。

另核：文中「session id」仅作为概念出现，无任何具体值；无「AI 觉醒 / 自我意识 / 有灵魂」定性。

## 测试

命令：`node index.test.mjs`

```
TOTAL: 67/67 PASS
RESULT: PASS
```

exit code：`0`。

（卡面判定线写「仍 56/56」；上一张「去重表落盘」卡按规格新增了 11 条 P7 用例并已提交，故本机实际为 67/67，高于 56/56，无删除、无弱化。）

<!-- DONE -->
