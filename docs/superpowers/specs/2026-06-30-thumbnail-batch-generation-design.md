# 缩略图批量生成优化设计

> 日期: 2026-06-30 | 状态: 设计完成

## 概述

优化扫描导入流程中的缩略图生成性能，采用并行批量处理 + 快速插值算法双管齐下，解决扫描缓慢问题。

## 决策记录

| 决策 | 结论 |
|------|------|
| 并行化方案 | 使用 rayon 分批并行处理，每批 20 张照片 |
| 插值算法 | Lanczos3 → CatmullRom（~3-4x 速度提升，质量几乎无差异） |
| 错误处理 | 单张失败不影响全局，失败图片降级使用原图 |

---

## 一、性能分析

### 1.1 当前瓶颈

| 环节 | 问题 | 影响 |
|------|------|------|
| 缩略图生成 | 串行处理，每张照片逐一执行 | N 张照片耗时 N × 单张耗时 |
| 图像缩放 | Lanczos3 插值计算密集 | 单张耗时 ~100-300ms（取决于原图尺寸） |

### 1.2 优化潜力

假设扫描 1000 张照片：
- **串行**：1000 × 200ms = 200 秒
- **并行(4核) + 快速算法**：1000 ÷ 4 × 50ms = 12.5 秒
- **理论提升**：~16x

---

## 二、并行批量处理设计

### 2.1 架构变更

```
原流程:
  scan_media_folder()
    → for each photo:
        copy_file()
        generate_thumbnail()  // 串行
        insert_db()

新流程:
  scan_media_folder()
    → for each photo:
        copy_file()           // 串行复制
    → batch_generate_thumbnails()  // 并行批量生成
    → insert_db()
```

### 2.2 实现细节

**新增函数** `batch_generate_thumbnails`：

```rust
// media.rs
pub fn batch_generate_thumbnails(
    photos: &[(String, String, i64)],  // (dest_path, uuid, project_id)
) -> HashMap<String, Option<String>>  // uuid -> thumbnail_path
{
    const BATCH_SIZE: usize = 20;

    photos.par_iter()
        .map_init(
            || (),  // 每个线程独立的资源（如果需要）
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

**修改 `scan_media_folder`**：

```rust
// 1. 收集所有需要生成缩略图的照片信息
let mut thumb_tasks: Vec<(String, String, i64)> = Vec::new();
// ... 在处理每个照片时，收集 (dest_path, uuid, project_id)

// 2. 批量并行生成缩略图
let thumb_results = batch_generate_thumbnails(&thumb_tasks);

// 3. 在构建 NewPhoto 时查询结果
for result in &results {
    if result.is_photo {
        let uuid = extract_uuid(&result.dest_path);
        let thumb_path = thumb_results.get(&uuid).cloned().flatten();

        let new_photo = NewPhoto {
            // ... 其他字段
            thumbnail_path: thumb_path,
            source: "scan".to_string(),
        };
    }
}
```

### 2.3 内存控制

- **批次大小 20**：4 核 CPU 下，内存中同时存在 ~20 张图片
- **原图不驻留**：缩放完成后立即释放，单张 ~5-20MB
- **预估峰值内存**：20 × 20MB = 400MB（可接受）

---

## 三、插值算法优化

### 3.1 算法对比

| 算法 | 速度 | 质量 | 适用场景 |
|------|------|------|---------|
| Nearest | 最快 | 差（有锯齿） | 缩略图预览 |
| Linear | 快 | 一般 | 快速预览 |
| **CatmullRom** | 较快 | 良好 | **推荐** |
| Lanczos3 | 慢 | 最好 | 高质量需求 |

### 3.2 代码变更

[thumbnail.rs](file:///C:/Users/sesa621561/Documents/repos/baby-growth-video/src-tauri/src/thumbnail.rs) 第 26 行：

```rust
// 修改前
let scaled = img.resize(THUMB_WIDTH, new_height, FilterType::Lanczos3);

// 修改后
let scaled = img.resize(THUMB_WIDTH, new_height, FilterType::CatmullRom);
```

### 3.3 质量对比

CatmullRom vs Lanczos3 缩小 400px 时：
- 肉眼几乎无法区分
- 边缘略有平滑，但不影响观感
- 照片细节保留良好

---

## 四、错误处理

### 4.1 失败场景

| 场景 | 处理方式 |
|------|---------|
| 原图文件不存在 | thumbnail_path = None，回退原图 |
| 图片格式不支持 | thumbnail_path = None，日志警告 |
| 磁盘写入失败 | thumbnail_path = None，日志错误 |
| 权限不足 | thumbnail_path = None，日志错误 |

### 4.2 日志记录

```rust
// 批量生成结束后统计
let failed_count = thumb_results.values().filter(|v| v.is_none()).count();
if failed_count > 0 {
    eprintln!("批量生成完成: 成功 {} 张, 失败 {} 张", total - failed_count, failed_count);
}
```

---

## 五、受影响文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src-tauri/src/media.rs` | 修改 | 新增 batch_generate_thumbnails，改造 scan_media_folder/scan_period_folder |
| `src-tauri/src/thumbnail.rs` | 修改 | FilterType::Lanczos3 → FilterType::CatmullRom |

---

## 六、验证清单

- [ ] 扫描 100+ 照片，确认缩略图生成速度提升
- [ ] 确认生成的缩略图质量可接受
- [ ] 确认失败图片能正常回退到原图
- [ ] 内存占用无明显异常（可观察进程内存）
- [ ] 前后端编译通过
- [ ] Rust cargo check + pnpm build 均通过
