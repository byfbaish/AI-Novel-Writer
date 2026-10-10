export interface ArchFile {
  key: string
  fileName: string
  label: string
  iconName: string
  desc: string
}

export const ARCH_FILES: ArchFile[] = [
  { key: 'premise', fileName: 'premise.md', label: '故事前提', iconName: 'target', desc: 'Logline、核心冲突、金手指定位' },
  { key: 'characters', fileName: 'characters.md', label: '角色图谱', iconName: 'users', desc: '角色弧光、关系网、矛盾交织' },
  { key: 'worldbuilding', fileName: 'worldbuilding.md', label: '世界观', iconName: 'globe', desc: '核心规则、阶层断层、深层危机、空间结构' },
  { key: 'plotStructure', fileName: 'plot_structure.md', label: '阶段结构', iconName: 'compass', desc: '阶段划分、因果时序推进、篇幅约束' },
  { key: 'synopsis', fileName: 'synopsis.md', label: '情节大纲', iconName: 'map', desc: '三幕式情节骨架' },
]
