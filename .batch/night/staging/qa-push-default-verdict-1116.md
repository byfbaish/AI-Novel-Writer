# QA 判词：push.default 未设时裸 `git push` 的真实落点

- 出具：QA · AI writer项目组 | 57c8bd18
- 时间：2026-11-16 08:18 CST
- 触发：项目总负责人要求定夺「QA 说裸推会推上去」与「developer 实测 fatal」两个冲突结论

## 结论（先行）

**developer 的结论正确，我 08:09 那条判断错误，撤销。**

本机 `git 2.56.0.windows.4.niugit`，`push.default` 未设置（等价 `simple`）时，
在「`branch.master.remote=origin` + `branch.master.merge=refs/heads/main`」形状下，
裸 `git push` **直接失败 exit 128，不推送任何 ref**：

```
fatal: The upstream branch of your current branch does not match
the name of your current branch.  To push to the upstream branch
on the remote, use
    git push origin HEAD:main
```

隐患的真实形态应改述为：**该仓的裸推会被 git 拒绝，但报错信息本身就把「正确的越权命令」教给了操作者**
（`git push origin HEAD:main`）；真正能落地的路径只有三条——显式 `master:main`、`push.default=matching`、
或 `-c`/env 覆盖身份后自带 refspec 推。故技术债等级由「一敲就误发」下调为「误发需显式路径」。

## 实验（可复现）

- 脚本：`develop/.batch/night/tmp/qa-push-default-exp/run.sh`｜1,896B｜sha256 前 32 位 `403e2943e1e903fe0c56f9a076b6e8bb`
- 环境：临时目录内自建 bare 远端，不接触插件仓、不连网
- 情形 A 裸推（`push.default` 空）→ `exit=128`，远端 refs 未变（仅原 `refs/heads/main 3b3b5c6`）
- 情形 B 显式 `git push origin master:main` → `exit=0`，`3b3b5c6..dddeb34  master -> main`（越权成功）
- 情形 C `push.default=matching` 后裸推 → `exit=0`（推的是同名分支；本实验远端只有 main，故 up-to-date）

## 附带证据：推送第三方回读

```
$ git ls-remote origin refs/heads/exp/resource-ledger
69cd4a41cf5f89a813d09104bcf744959922dc7c	refs/heads/exp/resource-ledger   (exit 0)
$ git rev-parse HEAD
69cd4a41cf5f89a813d09104bcf744959922dc7c
```

远端与本地一致，developer 的推送回执**经第三方回读确认成立**。
另注：本地 `git reflog show origin/exp/resource-ledger` 首行为 `69cd4a41 …@{0}: update by push`，
`.git/refs/remotes/origin/exp/resource-ledger` mtime 08:14——即推送发生在负责人 08:15 转达指令之前，
但在主人 08:10 授权之后，不算越权，只需在台账里把时序记准。

## 我错在哪

我把「配置形状可疑」直接推成「任何人裸推都会静默发布」，没有先跑一遍验证就下断言。
同类错误与 07:45 那次「文件不存在」同源：**从形状推出行为**。此后凡涉及「命令会做什么」，一律先跑，再断言。

<!-- DONE -->
