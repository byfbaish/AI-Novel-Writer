#requires -Version 5.1
<#
wake-later.ps1 —— 定时唤醒旁路：到点往 relay 的 watch 目录投一个「已完成」文件。

只做定时器，不做消息路由：文件由 dsh-handoff-relay 负责通知。

用法：
  # 建一个一次性任务（默认 2 分钟后可用）
  .\wake-later.ps1 -At "2026-11-13 23:10" -Dir "D:\tmp\relay-in" -Text "到点提醒：继续"

  # 立刻写文件（不建任务，验收/排查用）
  .\wake-later.ps1 -DryRun -Dir "D:\tmp\relay-in" -Text "探针"

  # 查看 / 删除本脚本创建的任务
  .\wake-later.ps1 -List
  .\wake-later.ps1 -Remove dsh-wake-20261113-2310-1234

  # 非管理员（默认 -LogonType S4U 会被权限闸拒绝）；仅在负责人明确选择时可换 Interactive：
  .\wake-later.ps1 -At "2026-11-13 23:10" -Dir "D:\tmp\relay-in" -Text "到点提醒：继续" -LogonType Interactive

退出码：0 成功；1 参数/运行错误（含权限不足）；2 -At 早于当前时间。

权限闸：
  默认 -LogonType S4U 需要管理员权限；未提升时直接报「权限不足」并退出 1，
  不尝试注册、不自动降级。改 Interactive 必须由负责人显式选择（只在用户登录时运行）。

能力边界：
  -WakeToRun 只覆盖待机 / 休眠；机器彻底关机不会自己醒来，
  关机错过时靠 -StartWhenAvailable 在下次开机后补跑一次（可能延迟，属预期）。
#>
param(
  [string]$At,
  [string]$Dir,
  [string]$Text,
  [string]$Name,
  [string]$File,
  [string]$Payload,
  [ValidateSet('S4U', 'Interactive')]
  [string]$LogonType = 'S4U',
  [switch]$Fire,
  [switch]$DryRun,
  [switch]$List,
  [string]$Remove,
  [string]$TaskName
)

$ErrorActionPreference = 'Stop'
$SCRIPT_PATH = $MyInvocation.MyCommand.Path
$TASK_PREFIX = 'dsh-wake-'
$INTERPRETER_CANDIDATES = @(
  (Join-Path $env:ProgramFiles 'PowerShell\7\pwsh.exe'),
  (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
)

function Fail([string]$Message) {
  [Console]::Error.WriteLine($Message)
  exit 1
}

# 权限判定：S4U + Highest 只在提升（管理员）进程下能注册；先判、不具备就回传，不硬试、不自行降级。
function Test-Elevated {
  return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ElevationDetail {
  $who = Join-Path $env:SystemRoot 'System32\whoami.exe'
  $lines = @()
  try { $lines = @(& $who /groups 2>&1) } catch { return 'whoami 不可用' }
  $parts = @()
  $label = @($lines | Where-Object { $_ -match 'S-1-16-' } | Select-Object -First 1)
  $admin = @($lines | Where-Object { $_ -match 'S-1-5-32-544' } | Select-Object -First 1)
  if ($label.Count -gt 0) { $parts += ('完整性级别 ' + (($label[0] -replace ' +', ' ').Trim())) }
  if ($admin.Count -gt 0) { $parts += ('Administrators ' + (($admin[0] -replace ' +', ' ').Trim())) }
  if ($parts.Count -eq 0) { return 'whoami /groups 无相关行' }
  return ($parts -join '；')
}

function GetInterpreter {
  foreach ($candidate in $INTERPRETER_CANDIDATES) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  $found = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  return (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
}

# 电源策略「允许使用唤醒定时器」（SUB_SLEEP / BD3B718A-0680-4D9D-8AB2-E1D2B4AC806D）。
# 关闭时 WakeToRun 不会生效，而且任务建成功也不报错——所以建任务前必须读一次并提示。
function GetWakeTimerState {
  $powercfg = Join-Path $env:SystemRoot 'System32\powercfg.exe'
  if (-not (Test-Path -LiteralPath $powercfg -PathType Leaf)) {
    return [pscustomobject]@{ Ac = $null; Dc = $null; Raw = '(未找到 powercfg.exe)' }
  }
  try {
    # 注：GUID 必须不带花括号，否则 powercfg 报「参数无效」
    $raw = (& $powercfg /q SCHEME_CURRENT SUB_SLEEP 'bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d' 2>&1 | Out-String)
  } catch {
    return [pscustomobject]@{ Ac = $null; Dc = $null; Raw = ('powercfg 读取失败：' + $_.Exception.Message) }
  }
  $ac = $null
  $dc = $null
  $acMatch = [regex]::Match($raw, '(?:当前交流电源设置索引|Current AC Power Setting Index)[^\r\n]*?0x([0-9a-fA-F]+)')
  $dcMatch = [regex]::Match($raw, '(?:当前直流电源设置索引|Current DC Power Setting Index)[^\r\n]*?0x([0-9a-fA-F]+)')
  if ($acMatch.Success) { $ac = [Convert]::ToInt32($acMatch.Groups[1].Value, 16) }
  if ($dcMatch.Success) { $dc = [Convert]::ToInt32($dcMatch.Groups[1].Value, 16) }
  return [pscustomobject]@{ Ac = $ac; Dc = $dc; Raw = $raw }
}

function ReportWakeTimerState {
  $state = GetWakeTimerState
  if ($null -eq $state.Ac -and $null -eq $state.Dc) {
    Write-Warning ("无法解析「允许使用唤醒定时器」设置，请自行确认（powercfg 原始输出见下）：`n" + $state.Raw.Trim())
    return
  }
  $acText = '未知'
  $dcText = '未知'
  if ($null -ne $state.Ac) { $acText = [string]$state.Ac }
  if ($null -ne $state.Dc) { $dcText = [string]$state.Dc }
  $offSides = @()
  if ($null -ne $state.Ac -and $state.Ac -eq 0) { $offSides += 'AC' }
  if ($null -ne $state.Dc -and $state.Dc -eq 0) { $offSides += 'DC' }
  $limitedSides = @()
  if ($null -ne $state.Ac -and $state.Ac -eq 2) { $limitedSides += 'AC' }
  if ($null -ne $state.Dc -and $state.Dc -eq 2) { $limitedSides += 'DC' }
  if ($offSides.Count -gt 0) {
    Write-Warning ("系统电源策略「允许使用唤醒定时器」在 " + ($offSides -join '/') + " 上为关闭（AC=" + $acText + "，DC=" + $dcText + "，0=禁用/1=启用/2=仅限重要）；" +
      "任务仍会创建，但这些电源状态下待机/休眠不会自动唤醒，只会在下次开机或设备被唤醒后由 -StartWhenAvailable 补跑。" +
      "开启方式：powercfg /setacvalueindex SCHEME_CURRENT SUB_SLEEP bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d 1（DC 用 /setdcvalueindex），再 powercfg /setactive SCHEME_CURRENT")
  } elseif ($limitedSides.Count -gt 0) {
    Write-Warning ("系统电源策略「允许使用唤醒定时器」在 " + ($limitedSides -join '/') + " 上为「仅限重要唤醒」（AC=" + $acText + "，DC=" + $dcText + "）；" +
      "普通计划任务可能不被唤醒，只有被系统判为「重要」的唤醒定时器才生效。判定不确定，建议改为 1（启用）后复验。")
  } else {
    Write-Output ("电源「允许使用唤醒定时器」：AC=" + $acText + "，DC=" + $dcText + "（1=启用）")
  }
}

function AssertDirectory([string]$Path, [string]$ParamName) {
  if ([string]::IsNullOrWhiteSpace($Path)) { Fail "-$ParamName 必填：已存在的目录绝对路径" }
  if (-not [IO.Path]::IsPathRooted($Path)) { Fail "-$ParamName 必须是绝对路径：$Path" }
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) { Fail "-$ParamName 目录不存在：$Path" }
  return (Resolve-Path -LiteralPath $Path).ProviderPath
}

function AssertOneLine([string]$Value, [string]$ParamName) {
  if ([string]::IsNullOrWhiteSpace($Value)) { Fail "-$ParamName 必填：一行通知文本" }
  if ($Value -match "[`r`n]") { Fail "-$ParamName 必须是单行文本（不含换行）" }
  if ($Value -match '"') { Fail "-$ParamName 不能包含双引号（计划任务命令行无法原样传递）" }
}

function GetTargetFile([string]$DirectoryPath, [string]$BaseName) {
  $stem = $BaseName
  if ([string]::IsNullOrWhiteSpace($stem)) { $stem = 'wake' }
  $stem = [IO.Path]::GetFileNameWithoutExtension($stem)
  $index = 1
  $path = Join-Path $DirectoryPath ($stem + '.md')
  while (Test-Path -LiteralPath $path) {
    $index += 1
    $path = Join-Path $DirectoryPath ($stem + '-' + $index + '.md')
  }
  return $path
}

function WriteNotice([string]$DirectoryPath, [string]$BaseName, [string]$Body) {
  $target = GetTargetFile $DirectoryPath $BaseName
  $content = $Body + "`r`n`r`n<!-- DONE -->`r`n"
  try {
    [IO.File]::WriteAllText($target, $content, (New-Object Text.UTF8Encoding($false)))
  } catch {
    throw ("写入失败：" + $target + "：" + $_.Exception.Message)
  }
  return $target
}

function ParseAt([string]$Value) {
  try {
    return [datetime]::ParseExact($Value, 'yyyy-MM-dd HH:mm', [Globalization.CultureInfo]::InvariantCulture)
  } catch {
    Fail "-At 格式必须是 yyyy-MM-dd HH:mm（本地时间），收到：$Value"
  }
}

# ------------------------------------------------------------------ -List
if ($List) {
  $tasks = @()
  try {
    $tasks = Get-ScheduledTask -TaskName ($TASK_PREFIX + '*') -ErrorAction Stop
  } catch {
    $tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like ($TASK_PREFIX + '*') })
  }
  $tasks = @($tasks | Sort-Object TaskName)
  if ($tasks.Count -eq 0) { Write-Output '(无 dsh-wake-* 任务)' } else {
    foreach ($task in $tasks) {
      $next = ''
      try {
        $info = Get-ScheduledTaskInfo -TaskName $task.TaskName -ErrorAction Stop
        if ($info.NextRunTime) { $next = $info.NextRunTime.ToString('yyyy-MM-dd HH:mm:ss') }
      } catch { $next = '(读取下次运行时间失败)' }
      Write-Output ("{0}`t{1}`t{2}" -f $task.TaskName, $task.State, $next)
    }
  }
  exit 0
}

# ---------------------------------------------------------------- -Remove
if (-not [string]::IsNullOrWhiteSpace($Remove)) {
  try {
    $task = Get-ScheduledTask -TaskName $Remove -ErrorAction Stop
  } catch {
    Fail "任务不存在，无法删除：$Remove"
  }
  try {
    Unregister-ScheduledTask -TaskName $Remove -Confirm:$false -ErrorAction Stop
  } catch {
    Fail ("删除任务失败：" + $Remove + "：" + $_.Exception.Message)
  }
  Write-Output ("已删除任务：" + $Remove)
  exit 0
}

# ------------------------------------------------------------------ -Fire
if ($Fire) {
  if (-not [string]::IsNullOrWhiteSpace($Payload)) {
    try {
      $data = Get-Content -LiteralPath $Payload -Raw -ErrorAction Stop | ConvertFrom-Json
    } catch {
      Fail ("-Payload 读取失败：" + $Payload + "：" + $_.Exception.Message)
    }
    if ([string]::IsNullOrWhiteSpace($Dir)) { $Dir = [string]$data.dir }
    if ([string]::IsNullOrWhiteSpace($Text)) { $Text = [string]$data.text }
    if ([string]::IsNullOrWhiteSpace($File)) { $File = [string]$data.file }
    if ([string]::IsNullOrWhiteSpace($TaskName)) { $TaskName = [string]$data.taskName }
    try { Remove-Item -LiteralPath $Payload -Force -ErrorAction Stop } catch { Write-Warning ("载荷清理失败：" + $Payload) }
  }
  $dirPath = AssertDirectory $Dir 'Dir'
  AssertOneLine $Text 'Text'
  $fileBase = $File
  if ([string]::IsNullOrWhiteSpace($fileBase)) { $fileBase = 'wake' }
  try {
    $written = WriteNotice $dirPath $fileBase $Text
  } catch {
    Fail $_.Exception.Message
  }
  Write-Output ("已写入：" + $written)
  # /Z 的等价实现：跑完自删（只删自己这条，失败不改变结果）
  if (-not [string]::IsNullOrWhiteSpace($TaskName)) {
    try {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
      Write-Output ("任务已自删：" + $TaskName)
    } catch {
      Write-Warning ("任务自删失败（文件已写入，不影响投递）：" + $TaskName + "：" + $_.Exception.Message)
    }
  }
  exit 0
}

# ---------------------------------------------------------------- -DryRun
if ($DryRun) {
  $dirPath = AssertDirectory $Dir 'Dir'
  AssertOneLine $Text 'Text'
  $fileBase = $File
  if ([string]::IsNullOrWhiteSpace($fileBase)) { $fileBase = 'wake-dry-' + (Get-Date).ToString('yyyyMMdd-HHmmss') }
  try {
    $written = WriteNotice $dirPath $fileBase $Text
  } catch {
    Fail $_.Exception.Message
  }
  Write-Output ("已写入：" + $written)
  exit 0
}

# ------------------------------------------------------------- 创建任务
if ([string]::IsNullOrWhiteSpace($At)) { Fail "-At 必填：yyyy-MM-dd HH:mm（本地时间）" }
$runAt = ParseAt $At
$now = Get-Date
if ($runAt -le $now) {
  Write-Error ("-At 必须晚于当前时间：给定 " + $runAt.ToString('yyyy-MM-dd HH:mm') + "，当前 " + $now.ToString('yyyy-MM-dd HH:mm:ss')) -ErrorAction Continue
  exit 2
}
$dirPath = AssertDirectory $Dir 'Dir'
AssertOneLine $Text 'Text'

$taskName = $Name
if ([string]::IsNullOrWhiteSpace($taskName)) {
  $taskName = $TASK_PREFIX + $runAt.ToString('yyyyMMdd-HHmm') + '-' + (Get-Random -Minimum 1000 -Maximum 10000)
} elseif ($taskName -notmatch ('^' + [regex]::Escape($TASK_PREFIX))) {
  $taskName = $TASK_PREFIX + $taskName
  Write-Warning ("-Name 未带 " + $TASK_PREFIX + " 前缀，已改为：" + $taskName)
}

# 同名任务已存在：直接报错，不偷偷覆盖
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) { Fail ("任务已存在，请换 -Name 或先 -Remove：" + $taskName) }

$scriptFull = (Resolve-Path -LiteralPath $SCRIPT_PATH).ProviderPath
$interpreter = GetInterpreter
$argument = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $scriptFull + '" -Fire -Dir "' + $dirPath + '" -Text "' + $Text + '" -File "' + $taskName + '" -TaskName "' + $taskName + '"'

# 权限闸：S4U + RunLevel Highest 注册到根任务目录需要管理员权限。
# 不具备就回传「权限不足」+ 原始判据，不硬试、不自行降级；是否改 Interactive 或提权由负责人决定。
$isElevated = Test-Elevated
if ($LogonType -eq 'S4U' -and -not $isElevated) {
  $detail = Get-ElevationDetail
  Write-Error ("权限不足：-LogonType S4U + -RunLevel Highest 需要管理员权限，当前进程未提升（" + $detail + "）。未尝试注册，也未自行降级。二选一：① 在管理员 PowerShell 中重跑本脚本；② 显式加 -LogonType Interactive（免管理员，但只在用户登录时运行、无最高权限）。") -ErrorAction Continue
  exit 1
}
ReportWakeTimerState

$action = New-ScheduledTaskAction -Execute $interpreter -Argument $argument
$trigger = New-ScheduledTaskTrigger -Once -At $runAt
# WakeToRun：待机/休眠唤醒执行；StartWhenAvailable：关机错过时下次开机补跑（schtasks 命令行没有这两个开关）
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$userName = [Security.Principal.WindowsIdentity]::GetCurrent().Name
if ($LogonType -eq 'S4U') {
  $principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType S4U -RunLevel Highest
} else {
  $principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Limited
  Write-Warning ("-LogonType Interactive：任务以当前登录身份运行，只在用户登录时生效、无最高权限；这是显式选择，不是自动降级。")
}

$registerError = $null
try {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'wake-later: 到点往 watch 目录投一个已完成文件' -ErrorAction Stop | Out-Null
  Write-Output ("已创建任务：" + $taskName + " @ " + $runAt.ToString('yyyy-MM-dd HH:mm') + " (WakeToRun + StartWhenAvailable + " + $LogonType + "/" + $principal.RunLevel + ")")
  Write-Output ("动作：" + $interpreter + " " + $argument)
  exit 0
} catch {
  $registerError = $_
}

# 退路：schtasks /Create /SC ONCE + /Z（跑完自删）。
# 用临时 .cmd 包装器 + JSON 载荷规避 /TR 261 字符上限与命令行引号转义；包装器与载荷跑完自删。
Write-Warning ("Register-ScheduledTask 失败，回退 schtasks：" + $registerError.Exception.Message)
$st = $runAt.ToString('HH:mm')
$sd = $runAt.ToString('yyyy/MM/dd')
$wrapper = Join-Path $env:TEMP ('dsh-wake-' + (Get-Date).ToString('yyyyMMddHHmmss') + '-' + (Get-Random -Minimum 1000 -Maximum 10000) + '.cmd')
$payload = [IO.Path]::ChangeExtension($wrapper, '.json')
$payloadJson = @{ dir = $dirPath; text = $Text; file = $taskName; taskName = $taskName } | ConvertTo-Json -Depth 3
$wrapperText = "@echo off`r`n" +
  '"' + $interpreter + '" -NoProfile -ExecutionPolicy Bypass -File "' + $scriptFull + '" -Fire -Payload "' + $payload + '"' + "`r`n" +
  'set RC=%ERRORLEVEL%' + "`r`n" +
  'del /q "' + $payload + '" >nul 2>nul' + "`r`n" +
  'del /q "%~f0" >nul 2>nul' + "`r`n" +
  'exit /b %RC%' + "`r`n"
try {
  [IO.File]::WriteAllText($wrapper, $wrapperText, (New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($payload, $payloadJson, (New-Object Text.UTF8Encoding($false)))
} catch {
  Write-Error ("写临时包装器失败：" + $_.Exception.Message)
  exit 1
}
$schtasksArgs = @('/Create', '/SC', 'ONCE', '/ST', $st, '/SD', $sd, '/TN', $taskName, '/TR', ('"' + $wrapper + '"'), '/Z', '/RL', 'LIMITED')
try {
  $output = & "$env:SystemRoot\System32\schtasks.exe" @schtasksArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Error ("任务创建失败：`nRegister-ScheduledTask 原始错误：" + $registerError.Exception.Message + "`nschtasks 原始输出（exit " + $LASTEXITCODE + "）：`n" + ($output | Out-String))
    exit 1
  }
  Write-Output ("已创建任务（schtasks，无 WakeToRun）：" + $taskName + " @ " + $runAt.ToString('yyyy-MM-dd HH:mm'))
  Write-Output (($output | Out-String).Trim())
  exit 0
} catch {
  Write-Error ("任务创建失败：`nRegister-ScheduledTask 原始错误：" + $registerError.Exception.Message + "`nschtasks 异常：" + $_.Exception.Message)
  exit 1
}