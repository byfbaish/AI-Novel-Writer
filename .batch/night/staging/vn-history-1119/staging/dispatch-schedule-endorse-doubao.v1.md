执行方：豆包联络人 · AI writer项目组
model=（DSH 会话，非外部执行产出） | 倍率=不适用 | provider=DSH
会签对象：`staging/dispatch-schedule.v1.md`｜1,742B｜`e5cdf73caa981c4f51ec766345878855`｜42 行｜20:22:40
会签时刻：2026-11-16 20:30 CST
会签结论：**不通过**——两处硬错会让判档静默失效，须出 v2；豆包侧另补三条硬条款。

## ① 判档命令不可执行（:14、:33）

原文命令原样实跑：

```bash
node scripts/workbuddy/model-policy.mjs describeModelPolicy 2>&1
```

结果：**无任何输出，exit=0**。`scripts/workbuddy/model-policy.mjs` 只 export 函数、无 CLI 入口（文件尾 25 行全是 export 声明）。

影响：回执写「已带判档命令输出原文」，实际是空串，还被 exit 0 放过——比直接拦下更坏。

可执行写法（已实跑）：

```bash
node --input-type=module -e "import {describeModelPolicy} from './scripts/workbuddy/model-policy.mjs'; console.log(describeModelPolicy())"
```

实跑输出：`20:30 → DeepSeek-V4.1-Flash（非高峰时段，DeepSeek-V4.1-Flash 计 0.11x 且 5 折）`

## ② 高峰返回文本不存在（:18–:19）

实测 `pickModel(new Date('2026-11-16T10:30:00+08:00'))` → `ok=false blocked=true window=undefined model=null`；

`describeModelPolicy` 峰态输出：`10:30 高峰 → 不派活（12:00 后可自动派活）`。

影响：v1 让回执去匹配 `DeepSeek-V4.1-Flash（deepseek-peak）`，该串永不出现 ⇒ 高峰永远判成「可派」。

判据应改为匹配子串：`高峰 → 不派活` = 拦下；`→ DeepSeek-V4.1-Flash（非高峰时段` = 可派。两种都退出 0，靠子串判、不靠退出码。

## ③ 豆包侧会签条款（补三条，缺一不签）

- **单窗口容量**：派前看该窗口已投未清任务数；堆太多会引发幻觉与返工，该开新窗就开，但不「一任务一窗」（主人 11-16 口径）。
- **换窗闸**：同一豆包窗口**连续 2 次 turn 失败**才换窗，且换窗须主人批准；不得由联络人自行换。
- **投达判据**：豆包「发了不算投达」。投达 = 注入身份行 + `delivered\<hash>` 副本 + 源目录搬空。退出码语义 `0 ok / 1 failure / 2 not connected`（`scripts/doubao/doubao.mjs` 头注释），**exit 2 不得记作已派**，须原样报回派单方。

## ④ 同一卡不并行（补可复算判据）

派前跑：`Get-ChildItem .batch\night\cards,.batch\night\review-requests -Filter "<卡号>*"`；已有登记即视为已开通道，不另开第二通道（旧教训：#5 双写、P45-fix 双卡）。

## ⑤ 观察（不阻塞，v2 一并改）

`取数时刻：2026-11-16 20:45 CST` 是未来时间戳（文件 mtime 20:22:40），与自身取证时刻矛盾，改为实际取数时刻。

<!-- DONE -->
