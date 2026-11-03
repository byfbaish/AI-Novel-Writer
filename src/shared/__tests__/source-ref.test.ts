import { describe, expect, it } from 'vitest'

import type { FinalizedSourceIdentity } from '../finalized-continuity'
import {
  hashAuthorText,
  isContentHash,
  isFinalizedSourceIdentity,
  mayUseCandidate,
  sameProjectEpoch,
  validateSourceRef,
  type CandidateAdmission,
  type CandidateSource,
  type ProjectEpoch,
  type SourceRef,
} from '../source-ref'

const VALID_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const UPPER_HEX = '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'

describe('isContentHash', () => {
  it('接受 64 位小写十六进制', () => {
    expect(isContentHash(VALID_HEX)).toBe(true)
  })

  it.each([
    ['空串', ''],
    ['只有空白', '   '],
    ['63 位', VALID_HEX.slice(0, 63)],
    ['65 位', VALID_HEX + '0'],
    ['大写 hex', UPPER_HEX],
    ['含非 hex 字符 g', VALID_HEX.slice(0, 63) + 'g'],
    ['含连字符', '01234567-89abcdef0123456789abcdef0123456789abcdef0123456789abcdef'],
    ['含点号', '01234567.89abcdef0123456789abcdef0123456789abcdef0123456789abcdef'],
  ])('拒绝非法输入：%s', (_, input) => {
    expect(isContentHash(input)).toBe(false)
  })

  it('异常输入 null/undefined 不抛错且为 false（按字符串化后判定）', () => {
    expect(isContentHash(null as unknown as string)).toBe(false)
    expect(isContentHash(undefined as unknown as string)).toBe(false)
  })
})

describe('isFinalizedSourceIdentity', () => {
  const valid: FinalizedSourceIdentity = {
    finalizationId: 'fin-2026-11-03-001',
    draftId: 42,
    chapterNumber: 3,
    contentHash: VALID_HEX,
  }

  it('全部字段合法时返回 true', () => {
    expect(isFinalizedSourceIdentity(valid)).toBe(true)
  })

  it.each([
    ['finalizationId 空串', { ...valid, finalizationId: '' }],
    ['finalizationId 只有空白', { ...valid, finalizationId: ' \t ' }],
    ['draftId 为 0', { ...valid, draftId: 0 }],
    ['draftId 为负数', { ...valid, draftId: -1 }],
    ['draftId 非整数', { ...valid, draftId: 1.5 }],
    ['draftId 超安全整数', { ...valid, draftId: Number.MAX_SAFE_INTEGER + 1 }],
    ['chapterNumber 为 0', { ...valid, chapterNumber: 0 }],
    ['chapterNumber 为负数', { ...valid, chapterNumber: -2 }],
    ['chapterNumber 非整数', { ...valid, chapterNumber: 2.5 }],
    ['contentHash 非法', { ...valid, contentHash: 'not-a-hash' }],
  ])('字段非法时返回 false：%s', (_, source) => {
    expect(isFinalizedSourceIdentity(source)).toBe(false)
  })

  it('异常输入：缺字段（finalizationId undefined）抛 TypeError', () => {
    const { finalizationId: _omitted, ...rest } = valid
    expect(() => isFinalizedSourceIdentity(rest as unknown as FinalizedSourceIdentity)).toThrow(TypeError)
  })
})

describe('sameProjectEpoch', () => {
  const a: ProjectEpoch = { projectId: 'proj-1', epoch: 'e3' }

  it('projectId 与 epoch 都相同返回 true', () => {
    expect(sameProjectEpoch(a, { projectId: 'proj-1', epoch: 'e3' })).toBe(true)
  })

  it.each([
    ['projectId 不同', { projectId: 'proj-2', epoch: 'e3' }],
    ['epoch 不同', { projectId: 'proj-1', epoch: 'e4' }],
    ['两个都不同', { projectId: 'proj-2', epoch: 'e4' }],
  ])('字段不同返回 false：%s', (_, b) => {
    expect(sameProjectEpoch(a, b)).toBe(false)
  })

  it('a 的 projectId 或 epoch 为空时返回 false（短路，不读 b）', () => {
    expect(sameProjectEpoch({ projectId: '', epoch: 'e3' }, a)).toBe(false)
    expect(sameProjectEpoch({ projectId: 'proj-1', epoch: '' }, a)).toBe(false)
    expect(sameProjectEpoch({ projectId: '', epoch: '' }, a)).toBe(false)
  })

  it('异常输入：a 为 null 抛 TypeError', () => {
    expect(() => sameProjectEpoch(null as unknown as ProjectEpoch, a)).toThrow(TypeError)
  })
})

describe('hashAuthorText', () => {
  it('空串返回已知 SHA-256', async () => {
    await expect(hashAuthorText('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('"abc" 返回已知 SHA-256', async () => {
    await expect(hashAuthorText('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('输出始终是 64 位小写 hex', async () => {
    const hash = await hashAuthorText('作者正文，含中文与标点。')
    expect(isContentHash(hash)).toBe(true)
  })

  it('同文本两次调用结果一致', async () => {
    const text = '同一段文本'
    expect(await hashAuthorText(text)).toBe(await hashAuthorText(text))
  })

  it('异常输入：null/undefined 不抛错，行为分别等于字符串化文本与空串', async () => {
    expect(await hashAuthorText(null as unknown as string)).toBe(await hashAuthorText('null'))
    // TextEncoder.encode(input = "")：显式 undefined 走默认参数 → 编码空串
    expect(await hashAuthorText(undefined as unknown as string)).toBe(await hashAuthorText(''))
  })
})

describe('validateSourceRef', () => {
  const current: ProjectEpoch = { projectId: 'proj-1', epoch: 'e3' }
  const text = '定稿正文第一句。'
  async function makeValidRef(overrides: unknown = {}): Promise<SourceRef> {
    return {
      projectId: 'proj-1',
      epoch: 'e3',
      sourceId: 'src-7',
      revision: 3,
      contentHash: await hashAuthorText(text),
      ...(overrides as Partial<SourceRef>),
    }
  }

  it('全部字段合法且无 span 时返回 true', async () => {
    await expect(validateSourceRef(await makeValidRef(), current, text)).resolves.toBe(true)
  })

  it('span 合法（含边界 end === text.length）时返回 true', async () => {
    const ref = await makeValidRef({ span: { start: 0, end: text.length, unit: 'utf16-code-unit' } })
    await expect(validateSourceRef(ref, current, text)).resolves.toBe(true)
  })

  it('span 合法（非零起点）时返回 true', async () => {
    const ref = await makeValidRef({ span: { start: 2, end: 4, unit: 'utf16-code-unit' } })
    await expect(validateSourceRef(ref, current, text)).resolves.toBe(true)
  })

  it.each([
    ['span.unit 错误', { span: { start: 0, end: 1, unit: 'code-point' as const } }],
    ['span.start 为负', { span: { start: -1, end: 1, unit: 'utf16-code-unit' } }],
    ['span.end 小于等于 start', { span: { start: 3, end: 3, unit: 'utf16-code-unit' } }],
    ['span.end 大于正文长度', { span: { start: 0, end: text.length + 1, unit: 'utf16-code-unit' } }],
    ['span.start 非安全整数', { span: { start: 1.5, end: 3, unit: 'utf16-code-unit' } }],
    ['span.end 非安全整数', { span: { start: 0, end: 2.5, unit: 'utf16-code-unit' } }],
  ])('span 非法时返回 false：%s', async (_, span) => {
    const ref = await makeValidRef({ span })
    await expect(validateSourceRef(ref, current, text)).resolves.toBe(false)
  })

  it.each([
    ['revision 为负', { revision: -1 }],
    ['revision 非整数', { revision: 1.5 }],
    ['sourceId 空串', { sourceId: '' }],
    ['epoch 不匹配当前', { epoch: 'e9' }],
    ['projectId 不匹配当前', { projectId: 'proj-x' }],
  ])('字段非法时返回 false：%s', async (_, overrides) => {
    const ref = await makeValidRef(overrides)
    await expect(validateSourceRef(ref, current, text)).resolves.toBe(false)
  })

  it('contentHash 与正文不匹配时返回 false', async () => {
    const ref = await makeValidRef({ contentHash: VALID_HEX })
    await expect(validateSourceRef(ref, current, text)).resolves.toBe(false)
  })

  it('异常输入：ref 为 null 抛 TypeError', async () => {
    await expect(validateSourceRef(null as unknown as SourceRef, current, text)).rejects.toThrow(TypeError)
  })
})

describe('mayUseCandidate', () => {
  const baseCandidate: CandidateSource = {
    projectId: 'proj-1',
    epoch: 'e3',
    artifactId: 'art-1',
    revision: 2,
    state: 'draft',
    saved: true,
    batchLineage: 'batch-9',
    fingerprint: {
      chapterBriefHash: VALID_HEX,
      authorGuidanceHash: VALID_HEX,
      dependencyHash: VALID_HEX,
      contextSnapshotHash: VALID_HEX,
      templateHash: VALID_HEX,
      skillSnapshotHash: VALID_HEX,
      modelLeaseRevision: 'm-1',
      policyHash: VALID_HEX,
      outputContractHash: VALID_HEX,
    },
  }
  const baseAdmission: CandidateAdmission = {
    projectId: 'proj-1',
    epoch: 'e3',
    batchLineage: 'batch-9',
    selectedCurrentDraftId: 'art-1',
  }

  it('selectedCurrentDraftId 匹配当前草稿时返回 true', () => {
    expect(mayUseCandidate(baseCandidate, baseAdmission)).toBe(true)
  })

  it('directPredecessorId 匹配且 batchLineage 一致时返回 true', () => {
    const admission: CandidateAdmission = {
      ...baseAdmission,
      selectedCurrentDraftId: undefined,
      directPredecessorId: 'art-1',
    }
    expect(mayUseCandidate(baseCandidate, admission)).toBe(true)
  })

  it.each([
    ['state 非 draft', { state: 'partial' }, baseAdmission],
    ['saved 为 false', { saved: false }, baseAdmission],
    ['artifactId 空串', { artifactId: '' }, baseAdmission],
    ['revision 为负', { revision: -1 }, baseAdmission],
    ['revision 非整数', { revision: 1.5 }, baseAdmission],
    ['epoch 不匹配', { epoch: 'e9' }, baseAdmission],
    ['projectId 不匹配', { projectId: 'proj-x' }, baseAdmission],
  ])('candidate 非法时返回 false：%s', (_, candidateOverrides, admission) => {
    expect(mayUseCandidate({ ...baseCandidate, ...(candidateOverrides as Partial<CandidateSource>) }, admission)).toBe(false)
  })

  it('batchLineage 为空但 directPredecessorId 匹配时返回 false', () => {
    const candidate = { ...baseCandidate }
    const admission: CandidateAdmission = {
      projectId: 'proj-1',
      epoch: 'e3',
      batchLineage: '',
      directPredecessorId: 'art-1',
    }
    expect(mayUseCandidate(candidate, admission)).toBe(false)
  })

  it('batchLineage 一致但 directPredecessorId 不匹配时返回 false', () => {
    const admission: CandidateAdmission = {
      ...baseAdmission,
      selectedCurrentDraftId: undefined,
      directPredecessorId: 'art-other',
    }
    expect(mayUseCandidate(baseCandidate, admission)).toBe(false)
  })

  it('selectedCurrentDraftId 与 batchLineage 路径都不匹配时返回 false', () => {
    const admission: CandidateAdmission = {
      ...baseAdmission,
      selectedCurrentDraftId: undefined,
      directPredecessorId: undefined,
    }
    expect(mayUseCandidate(baseCandidate, admission)).toBe(false)
  })
})
