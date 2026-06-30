# 缩略图体系与文件组织重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构文件组织结构，引入统一缩略图体系（400px JPEG 75%），视频帧延迟持久化，待选区统一聚合查询与按源分类删除。

**Architecture:** Rust 新增 `thumbnail` 模块统一生成缩略图；`video_frame_temp` 表承载截帧预览阶段；`get_pending_items` 聚合 photos+video_frames；`delete_selected_item` 按来源分策略；前端全面切换为缩略图优先加载。

**Tech Stack:** Rust (image crate, rusqlite), React 18 + TypeScript + Zustand, Tauri 2.0

---

### Task 1: DB Schema Migration — 新增字段与 video_frame_temp 表

**Files:**
- Modify: `src-tauri/src/db.rs` — `init()` 方法中的 CREATE TABLE 语句 + `Photo`/`VideoFrame`/`NewPhoto`/`NewVideoFrame` structs

- [ ] **Step 1: 更新 Photo struct，新增 `thumbnail_path` 和 `source` 字段**

在 `db.rs` 的 `Photo` struct (line 86-99) 增加两个字段：

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Photo {
    pub id: i64,
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
    pub description: Option<String>,
    pub is_selected: bool,
    pub is_final: bool,
    pub thumbnail_path: Option<String>,   // NEW
    pub source: String,                    // NEW: 'scan' | 'collage'
    pub created_at: String,
}
```

- [ ] **Step 2: 更新 NewPhoto struct，新增 `thumbnail_path` 和 `source`**

```rust
pub struct NewPhoto {
    pub period_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
    pub thumbnail_path: Option<String>,   // NEW
    pub source: String,                    // NEW: 'scan' | 'collage'
}
```

- [ ] **Step 3: 更新 VideoFrame struct，新增 `thumbnail_path`，`file_path` 改为 Option**

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoFrame {
    pub id: i64,
    pub video_id: i64,
    pub period_id: i64,
    pub file_path: Option<String>,        // CHANGED: 截帧预览期间为 None
    pub time_seconds: f64,
    pub is_selected: bool,
    pub is_final: bool,
    pub thumbnail_path: Option<String>,   // NEW
    pub created_at: String,
}
```

- [ ] **Step 4: 更新 NewVideoFrame struct，新增 `thumbnail_path`，`file_path` 改为 Option**

```rust
pub struct NewVideoFrame {
    pub video_id: i64,
    pub period_id: i64,
    pub file_path: Option<String>,        // CHANGED
    pub time_seconds: f64,
    pub thumbnail_path: Option<String>,   // NEW
}
```

- [ ] **Step 5: 新增 `VideoFrameTemp` struct**

在 struct 区域末尾（NewExportRecord 后面）新增：

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoFrameTemp {
    pub id: i64,
    pub video_id: i64,
    pub period_id: i64,
    pub time_seconds: f64,
    pub temp_thumb_path: String,
    pub created_at: String,
}
```

- [ ] **Step 6: 更新 init() 中的 photos 表 CREATE TABLE，新增字段**

找到 `init()` 中的 photos 建表语句，替换为：

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 0,
        height INTEGER NOT NULL DEFAULT 0,
        taken_at TEXT,
        description TEXT,
        is_selected INTEGER NOT NULL DEFAULT 0,
        is_final INTEGER NOT NULL DEFAULT 0,
        thumbnail_path TEXT,
        source TEXT NOT NULL DEFAULT 'scan',
        created_at TEXT NOT NULL,
        FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
    )",
    [],
)?;
```

- [ ] **Step 7: 更新 init() 中的 video_frames 表 CREATE TABLE，新增 thumbnail_path**

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS video_frames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        period_id INTEGER NOT NULL,
        file_path TEXT,
        time_seconds REAL NOT NULL DEFAULT 0,
        is_selected INTEGER NOT NULL DEFAULT 0,
        is_final INTEGER NOT NULL DEFAULT 0,
        thumbnail_path TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
    )",
    [],
)?;
```

- [ ] **Step 8: 在 init() 中新增 video_frame_temp 建表语句**

在 video_frames 建表之后新增：

```rust
conn.execute(
    "CREATE TABLE IF NOT EXISTS video_frame_temp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        period_id INTEGER NOT NULL,
        time_seconds REAL NOT NULL,
        temp_thumb_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
    )",
    [],
)?;
```

---

### Task 2: DB 读写方法 — 适配新字段

**Files:**
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: 更新 `get_photo_by_id()` 读取新字段**

```rust
fn get_photo_by_id(&self, id: i64) -> Result<Photo> {
    let conn = self.get_conn();
    conn.query_row("SELECT * FROM photos WHERE id = ?1", params![id], |row| {
        Ok(Photo {
            id: row.get(0)?,
            period_id: row.get(1)?,
            file_path: row.get(2)?,
            file_name: row.get(3)?,
            file_size: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            taken_at: row.get(7)?,
            description: row.get(8)?,
            is_selected: row.get::<_, i64>(9)? != 0,
            is_final: row.get::<_, i64>(10)? != 0,
            thumbnail_path: row.get(11)?,        // NEW (index 11)
            source: row.get::<_, String>(12)?,    // NEW (index 12)
            created_at: row.get(13)?,             // was index 11
        })
    })
}
```

- [ ] **Step 2: 更新 `add_photos()` — INSERT 增加 thumbnail_path 和 source**

```rust
pub fn add_photos(&self, photos: &[NewPhoto]) -> Result<Vec<Photo>> {
    let conn = self.get_conn();
    let now = Self::now();
    let mut result = Vec::with_capacity(photos.len());

    conn.execute("BEGIN TRANSACTION", params![])?;

    for photo in photos {
        match conn.execute(
            "INSERT INTO photos (period_id, file_path, file_name, file_size, width, height, taken_at, thumbnail_path, source, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                photo.period_id,
                photo.file_path,
                photo.file_name,
                photo.file_size,
                photo.width,
                photo.height,
                photo.taken_at,
                photo.thumbnail_path,
                photo.source,
                &now,
            ],
        ) {
            Ok(_) => {
                let id = conn.last_insert_rowid();
                let photo = self.get_photo_by_id(id)?;
                result.push(photo);
            }
            Err(e) => {
                conn.execute("ROLLBACK", params![]).ok();
                return Err(e);
            }
        }
    }

    conn.execute("COMMIT", params![])?;
    Ok(result)
}
```

- [ ] **Step 3: 更新 `create_collage_photo()` — 接受 thumbnail_path 参数**

修改函数签名和 INSERT：

```rust
pub fn create_collage_photo(
    &self,
    period_id: i64,
    file_path: &str,
    file_name: &str,
    file_size: i64,
    width: i64,
    height: i64,
    thumbnail_path: Option<String>,   // NEW param
    description: &str,
) -> Result<Photo> {
    let conn = self.get_conn();
    let now = Self::now();
    
    conn.execute(
        "INSERT INTO photos (period_id, file_path, file_name, file_size, width, height, taken_at, description, is_selected, thumbnail_path, source, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            period_id,
            file_path,
            file_name,
            file_size,
            width,
            height,
            &now[..10],
            description,
            1,
            thumbnail_path,
            "collage",   // NEW: mark as collage
            &now,
        ],
    )?;
    
    let id = conn.last_insert_rowid();
    self.get_photo_by_id(id)
}
```

- [ ] **Step 4: 更新 `get_video_frame_by_id()` — 适配 Option 和新字段**

```rust
fn get_video_frame_by_id(&self, id: i64) -> Result<VideoFrame> {
    let conn = self.get_conn();
    conn.query_row("SELECT * FROM video_frames WHERE id = ?1", params![id], |row| {
        Ok(VideoFrame {
            id: row.get(0)?,
            video_id: row.get(1)?,
            period_id: row.get(2)?,
            file_path: row.get(3)?,                      // Option<String>
            time_seconds: row.get(4)?,
            is_selected: row.get::<_, i64>(5)? != 0,
            is_final: row.get::<_, i64>(6)? != 0,
            thumbnail_path: row.get(7)?,                  // NEW
            created_at: row.get(8)?,
        })
    })
}
```

- [ ] **Step 5: 更新 `add_video_frame()` — 适配 Option 和新字段**

```rust
pub fn add_video_frame(&self, frame: &NewVideoFrame) -> Result<VideoFrame> {
    let conn = self.get_conn();
    let now = Self::now();
    conn.execute(
        "INSERT INTO video_frames (video_id, period_id, file_path, time_seconds, thumbnail_path, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            frame.video_id,
            frame.period_id,
            frame.file_path,
            frame.time_seconds,
            frame.thumbnail_path,
            &now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    self.get_video_frame_by_id(id)
}
```

- [ ] **Step 6: 新增 `get_pending_items()` — 聚合查询函数**

在 db.rs 中 photos 操作区域（create_collage_photo 之后）新增：

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingItem {
    pub item_type: String,       // 'photo' | 'collage' | 'video_frame'
    pub id: i64,
    pub period_id: i64,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub thumbnail_path: Option<String>,
    pub width: i64,
    pub height: i64,
    pub time_seconds: Option<f64>,
    pub taken_at: Option<String>,
    pub is_final: bool,
    pub source: Option<String>,  // for photos: 'scan' | 'collage'
}

pub fn get_pending_items(&self, period_id: i64) -> Result<Vec<PendingItem>> {
    let conn = self.get_conn();
    let mut items = Vec::new();

    // 查询 photos (is_selected = 1)
    {
        let mut stmt = conn.prepare(
            "SELECT id, period_id, file_path, file_name, thumbnail_path, width, height,
                    taken_at, is_final, source
             FROM photos
             WHERE period_id = ?1 AND is_selected = 1
             ORDER BY created_at ASC"
        )?;
        let photo_rows = stmt.query_map(params![period_id], |row| {
            let source: String = row.get(9)?;
            Ok(PendingItem {
                item_type: if source == "collage" { "collage".to_string() } else { "photo".to_string() },
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: Some(row.get::<_, String>(2)?),
                file_name: Some(row.get(3)?),
                thumbnail_path: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                time_seconds: None,
                taken_at: row.get(7)?,
                is_final: row.get::<_, i64>(8)? != 0,
                source: Some(source),
            })
        })?;
        for row in photo_rows {
            items.push(row?);
        }
    }

    // 查询 video_frames (is_selected = 1)
    {
        let mut stmt = conn.prepare(
            "SELECT id, period_id, file_path, thumbnail_path, time_seconds, is_final
             FROM video_frames
             WHERE period_id = ?1 AND is_selected = 1
             ORDER BY created_at ASC"
        )?;
        let frame_rows = stmt.query_map(params![period_id], |row| {
            Ok(PendingItem {
                item_type: "video_frame".to_string(),
                id: row.get(0)?,
                period_id: row.get(1)?,
                file_path: row.get(2)?,
                file_name: None,
                thumbnail_path: row.get(3)?,
                width: 0,
                height: 0,
                time_seconds: Some(row.get(4)?),
                taken_at: None,
                is_final: row.get::<_, i64>(5)? != 0,
                source: None,
            })
        })?;
        for row in frame_rows {
            items.push(row?);
        }
    }

    Ok(items)
}
```

- [ ] **Step 7: 新增 `delete_from_pending()` — 按来源分策略删除**

```rust
pub fn delete_from_pending(&self, item_type: &str, item_id: i64) -> Result<Option<(String, Option<String>)>> {
    let conn = self.get_conn();
    match item_type {
        "photo" => {
            // 扫描照片: 仅取消 is_selected，不删文件
            conn.execute(
                "UPDATE photos SET is_selected = 0 WHERE id = ?1 AND source = 'scan'",
                params![item_id],
            )?;
            Ok(None)
        }
        "collage" => {
            // 拼图: 删 DB + 返回文件路径供调用方删除
            let paths: (String, Option<String>) = conn.query_row(
                "SELECT file_path, thumbnail_path FROM photos WHERE id = ?1 AND source = 'collage'",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            conn.execute("DELETE FROM photos WHERE id = ?1", params![item_id])?;
            Ok(Some(paths))
        }
        "video_frame" => {
            // 视频帧: 删 DB + 返回文件路径供调用方删除
            let paths: (Option<String>, Option<String>) = conn.query_row(
                "SELECT file_path, thumbnail_path FROM video_frames WHERE id = ?1",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            conn.execute("DELETE FROM video_frames WHERE id = ?1", params![item_id])?;
            // flatten Option
            let fp = paths.0.unwrap_or_default();
            if fp.is_empty() {
                Ok(None)
            } else {
                Ok(Some((fp, paths.1)))
            }
        }
        _ => Err(rusqlite::Error::InvalidParameterName("unknown item_type".to_string())),
    }
}
```

- [ ] **Step 8: 新增 `video_frame_temp` CRUD**

```rust
pub fn insert_video_frame_temp(&self, video_id: i64, period_id: i64, time_seconds: f64, temp_thumb_path: &str) -> Result<VideoFrameTemp> {
    let conn = self.get_conn();
    let now = Self::now();
    conn.execute(
        "INSERT INTO video_frame_temp (video_id, period_id, time_seconds, temp_thumb_path, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![video_id, period_id, time_seconds, temp_thumb_path, &now],
    )?;
    let id = conn.last_insert_rowid();
    Ok(VideoFrameTemp {
        id,
        video_id,
        period_id,
        time_seconds,
        temp_thumb_path: temp_thumb_path.to_string(),
        created_at: now,
    })
}

pub fn get_temp_frames(&self, video_id: i64) -> Result<Vec<VideoFrameTemp>> {
    let conn = self.get_conn();
    let mut stmt = conn.prepare(
        "SELECT id, video_id, period_id, time_seconds, temp_thumb_path, created_at
         FROM video_frame_temp WHERE video_id = ?1 ORDER BY time_seconds ASC"
    )?;
    let frames = stmt.query_map(params![video_id], |row| {
        Ok(VideoFrameTemp {
            id: row.get(0)?,
            video_id: row.get(1)?,
            period_id: row.get(2)?,
            time_seconds: row.get(3)?,
            temp_thumb_path: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    frames.collect()
}

pub fn get_temp_frame_by_id(&self, temp_id: i64) -> Result<VideoFrameTemp> {
    let conn = self.get_conn();
    conn.query_row(
        "SELECT id, video_id, period_id, time_seconds, temp_thumb_path, created_at
         FROM video_frame_temp WHERE id = ?1",
        params![temp_id],
        |row| Ok(VideoFrameTemp {
            id: row.get(0)?,
            video_id: row.get(1)?,
            period_id: row.get(2)?,
            time_seconds: row.get(3)?,
            temp_thumb_path: row.get(4)?,
            created_at: row.get(5)?,
        }),
    )
}

pub fn delete_temp_frame(&self, temp_id: i64) -> Result<Option<String>> {
    let conn = self.get_conn();
    let thumb_path: String = conn.query_row(
        "SELECT temp_thumb_path FROM video_frame_temp WHERE id = ?1",
        params![temp_id],
        |row| row.get(0),
    )?;
    conn.execute("DELETE FROM video_frame_temp WHERE id = ?1", params![temp_id])?;
    Ok(Some(thumb_path))
}

pub fn delete_all_temp_frames(&self, video_id: i64) -> Result<Vec<String>> {
    let conn = self.get_conn();
    let mut stmt = conn.prepare("SELECT temp_thumb_path FROM video_frame_temp WHERE video_id = ?1")?;
    let paths: Vec<String> = stmt.query_map(params![video_id], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    conn.execute("DELETE FROM video_frame_temp WHERE video_id = ?1", params![video_id])?;
    Ok(paths)
}
```

---

### Task 3: 新增 `thumbnail.rs` 模块 — 统一缩略图生成

**Files:**
- Create: `src-tauri/src/thumbnail.rs`

- [ ] **Step 1: 创建 `thumbnail.rs`**

```rust
use image::imageops::FilterType;
use std::path::{Path, PathBuf};

const THUMB_WIDTH: u32 = 400;
const THUMB_QUALITY: u8 = 75;

/// 生成缩略图，保存到 projects/{project_id}/thumbnails/{uuid}_thumb.jpg
/// 返回缩略图的绝对路径
pub fn generate_thumbnail(
    source_path: &str,
    project_id: i64,
    uuid: &str,
) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("源文件不存在: {}", source_path));
    }

    // 打开原图
    let img = image::open(source).map_err(|e| format!("打开图片失败: {}", e))?;

    // 等比缩放至宽度 400px
    let scaled = img.resize(THUMB_WIDTH, u32::MAX, FilterType::Lanczos3);

    // 输出路径
    let data_dir = dirs_next::data_dir()
        .ok_or("无法获取数据目录".to_string())?;
    let thumb_dir = data_dir
        .join("baby-growth-video")
        .join("projects")
        .join(project_id.to_string())
        .join("thumbnails");
    std::fs::create_dir_all(&thumb_dir)
        .map_err(|e| format!("创建缩略图目录失败: {}", e))?;

    let thumb_path = thumb_dir.join(format!("{}_thumb.jpg", uuid));

    // 保存 JPEG
    let mut output = std::fs::File::create(&thumb_path)
        .map_err(|e| format!("创建缩略图文件失败: {}", e))?;
    scaled.write_to(&mut output, image::ImageFormat::Jpeg)
        .map_err(|e| format!("写入缩略图失败: {}", e))?;

    Ok(thumb_path.to_string_lossy().to_string())
}

/// 为图片尺寸获取（辅助函数，用于拼图/视频帧场景需要知道尺寸时）
pub fn get_image_dimensions(path: &str) -> Result<(u32, u32), String> {
    let img = image::open(path).map_err(|e| format!("打开图片失败: {}", e))?;
    Ok((img.width(), img.height()))
}
```

- [ ] **Step 2: 在 `main.rs` 顶部注册模块**

```rust
mod thumbnail;
```

---

### Task 4: 改造 `media.rs` — 扫描时生成缩略图

**Files:**
- Modify: `src-tauri/src/media.rs`

- [ ] **Step 1: 在 `scan_media_folder` 中找到 `add_photos` 调用处，给 NewPhoto 填上 thumbnail_path 和 source**

找到构造 `NewPhoto` 的位置（通常在 media.rs 的扫描循环中），添加缩略图生成和 source 字段：

```rust
use crate::thumbnail;

// 在构建 NewPhoto 之前：
let thumb_path = match thumbnail::generate_thumbnail(
    &dest_path_str,
    project_id,
    &uuid,
) {
    Ok(p) => Some(p),
    Err(e) => {
        eprintln!("缩略图生成失败: {}", e);
        None  // 降级：无缩略图
    }
};

let new_photo = NewPhoto {
    period_id,
    file_path: dest_path_str.clone(),
    file_name: original_name.clone(),
    file_size,
    width,
    height,
    taken_at: Some(date_str),
    thumbnail_path: thumb_path,
    source: "scan".to_string(),
};
```

> 注: `copy_file_to_project_dir_atomic` 生成的目标文件名为 `{uuid}_{original_name}`。需修改此函数返回 uuid，或从 dest_path 文件名用正则 `^([a-f0-9-]+)_` 提取 uuid 前缀。

- [ ] **Step 2: `scan_period_folder` 同样修改**

与 Step 1 相同的改动应用到 `scan_period_folder` 函数中。

---

### Task 5: 改造 `collage.rs` — 拼图生成时生成缩略图

**Files:**
- Modify: `src-tauri/src/collage.rs`
- Modify: `src-tauri/src/main.rs` — `generate_collage` command

- [ ] **Step 1: 在 `CollageRequest` struct 中新增 `period_id` 字段**

在 `collage.rs` 中:

```rust
pub struct CollageRequest {
    pub template_id: String,
    pub output_width: u32,
    pub output_height: u32,
    pub gap_px: u32,
    pub jpeg_quality: u8,
    pub photo_paths: Vec<String>,
    pub regions: Vec<CollageRegion>,
    pub period_id: i64,    // NEW
}
```

- [ ] **Step 2: 在 `generate_collage` command 中，输出拼图后生成缩略图**

在 `main.rs` 的 `generate_collage` command 中，拼图生成成功返回 `CollageResult` 后：

> **前置条件**: `CollageRequest` struct (collage.rs) 需新增 `period_id: i64` 字段，前端 CollageWorkspace 构造 request 时填入当前周期的 id。

```rust
#[tauri::command]
fn generate_collage(
    request: collage::CollageRequest,
    project_id: i64,            // NEW param
    state: State<AppState>,
) -> Result<collage::CollageResult, String> {
    let result = collage::generate_collage(&request)?;
    
    // 生成缩略图
    let uuid = Uuid::new_v4().to_string();  // 或从 output_path 提取
    let thumb_path = match thumbnail::generate_thumbnail(
        &result.output_path,
        project_id,
        &uuid,
    ) {
        Ok(p) => Some(p),
        Err(e) => {
            eprintln!("缩略图生成失败: {}", e);
            None
        }
    };
    
    // 持久化到 DB
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let metadata = std::fs::metadata(&result.output_path)
        .map_err(|e| format!("读取文件信息失败: {}", e))?;
    let (w, h) = thumbnail::get_image_dimensions(&result.output_path)
        .unwrap_or((request.output_width as u32, request.output_height as u32));
    
    db.create_collage_photo(
        request.period_id,          // 需要在 CollageRequest 中增加 period_id
        &result.output_path,
        &format!("collage_{}.jpg", uuid),
        metadata.len() as i64,
        w as i64,
        h as i64,
        thumb_path,
        "拼图合成",
    ).map_err(|e| e.to_string())?;
    
    Ok(result)
}
```

---

### Task 6: 改造 `video.rs` — 视频帧延迟持久化

**Files:**
- Modify: `src-tauri/src/video.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 改造 `generate_video_frames` — 只生成临时缩略图**

```rust
pub fn generate_video_frames(
    db: &Database,
    video_id: i64,
    count: i64,
) -> Result<Vec<VideoFrameTemp>, String> {
    let video = db.get_video_by_id(video_id).map_err(|e| e.to_string())?;
    let video_path = &video.file_path;
    let duration = video.duration;
    
    let actual_duration = if duration <= 0.0 {
        match get_video_info(video_path) {
            Ok((d, _, _)) => d,
            Err(_) => return Err("无法获取视频时长".to_string()),
        }
    } else {
        duration
    };
    
    if actual_duration <= 0.0 {
        return Err("视频时长无效".to_string());
    }
    
    // 临时缩略图目录（应用级别 temp，非项目目录）
    let temp_dir = dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("baby-growth-video")
        .join("temp_frames");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    
    let interval = actual_duration / (count + 1) as f64;
    let mut frames = Vec::new();
    
    for i in 1..=count {
        let time_seconds = interval * i as f64;
        let uuid = uuid::Uuid::new_v4().to_string();
        
        // 截帧（全分辨率，临时存放）
        let temp_frame_path = temp_dir.join(format!("{}_frame.jpg", uuid));
        
        let status = Command::new(get_ffmpeg_path())
            .args([
                "-ss", &time_seconds.to_string(),
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "2",
                "-y",
                "-v", "error",
                temp_frame_path.to_str().unwrap_or("frame.jpg"),
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map_err(|e| format!("截图失败: {}", e))?;
        
        if status.success() {
            // 生成缩略图
            let thumb_size_path = temp_dir.join(format!("{}_thumb.jpg", uuid));
            let img = image::open(&temp_frame_path)
                .map_err(|e| format!("打开帧失败: {}", e))?;
            let scaled = img.resize(400, u32::MAX, image::imageops::FilterType::Lanczos3);
            let mut output = std::fs::File::create(&thumb_size_path)
                .map_err(|e| format!("创建缩略图失败: {}", e))?;
            scaled.write_to(&mut output, image::ImageFormat::Jpeg)
                .map_err(|e| format!("写入缩略图失败: {}", e))?;
            
            // 插入临时表
            match db.insert_video_frame_temp(
                video_id,
                video.period_id,
                time_seconds,
                &thumb_size_path.to_string_lossy(),
            ) {
                Ok(frame) => frames.push(frame),
                Err(e) => {
                    eprintln!("保存临时帧失败: {}", e);
                    // 清理失败的文件
                    let _ = std::fs::remove_file(&temp_frame_path);
                    let _ = std::fs::remove_file(&thumb_size_path);
                }
            }
        }
    }
    
    Ok(frames)
}
```

- [ ] **Step 2: 在 `main.rs` 更新 `generate_video_frames` command 返回类型**

```rust
#[tauri::command]
fn generate_video_frames(
    video_id: i64,
    count: i64,
    state: State<AppState>,
) -> Result<Vec<db::VideoFrameTemp>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    video::generate_video_frames(&db, video_id, count)
}
```

---

### Task 7: 新增 Tauri Commands（main.rs）

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 新增 `generate_thumbnail` command**

```rust
#[tauri::command]
fn generate_thumbnail(
    source_path: String,
    project_id: i64,
    uuid: String,
) -> Result<String, String> {
    thumbnail::generate_thumbnail(&source_path, project_id, &uuid)
}
```

- [ ] **Step 2: 新增 `persist_video_frame` command**

```rust
#[tauri::command]
fn persist_video_frame(
    temp_id: i64,
    project_id: i64,
    state: State<AppState>,
) -> Result<db::VideoFrame, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // 获取临时帧信息
    let temp = db.get_temp_frame_by_id(temp_id).map_err(|e| e.to_string())?;
    
    // 项目 frames 目录
    let data_dir = dirs_next::data_dir().ok_or("无法获取数据目录".to_string())?;
    let project_dir = data_dir.join("baby-growth-video").join("projects").join(project_id.to_string());
    let frames_dir = project_dir.join("frames");
    let thumb_dir = project_dir.join("thumbnails");
    std::fs::create_dir_all(&frames_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    
    let uuid = uuid::Uuid::new_v4().to_string();
    let frame_file_name = format!("{}_frame.jpg", uuid);
    let thumb_file_name = format!("{}_thumb.jpg", uuid);
    
    let dest_frame = frames_dir.join(&frame_file_name);
    let dest_thumb = thumb_dir.join(&thumb_file_name);
    
    // 截取原分辨率帧（如果临时原帧还在）
    // 注意：video.rs 的 generate_video_frames 已在 temp_dir 保存了原帧
    // 这里需要从 temp_frame_path 获取原帧
    // 简化方案：从临时缩略图路径反推原帧路径
    let temp_frame_base = Path::new(&temp.temp_thumb_path)
        .with_extension("")  // 去掉 .jpg
        .to_string_lossy()
        .to_string()
        .replace("_thumb", "_frame");
    let temp_frame_path = Path::new(&temp_frame_base).with_extension("jpg");
    
    // 复制/移动原帧
    if temp_frame_path.exists() {
        std::fs::rename(&temp_frame_path, &dest_frame)
            .map_err(|e| format!("移动帧文件失败: {}", e))?;
    }
    
    // 移动缩略图
    std::fs::rename(&temp.temp_thumb_path, &dest_thumb)
        .map_err(|e| format!("移动缩略图失败: {}", e))?;
    
    // 插入 video_frames
    let new_frame = db::NewVideoFrame {
        video_id: temp.video_id,
        period_id: temp.period_id,
        file_path: Some(dest_frame.to_string_lossy().to_string()),
        time_seconds: temp.time_seconds,
        thumbnail_path: Some(dest_thumb.to_string_lossy().to_string()),
    };
    
    let frame = db.add_video_frame(&new_frame).map_err(|e| e.to_string())?;
    
    // 清理临时记录
    db.delete_temp_frame(temp_id).map_err(|e| e.to_string())?;
    
    Ok(frame)
}
```

- [ ] **Step 3: 新增 `discard_temp_frames` command**

```rust
#[tauri::command]
fn discard_temp_frames(
    video_id: i64,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let paths = db.delete_all_temp_frames(video_id).map_err(|e| e.to_string())?;
    for p in &paths {
        let _ = std::fs::remove_file(p);
        // 同时清理对应的原帧临时文件
        let frame_path = p.replace("_thumb", "_frame");
        let _ = std::fs::remove_file(&frame_path);
    }
    Ok(())
}
```

- [ ] **Step 4: 新增 `delete_selected_item` command**

```rust
#[tauri::command]
fn delete_selected_item(
    item_type: String,
    item_id: i64,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let paths_to_delete = db.delete_from_pending(&item_type, item_id)
        .map_err(|e| e.to_string())?;
    
    if let Some((file_path, thumb_path)) = paths_to_delete {
        let _ = std::fs::remove_file(&file_path);
        if let Some(tp) = thumb_path {
            let _ = std::fs::remove_file(&tp);
        }
    }
    
    Ok(())
}
```

- [ ] **Step 5: 新增 `get_pending_items` command**

```rust
#[tauri::command]
fn get_pending_items(
    period_id: i64,
    state: State<AppState>,
) -> Result<Vec<db::PendingItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_pending_items(period_id).map_err(|e| e.to_string())
}
```

- [ ] **Step 6: 新增 `get_temp_frames` command**（VideoFramePlayer 需要读取截帧结果）

```rust
#[tauri::command]
fn get_temp_frames(
    video_id: i64,
    state: State<AppState>,
) -> Result<Vec<db::VideoFrameTemp>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_temp_frames(video_id).map_err(|e| e.to_string())
}
```

- [ ] **Step 7: 在 `main()` 函数的 `.invoke_handler()` 中注册所有新 command**

找到 main.rs 底部的 `.invoke_handler(tauri::generate_handler![...])` 调用，在数组末尾追加：

```rust
generate_thumbnail,
persist_video_frame,
discard_temp_frames,
delete_selected_item,
get_pending_items,
get_temp_frames,
```

- [ ] **Step 8: 更新 `use` 导入**

在 main.rs 顶部追加：

```rust
use uuid::Uuid;
use std::path::Path;
use dirs_next;
```

并在 Cargo.toml 确认 `uuid` crate 存在（feature = "v4"）。如不存在则添加：

```toml
uuid = { version = "1", features = ["v4"] }
```

---

### Task 8: 前端 TypeScript 类型更新

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: 在 `Photo` 接口新增 `thumbnail_path` 和 `source`**

```ts
export interface Photo {
  id: number;
  period_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  taken_at?: string;
  description?: string;
  is_selected: boolean;
  is_multi_selected: boolean;
  is_final: boolean;
  thumbnail_path?: string;    // NEW
  source: 'scan' | 'collage'; // NEW
  created_at: string;
}
```

- [ ] **Step 2: 在 `VideoFrame` 接口新增 `thumbnail_path`，`file_path` 改为可选**

```ts
export interface VideoFrame {
  id: number;
  video_id: number;
  period_id: number;
  file_path?: string;           // CHANGED: optional
  time_seconds: number;
  is_selected: boolean;
  is_multi_selected: boolean;
  is_final: boolean;
  thumbnail_path?: string;      // NEW
  created_at: string;
}
```

- [ ] **Step 3: 新增 `PendingItem` 接口**

```ts
export interface PendingItem {
  item_type: 'photo' | 'collage' | 'video_frame';
  id: number;
  period_id: number;
  file_path?: string;
  file_name?: string;
  thumbnail_path?: string;
  width: number;
  height: number;
  time_seconds?: number;
  taken_at?: string;
  is_final: boolean;
  source?: 'scan' | 'collage';
}
```

- [ ] **Step 4: 新增 `VideoFrameTemp` 接口**

```ts
export interface VideoFrameTemp {
  id: number;
  video_id: number;
  period_id: number;
  time_seconds: number;
  temp_thumb_path: string;
  created_at: string;
}
```

---

### Task 9: 前端 Store 变更

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: 新增状态字段**

在 `useAppStore` 的 `create` 调用中新增：

```ts
pendingItems: [] as PendingItem[],
pendingLoading: false,
deletingItemId: null as number | null,
tempFrames: [] as VideoFrameTemp[],
```

- [ ] **Step 2: 新增 actions**

```ts
// 加载待选区
loadPendingItems: async (periodId: number) => {
  set({ pendingLoading: true });
  try {
    const items = await invoke<RawPendingItem[]>('get_pending_items', { periodId });
    set({ pendingItems: items, pendingLoading: false });
  } catch (e) {
    console.error('加载待选区失败:', e);
    set({ pendingLoading: false });
  }
},

// 删除待选 item
deletePendingItem: async (itemType: string, itemId: number) => {
  set({ deletingItemId: itemId });
  try {
    await invoke('delete_selected_item', { itemType, itemId });
    const { pendingItems, currentPeriod } = get();
    set({
      pendingItems: pendingItems.filter(i => !(i.item_type === itemType && i.id === itemId)),
      deletingItemId: null,
    });
    // 刷新统计
    if (currentPeriod) {
      await get().loadPeriodStats();
    }
  } catch (e) {
    console.error('删除失败:', e);
    set({ deletingItemId: null });
  }
},

// 持久化视频帧
persistVideoFrame: async (tempId: number, projectId: number) => {
  try {
    await invoke('persist_video_frame', { tempId, projectId });
    // 刷新待选区
    const { currentPeriod } = get();
    if (currentPeriod) {
      await get().loadPendingItems(currentPeriod.id);
    }
  } catch (e) {
    console.error('持久化视频帧失败:', e);
  }
},

// 放弃临时帧
discardTempFrames: async (videoId: number) => {
  try {
    await invoke('discard_temp_frames', { videoId });
    set({ tempFrames: [] });
  } catch (e) {
    console.error('放弃临时帧失败:', e);
  }
},

// 加载临时帧列表
loadTempFrames: async (videoId: number) => {
  try {
    const frames = await invoke<VideoFrameTemp[]>('get_temp_frames', { videoId });
    set({ tempFrames: frames });
  } catch (e) {
    console.error('加载临时帧失败:', e);
  }
},
```

---

### Task 10: 前端 `tauriCommands.ts` — 新增封装函数

**Files:**
- Modify: `src/utils/tauriCommands.ts`

- [ ] **Step 1: 新增 export 函数**

```ts
import type { PendingItem, VideoFrameTemp } from '../types';

export async function getPendingItems(periodId: number): Promise<PendingItem[]> {
  return invoke('get_pending_items', { periodId });
}

export async function deleteSelectedItem(itemType: string, itemId: number): Promise<void> {
  return invoke('delete_selected_item', { itemType, itemId });
}

export async function generateThumbnail(sourcePath: string, projectId: number, uuid: string): Promise<string> {
  return invoke('generate_thumbnail', { sourcePath, projectId, uuid });
}

export async function persistVideoFrame(tempId: number, projectId: number): Promise<void> {
  return invoke('persist_video_frame', { tempId, projectId });
}

export async function discardTempFrames(videoId: number): Promise<void> {
  return invoke('discard_temp_frames', { videoId });
}

export async function getTempFrames(videoId: number): Promise<VideoFrameTemp[]> {
  return invoke('get_temp_frames', { videoId });
}
```

---

### Task 11: 改造 PhotoCard — 缩略图加载

**Files:**
- Modify: `src/components/PhotoCard.tsx`

- [ ] **Step 1: 优先使用 `thumbnail_path` 加载图片**

找到 `PhotoCard` 中加载图片的部分（通常是 `getImageBase64(photo.file_path)` 或 `fileToMediaUrl(photo.file_path)`），改为：

```tsx
const imageSrc = photo.thumbnail_path || photo.file_path;
// 用 getImageBase64 加载缩略图
useEffect(() => {
  getImageBase64(imageSrc).then(setLoadedSrc);
}, [imageSrc]);
```

- [ ] **Step 2: 点击详情预览时使用原图 `file_path`**

```tsx
const handlePreview = () => {
  onPreview(photo.file_path);  // 原图用于预览
};
```

---

### Task 12: 改造 VideoFramePlayer — 临时帧展示

**Files:**
- Modify: `src/components/VideoFramePlayer.tsx`

- [ ] **Step 1: 截帧成功后展示临时帧列表（含「加入待选区」和「放弃」按钮）**

主要改动点：
- `generate_video_frames` 现在返回 `VideoFrameTemp[]`
- 截帧完成后调用 `loadTempFrames(videoId)` 加载临时帧列表
- 每个临时帧显示缩略图 (`getImageBase64(frame.temp_thumb_path)`)
- 按钮: 加入待选区 → `persistVideoFrame(tempId, projectId)` / 放弃 → 删除单帧
- 关闭播放器时调用 `discardTempFrames(videoId)` 清理未持久化的帧

```tsx
// 关键代码片段
const handleAddToPending = async (tempId: number) => {
  await persistVideoFrame(tempId, currentProject.id);
  // 从 tempFrames 中移除
  setTempFrames(prev => prev.filter(f => f.id !== tempId));
};

const handleClose = () => {
  discardTempFrames(video.id);
  onClose();
};
```

---

### Task 13: 改造 PendingSelectionPanel — 新增来源标签 + 删除 loading

**Files:**
- Modify: `src/components/PendingSelectionPanel.tsx`

- [ ] **Step 1: 数据源从 `selectedItems` 改为 `pendingItems`**

```tsx
const pendingItems = useAppStore(s => s.pendingItems);
const pendingLoading = useAppStore(s => s.pendingLoading);
const deletingItemId = useAppStore(s => s.deletingItemId);
```

- [ ] **Step 2: 渲染时根据 `item_type` 显示来源标签**

```tsx
const sourceLabel = {
  photo: '扫描',
  collage: '拼图',
  video_frame: '截帧',
}[item.item_type];
```

- [ ] **Step 3: 新增删除按钮（带 loading）**

```tsx
const handleDelete = async (item: PendingItem) => {
  await deletePendingItem(item.item_type, item.id);
};

// 渲染:
<button
  onClick={() => handleDelete(item)}
  disabled={deletingItemId === item.id}
  className="delete-btn"
>
  {deletingItemId === item.id ? <Spinner /> : <TrashIcon />}
</button>
```

- [ ] **Step 4: 图片加载切换为 `thumbnail_path`**

```tsx
const imgSrc = item.thumbnail_path || item.file_path;
```

---

### Task 14: 改造 PeriodSelectPage — 使用 `get_pending_items`

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

- [ ] **Step 1: 周期切换时调用 `loadPendingItems` 替代分别加载**

```tsx
// 原来可能是分别调用 getPeriodPhotos + getPeriodVideoFrames
// 改为:
const handlePeriodChange = (periodId: number) => {
  loadPendingItems(periodId);
  // ... 其他加载逻辑
};
```

---

### Task 15: 改造 CollageWorkspace — 外部处理持久化

**Files:**
- Modify: `src/components/CollageWorkspace.tsx`

注：根据 Task 5 的设计，拼图生成后 Rust 端会同时生成缩略图并持久化。前端的 `CollageWorkspace` 只需确保传递 `project_id` 参数。

- [ ] **Step 1: 在调用 `generate_collage` 时传递 `project_id` 参数**

```tsx
const result = await invoke('generate_collage', {
  request: { ...collageRequest, period_id: currentPeriod.id }, // 确保包含 period_id
  projectId: currentProject.id,
});
```

---

### Task 16: 编译验证

**Files:**
- Modify: `src-tauri/Cargo.toml` — 确认依赖

- [ ] **Step 1: 确认 uuid crate 存在**

```toml
[dependencies]
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 2: Rust 编译检查**

```bash
cd src-tauri && cargo check 2>&1
```

修复所有编译错误（类型不匹配、缺少导入等）。

- [ ] **Step 3: 前端编译检查**

```bash
pnpm run build 2>&1
```

修复所有 TypeScript 类型错误。

- [ ] **Step 4: 功能验证清单**

- [ ] 扫描照片 → 确认 `thumbnails/` 下有对应缩略图
- [ ] 拼图生成 → 确认 thumbnails + DB 有 source='collage'
- [ ] 视频截帧 → 确认预览时无持久化，加待选后才出现 frames/ + thumbnails/
- [ ] 待选区删除扫描照片 → 仅取消 is_selected，文件保留
- [ ] 待选区删除拼图 → 文件 + 缩略图 + DB 全部消失
- [ ] 待选区删除视频帧 → 文件 + 缩略图 + DB 全部消失
- [ ] 所有列表页加载缩略图 → 加载速度明显提升
- [ ] 点详情预览 → 加载原图
