起点 HEAD：87782339a5cb8d3c6786548f93d355b14a2dea35
提交 SHA：15e9d835a6c1816f42cb6eb2d16693790bacdfa5
父 SHA：87782339a5cb8d3c6786548f93d355b14a2dea35

# P45-fix · README 入口措辞改正

只改两处：`README.zh-CN.md:207` 删「最下方」并改为「页面里「包含的组件」一节」；`README.md:243` 把 `“Included components” at the bottom` 改为 `in the “Components” section`。其余一字未动。

## `git show --numstat --format='' 15e9d835a6c1816f42cb6eb2d16693790bacdfa5`

```text
1	1	README.md
1	1	README.zh-CN.md
```

## `git diff 8778233 15e9d835a6c1816f42cb6eb2d16693790bacdfa5 -- README.md README.zh-CN.md`

```diff
diff --git a/README.md b/README.md
index d1d710f..0a99be4 100644
--- a/README.md
+++ b/README.md
@@ -240,7 +240,7 @@ you can add or remove rows and bind directories and sessions directly.
 `watches` in `cordis.patch.yml` remains the single source of truth at runtime.
 
 The entry is buried: **Plugins → Installed → dsh-handoff-relay → open its
-README page → “Included components” at the bottom → click `Handoff Relay`**
+README page → in the “Components” section → click `Handoff Relay`**
 to open the settings page.
 
 - Each watch is one row: directory, target session (text input, checked for
diff --git a/README.zh-CN.md b/README.zh-CN.md
index 223bd23..ba49175 100644
--- a/README.zh-CN.md
+++ b/README.zh-CN.md
@@ -204,7 +204,7 @@ dsh --dump-config --profile desktop
 从 `0.5.0` 起可用：插件会在宿主的插件设置页里贡献一张卡片，可直接增删行、绑定目录与会话。
 运行期的唯一真相仍然是 `cordis.patch.yml` 里的 `watches`。
 
-卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面最下方「包含的组件」→ 点击 `Handoff Relay`** 即进入设置页。
+卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面里「包含的组件」一节 → 点击 `Handoff Relay`** 即进入设置页。
 
 - 每条 watch 一行：目录、目标会话（文本输入，保存前校验是否存在）、完成规则、`exact`。
 - 可以新增、编辑、删除行；保存时把整个 `watches` 数组写回 `cordis.patch.yml`，
```

## 状态

- 提交只含 `README.md`、`README.zh-CN.md`，未改代码、`package.json`、`cordis.patch.yml`。
- 未 push、未打 tag、未 publish。
- 本卡只改文档，未跑测试。
- porcelain 由接收方实测；本报告不写 WSL 侧 porcelain 结论。

<!-- DONE -->
