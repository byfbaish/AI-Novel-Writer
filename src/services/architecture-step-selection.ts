export type ArchStepKey = 'premise' | 'characters' | 'worldbuilding' | 'plotStructure' | 'synopsis'

const ARCH_STEP_ORDER: ArchStepKey[] = ['premise', 'characters', 'worldbuilding', 'plotStructure', 'synopsis']

/**
 * 架构步骤的默认勾选 = **并集**：
 *   ① `archStatus` 里**未生成**（falsy）的步骤；
 *   ② `initialSelectedSteps`（显式指定，例如「只补情节大纲」）。
 *
 * ⚠️ **缺键即未生成**：`archStatus` 少一个键（如新增第五步 `plotStructure` 后仍只传旧四键）
 * 会被当作 falsy ⇒ 该步**被自动勾选**，调用方拿到的 `selectedSteps` 就多一项。
 * 生产侧由文件存在性算全五键；测试若手写 `archStatus`，**必须写全**。
 */
export function createDefaultArchitectureSelection(
  archStatus: Record<string, boolean>,
  initialSelectedSteps?: ArchStepKey[],
): Record<ArchStepKey, boolean> {
  const selected = new Set<ArchStepKey>()

  for (const step of ARCH_STEP_ORDER) {
    if (!archStatus[step]) selected.add(step)
  }

  if (initialSelectedSteps) {
    for (const step of initialSelectedSteps) {
      selected.add(step)
    }
  }

  return {
    premise: selected.has('premise'),
    characters: selected.has('characters'),
    worldbuilding: selected.has('worldbuilding'),
    plotStructure: selected.has('plotStructure'),
    synopsis: selected.has('synopsis'),
  }
}
