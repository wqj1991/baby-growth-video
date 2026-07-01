# 统一缩略表设计方案

## 概述

将 `photos` 表和 `video_frames` 表合并为统一的 `thumbnails` 表，直接在缩略表中存储源文件路径，简化数据模型和查询逻辑。

## 1. 数据库架构

### 1.1 新表 `thumbnails`

```sql
CREATE TABLE IF NOT EXISTS thumbnails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'scan',
    source_id INTEGER,
    original_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    original_width INTEGER NOT NULL DEFAULT 0,
    original_height INTEGER NOT NULL DEFAULT 0,
    original_file_size INTEGER NOT NULL DEFAULT 0,
    base64_data TEXT,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    is_selected INTEGER NOT NULL DEFAULT 0,
    is_final INTEGER NOT NULL DEFAULT 0,
    taken_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES videos(id) ON DELETE CASCADE
);
```

### 1.2 source_type 值说明

| 值 | 说明 |
|----|------|
| scan | 扫描导入的照片 |
| video_frame | 从视频中提取的帧 |
| collage | 拼图合成图片 |

### 1.3 保留的表

- `babies` - 宝宝信息
- `projects` - 项目信息
- `periods` - 周期信息
- `videos` - 视频元数据（时长、分辨率等）
- `export_records` - 导出记录
- `settings` - 设置
- `video_frame_temp` - 视频临时帧（预览用）

### 1.4 删除的表

- `photos` - 照片表
- `video_frames` - 视频截图表

## 2. 数据模型

### 2.1 后端结构体（Rust）

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Thumbnail {
    pub id: i64,
    pub project_id: i64,
    pub period_id: i64,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub original_path: String,
    pub original_file_name: String,
    pub original_width: i64,
    pub original_height: i64,
    pub original_file_size: i64,
    pub base64_data: Option<String>,
    pub width: i64,
    pub height: i64,
    pub is_selected: bool,
    pub is_final: bool,
    pub taken_at: Option<String>,
    pub created_at: String,
}

pub struct NewThumbnail {
    pub project_id: i64,
    pub period_id: i64,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub original_path: String,
    pub original_file_name: String,
    pub original_width: i64,
    pub original_height: i64,
    pub original_file_size: i64,
    pub base64_data: Option<String>,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
}
```

### 2.2 前端类型（TypeScript）

```typescript
export interface Thumbnail {
  id: number;
  project_id: number;
  period_id: number;
  source_type: 'scan' | 'video_frame' | 'collage';
  source_id?: number;
  original_path: string;
  original_file_name: string;
  original_width: number;
  original_height: number;
  original_file_size: number;
  base64_data: string;
  width: number;
  height: number;
  is_selected: boolean;
  is_final: boolean;
  taken_at?: string;
  created_at: string;
}
```

## 3. 核心数据流程

### 3.1 文件扫描流程（照片）

```
扫描文件夹 → 提取日期 → 匹配周期 → 复制文件 → 生成缩略图(base64) → 插入 thumbnails 表
```

### 3.2 视频帧提取流程

```
选择视频 → 生成临时帧 → 预览选择 → 持久化到 thumbnails 表(source_type=video_frame)
```

### 3.3 拼图生成流程

```
选择照片 → 生成拼图 → 生成缩略图(base64) → 插入 thumbnails 表(source_type=collage)
```

## 4. API 命令变更

### 4.1 新增命令

| 命令 | 功能 |
|------|------|
| get_period_thumbnails(period_id) | 获取周期内所有缩略图 |
| add_thumbnails(thumbnails) | 批量添加缩略图 |
| update_thumbnail(thumbnail) | 更新缩略图状态 |
| set_final_thumbnail(period_id, thumbnail_id) | 设置最终缩略图 |
| cancel_final_thumbnail(period_id) | 取消最终缩略图 |
| delete_thumbnail(thumbnail_id) | 删除缩略图 |
| get_thumbnail_by_id(id) | 获取单个缩略图 |

### 4.2 删除命令

| 命令 | 替代方案 |
|------|----------|
| get_period_photos | get_period_thumbnails |
| update_photo | update_thumbnail |
| set_final_photo | set_final_thumbnail |
| cancel_final_photo | cancel_final_thumbnail |
| delete_photo | delete_thumbnail |
| create_collage_photo | 直接插入 thumbnails 表 |
| get_video_frames | get_period_thumbnails(source_type=video_frame) |
| get_period_video_frames | get_period_thumbnails |
| set_final_video_frame | set_final_thumbnail |
| update_video_frame | update_thumbnail |
| cancel_final_video_frame | cancel_final_thumbnail |

### 4.3 修改命令

| 命令 | 修改内容 |
|------|----------|
| scan_media_folder | 返回 Thumbnail[] 而非 Photo[] |
| scan_period_folder | 返回 Thumbnail[] 而非 Photo[] |
| generate_collage | 插入 thumbnails 表 |
| persist_video_frame | 插入 thumbnails 表 |
| delete_selected_item | 操作 thumbnails 表 |
| get_pending_items | 从 thumbnails 表查询 |

## 5. 周期统计变更

`get_period_stats` 返回的统计数据从以下表获取：

| 统计项 | 来源 |
|--------|------|
| scan_count | thumbnails 表 (source_type='scan') |
| video_count | videos 表 |
| pending_count | thumbnails 表 (is_selected=1) |
| has_final | thumbnails 表 (is_final=1) |

## 6. 前端状态管理变更

### 6.1 Store 变更

- 删除 `photos`、`videoFrames` 状态
- 统一使用 `thumbnails` 状态
- 修改所有相关 action

### 6.2 组件变更

| 组件 | 修改内容 |
|------|----------|
| ThumbnailCard | 直接使用 Thumbnail 类型 |
| ThumbnailGrid | 直接使用 Thumbnail 类型 |
| PendingSelectionPanel | 直接使用 Thumbnail 类型 |
| PeriodSelectPage | 从 thumbnails 获取数据 |

## 7. 实现步骤

1. 修改 `db.rs` - 新增 Thumbnail 模型和 CRUD，删除 Photo/VideoFrame 相关代码
2. 修改 `main.rs` - 新增缩略图命令，删除旧命令，修改扫描/拼图/视频帧命令
3. 修改 `media.rs` - 扫描返回 NewThumbnail 而非 NewPhoto
4. 修改 `types/index.ts` - 调整 Thumbnail 类型，删除 Photo/VideoFrame
5. 修改 `store/index.ts` - 统一使用 thumbnails 状态
6. 修改前端组件 - 适配新数据模型

## 8. 注意事项

- 不需要迁移旧数据，用户可删除 app.db 重新开始
- 所有媒体操作必须使用缩略图作为主要对象
- 源文件路径直接存储在 thumbnails 表中，无需关联查询
- 视频元数据仍存储在 videos 表中，video_frame 类型通过 source_id 关联