From: D18b-WorkBuddy
To: 大肥鱼@主身
卡号：D18b｜会话标识：2026-11-22T23:44+08:00（本会话首条派单时间）｜起点：ff914aea
模式：工作模式｜模型：DeepSeek v4.1 Flash（档位：Flash / 低延迟档，非「快速」）

产物三元组（`C:\tmp\s5-outbound\d18b\workbuddy\`）
- seed-pre.mjs ｜ 351 行 ｜ 18,424 B ｜ sha256 d2117433
- run-live.mjs ｜ 421 行 ｜ 21,993 B ｜ sha256 3ca4c9fd
- seed-dryrun.log ｜ 29 行 ｜ 2,247 B ｜ sha256 a33efa2f

`node --check`：`seed-pre.mjs` exit 0（无输出）；`run-live.mjs` exit 0（无输出）。

Dry-run 三值原文（未启动 Electron）
- `synopsis_covered_to = 5`
- `synopsis_unit_cursor = {"volumeIndex":1,"unitIndex":2,"writtenInVolume":5}`
- `planUnitStats = {"volumeIndex":1,"unitIndex":2,"unitCount":2,"volumeName":"破局","unitName":"反制","volumeChapters":6,"writtenInVolume":5,"remaining":1,"remainingUnits":1,"maxChapters":1,"maxChaptersCeil":1,"ratio":0.3333333333333333,"state":"tight"}`

仓内零改动：`git -C C:\develop\workspace\AI-writer\develop status --porcelain` 空；`git diff --numstat HEAD` 空。

待裁决（三件，均未自决）
1. `## 第N章 <标题>` 形态实测解析失败：`outlineChapterHeading`（src/shared/chapter-heading.ts:84）要求章号后**紧随分隔符**或行尾，空格不算，`## 第1章 潮退` → `plotOutlineCoveredTo=0`。脚本改用 `## 第N章：<标题>`（只改标点，取值不变），实测 `outlineCoveredTo=5`。impl-package §2.3 的原文形态请回填修正。
2. 临时项目落点：派单写 `…\d18b\workbuddy\proj\`，卡面 §0 写 `…\d18b\proj\`。脚本按派单落在 `workbuddy\proj`，可用 `--proj` 覆盖；`run-live.mjs` 只读 `seed-meta.json` 取路径，不会两边分叉。
3. 回执落点：派单要求 `.batch\night\bridge\to-owner`，但 develop 的 `.batch/` 已被跟踪，写进去会破「`git status --porcelain` 零行」硬验收。故回执留本目录 `receipt-to-owner.md`，请派单方代落。
