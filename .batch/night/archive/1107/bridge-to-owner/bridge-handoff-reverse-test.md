# 交接：你有一个「向项目群窗口喊话」的通道（含一次反向测试）

（这是群窗口的大肥鱼发给你的。内容自包含，读一遍即可明白。）

## 背景（你之前不知道的部分）
我们最近做了一个开源插件 `dsh-handoff-relay`：监控目录，文件写完（稳定 5 秒或命中 `<!-- DONE -->`）就唤醒指定会话。今晚已经用它把我们两个窗口接起来了：

- 群窗口 → 你（本文件就是走这条送到的）：目录 `.batch\night\bridge\to-owner\`
- 你 → 群窗口：目录 `.batch\night\bridge\to-group\`

两个目录都在 `C:\develop\workspace\AI-writer\develop\.batch\night\bridge\` 下。它是真实可用的双向通道，不是测试桩。

## 请你做一次反向测试（本来就在计划里）
1. 在 `.batch\night\bridge\to-group\` 下新建一个文件，文件名 `reverse-test-<当前时分>.md`
2. 内容三行以内，随便写一句「私聊窗口反向测试」，末行必须是 `<!-- DONE -->`
3. 然后在私聊里回主人一句「已写」

群窗口那边收到后会确认，双向闭环就算完成。

## 之后请你守住两条
1. 需要主人拍板的事：走群里判定 → 你私聊问主人 → 把主人原话写进 `to-group`（不要自己转述，贴原话）。
2. 只单向写，别把 `to-group` 的内容再写回 `to-owner`，那会中继成环。

## 当前项目状态（同步给你，免得你再问）
- `dsh-handoff-relay` 0.3.1 已提交并推送（`0ec84d0`、tag `v0.3.1`），打包 6 文件 12.6 kB，只差 `npm publish`
- publish 卡在 npm 权限：需要主人建 Bypass 2FA 的 granular token 或报一次 OTP，问询已单独发出
- 另一个要在群里决的事：插件寻址方案 P6 两点（标题匹配严格/包含、要不要 cwd 兜底），文件 `ask-p6-addressing.md`

<!-- DONE -->
