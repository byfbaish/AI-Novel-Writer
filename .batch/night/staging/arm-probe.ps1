# P10 真机复验 —— 第 3 步「放探针」
# DSH 关掉后双击同目录的 arm-probe.cmd 即可；加 -DryRun 只检查不复制。
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$src = 'C:\develop\workspace\AI-writer\develop\.batch\night\staging\probe-startup-1113.txt'
$dst = 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\probe-startup-1113.txt'
$log = 'C:\develop\workspace\AI-writer\develop\.batch\night\staging\arm-probe.log'

function Pause-Here { Write-Host ''; Read-Host '按回车关闭' | Out-Null }

Write-Host "源  : $src"
Write-Host "目标: $dst"

if (-not (Test-Path -LiteralPath $src)) {
  Write-Host '探针缺失，中止，未做任何改动。' -ForegroundColor Red
  Pause-Here; exit 1
}

if ($DryRun) {
  Write-Host '[DRY] 探针在盘'
  if (Test-Path -LiteralPath $dst) {
    Write-Host '[DRY] 目标已存在，正式跑会覆盖'
  } else {
    Write-Host '[DRY] 目标不存在，会新建'
  }
  Pause-Here; exit 0
}

try {
  Copy-Item -LiteralPath $src -Destination $dst -Force
} catch {
  Write-Host "复制失败：$($_.Exception.Message)" -ForegroundColor Red
  Pause-Here; exit 1
}

$ok = (Test-Path -LiteralPath $dst) -and ((Get-Item -LiteralPath $dst).Length -eq (Get-Item -LiteralPath $src).Length)
if (-not $ok) {
  Write-Host '复制后校验不通过：目标缺失或字节数不一致。' -ForegroundColor Red
  Pause-Here; exit 1
}

"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') armed -> $dst" | Add-Content -LiteralPath $log -Encoding UTF8
Write-Host ''
Write-Host '探针已就位。' -ForegroundColor Green
Write-Host "字节数 $((Get-Item -LiteralPath $dst).Length)"
Write-Host ''
Write-Host '下一步：启动 DSH。起来之后在群里说一句「探针已放」，第 5 步由我们做。'
Pause-Here
