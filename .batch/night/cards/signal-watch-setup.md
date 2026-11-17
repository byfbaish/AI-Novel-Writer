# 卡：给两个执行方挂「交付信号」watch（配置层，零改码）

## 要解决的问题

产物落盘不产生任何信号：执行方（WorkBuddy / 豆包）干完活，联络人那一侧的会话不会被叫醒，只能靠人再去查。已经因此漏报过一次（README 改写 04:26:50 落盘，联络人 21 分钟后才看见）。

用已有的 `dsh-handoff-relay` 解决，**不改代码**，只加两条 watch 配置。

## 要做的事

1. 建两个目录（已存在就跳过）：
   - `C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy`
   - `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao`
   每个目录里放一个 `.gitkeep`（空文件），确保目录被保留。
2. 编辑 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`，在现有 `watches:` 列表末尾（`stableMs: 5000` 之前，即现 L299 之后）**追加两条**，不要动已有三条（现 L293-300：`watches:` 起 L293，三条 dir 在 L294/296/298，`stableMs: 5000` 在 L300；现有三条指向 `wakeup-inbox`、`wakeup-inbox\workbuddy`、`wakeup-inbox\doubao`）：
   ```yaml
     - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy'
       targetSessionId: 'session-33494f59-babb-4168-af13-3b2fd525e7d0'
     - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao'
       targetSessionId: 'session-4380d607-48ec-47f4-a0b5-e086e856b377'
   ```
   不写 `done:`（走默认 `<!-- DONE -->` 判据）；`stableMs: 5000` 保持全局不动。
3. 写回时用 **UTF8 无 BOM**（现有文件首字节是 `23 20 59`，不要变成 `EF BB BF 23`）。改前先备份 `cordis.patch.yml.bak-<HHMM>`。自查首字节：`([System.IO.File]::ReadAllBytes($p)[0..2] | ForEach-Object { $_.ToString('X2') }) -join ' '`。
4. 改配置会热重载，**不要重启 DSH**。
5. 端到端验一条线（只验 workbuddy 那条，别去打扰正在干活的豆包）：
   - 向 `.batch\night\signals\workbuddy\` 写入 `probe-signal-channel.md`，内容：
     ```md
     card: probe-signal-channel
     note: 通道测试，收到无需回复
     <!-- DONE -->
     ```
   - 等 10 秒，看 workbuddy联络人 的会话是否被叫醒（它会自己报收到）。
   - 把探针文件删掉（插件不删源文件）。

## 禁忌

- 不许改 `index.js`、`index.test.mjs`、两份 README、`package.json`。
- 不许重启 DSH、不许动 `~/.dsh/settings.yaml`。
- 不许往 `scripts\dsh\wakeup-inbox` 丢文件。
- 不许动已有四条 watch 的 `dir` / `targetSessionId`。

## 产物

`.batch/night/reports/signal-watch-setup.md`，末尾 `<!-- DONE -->`：
- 追加后的 `watches:` 整段（贴原文，含行号）
- 备份文件名
- 首字节十六进制（证明无 BOM）
- 探针落盘时间、唤醒发生时间（若联络人在群里报了就写它报的时间）
- 探针删除后的 `Get-ChildItem` 空目录输出

## 判定线

1. `cordis.patch.yml` 中 `watches:` 由 3 条变 5 条，新增两条的 `dir` 与 `targetSessionId` 与上文逐字一致，已有 3 条字节未变（L293-300 那段除插入两行外逐字保持）。
2. 文件仍为 UTF8 无 BOM。
3. workbuddy 信号目录的探针在 5 秒稳定后被投递、联络人会话被唤醒，且提示内容与文件首行一致。
4. DSH 未重启（GUI 端口不变）。
