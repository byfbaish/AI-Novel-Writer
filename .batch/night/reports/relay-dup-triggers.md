# relay 重复触发记账

> 口径（负责人 11-14 08:17 定）：同一份信号文件被多次投递（stable / DONE 双触发等），只记账不动工；攒够三例由负责人决定是否开卡。
> 记账人：workbuddy联络人。只记录，不判定。
> 字段：时刻 / 文件名 / 字节 / 是否同源一份 / 观察到的投递次数 / 附注。

| # | 时刻 | 文件名 | 字节 | 同源一份 | 观察到的投递次数 | 附注 |
|---|---|---|---|---|---|---|
| 1 | 首投 08:13:19；重复推到 08:17 左右 | `p25-describe-probe.done` | 94 | 是 | 2 | 源目录已被清空；`delivered\83e63d6cfdfa\` 下仅存 **1 份**（94B / 08:13:19）。两次投递之间产物 `p25-describe-probe.md` 为 8,491B，MD5 `0DA7A79B5C08E237ADEBEB5726C63D7D` 前后一致，无新增内容。 |
| 2 | 首投 08:50:44；08:50:49 又收到一次进群通知 | `p28-probe-after-fix.done` | 319 | 是 | 2 | `delivered\83e63d6cfdfa\` 下仅 **1 份**（319B / 08:50:44），源目录已被清空。两次通知之间产物 `p28-probe-after-fix.md`（6798B / MD5 A1E9AF85…）未变。与第 1 例同为 `83e63d6cfdfa` 通道。 |
| 3 | 08:59:41 | `p30-dir-picker-feasibility.done` | 271 | 是 | 1（尚未观察到重复） | `delivered\83e63d6cfdfa\` 下 1 份，源目录已空。三次都走 `83e63d6cfdfa` 同一通道；本例先占位，若后续出现第二次通知再补。 |
| 4 | 09:48:01 首投；09:50:32 第二份（内容不同，不是重复） | `readme-050-draft.done` | 204 → 429 | 否（两份内容不同） | 2 份 | 首份 204B 只有 artifact/bytes/status；第二份 429B 补了 `assigned_by` / `criterion` / `class: B` / `status`，落在 `delivered\83e63d6cfdfa\` 但文件名相同故覆盖为 1 份。属「按新交付分类规则补写信号」，**不计重复**。 |

## 尚未确认是否算「重复」

- `plugin-settings.done`（678B / 23:27:39）与 `plugin-settings-form.done`（114B / 23:30:45）是**两份不同文件**，分别对应该报告的前段与追加段，不算重复投递。
- `p12-readme-040.done`（605B / 23:56:02）豆包联络人报过一次「stable 触发是同一份信号的第二次投递」——那是豆包那侧的 watch（`delivered` 目录不同），我这条线未直接观察到，未计入本表。

## 观察方法（便于后来复核）

```powershell
Get-ChildItem "C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\delivered" -Recurse -File |
  Group-Object Name | Where-Object Count -gt 1
```

同名多份 = 明确重复；**同名只有一份但群内收到两次通知** = 重复唤醒但未重复落盘，也要记一行。

## 变更记录

- 11-14 08:18 建立台账，补记第 1 例（`p25-describe-probe.done`）。此后同类重复逐条往下加行，不改历史行。
- 11-14 17:03 按 AI writer总负责人 裁定加「附注（2026-11-14 复核）」，**原记录（上表与「尚未确认」小节）一字未改**。

## 附注（2026-11-14 复核）

裁定人：AI writer总负责人。结论：**不开定性卡**，本条只进插件线 backlog，随插件复启时一并处理。以下三点是复核结论，与原记录并列保存，不改原行。

**一、三处盘面读数与台账的差异**（盘面为唯一事实）

| 位置 | 台账原记 | 盘面实测（`delivered\`） | 裁定 |
|---|---|---|---|
| 第 4 行 `readme-050-draft.done` | 首份 204B / 09:48:01 | 只剩 429B / 09:50:32（204B 那份被同名覆盖，已无存档） | 台账记错，非运行时问题 |
| 「尚未确认」`p12-readme-040.done` | 605B / 23:56:02 | 561B / 23:59:32 | 同上 |
| 「尚未确认」`p12-readme-040.done` 所在目录 | 记为豆包侧 watch | 落在 `delivered\dad6df13f302\`（`signals\doubao`） | 同上 |

成因（负责人）：信号一经投出会被秒移走，谁当时没在 `delivered` 里核，就会把源目录的旧值记进台账。

**二、`relay.log` 不记成功投递**

- `relay.log` 末行 `2026-11-14T08:39:08.631Z`（本地 16:39:08）；而 `p35 15:33:09`、`p36 15:54:29`、`p37 16:08:54`、`p38 16:39:08` 四份信号都确实落进 `delivered\`。
- 即：**文件到手、日志没记**。`relay.log` 只记「跳过 / rescan / 解析失败」这类分支，成功投递不一定写 INFO。
- 所以台账第 1–4 例在日志里查不到对应行，**不等于没投递**，也不构成用户可见故障；此点按「可观测性缺陷」进 backlog。

**三、去重确实在起作用**

`relay.log` 全文唯一一条带 `.done` 的 INFO 行就是去重跳过：

```
2026-11-14T08:39:08.631Z INFO [dsh-handoff-relay] 去重跳过 C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao p38-edit-stats-report.done 原因=重复(size,mtime 相同)
```

同段另有一行 `2026-11-14T08:39:08.624Z … 去重表无 …signals\doubao 记录，首次运行全部视为新`，说明该 watch 的去重表是本次才建立。
