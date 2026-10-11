param(
  [string]$Path = 'docs/plans/prompt-assembly-backlog.md',
  [int]$Seconds = 300,
  [int]$IntervalMs = 2000
)

$ErrorActionPreference = 'Stop'
$full = (Resolve-Path -LiteralPath $Path).Path
Write-Output "[watch] file = $full"
Write-Output "[watch] duration = ${Seconds}s, interval = ${IntervalMs}ms"
Write-Output "[watch] PS edition = $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion)"

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class RmLock {
  [StructLayout(LayoutKind.Sequential)]
  struct RM_UNIQUE_PROCESS {
    public int dwProcessId;
    public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
  }
  const int CCH_RM_MAX_APP_NAME = 255;
  const int CCH_RM_MAX_SVC_NAME = 63;
  enum RM_APP_TYPE { RmUnknownApp = 0, RmMainWindow = 1, RmOtherWindow = 2, RmService = 3, RmExplorer = 4, RmConsole = 5, RmCritical = 1000 }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)] public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)] public string strServiceShortName;
    public RM_APP_TYPE ApplicationType;
    public uint AppStatus;
    public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
  }

  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);
  [DllImport("rstrtmgr.dll")]
  static extern int RmEndSession(uint pSessionHandle);
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames,
    uint nApplications, RM_UNIQUE_PROCESS[] rgApplications, uint nServices, string[] rgsServiceNames);
  [DllImport("rstrtmgr.dll")]
  static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo,
    [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);

  /// 返回 "pid|应用名" 列表；空列表表示当前没有进程持有该文件。
  public static List<string> Who(string path) {
    var result = new List<string>();
    uint session = 0;
    string key = Guid.NewGuid().ToString();
    if (RmStartSession(out session, 0, key) != 0) return result;
    try {
      if (RmRegisterResources(session, 1, new[] { path }, 0, null, 0, null) != 0) return result;
      uint needed = 0, count = 0, reasons = 0;
      int res = RmGetList(session, out needed, ref count, null, ref reasons);
      if (res == 234 && needed > 0) {
        var infos = new RM_PROCESS_INFO[needed];
        count = needed;
        if (RmGetList(session, out needed, ref count, infos, ref reasons) == 0) {
          for (int i = 0; i < count; i++) {
            result.Add(infos[i].Process.dwProcessId + "|" + infos[i].strAppName);
          }
        }
      }
    } finally { RmEndSession(session); }
    return result;
  }
}
'@

function Get-FileState {
  try {
    $item = Get-Item -LiteralPath $full -Force
    return [pscustomobject]@{
      Exists = $true
      Size   = $item.Length
      MTime  = $item.LastWriteTime.ToString('HH:mm:ss.fff')
      Lines  = (Get-Content -LiteralPath $full -ErrorAction Stop | Measure-Object -Line).Lines
    }
  } catch {
    return [pscustomobject]@{ Exists = $false; Size = -1; MTime = 'ERR'; Lines = -1 }
  }
}

# 基线
$prev = Get-FileState
Write-Output "[base] size=$($prev.Size) lines=$($prev.Lines) mtime=$($prev.MTime)"
$holders = [RmLock]::Who($full)
if ($holders.Count -eq 0) { Write-Output "[base] holders = (none)" }
else { foreach ($h in $holders) { Write-Output "[base] holder = $h" } }

$deadline = (Get-Date).AddSeconds($Seconds)
$changes = 0
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds $IntervalMs
  $now = Get-FileState
  if ($now.Size -ne $prev.Size -or $now.MTime -ne $prev.MTime) {
    $changes++
    $stamp = (Get-Date).ToString('HH:mm:ss.fff')
    Write-Output "[change #$changes @$stamp] size $($prev.Size)->$($now.Size) lines $($prev.Lines)->$($now.Lines) mtime $($now.MTime)"
    $h2 = [RmLock]::Who($full)
    if ($h2.Count -eq 0) { Write-Output "             holders=(none at query time)" }
    else { foreach ($h in $h2) { Write-Output "             holder=$h" } }
    $prev = $now
  }
}
Write-Output "[done] changes observed = $changes"
