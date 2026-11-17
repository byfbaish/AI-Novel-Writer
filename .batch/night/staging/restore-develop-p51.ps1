# 复原 develop 到 26627655（P51 误落 develop 的清理）
# 状态：已写好，**未执行**。等 AI writer总负责人 放行，或 QA 复核后由 developer 跑。
# 依据快照：.batch/night/staging/develop-snapshot-p51.txt（07:27:29 取样）
# 纪律：逐个点名文件，禁 git add -A / git checkout . / git restore .；不 push、不 commit。

param(
  [switch]$Execute   # 不带此开关 = 只演练（打印将执行的命令）
)

$ErrorActionPreference = 'Stop'
$repo = 'C:\develop\workspace\AI-writer\develop'
Set-Location $repo

$base = '26627655'

# 1) 前置核：HEAD 必须在 base 或在其之上，且分支是 exp/resource-ledger
$head = (git rev-parse --short HEAD)
$branch = (git rev-parse --abbrev-ref HEAD)
Write-Host "HEAD=$head branch=$branch"
if ($branch -ne 'exp/resource-ledger') { throw "分支不是 exp/resource-ledger，停止" }

# 2) 有无提交：列出 base..HEAD
$commits = @(git log --oneline "$base..HEAD")
if ($commits.Count -gt 0) {
  Write-Host "发现提交 $($commits.Count) 笔："
  $commits | ForEach-Object { Write-Host "  $_" }
  Write-Host "→ 路径 B：先人工核这些提交是否全部来自豆包、且期间无第三方提交，再 reset --hard"
  if ($Execute) {
    # 二次人工确认：把上面的提交清单贴进群，负责人点头后才取消下面这行注释
    # git reset --hard $base
    Write-Host "已跳过 reset（需负责人点头后手工放开注释）"
  }
  exit 0
}

# 3) 无提交：逐个点名复原被改的跟踪文件（快照里那三个）
$targets = @(
  'src/components/editor/draft-edit-median.ts',
  'src/components/editor/ReviewReport.tsx',
  'src/components/editor/__tests__/draft-edit-median.test.ts'
)
foreach ($f in $targets) {
  $st = (git status --porcelain -- $f)
  if ([string]::IsNullOrWhiteSpace($st)) { Write-Host "skip（工作区干净）：$f"; continue }
  Write-Host "restore：$f  [$($st.Trim())]"
  if ($Execute) { git checkout -- $f }
}
Write-Host "注意：未跟踪项一律不动；目标保留 ?? 开篇试样 02/ 与一切非本次改动的未跟踪文件。"

# 4) 复原后必须复核（QA 用 git 客观验）
Write-Host "`n=== 复原后回读 ==="
Write-Host ("HEAD=" + (git rev-parse --short HEAD))
git status --porcelain
Write-Host "---numstat（应为空）---"
git diff --numstat
Write-Host "---ignoring CR---"
git diff --ignore-cr-at-eol --stat
