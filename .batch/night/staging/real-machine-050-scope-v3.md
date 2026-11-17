# P33 之后的真机范围收窄（10:29，项目管家定，报负责人确认）

## 为什么收窄
P33（`.batch/night/reports/p33-target-resolve.md`，11,855B / `BB36535E…`）已证：
- `agents.get(id)` 要的是 **agent id**，与 session id 同值 `session-<uuid>`，我们的配置没错；
- 解析只看**活着的会话**（`dsh-agent/lib/index.js:441` store / `:725` get / `:752` roots 过滤 live），目标没在宿主里打开就必然 not-found；
- **标题解析同样只遍历 `roots()`** ⇒ id→标题迁移不解决「目标没打开」这个根本问题，只解决「id 写旧」。

## 本轮真机（等主人回话）只验两件
1. P29：设置卡里「选择目录…」按钮是否渲染、点选后 `dir` 是否填入；改不存在路径后重开卡是否变红点；多会话下 `sessionMap` 首 key 的语义（QA 指出的假红/假绿）。
2. P31：放探针到 watch 目录 → 投出且不重复唤醒；同字节同 mtime 复制件 → 去重跳过 + `relay.log` 有跳过 info；重启后新文件仍投、旧文件不重投。

## 挪出本轮的项
- 7 条 watch 的 id→标题迁移：仍要改生产 yml，一次只动一个变量，单独一轮；迁移脚本 `.batch/night/staging/watch-binding-migration.md`（3,952B / `265FBABC…`）保留不动。
- `undelivered.json` 记账（负责人 10:28 拍板：留原地 + 记账 + 一条 warn，不做 `agents.resume`、不改投常驻通道）：等排卡，不在本轮。

## 验收要点（不变）
- 判通道死活只看 `delivered\<dirKey>\`，不看 `relay.log`（成功不写日志行）。
- 回滚三行照脚本 §6，回显须 `F895C286F1B6E40938FD0E94EAF8B434`。

## 迁移段标记（10:30，负责人定）

本轮真机脚本 `reports/real-machine-050-script.md` 的「迁移」一段（§0.2 / M1-M3 那部分）**本轮跳过，不删**，留给下一轮。真机执行以本文件为准，执行者看到脚本里的迁移步骤直接略过，并在报告里记一行「迁移：本轮按 scope-v3 跳过」。
理由：迁移只解决「配置里 id 写旧」，P33 已证它解决不了「目标不在线」；not-found 处置下一轮才落地，同一轮换两个变量会分不清归因。
