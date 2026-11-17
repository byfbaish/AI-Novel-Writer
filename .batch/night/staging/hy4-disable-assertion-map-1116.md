# Hy4 禁用卡 · 断言改前/改后对照（交 QA）

- 执行方：developer · AI writer项目组
- 提交：`545988b2`（父 `e3dafb51`，分支 `exp/resource-ledger`，3 files / +64 −40）
- 测试：`node ./node_modules/vitest/vitest.mjs run scripts/workbuddy/__tests__/model-policy.test.mjs scripts/workbuddy/__tests__/attach.test.mjs` → **90 passed / 90**（model-policy 25、attach 65）
- 文件：`scripts/workbuddy/__tests__/model-policy.test.mjs`

## 一、8 处断言改前 → 改后

| # | 位置（describe / it） | 改前断言 | 改后断言 |
|---|---|---|---|
| 1 | 促销期 ·「促销期内白天也免费」 | `isHy4FreeAt` 11-07 10:00 / 11-09 10:15 / 11-08 15:00 / 11-15 23:59 均 `true` | 四个时点均 `false`（标题改「禁用后促销期内也一律不出 Hy4（白天/凌晨都不免）」） |
| 2 | 促销期 ·「pickModel 直接给 Hy4，且不触发高峰拦截」 | `pickModel(11-07 10:00)` → `{ok:true, model:MODEL_HY4, window:'hy4-promo-all-day'}`；`pickModel(11-09 10:15)` → `{ok:true, model:MODEL_HY4}` | `pickModel(11-09 10:15)` 与 `11-09 15:40` → `{ok:false, blocked:true}`（高峰照常拦）；`11-07 10:00` 与 `11-09 12:30` → `{ok:true, model:MODEL_DEEPSEEK_FLASH, window:'deepseek-off-peak'}` |
| 3 | 促销期 ·「reason 里写明额度上限与兜底模型」 | `picked.reason` 含 `额度上限`、`MODEL_DEEPSEEK_FLASH`、`HY4_PROMO_ALL_DAY_UNTIL` | 改为「任何返回路径都不给 Hy4」：遍历 11-07 10:00 / 11-15 23:59 / 11-16 23:30，`picked.model !== MODEL_HY4`，`ok` 时必为 `MODEL_DEEPSEEK_FLASH`；另断言 `HY4_PROMO_ALL_DAY_UNTIL === '2026-11-15'`（恢复开关后旧规则仍在） |
| 4 | 夜间窗 ·「23:00 起免费，跨午夜到 07:59」 | 11-16 23:00 / 11-17 00:30 / 11-17 07:59 均 `true` | 三点均 `false`；标题改「禁用后 23:00–07:59 也不再免费」 |
| 5 | 夜间窗 ·「促销结束后 pickModel 回到 hy4-free-night」 | `{ok:true, model:MODEL_HY4, window:'hy4-free-night'}` | `{ok:true, model:MODEL_DEEPSEEK_FLASH, window:'deepseek-off-peak'}`（标题改「禁用后夜间 23:30 落到 DeepSeek-V4.1-Flash」） |
| 6 | 高峰横幅 ·「末尾固定 PEAK_HOURS，给两条可粘贴重跑命令」 | `banner` 含 `--model MODEL_DEEPSEEK_FLASH` **且含** `--model MODEL_HY4` | 仍断言含 `--model MODEL_DEEPSEEK_FLASH`、含 `审查 D18`、含 `12:00`、末行 `PEAK_HOURS`；改为 `expect(banner).not.toContain(MODEL_HY4)`，标题去掉「两条」 |
| 7 | 白名单 · rejectUnknownModel | `ALLOWED_MODELS` `toEqual([MODEL_HY4, MODEL_DEEPSEEK_FLASH])`；`rejectUnknownModel(MODEL_HY4)` 为 `null` | `toEqual([MODEL_DEEPSEEK_FLASH])`；`rejectUnknownModel(MODEL_HY4)).toContain('不在白名单')` |
| 8 | `describeModelPolicy` 促销期摘要 | `line` 含 `MODEL_HY4` 且含 `全天` | `line` **不含** `MODEL_HY4`、含 `MODEL_DEEPSEEK_FLASH`；标题改「禁用后促销期内给出 DeepSeek 摘要，不再出 Hy4」 |

## 二、新增断言（未删任何覆盖）

- 新 describe「Hy4 全局禁用开关」→ `expect(HY4_DISABLED).toBe(true)`，把「用户 11-16 拍板」钉进测试。
- 促销期判断「含末日」四条保持原样未动（`isHy4PromoAllDay` 语义不变）。
- 22:59 / 08:00 两条边界保持原样未动。

## 三、grep 辅证

```
git grep -n Hy4 -- 'scripts/workbuddy/*.mjs' ':!scripts/workbuddy/__tests__'
```

命中只落在三类：`model-policy.mjs` 的 `HY4_DISABLED` 开关与注释、`MODEL_HY4` 定义、`attach.mjs:314/513` 两处注释（选择器名与徽标剥离说明）。无派活通路引用。

## 四、回滚

`scripts/workbuddy/model-policy.mjs:24` 的 `export const HY4_DISABLED = true` 改 `false`，即整条老逻辑（促销期 + 夜间窗）回归；横幅与 help 共 6 行如需一并回归用 `git revert 545988b2`。
