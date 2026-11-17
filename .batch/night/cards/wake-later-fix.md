# 卡：wake-later 收口（落点回 develop + 按新规格重验）

## 背景

上一轮交付漂了落点：脚本被写进了 `C:\develop\workspace\AI-writer\wt-1\scripts\dsh\wake-later.ps1`（16524B，21:40:02），而卡面与报告都写的是 `develop` 区。`develop\scripts\dsh\wake-later.ps1` 至今不存在。

新版规格（S4U + RunLevel Highest + 电源唤醒定时器检查 + 权限闸）**不要重做全量验证**：上一版的 DryRun / 真机 2 分钟 / 退出码 2 / `-Remove` 已验过的，直接引用上一版结论，只补新规格引入的项。

## 要做（按顺序，别扩展）

1. **搬到正确落点**：把 wt-1 那份脚本复制到 `C:\develop\workspace\AI-writer\develop\scripts\dsh\wake-later.ps1`；wt-1 那份**原样保留，不删不改**（不是你的仓库，别动）。
2. **权限闸先做**：跑 `whoami /groups` 判断是否具备管理员权限。不具备就**不硬试、不自行降级**，在报告里写「权限不足」+ 原始判断依据，其余按能力范围内的项做完即收口。
3. **补新规格**：`Register-ScheduledTask` 参数用 `New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable`、`New-ScheduledTaskPrincipal -UserId <当前用户> -LogonType S4U -RunLevel Highest`；注册前读 `powercfg` 检查「允许使用唤醒定时器」，未开启要打印提示、不静默。
4. **脚本注释写明能力边界**：`-WakeToRun` 只覆盖睡眠/休眠，彻底关机不会自己醒；关机期间错过靠 `-StartWhenAvailable` 开机补跑一次。
5. **报告改写**在 `.batch/night/reports/wake-later.md`（新起一节「第二轮收口」，上一版内容保留不要删），末行保留 `<!-- DONE -->`；另落 `.batch/night/signals/doubao/wake-later.done`，三行，每行写清：产物路径、脚本 SHA256、`<!-- DONE -->`。

## 判定线

1. `develop\scripts\dsh\wake-later.ps1` 存在，且 wt-1 那份未被删除或改动。
2. 权限结论有证据（`whoami /groups` 关键行原文），有权限就要真的注册成功一条任务再删掉；没有权限就写清未验原因。
3. 报告写明新规格四项（`-WakeToRun`/`-StartWhenAvailable`/`S4U`/`RunLevel Highest`）分别落在脚本哪一段，并给出证据。
4. 能力边界注释在脚本里能搜到。
5. 不重启 DSH、不碰 `cordis.patch.yml`、不改 relay 仓库、不 push、不往生产 watch 目录丢测试文件。

## 边界

- 只改/新建 `develop\scripts\dsh\wake-later.ps1` 与本报告、本信号；不 commit（git 交回负责人）。
- 不再重跑上一版已验证过的 DryRun / 2 分钟真机 / 退出码 2 那三项。
- 估时：20 分钟。
