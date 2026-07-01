# 缩略图统一架构设计方案

**日期**: 2026-07-01  
**目标**: 以缩略图作为所有操作对象，统一管理照片、视频帧、拼图等媒体资源

## 1. 背景与目标

当前系统存在以下问题：
- `photos` 和 `video_frames` 表分离，状态管理分散
- 前端需要同时维护 `currentPhotos`、`currentVideos`、`currentVideoFrames`、`selectedItems` 等多套状态
- 缩略图与原图关系不清晰，操作时需要区分来源类型

**重构目标**：
- 创建统一的缩略图表，统一管理所有媒体资源
- 所有操作（查询列表、加入候选区、设为最终）都面向缩略图
- 双击查看大图时才读取原始文件
- 状态清晰：`is_selected`（在候选区）、`is_final`（最终选择）

## 2. 数据库设计

### 2.1 缩略图表

```sql
CREATE TABLE thumbnails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,           -- 'scan' | 'video_frame' | 'collage'
    source_id INTEGER,                    -- 关联原文件ID（可选）
    original_path TEXT NOT NULL,          -- 原始文件路径（用于大图预览）
    original_file_name TEXT NOT NULL,     -- 原始文件名
    original_width INTEGER DEFAULT 0,     -- 原始宽度
    original_height INTEGER DEFAULT 0,    -- 原始高度
    original_file_size INTEGER DEFAULT 0, -- 原始文件大小
    base64_data TEXT NOT NULL,            -- 缩略图 Base64 数据
    width INTEGER NOT NULL DEFAULT 400,   -- 缩略图宽度
    height INTEGER NOT NULL DEFAULT 300,  -- 缩略图高度
    is_selected INTEGER NOT NULL DEFAULT 0, -- 是否在候选区
    is_final INTEGER NOT NULL DEFAULT 0,   -- 是否被选为最终
    taken_at TEXT,                        -- 拍摄日期
    created_at TEXT NOT NULL,
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);
```

### 2.2 迁移策略

由于需要从现有的 `photos` 和 `video_frames` 表迁移数据：
1. 创建新表 `thumbnails`
2. 编写迁移脚本，将现有数据转换并导入
3. 迁移完成后，旧表保留作为备份（可后续清理）

## 3. 后端设计

### 3.1 数据模型 (Rust)

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Thumbnail {
    pub id: i64,
    pub project_id: i64,
    pub period_id: i64,
    pub source_type: String,           // "scan" | "video_frame" | "collage"
    pub source_id: Option<i64>,
    pub original_path: String,
    pub original_file_name: String,
    pub original_width: i64,
    pub original_height: i64,
    pub original_file_size: i64,
    pub base64_data: String,
    pub width: i64,
    pub height: i64,
    pub is_selected: bool,
    pub is_final: bool,
    pub taken_at: Option<String>,
    pub created_at: String,
}
```

### 3.2 核心命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_period_thumbnails` | period_id | Vec\<Thumbnail\> | 获取周期的所有缩略图 |
| `add_to_pending` | thumbnail_id | () | 将缩略图加入候选区 |
| `remove_from_pending` | thumbnail_id | () | 从候选区移除 |
| `set_final_thumbnail` | period_id, thumbnail_id | () | 设为最终 |
| `cancel_final_thumbnail` | period_id | () | 取消最终 |
| `scan_and_create_thumbnails` | project_id, period_id, folder_path | ScanResult | 扫描并生成缩略图 |
| `create_video_frame_thumbnail` | video_id, period_id, time_seconds | Thumbnail | 截帧并生成缩略图 |
| `create_collage_thumbnail` | period_id, collage_path | Thumbnail | 拼图生成缩略图 |
| `get_original_file` | thumbnail_id | String (Base64) | 获取原始文件（大图预览） |
| `delete_thumbnail` | thumbnail_id | () | 删除缩略图 |

### 3.3 缩略图生成流程

```rust
// 扫描时生成缩略图
fn create_thumbnail_from_photo(source_path: &str, project_id: i64, period_id: i64) -> Result<Thumbnail> {
    // 1. 复制原文件到项目目录
    let original_path = copy_to_project_dir(source_path, project_id)?;
    
    // 2. 提取基本信息（尺寸、文件名等）
    let (width, height) = get_image_dimensions(&original_path)?;
    let file_name = get_file_name(&original_path)?;
    let file_size = get_file_size(&original_path)?;
    
    // 3. 生成缩略图并转为 Base64
    let (thumb_width, thumb_height) = (400, 300); // 固定尺寸
    let base64_data = generate_thumbnail_base64(&original_path, thumb_width, thumb_height)?;
    
    // 4. 存入数据库
    Ok(Thumbnail { ... })
}
```

## 4. 前端设计

### 4.1 类型定义

```typescript
// 统一缩略图类型
interface Thumbnail {
  id: number;
  project_id: number;
  period_id: number;
  source_type: 'scan' | 'video_frame' | 'collage';
  source_id?: number;
  original_path: string;
  original_file_name: string;
  original_width: number;
  original_height: number;
  base64_data: string;
  width: number;
  height: number;
  is_selected: boolean;   // 是否在候选区
  is_final: boolean;       // 是否被选为最终
  taken_at?: string;
  created_at: string;
}

// 缩略图状态
type ThumbnailState = 'in_photos' | 'in_pending' | 'final';
```

### 4.2 状态管理 (Zustand)

```typescript
interface AppState {
  // 统一缩略图列表
  thumbnails: Thumbnail[];
  setThumbnails: (thumbnails: Thumbnail[]) => void;
  
  // 计算属性
  pendingThumbnails: Thumbnail[];  // is_selected=true
  finalThumbnail: Thumbnail | null; // is_final=true
  
  // 操作方法
  loadThumbnails: (periodId: number) => Promise<void>;
  addToPending: (id: number) => Promise<void>;
  removeFromPending: (id: number) => Promise<void>;
  setFinal: (id: number) => Promise<void>;
  cancelFinal: () => Promise<void>;
  
  // 预览（大图）
  loadOriginal: (id: number) => Promise<string>;
}
```

### 4.3 组件结构

```
PeriodSelectPage
├── PeriodTimeline              // 周期时间轴
├── TopToolbar                  // 顶部工具栏（扫描、生成周期）
│
├── ThumbnailGrid (左侧主区域)
│   ├── FilterBar               // 筛选栏（来源类型）
│   └── VirtualThumbnailGrid    // 虚拟化缩略图网格
│       └── ThumbnailCard       // 缩略图卡片
│           - 显示 base64_data
│           - hover: 加入候选区 / 设为最终
│           - double-click: 打开大图预览
│
├── DraggableDivider            // 可拖拽分割条
│
├── PendingPanel (右侧面板)
│   ├── Header (候选照片 + 数量)
│   ├── MultiSelectBar         // 多选状态栏（拼图）
│   └── PendingGrid            // 候选区缩略图网格
│       └── ThumbnailCard      // 同上
│           - selected: 显示勾选标记
│           - final: 显示绿色最终标记
│
└── Modals
    ├── ThumbnailPreviewModal   // 大图预览（读取 original_path）
    ├── VideoFrameViewerModal  // 视频帧提取
    └── TemplateSelector       // 拼图模板选择
```

### 4.4 操作流程

| 操作 | 触发 | 后端调用 | 状态更新 |
|------|------|----------|----------|
| 查看列表 | 切换周期 | `get_period_thumbnails` | `thumbnails` |
| 加入候选区 | 点击按钮 | `add_to_pending` | `thumbnail.is_selected=true` |
| 从候选区移除 | 点击移除 | `remove_from_pending` | `thumbnail.is_selected=false` |
| 设为最终 | 点击按钮 | `set_final_thumbnail` | `thumbnail.is_final=true` |
| 取消最终 | 点击按钮 | `cancel_final_thumbnail` | `thumbnail.is_final=false` |
| 双击预览 | 双击卡片 | `get_original_file` | 显示 Modal |

## 5. 迁移计划

### Phase 1: 数据库层
1. 创建 `thumbnails` 表
2. 实现基础 CRUD 命令
3. 编写迁移脚本，将 `photos` → `thumbnails`（source_type='scan'）

### Phase 2: 后端层
1. 实现扫描时生成缩略图命令
2. 实现视频截帧生成缩略图命令
3. 实现拼图生成缩略图命令
4. 实现 `get_original_file` 命令

### Phase 3: 前端层
1. 定义新类型和状态
2. 重构 `PeriodSelectPage`
3. 简化 `PhotoCard` → `ThumbnailCard`
4. 统一 `PendingSelectionPanel`
5. 实现大图预览 Modal

### Phase 4: 清理
1. 迁移完成后，删除旧的 `photos`、`video_frames` 相关代码
2. 清理不再使用的字段和命令

## 6. 风险与注意事项

1. **数据迁移**: 需要确保旧数据正确迁移到新表
2. **Base64 存储**: 缩略图直接存储 Base64，数据库体积会增大，需要评估存储成本
3. **向后兼容**: 过渡期间保留旧命令，逐步废弃
4. **性能**: 大量缩略图加载时，需要分页或虚拟化
