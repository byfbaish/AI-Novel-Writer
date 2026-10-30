/**
 * LanceDB 存储目录的路径判定 —— **只允许一份实现**。
 *
 * ## 为什么需要这条例外
 *
 * LanceDB 用硬链接做版本共享：`_versions/<n>.manifest` 与数据文件之间共享 inode，
 * 新版本只写增量、旧版本沿用同一 inode。所以 `.vela/lancedb/**`（或迁移期的
 * `lancedb/**`）下出现 `nlink > 1` 是**库的正常形态**，不是"同一份内容在磁盘上多处存在"。
 *
 * 2026-10-30 实测：`chunks.lance/_versions/1.manifest` 恒为 `nlink = 2`。不加这条例外时，
 * 任何"扫整棵项目树并检查 nlink === 1"的守卫都会在**与路径安全无关**的地方报错：
 *
 * - `legacy-project-copy-import.treeHash` → `LEGACY_IMPORT_UNSAFE_PATH`
 * - `vector-migration-snapshot.physicalManifest` → `VECTOR_MIGRATION_NONREGULAR_UNSUPPORTED`
 * - `project-format-migration.copyAsset` → `PROJECT_MIGRATION_UNSAFE_FILE`
 *
 * 后两者此前都被登记成"偶发 flake"，实际是必现的确定性失败（有 lancedb 表就红）。
 *
 * ## 例外的边界
 *
 * 放开的只是**硬链接**，且只在 lancedb 子树里。**符号链接永远拒绝** —— 那才是能指向
 * 项目外的逃逸形态；硬链接指向的外部内容是"读进来"，不是"写出去"。所以调用方仍然
 * 必须先判 `isSymbolicLink()`，本函数不替代那一步。
 */
const LANCE_SEGMENT = /(^|[\\/])lancedb([\\/]|$)/u

/** `file` 是否位于某个 `lancedb` 目录之下（含该目录本身）。 */
export function isLanceStoragePath(file: string): boolean {
  return LANCE_SEGMENT.test(file)
}
