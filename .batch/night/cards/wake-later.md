# 卡：定时唤醒旁路（wake-later）

## 背景（已由 developer 取证，勿重复调研）

- `dsh-schedule` 发消息用 `{kind:"plugin",plugin:"schedule"}`，v4 会话拒绝 ⇒ 一触发就把接收方会话弄崩，已全场停用。
- 修共享包（`~\.dsh\profiles\node_modules\@deepseek-ai\dsh-schedule\lib\index.js:830-833`）会被 DSH 升级覆盖，且写死会反向坏掉 v3 会话。
- 已有可靠投递通道：`dsh-handoff-relay`（本机 7 条 watch 在生产跑，21:25 真机单探针 PASS，`source` 为 v4 合法的 `plugin:dsh-handoff-relay`，投递后把源文件移入 `delivered/`）。

## 目标

不改任何第三方包，用一个本机脚本 + Windows 计划任务做「到点往 watch 目录投一个文件」，由 relay 负责通知。**只做定时器，不做消息路由。**

## 交付

新建 `scripts/dsh/wake-later.ps1`，参数：

- `-At` 必填，`yyyy-MM-dd HH:mm` 本地时间，必须晚于当前时间，否则报错退出 2
- `-Dir` 必填，已存在的目录绝对路径（不做默认值，避免误投）
- `-Text` 必填，一行通知文本
- `-Name` 可选，任务名，默认 `dsh-wake-<yyyyMMdd-HHmm>-<4 位随机>`
- `-List` 列出本脚本创建的任务（按 `dsh-wake-*` 前缀过滤）
- `-Remove <Name>` 删除该任务
- `-DryRun` 不建任务，立刻把文件写进 `-Dir`（便于验收和排查）

行为要求：

1. 建一次性任务用 `Register-ScheduledTask`（命令行 `schtasks` 不支持 WakeToRun）。设置项必须同时带上，缺一条到点都不会触发**且不会报错**：
   - `New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable`
   - `New-ScheduledTaskPrincipal -UserId <当前用户> -LogonType S4U -RunLevel Highest`（即「不管用户是否登录都运行」+ 最高权限）
   - 触发器 `New-ScheduledTaskTrigger -Once -At <时间>`
   - 注册前检查系统电源「允许使用唤醒定时器」是否开启（`powercfg /query` 读 `SUB_SLEEP` 相关项）；未开启就打印提示并继续，不静默
   - 任务建好后 `Start-ScheduledTask` 不需要；跑完要自删（action 末尾调用 `-Remove` 自己，或设 `-DeleteExpiredTaskAfter`）
2. 到点动作：由任务调用脚本自身 `-Fire -Dir <dir> -Text <text> -File <name>`，把 `<name>.md` 写进目录，内容首行 `Text`，第二行空行，第三行 `<!-- DONE -->`。文件已存在则改名加 `-2`，不覆盖。
   - **能力边界**：`-WakeToRun` 只覆盖睡眠/休眠；机器彻底关机不会自己醒来。若到点时是关机状态，靠 `-StartWhenAvailable` 在下次开机后补跑一次（可能延迟，这是预期行为）。
3. 任何失败都 `Write-Error` + `exit 1`，不许静默吞掉；任务创建失败时把 `schtasks`/`Register-ScheduledTask` 的原始错误打出来。
   - **权限闸（先做，别整趟白跑）**：`Register-ScheduledTask` + `-LogonType S4U` + `-RunLevel Highest` 注册到根任务目录需要管理员权限，普通权限会直接 `Access is denied`。第一步先跑 `whoami /groups` 判断是否具备管理员权限；不具备就**不硬试、不自行降级**，直接按卡面回传「权限不足」并附原始报错，由负责人决定换 `-LogonType Interactive`（免管理员，只在用户登录时生效）还是提权。
4. 不写日志文件，不联网，不引用其它项目文件。

## 判定线（QA 首验按此判）

1. `-DryRun` 在临时目录生成 1 个 `.md`，含给定 `Text` 与 `<!-- DONE -->`。
2. 真建一个 2 分钟后的任务：`-List` 能看到；到点后目录里出现同名文件，任务随后自动消失；全程不需要重启宿主。**验收不含重启**。
   - 睡眠唤醒这一条单独验：如主人当时在场且允许，可让他把机器短时睡眠再验「到点能醒并落文件」；不允许就只记录「未验」，判据不因此变红，但报告里必须写明「睡眠唤醒未验」。
3. 传过去的 `-At` 早于现在 ⇒ 退出码 2 且不建任务。
4. `-Remove` 后 `-List` 里消失。
5. 该脚本不修改 `cordis.patch.yml`、不改 relay 仓库、不 push。

## 边界

- 只改/新建 `scripts/dsh/wake-later.ps1` 与自己的报告；`git add` 点名该文件，禁用 `-A`。
- 不许重启 DSH、不许往生产 watch 目录丢测试文件（测 `-DryRun` 用临时目录，测真任务也指向临时目录）。
- 报告写到 `.batch/night/reports/wake-later.md`，末行 `<!-- DONE -->`。
- 估时：40 分钟（含一次真机 2 分钟延迟验证）。
