# D-1 派卡前置核对单（d1-delivered-path）

出具：workbuddy联络人 · AI writer项目组 | 6acae4d3
时间：2026-11-16 15:3x CST（实测取数见各节命令原文）
依据件：卡面**投出版唯一＝**`.batch/night/cards/d1-delivered-path.v4.md`（13,854B｜`c24ecb09a17b3514c647157c7efce752`｜117 行；项目总负责人 15:40 定，18:00 只投这一份）；`d1-delivered-path.v3.md`（13,853B｜`f52a88f1df5ad938f78d9948dae3b3b1`｜117 行）标「留档·不采用」，字节不动。两版差 1 字节＝§8 的 From/To 段，本单核对的 §0/§5 内容逐字相同。

版本说明：v2 相对 v1（6,434B｜`f8c2a39d35200e03f2f027d7352953e7`｜111 行）只改两处——①「建议卡面加一句」已被否，据实改写；②「投出版唯一」按 15:40 定案钉 v4。核对数据与命令原文逐字未动。
派验单：`.batch/night/review-requests/d1-delivered-path.md`（6,063B｜`ad295951…`｜58 行）。

**一句话结论：① 三项按设计「未就绪」，不是卡壳、不构成阻塞，派卡可发；② 命令模板必须带 `--model DeepSeek-V4.1-Flash` 且先注册 `WORKBUDDY_ALLOWED_CWDS`，禁 `--force`；③ 信号回 AI-writer develop 的 `signals/workbuddy/`，正文三行、末行 `<!-- DONE -->`。**

---

## 一、工作树 / 分支 / 起点就绪核对（15:23–15:28 实测）

| 核对项 | 期望（卡面） | 实测 | 判读 |
|---|---|---|---|
| 工作目录 `C:\develop\workspace\dsh-handoff-relay-wt-d1` | 开工第一动作自建 | **不存在** | 预期，非阻塞 |
| 分支 `d1-delivered-path` | 不存在，由 `worktree add -b` 创建 | **不存在** | 预期，非阻塞 |
| 起点 `51a87c5` | 真身仓可解析 | `51a87c5417c61372210c14c1c362b8830e1621e7`（master HEAD 同值） | 就绪 |
| 真身仓可开工 | 干净、无需清理 | `porcelain` 空、`numstat` 空 | 就绪 |

命令原文（在 `C:\develop\workspace\dsh-handoff-relay` 执行）：

```
$ git rev-parse --abbrev-ref HEAD
master
$ git rev-parse HEAD
51a87c5417c61372210c14c1c362b8830e1621e7
$ git status --porcelain
[空]
$ git diff --numstat
[空]
$ git branch -a --list '*d1*'
[无输出]
$ git worktree list
C:/develop/workspace/dsh-handoff-relay  51a87c5 [master]
$ ls -d C:/develop/workspace/dsh-handoff-relay-wt-d1
ls: cannot access 'C:/develop/workspace/dsh-handoff-relay-wt-d1': No such file or directory   (exit 2)
```

独立复核：developer 15:2x 在同仓独立取数，结论一致（真身仓 `porcelain` 空、master＝`51a87c5`、wt-d1 与分支均不存在）。

**「wt-d1 不存在＝预期」这句不加进卡面（15:48 项目总负责人否掉）：** v4 字节锁定（13,854B｜`c24ecb09…`），而卡 §0 第 21–26 行已给 `worktree add -b d1-delivered-path … 51a87c5` 和开工四项校验，执行方照 §0 就能走；为一句提示开 v5 会让哈希变、QA 派验单仍引 v4，不值。**结论：本单只记事实，不改卡面字节；派卡时是否口头交代由派卡人决定。**
**派单方不得预先建树**：卡 §0 的 `worktree add` 是执行方第一动作；若预先建好，执行方照卡面再执行会撞「目标路径已存在」而停在原地。

---

## 二、派卡命令模板（须含 `--model DeepSeek-V4.1-Flash`，禁 Hy4）

执行位置：`C:\develop\workspace\AI-writer\develop`（`--file` 与脚本都相对这里）。

**前置一步（同一 shell 内生效，用完即失效）：**

```
set WORKBUDDY_ALLOWED_CWDS=C:\develop\workspace\dsh-handoff-relay-wt-d1
```

**派卡命令：**

```
node scripts/workbuddy/workbuddy-attach.mjs task --file .batch/night/cards/d1-delivered-path.v4.md --cwd C:\develop\workspace\dsh-handoff-relay-wt-d1 --model DeepSeek-V4.1-Flash --new --json
```

逐项理由（均取自现盘代码/脚本 usage）：

- `--cwd`：归属护栏默认只认 wt-2（`workbuddy-attach.mjs:841` 调 `checkPinnedCwd`，未注册目录 exit 1）；wt-d1 属另一仓，必须先注册白名单。
- `--model DeepSeek-V4.1-Flash`：`scripts/workbuddy/model-policy.mjs` 现 `HY4_DISABLED = true`，`ALLOWED_MODELS` 只剩这一个；显式指定视为人工授权，同时绕过高峰时段拦截，模型留痕最硬。
- `--new`：当前 WorkBuddy 窗口已有 p56 会话上下文，D-1 是另一张卡、另一仓，开新会话避免串味。
- `--json`：留机读回执；不写 `--no-wait`（默认同步等待，便于当场拿退出码）。
- **禁 `--force`**：它越过归属护栏，属排障手段；本单已用白名单正规放行，不需要也不允许。
- **禁重试**：失败一次即停，报负责人；退出码 0 完成／1 失败／2 未连接 NEED_HUMAN_DEBUG／4 超时／5 高峰期不派活。

时段：周一至周五 09:00–12:00、14:00–18:00 为 DeepSeek 高峰（原价），其余 5 折。18:00 起即出高峰窗（`DEEPSEEK_PEAK_RANGES` 是左闭右开 `{14,18}`），故按负责人原定 18:00 后发卡，成本窗与时段窗一致，不必靠 `--model` 硬绕。

**投后必核（两条，缺一即报）：** ① `status --json` 的 `chips.model` 回查须为 `DeepSeek-V4.1-Flash`，被切回 Hy4 立即报主人手动切回；② 退出码与回执一起留档。

---

## 三、信号文件路径与命名

**路径（必须用绝对路径，写回 AI-writer develop）：**

```
C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy\<文件名>
```

- 该目录已注册 watch：`cordis.patch.yml:303–306`，`dir = ...\develop\.batch\night\signals\workbuddy`、`targetSessionId = session-6acae4d3-34b1-4a4e-b955-9de8e28caaf0`（我的群分身）、`exact: true`、`done.text = <!-- DONE -->`。
- **不能写进 wt-d1**：工作树属 `dsh-handoff-relay` 仓，watch 只认 AI-writer develop 那一处；写到 worktree 里等于没投。

**命名：** `d1-delivered-path.signal`（沿用 p56 先例 `signals/workbuddy/p56.signal`＝「卡号.signal」；一条卡一次一个文件名）。
- 同路径同字节会被 dedupe 吞掉、改内容又等于新唤醒；**要更新就另起新文件名**（如 `d1-delivered-path.v2.signal`），不原地改。
- 派卡前先确认该名未存在（现 `signals/workbuddy/` 为空）。

**正文三行（卡 §5）：**

```
d1-delivered-path
.batch/night/staging/d1-delivered-path-report.md
<!-- DONE -->
```

末行 `<!-- DONE -->` 必须是最后字节：命中即投（reason=DONE）；不写则静默 5s 后投（reason=stable）。

**报告落点：** `.batch/night/staging/d1-delivered-path-report.md`（同样写回 develop 绝对路径）；头三行按模板 §5：`执行方：`／取数件三元组（`index.js` 74243B / `58025002…`）／`model= | 倍率= | provider=`；末行 `<!-- DONE -->`。

---

## 四、本单没做的事（边界声明）

- 未建工作树、未建分支、未投卡、未动任何卡面字节（只出单）。
- 未改 `model-policy.mjs`、未改 relay 配置（改配置归主人）。
- 未写台账：台账唯一写手是产品经理（协作规则 v1 §2），我只出证据单／核对单／信号。
- `chips.model` 回查在投出侧执行，本单只写「必核」不代核。
