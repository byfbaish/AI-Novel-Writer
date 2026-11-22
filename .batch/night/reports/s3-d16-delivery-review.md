# 评审 · CARD-S3-D16 交件报告（项目总负责人）

评审对象：`.batch/night/staging/s3-d16-indicator-verify-report.md` 116 行 / 7,602B / `efadb7e8dd14629222814716c1616fd2e4ab725fc6b0a16271f277e10865a66e`
evidence：`.runtime/.cache/s3-d16/d7c52504-2e1/evidence.json` 148 行 / 4,072B / `3b6a1a1503df2b793e9069bbb5b09caf15768f85ad4d2d2cf7d01005400a71a2`
判定面：分支 `card/s3-d16-indicator-verify` @ `544dcbd5`，零提交
分母：派验单 `f282eb0c…`（30 行 / 4,500B，卡面 sha 已回填 64 位）· 卡面 65 行 / 5,802B / `2848337fc1092afb84ea6b9696be11b3edf50f95568741353f03588fc3819b15`

## 1. 结论

**与卡面判据口径一致，无需改卡面、无 apply（零改码）。** 判据 1／2／5 走 `[live]` 且三项实例读数齐（`instancesThisRun=2`／`exitCode=0`／`leftoverElectronProcesses=0`）；判据 3／4／6 走 `[static]`，未把 static 冒充 live。PASS 与否由 QA 判，本件只作口径核对。

## 2. 逐条口径核对

| 判据 | 卡面要求 | 交件 | 口径 |
|---|---|---|---|
| 1 `[live]` | 进程起止＋重启前后状态栏原文，reload 不算 | pid 64560 退出 `04:14:21.161Z` → 同 `--user-data-dir` 起 pid 20872，前后文本均为「D16 实际模型 B」，`sameModelAcrossRestart: true` | 一致（`git switch` 新起进程，非 reload） |
| 2 `[live]` | 现场构造 A≠B，四处原文对账 | 配置 A=`d16-config`；`binding_json.sourceManifest.modelReceipt.model`=`{"modelId":"d16-actual","modelName":"gpt-4.1"}`；IPC/界面「D16 实际模型 B」；`chatCalls=2` 证明请求真发 | 一致；A≠B 为当场构造 |
| 3 `[static]` | 两档文案原文；同屏渲染随判据 2 贴，不单独升 live | `src/shared/statusbar-model.ts:52-66` 两档、`:27-37` 优先取实际；实机只触到「实际调用」档，已记为限制 | 一致（配置档未触属预期分支，未越级升 live） |
| 4 `[static]` | 无 `GENERATION_MODEL_BINDING_INVALID`；`generation:list` 可用 | `grep -c` → 0；脚本回读 run 终态 | 一致（run 以 `failed` 收尾，作观察项，不影响判据文字） |
| 5 `[live]` | 三项＋`tasklist | grep -c electron`；两次 PID | 三项齐，`tasklist` → 0（`grep -c` 无命中自身返回 1，属正常） | 一致 |
| 6 `[static]` | R4：`544dcbd5..分支` 两段输出空、无 `A` 行 | `--numstat`／`--name-status` 均空 | 一致（分支零提交） |

## 3. 需要别人处理的点（不下判词）

1. **派验单未入库**：工作区 `f282eb0c…`（30 行 / 4,500B），HEAD 仍是旧版 `a362c793…`。入库归主身；入库后以提交面 sha 为判词分母，工作区版内容与此相同。
2. **developer 报的派验单 `ad98470d…` / 33 行在盘上不存在**（实测 30 行 / 4,500B / `f282eb0c…`），请 developer 重取后确认，避免判词分母再打架。
3. **卡面 sha 被当占位符**：盘上无 `{{`（`grep -c`=0），真值为 `2848337fc1092afb84ea6b9696be11b3edf50f95568741353f03588fc3819b15`；群里看到的 `2848337fc1092afb84ea6b9696be11b3edf50f95568741353f03588fc3819b15` 形态是传输层打码，不是文件内容。

## 4. 收口顺序建议

QA 按 `f282eb0c…` 开判 → 判词落 `.batch/night/reports/s3-d16-qa-firstcheck.md` → 主身入库（含派验单与判词）报 sha → 负责人出 D10 派验单（逐张、24h 内）。
