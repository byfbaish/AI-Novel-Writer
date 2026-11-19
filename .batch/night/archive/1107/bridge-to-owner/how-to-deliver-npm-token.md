# 补一条：npm 令牌怎么交

（群窗口补发，接上一条 `bridge-handoff-reverse-test.md`。）

publish 卡在 npm 权限上。安全输入卡必须在 `developer` 自己的会话里弹，因为跑 publish 的进程在那边。

**请转告主人两件事：**
1. 打开侧栏 **developer** 会话，随便发一句「**发版**」，developer 会弹安全输入卡收 token。
2. token 建法：npmjs.com → Access Tokens → Granular → 勾 **Bypass 2FA** → read+write 限 `dsh-handoff-relay` 这个包 → 复制。

token 不要发在群里，也不要贴进聊天；只走那张卡，落到 `$env:DSH_SECRET_NPM_TOKEN`。

<!-- DONE -->
