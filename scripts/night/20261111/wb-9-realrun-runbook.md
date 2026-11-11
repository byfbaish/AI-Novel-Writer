# 夜跑 11-11 · WB-9 实机执行手册 M1/M2（供作者明日自己跑）

## 身份与落点
- 你是 **WorkBuddy**，工作目录 `C:\develop\workspace\AI-writer\wt-2`（分支 agent/wt-2）。
- 卡 ID：`cf8d1c75-ff01-4ce4-837f-3ce95378008c`（先 `claim` 再开工，做完 `tag` 交 review）。
- 看板 CLI（绝对路径）：`node C:\develop\workspace\AI-writer\develop\scripts\task-board\dsh-task-board.mjs`
- 产物（唯一交付，**一份文档**）：`C:\develop\workspace\AI-writer\wt-2\.batch\night\M1-M2-runbook.md`

## 红线（先回一行「已确认红线 1-4」，再开工）
1. 只准单测入口 `pnpm test <单个测试文件>`；**禁** `pnpm test` 全量 / `test:browser` / `test:node` / `pnpm dev` / 打包。
2. 禁一切 git 写操作（add / commit / reset / checkout / stash / push / merge）。
3. 只写上面那一个文件；不改任何代码、不改任何既有报告。
4. 禁 `done`；禁自建自证文件。

## 背景（为什么要这份手册）
本夜 WB-4（D9 慢吐判读）与 WB-5（B16 文案判读）都因**实机产物不存在**判了 BLOCKED，按作者口径「实机留明日由作者自己分配」。所以本卡**不跑实机**，只把「怎么跑」写成**别人照着做就能产出标准产物**的手册。

作者明日会按手册跑，然后把产物目录交给判读卡。产物目录约定：
- `C:\develop\workspace\AI-writer\wt-2\.runtime\judge\M1\`（D9 慢吐）
- `C:\develop\workspace\AI-writer\wt-2\.runtime\judge\M2\`（B16 来源冲突文案）

## 任务：写 `M1-M2-runbook.md`，必须包含以下内容

### A. M1（D9 单次调用超时 / 慢吐）手册
1. **目标**：验证「单次模型调用 10 分钟上限」在真机上生效时，界面显示什么、DB 里落什么、批次终态是什么。
2. **前置**：主区 `develop` 当前 HEAD 与「需要起 dev 的端口」（项目已知 dev=5180、CDP 9222；worktree 槽位见 `docs/agents/worktree-parallel.md`）；备份 `recent-projects.json` 的步骤（副本项目打不开的坑：`project:open` 只认 `~/.ai-novel-writer-dev/generations/<id>/recent-projects.json` 登记过的路径）。
3. **怎么造慢吐**：给出 2–3 种可行做法（例如用本地 Ollama 小模型 + 长 prompt；或在模型网关侧限速；或把 timeout 临时调小——**这一条要标注「改常量需重启 dev、测完必须改回」**），并对每种写清「改哪里 / 怎么改回 / 风险」。
4. **操作步骤**：逐步写清点哪个按钮、进哪个页面、开几章、等多久；每步给「期望看到什么」。
5. **要采集的产物**（写进 `M1/`，文件名固定）：
   - `ui.txt`：界面实际显示文案（超时提示、批次状态、失败章节面板）
   - `screenshot-1.png` … `screenshot-N.png`：至少 3 张（触发时 / 超时提示出现时 / 批次终态）
   - `db.txt`：`generation_runs` 与 `generation_attempts` 相关行的原始导出（用项目自带的 DB 查询入口，写清命令）
   - `README.md`：环境（模型、timeout 值、章节范围、run id）+ 判定要点（这次到底超时没有、界面说了什么）
6. **判定要点表**：列出判读卡要回答的问题（是否触发、`GENERATION_CALL_TIMEOUT` 是否出现、终态是 failed 还是 cancelled、界面两档文案是否区分）。

### B. M2（B16 来源冲突文案）手册
1. **目标**：确认 `:281`/`:335`/`:336` 三处文案在真机上到底走哪条分支（CAS 分支 vs 拼接串），以及「查看当前输出」「复制」等按钮是否还在。
2. **怎么造来源冲突**：清空/重生成大纲或改上游章节，使正文稿的 source 过期；写清两种造法的步骤与判别信号。
3. **操作步骤** + 每步期望。
4. **产物**（`M2/`，文件名固定）：`ui.txt`（三处文案原文逐字）、`screenshot-*.png`、`readme.md`（走的哪个分支、依据哪一句文案）。
5. **判定要点表**：三条文案各自「真机上是否出现 / 出现时走哪条分支」。

### C. 通用部分
- **产物目录创建命令**（PowerShell，一次建好两个目录）。
- **每次实机前 checklist**：端口是否空闲、dev 是否起来、副本项目是否登记、DB 是否已备份。
- **失败与回退**：dev 起不来 / 副本打不开 / 弹确认框 / 端口占用，各写「停在哪、怎么回退、留什么证据」。
- **时间估计**：M1、M2 各需多少分钟。
- **明确写「本手册不替代判读」**：跑完只是产出材料，结论由判读卡给。

## 允许命令（白名单）
- `Get-Content` / `Select-String` / `Get-ChildItem` / `Test-Path`（只读）
- `git -C C:\develop\workspace\AI-writer\develop status --short`
- `git -C C:\develop\workspace\AI-writer\develop log --oneline -5`
- `node <看板 CLI> claim/tag`
- `New-Item -ItemType Directory`（仅允许建 `wt-2\.runtime\judge\M1`、`M2` 两个目录）

不许：起 dev、跑任何测试套件、改代码、改配置。

## 交付（报告四段，写在卡自己的报告文件里）
1. 结论：手册是否可直接执行（缺什么）；
2. 手册结构清单（A/B/C 各覆盖了哪几节）；
3. 手册全文落点路径；
4. 未做项（没验证的命令、没实跑的风险点）。

报告路径：`C:\develop\workspace\AI-writer\wt-2\.dsh-task-board\reports\cf8d1c75-ff01-4ce4-837f-3ce95378008c.md`
报告末行 `## [T1] DONE`。
交回：`node … tag cf8d1c75-ff01-4ce4-837f-3ce95378008c --add review --remove external --release --agent workbuddy:worker`
