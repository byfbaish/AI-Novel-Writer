# 现有 7 条 watch 的绑定迁移（id → 标题优先）

> 出：大肥鱼（管家） 2026-11-15 · 面向 P22a 落地后的迁移动作
> 位置：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml` 的 `- id: dsh-handoff-relay` → `config.watches`
> 原则：**先取证、再改、改完立刻能回滚**；不猜任何一条的对应关系。

## 0. 前置

- P22a 已合入并通过 P1–P5。
- 备份：`Copy-Item cordis.patch.yml cordis.patch.yml.bak-migrate`（改之前做，别改完再备）。
- 回滚 = 把 `.bak-migrate` 复制回去 + 重启宿主。这一步在动手前先写进记录。

## 1. 取证：拿到「目录 → 会话」的权威对应

不要凭印象配对。宿主启动时 `relay.log` 会打一行（`index.js:1047` 附近）：

```
[INFO] 当前 live roots id（可填 targetSessionId）：["<id1>","<id2>",...]
```

同时用现成能力取 `id → title → cwd` 三元组（任选其一，都要留原文）：

- 直接读会话存储：`C:\Users\<用户名>\.dsh\profiles\desktop\` 下各 session 的元数据（含 `cwd`、标题）；
- 或起一次宿主，用 `targetTitle` 试探：把某条 watch 临时改成标题，看 `relay.log` 的 `加载解析 ... 命中` 行是否唯一。

产出：一张表，7 行，列 = `dir` / 现 `targetSessionId` / 该 id 的 `title` / 该 id 的 `cwd`。

## 2. 核对（最容易错的一步）

逐条问三个问题，答不上就不改那条：

1. 这个 `dir` 的文件是谁该收到？（按业务身份答，不按 id 答）
2. 该 `title` 是不是**唯一**的？同名会话存在 → 记下来，**这条不改**（P22a 已取消 `targetCwd`，同名一律告警不投，保留 id 兜底）。
3. 该 `cwd` 与 `dir` 是否同一项目？跨项目的会话收到文件通常就是配错了。

7 条里凡有一条答不上：**这条先不动**，保留 `targetSessionId` 旧形态（P22a 向后兼容），其余照改。

## 3. 改法

每条 watch 的目标形态（标题优先，id 留作兜底）：

```yaml
- dir: <绝对路径>
  targetTitle: '<会话显示名>'
  targetSessionId: <旧 id>      # 可留：标题解析不到时兜底；确认无误后可删
  exact: true                    # 界面写回一律 true
  done:
    text: '<!-- DONE -->'
```

> **注意**：`targetCwd` 已作废（P22a 取消，不改 schema）。同名多条不再按 cwd 兜底，直接告警不投。

改完检查三件事：`exact: true` 是否都写了；`done` 是否原样保留；缩进层级与原有条目一致（YAML 缩进错会让整条 watch 被跳过并 warn）。

## 4. 改后验证（逐条，不看整体「N/N 个 watch」）

1. 重启宿主，看 `relay.log` 每条 watch 的 `加载解析 ... 命中` 行：命中且唯一 = 通过；`0 条` = 标题写错（改标题或退回 id 形态）；`多条` = 同名无法区分，**不改这条**，告警不投并记待办（`targetCwd` 已作废）。
2. 投一个探针文件到某条 `dir`，确认落到 `delivered\<dirKey>\` 且日志只有 1 行 INFO。
3. **再重启一次**，重复第 2 步 —— 这一步才是「重启后自动重接」的真判据。
4. 7 条都过一遍（或至少过其中 3 条不同 cwd 的）。

## 5. 失败时怎么办

| 现象 | 处置 |
|---|---|
| `加载解析 ... 命中 0 条` | 标题拼错 / 会话被改名 → 改 `targetTitle` 或回退保留 id |
| `命中 N 条` | **不改**：同名无法区分，保留 id 形态并记一条待办（`targetCwd` 已作废，不做 cwd 兜底） |
| 整条被跳过 | 看 `跳过 <label>：…` 的 warn 原文（`:964`/`:968`/`:974`） |
| 投递不到但解析正常 | 查 `delivered\` 与 failed 登记，别先怀疑绑定 |

## 6. 记录

迁移结果写进 `.batch/night/reports/plugin-phase2-closeout.md` 的「迁移」一节：7 条逐条给 `dir` / 新 `targetTitle` / 是否保留 `targetSessionId` 兜底 / 验证是否通过。留原文，不留「已迁移」三个字。
