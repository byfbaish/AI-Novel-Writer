# npm 发布元数据字段 · 收尾报告

仓库：`C:\develop\workspace\dsh-handoff-relay`

## 1. 提交内容

```
commit aa20fea43607f3abb8cfeb536d5691459e4406a3
Author: dsh-plugin <dsh-plugin@example.com>
Date:   Fri Nov 13 05:43:07 2026 +0800

    chore: add npm publish metadata (files, repository, homepage, author, keywords)

 package.json | 22 ++++++++++++++++++++++
 1 file changed, 22 insertions(+)
```

提交只含 `package.json` 一个文件。

## 2. npm pack --dry-run 文件清单

```
npm notice package: dsh-handoff-relay@0.3.0
npm notice Tarball Contents
npm notice 1.1kB LICENSE
npm notice 7.8kB README.md
npm notice 7.4kB README.zh-CN.md
npm notice 520B cordis.patch.yml
npm notice 14.1kB index.js
npm notice 917B package.json
npm notice Tarball Details
npm notice name: dsh-handoff-relay
npm notice version: 0.3.0
npm notice filename: dsh-handoff-relay-0.3.0.tgz
npm notice package size: 12.6 kB
npm notice unpacked size: 31.9 kB
npm notice shasum: 14ffeeb81d61e98e0896413e56b90e8270ddaeb4
npm notice integrity: sha512-oCiHV1xNBAri+[...]kmgjNT3R8imYg==
npm notice total files: 6
```

恰好 6 项，无 `index.test.mjs`、无 `.gitignore`。

## 3. 测试

```
TOTAL: 49/49 PASS
RESULT: PASS
```

## 4. 提交 SHA

```
aa20fea43607f3abb8cfeb536d5691459e4406a3
```

<!-- DONE -->
