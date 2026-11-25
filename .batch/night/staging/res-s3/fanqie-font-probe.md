# 番茄官网私用字体探针（一次性只读，2026-11-25）

> 结论一行（可转引）：**官网页正文可解，覆盖率 88%（318/362 私用码位），残留 8.3% 字符为 PUA 占位；本批不采官网正文，结论仅作备选证据留档。**

## 1. 样本与范围

- 取 1 章：`https://fanqienovel.com/reader/7257003641763332647`（《惹金枝》第 003 章），HTTP 200，43,790 B。
- 字体：`https://lf6-awef.bytetos.com/obj/awesome-font/c/dc027189e0ba4cd.woff2`，HTTP 200，47,564 B。
- 零模型调用；正文 HTML 与解码结果用完即删，`.runtime/res-font-probe/` 下不保留任何正文。

## 2. 字体结构（可解的前提）

| 事实 | 读数 |
|---|---|
| WOFF2 表数 | 10（CFF 65,943 B、cmap 2,940 B、hmtx 1,452 B、post 32 B） |
| 字形数 | 363 |
| `cmap` 条目 | 362，全部落在私用区（PUA） |
| `post` 版本 | 3.0 —— **无字形名** |
| CFF 字体族 | `SourceHanSansSCNormal`（思源黑体 SC Normal 子集） |
| charset | 存的是字符串引用 `gid58344` 一类，**不是 Unicode，也不指向可用字形名** |

推论：映射不可能从字体内部直接读出，只能靠轮廓比对参考字体。

## 3. 解法与耗时

1. Node `zlib.brotliDecompressSync` 解 WOFF2 表流，手解 `cmap` format 4，拿到 PUA → gid（362 条）。
2. `pip install fonttools brotli`（fontTools 4.68.0，python 3.14）——本机原无，已装。
3. 参考字体：Source Han Sans SC Normal（SIL OFL），`cdn.jsdelivr.net` 取 `1.003R` 与 `1.1.004R` 两个版本，结果一致；`raw.githubusercontent.com` 在本机不可达。
4. 指纹 = 每个字形 Type2 charstring 展开成绝对点序列后 sha1；先精确匹配，再按「点数＋bbox 尺寸」兜底；命中后用参考字体反查 `cmap` 取 Unicode。

| 指标 | 读数 |
|---|---|
| 精确匹配 | 242 / 362 |
| 兜底匹配 | 76 |
| 合计映射 | **318 / 362（87.8%）** |
| 未命中 | 31 个不同字（轮廓被站方改过或字重不同） |
| 单章解码耗时 | 约 12 秒（含参考字体 65,535 字形建表） |
| 映射表体积 | 4,631 B（318 条，可缓存复用） |

## 4. 解码质量

- 一章 2,236 字符，解出后 CJK 1,748；**PUA 占位 185 处（8.3%）**。
- 可读性旁证（未落盘，仅摘 60 字）：「主仆两人装扮成□人模样，提□篮子东西跟着言则去往刑部大牢…」——句子连续、占位集中在少数几个字上。
- 无法给出「与页面可见文本对齐若干处」的自动真值：官网 DOM 里本身就是 PUA，人工肉眼对齐需另开屏读，属另一件事。

## 5. 判定

- **可解，但覆盖率不足**：按本批硬闸（CJK>0.5、U+FFFD 0、实体 0），8.3% 的 PUA 占位会让断言不过，且要连带改 `MANIFEST`／sidecar／`platform`／统计分母。
- 处置（admin 2026-11-25 07:2x）：**本批不采官网正文**，本结论只作备选证据；番茄侧正文从第三方镜像站采（`gb18030`）。
- 若后续单卡要补 12%：优先换更多参考字重／版本，其次人工补字；不建议再做第二版手写解释器（已证明 fontTools 路线足够）。

## 6. 复现

```
cd C:/develop/workspace/AI-writer/develop
pip install fonttools brotli
# 参考字体按文献地址自取（录于 .runtime/res-font-probe/match2.py 注释）
python .runtime/res-font-probe/match2.py 1.003R-Normal.otf
# → {'exact': 242, 'norm': 0, 'shape': 89, 'miss': 31} mapped 318
```

## 7. 盘上留档

`.runtime/res-font-probe/`（`.gitignore:54` 忽略），共 7 件 / 63,598 B：`probe-woff2.cjs`、`scan-html.cjs`、`match2.py`、`diag-match.py`、`outline_match.py`、`dc027189e0ba4cd.woff2`、`pua-map-v2.json`。正文 HTML、解码文本、参考 OTF（4 份约 65 MB）均已删除。
