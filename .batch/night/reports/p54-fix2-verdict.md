# P54-fix2 终审单

执行方：AI writer总负责人（终审）
model=DeepSeek-V4.1 | 倍率=1.00x | provider=自有(官方)
裁定时刻：2026-11-15 16:14（本地）
判据范围：`40f34b5..f41b031`（插件仓 `C:\develop\workspace\dsh-handoff-relay`，分支 master）

## 一、结论

**PASS。** 允许作为 P54 From/To 身份头系列的收口补丁留在 master，并计入台账。

## 二、事实与依据

| 项 | 值 | 来源 |
|---|---|---|
| 提交 | `f41b0312d89a50493943706b488b8773aaaa0eec`（15:09:17，`fix: label relay From by watch directory and log identity conflicts`） | `git log -1`（终审方 16:09 实测） |
| 范围 | `40f34b5..f41b031`，3 文件：`README.md 34/3`、`index.js 95/17`、`index.test.mjs 195/0` | `git diff --numstat` |
| porcelain | 0 行；`--cached` 空 | 终审方 16:09 实测 |
| 单测 | `node index.test.mjs` → 174/174 PASS（基线 166，纯增 195/0） | QA 首验 v2 |
| 反证 | C9 两条真红：A 去 fromRole 优先级 → 173/174 FAIL T1；B 冲突取目录值 → 173/174 FAIL T3 | QA 首验 v2 |
| 首验单 | `.batch\night\reports\p54-fix2-qa-firstcheck.v2.md` 4,551B / `1692D22B…` | QA 16:05 |
| 未推送 | origin/master 仍 `fdf7b17` | 终审方实测；推不推等主人一句话 |

## 三、两条偏差的裁定（QA 提，我判）

- **D1 报告字节不符（判：派卡方错，非执行方问题）**
  盘面实测：`reports\p54-fix2-report.md` = **12,742B / `58534E48dee1f67fc9a174d7d4c24ab3`**。
  我在派验单与卡面里写的 11,312B / `BC734AB36E836A5774DD91E2A438D87D` 是错的（那是我抄写时的旧值），
  QA 报的 12,742B / `58534E48…` 与盘面一致。**结论：QA 复读正确，我方口径错误，登记一笔流程瑕疵，不改执行方产物。**
- **D2 报告写于提交前（判：须另存 v2）**
  该报告自述「无提交」，与 15:09:17 已提交 `f41b031` 的事实不符。按流转件版本纪律，
  执行方须**另存** `reports\p54-fix2-report.v2.md`（补提交 SHA、porcelain 空、测试数），原文件保留不动。
  该 v2 不阻塞本终审结论（提交与单测由 QA 与终审方各自实测过），但**进入发布前检查表**。

## 四、遗留与后继

1. ~~D-TO8~~ 已单列：`To:` 前 8 位恒为字面量 `session-`（`index.js:1290` `String(resolved.id).slice(0,8)`，id 形如 `session-8ea61110-…`）。
   真机实证 3 处（seq 7/22/30）＋线上 `relay.log` 同症状。**另开 fix3 卡**，不在本卡名下。
2. `To:` 标题段为空（两次实证，含 `to=session-|大肥鱼|主身`）——与 D-TO8 同属 To 行构造，合并进 fix3 一并修。
3. 重启重扫 replay（5–6 条）不属本卡，另轮开卡。
4. 未推送：`f41b031` 是否 push 等主人点头；`exp/resource-ledger` 是否推 origin 同等待。
5. 真机验侧记：developer 副本实例未设 `DSH_PROFILE_DIR`，主 profile `relay.log` 新增 4 行、`delivered\aacf6baf5ecd\` 收 4 个探针件（已清理，日志为追加式未篡改）。记违约一笔，已由大肥鱼入账；`aacf6baf5ecd` 是否被 watch 绑定的取证由 developer 回。

## 五、时间账

投出 14:19 → 提交 15:09:17 → 首验 16:05 → 终审 16:14。整单约 1h55m，其中卡壳主要在「真机验与 fix2 并行共享主仓」。

<!-- DONE -->
