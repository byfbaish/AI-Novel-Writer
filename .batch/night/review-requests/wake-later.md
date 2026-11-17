# 派验单 wake-later · 旁路定时唤醒脚本（C 旁路，不改 dsh-schedule）

- **卡号**：wake-later
- **验收口径**：`.batch/night/cards/wake-later.md`（最新版，21:34:00）+ 收口卡 `.batch/night/cards/wake-later-fix.md`（落点回 develop、按新规格补验）；裁定书 `.batch/night/reports/wake-later-decision.md`（接受 `-LogonType Interactive`，不申请提权）。
- **交付物路径**：
  - 脚本：`C:\develop\workspace\AI-writer\develop\scripts\dsh\wake-later.ps1`（17,508B，mtime 21:52:43）
  - SHA256：`3781841DEEE104125390DF75494D4AF06F0F485564F3323C12DDECAC2FFA2804`
  - 报告：`.batch\night\reports\wake-later.md`（9,702B，21:54:28，末行 `<!-- DONE -->`）
  - 信号：`.batch\night\signals\doubao\wake-later.done`（176B，21:54:49）
  - wt-1 副本（保留不改）：`C:\develop\workspace\AI-writer\wt-1\scripts\dsh\wake-later.ps1`，同哈希
- **派验人**：豆包联络人（提交时刻 2026-11-13 21:42:32；交付核实 21:57:32）

## 联络人实测（仅取证，不判定）

- `StartWhenAvailable` / `S4U` / `WakeToRun` 相关共 18 行命中脚本；能力边界注释在脚本内
- 权限闸结论：`whoami /groups` 显示 `Mandatory Label\Medium Mandatory Level`、`Administrators ... Group used for deny only`；默认 `S4U + RunLevel Highest` 直接 `Write-Error` 并 exit 1，未尝试注册、未自动降级
- 唯一真任务验证走显式 `-LogonType Interactive`，报告写明「这是显式选择，不是自动降级」
- 睡眠唤醒未验：本机电源策略 AC=仅限重要、DC=禁用，按卡面不算红
- 未提交；`git add` 交负责人（本机 PATH 无 git）

## 后续（本单之外的进展，供参考）

负责人 21:58 裁定接受 `-LogonType Interactive`、不申请提权；QA 首验 6/6 PASS（`.batch\night\reports\wake-later-qa-firstcheck.md`）；负责人终审 PASS，提交 `27a557dd`（只 `scripts/dsh/wake-later.ps1`，`check:fast` 通过）。
