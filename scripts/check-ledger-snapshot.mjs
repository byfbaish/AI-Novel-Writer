#!/usr/bin/env node
/**
 * check-ledger-snapshot.mjs — 台账「快照格 vs 现值格」索引体检（只读，不接线）
 *
 * 为什么存在
 * ----------
 * docs/plans/prompt-assembly-backlog.md 对同一个缺陷编号有两套状态登记：
 *   ① 2026-11-02 的「修复排序」快照表（列头 :102 明写「快照 · 勿据此判断现状」）；
 *   ② 2026-11-09 的「现值索引」表（:119 声明「下表是索引，不是状态登记」，:122 为列头）。
 * 2026-11-11 夜跑 WB-3 因为只看到快照行 :114 的「未开工」，把「D17 已结项」
 * 误判成「D17 未开工」，导致一张卡 BLOCKED；DB-7 复核才发现这是
 * 「过期快照 vs 现值」的索引冲突，不是数据打架。本脚本把这个坑变成机器可查：
 * 逐个缺陷编号检查「快照格 + 现值格」是否都在、是否唯一。
 *
 * 判据（重要，读之前先看这段）
 * ----------------------------
 * 1) 以「Markdown 表格」为单位：列头行 + `|---|` 分隔行 + 其后连续的 `|` 数据行。
 * 2) 一行是否算「缺陷编号行」，看是否存在某个单元格【整体】形如 `D\d+`
 *    （允许 `**D17**` 粗体）。`D4–D8` / `D9–D11、D16` / `D18-①` 这类复合或派生
 *    编号不算单一编号，只记入「未识别的编号型行」附注，不参与判定。
 *    用「整格等于编号」而非「格内包含 D 字样」，可自动排除文中大量在叙述里
 *    提到 D 编号的其它表格。
 * 3) 表格分区只看列头：含「快照」→ 快照区；含「现值」→ 现值区；都不含 → 中性（不参与）。
 *    本文件里 :159 列头含「现值」却是「看板卡 → 回填落点」表、:690 列头含「快照」
 *    却是卷差对照表，二者数据行都没有纯编号单元格，因此「纯编号行 + 列头关键词」
 *    的组合判据能把它们自动排除，不需要硬编码行号、也不会随行号漂移而失效。
 * 4) 状态格取列头中含「状态」或「现值」的那一列，输出其首 40 字作为预览。
 * 5) verdict：两区各恰好 1 行 → OK；缺现值 → MISSING-PRESENT；缺快照 →
 *    MISSING-SNAPSHOT；任一区出现多行 → AMBIGUOUS。
 *
 * 为什么不用正则直接匹配「已结项」字样
 * ------------------------------------
 * 因为「按状态词判断现状」正是这次踩的坑：快照格里同样会出现历史状态词，甚至
 * 「已结项」三个字。最直接的证据是本文件 :114 的 D17 快照格 —— WB-11 追加的补注里
 * 就写着「D17 现值已结项」。若用 /已结项/ 去匹配，会把这条 2026-11-02 的快照行
 * 误认成现值行 / 误判成已结项，等于把「快照 vs 现值」的结构区分抹平。
 * 状态词的语义属于人（且要看真源），机器只该判断「结构是否齐全、是否唯一」。
 *
 * 约束：只读、不写任何文件、不写缓存/临时文件（除 stdout）。
 * 退出码：0=全部 OK / 1=存在 MISSING-* 或 AMBIGUOUS / 2=文件不存在或解析失败（打印原因，不抛栈）。
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PREVIEW_LEN = 40
const PURE_ID = /^\*{0,2}(D\d+)\*{0,2}$/

export function splitCells(line) {
    let s = line.trim()
    if (s.startsWith('|')) s = s.slice(1)
    if (s.endsWith('|')) s = s.slice(0, -1)
    return s.split('|').map(c => c.trim())
}

export function isSeparator(line) {
    return /^\s*\|[\s:|\-]+\|\s*$/.test(line) && line.includes('-')
}

export function isTableRow(line) {
    return /^\s*\|/.test(line)
}

/** 把整篇 markdown 切成表格块，记录列头行号（1-based）与数据行。 */
export function parseTables(text) {
    const lines = text.split(/\r?\n/)
    const tables = []
    for (let i = 0; i < lines.length; i++) {
        if (!isSeparator(lines[i]) || i === 0 || !isTableRow(lines[i - 1])) continue
        const headerIndex = i - 1
        const rows = []
        let j = i + 1
        while (j < lines.length && isTableRow(lines[j]) && !isSeparator(lines[j])) {
            // 下一行是分隔行 ⇒ 当前行其实是下一个表格的列头，结束本表
            if (j + 1 < lines.length && isSeparator(lines[j + 1])) break
            rows.push({ line: j + 1, cells: splitCells(lines[j]) })
            j++
        }
        tables.push({
            headerLine: headerIndex + 1,
            headerText: lines[headerIndex],
            headerCells: splitCells(lines[headerIndex]),
            rows,
        })
        i = j - 1
    }
    return tables
}

export function classifyZone(headerText) {
    if (headerText.includes('快照')) return 'snapshot'
    if (headerText.includes('现值')) return 'present'
    return 'neutral'
}

/** 状态列：优先列头含「状态」的列，其次含「现值」的列，兜底最后一列。 */
export function statusColumnIndex(headerCells) {
    let idx = headerCells.findIndex(c => c.includes('状态'))
    if (idx < 0) idx = headerCells.findIndex(c => c.includes('现值'))
    if (idx < 0) idx = Math.max(0, headerCells.length - 1)
    return idx
}

export function preview(text) {
    return Array.from(String(text ?? '')).slice(0, PREVIEW_LEN).join('')
}

/** 汇总每个缺陷编号的快照行 / 现值行，并给出 verdict。 */
export function buildReport(text) {
    const tables = parseTables(text)
    const found = new Map()
    const unrecognised = []
    const tablesSeen = []

    for (const table of tables) {
        const zone = classifyZone(table.headerText)
        // 门槛：只有「列头命中快照/现值关键词」且「表内确有整格纯 D<n> 编号行」
        // 的表格才是缺陷编号索引表。本文件 :159 列头含「现值」却是看板回填表、
        // :690 列头含「快照」却是卷差对照表，二者都没有纯编号行，据此自动排除，
        // 不硬编码行号，也不随行号漂移而失效。
        const pureRows = table.rows.filter(row => row.cells.some(cell => PURE_ID.test(cell)))
        if (zone === 'neutral' || pureRows.length === 0) continue
        const statusIdx = statusColumnIndex(table.headerCells)
        for (const row of table.rows) {
            let id = null
            for (const cell of row.cells) {
                const m = PURE_ID.exec(cell)
                if (m) { id = m[1]; break }
            }
            if (!id) {
                // 只记录「含 D 编号但不是纯编号格」的行（复合/派生编号），作为附注
                const candidate = `${row.cells[1] ?? ''} ${row.cells[0] ?? ''}`
                if (/D\d+/.test(candidate)) {
                    unrecognised.push({
                        zone,
                        line: row.line,
                        label: (row.cells[1] || row.cells[0] || '').slice(0, 28),
                    })
                }
                continue
            }
            const entry = found.get(id) ?? { snapshot: [], present: [] }
            entry[zone].push({
                line: row.line,
                headerLine: table.headerLine,
                preview: preview(row.cells[statusIdx]),
            })
            found.set(id, entry)
        }
        tablesSeen.push({ headerLine: table.headerLine, zone, rowCount: table.rows.length, idRows: pureRows.length })
    }

    const ids = [...found.keys()].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    const items = ids.map(id => {
        const { snapshot: s, present: p } = found.get(id)
        let verdict
        if (s.length > 1 || p.length > 1) verdict = 'AMBIGUOUS'
        else if (s.length === 1 && p.length === 1) verdict = 'OK'
        else if (s.length === 0) verdict = 'MISSING-SNAPSHOT'
        else verdict = 'MISSING-PRESENT'
        return {
            id,
            snapshotLine: s.length ? s[0].line : null,
            presentLine: p.length ? p[0].line : null,
            verdict,
            snapshotPreview: s.length ? s[0].preview : '（无）',
            presentPreview: p.length ? p[0].preview : '（无）',
            snapshotHeaderLine: s.length ? s[0].headerLine : null,
            presentHeaderLine: p.length ? p[0].headerLine : null,
        }
    })
    return { items, unrecognised, tablesSeen }
}

function displayWidth(s) {
    let w = 0
    for (const ch of String(s)) {
        const cp = ch.codePointAt(0)
        const wide = (cp >= 0x1100 && cp <= 0x115f) || cp === 0x2329 || cp === 0x232a ||
            (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
            (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
            (cp >= 0xfe10 && cp <= 0xfe19) || (cp >= 0xfe30 && cp <= 0xfe6f) ||
            (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) ||
            (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x1f000 && cp <= 0x1faff)
        w += wide ? 2 : 1
    }
    return w
}

function pad(s, width) {
    const text = String(s)
    return text + ' '.repeat(Math.max(0, width - displayWidth(text)))
}

export function renderHuman(report, target) {
    const out = []
    out.push(`台账「快照格 vs 现值格」体检 — ${target}`)
    out.push('判据：整格纯编号 D<n> 定位缺陷行；列头含「快照」=快照区、含「现值」=现值区；不做状态词匹配。')
    out.push('')
    out.push('识别到的表格：')
    for (const t of report.tablesSeen) {
        out.push(`  ${pad(t.zone === 'snapshot' ? '快照区' : t.zone === 'present' ? '现值区' : '中性', 8)} 列头 L${pad(t.headerLine, 5)} 数据行 ${pad(t.rowCount, 4)} 编号行 ${t.idRows}`)
    }
    out.push('')
    // 列宽按本列内容的显示宽度动态计算，保证 stdout 本身严格对齐
    // （「首 40 字」的中文按显示宽度可达 80，固定列宽会溢出错位）。
    const rowText = report.items.map(it => ({
        id: it.id,
        verdict: it.verdict,
        s: it.snapshotLine ? `L${it.snapshotLine} ${it.snapshotPreview}` : '（无）',
        p: it.presentLine ? `L${it.presentLine} ${it.presentPreview}` : '（无）',
    }))
    const widths = [0, 1, 2, 3].map((_, k) => {
        const key = ['id', 'verdict', 's', 'p'][k]
        const head = ['ID', '判定', '快照行', '现值行'][k]
        return Math.max(displayWidth(head), ...rowText.map(r => displayWidth(r[key]))) + 2
    })
    out.push(`${pad('ID', widths[0])}${pad('判定', widths[1])}${pad('快照行', widths[2])}${pad('现值行', widths[3])}`.trimEnd())
    out.push('-'.repeat(Math.min(200, widths.reduce((a, b) => a + b, 0))))
    for (const r of rowText) {
        out.push(`${pad(r.id, widths[0])}${pad(r.verdict, widths[1])}${pad(r.s, widths[2])}${pad(r.p, widths[3])}`.trimEnd())
    }
    out.push('')
    if (report.unrecognised.length) {
        out.push('未识别的编号型行（复合/派生编号，不参与判定）：')
        for (const u of report.unrecognised) {
            out.push(`  L${u.line} [${u.zone}] ${u.label}`)
        }
        out.push('')
    }
    const tally = {}
    for (const it of report.items) tally[it.verdict] = (tally[it.verdict] ?? 0) + 1
    out.push(`汇总：OK ${tally.OK ?? 0} · MISSING-PRESENT ${tally['MISSING-PRESENT'] ?? 0} · ` +
        `MISSING-SNAPSHOT ${tally['MISSING-SNAPSHOT'] ?? 0} · AMBIGUOUS ${tally.AMBIGUOUS ?? 0} · ` +
        `共 ${report.items.length}`)
    return out.join('\n')
}

export function main(argv = [], repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
    const asJson = argv.includes('--json')
    const target = join(repoRoot, 'docs', 'plans', 'prompt-assembly-backlog.md')
    let text
    try {
        text = readFileSync(target, 'utf8')
    } catch (err) {
        console.error(`[check-ledger-snapshot] 无法读取台账：${target}`)
        console.error(`  原因：${err.code ?? err.message}`)
        return 2
    }
    let report
    try {
        report = buildReport(text)
    } catch (err) {
        console.error(`[check-ledger-snapshot] 解析失败：${err.message}`)
        return 2
    }
    const zones = new Set(report.tablesSeen.map(t => t.zone))
    if (!zones.has('snapshot') || !zones.has('present')) {
        console.error('[check-ledger-snapshot] 解析失败：未同时找到带缺陷编号行的快照区与现值区表格（台账结构可能已变）')
        return 2
    }
    if (report.items.length === 0) {
        console.error('[check-ledger-snapshot] 解析失败：未提取到任何缺陷编号行')
        return 2
    }
    if (asJson) {
        const slim = report.items.map(({ id, snapshotLine, presentLine, verdict }) => ({ id, snapshotLine, presentLine, verdict }))
        console.log(JSON.stringify(slim, null, 2))
    } else {
        console.log(renderHuman(report, 'docs/plans/prompt-assembly-backlog.md'))
    }
    return report.items.every(it => it.verdict === 'OK') ? 0 : 1
}

const isMain = Boolean(process.argv[1]) &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
    try {
        process.exitCode = main(process.argv.slice(2))
    } catch (err) {
        // 不抛栈：只打印原因，按「解析失败」处理
        console.error(`[check-ledger-snapshot] 未预期错误：${err.message}`)
        process.exitCode = 2
    }
}
