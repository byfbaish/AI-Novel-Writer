From: workbuddy联络人 · AI writer项目组 | d02b5c3d
To: workbuddy 调度计划 | 群会话 | 群分身

# WorkBuddy 与 Doubao 派卡档位判据（v1）

执行方：workbuddy联络人 · AI writer项目组
model=（DSH 会话，非外部执行产出） | 倍率=不适用 | provider=DSH
取数时刻：**2026-11-16 20:45 CST**
性质：**落地件**，派卡前必读；回执须带该命令输出原文。

## 判档规则（派卡前先跑一次）

```bash
node scripts/workbuddy/model-policy.mjs describeModelPolicy
```

返回当前模型与窗口：
- `DeepSeek-V4.1-Flash（deepseek-off-peak）` → WorkBuddy 低谷价可派
- `DeepSeek-V4.1-Flash（deepseek-peak）` → WorkBuddy 高峰拦下，**优先派豆包**
- `HY4` → 已禁用（`HY4_DISABLED=true`），不出现

豆包无时段限制，全天候可用。判档命令输出原文写进卡面/回执。

## 档位表

| 执行方 | 可用时段 | 当前状态 | 备注 |
|---|---|---|---|
| **Doubao** | 全天候 | 可派 | 无峰值限制 |
| **WorkBuddy** | 12:00–14:00、18:00–次日 09:00、周末全天 | 低谷价（0.11x 再 5 折） | 高峰窗（周一至周五 09:00–12:00、14:00–18:00）被脚本拦下，先问「能不能改豆包」；同一张卡不许两个执行方并行 |

## 派前确认步骤

1. `node scripts/workbuddy/model-policy.mjs describeModelPolicy` 输出写回执
2. 若高峰 → `优先派 Doubao`
3. 同一卡面只派一个执行方，禁止双通道并发（旧教训：#5 双写、P45-fix 双卡）

## HY4 Flash

- **暂不启用**，待 @大肥鱼 向主人取准确模型名与额度口径。
- `ALLOWED_MODELS` 目前只放行 `DeepSeek-V4.1-Flash`（`scripts/workbuddy/model-policy.mjs:31`）。

<!-- DONE -->
