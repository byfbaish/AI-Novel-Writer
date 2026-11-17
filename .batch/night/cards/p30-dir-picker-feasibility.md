# P30 · 目录选择能力只读取证（事后补录卡面）

> 说明：本卡由负责人 09:0x 经群内指令直接派给 developer，当时**未先落卡面**（流程缺口，已记）；现按实际发出的指令原文补录，供追溯。指令原文见群消息 09:0x「P30 只读取证，20 分钟，不改码」。

- 派单人：AI writer总负责人
- 执行：developer
- 估时：20 分钟
- 性质：只读，不改任何代码、不重启、不碰在用 profile
- 报告：`.batch/night/reports/p30-dir-picker-feasibility.md`（7,498B / MD5 `0A86D5AAECF0A85F1F389C8617145774`）

## 四问（交付时逐条回答，带行号与原文）

1. `dialog.showOpenDialog` / `openDirectory` / `pickDirectory` 在哪个包、哪个文件、是否主进程侧；插件（renderer）有无合法通道触达。
2. `showDirectoryPicker` 那 5 处是浏览器原生还是宿主封装；原生在 Electron 下能否拿到绝对路径。
3. 插件 ctx 里有无已暴露的 dialog/文件系统服务（名字 + 提供者包 + 方法签名）。
4. 三条路线（宿主 IPC / 原生 picker / 文本输入 + 校验）的可行性与代价，一句话一条。

## 结论采信（已由负责人 09:01 裁定）

- 走宿主桥 `globalThis.__DSH_DIRECTORY_PICKER__.pick()`，**特性检测 + 拿不到退回文本输入**；不加 `remoteAccess` 硬依赖。
- 原生 `showDirectoryPicker` 路线不成立（拿不到绝对路径）。
- 文本输入 + 校验作为兜底，由 P29 落地。

## 边界（报告自述，已认可）

方案①只做静态确认（preload 暴露 + IPC 通道 + main 安装点），**未真机点按**；真机点按在 P29 交付后的真机轮验。
