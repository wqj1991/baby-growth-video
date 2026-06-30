# 缩略图体系与文件组织重构设计

> 日期: 2026-06-30 | 状态: 设计完成

## 概述

重构项目文件组织结构和图像加载策略，引入统一缩略图体系，优化待选区（Pending Selection）的数据聚合与删除逻辑。

## 决策记录

| 决策 | 结论 |
|------|------|
| 缩略图规格 | 宽 400px，JPEG 质量 75%，短边等比缩放 (~20-80KB) |
| 视频帧策略 | 截帧→缩略图入临时目录，点「加入待选区」才持久化原帧 |
| 待选区删除 | 扫描照片仅取消 is_selected 标记；拼图/视频帧物理删除 + 缩略图一并删 |
| 文件组织 | 缩略图归入项目目录 `thumbnails/`，项目作为整体单元管理 |
| 命名规范 | `{uuid}_thumb.jpg`，无中文 |

---

## 一、磁盘文件结构

```
projects/{project_id}/
  photos/                          # 扫描导入的原图
    {uuid}_original.jpg
  videos/                          # 扫描导入的视频
    {uuid}_original.mp4
  collages/                        # 拼图原图
    {uuid}_collage.jpg
  frames/                          # 已加入待选的视频帧原图（延迟持久化）
    {uuid}_frame.jpg
  thumbnails/                      # 统一缩略图（三源：photo+collage+frame）
    {uuid}_thumb.jpg               # 通过 UUID 与原图一一映射
  ai_frames/
  agnes_temp/
  scan-log.json
```

### 关键规则

- 缩略图文件名 = 对应原图 UUID + `_thumb.jpg`
- `frames/` 仅在用户点击「加入待选区」时才落盘
- 视频截帧预览期间，缩略图暂存临时目录，持久化时移入 `thumbnails/`
- 全局限 `frames/{video_id}/` 目录废弃，视频帧统一归入项目目录

---

## 二、数据库变更

### 2.1 photos 表新增字段

```sql
ALTER TABLE photos ADD COLUMN thumbnail_path TEXT;
ALTER TABLE photos ADD COLUMN source TEXT DEFAULT 'scan';  -- 'scan' | 'collage'
```

### 2.2 video_frames 表新增字段

```sql
ALTER TABLE video_frames ADD COLUMN thumbnail_path TEXT;
```

注: `file_path` 在加入待选区前为空，持久化后才有值。SQLite 不强制 NOT NULL，应用层保证。

### 2.3 新增 video_frame_temp 表

```sql
CREATE TABLE video_frame_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    time_seconds REAL NOT NULL,
    temp_thumb_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);
```

### 2.4 数据流

```
generate_video_frames
  → FFmpeg 截帧 → 生成缩略图(临时目录)
  → INSERT video_frame_temp

用户点 [加入待选区]
  → persist_video_frame
    → 截取原分辨率帧 → projects/{id}/frames/{uuid}_frame.jpg
    → 移动缩略图 → projects/{id}/thumbnails/{uuid}_thumb.jpg
    → INSERT video_frames (含 thumbnail_path)
    → DELETE FROM video_frame_temp

用户点 [放弃] / 关闭
  → discard_temp_frames
    → DELETE FROM video_frame_temp
    → fs::remove_file(temp_thumb_path)
```

---

## 三、Rust 后端变更

### 3.1 新增 Tauri Commands

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `generate_thumbnail` | source_path, project_id, uuid | thumbnail_path | 生成 400px JPEG 75% 缩略图 |
| `persist_video_frame` | temp_id | VideoFrame | 临时帧→正式持久化 |
| `discard_temp_frames` | video_id | () | 放弃所有临时帧 |
| `delete_selected_item` | item_type, item_id | () | 待选区删除统一入口 |
| `get_pending_items` | period_id | Vec\<SelectableItem\> | 聚合查询待选 photos + video_frames |

### 3.2 改造现有流程

**扫描导入 (media.rs)**:
```
原: 复制原图 → insert photo
新: 复制原图 → generate_thumbnail → insert photo (含 thumbnail_path)
```

**拼图生成 (collage.rs)**:
```
原: 生成拼图 → create_collage_photo
新: 生成拼图 → generate_thumbnail → create_collage_photo (含 thumbnail_path, source='collage')
```

**视频截帧 (video.rs)**:
```
原: generate_video_frames → 直接 insert video_frames
新: generate_video_frames → 生成临时缩略图 → insert video_frame_temp
     用户加待选 → persist_video_frame → 截原帧+移缩略图 → insert video_frames
     用户放弃   → discard_temp_frames → 清理
```

### 3.3 删除策略 (`delete_selected_item`)

```rust
match item_type {
    "photo" => {
        // 扫描照片 (photos.source = 'scan'): 仅取消 is_selected，保留文件和 DB 记录
        UPDATE photos SET is_selected = 0 WHERE id = ?
    }
    "collage" => {
        // 拼图 (photos.source = 'collage'): 删 DB 记录 + 删原图 + 删缩略图
        DELETE FROM photos WHERE id = ?
        fs::remove_file(collage_path)
        fs::remove_file(thumb_path)
    }
    "video_frame" => {
        // 视频帧: 删 DB 记录 + 删原帧 + 删缩略图
        DELETE FROM video_frames WHERE id = ?
        fs::remove_file(frame_path)
        fs::remove_file(thumb_path)
    }
}
```

### 3.4 缩略图生成 (`generate_thumbnail`)

- 使用 `image` crate: 打开原图 → resize (Lanczos3, 宽 400px, 等比) → JPEG encoder (quality 75)
- 输出: `projects/{project_id}/thumbnails/{uuid}_thumb.jpg`
- 预先创建 `thumbnails/` 目录

---

## 四、前端变更

### 4.1 加载策略

```
原: 所有列表/网格 → getImageBase64(file_path)       # 加载原图
新: 所有列表/网格 → getImageBase64(thumbnail_path)   # 加载缩略图
    仅 PhotoDetailModal → getImageBase64(file_path)  # 点详情才拉原图
```

### 4.2 受影响组件

| 组件 | 变更 |
|------|------|
| `PhotoCard.tsx` | `file_path` → `thumbnail_path` 加载缩略图 |
| `VideoFramePlayer.tsx` | 截帧后展示临时缩略图；按钮改为「加入待选区 / 放弃」 |
| `PendingSelectionPanel.tsx` | 新增删除按钮 + loading 状态；区分三种来源标签 |
| `PeriodSelectPage.tsx` | 加载 `get_pending_items` 替代分别查询 photos + video_frames |
| `CollageWorkspace.tsx` | 生成拼图后自动触发缩略图生成；预览仍用原图 |

### 4.3 Zustand Store 变更

```ts
// useAppStore 新增
pendingItems: SelectableItem[]         // 替代 selectedItems
pendingLoading: boolean                // 待选区加载状态
deletingItemId: number | null          // 正在删除的 item id（loading 用）

// 新增 actions
loadPendingItems(periodId: number)
deletePendingItem(itemType: 'photo' | 'collage' | 'video_frame', itemId: number)
persistVideoFrame(tempId: number)
discardTempFrames(videoId: number)
```

### 4.4 TypeScript 类型

```ts
interface SelectableItem {
  type: 'photo' | 'collage' | 'video_frame'  // 新增 collage
  item: Photo | VideoFrame
  source?: 'scan' | 'collage' | 'frame'       // 来源标记
}
```

---

## 五、边缘情况

| 场景 | 处理 |
|------|------|
| 缩略图生成失败 | 回退到加载原图（降级策略），记录 warning 日志 |
| 原图已被外部删除 | 跳过缩略图加载，显示占位图 + 错误提示 |
| 并发删除同一 item | 幂等处理：文件不存在时不报错，DB 删除用 IF EXISTS |
| 项目删除 | CASCADE 删除所有子记录；同时清理整个项目目录（含 thumbnails/） |
| 磁盘空间不足 | 缩略图写入失败时捕获错误，不阻塞主流程 |
| 旧数据迁移 | DB migration 为已有 photo/video_frame 补充缩略图（后台异步） |
