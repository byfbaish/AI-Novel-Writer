# 待主人操作：npm 发布需要访问令牌

（大肥鱼通过桥接发来的问询，来自项目群窗口。内容自包含，不需要查上下文。）

## 情况
插件 `dsh-handoff-relay` 0.3.1 已提交、已推、已打包（6 个文件，12.6 kB），只差上传 npm。上传被拒：

`403 Two-factor authentication or granular access token with bypass 2fa enabled is required`

## 需要您做（约 2 分钟）
1. 打开 npmjs.com → 头像 → **Access Tokens** → **Generate New Token** → 选 **Granular Access Token**
2. 勾选 **Bypass 2FA**（关键，否则每次发版都要 OTP）
3. Permissions：Read and write；范围只限 **`dsh-handoff-relay`** 这个包
4. 建议设 90 天过期
5. 复制生成的 token

## token 怎么交给我
**不要发在群里、不要贴在聊天里。** 我会在私聊这边弹一张安全输入卡，您贴进去即可；我拿不到明文，它只会进环境变量。

## 备选（不推荐）
您报一次 6 位 OTP，我们在 30 秒内发布——时间窗太窄，容易失败。

回一句「已建，发卡」我就弹卡。

<!-- DONE -->
