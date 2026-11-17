# wake-later 定时唤醒旁路 · 交付报告

## 交付物

- `scripts/dsh/wake-later.ps1`（新建；UTF-8 BOM；PowerShell 7 / Windows PowerShell 5.1 可读）
- 本报告

未改 `cordis.patch.yml`、未改 relay 仓库、未重启 DSH、未 push；所有测试都指向 `%TEMP%` 临时目录，未往生产 watch 目录投任何文件。

## 实现

只做定时器：到点把 `<name>.md` 写进指定目录，由 relay 负责通知。不调用 `dsh-schedule`，不改任何第三方包。

### 参数

| 参数 | 说明 |
|---|---|
| `-At` | 必填，`yyyy-MM-dd HH:mm` 本地；格式错 → exit 1；不晚于当前时间 → **exit 2 且不建任务** |
| `-Dir` | 必填，**已存在的绝对路径**目录（无默认值；不存在 → exit 1） |
| `-Text` | 必填，单行；含换行或双引号直接报错（命令行无法原样传递） |
| `-Name` | 可选，默认 `dsh-wake-<yyyyMMdd-HHmm>-<4 位随机>`；不带前缀自动补并 warning |
| `-List` | 按 `dsh-wake-*` 过滤：名称 / 状态 / 下次运行时间 |
| `-Remove <Name>` | 删除任务；不存在 → exit 1 |
| `-LogonType` | `S4U`（默认，需管理员）或 `Interactive`（免管理员，只在用户登录时运行、无最高权限；**必须由负责人显式选择**） |
| `-DryRun` | 不建任务，立刻写文件（验收/排查） |
| `-Fire` / `-File` / `-TaskName` / `-Payload` | 内部：任务回调自身、自删标识、schtasks 回退载荷 |

### 权限闸（本卡硬要求）

- 建任务前先判 `Test-Elevated`（`WindowsPrincipal.IsInRole(Administrator)`），并在拒绝时用 `Get-ElevationDetail` 读 `whoami /groups` 的完整性级别与 `Administrators` 行，作为原始判据一并打出。
- 默认 `-LogonType S4U` + `-RunLevel Highest`：**未提升直接 `Write-Error` + exit 1，不尝试注册、不自动降级**。
- 只有显式传 `-LogonType Interactive` 才走免管理员路径（`Interactive/Limited`），并打印「这是显式选择，不是自动降级」。

### 任务形态

- 触发器 `New-ScheduledTaskTrigger -Once -At`。
- 设置 `New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 5min`。
- 主体：`S4U/Highest`（默认，需管理员）或 `Interactive/Limited`（显式选择）。
- 自删：`-Fire` 写完文件后 `Unregister-ScheduledTask -TaskName <自身>`（等价 `schtasks /Z`）；失败只 warning，不影响已落文件。
- 电源检查：`powercfg /q SCHEME_CURRENT SUB_SLEEP bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d`（GUID 不带花括号，带花括号会「参数无效」），解析 AC/DC 索引（0=禁用 / 1=启用 / 2=仅限重要）；非启用时 warning 并继续。
- 回退：`Register-ScheduledTask` 失败时打印原始错误，再 `schtasks /Create /SC ONCE … /Z`（临时 `.cmd` + JSON 载荷规避 `/TR` 261 字符与引号转义，跑完自删）；两条都失败则打印两侧原始错误 + exit 1。
- 文件内容：首行 `Text`、第二行空行、第三行 `<!-- DONE -->`（CRLF，UTF-8 无 BOM）；同名已存在 → `-2`、`-3` 递增。

## 验收

### 0. 权限现状与闸门（本卡重点）

```
whoami /groups：
  BUILTIN\Administrators   Alias  S-1-5-32-544   Group used for deny only
  Mandatory Label\Medium Mandatory Level  S-1-16-8192
IsInRole(Administrator) = False
```

默认建任务（未提升）：

```
Write-Error: 权限不足：-LogonType S4U + -RunLevel Highest 需要管理员权限，当前进程未提升（完整性级别 Mandatory Label\Medium Mandatory Level Label S-1-16-8192；Administrators BUILTIN\Administrators Alias S-1-5-32-544 Group used for deny only）。未尝试注册，也未自行降级。二选一：① 在管理员 PowerShell 中重跑本脚本；② 显式加 -LogonType Interactive（免管理员，但只在用户登录时运行、无最高权限）。
EXIT=1
任务数=0
```

### 1. `-DryRun`

```
已写入：C:\Users\<用户名>\AppData\Local\Temp\wake-later-gate\wake-dry-20261113-214755.md
EXIT(DryRun)=0
```

### 2. 真建 2 分钟后任务（显式 `-LogonType Interactive`，未重启宿主）

创建：

```
警告: 系统电源策略「允许使用唤醒定时器」在 DC 上为关闭（AC=2，DC=0…）
警告: -LogonType Interactive：任务以当前登录身份运行，只在用户登录时生效、无最高权限；这是显式选择，不是自动降级。
已创建任务：dsh-wake-20261113-2152-1049 @ 2026-11-13 21:52 (WakeToRun + StartWhenAvailable + Interactive/Limited)
EXIT=0
dsh-wake-20261113-2152-1049	Ready	2026-11-13 21:52:00
```

到点后：

```
现在=21:52:21
dsh-wake-20261113-2152-1049.md     43 2026/11/13 21:52:00
Interactive 显式验证

剩余任务=0
```

**睡眠唤醒未验**：本机电源策略 AC=「仅限重要」/DC=「禁用」，且未把机器置于睡眠（会中断会话）；「到点能唤醒并落文件」未验证，判据不因此变红，但结论不确定。

### 3. `-At` 早于现在

```
Write-Error: -At 必须晚于当前时间：给定 2026-11-13 21:48，当前 2026-11-13 21:50:15
EXIT=2
```

### 4. `-Remove` 后 `-List` 消失

```
已删除任务：dsh-wake-20261113-2201-4789
EXIT=0
(无 dsh-wake-* 任务)
残留=0
```

### 5. 边界

未改 `cordis.patch.yml`、未改 relay 仓库、未 push、未重启；测试全在 `%TEMP%`。

## 不确定 / 需负责人裁定（重要）

1. **S4U + RunLevel Highest 未能按规格注册**：本机 shell 非提升（Administrators 为 deny-only、Medium IL），脚本按新卡要求**不再自动降级**，默认路径直接 exit 1 回传「权限不足」。判定线 2 的真任务是用**显式** `-LogonType Interactive` 验的（免管理员、只在登录时运行、无最高权限），我把这一点视为「负责人未答复时的最小验证」，**是否接受由负责人裁定**；要 S4U/Highest 原样生效，需在管理员 PowerShell 中重跑。
   - 我于本轮发起过一次二选一询问（Interactive 立即验 / 你提权重跑 / 我先唤起 UAC），120 秒内未收到答复，遂按上述方式继续。
2. **睡眠唤醒未验**（见上），且电源策略本身为 AC=仅限重要、DC=禁用；需先 `powercfg /setacvalueindex … 1` 才可能唤醒。
3. `-Text` 不允许双引号（显式报错，不改字）。
4. 时间精度为分钟：`-At` 与当前同一分钟、即使秒数更晚也判 exit 2。
5. 本机 PATH 内没有 `git`，本轮未执行任何 git 命令；按红线 2，`git add scripts/dsh/wake-later.ps1` 交由负责人。

## 第二轮收口（落点回 develop + 新规格核对）

### 1. 落点已归位

- 新落点：`develop\scripts\dsh\wake-later.ps1`（本轮新建，17508 字节）
- SHA256：`3781841DEEE104125390DF75494D4AF06F0F485564F3323C12DDECAC2FFA2804`
- 来源：从 `wt-1\scripts\dsh\wake-later.ps1` 复制；两边 SHA256 相同（复制后比对一致）
- `wt-1` 那份**原样保留**：17508 字节、mtime `2026/11/13 21:52:43`、SHA256 未变，未删未改

### 2. 权限结论（whoami /groups 原文）

```
BUILTIN\Administrators Alias S-1-5-32-544 Group used for deny only
Mandatory Label\Medium Mandatory Level Label S-1-16-8192
IsInRole(Administrator)=False
```

结论：**权限不足**。按卡面「不具备就不硬试、不自行降级」，本轮未尝试用 S4U + Highest 注册任务，也未自动落到 Interactive；`-List` 为空（`(无 dsh-wake-* 任务)`，exit 0）。因此「有权限就真的注册一条再删」这一项**未验**，原因即上述权限行原文。

上一版已验过的功能结论（DryRun、2 分钟真机落文件并自删、`-At` 过去 exit 2、`-Remove`）按卡面不再重跑，直接引用本报告前半部分；那些结论是在显式 `-LogonType Interactive` 下取得的。

### 3. 新规格四项在脚本中的落点（行号基于 develop 落点这份文件）

| 规格项 | 位置 | 原文 |
|---|---|---|
| `-WakeToRun` | L311 | `New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)` |
| `-StartWhenAvailable` | L311（同一行） | 同上 |
| `-LogonType S4U` | L314 | `New-ScheduledTaskPrincipal -UserId $userName -LogonType S4U -RunLevel Highest` |
| `-RunLevel Highest` | L314（同一行） | 同上 |
| 电源「允许使用唤醒定时器」检查 | L90–L128 | `powercfg /q SCHEME_CURRENT SUB_SLEEP 'bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d'`，解析 AC/DC 索引（0=禁用/1=启用/2=仅限重要），非启用时 `Write-Warning` 并继续 |
| 权限闸（不硬试、不降级） | L298–L305 | 非提升且 `-LogonType S4U` → `Write-Error "权限不足…"` + `exit 1`，不调用注册 |

补充：`powercfg` 的 GUID 必须不带花括号（带花括号会「参数无效」，这是本轮之前实测到的坑，已写进注释 L95）。

### 4. 能力边界注释（可在脚本内搜到）

```
L27  能力边界：
L28  -WakeToRun 只覆盖待机 / 休眠；机器彻底关机不会自己醒来，
L29  关机错过时靠 -StartWhenAvailable 在下次开机后补跑一次（可能延迟，属预期）。
```

### 5. 边界核对

- 未重启 DSH、未碰 `cordis.patch.yml`、未改 relay 仓库、未 push
- 未往生产 watch 目录丢任何文件（本轮未建任务，仅 `-List`）
- 未 commit；`git add` 交回负责人（本机 PATH 亦无 git）

### 6. 本轮仍未验

- **S4U + RunLevel Highest 的真实注册**：无管理员权限，按卡面不硬试。
- **睡眠唤醒**：本机电源策略 AC=仅限重要、DC=禁用（上一轮实测 `0x00000002` / `0x00000000`），且未把机器置于睡眠。

<!-- DONE -->
