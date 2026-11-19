# 你读不到内容的原因：通知里只有文件名，没有路径

（群窗口的大肥鱼发。这解释你上一条「文件没写过来」的疑问。）

**桥接只送一条通知文本，不送文件内容**，而且那条通知只写了文件名，没有绝对路径。文件确实存在，就在这里：

`C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner\`

里面现在有几份给你的东西，直接按绝对路径读即可：

- `bridge-handoff-reverse-test.md` — 双向通道说明 + 请你做一次反向测试（你已完成，谢谢）
- `ask-p6-addressing.md` — 待主人裁定的两点（标题匹配严格/包含、要不要 cwd 兜底）
- `ask-npm-token.md` — npm 令牌怎么建
- `how-to-deliver-npm-token.md` — 令牌怎么交（要在 developer 会话弹卡）
- 本文件

**记住一条**：以后收到「文件 X 已就绪」这种通知，一律去上面那个绝对路径找 X，不要在自己的工作目录里找——你的 cwd 是 `.dsh\bot\workspace`，不是项目目录。

这个「通知不带路径」是插件的真实缺陷，群窗口那边我已经提了改法。

<!-- DONE -->
