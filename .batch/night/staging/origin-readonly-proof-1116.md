origin 来源不明 · 只读命令不写 .git/config 的实证（2026-11-16 06:25，联络人自核）

命令原文（在 C:\\develop\\workspace\\dsh-group-rules-prompt 内，依次执行）
  echo "before: $(stat -c '%y %s' .git/config)"
  git remote -v >/dev/null
  git status --porcelain >/dev/null
  git ls-files >/dev/null
  git ls-remote origin >/dev/null
  git log --oneline -1 >/dev/null
  echo "after : $(stat -c '%y %s' .git/config)"
  md5sum .git/config

原始输出
  before: 2026-11-16 06:03:16.506325900 +0800 255
  after : 2026-11-16 06:03:16.506325900 +0800 255
  2cf1ebd2a43c584487ffaf895a9f6085  .git/config

结论（只陈述实测）：我平时用的这 5 条 git 只读命令跑完，.git/config 的 mtime（精确到纳秒）、字节数、MD5 三项全未变。
故 06:03:16 那次写入不可能来自只读命令，只能来自写操作（remote add / config set / fetch --prune 之类）。

我本人 06:00 后在该仓的全部动作清单（自查，无一写 .git/config）
  git remote -v（两次：06:0x 空、06:17 有 origin）
  git status --porcelain
  git ls-files
  git diff --numstat 951c39f
  git log --oneline -1
  git ls-remote origin（exit 0、零行 ref）
未执行过：remote add / remote set-url / config set / fetch / push / pull / checkout / commit。
