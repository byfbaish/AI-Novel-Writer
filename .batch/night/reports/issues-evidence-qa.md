# issue 结案依据 · QA 核验（P39 之后一件事，不属任何卡）

- 清单来源：`.batch\night\reports\issues-closeout-1116.md`（2,822B / 19:58:40，大肥鱼出）
- 我的任务：只核「#1/#2/#5 的结案依据在仓库里是否真实存在」，不下 close 结论、不动线上
- 核验仓库：`C:\develop\workspace\dsh-handoff-relay`，HEAD `8e4ad64`（P39 之后）
- 结论：**三条依据全部在盘/在仓库，未发现不实引用**；其中 #1 的一处表述需精确化（见下）

## #1 0.4.0 启动即崩（读未声明服务）

| 引用 | 实际情况 | 判 |
|---|---|---|
| 提交 `2ea6b53` | `feat: mount the settings card through ctx.inject so provider order does not matter`（存在） | ✅ |
| 提交 `74f4cc1` | `fix: bind the settings card through configForms instead of hard-injecting settingsScope`（存在） | ✅ |
| `index.js:862` | 原文 `* 取不到就整段跳过，绝不触碰 ctx.settings 属性。`（注释，行号命中） | ✅ |
| 「不读未声明服务」 | `Select-String -Path index.js,client.js -Pattern 'ctx\.settings'` → **0 命中**（仅注释里出现该串）；`index.js:12 export const inject = ['agents'];`；settings 走 `index.js:865 const settings = getService(ctx, 'settings');`，`getService` 实现为 `try { return ctx.get(name) } catch { return undefined }`（`index.js` 内），即可选读 + 降级 | ✅ |

- 需精确化：`index.js:862` 是**注释**，不是可执行断言；真正支撑「不碰 ctx.settings」的是上面 grep 0 命中 + `getService` 的 `ctx.get` 读法。close 评论里若写「由 `index.js:862` 实现」，应改成「注释与实现一致：`:862` 注释 + `getService` 走 `ctx.get`」。
- 真机部分（无新 crash、两次重启 8/8）我未复验，属负责人/大肥鱼口径，不在本条。

## #2 web boot 1 entry did not activate（inject 硬编码旧服务名）

| 引用 | 实际情况 | 判 |
|---|---|---|
| `client.js:21` | `const inject = ["slots", "sessions"];`（已无 `settingsScope`） | ✅ |
| `client.js:142` | `return typeof ctx.get === "function" ? ctx.get(name) : undefined;`（`readService` 兜底） | ✅ |
| `client.js:211` | `access = ctx && typeof ctx.get === "function" ? ctx.get("remoteAccess") : undefined;` | ✅ |
| 提交 `beb0af2` | `fix: inject sessions service for settings session picker`（存在） | ✅ |
| 遗留引用 | `client.js:638 const legacy = forms ?? readService(ctx, "settingsScope");` —— 是 **`readService`（`ctx.get`）兜底读**，不是 inject 声明，符合 P17 口径，**不算未修** | ✅（附注） |

## #5 真实路径加载时 schemastery ERR_MODULE_NOT_FOUND

| 引用 | 实际情况 | 判 |
|---|---|---|
| 提交 `26ba94c` | `fix: resolve schemastery from the host profile root`（存在） | ✅ |
| 提交 `bb8ee91` | `fix: load schemastery through ESM import with top-level await`（存在） | ✅ |
| `index.js:99-107` | `:99` 注释「用 createRequire(<profile>/package.json) 显式换基线」；`:104 async function loadSchemasteryAsync(rootDir = profileRootDir())`；`:105 const baseFile = path.join(rootDir, 'package.json');`；`:107 const req = createRequire(baseFile);`；`:109 const mod = await import(pathToFileURL(resolvedPath).href);` | ✅ |
| 真机 | `configUndefined=false` / `cfgType=object` 见 P28a 报告（我 08:50 首验过，非本次复验） | 记录 |

## 附：我自己踩到的取证限制

- 匿名 GitHub API 被限流：`GET /repos/byfbaish/dsh-handoff-relay/issues` → 403；`/rate_limit` 显示 60/小时已用尽、reset 20:26:46。改用 `Invoke-WebRequest` 读 issue 列表 HTML 成功，读到 **#1–#5 全 Open**，标题与草稿一致。
- 本机无 `gh`；仓库无 token ⇒ 我只能读，不能 close，与清单 §执行前提一致。

## 不做的事

- 不判断该不该 close（大肥鱼名单 + 负责人终审 + 主人点头）。
- 不代写关闭评论。
- 不复验真机读数（未重启前不可得）。
