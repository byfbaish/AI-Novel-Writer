执行方：QA
model=未取到（本会话不暴露 model 标识，不编） | 倍率=— | provider=—
判词：PASS（1 项需追认、1 项流程备注，均不阻断）

# Hy4 禁用卡 · 首次验收（QA）

- 受判提交：`545988b2`（父 `e3dafb51`，3 files / +64 −40）
- 仓库：`C:\develop\workspace\AI-writer\develop`，HEAD = `545988b2`，分支 `exp/resource-ledger`
- 取证时间：2026-11-16 06:2x CST

## 1 提交面

| 检查 | 结果 |
|---|---|
| `git show --stat 545988b2` | 3 文件 / +64 −40，父 `e3dafb51` ✔ 与交件口径一致 |
| 工作区 vs 提交树 `git diff --stat 545988b2 -- scripts/workbuddy/` | 空文件输出（0 差异），实跑即提交树内容 ✔ |
| 未跟踪文件 | 只有 `docs/agents/bot-session-identity.md`（另线产物，与本卡无关） |

## 2 实跑（静默判定，卡面判据①）

```
node -e "import('./scripts/workbuddy/model-policy.mjs')…pickModel()×2"
{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak","reason":"非高峰时段…0.11x 且 5 折"}
{"ok":true,"model":"DeepSeek-V4.1-Flash","window":"deepseek-off-peak","reason":"非高峰时段…0.11x 且 5 折"}
rejectUnknownModel('Hy4') → 模型「Hy4」不在白名单（只允许 DeepSeek-V4.1-Flash）
ALLOWED_MODELS → ["DeepSeek-V4.1-Flash"]
```
两次一致出 V4.1，无 Hy4 ✔

## 3 测试（卡面判据②：90/90 且无 skip）

```
node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/model-policy.test.mjs scripts/workbuddy/__tests__/attach.test.mjs
✓ model-policy.test.mjs (25 tests)
✓ attach.test.mjs (65 tests)
Test Files 2 passed (2) · Tests 90 passed (90) · Duration 334ms
```
- 无 skip/only/todo：两份测试扫 `.skip(|.only(|.todo(|.fails(` = none ✔
- 覆盖未缩水：`it(` 24→25（+1 新增 HY4_DISABLED 断言），`expect(` 54→56 ✔
- 断言为改写非删除：8 处对照（`hy4-disable-assertion-map-1116.md` §一）逐条与 diff 核对一致 ✔

## 4 grep 辅证（卡面判据③）

`git grep -n Hy4 545988b2 -- 'scripts/workbuddy/*.mjs' ':!scripts/workbuddy/__tests__'`
命中仅三类：`model-policy.mjs` 的 `HY4_DISABLED` 开关与历史注释、`MODEL_HY4` 定义（29 行）、`attach.mjs:314/513` 两处注释。**无派活通路引用** ✔
另按调用路径核了全仓调用点，只有 `workbuddy-attach.mjs:54/122/164/571`（`pickModel()`、`ALLOWED_MODELS[0]`、`rejected` 提示），均被 attach.test 65 条覆盖 ✔

## 5 开关与回滚

- `model-policy.mjs:24` `export const HY4_DISABLED = true` 是唯一开关；`isHy4FreeAt` 首行、`pickModel` 两处分支均加了门 ✔
- 回滚路径可用：改这一行为 `false` 即回归促销/夜间旧逻辑；整提交回滚 `git revert 545988b2` ✔

## 6 需追认 / 备注（不影响 PASS）

1. **需追认（超卡面文件）**：本提交动了 `scripts/workbuddy/workbuddy-attach.mjs` 6 行，全是 `usage()` help 文案（去掉「只允许 Hy4 / DeepSeek-V4.1-Flash」与 23:00–08:00 用 Hy4 那两行），无任何逻辑改动，且交件 §四 已写明。建议负责人追认为「行为改了必须同步 help」的必要附带，不要求重开提交。
2. **流程备注（非本卡判据）**：提交落在 `exp/resource-ledger`，`git merge-base --is-ancestor 545988b2 master` 为假——基础提交 `e3dafb51` 也不在 `master` 上。卡面未指分支，developer 报「随现检出、未切分支」，我采信；推送/合并对象由负责人定，不作为判 FAIL 依据。

## 7 结论

PASS。8 处断言改写覆盖不减、90/90 实测通过、两次实跑均出 DeepSeek-V4.1-Flash、grep 无派活通路；help 文案 6 行请负责人追认一句即可。
