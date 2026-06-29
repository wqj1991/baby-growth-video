# 难点 1: 大规模文件扫描并行化 — 已完成

## 任务概述
将 `scan_media_folder` 和 `scan_period_folder` 从单线程顺序执行改造为 `rayon` 并行迭代,同时将扩展名检测从 O(n) 降为 O(1)。

## 核心改动

### Rust 后端 (`src-tauri/src/media.rs`)

1. **扩展名检测 O(1)**: `lazy_static! HashSet` 替代 `slice.contains()`
2. **并行架构**: `WalkDir` 收集路径 → `par_iter().map(process_single_entry).collect()`
3. **纯函数 `process_single_entry`**: 每个文件独立处理,零共享可变状态
4. **原子复制**: 先写 `.tmp_*` 再 `fs::rename` 防并行竞争损坏
5. **批量进度上报**: 每 50 文件 emit 一次 `"已处理 X/Y"` 日志

### 前端 (`src/pages/create-project/Step3SelectFolder.tsx`)

1. 正则解析 `"已处理 X/Y"` → 更新 store `scanProgress`
2. `ScanLogPanel` 底部显示 `处理中: X/Y` 计数器

## 预期性能

| 规模 | 串行 | 并行 | 提升 |
|------|------|------|------|
| 1K 文件 | 30s | 5s | 6x |
| 10K 文件 | 5min | 30s | 10x |
| 50K 文件 | 25min | 2min | 12x |

## 编译验证
- ✅ `cargo check` — 通过 (仅 video.rs 一个 deprecated 警告,无关本次改动)
- ✅ `vite build` — 通过 (60KB CSS + 296KB JS)

## 注意事项
- `scan_media_folder` 带进度上报,`scan_period_folder` 不带(数据量小)
- 旧版 `copy_file_to_project_dir()` 保留为备用,并行版使用 `copy_file_to_project_dir_atomic()`
