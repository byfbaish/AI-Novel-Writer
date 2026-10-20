/**
 * 情节大纲的**卷/单元/章 三层树**（E4j-4，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §7A.1b。
 *
 * ## 回答的问题
 *
 * 作者原话：「我随便挑一章，问你它属于哪一卷、哪一单元，还能找出这种关系么？」
 *
 * ## 关键事实：这个关系是**算出来的**，不是**存下来的**
 *
 * 大纲正文里**没有**「本章属于哪一卷哪个单元」这种字段。每章的「覆盖：」行只写
 * **逼法**（一次性转折位）或「无」，它不表达归属。真实项目的读数：10 章里 8 章写「覆盖：无」。
 *
 * 所以归属只能由 `arcSpanForChapters`（卷/单元区间**按计划等分折算**）反推。
 * ⚠️ 这意味着：**一旦某个单元实际写超，后续章号与单元的对齐会整体错位**
 * （设计稿 §7 的硬前置）。
 *
 * ## 2026-10-20 P2：标题可以自带归属了
 *
 * 单元模式的大纲现在把位置写进章标题：`## 第3卷第2单元第3章（全书第45章）：章名`
 * （`prompts/synopsis-unit-heading.ts`）。这是**生成时写下的真值**，不是事后折算，
 * 于是多了第四种来源 `heading`，优先级最高：
 *
 * | source | 含义 |
 * |---|---|
 * | `heading` | 标题自带「第V卷第U单元」—— 生成时的事实，可信 |
 * | `declared` | 该章写了 `覆盖：<本单元ID>`，归属是**声明**的，可信 |
 * | `computed` | 只能按等分折算反推，**可能因实际章数偏离而错位** |
 * | `mismatch` | 声明指向的单元与折算结果**不一致** —— 漂移的早期信号，要显式暴露 |
 *
 * 旧格式标题（`## 第N章`）永久兼容：存量大纲与新批次会长期混在一个文件里，
 * 那些章仍然走 `declared` / `computed`。
 */

import {
  arcSpanForChapters,
  parseArcStructure,
  type ParsedArcStructure,
} from './arc-position'
import { parseChapterArcCovers } from './arc-node'
import { parseOutlineChapterHeading } from './chapter-heading'
import { buildArcTree, type ArcTree, type ArcTreeUnit, type ArcTreeVolume } from './arc-tree'

export type ChapterUnitSource = 'heading' | 'declared' | 'computed' | 'mismatch'

export interface OutlineTreeChapter {
  /** 章号，1 起 */
  number: number
  title: string;
  /** 本章标题在大纲正文里的行号（0 起）；解析不到为 null */
  line: number | null;
  source: ChapterUnitSource;
  /** 章标题里自带的卷号（旧格式标题为 null） */
  headingVolumeIndex: number | null;
  /** 章标题里自带的单元号（旧格式标题为 null） */
  headingUnitIndex: number | null;
  /** 声明值（`覆盖：` 行原文里的结构位 ID），没有声明为 null */
  declaredId: string | null;
}

export interface OutlineTreeUnit extends ArcTreeUnit {
  chapters: readonly OutlineTreeChapter[];
}

export interface OutlineTreeVolume extends Omit<ArcTreeVolume, 'units'> {
  units: readonly OutlineTreeUnit[];
}

export interface OutlineTree {
  volumes: readonly OutlineTreeVolume[];
  twoLevel: boolean;
  /** 归属来自**章标题自带位置**的章数（P2 之后的新批次） */
  headingCount: number;
  /** 归属不是「声明」也不是「标题」、而是「折算」的章数 */
  computedCount: number;
  /** 声明与折算不一致的章数 —— 大于 0 说明结构已经漂移 */
  mismatchCount: number;
  /**
   * 标题自带归属与折算结果**不一致**的章数。
   *
   * 不并进 `mismatchCount`：折算才是那个会错的（单元写超后整体错位），
   * 标题是生成时写下的事实。这个数字大于 0 说明「折算已经不能用了」，
   * 也正是当初要加 `heading` 来源的理由。
   */
  driftedCount: number;
}

/** 章标题行在正文里的位置 + 标题自带的归属（旧格式标题两个归属都是 null）。 */
interface ChapterLineInfo {
  line: number;
  volumeIndex: number | null;
  unitIndex: number | null;
}

/** 从 `覆盖：M1-2/逼法` 里取出单元序号（`M1-2` → 2）。取不到返回 null。 */
function unitIndexFromCoverId(id: string): number | null {
  const match = /^M[0-9]+-([0-9]+)/u.exec(id.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/** 章节标题行（位置 + 自带归属）。同一章号出现多次时取第一次。 */
function scanChapterLines(synopsis: string): Map<number, ChapterLineInfo> {
  const lines = new Map<number, ChapterLineInfo>();
  for (const [index, raw] of synopsis.split(/\r?\n/u).entries()) {
    const fields = parseOutlineChapterHeading(raw.trim());
    // 本模块的约束：恰好 `##`、单章、章号阿拉伯数字、只认「第N章」（不认 `Chapter N`）。
    // 带归属的标题在这里同样成立（`arabic` 看的是书名号里那个全书章号）。
    if (!fields || fields.hashLevel !== 2 || fields.grouped || !fields.arabic || fields.style !== 'cn') continue;
    if (!lines.has(fields.chapter)) {
      lines.set(fields.chapter, {
        line: index,
        volumeIndex: fields.attributed ? fields.volumeIndex : null,
        unitIndex: fields.attributed ? fields.unitIndex : null,
      });
    }
  }
  return lines;
}

/**
 * 构造大纲的卷/单元/章 三层树。
 *
 * 结构不可解析或大纲没有章级条目时返回 `null`（调用方据此不渲染树）。
 */
export function buildOutlineTree(
  plan: string | null | undefined,
  synopsis: string | null | undefined,
  totalChapters: number,
): OutlineTree | null {
  if (!plan?.trim() || !synopsis?.trim()) return null;
  if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return null;
  const parsed: ParsedArcStructure | null = parseArcStructure(plan);
  if (!parsed) return null;
  const base: ArcTree | null = buildArcTree(plan);
  if (!base) return null;
  const chapterLines = scanChapterLines(synopsis);
  if (chapterLines.size === 0) return null;
  const covers = new Map(parseChapterArcCovers(synopsis).map(item => [item.chapterNumber, item]));

  let headingCount = 0;
  let computedCount = 0;
  let mismatchCount = 0;
  let driftedCount = 0;
  const buckets = new Map<string, OutlineTreeChapter[]>();

  for (const chapter of [...chapterLines.keys()].sort((left, right) => left - right)) {
    const span = arcSpanForChapters(parsed, totalChapters, chapter, chapter);
    if (!span) continue;
    const lineInfo = chapterLines.get(chapter)!;
    const declaredId = covers.get(chapter)?.covers[0] ?? null;
    const declaredUnit = declaredId ? unitIndexFromCoverId(declaredId) : null;
    // ⚠️ `ArcSpan` 没有 `midCount`（它只带 midIndex / endMidIndex）；单元数要从 parsed 取。
    const midCount = parsed.majors[span.majorIndex - 1]?.mids.length ?? 0;
    // 只有「声明指向本卷内某个单元」才有比对意义；跨卷声明或解析不出序号一律按折算处理。
    const declaredInThisVolume = declaredUnit !== null && declaredUnit >= 1 && declaredUnit <= midCount;

    // ① 标题自带归属（P2 之后的新批次）：生成时写下的事实，优先级最高。
    //    但模型可能写错到不存在的卷/单元 —— 那种情况退回折算，否则这一章会掉出树。
    const headingVolume = lineInfo.volumeIndex;
    const headingUnit = lineInfo.unitIndex;
    const headingInStructure = headingVolume !== null && headingUnit !== null
      && headingVolume >= 1 && headingVolume <= base.volumes.length
      && headingUnit >= 1
      && headingUnit <= (parsed.majors[headingVolume - 1]?.mids.length ?? 0);

    let source: ChapterUnitSource;
    let unitIndex: number;
    let volumeIndex: number;
    if (headingInStructure) {
      source = 'heading';
      volumeIndex = headingVolume!;
      unitIndex = headingUnit!;
      headingCount += 1;
      // 折算与标题不一致 ⇒ 折算已经不能用（单元写超后的整体错位就是这样暴露的）。
      if (headingVolume !== span.majorIndex || headingUnit !== span.midIndex) driftedCount += 1;
    } else {
      source = !declaredInThisVolume
        ? 'computed'
        : declaredUnit === span.midIndex ? 'declared' : 'mismatch';
      volumeIndex = span.majorIndex;
      unitIndex = declaredInThisVolume ? declaredUnit! : span.midIndex;
      if (source === 'computed') computedCount += 1;
      if (source === 'mismatch') mismatchCount += 1;
    }

    const key = `${volumeIndex}:${unitIndex}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(Object.freeze({
      number: chapter,
      title: covers.get(chapter)?.title ?? '',
      line: lineInfo.line,
      source,
      headingVolumeIndex: headingVolume,
      headingUnitIndex: headingUnit,
      declaredId,
    }));
    buckets.set(key, bucket);
  }

  const volumes: OutlineTreeVolume[] = base.volumes.map(volume => {
    const units: OutlineTreeUnit[] = volume.units.map(unit => {
      const chapters = buckets.get(`${volume.index}:${unit.index}`) ?? [];
      return Object.freeze({ ...unit, chapters: Object.freeze(chapters) });
    });
    return Object.freeze({ index: volume.index, name: volume.name, line: volume.line, units: Object.freeze(units) });
  });

  return Object.freeze({
    volumes: Object.freeze(volumes),
    twoLevel: base.twoLevel,
    headingCount,
    computedCount,
    mismatchCount,
    driftedCount,
  });
}
