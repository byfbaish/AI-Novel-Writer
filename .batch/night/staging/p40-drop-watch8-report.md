# P40 · 删掉第 8 条 watch — 交办报告

- 卡号：P40（B 类 · 改 profile 配置）
- 执行人：developer
- 执行时刻：2026-11-14 19:24–19:27
- **未重启**（按卡面第 5 步；重启与 P39 合并到同一次，由主人执行）

## 1. 备份

改前文件：`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`
**11,233B / 343 行 / MD5 `312C828D0E8722F11B192B3C2D64BD62`**（`LastWriteTime` 18:15:00）

备份（带时刻，按卡面命名）：

```powershell
Copy-Item $f "$f.bak-p40-1924" -Force
```

- `cordis.patch.yml.bak-p40-1924` — **11,233B / MD5 `312C828D0E8722F11B192B3C2D64BD62`**，与改前逐字节相同
- 另有一份操作过程中建的 `cordis.patch.yml.bak-p40`（同字节、同 MD5），保留未删

## 2. 删除方式（只删六行，不重排不重格式化）

第一遍用 `Get-Content`/`WriteAllLines` 删，结果文件从 11,233B 变成 **11,348B**——字节数反而变大，原因是 `WriteAllLines` 把全文 LF 改成了 CRLF。**这一遍已用备份整体还原**，再改用「原文按字符串精确删除」：

```powershell
$raw = [IO.File]::ReadAllText($f)          # 原文 343 个 LF、0 个 CRLF
$idx = $raw.IndexOf($block)                # $block = 333-338 六行，用 "`n" 连接
$new = $raw.Remove($idx, $block.Length + 1)
[IO.File]::WriteAllText($f, $new, (New-Object System.Text.UTF8Encoding($false)))
```

- `$block` 六行：`      - dir: C:\Users\<用户名>\Downloads\tmp` / `        targetTitle: 只回复两个字：可用` / `        targetSessionId: session-6cc8ee6b-cfec-4679-bcbf-84a405608ff9` / `        exact: true` / `        done:` / `          text: 以上`
- 删除前确认 `IndexOf` 唯一命中（`block occurrences=1`），删的是块尾那个换行
- 改后：**11,011B / 337 行 / MD5 `6FD3E7A7DCF08370456FEA3D263DC42E`**；`crlf count` 仍 **0**（未混入 CRLF）

## 3. YAML 校验（命令原文 + exit code）

```powershell
python -c "import yaml,sys; d=yaml.safe_load(open(r'C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml',encoding='utf-8').read()); e=[x for x in d if isinstance(x,dict) and x.get('id')=='dsh-handoff-relay']; print('entries',len(d)); w=e[0]['config']['watches']; print('relay entries',len(e),'watches',len(w)); [print(' ',i+1,x['dir']) for i,x in enumerate(w)]"
```

输出（**exit=0**）：

```
entries 24
relay entries 1 watches 7
  1 C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox
  2 C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\workbuddy
  3 C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\doubao
  4 C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy
  5 C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao
  6 C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner
  7 C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-group
```

`watches` 条数 = **7**；`stableMs: 5000` 仍 1 处；顶层条目总数 24 未变。

## 4. 判据逐条

| 判据 | 命令原文 | 结果 |
|---|---|---|
| 删后搜不到 `Downloads\tmp` | `Select-String -Path $f -Pattern 'Downloads' -SimpleMatch` | **0 命中** |
| 删后搜不到 `只回复两个字：可用` | `Select-String -Path $f -Pattern '只回复两个字' -SimpleMatch` | **0 命中** |
| 连带 id 也清了 | `Select-String -Path $f -Pattern '6cc8ee6b' -SimpleMatch` | **0 命中** |
| 备份存在且 MD5 与改前一致 | `Get-FileHash -Algorithm MD5` | `312C828D0E8722F11B192B3C2D64BD62`，一致 |
| 其它 7 条 dir/targetSessionId 逐行一致 | `git diff --no-index -- bak-p40 现文件` | 见下，**只有 6 行删除** |
| `- dir:` 恰好 7 条 | `Select-String -Path $f -Pattern '^\s+- dir: '` | **7** |

diff 原文（`git diff --no-index -- "$f.bak-p40" "$f"`，exit=1 属 diff 有差异的正常返回）：

```diff
@@ -330,12 +330,6 @@
         exact: true
         done:
           text: <!-- DONE -->
-      - dir: C:\Users\<用户名>\Downloads\tmp
-        targetTitle: 只回复两个字：可用
-        targetSessionId: session-6cc8ee6b-cfec-4679-bcbf-84a405608ff9
-        exact: true
-        done:
-          text: 以上
     stableMs: 5000
 - id: bot
   disabled: false
```

`git diff --no-index --stat` 同证：`1 file changed, 6 deletions(-)`。

## 5. 生效条件 / 未做项

- **未重启**、未动 relay 插件代码、未改其它条目（卡面禁令全部遵守）
- 当前运行中进程内存里仍是 8 条 watch；`启动 7/7 个 watch` 要在那次合并重启后才会出现，不在本卡判
- 未写信号文件（卡面第 4 步只要报告；信号是否要发请负责人定）

<!-- DONE -->
