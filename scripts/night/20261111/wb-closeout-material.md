# 收尾线 · 11-11 夜班遗留卡处置材料（只出材料与判读）

你是**豆包**。工作区：`C:\develop\workspace\AI-writer\wt-1`。
**动手前先回一行「已确认红线 1-4」。**

## 红线（先回再动手）

1. **只读 + 只写一份新建报告**：零产品码改动、零测试断言改动、零文档改动（尤其**不改任何状态行**）。
2. **不跑** dev / browser / 任何单测 / 全量测试 / 构建 / 脚本体检。
3. **禁一切 git 写**；**禁 `done`**；禁自证文件；禁在报告里写「裁定 / 通过 / 驳回」这类下结论的字样。
4. **只出材料与判读**：所有条目只给「建议动作 / 依据 / 是否需 Lead 点头」，**不做任何处置决定**，也不执行 tag 之外的看板动作。
5. **不要读 `develop\` 下任何文件** —— 跨目录读会触发沙箱提权确认框。本任务书已把全部所需材料抄在下方「背景材料」段，够用。
   **唯一允许的外部只读**是你自己工作区内的
   `C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\44f5be66-3cff-4f66-bc10-06d51ee89bcc.md` 的 §3（约 `:55-101`，11 项待裁清单）。
6. 看板 CLI 用这个绝对路径**执行**（只用于交回时 `tag`，不用于读文件）：
   `node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
7. 遇确认框 / 提权弹窗 / 读不到文件 ⇒ **BLOCKED 立即停**，不停等、不猜。

## 认领本卡（先做，不用 `next`）

本卡 ID：`4993ba9c-4537-4137-bf6e-a9a20a061640`。先执行：

```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs claim 4993ba9c-4537-4137-bf6e-a9a20a061640 --agent doubao
```

**不要用 `next`**（看板上别无 `external|todo` 卡，但 `next` 会带租约语义，本卡按 ID 认领即可）。

## 交付物

只写一份报告：`C:\develop\workspace\AI-writer\wt-1\.dsh-task-board\reports\4993ba9c-4537-4137-bf6e-a9a20a061640.md`（新建，不 append）。
四段：**结论 / 采集方式与原始输出 / 三张表 / 未做项与不确定**；「改动清单」写「无」。
末行 `## [T1] DONE` 或 `## [T1] BLOCKED <原因>`。

---

## 背景材料（已抄全，勿外查）

### A. 夜班结算口径（2026-11-11 digest 原文）

卡面 40 张：**26 done / 14 未结算**；done 里 3 张实质空手、1 张结论已被本轮实测推翻。
夜跑 04:18 停摆，S3–S6 未执行。`2 failed / 835 passed / 837` 实测坐实（失败恰为 B11 `RendererStartup.browser.tsx:138` 与 B16 `CodeMirrorEditor-generation.browser.tsx:281`）。

**§2.4 未做（14 张）**

| 卡 | 状态 | 未做原因 |
|---|---|---|
| WB-5 `b33ca4e0` | todo | 等 `M2/`，不存在 |
| WB-6 `2fff7426` | todo | 等 `M3/`，不存在 |
| WB-7 `016862ed` | todo | 等 S5 窗口 + 前三张交回 |
| RV `f9cb0320` | todo | 07:00 到点但无人起干净会话 |
| DG `db186e6c` | todo | 报告判 BLOCKED：`wt-1/.runtime/night11/manifest.json` 不存在 |
| WB-15 `07309f0d` / WB-16 `c1b9e689` / WB-17 `e55f68df` | todo | 04:0x 建卡后来不及释放 |
| WB-18 `5db9f31e` / WB-19 `2a034878` / WB-20 `ff1da4c0` | todo | 同上 |
| WB-21 `e7de142f` | todo | 从未认领，交付物缺失 |
| WB-22 `0e442deb` | todo | 同上 |
| DB-5 `105067bc` | todo | 报告已交但未结算（见 §2.2） |

**§2.2 相关**：DB-5 `105067bc` 报告已写（15279 B，判 DONE），但**卡从未打 `review` / `release`** ⇒ 结算缺口。
WB-3 `b20c9393` 看板 done，报告判 BLOCKED（D17 前提已失效，2026-11-05 已结项）；WB-4 `926a5b30` 看板 done，报告判 BLOCKED（`M1/` 缺产物）；WB-10 `3830d5fa` 看板 done，**方案 A 实测无效**（带/不带改动同为 `1 failed | 6 passed`），该行改动已回退。

**§5 第 5 项（13 张未结算卡怎么处置）**
> 建议：WB-5/6/7 + RV + DG 移到下一班（前提是 Lead 实机先做）；WB-15..WB-22 按 §7「08:10 未认领 ⇒ 移 backlog」处理，不 `done`。

**§5 第 7 项（DB-8 的 11 项待裁）**
> DB-8 的 11 项待裁（D17 台账改字、DB-3 的 A/C、WB-2 的 A/B/C、WB-1 测试入口是否越界、`generation-controller.test.ts` 既有红等）仍全部有效，见 `wt-1/.dsh-task-board/reports/44f5be66-….md` §3。

**§6 未验证事项（别当已验）**
> - `scripts/check-ledger-snapshot.mjs` 一次都没跑过，首次运行结果未知。
> - `M1-M2-runbook.md` 的三处未核仍在：本机无 `sqlite3` CLI、造慢吐三法未测、按钮名「查看当前输出」源码未找到。
> - 所有「实机」结论为 0 —— D9 阶段 1 仍是单测级，B16 走哪条文案分支仍未知。
> - DB-2 判 B16 为「测试写法问题」纯属代码推断，未跑 browser。
> - DB-3 的「超时→续写」只证了批次路径，续写链路本夜无人读。

**§4 已坐实的两条口径**
> 1. 「43/43 全绿」在 `pnpm test`（Electron 运行时）下真实成立；DB-8 §4 第 10 条说的「裸 node 因 ABI 145 vs 127 恒红」是入口选错。
> 2. `2 failed / 835 / 837` 实测成立，与期望逐字吻合。

**§8 相关（作者 19:1x 已定）**
> 第 4 条「WB-3 / D17 是否撤卡」作者已裁「撤」；第 6 条 DB-1 语义已定（失败只废当前章、取消整批作废、覆盖 ≠ 完成）。

### B. 8 张陈旧 `external|todo` 卡（Lead 已摘掉 `external`，本卡只做核对）

| 短 ID | 任务书 | 卡面身份 / 工作区 | 交回 `--agent` |
|---|---|---|---|
| `07309f0d` | WB-15 runbook 静态核 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `c1b9e689` | WB-16 D9 阶段 2 接线静态 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `e55f68df` | WB-17 改动清点 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `5db9f31e` | WB-18 测试入口复核 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `2a034878` | WB-19 闸门一致性 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `ff1da4c0` | WB-20 WebDAV catch 分诊 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `e7de142f` | WB-21 夜班索引 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |
| `0e442deb` | WB-22 设计稿状态交叉核对 | 你是 WorkBuddy / `wt-2` | `workbuddy:worker` |

依赖现状（Lead 已实查）：`wt-2\.batch\night\M1-M2-runbook.md` 及其 §B.5、以及 `wt-2\.batch\night\` 整个目录已被 19:2x `git clean -fd` 删除；WB-15 任务书 `:15/:18`、WB-21 `:26` 等仍指向这些路径。
看板 `next` 只认 `todo` + `external`（`select.mjs`），故这 8 张原会抢跑；Lead 已逐张 `tag --remove external`，复核 `external-todo=0`。

### C. DB-8 §3 的 11 项（允许你打开原报告 §3 复核细节）

1. D17 台账 `:114` 是否改字（建议②加括注）
2. DB-3 超时那一刻 A / C 二选一（建议 A）
3. **WB-2 的 A / B / C 三方案（B11 修法，建议 A）—— 本轮已被实测否定：方案 A（`await act(async () => {})`）带/不带改动同为 `1 failed | 6 passed`，须剔除**
4. **WB-3 是否撤销（建议①撤销本卡）—— 作者 19:1x 已裁「撤」，须剔除**
5. WB-1 的 `pnpm test <单文件>` 是否算越界（建议①认可）
6. `generation-controller.test.ts` 既有红 `PORTABLE_SCHEMA_UNSUPPORTED` 另开卡还是记台账（建议①另开卡）
7. D9 台账 `:132`「没有调用点」是否订正（建议①订正）
8. 台账 D9 词「待裁定」与缺陷稿「🟡」不同向、是否加括注（建议①加）
9. 台账 `:132` 末句「现行续写模式只抛弃超时那一章」是否订正（建议①另开只读卡读续写链路）
10. DB-1 的 3 点 follow-up 何时做（建议①里的最小两条）
11. WB-9 手册三处未核是否要在作者实机前补（建议①作者实机前自选客户端）

---

## 任务：只交三张表（不做处置）

**表 A · 逐卡处置建议**
覆盖 §2.4 的 14 张未做卡 + §5 第 5 项提到的 13 张未结算卡（去重后逐卡一行）。
列：`卡短 ID | 当前状态 | 建议动作 | 依据（上面材料的段名/行） | 是否需 Lead 点头`。
建议动作只能从「移下一班 / 移 backlog / 先补实机产物 / 补结算动作 / 撤销 / 另开卡」里选，不得写结论式判词。

**表 B · DB-8 11 项过滤后清单**
从第 3、4 项已被后续事实吸收的 11 项里**剔除这两项**，余 9 项逐项一行：
`项号 | 一句话议题 | 状态标签（只用两个固定标签：`仍待裁` / `已被后续裁定吸收`） | 依据 | 建议下一步`。
这两个标签是 Lead 给定的固定词，不是你在下结论；两档之外不要另造标签。

**表 C · 8 张旧卡核对表**
列：`短 ID | 任务书文件名 | 依赖路径是否已删 | 身份与 --agent 是否与本工作区错配 | 建议（移 backlog，不 done） | 依据`。
逐卡 8 行，不得合并。

## 未做项与不确定
凡你没打开、没核到、或材料里没给的，一律写「未核 + 缺什么」，**禁止推测**。特别注明：本卡未做任何处置、未改任何状态行、未跑任何命令（除交回用的 `tag`）。

## 交回

```
node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs tag 4993ba9c-4537-4137-bf6e-a9a20a061640 --add review --remove external --release --agent doubao
```

除上面的 `claim` 与这条 `tag` 外，不做任何看板写；**不要 `done`、不要 `move`、不要改别的卡**。
