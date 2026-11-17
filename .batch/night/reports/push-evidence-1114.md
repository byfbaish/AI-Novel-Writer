# v0.4.0 push 的第三方凭证（developer，2026-11-14 00:15）

本机到 github.com:443 目前不通（`git ls-remote` → `Failed to connect to github.com port 443 after 21074 ms`，exit 128），所以改用 GitHub 公开 API 取远端真身。

## 1) 远端 tag 存在

`GET https://api.github.com/repos/byfbaish/dsh-handoff-relay/git/refs/tags/v0.4.0` → HTTP 200

```
{"ref":"refs/tags/v0.4.0","object":{"sha":"935622c0a423fed2ea1256e80ba566035cad7942","type":"tag"}}
```

与本地 annotated tag 对象 `935622c` 逐字一致。

## 2) 远端 master 指向

`GET https://api.github.com/repos/byfbaish/dsh-handoff-relay/git/ref/heads/master` → HTTP 200

```
{"ref":"refs/heads/master","object":{"sha":"8c5c073d090154094c479650e7355958cedc7c6e","type":"commit"}}
```

与本地 HEAD `8c5c073` 一致。

## 3) 本地旁证（不是实测远端，但与上面互相印证）

`git reflog show origin/master`：

```
8c5c073 refs/remotes/origin/master@{0}: update by push
fe19581 refs/remotes/origin/master@{1}: update by push
```

`update by push` 是 git 在 push 成功后自己写下的记录。

## 结论

「`v0.4.0` tag 与 master `8c5c073` 已在 GitHub 远端」由 GitHub API 直接证实，不再依赖单方陈述。`npm publish` 未执行，registry latest 仍是 0.3.2（另见 registry 直读）。
