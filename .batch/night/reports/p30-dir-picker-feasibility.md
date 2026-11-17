# P30 · 宿主「选目录」能力可达性取证（只读）

> 目的：判断插件能否用宿主/系统的目录选择器，还是要停在「文本输入 + 校验」。
> 只读：未改任何文件、未重启、未碰在用 profile。全部证据来自 `C:\develop\software\DeepSeekHarness\resources\app.asar`（静态）与仓库现码。
> 工具：`.batch/night/tools/asar-find.py`（把命中映射到真正包含它的条目）、`asar-ls.py --extract`。

## 1. 那几处 dialog / picker 到底在哪

| 调用 | 位置 | 进程侧 | 是什么 |
|---|---|---|---|
| `dialog.showOpenDialog` | `lib/main.js:13525` | **Electron 主进程** | 唯一一处真实系统对话框 |
| `openDirectory`（6 处） | `lib/main.js:13525` 的 `properties:["openDirectory","createDirectory"]`；`dsh-client-ui-workspace/lib/client.js:2815/2824/2829/2852/2890` | 主进程 + 渲染层 | 后 5 处只是 React 回调名 `openDirectoryFlow`，**不是**系统对话框 |
| `pickDirectory`（3 处） | `dsh-client-ui-workspace/lib/client.js:1562`；`dsh-client-ui-directory-picker-native/lib/client.js:69`；`dsh-cordis-client-runner/lib/client.js` | 渲染层 | 封装方法，最终转发到 `directoryPicker.pick()` |
| `showDirectoryPicker`（5 处） | `dsh-experimental-inspector/lib/devtools/entrypoints/lighthouse_worker/lighthouse_worker.js`（4）、`.../chunks/text_editor-CJ8jczCk.js`（1） | DevTools 内部 | **浏览器原生 API，只在 DevTools 的 Lighthouse 里出现**，与宿主能力无关；且原生 `FileSystemDirectoryHandle` 在 Electron 下不提供绝对路径 |

主进程侧原文（`lib/main.js`）：

```
13514: function installDesktopDirectoryPicker(getWindow) {
13516:   ipcMain.handle(DESKTOP_IPC.directoryPick, async (event) => {
13525:     const result = dialog.showOpenDialog(window, { properties: ["openDirectory", "createDirectory"] })
                   .then(({ canceled, filePaths }) => window.isDestroyed() || canceled ? null : filePaths[0] ?? null)
13527:     pending.set(window, result);
20627: installDesktopDirectoryPicker(() => mainWindow);
```

通道名：`DESKTOP_IPC.directoryPick = "dsh-desktop:directory-pick"`（`lib/main.js:1458`、`lib/preload-app.cjs:4-...` 同名常量）。

**它已经被暴露给渲染层了**（`lib/preload-app.cjs:1961`）：

```
electron.contextBridge.exposeInMainWorld("__DSH_DIRECTORY_PICKER__", {
  pick: () => electron.ipcRenderer.invoke(DESKTOP_IPC.directoryPick)
});
```

即：不需要碰 IPC 白名单，桌面壳已经把这条能力挂在 `globalThis.__DSH_DIRECTORY_PICKER__.pick()` 上，返回**绝对路径或 `null`（取消）**。

## 2. `showDirectoryPicker` 是不是宿主封装

不是。全部 5 处都在 DevTools 的 Lighthouse 与 text-editor 分块里，是 Chromium 原生 API 的内部使用。Electron 的 `FileSystemDirectoryHandle` 不暴露 `.path`，所以「原生 picker 拿绝对路径」这条路在桌面端不成立——真要用原生 API 必须走 Electron 的 `dialog`（即上面那条桥）。

## 3. 宿主侧的正式能力：`ctx.directoryPicker`（capability seam）

- 抽象服务：`dsh-host-directory-picker/lib/types/index.js:37-41`，`class DirectoryPicker extends Service`、`super(ctx,'directoryPicker')`、子类实现 `capability()`；失败类型 `DirectoryPickerError`（`:15-29`）。
- native 实现：`dsh-host-directory-picker-native/lib/index.js:329-341`，
  `nativeCapability = { kind: "native", pick: (signal) => pickNativeDirectory(signal) }`，`capability()` 返回它。
  形状：`{ kind: 'native', pick(signal) → Promise<string|null> }`（Windows 用子进程 `IFileOpenDialog` + koffi，取消返回 `null`，缺平台工具则 reject）。
- 组合位置：`dsh-web-app/cordis.patch.yml:109-110`
  ```
  - id: directory-picker
    name: '@deepseek-ai/dsh-host-directory-picker-auto'
  ```
  即宿主在 boot 时按 bind host / SSH / display 自动选 native 或 browse；**本机是桌面端本地使用，解析为 native**。
- 遥控面：`dsh-api-workspace-controller/lib/index.js:471` `static inject = ["directoryPicker"]`、`:474` `super(ctx,"directoryPickerController",{namespace:"directoryPicker"})`、`:526` `this.ctx.directoryPicker.capability()`，对外三个 wire verb：`directoryPicker/pick`、`directoryPicker/list`、`directoryPicker/createDirectory`（`dsh-api-remotes/lib/client.js:25524-25574` 起）。
- 官方客户端消费者：`dsh-client-ui-directory-picker-native/lib/client.js:67-80`，
  `const desktop = globalThis.__DSH_DIRECTORY_PICKER__; const pick = desktop === void 0 ? () => ctx.uiWorkspace.pickDirectory() : () => desktop.pick();`，并用
  `ctx.remoteAccess.whenAccess("directoryPicker/pick", …)`（`:71`）把入口挂到 workspace 的两个槽位上。

## 4. 我们插件现在能用什么（按可用性排序）

| 通道 | 名字 / 写法 | 提供者 | 签名 | 备注 |
|---|---|---|---|---|
| ① 桌面壳桥 | `globalThis.__DSH_DIRECTORY_PICKER__.pick()` | `lib/preload-app.cjs:1961`（主进程 `lib/main.js:13516`） | `() => Promise<string \| null>` | **只要在桌面壳渲染层就有**；无 remote access 门禁；浏览器/远程访问时 `undefined`，须特性检测 |
| ② 官方遥控 verb | `ctx.remote.directoryPicker.pick(signal)`（需先 `ctx.remoteAccess.whenAccess("directoryPicker/pick", …)`） | `dsh-api-workspace-controller` + `dsh-api-remotes` | `(signal) => Promise<string \| null>` | 官方样板写法（native client `:71`）；需要 client `inject` 加 `remoteAccess`（硬依赖，缺服务会 pending，同 K21 风险） |
| ③ workspace 封装 | `ctx.uiWorkspace.pickDirectory()` | `dsh-client-ui-workspace/lib/client.js:1562` | `() => Promise<string>`（失败抛 `DirectoryBrowseError`） | 需要 `inject` 加 `uiWorkspace`（更重的依赖），内部还是走 ② |
| ④ 宿主进程侧 | `ctx.get('directoryPicker').capability().pick(signal)` | `dsh-host-directory-picker-native` / `-browse` | 同上 | 我们的 `index.js` 本来就在宿主进程里，技术可达；但会让「点界面弹宿主对话框」跨进程发生，且远程部署下 kind 可能是 `browse` |

## 5. 三条路线结论（一句话一条）

- **宿主 IPC（`__DSH_DIRECTORY_PICKER__`）：可行**。零新依赖、零 inject、直接拿绝对路径；代价是要特性检测（非桌面壳为 `undefined`），并接受「只有桌面端能用」。
- **原生 picker（官方 `directoryPicker/pick` 或宿主侧 capability）：可行**。是宿主正式能力、跨远端也成立（browse 后端时退化为应用内浏览）；代价是 client 必须新增 `remoteAccess`（或 `uiWorkspace`）硬依赖，装配期缺服务会 pending，得评估 K21 类风险。
- **只用文本输入 + 校验：可行且零风险**。与 P29 的目录校验/徽标天然配套，也是上面前两条都失败时的兜底。

## 6. 待证 / 边界

1. 上面 ① 的可行性是**静态确认**（preload 明确暴露），未在真机点击验证；一次真机点按即可闭环（点击后应弹系统目录框，取消返回 `null`）。
2. `dsh-web-app/cordis.patch.yml:109` 是 web-app bundle 的组合，桌面壳是否 100% 加载该 bundle 未逐行核对；但 `dsh-client-ui-workspace` 已在运行时加载（侧栏可用），其 `pickDirectory()` 依赖同一 `directoryPicker` 链，属强旁证。
3. 若将来支持远程浏览器访问，① 不存在（`globalThis` 无该桥），必须走 ②③ 或 browse 后端。

<!-- DONE -->
