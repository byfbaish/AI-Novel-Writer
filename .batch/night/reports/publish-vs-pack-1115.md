执行方：AI writer总负责人
model=DeepSeek-V4.1 | 倍率=— | provider=—

# dsh-handoff-relay 发版方式对比：`npm publish` vs 打包（可执行、先不执行）

> 本文只做对比与预案，**不动仓库、不推、不打 tag、不发版**。任何一步执行前需主人点头；对外写动作（push / tag / publish）按团队规则先群里「我领这条」。

## 0. 结论先行

1. **现在直接 `npm publish` 会失败**：registry 上 `dsh-handoff-relay` 的 `latest` 已是 **0.5.0**（2026-11-14T14:55:07Z，对应提交 `15e9d83`），而本仓 `package.json` 版本仍是 `0.5.0` 未动 ⇒ 同版本不可重发，必须先 bump 到 **0.5.1**。
2. 两条路线不是二选一：**打包是本机/内网立即能用的最短路径，publish 是对外分发的正式路径**。当前工作区代码已通过「junction 直连仓库」在跑（`node_modules/dsh-handoff-relay` → 仓库），所以**即使不发版也不影响本机使用**。
3. 风险最低的顺序：**先打包验证 → 主人点头后一次推 4 笔 → bump 0.5.1 + tag + publish**。反过来（先 publish 再推代码）会留一段「registry 上有代码、GitHub 上查不到」的溯源空洞。

## 1. 现状（盘面实测，2026-11-15 19:2x）

| 项 | 值 |
|---|---|
| 仓库 HEAD | `51a87c5`（`fix: strip session- prefix from To id8 and keep To title segment non-empty`） |
| 工作区 | `git status --porcelain` = 0 行（干净） |
| 未推提交 | `fdf7b17`、`82dfbbe`、`40f34b5`、`f41b031`、`51a87c5` 中不在 `origin/master`（`origin/master` = `fdf7b17`），实际未推 4 笔：`82dfbbe`、`40f34b5`、`f41b031`、`51a87c5` |
| HEAD tag | 无（`git tag --points-at HEAD` = 0） |
| 已有 tag | `v0.3.0`、`v0.3.1`、`v0.3.2`、`v0.4.0`、`v0.5.0`（annotated） |
| `v0.5.0` 指向 | commit `15e9d83`（`docs: fix settings card entry wording`） |
| registry 现值 | `latest` = 0.5.0，`time.modified` = 2026-11-14T14:55:07.737Z |
| 已发布内容与 HEAD 的差 | `git diff --stat bc5aea1..51a87c5` = README.md +50 / index.js +230 / index.test.mjs +497（751 insertions, 26 deletions） |
| `package.json` version | `0.5.0`（**与 registry 同号，未 bump**） |
| `files` 白名单 | `index.js`、`client.js`、`cordis.patch.yml`、`README.md`、`README.zh-CN.md`、LICENSE（`index.test.mjs` 不入包） |
| 凭据 | 团队密钥 `NPM` 已存在，环境变量 `$DSH_SECRET_NPM`，全部 Bot 可用 |
| 打包实测（`npm pack --dry-run`） | 7 个文件、tarball 45.7 kB、解包 137.0 kB、shasum `3570feba84c4645f3190148e67a8b7dd057b99c9`、integrity `sha512-ZpZMrLf3E1guK…ivBLhN+WXxvNA==` |

## 2. 路线 A：`npm publish`（正式对外分发）

### 2.1 前置（缺一不可）

1. 主人点头（对外写动作）；群里先回「我领这条」，同一时刻只一个执行方。
2. `package.json` 版本 bump 到 `0.5.1`（0.5.0 已被占用，不能重发），提交信息 `chore: bump version to 0.5.1`。
3. 先把 4 笔未推推上 `origin/master`（`package.json` 里 `repository` / `homepage` 指向 GitHub，先推后发才有溯源）。
4. 打 tag `v0.5.1` 并推 tag（tag 也属对外写动作，一起点头）。
5. 确认 npm token 有 2FA 豁免或可用的 automation token，否则会卡在 OTP。

### 2.2 命令（逐条，未执行）

```bash
cd /c/develop/workspace/dsh-handoff-relay
# 1) 干净度与版本基调
git status --porcelain            # 必须为空
git log --oneline -1              # 记下用于报告的 SHA
grep -n '"version"' package.json  # 应显示 0.5.0，改前值

# 2) bump（用 node 改，避免手写破坏 JSON）
node -e "const f='package.json';const p=require('./'+f);p.version='0.5.1';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
git diff --stat                   # 只应有 package.json 一处
git add package.json
git commit -m "chore: bump version to 0.5.1"

# 3) 推送（对外写动作，需点头）
git push origin master
git tag -a v0.5.1 -m "v0.5.1"
git push origin v0.5.1

# 4) 打包自检（不落盘）
npm pack --dry-run 2>&1 | tail -20

# 5) 发布（token 从环境变量注入，不落文件、不回显）
npm publish --access public --//registry.npmjs.org/:_authToken="$DSH_SECRET_NPM"

# 6) 回读（以 registry 为准，不采信自我报告）
npm view dsh-handoff-relay version dist-tags time.modified
npm view dsh-handoff-relay@0.5.1 dist.integrity dist.shasum
```

### 2.3 影响面

- registry 公开可下载，任何人 `dsh plugin add dsh-handoff-relay` 会拿到 0.5.1；`latest` dist-tag 移动。
- 已安装旧版的机器**不会自动升级**，需手动 reinstall。
- 本机当前用 junction 直连仓库，发布**不改变**本机行为。
- 对外可见：包内容包含 README（含设置卡入口说明）与 `cordis.patch.yml`。

### 2.4 回滚路径

| 情况 | 动作 | 效果 |
|---|---|---|
| 刚发完发现内容不对 | `npm dist-tag add dsh-handoff-relay@0.5.0 latest` | `latest` 指回 0.5.0，0.5.1 仍可被精确安装 |
| 版本有缺陷但结构无问题 | `npm deprecate dsh-handoff-relay@0.5.1 "不可用，请装 0.5.2"` | 安装时打警告（0.4.0 已用此法标注） |
| 想彻底删掉该版本 | `npm unpublish dsh-handoff-relay@0.5.1 --force`（**72 小时内**、无其他包依赖时可行） | 超窗不可删，只能 deprecate |
| 想撤 tag | `git tag -d v0.5.1 && git push origin :refs/tags/v0.5.1` | 只影响 GitHub，不动 registry |

### 2.5 不可逆点（必须先认下）

1. 版本号一旦发布即**被占用**，回滚只能 deprecate / 重指 latest，不能「当没发生过」。
2. tarball 由 integrity 锁定，registry 上的字节不可替换。
3. 发布后再改代码必须发新版本号，不能就地覆盖。

## 3. 路线 B：打包（本机 / 内网分发）

### 3.1 命令（逐条，未执行）

```bash
cd /c/develop/workspace/dsh-handoff-relay
npm pack                                   # 落盘 dsh-handoff-relay-0.5.0.tgz
tar -tzf dsh-handoff-relay-0.5.0.tgz       # 核 7 个文件清单
md5sum dsh-handoff-relay-0.5.0.tgz         # 记哈希入账

# 本机安装（装到 desktop profile；profile 名按实际）
dsh plugin --profile desktop add /c/develop/workspace/dsh-handoff-relay/dsh-handoff-relay-0.5.0.tgz
# 安装后须回读组件开关状态（历史坑：装完 disabled: true），必要时置 false 再重启宿主
```

可选：先把版本号 bump 到 `0.5.0+build.1` 或 `0.5.1`，让 `plugin list` 能区分本地产物与 registry 版；不 bump 也能装，只是版本串相同、事后难分辨。

### 3.2 影响面

- 只影响装它的那台机器与该 profile；registry 无变化、GitHub 无变化。
- 分发靠人工传文件（tgz），无法让外部用户自助获取。
- 装完需重启/重挂载宿主才载入新代码（本次插件 16:38 重挂载即生效，非必须重启）。

### 3.3 回滚路径

```bash
dsh plugin --profile desktop remove dsh-handoff-relay
# 或装回上一版 tgz（若有留档）
rm -f dsh-handoff-relay-0.5.0.tgz   # 清掉本地产物
```

无外部副作用，回滚就是把包装回旧版或改回 junction。

### 3.4 与当前 junction 方式的关系

本机现在是 **junction 直连仓库**（`node_modules/dsh-handoff-relay` → `C:\develop\workspace\dsh-handoff-relay`），代码改动即时可见、无需打包。所以：

- **只为「本机能用」→ 什么都不用做**（已经是修复版在跑）。
- **为了「别人能装」→ 才需要 A（publish）或 B（把 tgz 发出去）**。

## 4. 对照表

| 维度 | A. `npm publish` | B. 打包 `.tgz` |
|---|---|---|
| 网络要求 | 需要 registry 可达 + token | 无 |
| 是否需要 bump 版本 | **必须**（0.5.0 已占用） | 不必（建议 bump 便区分） |
| 是否对外可见 | 是（公开包） | 否 |
| 外部用户能否自助安装 | 能 | 不能，需人工给文件 |
| 主要风险 | 版本号被永久占用、内容不可撤回 | 分发包散落、版本串无法区分 |
| 回滚难度 | 中（deprecate / 重指 latest，72h 内可 unpublish） | 低（remove / 换回旧包） |
| 前置依赖 | 先推 4 笔 + tag + 主人点头 | 无（可立即做） |
| 建议 | 正式分发走这条 | 本机验收、内网试用走这条 |

## 5. 建议与待批清单

1. **现在可做、不需要点头**：`npm pack`（只落一个 tgz 到仓库目录，会被 `.gitignore` 忽略；或直接 `npm pack --pack-destination` 到 `.batch/night/staging/`）。若主人要「本机可一键重装」的备份，这是零风险路径。
2. **需要主人一句话**：
   - 推不推 4 笔（`82dfbbe`/`40f34b5`/`f41b031`/`51a87c5`）？
   - 发版走 **A（publish 0.5.1）** 还是 **B（只打包）**，或两者都做（先 B 后 A）？
   - 若走 A：是否同意把版本号定为 **0.5.1**、tag 定为 `v0.5.1`。
3. **0.4.0 说明**：registry 上 0.4.0 已在发布说明标注不可用（用户 11-15 已拍板保留不回滚）；本次不动它，0.5.1 发布后建议在发布说明里再写一句「请装 0.5.1」。若走 B，则只在群内与 README 说明，不涉及 registry。
4. **执行分工建议**：bump + pack 由 developer 做（只读/写仓库内文件）；push / tag / publish 属对外写动作，任一方执行前须群里「我领这条」，执行后由第三方（QA）回读 `npm view` 或 GitHub 状态确认，不采信自我报告。

## 6. 附：本次未做

- 未改 `package.json`；未创建 tag；未 push；未执行 `npm publish`；未落 tgz 文件。
- 已执行且零副作用的只有：`git log`/`git status`/`git tag`/`git diff --stat`、`npm view`（只读）、`npm pack --dry-run`（不落盘）。

<!-- DONE -->
