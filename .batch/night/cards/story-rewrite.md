# 卡：故事段换稿（README 精简版 250 字 + docs 开篇用长版）

## 基线

- `git -C C:\develop\workspace\dsh-handoff-relay rev-parse HEAD` = `e114e4408962d6d2dd6ad99fc7fa1a545db77467`
- `git status --porcelain` 无输出
- 输入两份（都在仓外，只读，别自己另写）：
  - 长版 700 字：`C:\develop\workspace\AI-writer\develop\.batch\night\essays\readme-story-bilingual.md`（中文约 700 字 + 英文一段）
  - 精简版 250 字：`.batch\night\essays\readme-story-short-bilingual.md`（产品经理新产出，中文 250 字上下 + 英文对应）

## 做三件事

### ① README 换稿（替换，不是追加）

- `README.zh-CN.md`：把 `## 为什么叫 relay` 下正文（现 L57–L67 一带）整体换成**中文精简版**。
- `README.md`：把 `## Why "relay"` 下正文整体换成**英文精简版**。
- 保留原有的 `完整设计随想：[docs/why-relay.md]` 链接行，位置放节末。

### ② `docs/why-relay.md` 换开篇

- 现第一节 `## 一、一个被误认为「夺舍」的瞬间`（L3–L9 一带）整体替换成长版正文（中文 700 字）。
- 后续三节 `## 二、怎么修的`、`## 三、多播：想到了，但先不做`、`## 四、这个插件的边界`**保留原样**，不重写、不合并。
- 长版正文里若已经重复讲了「怎么修的」，把重复段落删掉再放，只保留讲故事的部分；最终 `docs/why-relay.md` 里同一件事不许出现两遍。

### ③ 一次提交

```
git add README.md README.zh-CN.md docs/why-relay.md
git commit -m "docs: sharpen the relay origin story"
```

点名 add 三个路径，禁止 `-A` / `git add .`；不许 push、不许打 tag、不许重启。

## 禁改

`package.json`、`index.js`、`index.test.mjs`、`cordis.patch.yml`、`LICENSE`、`.gitignore`。

## 判定线

1. `git show --numstat --format=` 恰三件；`porcelain` 落盘后为空。
2. 脱敏零命中（README.md / README.zh-CN.md / docs/why-relay.md）：`C:\`、`C:/`、`.dsh`、`.batch`、`session-[0-9a-f]`、用户名、项目名、群名、助手名、`负责人`、`主人`；「session id」作为概念出现可以，具体值不行。
3. 因果链七段齐全（撕裂 → 外挂记忆 → 想指路但话没到 → 自己接桥并验证 → 只带文件名的误判 → 修成绝对路径 → 命名），且写清插件是那晚我们自己做的、它是发现「正好能用」并排了验证。
4. 不得出现「AI 觉醒 / 自我意识 / 有灵魂」这类定性；误判只写机制。
5. `node index.test.mjs` 仍 `TOTAL: 56/56 PASS`，exit 0。

## 产物

`.batch/night/reports/story-rewrite.md`：提交 SHA、`show --numstat` 原文、脱敏命令与输出、测试末两行，末尾 `<!-- DONE -->`；另落 `.batch/night/signals/doubao/story-rewrite.done`。
