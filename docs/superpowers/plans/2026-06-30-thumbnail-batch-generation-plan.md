# 缩略图批量生成优化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化扫描导入流程的缩略图生成性能，采用并行批量处理 + CatmullRom 插值算法双管齐下

**Architecture:** 利用 rayon 分批并行生成缩略图（每批 20 张），改用 CatmullRom 替代 Lanczos3 插值算法，大幅提升处理速度

**Tech Stack:** Rust (rayon, image crate), SQLite, Tauri 2.0

---

### Task 1: 修改 thumbnail.rs 插值算法

**Files:**
- Modify: `src-tauri/src/thumbnail.rs`

- [ ] **Step 1: 修改 FilterType 从 Lanczos3 改为 CatmullRom**

定位到第 26 行：

```rust
// 修改前 (第 26 行)
let scaled = img.resize(THUMB_WIDTH, new_height, FilterType::Lanczos3);

// 修改后
let scaled = img.resize(THUMB_WIDTH, new_height, FilterType::CatmullRom);
```

**验证：** 运行 `cd src-tauri && cargo check` 确认无编译错误

---

### Task 2: 新增 batch_generate_thumbnails 函数

**Files:**
- Modify: `src-tauri/src/media.rs`

- [ ] **Step 1: 添加 rayon 相关导入（如果没有）**

确认文件顶部已有：
```rust
use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
```

如果没有，在 `use crate::video;` 后添加。

- [ ] **Step 2: 添加 HashMap 导入**

```rust
use std::collections::HashMap;
```

- [ ] **Step 3: 在文件末尾（或其他合适位置）添加 batch_generate_thumbnails 函数**

```rust
/// 批量并行生成缩略图
/// 输入: Vec<(dest_path, uuid, project_id)>
/// 输出: HashMap<uuid, thumbnail_path或None>
pub fn batch_generate_thumbnails(
    photos: &[(String, String, i64)],  // (dest_path, uuid, project_id)
) -> HashMap<String, Option<String>> {
    photos.par_iter()
        .map_init(
            || (),  // 每个线程独立的资源（当前无需预分配）
            |(), (dest_path, uuid, project_id)| {
                match thumbnail::generate_thumbnail(dest_path, *project_id, uuid) {
                    Ok(path) => (uuid.clone(), Some(path)),
                    Err(e) => {
                        eprintln!("缩略图生成失败 {}: {}", dest_path, e);
                        (uuid.clone(), None)
                    }
                }
            },
        )
        .collect()
}
```

**验证：** 运行 `cd src-tauri && cargo check` 确认无编译错误

---

### Task 3: 改造 scan_media_folder 函数

**Files:**
- Modify: `src-tauri/src/media.rs`

- [ ] **Step 1: 在处理照片循环之前，添加 thumb_tasks 收集**

找到 `scan_media_folder` 函数中处理照片的位置（约在 782-813 行），在 `let dest_path_str = ...` 之前添加：

```rust
// 用于批量生成缩略图的任务列表
let mut thumb_tasks: Vec<(String, String, i64)> = Vec::new();
```

然后在 `let uuid = ...` 之后，`let thumb_path = ...` 之前，将任务添加到列表：

```rust
// Extract UUID from dest filename — format is {uuid}_{original_name}
let uuid = result.dest_path
    .file_name()
    .and_then(|n| n.to_str())
    .and_then(|s| s.split('_').next())
    .unwrap_or("unknown")
    .to_string();

// 添加到批量生成任务列表
thumb_tasks.push((dest_path_str.clone(), uuid.clone(), project_id));
```

- [ ] **Step 2: 注释掉原来的单张生成逻辑**

将原来的单张缩略图生成代码（约 793-800 行）注释掉或删除：

```rust
// 注释掉原来的单张生成:
// let thumb_path = match thumbnail::generate_thumbnail(&dest_path_str, project_id, &uuid) {
//     Ok(p) => Some(p),
//     Err(e) => {
//         eprintln!("Thumbnail generation failed for {}: {}", dest_path_str, e);
//         None
//     }
// };
```

- [ ] **Step 3: 在照片循环结束后，批量生成缩略图**

在 `// 统计 skip` 之前（约在 853 行），添加：

```rust
// 批量并行生成缩略图
let thumb_results = batch_generate_thumbnails(&thumb_tasks);
```

- [ ] **Step 4: 修改构建 NewPhoto 的地方，使用 thumb_results**

找到构建 NewPhoto 的位置（约在 802-813 行），将：

```rust
let new_photo = NewPhoto {
    period_id: result.period_id,
    file_path: dest_path_str,
    file_name: result.file_name.clone(),
    file_size: result.file_size,
    width: result.width,
    height: result.height,
    taken_at: Some(result.date_str.clone()),
    thumbnail_path: thumb_path,  // 需要修改这里
    source: "scan".to_string(),
};
```

改为：

```rust
// 从批量结果中获取缩略图路径
let thumb_path = thumb_results.get(&uuid).cloned().flatten();

let new_photo = NewPhoto {
    period_id: result.period_id,
    file_path: dest_path_str,
    file_name: result.file_name.clone(),
    file_size: result.file_size,
    width: result.width,
    height: result.height,
    taken_at: Some(result.date_str.clone()),
    thumbnail_path: thumb_path,
    source: "scan".to_string(),
};
```

**验证：** 运行 `cd src-tauri && cargo check` 确认无编译错误

---

### Task 4: 改造 scan_period_folder 函数

**Files:**
- Modify: `src-tauri/src/media.rs`

- [ ] **Step 1: 在处理照片循环之前，添加 thumb_tasks 收集**

找到 `scan_period_folder` 函数（约在 1033 行 `for result in &results`），在循环开始前添加：

```rust
// 用于批量生成缩略图的任务列表
let mut thumb_tasks: Vec<(String, String, i64)> = Vec::new();
```

- [ ] **Step 2: 在循环内添加任务收集**

在 `let dest_path_str = result.dest_path...` 之后（约 1037 行），添加 UUID 提取和任务收集：

```rust
// Extract UUID from dest filename — format is {uuid}_{original_name}
let uuid = result.dest_path
    .file_name()
    .and_then(|n| n.to_str())
    .and_then(|s| s.split('_').next())
    .unwrap_or("unknown")
    .to_string();

// 添加到批量生成任务列表
thumb_tasks.push((dest_path_str.clone(), uuid.clone(), project_id));
```

- [ ] **Step 3: 注释掉原来的单张生成逻辑**

将原来的单张缩略图生成代码（约 1047-1054 行）注释掉：

```rust
// 注释掉原来的单张生成:
// let thumb_path = match thumbnail::generate_thumbnail(&dest_path_str, project_id, &uuid) {
//     Ok(p) => Some(p),
//     Err(e) => {
//         eprintln!("Thumbnail generation failed for {}: {}", dest_path_str, e);
//         None
//     }
// };
```

- [ ] **Step 4: 在照片循环结束后，批量生成缩略图**

在 `for result in &results` 循环结束后，`ProcessResult` 构建之前（约 1100 行），添加：

```rust
// 批量并行生成缩略图
let thumb_results = batch_generate_thumbnails(&thumb_tasks);
```

- [ ] **Step 5: 修改构建 NewPhoto 的地方，使用 thumb_results**

找到构建 NewPhoto 的位置（约在 1056-1066 行），将：

```rust
// Generate thumbnail (non-fatal: degrade gracefully if it fails)
let thumb_path = match thumbnail::generate_thumbnail(&dest_path_str, project_id, &uuid) {
    Ok(p) => Some(p),
    Err(e) => {
        eprintln!("Thumbnail generation failed for {}: {}", dest_path_str, e);
        None
    }
};

new_photos.push(NewPhoto {
    period_id: result.period_id,
    file_path: dest_path_str,
    file_name: result.file_name.clone(),
    file_size: result.file_size,
    width: result.width,
    height: result.height,
    taken_at: Some(result.date_str.clone()),
    thumbnail_path: thumb_path,  // 需要修改这里
    source: "scan".to_string(),
});
```

改为：

```rust
// 从批量结果中获取缩略图路径
let thumb_path = thumb_results.get(&uuid).cloned().flatten();

new_photos.push(NewPhoto {
    period_id: result.period_id,
    file_path: dest_path_str,
    file_name: result.file_name.clone(),
    file_size: result.file_size,
    width: result.width,
    height: result.height,
    taken_at: Some(result.date_str.clone()),
    thumbnail_path: thumb_path,
    source: "scan".to_string(),
});
```

**验证：** 运行 `cd src-tauri && cargo check` 确认无编译错误

---

### Task 5: 编译验证

**Files:**
- Modify: `src-tauri/src/media.rs`, `src-tauri/src/thumbnail.rs`

- [ ] **Step 1: 运行 cargo check**

```bash
cd src-tauri && cargo check
```

预期：无编译错误

- [ ] **Step 2: 运行 pnpm build**

```bash
pnpm build
```

预期：前端编译通过

- [ ] **Step 3: 可选 — 测试扫描性能**

如果有测试数据，运行扫描并观察缩略图生成时间是否有明显改善。
