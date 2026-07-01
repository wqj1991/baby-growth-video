# 缩略图统一架构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建统一的缩略图表和状态管理，所有操作面向缩略图，双击查看大图才读取原始文件

**Architecture:** 
- 数据库层：新建 `thumbnails` 表存储所有缩略图（包含 Base64 数据和原始文件路径）
- 后端层：实现缩略图 CRUD 和状态切换命令
- 前端层：重构状态管理，以缩略图为统一操作对象

**Tech Stack:** Rust (Tauri), TypeScript, Zustand, SQLite

---

## 文件结构

```
后端 (src-tauri/src/)
├── db.rs                    # 新增 Thumbnail 模型和迁移
├── thumbnail.rs             # 扩展：生成 Base64 缩略图
├── media.rs                 # 修改：扫描时生成缩略图
└── main.rs                 # 新增缩略图命令

前端 (src/)
├── types/index.ts          # 新增 Thumbnail 类型
├── utils/tauriCommands.ts # 新增缩略图命令封装
├── store/index.ts         # 重构：统一缩略图状态
├── pages/PeriodSelectPage.tsx  # 重构：使用缩略图状态
└── components/
    ├── ThumbnailCard.tsx   # 重命名自 PhotoCard
    ├── ThumbnailGrid.tsx   # 重命名自 VirtualPhotoGrid
    └── ThumbnailPreviewModal.tsx  # 新增：大图预览
```

---

## Phase 1: 数据库层

### Task 1: 添加 Thumbnail 数据模型

**Files:**
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 db.rs 添加 Thumbnail 结构体**

```rust
// 在 db.rs 中添加（约第 145 行后）

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

#[derive(Debug, Serialize, Deserialize)]
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
    pub base64_data: String,
    pub width: i64,
    pub height: i64,
    pub taken_at: Option<String>,
}
```

- [ ] **Step 2: 在 db.rs 创建缩略图表**

在 `create_tables()` 方法中添加（约第 426 行后）：

```rust
// 缩略图表
conn.execute(
    "CREATE TABLE IF NOT EXISTS thumbnails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        period_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        original_path TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        original_width INTEGER NOT NULL DEFAULT 0,
        original_height INTEGER NOT NULL DEFAULT 0,
        original_file_size INTEGER NOT NULL DEFAULT 0,
        base64_data TEXT NOT NULL,
        width INTEGER NOT NULL DEFAULT 400,
        height INTEGER NOT NULL DEFAULT 300,
        is_selected INTEGER NOT NULL DEFAULT 0,
        is_final INTEGER NOT NULL DEFAULT 0,
        taken_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
    )",
    [],
)?;
```

- [ ] **Step 3: 在 db.rs 添加迁移代码**

在 `run_migrations()` 方法中添加（约第 205 行后）：

```rust
// Migration 5: 创建 thumbnails 表
conn.execute(
    "CREATE TABLE IF NOT EXISTS thumbnails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        period_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        original_path TEXT NOT NULL,
        original_file_name TEXT NOT NULL,
        original_width INTEGER NOT NULL DEFAULT 0,
        original_height INTEGER NOT NULL DEFAULT 0,
        original_file_size INTEGER NOT NULL DEFAULT 0,
        base64_data TEXT NOT NULL,
        width INTEGER NOT NULL DEFAULT 400,
        height INTEGER NOT NULL DEFAULT 300,
        is_selected INTEGER NOT NULL DEFAULT 0,
        is_final INTEGER NOT NULL DEFAULT 0,
        taken_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
    )",
    [],
)?;
```

- [ ] **Step 4: 在 db.rs 添加缩略图 CRUD 方法**

在 `impl Database` 中添加（约第 1385 行后）：

```rust
// ==================== 缩略图操作 ====================

pub fn get_period_thumbnails(&self, period_id: i64) -> Result<Vec<Thumbnail>> {
    let conn = self.get_conn();
    let mut stmt = conn.prepare(
        "SELECT id, project_id, period_id, source_type, source_id, original_path, 
                original_file_name, original_width, original_height, original_file_size,
                base64_data, width, height, is_selected, is_final, taken_at, created_at
         FROM thumbnails WHERE period_id = ?1 ORDER BY created_at ASC"
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

pub fn add_thumbnail(&self, thumb: &NewThumbnail) -> Result<Thumbnail> {
    let conn = self.get_conn();
    let now = Self::now();
    conn.execute(
        "INSERT INTO thumbnails (project_id, period_id, source_type, source_id, original_path, 
                original_file_name, original_width, original_height, original_file_size,
                base64_data, width, height, taken_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            thumb.project_id,
            thumb.period_id,
            thumb.source_type,
            thumb.source_id,
            thumb.original_path,
            thumb.original_file_name,
            thumb.original_width,
            thumb.original_height,
            thumb.original_file_size,
            thumb.base64_data,
            thumb.width,
            thumb.height,
            thumb.taken_at,
            &now,
        ],
    )?;
    let id = conn.last_insert_rowid();
    self.get_thumbnail_by_id(id)
}

fn get_thumbnail_by_id(&self, id: i64) -> Result<Thumbnail> {
    let conn = self.get_conn();
    conn.query_row(
        "SELECT id, project_id, period_id, source_type, source_id, original_path, 
                original_file_name, original_width, original_height, original_file_size,
                base64_data, width, height, is_selected, is_final, taken_at, created_at
         FROM thumbnails WHERE id = ?1",
        params![id],
        |row| Ok(Thumbnail {
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
    )
}

pub fn add_thumbnails(&self, thumbs: &[NewThumbnail]) -> Result<Vec<Thumbnail>> {
    let conn = self.get_conn();
    let now = Self::now();
    let mut result = Vec::with_capacity(thumbs.len());
    
    conn.execute("BEGIN TRANSACTION", params![])?;
    
    for thumb in thumbs {
        conn.execute(
            "INSERT INTO thumbnails (project_id, period_id, source_type, source_id, original_path, 
                    original_file_name, original_width, original_height, original_file_size,
                    base64_data, width, height, taken_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                thumb.project_id,
                thumb.period_id,
                thumb.source_type,
                thumb.source_id,
                thumb.original_path,
                thumb.original_file_name,
                thumb.original_width,
                thumb.original_height,
                thumb.original_file_size,
                thumb.base64_data,
                thumb.width,
                thumb.height,
                thumb.taken_at,
                &now,
            ],
        )?;
        let id = conn.last_insert_rowid();
        result.push(self.get_thumbnail_by_id(id)?);
    }
    
    conn.execute("COMMIT", params![])?;
    Ok(result)
}

pub fn update_thumbnail_selected(&self, thumbnail_id: i64, is_selected: bool) -> Result<()> {
    let conn = self.get_conn();
    conn.execute(
        "UPDATE thumbnails SET is_selected = ?1 WHERE id = ?2",
        params![is_selected as i64, thumbnail_id],
    )?;
    Ok(())
}

pub fn set_final_thumbnail(&self, period_id: i64, thumbnail_id: i64) -> Result<()> {
    let conn = self.get_conn();
    // 先取消该周期所有缩略图的 final 状态
    conn.execute(
        "UPDATE thumbnails SET is_final = 0 WHERE period_id = ?1",
        params![period_id],
    )?;
    // 设置选中的缩略图为 final
    conn.execute(
        "UPDATE thumbnails SET is_final = 1 WHERE id = ?1",
        params![thumbnail_id],
    )?;
    Ok(())
}

pub fn cancel_final_thumbnail(&self, period_id: i64) -> Result<()> {
    let conn = self.get_conn();
    conn.execute(
        "UPDATE thumbnails SET is_final = 0 WHERE period_id = ?1",
        params![period_id],
    )?;
    Ok(())
}

pub fn delete_thumbnail(&self, thumbnail_id: i64) -> Result<Option<String>> {
    let conn = self.get_conn();
    // 获取原始文件路径用于删除
    let original_path: Option<String> = conn.query_row(
        "SELECT original_path FROM thumbnails WHERE id = ?1",
        params![thumbnail_id],
        |row| row.get(0),
    ).ok();
    
    conn.execute("DELETE FROM thumbnails WHERE id = ?1", params![thumbnail_id])?;
    Ok(original_path)
}

pub fn get_thumbnail_by_source(&self, source_type: &str, source_id: i64) -> Result<Option<Thumbnail>> {
    let conn = self.get_conn();
    let mut stmt = conn.prepare(
        "SELECT id, project_id, period_id, source_type, source_id, original_path, 
                original_file_name, original_width, original_height, original_file_size,
                base64_data, width, height, is_selected, is_final, taken_at, created_at
         FROM thumbnails WHERE source_type = ?1 AND source_id = ?2"
    )?;
    let mut rows = stmt.query(params![source_type, source_id])?;
    
    if let Some(row) = rows.next()? {
        Ok(Some(Thumbnail {
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
        }))
    } else {
        Ok(None)
    }
}
```

- [ ] **Step 5: 在 main.rs 添加 Tauri 命令**

在 main.rs 中（约第 700 行后）添加：

```rust
// ==================== 缩略图操作 ====================

#[tauri::command]
fn get_period_thumbnails(
    period_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<db::Thumbnail>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_period_thumbnails(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_pending(
    thumbnail_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_thumbnail_selected(thumbnail_id, true).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_from_pending(
    thumbnail_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_thumbnail_selected(thumbnail_id, false).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_final_thumbnail(
    period_id: i64,
    thumbnail_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_final_thumbnail(period_id, thumbnail_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn cancel_final_thumbnail(
    period_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.cancel_final_thumbnail(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_thumbnail(
    thumbnail_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // 删除缩略图文件
    if let Some(path) = db.delete_thumbnail(thumbnail_id).map_err(|e| e.to_string())? {
        std::fs::remove_file(&path).ok();
    }
    Ok(())
}

#[tauri::command]
fn get_original_file(thumbnail_id: i64, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let thumb = db.get_thumbnail_by_id(thumbnail_id).map_err(|e| e.to_string())?;
    // 读取原始文件并返回 Base64
    let content = std::fs::read(&thumb.original_path)
        .map_err(|e| format!("Failed to read original file: {}", e))?;
    
    let ext = std::path::Path::new(&thumb.original_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mime_type = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };
    
    let base64 = base64::engine::general_purpose::STANDARD.encode(&content);
    Ok(format!("data:{};base64,{}", mime_type, base64))
}
```

- [ ] **Step 6: 注册新命令**

在 main.rs 的 `invoke_handler` 中添加（约第 770 行）：

```rust
invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    get_period_thumbnails,
    add_to_pending,
    remove_from_pending,
    set_final_thumbnail,
    cancel_final_thumbnail,
    delete_thumbnail,
    get_original_file,
]),
```

- [ ] **Step 7: 验证后端编译**

Run: `cd src-tauri && cargo build`
Expected: 编译成功，无错误

---

### Task 2: 扩展 thumbnail.rs 支持生成 Base64

**Files:**
- Modify: `src-tauri/src/thumbnail.rs`

- [ ] **Step 1: 添加生成 Base64 缩略图的函数**

在 thumbnail.rs 末尾添加：

```rust
/// 生成缩略图并返回 Base64 字符串
pub fn generate_thumbnail_base64(source_path: &str) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    // Open source image
    let img = image::open(source).map_err(|e| format!("Failed to open image: {}", e))?;

    // Scale to width 400px, maintaining aspect ratio
    let ratio = THUMB_WIDTH as f64 / img.width() as f64;
    let new_height = (img.height() as f64 * ratio) as u32;
    let scaled = img.resize(THUMB_WIDTH, new_height, FilterType::CatmullRom);

    // Encode to JPEG bytes
    let mut buffer = std::io::Cursor::new(Vec::new());
    scaled.write_to(&mut buffer, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    // Convert to Base64
    let base64_str = base64::engine::general_purpose::STANDARD.encode(buffer.into_inner());
    
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo build`
Expected: 编译成功

---

## Phase 2: 前端类型和命令

### Task 3: 添加前端类型定义

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 添加 Thumbnail 类型**

在 types/index.ts 中添加（约第 181 行后）：

```typescript
// 统一缩略图类型
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

// 缩略图状态
export type ThumbnailState = 'in_photos' | 'in_pending' | 'final';
```

- [ ] **Step 2: 更新 SelectableItem 类型**

将 SelectableItem 类型更新为使用 Thumbnail：

```typescript
// 待选区项目（统一使用缩略图）
export type SelectableItem = { type: 'thumbnail'; item: Thumbnail };
```

---

### Task 4: 添加前端命令封装

**Files:**
- Modify: `src/utils/tauriCommands.ts`

- [ ] **Step 1: 添加缩略图相关命令**

在 tauriCommands.ts 中添加（约第 400 行后）：

```typescript
// ==================== 缩略图操作 ====================

export async function getPeriodThumbnails(periodId: number): Promise<Thumbnail[]> {
  return invoke('get_period_thumbnails', { periodId });
}

export async function addToPending(thumbnailId: number): Promise<void> {
  return invoke('add_to_pending', { thumbnailId });
}

export async function removeFromPending(thumbnailId: number): Promise<void> {
  return invoke('remove_from_pending', { thumbnailId });
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

export async function getOriginalFile(thumbnailId: number): Promise<string> {
  return invoke('get_original_file', { thumbnailId });
}
```

---

## Phase 3: 前端状态管理

### Task 5: 重构 Zustand Store

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: 替换 Photo 相关状态为 Thumbnail**

重写 store 中的状态管理：

```typescript
interface AppState {
  // ... 保留 Baby、Project、Period 相关状态 ...

  // 统一缩略图列表（替代 currentPhotos, currentVideoFrames）
  thumbnails: Thumbnail[];
  setThumbnails: (thumbnails: Thumbnail[]) => void;
  
  // 计算属性：通过筛选 is_selected 获取候选区
  // pendingThumbnails: thumbnails.filter(t => t.is_selected)
  
  // 最终选择：通过筛选 is_final 获取
  // finalThumbnail: thumbnails.find(t => t.is_final)
  
  // 操作方法
  loadThumbnails: (periodId: number) => Promise<void>;
  addThumbToPending: (id: number) => Promise<void>;
  removeThumbFromPending: (id: number) => Promise<void>;
  setThumbAsFinal: (id: number) => Promise<void>;
  cancelThumbFinal: () => Promise<void>;
  deleteThumb: (id: number) => Promise<void>;
  
  // 大图预览
  previewOriginal: (id: number) => Promise<string>;
  
  // ... 保留其他状态 ...
}
```

实现：

```typescript
// 缩略图相关
thumbnails: [],
setThumbnails: (thumbnails) => set({ thumbnails }),

loadThumbnails: async (periodId: number) => {
  try {
    const thumbs = await getPeriodThumbnails(periodId);
    set({ thumbnails: thumbs });
  } catch (e) {
    console.error('Failed to load thumbnails:', e);
  }
},

addThumbToPending: async (id: number) => {
  try {
    await addToPending(id);
    set((state) => ({
      thumbnails: state.thumbnails.map(t => 
        t.id === id ? { ...t, is_selected: true } : t
      )
    }));
  } catch (e) {
    console.error('Failed to add to pending:', e);
  }
},

removeThumbFromPending: async (id: number) => {
  try {
    await removeFromPending(id);
    set((state) => ({
      thumbnails: state.thumbnails.map(t => 
        t.id === id ? { ...t, is_selected: false } : t
      )
    }));
  } catch (e) {
    console.error('Failed to remove from pending:', e);
  }
},

setThumbAsFinal: async (id: number) => {
  const state = get();
  if (!state.currentPeriod) return;
  try {
    await setFinalThumbnail(state.currentPeriod.id, id);
    set((state) => ({
      thumbnails: state.thumbnails.map(t => ({
        ...t,
        is_final: t.id === id
      }))
    }));
  } catch (e) {
    console.error('Failed to set final:', e);
  }
},

cancelThumbFinal: async () => {
  const state = get();
  if (!state.currentPeriod) return;
  try {
    await cancelFinalThumbnail(state.currentPeriod.id);
    set((state) => ({
      thumbnails: state.thumbnails.map(t => ({ ...t, is_final: false }))
    }));
  } catch (e) {
    console.error('Failed to cancel final:', e);
  }
},

deleteThumb: async (id: number) => {
  try {
    await deleteThumbnail(id);
    set((state) => ({
      thumbnails: state.thumbnails.filter(t => t.id !== id)
    }));
  } catch (e) {
    console.error('Failed to delete thumbnail:', e);
  }
},

previewOriginal: async (id: number): Promise<string> => {
  return getOriginalFile(id);
},
```

- [ ] **Step 2: 添加计算属性**

在 store 中添加派生状态：

```typescript
// 使用 get() 访问派生状态
export const getPendingThumbnails = () => {
  return useAppStore.getState().thumbnails.filter(t => t.is_selected);
};

export const getFinalThumbnail = () => {
  return useAppStore.getState().thumbnails.find(t => t.is_final) || null;
};
```

---

## Phase 4: 组件重构

### Task 6: 重构 ThumbnailCard 组件

**Files:**
- Create: `src/components/ThumbnailCard.tsx`
- Delete: `src/components/PhotoCard.tsx` (或重命名)

- [ ] **Step 1: 创建 ThumbnailCard 组件**

```typescript
import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import type { Thumbnail } from '../types';

interface ThumbnailCardProps {
  thumbnail: Thumbnail;
  onPreview?: (thumbnail: Thumbnail) => void;
  onAddToPending?: (thumbnail: Thumbnail) => void;
  onRemoveFromPending?: (thumbnail: Thumbnail) => void;
  onSetFinal?: (thumbnail: Thumbnail) => void;
  onCancelFinal?: () => void;
}

export default function ThumbnailCard({
  thumbnail,
  onPreview,
  onAddToPending,
  onRemoveFromPending,
  onSetFinal,
  onCancelFinal,
}: ThumbnailCardProps) {
  const { is_selected, is_final, base64_data, original_file_name } = thumbnail;

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (is_final) {
      onCancelFinal?.();
    } else if (is_selected) {
      onRemoveFromPending?.(thumbnail);
    } else {
      onAddToPending?.(thumbnail);
    }
  };

  const handleSetFinal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetFinal?.(thumbnail);
  };

  return (
    <div
      className={`thumbnail-card relative group ${is_final ? 'ring-2 ring-success' : ''}`}
      onDoubleClick={() => onPreview?.(thumbnail)}
    >
      <div className="thumbnail-image" style={{ aspectRatio: '4/3' }}>
        {base64_data ? (
          <img src={base64_data} alt={original_file_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
            <span className="text-2xl opacity-25">📷</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className={`actions absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 transition-opacity ${is_final ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {!is_final && (
          <>
            <button
              className="action-btn bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded"
              onClick={handleAction}
            >
              {is_selected ? (
                <>
                  <X className="w-3 h-3 inline mr-1" />
                  取消
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 inline mr-1" />
                  加入
                </>
              )}
            </button>
            <button
              className="action-btn bg-success hover:bg-success-dark text-white text-xs px-2 py-1 rounded font-medium"
              onClick={handleSetFinal}
            >
              <Check className="w-3 h-3 inline mr-1" />
              最终
            </button>
          </>
        )}
        {is_final && (
          <button
            className="action-btn bg-error hover:bg-error/80 text-white text-xs px-2 py-1.5 rounded font-semibold"
            onClick={onCancelFinal}
          >
            <X className="w-3 h-3 inline mr-1" />
            取消最终
          </button>
        )}
      </div>

      {/* 状态标记 */}
      <div className="status absolute bottom-1.5 right-1.5 flex gap-1">
        {is_selected && !is_final && (
          <div className="w-2 h-2 rounded-full bg-warning" />
        )}
        {is_final && (
          <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加样式（在 globals.css 中）**

```css
.thumbnail-card {
  @apply relative rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer;
}

.thumbnail-image {
  @apply w-full overflow-hidden;
}

.action-btn {
  @apply flex items-center justify-center;
}
```

---

### Task 7: 重构 ThumbnailGrid 组件

**Files:**
- Create: `src/components/ThumbnailGrid.tsx`

- [ ] **Step 1: 创建 ThumbnailGrid 组件**

```typescript
import type { Thumbnail } from '../types';
import ThumbnailCard from './ThumbnailCard';

interface ThumbnailGridProps {
  thumbnails: Thumbnail[];
  onPreview?: (thumbnail: Thumbnail) => void;
  onAddToPending?: (thumbnail: Thumbnail) => void;
  onRemoveFromPending?: (thumbnail: Thumbnail) => void;
  onSetFinal?: (thumbnail: Thumbnail) => void;
  onCancelFinal?: () => void;
}

export default function ThumbnailGrid({
  thumbnails,
  onPreview,
  onAddToPending,
  onRemoveFromPending,
  onSetFinal,
  onCancelFinal,
}: ThumbnailGridProps) {
  return (
    <div className="thumbnail-grid">
      {thumbnails.map((thumb) => (
        <ThumbnailCard
          key={thumb.id}
          thumbnail={thumb}
          onPreview={onPreview}
          onAddToPending={onAddToPending}
          onRemoveFromPending={onRemoveFromPending}
          onSetFinal={onSetFinal}
          onCancelFinal={onCancelFinal}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 添加网格样式（在 globals.css 中）**

```css
.thumbnail-grid {
  @apply grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3;
}
```

---

### Task 8: 创建大图预览 Modal

**Files:**
- Create: `src/components/ThumbnailPreviewModal.tsx`

- [ ] **Step 1: 创建 ThumbnailPreviewModal 组件**

```typescript
import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Thumbnail } from '../types';
import { getOriginalFile } from '../utils/tauriCommands';

interface ThumbnailPreviewModalProps {
  visible: boolean;
  thumbnail: Thumbnail | null;
  thumbnails: Thumbnail[];
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export default function ThumbnailPreviewModal({
  visible,
  thumbnail,
  thumbnails,
  onClose,
  onNavigate,
}: ThumbnailPreviewModalProps) {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && thumbnail) {
      setLoading(true);
      getOriginalFile(thumbnail.id)
        .then(url => setOriginalUrl(url))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [visible, thumbnail?.id]);

  if (!visible) return null;

  const currentIndex = thumbnail 
    ? thumbnails.findIndex(t => t.id === thumbnail.id)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0 && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < thumbnails.length - 1 && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white" onClick={onClose}>
        <X className="w-8 h-8" />
      </button>

      {currentIndex > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}

      {currentIndex < thumbnails.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/80 hover:text-white"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}

      <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        ) : originalUrl ? (
          <img src={originalUrl} alt={thumbnail?.original_file_name} className="max-w-full max-h-[85vh] object-contain" />
        ) : (
          <div className="text-white/60">加载失败</div>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
        <span className="font-medium">{thumbnail?.original_file_name}</span>
        <span className="mx-2">·</span>
        <span>{currentIndex + 1} / {thumbnails.length}</span>
      </div>
    </div>
  );
}
```

---

### Task 9: 重构 PendingSelectionPanel

**Files:**
- Modify: `src/components/PendingSelectionPanel.tsx`

- [ ] **Step 1: 重构为使用缩略图**

```typescript
import { useEffect, useState } from 'react';
import { Check, X, Grid3X3, Wand2, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { Thumbnail } from '../types';
import { MIN_PHOTOS, MAX_PHOTOS } from '../utils/collageTemplates';

interface PendingSelectionPanelProps {
  onGenerateCollage?: () => void;
  onPreview?: (thumbnail: Thumbnail) => void;
  onSetFinal?: (thumbnail: Thumbnail) => void;
  onCancelFinal?: () => void;
}

export default function PendingSelectionPanel({
  onGenerateCollage,
  onPreview,
  onSetFinal,
  onCancelFinal,
}: PendingSelectionPanelProps) {
  const { thumbnails, loadThumbnails, currentPeriod } = useAppStore();

  // 筛选候选区中的缩略图
  const pendingThumbnails = thumbnails.filter(t => t.is_selected);
  const finalThumbnail = thumbnails.find(t => t.is_final);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatingCollage, setGeneratingCollage] = useState(false);

  // 加载缩略图
  useEffect(() => {
    if (currentPeriod) {
      loadThumbnails(currentPeriod.id);
    }
  }, [currentPeriod?.id]);

  const multiSelectedCount = pendingThumbnails.filter(t => selectedIds.has(t.id)).length;
  const canCollage = multiSelectedCount >= MIN_PHOTOS && multiSelectedCount <= MAX_PHOTOS;

  const handleToggleMultiSelect = (thumb: Thumbnail) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(thumb.id)) next.delete(thumb.id);
      else next.add(thumb.id);
      return next;
    });
  };

  const getSourceLabel = (thumb: Thumbnail) => {
    switch (thumb.source_type) {
      case 'scan': return { text: '扫描', className: 'bg-indigo-600 text-white' };
      case 'video_frame': return { text: '截帧', className: 'bg-warmth-600 text-white' };
      case 'collage': return { text: '拼图', className: 'bg-purple-600 text-white' };
      default: return { text: '未知', className: 'bg-stone-500 text-white' };
    }
  };

  return (
    <div className="stash-panel-v2 flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-200">
        <Grid3X3 className="w-4 h-4 text-stash-600" />
        <h3 className="text-sm font-semibold text-stone-900">候选照片</h3>
        <span className="text-[11px] font-bold text-stash-600 bg-stash-100 px-2 py-0.5 rounded-full">
          {pendingThumbnails.length} 张
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {pendingThumbnails.length === 0 ? (
          <div className="empty-state-v2">
            <div className="empty-icon">📋</div>
            <h4>暂无候选照片</h4>
            <p>点击照片的「加入」按钮将其添加到候选区</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {pendingThumbnails.map((thumb) => {
              const source = getSourceLabel(thumb);
              const isFinal = thumb.is_final;
              const isMultiSelected = selectedIds.has(thumb.id);

              return (
                <div
                  key={thumb.id}
                  className={`stash-compare-item relative cursor-pointer group ${isFinal ? 'ring-2 ring-success' : isMultiSelected ? 'ring-2 ring-stash-600' : ''}`}
                  onClick={() => handleToggleMultiSelect(thumb)}
                  onDoubleClick={() => onPreview?.(thumb)}
                >
                  <div className="stash-compare-thumb" style={{ aspectRatio: '4/3' }}>
                    {thumb.base64_data ? (
                      <img src={thumb.base64_data} alt={thumb.original_file_name} />
                    ) : (
                      <span className="text-3xl opacity-25">📷</span>
                    )}
                  </div>

                  {isFinal && (
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <div className="mt-1.5 px-1">
                    <div className="text-[10px] font-medium text-stone-900 truncate">
                      {thumb.original_file_name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${source.className}`}>
                        {source.text}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingThumbnails.length > 0 && (
        <div className="p-3 border-t border-stone-200 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (pendingThumbnails.length > 0 && !finalThumbnail) {
                  onSetFinal?.(pendingThumbnails[0]);
                }
              }}
              disabled={!!finalThumbnail || generatingCollage}
              className="btn btn-secondary w-full !justify-center text-xs"
            >
              <Check className="w-3 h-3" />
              选定首张
            </button>
            <button
              onClick={() => {
                setGeneratingCollage(true);
                onGenerateCollage?.();
                setGeneratingCollage(false);
              }}
              disabled={!canCollage || generatingCollage}
              className="btn btn-primary w-full !justify-center text-xs"
            >
              <Wand2 className="w-3 h-3" />
              生成拼图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Task 10: 重构 PeriodSelectPage

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx`

- [ ] **Step 1: 重构主页面使用缩略图**

主要改动：
1. 替换 `currentPhotos`, `currentVideos` 状态为统一的 `thumbnails`
2. 替换 `VirtualPhotoGrid` 为 `ThumbnailGrid`
3. 添加 `ThumbnailPreviewModal` 用于大图预览
4. 简化操作逻辑

```typescript
// 状态
const { thumbnails, setThumbnails, loadThumbnails, currentPeriod } = useAppStore();
const [previewThumb, setPreviewThumb] = useState<Thumbnail | null>(null);
const [showPreview, setShowPreview] = useState(false);

// 加载缩略图
useEffect(() => {
  if (currentPeriod) {
    loadThumbnails(currentPeriod.id);
  }
}, [currentPeriod?.id]);

// 操作处理
const handlePreview = (thumb: Thumbnail) => {
  setPreviewThumb(thumb);
  setShowPreview(true);
};

const handleAddToPending = (thumb: Thumbnail) => {
  // 调用 store 方法
};

const handleSetFinal = (thumb: Thumbnail) => {
  // 调用 store 方法
};

// 渲染
return (
  <>
    {/* 左侧：全部缩略图 */}
    <ThumbnailGrid
      thumbnails={thumbnails}
      onPreview={handlePreview}
      onAddToPending={handleAddToPending}
      onSetFinal={handleSetFinal}
    />

    {/* 右侧：候选区面板 */}
    <PendingSelectionPanel
      onPreview={handlePreview}
      onSetFinal={handleSetFinal}
    />

    {/* 大图预览 */}
    <ThumbnailPreviewModal
      visible={showPreview}
      thumbnail={previewThumb}
      thumbnails={thumbnails}
      onClose={() => setShowPreview(false)}
      onNavigate={(idx) => setPreviewThumb(thumbnails[idx])}
    />
  </>
);
```

---

## Phase 5: 验证与测试

### Task 11: 验证编译

- [ ] **Step 1: 验证 Rust 后端编译**

Run: `cd src-tauri && cargo build --release`
Expected: 编译成功

- [ ] **Step 2: 验证前端编译**

Run: `cd .. && pnpm run build`
Expected: 编译成功

- [ ] **Step 3: 运行开发服务器测试**

Run: `pnpm tauri:dev`
Expected: 应用启动成功，数据库迁移执行

---

## 总结

### 改动范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/db.rs` | 修改 | 添加 Thumbnail 模型、迁移、CRUD |
| `src-tauri/src/thumbnail.rs` | 修改 | 添加 Base64 生成 |
| `src-tauri/src/main.rs` | 修改 | 添加 Tauri 命令 |
| `src/types/index.ts` | 修改 | 添加 Thumbnail 类型 |
| `src/utils/tauriCommands.ts` | 修改 | 添加命令封装 |
| `src/store/index.ts` | 重构 | 统一缩略图状态 |
| `src/components/ThumbnailCard.tsx` | 创建 | 缩略图卡片组件 |
| `src/components/ThumbnailGrid.tsx` | 创建 | 缩略图网格组件 |
| `src/components/ThumbnailPreviewModal.tsx` | 创建 | 大图预览组件 |
| `src/components/PendingSelectionPanel.tsx` | 重构 | 使用缩略图 |
| `src/pages/PeriodSelectPage.tsx` | 重构 | 使用缩略图 |

### 注意事项

1. **数据迁移**: 首次启动会执行数据库迁移创建 thumbnails 表
2. **向后兼容**: 保留旧的照片/视频命令，逐步废弃
3. **Base64 存储**: 缩略图直接存 Base64，数据库体积会增大
