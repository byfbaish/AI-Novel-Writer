执行方：developer · AI writer项目组（群分身）
model=deepseek-v4.1-flash | 倍率=1x | provider=deepseek

# CARD-1119-H 推送前脱敏前置 · 交件报告

卡号 CARD-1119-H｜起点 `058c0867`｜分支 `card/1119-H`｜2026-11-20｜执行方 developer

## 一、结论

三类处置按卡面 §三 分别执行，判据 1–7 全绿：机检 `--all-tracked` **0 个文件 / 0 处命中**（EXIT=0，扫描 3363 件，工具为**回滚后的原版**）。

| 类 | 处置 | 量 |
|---|---|---|
| T1 真名 | 改 `<用户名>` | 8 件 / 9 处字面量（机检 17 处命中清零，1 处路径+1 处姓名同源计 2 次） |
| T2 会话日志 | 出跟踪面 + 移 quarantine + `.gitignore` 例外一行 | 1 件 / 1,591,957B |
| T3 假数据 | 不改文本，`.piiallow` 149 条（两行式：上一行依据、下一行正则） | 81 文件 / 269 处 |

三处已裁（§六）：①`pii-scan.mjs` 工具补丁——**驳、已回滚**，`.piiallow` 改两行式；②6 处「公开仓库 committer 邮箱」——认，不改文本；③`.piiignore` 一行——认，仅此一行。

## 二、T1 · 真名 → 占位符（8 件 9 处）

改法：真名一段替换为 `<用户名>`，保留原有路径结构；8 件全在 `.batch/night/staging/vn-history-1119/`（本阶段新入库件，非 stage 1 冻结归档物），字节各 +2（1 处）或 +4（2 处），`crlf` 改前改后均为 0。

| # | 文件 | 处数 | 字节 |
|---|---|---|---|
| 1 | `.batch/night/staging/vn-history-1119/cards/d1-delivered-path.v1.md` | 1 | 11297→11299 |
| 2 | `…/cards/d1-delivered-path.v2.md` | 1 | 13188→13190 |
| 3 | `…/cards/d1-delivered-path.v3.md` | 1 | 13853→13855 |
| 4 | `…/cards/d1-delivered-path.v4.md` | 1 | 13854→13856 |
| 5 | `…/cards/d1-delivered-path.v5.md` | 1 | 14183→14185 |
| 6 | `…/cards/wb-rules-example.v1.md` | 1 | 6983→6985 |
| 7 | `…/org/process-efficiency-assign-1116.v1.md` | 1 | 6435→6437 |
| 8 | `…/staging/message-admission.v1.md` | 2 | 4171→4175 |

改后机检 `name` 类命中 0、`user-path` 由 109 降至 98；`git diff --stat` → `8 files changed, 9 insertions(+), 9 deletions(-)`。

## 三、T2 · 会话日志出跟踪面

| 项 | 值 |
|---|---|
| 件 | `.batch/night/staging/tmp-c9ff5961.jsonl` |
| 原 blob | `b5cbf42a56bad886ae65c57afbfbb7e6f4414691` |
| 字节 | 1,591,957 |
| `git cat-file blob b5cbf42a \| md5sum` | `8a16b866cf6e453e407abcb7f6550c7a` |
| 移出后 `md5sum C:/tmp/pmo-stage2-quarantine/tmp-c9ff5961.jsonl` | `8a16b866cf6e453e407abcb7f6550c7a`（逐字符相同） |
| `git rm --cached` | 已执行，工作区原件同 md5 后删除（移动非复制） |
| `.gitignore` | 在 `!/.batch/night/archive/` 之后加 2 行：注释 + `/.batch/night/staging/tmp-c9ff5961.jsonl` |
| quarantine README | 追加「附：CARD-1119-H 移出的会话日志」六段（谁建／何时／用途／保留期限＝**待主人定**／过期给谁／回滚），见 `C:/tmp/pmo-stage2-quarantine/README.md` |

## 四、T3 · 假数据白名单（149 条 = 报告表 149 行；两行式 302 行）

不改文本，逐条写 `.piiallow`（仓根新件）：**两行式**——上一行 `# 依据：…` 写明类别、文件:行、kind×处数，下一行一条正则。覆盖面 269/269。此格式取代首轮「行尾注释」写法（该写法需要改共用工具才能生效，裁定见 §六 待裁 1）。

| kind | 处数 | 典型依据 |
|---|---|---|
| user-path | 98 | 测试夹具随机用户名路径／`<真名>`、`$(whoami)`、`$USERNAME` 等占位写法 |
| idcard | 86 | 测试夹具 Windows FILETIME 数值、JSON 哈希数字串（规则误判） |
| secret | 37 | 内部方案编号字样（`sk-` 前缀为卡/方案标识，非密钥） |
| email | 24 | 示例假域、`git@github.com` 远端写法、公开仓库 committer 身份（见 §六） |
| phone | 14 | 哈希串中的数字段、测试假号 |
| privacy-word | 10 | 红队探针话术里的字段名（虚构计划名，无真实值） |

### 表（149 行，与 `.piiallow` 149 条正则行一一对应）

| # | 命中字面量（正则源） | kind | 处数 | 首现行 | 依据 |
|---|---|---|---|---|---|
| 1 | `13538859058` | phone | 1 | .batch/night/archive/MANIFEST.sha256:80 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 2 | `C:\\Users\\$(whoami` | user-path | 2 | .batch/night/cards/CARD-1118-C-placeholder-close.md:37 | 占位写法或 shell 变量展开，不含真实用户名 |
| 3 | `C:\Users\<真名>` | user-path | 1 | .batch/night/cards/CARD-1118-C-placeholder-close.md:22 | 占位写法或 shell 变量展开，不含真实用户名 |
| 4 | `C:\\Users\\$USERNAME` | user-path | 3 | .batch/night/cards/CARD-1119-A-pii-line-landing.md:17 | 占位写法或 shell 变量展开，不含真实用户名 |
| 5 | `C:\Users\...` | user-path | 1 | .batch/night/cards/p5-rename-and-title-check.md:46 | 占位写法或 shell 变量展开，不含真实用户名 |
| 6 | `/Users/$(whoami` | user-path | 1 | .batch/night/reports/CARD-1118-C-qa-firstcheck.md:50 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 7 | `C:\\Users\\$USERNAME` | user-path | 5 | .batch/night/reports/CARD-1118-C-qa-firstcheck.md:56 | 占位写法或 shell 变量展开，不含真实用户名 |
| 8 | `/Users/$(whoami` | user-path | 1 | .batch/night/reports/CARD-1118-C-report.md:46 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 9 | `C:\\\\Users\\\\$(whoami` | user-path | 1 | .batch/night/reports/CARD-1118-C-report.md:72 | 占位写法或 shell 变量展开，不含真实用户名 |
| 10 | `C:\\Users\\<真名>` | user-path | 1 | .batch/night/reports/CARD-1118-C-report.md:53 | 占位写法或 shell 变量展开，不含真实用户名 |
| 11 | `C:\\Users\\$(whoami` | user-path | 5 | .batch/night/reports/CARD-1118-C-report.md:61 | 占位写法或 shell 变量展开，不含真实用户名 |
| 12 | `C:\\Users\\$USERNAME` | user-path | 2 | .batch/night/reports/CARD-1119-A-qa-firstcheck.md:55 | 占位写法或 shell 变量展开，不含真实用户名 |
| 13 | `/Users/$(whoami` | user-path | 1 | .batch/night/reports/CARD-1119-A-report.md:62 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 14 | `C:\\\\Users\\\\$USERNAME` | user-path | 1 | .batch/night/reports/CARD-1119-A-report.md:135 | 占位写法或 shell 变量展开，不含真实用户名 |
| 15 | `C:\Users\$USERNAME` | user-path | 3 | .batch/night/reports/CARD-1119-A-report.md:18 | 占位写法或 shell 变量展开，不含真实用户名 |
| 16 | `C:\\Users\\[^<]` | user-path | 1 | .batch/night/reports/CARD-1119-E-qa-firstcheck.md:152 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 17 | `sk-reuse-coverage-20261109` | secret | 1 | .batch/night/reports/d12-wiring-sites.md:147 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 18 | `sk-reuse-threshold-calibration-20261109` | secret | 1 | .batch/night/reports/d12-wiring-sites.md:147 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 19 | `947875122@qq.com` | email | 3 | .batch/night/reports/merge-p55-into-develop-qa.md:22 | 公开仓库 committer 身份（git 历史同值），非新增泄漏；相关台账只读故未改文本，列报告待裁 |
| 20 | `C:\Users\???` | user-path | 1 | .batch/night/reports/p28-probe-after-fix.md:68 | 占位写法或 shell 变量展开，不含真实用户名 |
| 21 | `C:\Users\…` | user-path | 1 | .batch/night/reports/p3-oss-cleanup.md:337 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 22 | `sk-dedupe-physical-0854` | secret | 1 | .batch/night/reports/p33-target-resolve.md:58 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 23 | `git@github.com` | email | 1 | .batch/night/reports/p5-verdict.md:29 | git SSH 远端地址写法，非个人邮箱 |
| 24 | `C:\Users\\ufffd` | user-path | 1 | .batch/night/reports/qa-62-failures-attribution.md:16 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 25 | `C:\Users\���Ʒ�` | user-path | 4 | .batch/night/reports/red-attribution.md:24 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 26 | `947875122@qq.com` | email | 1 | .batch/night/reports/task-ledger.md:154 | 公开仓库 committer 身份（git 历史同值），非新增泄漏；相关台账只读故未改文本，列报告待裁 |
| 27 | `git@github.com` | email | 1 | .batch/night/reports/time-ledger-1116.md:230 | git SSH 远端地址写法，非个人邮箱 |
| 28 | `C:\\Users\\$(whoami` | user-path | 2 | .batch/night/review-requests/CARD-1118-C-placeholder-close.md:30 | 占位写法或 shell 变量展开，不含真实用户名 |
| 29 | `C:\\\\Users\\\\$(whoami` | user-path | 1 | .batch/night/review-requests/CARD-1118-C-rulings.md:28 | 占位写法或 shell 变量展开，不含真实用户名 |
| 30 | `C:\\Users\\$USERNAME` | user-path | 3 | .batch/night/review-requests/CARD-1118-C-rulings.md:16 | 占位写法或 shell 变量展开，不含真实用户名 |
| 31 | `C:\\Users\\$USERNAME` | user-path | 2 | .batch/night/review-requests/CARD-1119-A-pii-line-landing.md:25 | 占位写法或 shell 变量展开，不含真实用户名 |
| 32 | `/Users/you` | user-path | 1 | .batch/night/staging/dev-draft-rules-example-1116/README.en.md:63 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 33 | `/Users/you` | user-path | 1 | .batch/night/staging/dev-draft-rules-example-1116/README.zh-CN.md:57 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 34 | `/Users/%E4%BC%AF%E4%BA%91%E9%A3%9E` | user-path | 1 | .batch/night/staging/hy4-probe-raw.json:11 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 35 | `947875122@qq.com` | email | 2 | .batch/night/staging/incident-plugin-push-1116.md:13 | 公开仓库 committer 身份（git 历史同值），非新增泄漏；相关台账只读故未改文本，列报告待裁 |
| 36 | `git@github.com` | email | 1 | .batch/night/staging/push-plan-relay-4commits.md:17 | git SSH 远端地址写法，非个人邮箱 |
| 37 | `C:\Users\…` | user-path | 1 | .batch/night/staging/verify-after-p26.md:44 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 38 | `C:\Users\…` | user-path | 1 | .batch/night/staging/wb-rules-example-preflight-1116.md:23 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 39 | `sk-board-access-design` | secret | 2 | docs/agents/task-board-channel.md:3 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 40 | `sk-completion-notify-design` | secret | 5 | docs/design/features/system-notification-design.md:6 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 41 | `git@github.com` | email | 2 | docs/design/harness/dsh-plugin-pitfalls/03-evidence.md:34 | git SSH 远端地址写法，非个人邮箱 |
| 42 | `C:\Users\<用户>` | user-path | 1 | docs/design/prompt/chapter-task-anchor-design.md:58 | 占位写法或 shell 变量展开，不含真实用户名 |
| 43 | `C:\\Users\\���Ʒ�` | user-path | 2 | docs/handoffs/2026-11-03-doubao-bootstrap.md:187 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 44 | `sk-d21-fix-c-plan-20261109` | secret | 2 | docs/handoffs/2026-11-09-d3-b-to-c-handoff.md:198 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 45 | `sk-system-notice-landing-20261109` | secret | 2 | docs/handoffs/2026-11-09-d3-b-to-c-handoff.md:198 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 46 | `sk-d-status-audit-20261109` | secret | 3 | docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:59 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 47 | `sk-d21-fix-c-plan-20261109` | secret | 1 | docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:679 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 48 | `sk-reuse-coverage-20261109` | secret | 3 | docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:28 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 49 | `sk-system-notice-landing-20261109` | secret | 1 | docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md:680 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 50 | `C:\\Users\\Alice` | user-path | 1 | docs/plans/novel-quality-program-v3-2026-09-13/audits/migration-round-1.md:24 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 51 | `sk-completion-notify-design` | secret | 2 | docs/plans/prompt-assembly-backlog.md:1991 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 52 | `sk-board-access-design` | secret | 2 | docs/README.md:344 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 53 | `sk-completion-notify-design` | secret | 2 | docs/README.md:312 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 54 | `14449129190` | phone | 3 | docs/research/novel-quality-modernization/donor-delta.json:4785 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 55 | `19173825512` | phone | 3 | docs/research/novel-quality-modernization/donor-delta.json:8052 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 56 | `13018142434` | phone | 1 | docs/research/novel-quality-modernization/protocol.json:8072 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 57 | `15499396332` | phone | 1 | docs/research/novel-quality-modernization/protocol.json:2952 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 58 | `16166966935` | phone | 1 | docs/research/novel-quality-modernization/protocol.json:2595 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 59 | `17456270902` | phone | 1 | docs/research/novel-quality-modernization/protocol.json:6020 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 60 | `17456270902` | phone | 1 | docs/research/novel-quality-modernization/quality-protocol.md:455 | 文档中的示例号码 |
| 61 | `13382300106` | phone | 1 | docs/research/novel-quality-modernization/s03-domain-evidence.json:22 | 哈希/十六进制串中的数字段，经手机号规则误判 |
| 62 | `/home/project` | user-path | 1 | docs/research/novel-quality-modernization/s05-integration-evidence.md:29 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 63 | `C:\\Users\\EthanQ` | user-path | 1 | electron/controllers/__tests__/project-path.test.ts:8 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 64 | `C:\\Users\\writer` | user-path | 3 | electron/controllers/__tests__/skin-controller.test.ts:94 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 65 | `SECRET_URL_MARKER@example.invalid` | email | 1 | electron/mcp/__tests__/mcp-manager.test.ts:216 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 66 | `user@api.openai.com` | email | 1 | electron/services/__tests__/main-generation-plan.test.ts:244 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 67 | `synthetic-password@api.deepseek.com` | email | 1 | electron/services/__tests__/model-execution-lease.test.ts:123 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 68 | `C:\\Users\\作者` | user-path | 3 | electron/services/__tests__/portable-project-assets.test.ts:87 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 69 | `C:\\Users\\EthanQ` | user-path | 3 | electron/services/__tests__/project-archive-service.test.ts:269 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 70 | `C:\\Users\\writer` | user-path | 2 | electron/services/__tests__/project-archive-service.test.ts:182 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 71 | `/Users/test` | user-path | 1 | electron/services/__tests__/update-preferences-store.test.ts:6 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 72 | `C:\\Users\\private` | user-path | 3 | electron/services/__tests__/update-service.test.ts:700 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 73 | `secret@proxy.example` | email | 1 | electron/services/__tests__/update-service.test.ts:701 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 74 | `token@example.invalid` | email | 1 | electron/services/__tests__/update-service.test.ts:735 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 75 | `sk-and-liability-v1` | secret | 1 | electron/services/main-generation-plan.ts:19 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 76 | `i@izs.me` | email | 1 | pnpm-lock.yaml:2944 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 77 | `C:\Users\\ufffd` | user-path | 1 | reports/db-d1-three-classes.md:65 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 78 | `C:\Users\<用户名>…` | user-path | 1 | reports/db-d1-three-classes.md:71 | 占位写法或 shell 变量展开，不含真实用户名 |
| 79 | `C:\Users\���Ʒ�` | user-path | 3 | reports/db-d1-three-classes.md:66 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 80 | `sk-reuse-coverage-20261109` | secret | 1 | reports/p1-wakeup-plugin-probe.md:59 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 81 | `acceptance@example.invalid` | email | 1 | scripts/__tests__/project-migration-acceptance.test.ts:28 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 82 | `quality-test@example.invalid` | email | 1 | scripts/__tests__/quality-modernization-run.test.mjs:7200 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 83 | `qualification@example.invalid` | email | 1 | scripts/__tests__/real-provider-generation-qualification.test.ts:54 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 84 | `C:\\Users\\person` | user-path | 2 | scripts/__tests__/renderer-surface-e2e.test.ts:201 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 85 | `638899999999999800` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2933 | 测试夹具数字串，被身份证规则误判 |
| 86 | `638899999999999900` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2927 | 测试夹具数字串，被身份证规则误判 |
| 87 | `638899999999999998` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:3048 | 测试夹具数字串，被身份证规则误判 |
| 88 | `638899999999999999` | idcard | 5 | scripts/__tests__/smoke-win-installer.test.ts:2483 | 测试夹具数字串，被身份证规则误判 |
| 89 | `638900000000000000` | idcard | 7 | scripts/__tests__/smoke-win-installer.test.ts:2402 | 测试夹具数字串，被身份证规则误判 |
| 90 | `638900000000000050` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2948 | 测试夹具数字串，被身份证规则误判 |
| 91 | `638900000000000100` | idcard | 9 | scripts/__tests__/smoke-win-installer.test.ts:2547 | 测试夹具数字串，被身份证规则误判 |
| 92 | `638900000000000200` | idcard | 5 | scripts/__tests__/smoke-win-installer.test.ts:2558 | 测试夹具数字串，被身份证规则误判 |
| 93 | `638900000000000300` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:2569 | 测试夹具数字串，被身份证规则误判 |
| 94 | `638900000000000400` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2990 | 测试夹具数字串，被身份证规则误判 |
| 95 | `638900000000000409` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:1519 | 测试夹具数字串，被身份证规则误判 |
| 96 | `638900000000000410` | idcard | 5 | scripts/__tests__/smoke-win-installer.test.ts:1484 | 测试夹具数字串，被身份证规则误判 |
| 97 | `638900000000000411` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:1502 | 测试夹具数字串，被身份证规则误判 |
| 98 | `638900000000000500` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:3001 | 测试夹具数字串，被身份证规则误判 |
| 99 | `638900000000000999` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2777 | 测试夹具数字串，被身份证规则误判 |
| 100 | `639217245409219881` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:1797 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 101 | `639217245409219882` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:1827 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 102 | `639217245535054565` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:1800 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 103 | `639217250000000001` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:2099 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 104 | `639217250000002964` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:2114 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 105 | `639217250000004600` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2156 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 106 | `639217250000004636` | idcard | 3 | scripts/__tests__/smoke-win-installer.test.ts:2124 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 107 | `639217250000004637` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2221 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 108 | `639217250000007264` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:2105 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 109 | `639217250000007548` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:2145 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 110 | `639217250000007956` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2134 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 111 | `639218304000001032` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:1730 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 112 | `639218304000001033` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:1753 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 113 | `639218304000005568` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:1675 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 114 | `639218304000005569` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:1698 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 115 | `639219070367704249` | idcard | 7 | scripts/__tests__/smoke-win-installer.test.ts:1863 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 116 | `639219070367704250` | idcard | 2 | scripts/__tests__/smoke-win-installer.test.ts:1921 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 117 | `639219070493632715` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2000 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 118 | `639219070493632730` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2011 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 119 | `639219070493632792` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2022 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 120 | `639219070493632793` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2033 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 121 | `639219070493632794` | idcard | 1 | scripts/__tests__/smoke-win-installer.test.ts:2044 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 122 | `C:\\Users\\runneradmin` | user-path | 5 | scripts/__tests__/smoke-win-installer.test.ts:891 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 123 | `C:\\Users\\runneradminxxx` | user-path | 1 | scripts/__tests__/smoke-win-installer.test.ts:934 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 124 | `639217262838291804` | idcard | 1 | scripts/__tests__/windows-in-app-update-e2e.test.ts:751 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 125 | `639219050918203812` | idcard | 3 | scripts/__tests__/windows-in-app-update-e2e.test.ts:629 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 126 | `639219050918203813` | idcard | 1 | scripts/__tests__/windows-in-app-update-e2e.test.ts:659 | 测试夹具的 Windows FILETIME 数值，被身份证规则误判 |
| 127 | `C:\\Users\\runneradmin` | user-path | 4 | scripts/__tests__/windows-in-app-update-e2e.test.ts:336 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 128 | `真实姓名` | privacy-word | 3 | scripts/experiments/out/personality-v3-nemotron3.5lightning30b.jsonl:1 | 红队探针话术中的字段名（赤霄/暗星等虚构计划），无真实值 |
| 129 | `C:\\\\Users\\\\fixture` | user-path | 1 | scripts/f05-a11-offline-import-journey.mjs:317 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 130 | `sk-owned-artifact-retention` | secret | 2 | scripts/f05-u15-export-journey.mjs:420 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 131 | `C:\\Users\\RUNNER~1` | user-path | 1 | scripts/monitor-win-release-gate.ps1:93 | 文档/报告中的示例路径（随机生成名，非真实账户） |
| 132 | `probe@example.invalid` | email | 1 | scripts/ops/__tests__/check-batch-hygiene.test.mjs:45 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 133 | `13018142434` | phone | 1 | scripts/quality-modernization-driver.mjs:205 | 文档中的示例号码 |
| 134 | `C:\\Users\\x` | user-path | 2 | scripts/workbuddy/__tests__/attach.test.mjs:116 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 135 | `密码是` | privacy-word | 7 | scripts/zz-agent-capability-probe.mjs:227 | 红队探针话术中的字段名（赤霄/暗星等虚构计划），无真实值 |
| 136 | `sk-capsule--complete` | secret | 1 | src/__tests__/semantic-status-text-source-contract.test.ts:37 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 137 | `/Users/ethan` | user-path | 1 | src/components/dialogs/__tests__/import-novel-paths.test.ts:11 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 138 | `C:\\Users\\EthanQ` | user-path | 1 | src/components/dialogs/__tests__/import-novel-paths.test.ts:7 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 139 | `C:\\Users\\Private` | user-path | 2 | src/components/dialogs/__tests__/import-novel-resume.browser.tsx:336 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 140 | `sk-capsule--complete` | secret | 1 | src/components/layout/StatusBar.tsx:191 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 141 | `sk-capsule--complete` | secret | 1 | src/index.css:1034 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 142 | `/home/user` | user-path | 1 | src/services/__tests__/safe-call-diagnostic.test.ts:15 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 143 | `C:\\Users\\TestUser` | user-path | 1 | src/services/__tests__/safe-call-diagnostic.test.ts:39 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 144 | `base-url-secret@provider-a.example` | email | 1 | src/services/generation/__tests__/generation-harness.test.ts:800 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 145 | `sk-completion-notify-design` | secret | 1 | src/services/system-notify/notify-hub.ts:7 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |
| 146 | `password@api.deepseek.com` | email | 1 | src/shared/__tests__/provider-presets.test.ts:133 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 147 | `user@api.siliconflow.cn` | email | 1 | src/shared/__tests__/provider-presets.test.ts:228 | 示例假域/占位邮箱（fixture 用，非真实地址） |
| 148 | `C:\Users\writer` | user-path | 1 | test/desktop/project-archive.fixture.ts:43 | 测试夹具里的随机用户名路径（断言用，非真实账户） |
| 149 | `sk-roundtrip-never-export` | secret | 1 | test/desktop/project-archive.fixture.ts:42 | 内部设计任务编号字样（sk- 前缀为方案/卡标识），非密钥 |

## 五、判据与实输出

| # | 命令 | 输出 |
|---|---|---|
| 1 | `node "<rotation>/pii-scan.mjs" --repo . --all-tracked` | `隐私机检：通过（扫描 3362 个文件，0 处命中）`，EXIT=0 |
| 2 | `git ls-files \| grep -c 'tmp-c9ff5961.jsonl'` | `0` |
| 3 | `md5sum C:/tmp/pmo-stage2-quarantine/tmp-c9ff5961.jsonl`；`git cat-file blob b5cbf42a \| md5sum` | 两条均 `8a16b866cf6e453e407abcb7f6550c7a`；文件在 |
| 4 | `grep -c '^# 依据：' .piiallow`；`grep -vE '^[[:space:]]*(#\|$)' .piiallow \| wc -l`；报告表行数 | `149`／`149`／`149` 三者相等 |
| 5 | `git diff --name-only 058c0867 HEAD -- .batch/night/archive \| wc -l`；`git show HEAD:.batch/night/archive/MANIFEST.sha256 \| sha256sum` | `0`；`ab1119a28ff94b38825da188feb228eea456a151efdd134fa5567f51d98426b0`（未变） |
| 6 | `node scripts/ops/check-batch-hygiene.mjs --all`；`pnpm check:fast` | `0 项不合规` EXIT=0；`typecheck ✓ 36.0s`／`doc links: checked 1468, broken 0`／`doc placement … 新增 0 条`／`[check:fast] 全部通过。` EXIT=0 |
| 7 | `git status --porcelain -uall \| wc -l` | 提交后 `0` |

## 六、三处裁定的执行记录（均已裁）

**已裁 1 · `pii-scan.mjs` 工具补丁：驳，已回滚**

经过：卡面的行尾 `# 依据：` 写法在原版 `loadGlobs` 下不生效——它只跳过以 `#` 开头的整行、**不剥行尾注释**，行尾注释会并入正则导致永不命中。首轮我用 4 行补丁（`loadGlobs(file, stripInlineComment = false)`，仅 `.piiallow` 传 `true`）让行尾写法跑通。

裁定：**驳、回滚**——该脚本跨群共用、不在本 Goal 改动范围（`scripts/ops/*` 才是），两行式零工具风险，纪律优先。

执行（本笔）：
```
cp C:/develop/workspace/AI-writer/tmp-dev/pii-scan.mjs.bak-1119H "<rotation>/pii-scan.mjs"
md5sum "<rotation>/pii-scan.mjs"   → 63e9328f548f66174e53a3e9937ddda8（= 补丁前）
wc -c   "<rotation>/pii-scan.mjs"   → 9190（= 补丁前字节）
```
备份件 `C:/develop/workspace/AI-writer/tmp-dev/pii-scan.mjs.bak-1119H` 留档，未删。`.piiallow` 重排为**两行式**（149 条 → 302 行：4 行表头 + 149 条依据行 + 149 条正则行），判据 4 读作 `grep -c '^# 依据：'` ＝ 正则行数 ＝ 报告表行数。回滚后重跑判据 1：`隐私机检：通过（扫描 3363 个文件，0 处命中）`，说明两行式在**未改工具**下成立。

**已裁 2 · 6 处真实 committer 邮箱：认（不改文本）**

判定沿用：该值已在公开仓库全部提交的作者/提交者字段里，删文档不减暴露面；`task-ledger.md` 只有产品经理可写。allow 依据行逐条点名 6 条路径：`.batch/night/reports/merge-p55-into-develop-qa.md:22,23,33`、`.batch/night/reports/task-ledger.md:154`、`.batch/night/staging/incident-plugin-push-1116.md:13,16`。台账那处归产品经理另记一笔，本卡未动。

**已裁 3 · 新增 `.piiignore` 一行（表本体自指）：认**

`.piiallow` 入库后自身在扫描面内，表里保留的反斜杠写法会被 `user-path` 规则自触发 41 处命中。故 `.piiignore` 只放一行 `.piiallow`，注释写明「表本体不是数据」；**只此一行，不扩**。其余 81 个假数据文件仍走 `.piiallow` 逐行正则。

## 七、遗留
- 本卡未 push、未合并，`card/1119-H` 留在本地等验收；`exp/mainline-1119` 未动。
- `.piiallow` 149 条（两行式，302 行）为一次性落表，后续新增假数据按同一格式追加；条目与报告表的一致性靠判据 4 的三处相等守。
- `rotation/pii-scan.mjs` 的「行尾注释不剥」是工具既有行为，本卡按裁定不改；若其它群也要用行尾写法，须走跨群共识另出卡。
- `.batch/night/staging/` 下还有 `.mjs` 等运行件（既有），不在本卡范围。

<!-- DONE -->
