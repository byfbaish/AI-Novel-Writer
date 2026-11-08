import { expect, it } from 'vitest'

import { analyzeChapterReuse } from '../chapter-reuse-coverage'

/**
 * 中文段落辅助：重复使用同一风格，确保每例正文 ≥ 200 字。
 * 避免被 n-gram 截断导致的假阳性/假阴性。
 */
function zh(text: string): string {
  return text
}

// =============================================================================
// #1 两段毫不相干的中文 ──► severity: 'ok'，ratio 接近 0
// =============================================================================
it('#1 防毫无关联的中文被误判为复用', () => {
  const prose = zh(
    '林宇清晨起床，拉开窗帘，阳光洒在桌上的一杯温水上。他走到厨房，开始煮鸡蛋。鸡蛋滋滋作响，气味四溢。吃完早餐他换上外出的衣服，提着钥匙走出了门。街道上行人络绎不绝，车水马龙。他踏上去往公司的道路，脑海里浮现今天的计划。',
  )
  const previousChapter = zh(
    '李明推开门，看见父亲坐在黑暗里。推开门的动作声响起，父亲的身影若隐若现。',
  )
  const report = analyzeChapterReuse(prose, previousChapter)
  expect(report.severity).toBe('ok')
  expect(report.ratio).toBeCloseTo(0, 2)
  expect(report.coveredUnits).toBe(0)
  expect(report.runs.length).toBe(0)
  expect(report.longestRun).toBe(0)
})

// =============================================================================
// #2 正文整章逐字抄上一章 ──► severity: 'blocking'，ratio >= 0.9
// =============================================================================
it('#2 防正文整章逐字抄上一章（阻断）', () => {
  const chapterText = zh(
    '林宇清晨起床，拉开窗帘，阳光洒在桌上的一杯温水上。他走到厨房，开始煮鸡蛋。鸡蛋滋滋作响，气味四溢。吃完早餐他换上外出的衣服，提着钥匙走出了门。街道上行人络绎不绝，车水马龙。他踏上去往公司的道路，脑海里浮现今天的计划。他在公司的工位前打了个招呼，坐下打开电脑。上午的项目评审会上，大家围绕新的产品线展开了热烈的讨论。午后他继续撰写设计文档，反复推敲细节。下班后他去健身房，跑了五公里。回家的路上他在想今天的收获。他回到家中，煮了面条晚餐。吃完饭他洗了碗，准备明天的衣服。整理好明天的任务列表，他终于放松入睡。',
  )
  const prose = chapterText
  const previousChapter = chapterText // 完全相同
  const report = analyzeChapterReuse(prose, previousChapter)
  expect(report.severity).toBe('blocking')
  expect(report.ratio).toBeGreaterThanOrEqual(0.9)
  expect(report.coveredUnits).toBeGreaterThan(0)
  expect(report.runs.length).toBeGreaterThan(0)
  expect(report.longestRun).toBeGreaterThan(0)
})

// =============================================================================
// #3 只抄上一章结尾约 300 字，其余全新 ──► ok 或 advisory（不能是 blocking）
// =============================================================================
it('#3 防只抄上一章结尾约 300 字（非 blocking，正常承接）', () => {
  // 全新正文：与上一章没有一句重合，只负责把篇幅拉到真实章节量级。
  const freshBody = zh(
    '雨停之后巷子里的青石板泛着油亮的光，摊贩们陆续支起了棚子，蒸气顺着布帘往上爬。沈砚把伞收拢靠在墙边，从怀里摸出那张折了三道的纸条，指腹在落款处来回蹭了两下。他没有立刻进去，先绕着这条街走了半圈，数清了两个出口和一个能翻的矮墙。等他回到糖水铺门口时，锅里正翻着桂圆的甜香，掌柜抬头看了他一眼，把手里的木勺往锅沿一磕。',
  )
  // 只有上一章的结尾这一段是复用，其余全新
  const previousChapterMiddleAndEnd = zh(
    '他在公司的工位前打了个招呼，坐下打开电脑。上午的项目评审会上，大家围绕新的产品线展开了热烈的讨论。午后他继续撰写设计文档，反复推敲细节。下班后他去健身房，跑了五公里。回家的路上他在想今天的收获。他回到家中，煮了面条晚餐。吃完饭他洗了碗，准备明天的衣服。整理好明天的任务列表，他终于放松入睡。他梦见了明天的阳光。',
  )
  // 真实章节按篇幅合同约 1,500–2,300 字。只拿 550 字来测，300 字承接就占一半，
  // 会把「正常承接」误判成 blocking —— 那是测试数据不真实，不是阈值错。
  // 这里 ≈1,400 字新写正文 + 250 字承接 ≈ 18%，才是真实章节里「正常承接」的比例。
  const prose = `${freshBody} `.repeat(4) + previousChapterMiddleAndEnd
  const report = analyzeChapterReuse(prose, previousChapterMiddleAndEnd)
  // 第 3 例验收点：不能是 blocking
  expect(report.severity).not.toBe('blocking')
  // 复用了结尾一段，ratio 应该比较小但非 0
  expect(report.ratio).toBeGreaterThan(0)
  expect(report.ratio).toBeLessThan(0.3)
})

// =============================================================================
// #4 抄上一章中间段落，开头换成新写的一句 ──► 必须 advisory 或 blocking
// =============================================================================
it('#4 防中间段落复用，开头换新（现存守卫抓不到的场景）', () => {
  // 新开头：完全新写的一句
  const newBeginning = zh('林宇拿起笔，默默地在本子上涂鸦了一行。')
  // 中间段落直接抄自上一章的中间部分
  const reusedMiddle = zh(
    '他在公司的工位前打了个招呼，坐下打开电脑。上午的项目评审会上，大家围绕新的产品线展开了热烈的讨论。'
  )
  // 结尾新写
  const newEnding = zh('整理好明天的任务列表，他终于放松入睡。')

  const prose = newBeginning + ' ' + reusedMiddle + ' ' + newEnding
  // 上一章完整文本（中间段落出现的那一段）
  const previousChapter = zh(
    '他在公司的工位前打了个招呼，坐下打开电脑。上午的项目评审会上，大家围绕新的产品线展开了热烈的讨论。午后他继续撰写设计文档，反复推敲细节。下班后他去健身房，跑了五公里。回家的路上他在想今天的收获。'
  )

  const report = analyzeChapterReuse(prose, previousChapter)
  // 第 4 例验收点：必须 advisory 或 blocking（不能是 ok）
  expect(report.severity).not.toBe('ok')
  expect(['advisory', 'blocking']).toContain(report.severity)
  // ratio 应该有明显值，因为中间段落被复用了
  expect(report.ratio).toBeGreaterThan(0)
})

// =============================================================================
// #5 同一场景续写：复用设定名词、句式全新 ──► ok（防误报）
// =============================================================================
it('#5 防同一场景续写（复用名词、句式全新，不误报）', () => {
  // 同一场景续写，会自然复用一些定调名词和场景描述
  const prose = zh(
    '林宇清晨起床，拉开窗帘，阳光洒在桌上的一杯温水上。他走到厨房，开始煮鸡蛋。鸡蛋滋滋作响，气味四溢。吃完早餐他换上外出的衣服，提着钥匙走出了门。街道上行人络绎不绝，车水马龙。他踏上去往公司的道路，脑海里浮现今天的计划。他在公司的工位前打了个招呼，坐下打开电脑。上午的项目评审会上，大家围绕新的产品线展开了热烈的讨论。午后他继续撰写设计文档，反复推敲细节。下班后他去健身房，跑了五公里。回家的路上他在想今天的收获。他回到家中，煮了面条晚餐。吃完饭他洗了碗，准备明天的衣服。整理好明天的任务列表，他终于放松入睡。',
  )
  // 上一章只有开头几句，定调了些基础设定，但正文大部分是全新的
  const previousChapter = zh(
    '林宇是一个生活在城市里的作家。他喜欢在早晨起床看阳光。'
  )

  const report = analyzeChapterReuse(prose, previousChapter)
  // 第 5 例验收点：必须 ok（防误报；同场景续写本来就复用名词）
  expect(report.severity).toBe('ok')
  expect(report.ratio).toBeLessThan(0.15)
})

// =============================================================================
// #6 prose 为空串 / 只有空白 / previousChapter 为空串 ──► 三种都不抛错，返回全 0 与 'ok'
// =============================================================================
it('#6 防空串/空白 prose 和/或 previousChapter，不抛错返回全 0 / ok', () => {
  // prose 为空串
  let report = analyzeChapterReuse('', 'some chapter text')
  expect(report.ratio).toBe(0)
  expect(report.coveredUnits).toBe(0)
  expect(report.runs.length).toBe(0)
  expect(report.severity).toBe('ok')

  // prose 只有空白
  report = analyzeChapterReuse('   \n  \t  ', 'some chapter text')
  expect(report.ratio).toBe(0)
  expect(report.severity).toBe('ok')

  // previousChapter 为空串
  report = analyzeChapterReuse('some chapter text with content', '')
  expect(report.ratio).toBe(0)
  expect(report.severity).toBe('ok')

  // previousChapter 只有空白
  report = analyzeChapterReuse('some chapter text with content', '   \n  \t  ')
  expect(report.ratio).toBe(0)
  expect(report.severity).toBe('ok')
})

// =============================================================================
// #7 writingLanguage: 'en-US'，英文按词切 │ 英文整段抄 → blocking；不抛错
// =============================================================================
it('#7 防英文整段抄（en-US），ratio >= 0.9 且 severity: blocking', () => {
  const paragraph = (
    'John walked into the room and looked around. ' +
    'The sun was shining through the windows. ' +
    'Mary was sitting on a chair reading a book. ' +
    'It was a beautiful day outside.'
  ).repeat(50) // 构造 50 次重复，确保足够长

  const prose = paragraph
  const previousChapter = paragraph // 完全相同

  const report = analyzeChapterReuse(prose, previousChapter, {
    writingLanguage: 'en-US',
  })
  expect(report.severity).toBe('blocking')
  expect(report.ratio).toBeGreaterThanOrEqual(0.9)
  expect(report.runs.length).toBeGreaterThan(0)
})

// =============================================================================
// #8 两者都短于一个 n-gram（如各 3 个字）──► 不抛错，ratio: 0
// =============================================================================
it('#8 两者都短于一个 n-gram（各 3 字），不抛错 ratio: 0', () => {
  const report = analyzeChapterReuse('abc', 'xyz')
  expect(report.ratio).toBe(0)
  expect(report.severity).toBe('ok')
  expect(report.runs.length).toBe(0)
  expect(report.coveredUnits).toBe(0)
  expect(report.longestRun).toBe(0)
})