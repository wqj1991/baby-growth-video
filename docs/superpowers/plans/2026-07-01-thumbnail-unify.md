# 统一缩略表实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 photos 表和 video_frames 表合并为统一的 thumbnails 表，简化数据模型和查询逻辑。

**Architecture:** 创建统一的 Thumbnail 数据模型，包含 source_type（scan/video_frame/collage）和源文件路径，替换原有的 Photo 和 VideoFrame 模型。后端提供完整的 CRUD API，前端统一使用缩略图作为主要操作对象。

**Tech Stack:** Rust (Tauri), TypeScript (React), SQLite, Zustand

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src-tauri/src/db.rs` | 数据库模型和操作（Thumbnail 模型、CRUD） |
| `src-tauri/src/main.rs` | Tauri 命令定义和注册 |
| `src-tauri/src/media.rs` | 文件扫描和处理逻辑 |
| `src-tauri/src/video.rs` | 视频处理和帧提取 |
| `src-tauri/src/collage.rs` | 拼图生成 |
| `src/types/index.ts` | 前端类型定义 |
| `src/store/index.ts` | Zustand 状态管理 |
| `src/utils/tauriCommands.ts` | Tauri 命令封装 |
| `src/components/ThumbnailCard.tsx` | 缩略图卡片组件 |
| `src/components/ThumbnailGrid.tsx` | 缩略图网格组件 |
| `src/components/PendingSelectionPanel.tsx` | 待选区面板 |
| `src/pages/PeriodSelectPage.tsx` | 周期选择页面 |

---

## 任务分解

### Task 1: 修改 db.rs - 新增 Thumbnail 模型和 CRUD

**Files:**
- Modify: `src-tauri/src/db.rs`

**Steps:**

- [ ] **Step 1: 添加 Thumbnail 和 NewThumbnail 结构体**

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

- [ ] **Step 2: 添加 thumbnails 表创建语句**

在 `create_tables` 函数中，添加：

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS thumbnails (
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
    )",
    [],
)?;
```

- [ ] **Step 3: 添加缩略图 CRUD 方法**

```rust
pub fn get_period_thumbnails(&self, period_id: i64) -> Result<Vec<Thumbnail>> {
    let conn = self.get_conn();
    let mut stmt = conn.prepare(
        "SELECT * FROM thumbnails WHERE period_id = ?1 ORDER BY taken_at ASC, id ASC",
    )?;
    let thumbnails = stmt.query_map(params![period_id], |row| {
        Ok(Thumbnail {
            id: row.get(0)?,
            project_id: row.get(1)?,
            period_id: row.get(2)?,
            source_type: row.get(3)?,
            source_id: row.get(4)?,
            original_path: row.get(5)?,
            original_file_name: row.get(6)?,
            original_width: row.get(7)?,
            original_height: row.get(8)?,
            original_file_size: row.get(9)?,
            base64_data: row.get(10)?,
            width: row.get(11)?,
            height: row.get(12)?,
            is_selected: row.get::<_, i64>(13)? != 0,
            is_final: row.get::<_, i64>(14)? != 0,
            taken_at: row.get(15)?,
            created_at: row.get(16)?,
        })
    })?;
    thumbnails.collect()
}

pub fn add_thumbnails(&self, thumbnails: &[NewThumbnail]) -> Result<Vec<Thumbnail>> {
    let conn = self.get_conn();
    let now = Self::now();
    let mut result = Vec::with_capacity(thumbnails.len());

    conn.execute("BEGIN TRANSACTION", params![])?;

    for thumbnail in thumbnails {
        conn.execute(
            "INSERT INTO thumbnails (project_id, period_id, source_type, source_id, original_path, original_file_name, original_width, original_height, original_file_size, base64_data, width, height, taken_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                thumbnail.project_id,
                thumbnail.period_id,
                thumbnail.source_type,
                thumbnail.source_id,
                thumbnail.original_path,
                thumbnail.original_file_name,
                thumbnail.original_width,
                thumbnail.original_height,
                thumbnail.original_file_size,
                thumbnail.base64_data,
                thumbnail.width,
                thumbnail.height,
                thumbnail.taken_at,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        if let Ok(t) = self.get_thumbnail_by_id(id) {
            result.push(t);
        }
    }

    conn.execute("COMMIT", params![])?;
    Ok(result)
}

pub fn update_thumbnail(&self, thumbnail: &Thumbnail) -> Result<Thumbnail> {
    let conn = self.get_conn();
    conn.execute(
        "UPDATE thumbnails SET is_selected = ?1, is_final = ?2 WHERE id = ?3",
        params![
            thumbnail.is_selected as i64,
            thumbnail.is_final as i64,
            thumbnail.id,
        ],
    )?;
    self.get_thumbnail_by_id(thumbnail.id)
}

pub fn set_final_thumbnail(&self, period_id: i64, thumbnail_id: i64) -> Result<()> {
    let conn = self.get_conn();
    conn.execute("UPDATE thumbnails SET is_final = 0 WHERE period_id = ?1", params![period_id])?;
    conn.execute("UPDATE thumbnails SET is_final = 1 WHERE id = ?1", params![thumbnail_id])?;
    Ok(())
}

pub fn cancel_final_thumbnail(&self, period_id: i64) -> Result<()> {
    let conn = self.get_conn();
    conn.execute("UPDATE thumbnails SET is_final = 0 WHERE period_id = ?1", params![period_id])?;
    Ok(())
}

pub fn delete_thumbnail(&self, thumbnail_id: i64) -> Result<()> {
    let conn = self.get_conn();
    conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![thumbnail_id])?;
    Ok(())
}

pub fn get_thumbnail_by_id(&self, id: i64) -> Result<Thumbnail> {
    let conn = self.get_conn();
    conn.query_row("SELECT * FROM thumbnails WHERE id = ?1", params![id], |row| {
        Ok(Thumbnail {
            id: row.get(0)?,
            project_id: row.get(1)?,
            period_id: row.get(2)?,
            source_type: row.get(3)?,
            source_id: row.get(4)?,
            original_path: row.get(5)?,
            original_file_name: row.get(6)?,
            original_width: row.get(7)?,
            original_height: row.get(8)?,
            original_file_size: row.get(9)?,
            base64_data: row.get(10)?,
            width: row.get(11)?,
            height: row.get(12)?,
            is_selected: row.get::<_, i64>(13)? != 0,
            is_final: row.get::<_, i64>(14)? != 0,
            taken_at: row.get(15)?,
            created_at: row.get(16)?,
        })
    })
}

pub fn delete_period_thumbnails(&self, period_id: i64) -> Result<()> {
    let conn = self.get_conn();
    conn.execute("DELETE FROM thumbnails WHERE period_id = ?1", params![period_id])?;
    Ok(())
}
```

- [ ] **Step 4: 修改 get_period_stats 使用 thumbnails 表**

```rust
pub fn get_period_stats(&self, project_id: i64) -> Result<Vec<PeriodStats>> {
    let conn = self.get_conn();
    let periods = self.get_periods(project_id)?;
    let mut stats = Vec::with_capacity(periods.len());

    for period in periods {
        let scan_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM thumbnails WHERE period_id = ?1 AND source_type = 'scan'",
            params![period.id],
            |row| row.get(0),
        ).unwrap_or(0);

        let video_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM videos WHERE period_id = ?1",
            params![period.id],
            |row| row.get(0),
        ).unwrap_or(0);

        let pending_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM thumbnails WHERE period_id = ?1 AND is_selected = 1",
            params![period.id],
            |row| row.get(0),
        ).unwrap_or(0);

        let has_final: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM thumbnails WHERE period_id = ?1 AND is_final = 1)",
            params![period.id],
            |row| row.get(0),
        ).unwrap_or(false);

        stats.push(PeriodStats {
            period_id: period.id,
            photo_count: scan_count,
            video_count,
            pending_count,
            has_final,
        });
    }

    Ok(stats)
}
```

- [ ] **Step 5: 修改 get_pending_items 使用 thumbnails 表**

```rust
pub fn get_pending_items(&self, period_id: i64) -> Result<Vec<PendingItem>> {
    let conn = self.get_conn();
    let mut stmt = conn.prepare(
        "SELECT id, period_id, original_path, original_file_name, source_type, is_final, taken_at
         FROM thumbnails
         WHERE period_id = ?1 AND is_selected = 1
         ORDER BY created_at ASC"
    )?;
    let rows = stmt.query_map(params![period_id], |row| {
        let source_type: String = row.get(4)?;
        Ok(PendingItem {
            item_type: source_type.clone(),
            id: row.get(0)?,
            period_id: row.get(1)?,
            file_path: Some(row.get(2)?),
            file_name: Some(row.get(3)?),
            thumbnail_path: None,
            width: 0,
            height: 0,
            time_seconds: None,
            taken_at: row.get(6)?,
            is_final: row.get::<_, i64>(5)? != 0,
            source: Some(source_type),
        })
    })?;
    rows.collect()
}
```

- [ ] **Step 6: 修改 delete_from_pending 使用 thumbnails 表**

```rust
pub fn delete_from_pending(&self, item_type: &str, item_id: i64) -> Result<Option<(String, Option<String>)>> {
    let conn = self.get_conn();
    match item_type {
        "scan" => {
            conn.execute(
                "UPDATE thumbnails SET is_selected = 0 WHERE id = ?1 AND source_type = 'scan'",
                params![item_id],
            )?;
            Ok(None)
        }
        "collage" => {
            let paths: (String, Option<String>) = conn.query_row(
                "SELECT original_path, original_path FROM thumbnails WHERE id = ?1 AND source_type = 'collage'",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(0)?)),
            )?;
            conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![item_id])?;
            Ok(Some(paths))
        }
        "video_frame" => {
            let paths: (String, Option<String>) = conn.query_row(
                "SELECT original_path, original_path FROM thumbnails WHERE id = ?1 AND source_type = 'video_frame'",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(0)?)),
            )?;
            conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![item_id])?;
            Ok(Some(paths))
        }
        _ => Err(rusqlite::Error::InvalidParameterName("unknown item_type".to_string())),
    }
}
```

- [ ] **Step 7: 删除 Photo、VideoFrame、NewPhoto、NewVideoFrame 结构体及相关方法**

删除以下内容：
- `Photo` 结构体（第86-101行）
- `VideoFrame` 结构体（第117-128行）
- `NewPhoto` 结构体（第1524-1534行）
- `NewVideoFrame` 结构体（第1547-1553行）
- `get_period_photos`、`add_photos`、`update_photo`、`set_final_photo`、`cancel_final_photo`、`get_photo_by_id`、`delete_period_photos`、`delete_photo`、`create_collage_photo` 方法
- `get_video_frames`、`get_period_video_frames`、`add_video_frame`、`update_video_frame`、`set_final_video_frame`、`cancel_final_video_frame`、`get_video_frame_by_id` 方法

- [ ] **Step 8: 编译验证**

Run: `cd src-tauri && cargo build`
Expected: Compilation succeeds

---

### Task 2: 修改 media.rs - 扫描返回 NewThumbnail

**Files:**
- Modify: `src-tauri/src/media.rs`

**Steps:**

- [ ] **Step 1: 修改 import，使用 NewThumbnail**

```rust
use crate::db::{NewThumbnail, Thumbnail, Video};
```

- [ ] **Step 2: 修改 ScanResult 和 ProcessResult 使用 Thumbnail/NewThumbnail**

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub thumbnails: Vec<Thumbnail>,
    pub videos: Vec<Video>,
    pub total_photos: i64,
    pub total_videos: i64,
    pub recognized_photos: i64,
    pub recognized_videos: i64,
    pub skipped_duplicate_photos: i64,
    pub skipped_duplicate_videos: i64,
    pub skipped_no_date_photos: i64,
    pub skipped_no_date_videos: i64,
    pub skipped_no_period_photos: i64,
    pub skipped_no_period_videos: i64,
    pub skipped_copy_failed_photos: i64,
    pub skipped_copy_failed_videos: i64,
}

pub struct ProcessResult {
    pub new_thumbnails: Vec<NewThumbnail>,
    pub new_videos: Vec<NewVideo>,
    pub scan_logs: Vec<ScanLogEntry>,
    pub total_photos: i64,
    pub total_videos: i64,
    pub skipped_duplicate_photos: i64,
    pub skipped_duplicate_videos: i64,
    pub skipped_no_date_photos: i64,
    pub skipped_no_date_videos: i64,
    pub skipped_no_period_photos: i64,
    pub skipped_no_period_videos: i64,
    pub skipped_copy_failed_photos: i64,
    pub skipped_copy_failed_videos: i64,
}
```

- [ ] **Step 3: 修改 process_media_folder 构建 NewThumbnail**

将构建 NewPhoto 的代码改为构建 NewThumbnail：

```rust
let new_thumbnail = NewThumbnail {
    project_id,
    period_id: result.period_id,
    source_type: "scan".to_string(),
    source_id: None,
    original_path: dest_path_str,
    original_file_name: result.file_name.clone(),
    original_width: result.width,
    original_height: result.height,
    original_file_size: result.file_size,
    base64_data: thumb_base64,
    width: thumb_width,
    height: thumb_height,
    taken_at: Some(result.date_str.clone()),
};
new_thumbnails.push(new_thumbnail);
```

- [ ] **Step 4: 修改 process_period_folder 构建 NewThumbnail**

同 Step 3

- [ ] **Step 5: 编译验证**

Run: `cd src-tauri && cargo build`
Expected: Compilation succeeds

---

### Task 3: 修改 main.rs - 更新 Tauri 命令

**Files:**
- Modify: `src-tauri/src/main.rs`

**Steps:**

- [ ] **Step 1: 新增缩略图命令**

```rust
#[tauri::command]
fn get_period_thumbnails(period_id: i64, state: State<AppState>) -> Result<Vec<db::Thumbnail>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_period_thumbnails(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_thumbnail(thumbnail: db::Thumbnail, state: State<AppState>) -> Result<db::Thumbnail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_thumbnail(&thumbnail).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_final_thumbnail(period_id: i64, thumbnail_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_final_thumbnail(period_id, thumbnail_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn cancel_final_thumbnail(period_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.cancel_final_thumbnail(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_thumbnail(thumbnail_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_thumbnail(thumbnail_id).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 修改 scan_media_folder 返回 Thumbnail**

```rust
let thumbnails = db.add_thumbnails(&scan_result.new_thumbnails)
    .unwrap_or_else(|e| { eprintln!("批量插入缩略图失败: {}", e); Vec::new() });

let recognized_photos = thumbnails.len() as i64;

Ok(media::ScanResult {
    thumbnails,
    videos,
    // ... 其他字段不变
})
```

- [ ] **Step 3: 修改 scan_period_folder 返回 Thumbnail**

同 Step 2

- [ ] **Step 4: 修改 generate_collage 插入 thumbnails 表**

```rust
let new_thumbnail = db::NewThumbnail {
    project_id,
    period_id: request.period_id,
    source_type: "collage".to_string(),
    source_id: None,
    original_path: result.output_path.clone(),
    original_file_name: format!("collage_{}.jpg", uuid),
    original_width: w as i64,
    original_height: h as i64,
    original_file_size: file_size,
    base64_data: thumb_base64,
    width: thumb_width,
    height: thumb_height,
    taken_at: Some(now[..10].to_string()),
};
let thumbnail = db.add_thumbnails(&[new_thumbnail]).map_err(|e| e.to_string())?;
```

- [ ] **Step 5: 修改 persist_video_frame 插入 thumbnails 表**

```rust
let new_thumbnail = db::NewThumbnail {
    project_id,
    period_id: temp.period_id,
    source_type: "video_frame".to_string(),
    source_id: Some(temp.video_id),
    original_path: dest_frame.to_string_lossy().to_string(),
    original_file_name: format!("frame_{}.jpg", uuid),
    original_width: 0,
    original_height: 0,
    original_file_size: 0,
    base64_data: None,
    width: 0,
    height: 0,
    taken_at: None,
};
let thumbnail = db.add_thumbnails(&[new_thumbnail]).map_err(|e| e.to_string())?;
db.delete_temp_frame(temp_id).map_err(|e| e.to_string())?;
Ok(thumbnail[0].clone())
```

- [ ] **Step 6: 删除旧命令**

删除以下命令：
- `get_period_photos`、`update_photo`、`set_final_photo`、`cancel_final_photo`、`delete_photo`、`create_collage_photo`
- `get_video_frames`、`get_period_video_frames`、`set_final_video_frame`、`update_video_frame`、`cancel_final_video_frame`

- [ ] **Step 7: 更新 invoke_handler**

添加新命令，删除旧命令：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 其他命令不变
    get_period_thumbnails,
    update_thumbnail,
    set_final_thumbnail,
    cancel_final_thumbnail,
    delete_thumbnail,
    // 删除: get_period_photos, update_photo, set_final_photo, cancel_final_photo, delete_photo, create_collage_photo
    // 删除: get_video_frames, get_period_video_frames, set_final_video_frame, update_video_frame, cancel_final_video_frame
])
```

- [ ] **Step 8: 编译验证**

Run: `cd src-tauri && cargo build`
Expected: Compilation succeeds

---

### Task 4: 修改前端 types/index.ts

**Files:**
- Modify: `src/types/index.ts`

**Steps:**

- [ ] **Step 1: 更新 Thumbnail 类型**

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

- [ ] **Step 2: 删除 Photo、VideoFrame、SelectableItem 类型**

删除第41-82行的 Photo 和 VideoFrame 接口，以及第159-161行的 SelectableItem 类型。

- [ ] **Step 3: 更新 ScanResult 类型**

```typescript
export interface ScanResult {
  thumbnails: Thumbnail[];
  videos: Video[];
  total_photos: number;
  total_videos: number;
  recognized_photos: number;
  recognized_videos: number;
  skipped_duplicate_photos: number;
  skipped_duplicate_videos: number;
  skipped_no_date_photos: number;
  skipped_no_date_videos: number;
  skipped_no_period_photos: number;
  skipped_no_period_videos: number;
  skipped_copy_failed_photos: number;
  skipped_copy_failed_videos: number;
}
```

---

### Task 5: 修改前端 store/index.ts

**Files:**
- Modify: `src/store/index.ts`

**Steps:**

- [ ] **Step 1: 删除 photos、videoFrames 状态**

删除 `photos: []` 和 `videoFrames: []` 状态。

- [ ] **Step 2: 统一使用 thumbnails 状态**

```typescript
thumbnails: [] as Thumbnail[],
```

- [ ] **Step 3: 修改相关 action**

将 `fetchPhotos` 改为 `fetchThumbnails`，将 `fetchVideoFrames` 改为使用 `get_period_thumbnails`：

```typescript
async function fetchThumbnails(periodId: number) {
  const thumbnails = await getPeriodThumbnails(periodId);
  set({ thumbnails });
}

async function selectThumbnail(id: number) {
  const thumbnail = get().thumbnails.find(t => t.id === id);
  if (thumbnail) {
    const updated = await updateThumbnail({ ...thumbnail, is_selected: true });
    set({ thumbnails: get().thumbnails.map(t => t.id === id ? updated : t) });
  }
}

async function deselectThumbnail(id: number) {
  const thumbnail = get().thumbnails.find(t => t.id === id);
  if (thumbnail) {
    const updated = await updateThumbnail({ ...thumbnail, is_selected: false });
    set({ thumbnails: get().thumbnails.map(t => t.id === id ? updated : t) });
  }
}

async function setFinalThumbnail(periodId: number, thumbnailId: number) {
  await setFinalThumbnailApi(periodId, thumbnailId);
  set({ thumbnails: get().thumbnails.map(t => ({
    ...t,
    is_final: t.id === thumbnailId
  })) });
}

async function cancelFinalThumbnail(periodId: number) {
  await cancelFinalThumbnailApi(periodId);
  set({ thumbnails: get().thumbnails.map(t => ({ ...t, is_final: false })) });
}
```

---

### Task 6: 修改前端 utils/tauriCommands.ts

**Files:**
- Modify: `src/utils/tauriCommands.ts`

**Steps:**

- [ ] **Step 1: 新增缩略图命令**

```typescript
export async function getPeriodThumbnails(periodId: number): Promise<Thumbnail[]> {
  return invoke('get_period_thumbnails', { periodId });
}

export async function updateThumbnail(thumbnail: Thumbnail): Promise<Thumbnail> {
  return invoke('update_thumbnail', { thumbnail });
}

export async function setFinalThumbnail(periodId: number, thumbnailId: number): Promise<void> {
  return invoke('set_final_thumbnail', { periodId, thumbnailId });
}

export async function cancelFinalThumbnail(periodId: number): Promise<void> {
  return invoke('cancel_final_thumbnail', { periodId });
}

export async function deleteThumbnail(thumbnailId: number): Promise<void> {
  return invoke('delete_thumbnail', { thumbnailId });
}
```

- [ ] **Step 2: 删除旧命令**

删除 `getPeriodPhotos`、`updatePhoto`、`setFinalPhoto`、`cancelFinalPhoto`、`deletePhoto`、`createCollagePhoto`、`getVideoFrames`、`getPeriodVideoFrames`、`setFinalVideoFrame`、`updateVideoFrame`、`cancelFinalVideoFrame`。

- [ ] **Step 3: 更新 scanMediaFolder 和 scanPeriodFolder**

更新返回类型为 `ScanResult`，使用 `thumbnails` 字段。

---

### Task 7: 修改前端组件

**Files:**
- Modify: `src/components/ThumbnailCard.tsx`
- Modify: `src/components/ThumbnailGrid.tsx`
- Modify: `src/components/PendingSelectionPanel.tsx`
- Modify: `src/pages/PeriodSelectPage.tsx`

**Steps:**

- [ ] **Step 1: 修改 ThumbnailCard 使用 Thumbnail 类型**

将 `SelectableItem` 改为 `Thumbnail`，使用 `base64_data` 显示缩略图。

- [ ] **Step 2: 修改 ThumbnailGrid 使用 Thumbnail 类型**

更新数据源和渲染逻辑。

- [ ] **Step 3: 修改 PendingSelectionPanel 使用 Thumbnail 类型**

更新数据源和操作逻辑。

- [ ] **Step 4: 修改 PeriodSelectPage 使用 Thumbnail 类型**

更新数据获取和渲染逻辑。

---

### Task 8: 编译和测试

**Files:**
- All modified files

**Steps:**

- [ ] **Step 1: 后端编译**

Run: `cd src-tauri && cargo build`
Expected: Compilation succeeds

- [ ] **Step 2: 前端编译**

Run: `pnpm build`
Expected: Compilation succeeds

- [ ] **Step 3: 删除旧数据库**

删除 `app.db` 文件，确保新表结构生效。

- [ ] **Step 4: 启动应用测试**

Run: `pnpm tauri dev`
Expected: 应用正常启动，功能正常

---

## 规格覆盖检查

1. ✅ 数据库架构 - Task 1
2. ✅ 数据模型 - Task 1, Task 4
3. ✅ API 命令变更 - Task 3, Task 6
4. ✅ 周期统计变更 - Task 1
5. ✅ 前端状态管理 - Task 5
6. ✅ 前端组件 - Task 7
7. ✅ 编译验证 - Task 8

## 自我审查

1. ✅ 无占位符（TBD/TODO）
2. ✅ 类型一致性：Thumbnail 结构体在前后端保持一致
3. ✅ 所有规格需求都有对应的任务