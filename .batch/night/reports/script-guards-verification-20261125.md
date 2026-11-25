# 派单脚本三件改动 · 调用侧实跑取证（2026-11-25 20:51–20:52）

取证目的：AI writer 项目组群分身要求「model-policy.mjs / workbuddy-attach.mjs 必须有调用侧实跑样本才放行进库」。本文件给出全部命令与实际输出，不写推断。

## 0. 三件改动的归属

| 文件 | 改动 | mtime | 执行者 |
|---|---|---|---|
| `scripts/doubao/doubao.mjs` | `+82`：新增 `selectModel()` / `--model`，选不中或弹订阅页即抛错不发送 | 2026-11-25 20:24:04 | 主身私聊的后台任务会话 k_552984（主身认领） |
| `scripts/workbuddy/workbuddy-attach.mjs` | `+11/−4`：task 未点名模型即拒、`--force` 只放行显式点名（20:57 又删掉了当日新加的 `--allow-auto` 逃生口，见 §6） | 2026-11-25 20:57:1x | 同上 + 主身本人（删 `--allow-auto`） |
| `scripts/workbuddy/model-policy.mjs` | `+11`：`CROSS_SOURCE_MODELS` 名单 + `isPaidHy4()` 硬闸（收窄 `--force`） | 2026-11-25 20:49 | 主身本人（本轮回件前手改） |

## 1. `--force` + 名单内模型 → 放行（真实派单，非 dry-run）

```
node scripts/workbuddy/workbuddy-attach.mjs task --file .runtime/_probe-model-gate.md --model "GLM-5.3" --force --new
[ok] 模型 = GLM-5.3（已是目标值）
[ok] 落点已证实：会话 0ce73c01-9444-487d-8dbe-9ff401168660 @ C:/develop/workspace/AI-writer/wt-2
[..] 等待回复（超时 900s）
[ok] 完成，用时 16s；产物：.runtime/workbuddy/attach/20261125-205148-bd2e-只回一行-OK-不要读仓库-不要改文件-不要派活
--- reply ---
OK。
```

产物 `meta.json` 实测字段：`model=GLM-5.3`、`settled=True`、`elapsedSeconds=16`、`sessionId=0ce73c01-9444-487d-8dbe-9ff401168660`、`how=space-new-task`。
（GLM-5.3 不在 `ALLOWED_MODELS`，无 `--force` 进不去，故本笔即「名单内 + force 放行」路径。）

## 2. `--force` + 付费 Hy4 → 拒绝

```
node scripts/workbuddy/workbuddy-attach.mjs task --file .runtime/_probe-model-gate.md --model "Hy4" --force
[refuse] 「Hy4」(0.29x) 已全线禁用，--force 不放行；跨源评审请点名 GLM-5.3 / GLM 5.4 / Qwen 3.8 Flash / Qwen 4 Max / Kimi K3.1 Pro / Kimi K3
```

## 3. `--force` + 名单外模型 → 拒绝

```
node scripts/workbuddy/workbuddy-attach.mjs task --file .runtime/_probe-model-gate.md --model "GPT-5" --force
[refuse] --force 只对跨源评审名单内的模型生效：GLM-5.3 / GLM 5.4 / Qwen 3.8 Flash / Qwen 4 Max / Kimi K3.1 Pro / Kimi K3
「GPT-5」不在名单内，如确要新增请先改 model-policy.mjs 的 CROSS_SOURCE_MODELS
```

## 4. 未点名模型 → 拒绝

```
node scripts/workbuddy/workbuddy-attach.mjs task --file .runtime/_t.md
[refuse] 未指定模型：task 必须显式 --model，脚本不再按时段自动挑（可选：Hy4 flash / DeepSeek-V4.1-Flash，跨源还可点名 GLM-5.3 等，需同时加 --force）
```

## 5. 关于「workbuddy 零实跑样本」

分身查的是 `.batch/night` 下 md 里 `--force` / `--allow-auto` 的命中数（0）。WorkBuddy 派单的回执不落 md，落 `.runtime/workbuddy/attach/<runId>/meta.json`。改动后（mtime 20:29:41）的样本两笔：

- `20261125-202946-37e2-…/meta.json`：`model=GLM-5.3`、`settled=true`、`reply.md` 5,137 B，`snapshot-before=Hy4 flash` → `snapshot-final=GLM-5.3`
- `20261125-205148-bd2e-…/meta.json`：`model=GLM-5.3`、`settled=true`、`elapsedSeconds=16`（上表第 1 条）

故「零实跑样本」不成立；以后查样本请看 `.runtime/workbuddy/attach/*/meta.json` 的 `model` 字段。

## 6. 交付口径（2026-11-25 20:57）

**分两笔**（依项目总负责人复核：`workbuddy-attach.mjs:55/:58` 具名 import `model-policy.mjs` 的新导出 `CROSS_SOURCE_MODELS`/`isPaidHy4`，ESM 加载期解析，拆开任一件都会崩）：
- 笔 A：`scripts/doubao/doubao.mjs` 单笔。
- 笔 B：`scripts/workbuddy/model-policy.mjs` ＋ `scripts/workbuddy/workbuddy-attach.mjs` 同笔。

**「跑过的代码 ≠ 要提交的代码」这一口子已关**：20:51:48 起跑、20:52:04 落件那笔成功派单（§1），用的是 mtime 20:49:24/20:49:57 的两个脚本——即 20:49 收窄后的版本。此后到提交前，attach 只改了三行：删 `--allow-auto`（BOOLEAN_FLAGS、`args.allowAuto` 映射、`command === 'task' && !args.allowAuto` 的判据），全部在「未点名模型」分支上，不触碰 `--model` 主路径，故 §1 那笔仍是笔 B 主路径的实跑样本。

**`--allow-auto` 直接删掉，不保留**（主人 2026-11-25 明令：派活不得按价格自动挑便宜档；留一个逃生口等于给下次误用留门）。删后当前字节实测两条：

```
node scripts/workbuddy/workbuddy-attach.mjs task "探针"
[refuse] 未指定模型：task 必须显式 --model，脚本不再按时段自动挑（可选：Hy4 flash / DeepSeek-V4.1-Flash，跨源还可点名 GLM-5.3 等，需同时加 --force）
```
```
node scripts/workbuddy/workbuddy-attach.mjs task "探针" --allow-auto
[refuse] 未指定模型：…（同上；`--allow-auto` 已不在 BOOLEAN_FLAGS，不再被解析，行为 fail-closed）
```

`node --check scripts/workbuddy/workbuddy-attach.mjs` → 无输出，语法通过。
提交归主身，push 另等主人点头；现状见 `git status --porcelain -uall`。

## 7. 主人 20:59 追加口径 → 本节取代 §6 的「task 必点名」

主人原话：「如果还有其他外派活，依然按老规矩选择deepseek 4.1 flash」。据此把「未点名即拒」改成「未点名→固定默认 DeepSeek-V4.1-Flash」，仍不按时段/价格挑：

- 普通外派（`task` 未给 `--model`）：日志 `[default] 未点名模型 → DeepSeek-V4.1-Flash（主人 2026-11-25：普通外派按老规矩）`，然后按该模型派。
- 高峰仍拦：工作日 09:00–12:00 / 14:00–18:00 原价时段照旧 `PEAK_HOURS` 拦下（exit 5），不因多了默认值而放开。
- **跨源评审例外**：`task` 未点名且文案/派单件名命中 `EXT-REVIEW`、`跨源`/`非同源`/`跨家族`、或四家模型名（`CROSS_SOURCE_MODELS`）→ 直接拒，理由写进提示：未点名会落到同源 DeepSeek，等于白跑。
- `--allow-auto` 仍已删除（§6），不保留任何「按价格自动挑」的入口。

当前字节实测三条（不真派，死端口 9334 只验决策层）：

```
node scripts/workbuddy/workbuddy-attach.mjs task "探针：只回一行 OK" --port 9334 --no-wait
[default] 未点名模型 → DeepSeek-V4.1-Flash（主人 2026-11-25：普通外派按老规矩）
⚠  需要人工打开 Debug 模式（本会话拉不起来）  原因：CDP 端口 9334 未监听        # exit=2
```
```
node scripts/workbuddy/workbuddy-attach.mjs task "EXT-REVIEW 派单"
[refuse] 跨源评审必须显式 --model：未点名会落到默认的 DeepSeek-V4.1-Flash（与本组同源，等于白跑）   # exit=1
```
```
node --check scripts/workbuddy/workbuddy-attach.mjs   # SYNTAX_OK
```
