# P40 · 删掉第 8 条 watch（B 类 · 改 profile 配置）

- 卡号：P40
- 执行人：developer（只改配置，不改插件代码）
- 派卡时刻：2026-11-14 19:2x
- 估时：**10 分钟**（备份 + 删块 + YAML 校验 + 报告）。生效要等重启，重启与 P39 合并成一次，另约。
- 授权：可改 `C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml`。**禁改其它条目、禁重启 DSH、禁动 relay 插件代码。**

## 背景

主人 19:05 决定：删掉他自己加的第 8 条 watch（`Downloads\tmp` → 「只回复两个字：可用」）。它每次启动连报 `agent-not-found`，投不出东西，不能当证据；也不在设置卡渲染范围里，界面删不了。

## 要删的块（行号已核，**是 333–338 六行整块，不是 333–334**）

```
333:      - dir: C:\Users\<用户名>\Downloads\tmp
334:        targetTitle: 只回复两个字：可用
335:        targetSessionId: session-6cc8ee6b-cfec-4679-bcbf-84a405608ff9
336:        exact: true
337:        done:
338:          text: 以上
```

只删这六行。删完 `watches` 下剩 7 条，`stableMs: 5000` 与其它条目原样保留。

## 步骤

1. 备份：`cordis.patch.yml` → 同目录 `cordis.patch.yml.bak-p40-<HHmm>`（文件名带时刻），报备份文件字节数与 MD5。
2. 精确删除上述六行；不许重排、不许重格式化其它行。
3. YAML 解析校验（用哪个命令写的就贴原文命令与 exit code），报 `watches` 条数 = 7。
4. 报告落 `.batch/night/staging/p40-drop-watch8-report.md`，末行 `<!-- DONE -->`。
5. **不重启**：DSH 一关本群就没了，重启由主人执行，与 P39 合并到同一次。

## 判据

- 删后文件里搜不到 `Downloads\tmp` 与 `只回复两个字：可用`（贴搜索命令原文与空结果）。
- 备份文件存在且 MD5 与改前一致（贴读数）。
- 其它 7 条 watch 的 `dir` / `targetSessionId` 与改前逐行一致（贴 diff 结果）。
- 重启后启动行应为 `启动 7/7 个 watch`（这条由重启那次一并核，不在本卡判）。
