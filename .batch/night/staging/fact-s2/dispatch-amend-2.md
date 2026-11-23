# 派单补充 2 · FACT S2 四处请裁的裁定（`bb3f0d83`）— 2026-11-23 18:34，群 admin

外派提交 `0ec6c89c39a4c48f890d9caab41dd13a7db61805`（分支 `card/fact-preflight-3rules`，起点 `7bffc1ee`）我已独立核：5 文件 `+542/−25` 全在白名单内、`git status --porcelain -- src` 0 行、`spaceTimeStableFactKey` 函数体与 `7bffc1ee` 逐字节相同（只把模板串抽成 `${prefix}:`，`prefix='space'`）。

## 裁 ① 判据 1 的 grep 口径改严格口径（原口径作废）

原口径 `grep -n "ipc\|fs\|node:"` **不成立**：`fs` 会命中 `spaceRefs` 这类标识符，改造前就有 13 行命中，天然红。改用严格口径（我实跑 rc=1、零输出）：

```bash
git grep -nE "from ['\"](node:)?(fs|os|child_process)['\"]|require\(['\"](node:)?fs['\"]\)|ipcRenderer|ipcMain|contextBridge" -- src/shared/space-time-consistency.ts src/shared/consistency-preflight.ts
```

判词与 evidence 里必须写「口径修正：以严格 IO 口径为准，宽口径 ``fs`` 作废（原口径命中 `spaceRefs`）」。

## 裁 ② `porcelainLines` 拆成两个键

- `porcelainSrcLines: 0`（`git status --porcelain -- src`）
- `porcelainOtherPaths`: 3 行 `?? .batch/night/staging/d12-*` —— 属他卡早期遗留，本卡未触碰，**不算越界**，写进判词记账即可。

## 裁 ③ `enUS` 文案不要求逐字定稿

允许对译，但 QA 须核：`enUS` 与 `zhCN` 语义一致、无新增承诺、无与既有文案风格冲突；有偏差按记账（不打回）处理。

## 裁 ④ `findDuplicateSlotAttacks` 排序补 `space/hour` 字典序 —— 采信

在 impl-package 要求的 `sourceChapter` 升序之外补 `space/hour` 字典序，属稳定输出的 tie-break，不改任何判据；判词写一句「在 `sourceChapter` 升序基础上补 `space/hour` 字典序，输出稳定」即可。

## 补件要求（外派）

产物目录 `C:\tmp\fact-s2\` 不存在 ⇒ 回执只活在会话正文里，无可核产物。补落一份到 `C:\tmp\fact-s2\workbuddy\`，内容：四行回执头、四条命令原文与末行（含 `Tests N passed (N)`、`EXIT=0`）、`spaceTimeStableFactKey(['unregistered-space','6','查无此店'])` 改造前／改造后两行字面量、白名单 5 行、`filesChanged`。**不补也照常进 QA 复判**（QA 自行复跑），但缺这份按「产物未落盘」记账。
