# 预览功能查看源照片设计

## 概述

修改预览功能，使所有预览操作（缩略图双击预览、待选区预览）都显示原始分辨率的源照片，而非当前的 300px 缩略图。

## 问题分析

当前预览功能存在以下问题：

1. **后端 `get_original_file` 命令**：名字叫"获取原始文件"，但实际调用 `generate_thumbnail_base64_fixed`，返回的是 300px 宽的缩略图，与接口语义不符

2. **待选区预览**：直接使用 `thumb.base64_data`，也是 300px 的缩略图

3. **缩略图网格预览**：虽然调用了 `getOriginalFile`，但由于后端返回的是缩略图，显示的仍是低分辨率

## 设计方案

### 方案选择

采用**方案 A**：修改现有 `get_original_file` 接口，使其真正返回原始分辨率文件。

### 后端修改

#### 修改 `get_original_file` 命令

**文件**: `src-tauri/src/main.rs`

将当前调用 `generate_thumbnail_base64_fixed` 的逻辑改为直接读取原始文件内容并转为 base64。

#### 新增辅助函数

**文件**: `src-tauri/src/thumbnail.rs`

添加 `read_file_base64` 函数：
- 输入：文件路径
- 输出：包含正确 MIME 类型的 base64 data URL
- 功能：读取原始文件内容，根据文件扩展名确定 MIME 类型，转为 base64 返回

### 前端修改

#### 修改待选区预览

**文件**: `src/pages/PeriodSelectPage.tsx`

将 `handlePendingPreview` 函数改为调用 `getOriginalFile(thumb.id)` 获取原始分辨率图片。

#### `ThumbnailPreviewModal`

**文件**: `src/components/ThumbnailPreviewModal.tsx`

已正确调用 `getOriginalFile`，修改后端后自动获得原始分辨率图片。

### 数据流程

```
用户双击缩略图/待选区预览
    → 调用 getOriginalFile(thumbnail_id)
        → 后端查询数据库获取 original_path
            → 读取原始文件内容
                → 根据文件扩展名确定 MIME 类型
                    → 转为 base64 data URL
                        → 返回前端
                            → 显示原始分辨率图片
```

### 错误处理

- 文件不存在：返回错误，前端显示缩略图作为 fallback
- 文件读取失败：返回错误，前端显示缩略图作为 fallback
- 大文件读取：保持现有 loading 状态（loading spinner）

### 性能考虑

- 原始文件可能很大（几十 MB），转为 base64 后会增加约 33% 的体积
- 确保 loading 状态正确显示，避免用户以为应用卡死

## MIME 类型映射

根据文件扩展名确定 MIME 类型：

| 扩展名 | MIME 类型 |
|--------|-----------|
| .jpg, .jpeg | image/jpeg |
| .png | image/png |
| .webp | image/webp |
| .gif | image/gif |
| .bmp | image/bmp |
| 其他 | image/jpeg（默认） |

## 影响范围

- `src-tauri/src/main.rs`: 修改 `get_original_file` 命令
- `src-tauri/src/thumbnail.rs`: 新增 `read_file_base64` 函数
- `src/pages/PeriodSelectPage.tsx`: 修改待选区预览逻辑
- `src/components/ThumbnailPreviewModal.tsx`: 无需修改（已正确调用接口）