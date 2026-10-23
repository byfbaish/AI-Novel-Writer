import { reviewRevisionAiBrief, reviewRevisionAuthorMaterial, type ReviewAuthorMaterialOmittable, type ReviewRevisionContext } from '../../../shared/review-revision-generation'
import { keyEventsText } from '../../../shared/blueprint-key-events'
import { renderPrewriteFactLine } from '../../../shared/prewrite-consultation'
import { hashAuthorText } from '../../../shared/source-ref'
import { promptLanguageText } from '../../prompt-language'
import { selectReviewRevisionMaterials, unknownReviewMaterialIdentity, type ChapterMaterialIdentity, type ReviewRevisionMaterial } from '../chapter-materials'

export function reviewHistoryMaterials(frozen: ReviewRevisionContext, current: ChapterMaterialIdentity): ReviewRevisionMaterial[] {
  const text = (zh: string, en: string) => promptLanguageText(frozen.writingLanguage, zh, en)
  return [...frozen.history, ...(frozen.predecessor ? [frozen.predecessor] : [])].map(item => ({
    identity: item.identity ?? unknownReviewMaterialIdentity(current),
    category: 'finalized-history',
    required: item.chapterNumber === frozen.source.chapterNumber - 1,
    text: [
      text(`【第${item.chapterNumber}章${item === frozen.predecessor ? '已选保存前驱｜可能含未解决问题，不覆盖作者设定' : '定稿历史'}】`,
        `[Chapter ${item.chapterNumber} ${item === frozen.predecessor ? 'selected saved predecessor | unresolved issues may remain; does not override author settings' : 'finalized history'}]`),
      item.content,
      // P0-2：正文链的「前文事实」也调这一行渲染，两条链对同一条事实只有一种措辞（判据 DM）。
      ...(item.projection?.sourceStatus === 'current' ? (item.projection.facts ?? []).map(fact =>
        renderPrewriteFactLine(fact, frozen.writingLanguage)) : []),
    ].join('\n'),
  }))
}

export async function selectFrozenReviewRevisionMaterials(
  frozen: ReviewRevisionContext,
  current: ChapterMaterialIdentity,
  /**
   * P7：省略「已由模板变量单独注入」的作者材料字段（世界观 / 角色状态），避免同一份材料
   * 进请求两遍。调用方**必须**用 `authorMaterialOmitForOperation(operation)` 单点判定
   * （主进程会用同一函数重算 contentHash 核对）。
   */
  options?: { omit?: readonly ReviewAuthorMaterialOmittable[] },
) {
  const author = reviewRevisionAuthorMaterial(frozen, options)
  const ai = reviewRevisionAiBrief(frozen)
  const materials: ReviewRevisionMaterial[] = [{ identity: { projectId: current.projectId,
    sourceId: 'author:required', revision: 1, contentHash: await hashAuthorText(author), provenance: 'author' },
  category: 'author', required: true, text: author }, ...reviewHistoryMaterials(frozen, current)]
  if (ai) materials.push({ identity: { projectId: current.projectId,
    sourceId: `review:confirmed:${frozen.confirmation!.reviewSourceId}`, revision: frozen.confirmation!.reviewSourceId,
    contentHash: await hashAuthorText(ai), provenance: 'derived' }, category: 'future-plan', required: true, text: ai })
  const blueprint = frozen.blueprints.find(item => item.chapterNumber === frozen.source.chapterNumber)
  return selectReviewRevisionMaterials({ current, writingLanguage: frozen.writingLanguage, materials,
    // Optional history keeps its local allowance; main admits the complete request including all required material.
    budgetChars: 8_000,
    relevanceTerms: [blueprint?.title ?? '', keyEventsText(blueprint?.keyEvents), ...(blueprint?.characters ?? [])] })
}
