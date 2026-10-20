import { describe, expect, it } from 'vitest'
import { buildOutlineTree } from '../outline-tree'

// E4j-4：大纲的卷/单元/章 三层树。
// 关键事实：归属不是存下来的，是按「计划等分」折算出来的；只有写了「覆盖：<本单元>」才算声明。
const PLAN = [
  '## 卷一：开局',
  '### 单元一：门牌',
  '### 单元二：定价',
  '',
  '## 卷二：销档',
  '### 单元一：配合',
].join('\n')

const synopsisOf = (covers: readonly string[]) => covers
  .map((cover, index) => `## 第${index + 1}章：第${index + 1}章标题` + (cover ? `\n覆盖：${cover}` : '') + '\n正文。')
  .join('\n');

describe('buildOutlineTree：卷/单元/章 三层', () => {
  it('60 章两卷：卷一半 30 章，单元边界 1–15 / 16–30', () => {
    const synopsis = synopsisOf(Array.from({ length: 60 }, () => ''));
    const tree = buildOutlineTree(PLAN, synopsis, 60)!;
    expect(tree.volumes).toHaveLength(2);
    const unitOne = tree.volumes[0]!.units[0]!;
    expect(unitOne.chapters.map(c => c.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(tree.volumes[0]!.units[1]!.chapters[0]!.number).toBe(16);
  })

  it('没写「覆盖：」的章标 computed（折算出来的，可能漂移）', () => {
    const tree = buildOutlineTree(PLAN, synopsisOf(['', '', '', '']), 60)!;
    for (const volume of tree.volumes) for (const unit of volume.units) for (const c of unit.chapters) {
      expect(c.source).toBe('computed');
      expect(c.declaredId).toBeNull();
    }
    expect(tree.computedCount).toBe(4);
    expect(tree.mismatchCount).toBe(0);
  })

  it('写了「覆盖：M1-1/逼法」且折算一致 ⇒ declared', () => {
    const tree = buildOutlineTree(PLAN, synopsisOf(['M1-1/逼法', '', '']), 60)!;
    const first = tree.volumes[0]!.units[0]!.chapters[0]!;
    expect(first.source).toBe('declared');
    expect(first.declaredId).toBe('M1-1/逼法');
  })

  it('声明指向别的单元 ⇒ mismatch（漂移的早期信号）', () => {
    // 第 1 章落在单元一，却声明 M1-2 ⇒ 不一致
    const tree = buildOutlineTree(PLAN, synopsisOf(['M1-2/逼法', '', '']), 60)!;
    expect(tree.mismatchCount).toBe(1);
    const declaredUnit = tree.volumes[0]!.units[1]!;
    // 按声明归入单元二，但 source 标 mismatch
    expect(declaredUnit.chapters[0]!.source).toBe('mismatch');
    expect(declaredUnit.chapters[0]!.number).toBe(1);
  })

  it('「覆盖：无」不算声明，仍按折算', () => {
    const tree = buildOutlineTree(PLAN, synopsisOf(['无', '', '']), 60)!;
    expect(tree.volumes[0]!.units[0]!.chapters[0]!.source).toBe('computed');
  })

  it('章节点带原文行号，能在正文里定位', () => {
    const synopsis = synopsisOf(['M1-1/逼法', '', '']);
    const tree = buildOutlineTree(PLAN, synopsis, 60)!;
    const chapter = tree.volumes[0]!.units[0]!.chapters[0]!;
    expect(chapter.line).not.toBeNull();
    expect(synopsis.split('\n')[chapter.line!]).toContain('第1章');
  })

  it('没有章级条目 / 结构不可解析时返回 null', () => {
    expect(buildOutlineTree(PLAN, '没有章标题的散文', 60)).toBeNull();
    expect(buildOutlineTree('', synopsisOf(['']), 60)).toBeNull();
    expect(buildOutlineTree(PLAN, synopsisOf(['']), 0)).toBeNull();
  })
});

// P2（2026-10-20）：单元批次的大纲把位置写进章标题。
// 归属从「事后折算」变成「生成时写下的事实」—— 这就是 `heading` 来源存在的理由：
// 折算在单元写超后会整体错位，而标题不会。
const attributedSynopsis = (spec: readonly { volume: number; unit: number }[]) => spec
  .map((item, index) => {
    const chapterInUnit = index + 1
    return `## 第${item.volume}卷第${item.unit}单元第${chapterInUnit}章（全书第${chapterInUnit}章）：第${chapterInUnit}章标题\n正文。`
  })
  .join('\n')

describe('buildOutlineTree：章标题自带归属（heading source）', () => {
  it('归属与折算一致时标 heading，不再算折算', () => {
    const spec = Array.from({ length: 60 }, (_, index) => ({ volume: index < 30 ? 1 : 2, unit: index < 15 || (index >= 30) ? 1 : 2 }))
    const tree = buildOutlineTree(PLAN, attributedSynopsis(spec), 60)!
    for (const volume of tree.volumes) for (const unit of volume.units) for (const c of unit.chapters) {
      expect(c.source).toBe('heading')
    }
    expect(tree.headingCount).toBe(60)
    expect(tree.computedCount).toBe(0)
    expect(tree.driftedCount).toBe(0)
    expect(tree.mismatchCount).toBe(0)
  })

  it('单元写超后：按标题归桶，折算的错位计入 driftedCount 而不是 mismatch', () => {
    // 真实写法：单元一 1–20、单元二 21–40、卷二单元一 41–60（每个单元实际 20 章）。
    // 计划是均分 15 / 15 / 30 —— 折算会把 16–20 判给单元二、31–40 判给卷二。
    const spec = Array.from({ length: 60 }, (_, index) => {
      if (index < 20) return { volume: 1, unit: 1 }
      if (index < 40) return { volume: 1, unit: 2 }
      return { volume: 2, unit: 1 }
    })
    const tree = buildOutlineTree(PLAN, attributedSynopsis(spec), 60)!
    // 归桶听标题：三个单元各 20 章
    expect(tree.volumes[0]!.units[0]!.chapters).toHaveLength(20)
    expect(tree.volumes[0]!.units[1]!.chapters).toHaveLength(20)
    expect(tree.volumes[1]!.units[0]!.chapters).toHaveLength(20)
    // 16–20（5 章）与 31–40（10 章）与折算不一致
    expect(tree.driftedCount).toBe(15)
    expect(tree.mismatchCount).toBe(0)
    expect(tree.computedCount).toBe(0)
  })

  it('标题优先于「覆盖：」声明（声明指错也不该覆盖生成时的事实）', () => {
    const synopsis = '## 第1卷第1单元第1章（全书第1章）：门牌\n覆盖：M1-2/逼法\n正文。'
    const tree = buildOutlineTree(PLAN, synopsis, 60)!
    const chapter = tree.volumes[0]!.units[0]!.chapters[0]!
    expect(chapter.source).toBe('heading')
    expect(chapter.declaredId).toBe('M1-2/逼法')
    expect(tree.mismatchCount).toBe(0)
  })

  it('标题写的卷/单元不存在 ⇒ 退回折算，不让这一章掉出树', () => {
    const synopsis = '## 第9卷第9单元第1章（全书第1章）：越界\n正文。'
    const tree = buildOutlineTree(PLAN, synopsis, 60)!
    const chapter = tree.volumes[0]!.units[0]!.chapters[0]!
    expect(chapter.source).toBe('computed')
    expect(chapter.headingVolumeIndex).toBe(9)
    expect(tree.headingCount).toBe(0)
  })

  it('新旧格式混排（存量旧大纲 + 新批次）：各按各的来源算', () => {
    const oldPart = synopsisOf(['', '', ''])  // 3 章旧格式
    const newPart = '## 第1卷第1单元第4章（全书第4章）：新的\n正文。'
    const tree = buildOutlineTree(PLAN, `${oldPart}\n${newPart}`, 60)!
    expect(tree.headingCount).toBe(1)
    expect(tree.computedCount).toBe(3)
    const chapters = tree.volumes[0]!.units[0]!.chapters
    expect(chapters.map(c => c.source)).toEqual(['computed', 'computed', 'computed', 'heading'])
  })

  it('行号与章名照常可定位（位置在冒号前，不污染 title）', () => {
    const synopsis = '## 第1卷第1单元第7章（全书第7章）：赊账页\n正文。'
    const tree = buildOutlineTree(PLAN, synopsis, 60)!
    const chapter = tree.volumes[0]!.units[0]!.chapters[0]!
    expect(chapter.title).toBe('赊账页')
    expect(chapter.number).toBe(7)
    expect(chapter.line).toBe(0)
  })
})
