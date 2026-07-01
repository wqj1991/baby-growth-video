# 导出周期确认照片 ZIP 压缩包 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目中所有周期的最终确认照片导出为 ZIP 压缩包，ZIP 内按周期文件夹组织，命名格式 yyyyMMdd-yyyyMMdd

**Architecture:** Rust 后端新增 `export_project_photos` Tauri command，使用 `zip` crate 生成 ZIP 文件到临时目录再拷贝到用户指定路径。前端通过 `tauri-plugin-dialog` 的 `save` 函数选择保存位置，调用后端命令，展示简单 loading 和 toast 反馈。

**Tech Stack:** Rust (zip crate, chrono, std::fs), TypeScript (invoke, save dialog, toast)

---

## 文件变更清单

| 文件 | 变更类型 | 职责 |
|------|----------|------|
| `src-tauri/Cargo.toml` | 修改 | 添加 `zip = "2"` 依赖 |
| `src-tauri/src/main.rs` | 修改 | 注册 `export_project_photos` command |
| `src-tauri/src/db.rs` | 修改 | 新增 `get_final_thumbnails_for_project` + `get_project_by_id` 公开方法 |
| `src/utils/tauriCommands.ts` | 修改 | 新增 `exportProjectPhotos` 函数和 `ExportPhotosResult` 类型 |
| `src/types.ts` | 修改 | 新增 `ExportPhotosResult` 接口 |
| `src/pages/PeriodSelectPage.tsx` | 修改 | 顶部工具栏右侧添加导出按钮 + isExporting 状态 |
| `src/pages/ProjectOverviewPage.tsx` | 修改 | 快捷操作区添加导出卡片 + isExporting 状态 |

---

### Task 1: Rust 后端 — 添加 zip 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml:33` (在 fast_image_resize 行后添加)

- [ ] **Step 1: 添加 zip crate 依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 部分，`fast_image_resize` 行之后添加:

```toml
zip = "2"
```

- [ ] **Step 2: 运行 cargo check 验证依赖安装**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video\src-tauri && cargo check`
Expected: 依赖下载成功，编译无新增错误（可能有一些 unused warning，不影响）

- [ ] **Step 3: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add zip crate dependency for photo export"
```

---

### Task 2: Rust 后端 — 添加 DB 查询方法

**Files:**
- Modify: `src-tauri/src/db.rs:783+` (在 `get_period_thumbnails` 方法附近)

- [ ] **Step 1: 添加 `get_final_thumbnails_for_project` 方法**

在 `src-tauri/src/db.rs` 的 `get_period_thumbnails` 方法之后（约 line 810），添加新方法:

```rust
    /// 获取项目中所有最终确认的缩略图（is_final = true），按 period_id 分组
    pub fn get_final_thumbnails_for_project(&self, project_id: i64) -> Result<Vec<Thumbnail>> {
        let conn = self.get_conn();
        let mut stmt = conn.prepare(
            "SELECT * FROM thumbnails WHERE project_id = ?1 AND is_final = 1 ORDER BY period_id ASC, taken_at ASC, id ASC",
        )?;
        let thumbnails = stmt.query_map(params![project_id], |row| {
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
                is_selected: row.get(13)?,
                is_final: row.get(14)?,
                taken_at: row.get(15)?,
                created_at: row.get(16)?,
            })
        })?;
        thumbnails.collect()
    }
```

注意: 字段顺序必须与 `get_period_thumbnails` 中的 row.get 序号完全一致，参照该方法的 row 映射。如果实际的 column 顺序有差异，需参照该方法的具体行号调整。

- [ ] **Step 2: 将 `get_project_by_id` 改为 pub**

找到 `src-tauri/src/db.rs` 第 571 行的 `fn get_project_by_id`，将 `fn` 改为 `pub fn`:

```rust
    pub fn get_project_by_id(&self, id: i64) -> Result<Project> {
```

- [ ] **Step 3: 运行 cargo check 验证**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video\src-tauri && cargo check`
Expected: 无编译错误

- [ ] **Step 4: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src-tauri/src/db.rs
git commit -m "feat: add get_final_thumbnails_for_project and pub get_project_by_id"
```

---

### Task 3: Rust 后端 — 实现 export_project_photos command

**Files:**
- Modify: `src-tauri/src/main.rs:737` (在 command 注册列表中添加)
- Modify: `src-tauri/src/main.rs` (在文件中添加新 command 函数)

- [ ] **Step 1: 添加 ExportPhotosResult 结构体**

在 `src-tauri/src/main.rs` 中 `struct AppState` 定义之后（约 line 24），添加:

```rust
#[derive(Debug, serde::Serialize)]
struct ExportPhotosResult {
    file_path: String,
    photo_count: usize,
    skipped_count: usize,
    total_size: u64,
    period_count: usize,
}
```

- [ ] **Step 2: 实现 export_project_photos command 函数**

在 `src-tauri/src/main.rs` 中，在现有 command 函数区域（如 `get_image_base64` 附近）添加:

```rust
#[tauri::command]
fn export_project_photos(
    project_id: i64,
    save_path: String,
    state: State<AppState>,
) -> Result<ExportPhotosResult, String> {
    use std::io::{Read, Write};
    use zip::write::SimpleFileOptions;

    let db = state.db.lock().map_err(|e| e.to_string())?;

    // 1. 获取项目信息
    let project = db.get_project_by_id(project_id).map_err(|e| e.to_string())?;

    // 2. 获取所有周期（按 start_date 排序）
    let periods = db.get_periods(project_id).map_err(|e| e.to_string())?;

    // 3. 获取项目中所有最终确认的缩略图
    let final_thumbnails = db.get_final_thumbnails_for_project(project_id).map_err(|e| e.to_string())?;

    // 释放 DB lock（后续只做文件 IO，不需要 DB）
    drop(db);

    if final_thumbnails.is_empty() {
        return Err("没有可导出的照片，请先在周期中确认最终照片".to_string());
    }

    // 4. 将 final thumbnails 按 period_id 分组
    let mut period_map: std::collections::HashMap<i64, Vec<&Thumbnail>> = std::collections::HashMap::new();
    for thumb in &final_thumbnails {
        period_map.entry(thumb.period_id).or_default().push(thumb);
    }

    // 5. 计算日期格式化的周期文件夹名
    let format_date = |date_str: &str| -> String {
        // 尝试多种日期格式解析
        let formats = ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"];
        for fmt in formats {
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str, fmt) {
                return dt.format("%Y%m%d").to_string();
            }
            // 也尝试纯日期格式
            if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, fmt) {
                return d.format("%Y%m%d").to_string();
            }
        }
        // 降级: 使用原始字符串，替换非数字字符
        date_str.chars().filter(|c| c.is_ascii_digit()).take(8).collect()
    };

    // 6. 计算 ZIP 文件名中的最早/最晚日期
    let earliest_start = periods.iter()
        .map(|p| format_date(&p.start_date))
        .min()
        .unwrap_or_default();
    let latest_end = periods.iter()
        .map(|p| format_date(&p.end_date))
        .max()
        .unwrap_or_default();

    // 7. 在临时目录创建 ZIP
    let temp_dir = std::env::temp_dir();
    let temp_zip_path = temp_dir.join(format!("export_{}_{}.zip", project_id, std::time::SystemTime::now().elapsed().unwrap_or_default().as_secs()));

    let zip_file = std::fs::File::create(&temp_zip_path).map_err(|e| format!("创建临时ZIP文件失败: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let mut photo_count = 0;
    let mut skipped_count = 0;
    let mut period_count = 0;
    let mut used_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for period in &periods {
        let thumbs = period_map.get(&period.id);
        if thumbs.is_none() || thumbs.unwrap().is_empty() {
            continue; // 没有最终照片的周期跳过
        }

        period_count += 1;
        let folder_name = format!("{}-{}", format_date(&period.start_date), format_date(&period.end_date));

        for thumb in thumbs.unwrap() {
            // 读取原始文件
            let file_data = std::fs::read(&thumb.original_path);
            if let Err(_) = file_data {
                skipped_count += 1;
                continue;
            }
            let data = file_data.unwrap();

            // 构造 ZIP 内路径，处理文件名冲突
            let mut file_name = thumb.original_file_name.clone();
            let mut zip_path = format!("{}/{}", folder_name, file_name);
            while used_names.contains(&zip_path) {
                file_name = format!("{}_{}", thumb.id, thumb.original_file_name);
                zip_path = format!("{}/{}", folder_name, file_name);
            }
            used_names.insert(zip_path.clone());

            zip_writer.start_file(&zip_path, options).map_err(|e| format!("写入ZIP条目失败: {}", e))?;
            zip_writer.write_all(&data).map_err(|e| format!("写入ZIP数据失败: {}", e))?;

            photo_count += 1;
        }
    }

    zip_writer.finish().map_err(|e| format!("完成ZIP写入失败: {}", e))?;

    // 8. 将临时 ZIP 拷贝到用户指定路径
    let total_size = std::fs::metadata(&temp_zip_path).map(|m| m.len()).unwrap_or(0);
    std::fs::copy(&temp_zip_path, &save_path).map_err(|e| format!("拷贝ZIP到目标路径失败: {}", e))?;
    std::fs::remove_file(&temp_zip_path).ok(); // 清理临时文件

    Ok(ExportPhotosResult {
        file_path: save_path,
        photo_count,
        skipped_count,
        total_size,
        period_count,
    })
}
```

- [ ] **Step 3: 注册 command 到 Tauri**

在 `src-tauri/src/main.rs` 的 `.invoke_handler(tauri::generate_handler![...])` 列表中（约 line 736），在 `get_temp_frames` 之后添加 `export_project_photos`:

```rust
            get_temp_frames,
            export_project_photos,
```

- [ ] **Step 4: 运行 cargo check 验证**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video\src-tauri && cargo check`
Expected: 无编译错误。如果有类型不匹配（如 Thumbnail 的 row 字段序号不对），根据 cargo check 提示修正。

- [ ] **Step 5: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src-tauri/src/main.rs
git commit -m "feat: add export_project_photos Tauri command"
```

---

### Task 4: 前端 — 添加 TypeScript 类型

**Files:**
- Modify: `src/types.ts:251+` (在 Thumbnail 接口之后)

- [ ] **Step 1: 添加 ExportPhotosResult 接口**

在 `src/types.ts` 中 `Thumbnail` 接口定义之后（约 line 251），添加:

```typescript
export interface ExportPhotosResult {
  file_path: string;
  photo_count: number;
  skipped_count: number;
  total_size: number;
  period_count: number;
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src/types.ts
git commit -m "feat: add ExportPhotosResult TypeScript interface"
```

---

### Task 5: 前端 — 添加 tauriCommands 导出函数

**Files:**
- Modify: `src/utils/tauriCommands.ts:1` (import 新增 ExportPhotosResult)
- Modify: `src/utils/tauriCommands.ts:389+` (在文件末尾添加新函数)

- [ ] **Step 1: 在 import 中添加 ExportPhotosResult**

修改 `src/utils/tauriCommands.ts` 第 4-21 行的 import 块，在 `Thumbnail` 之后添加 `ExportPhotosResult`:

```typescript
import type {
  Baby,
  Project,
  Period,
  Video,
  ExportRecord,
  ScanResult,
  ScanResultsBatch,
  ScanLog,
  ScanLogFile,
  VideoConfig,
  AiSettings,
  PeriodStats,
  PhotoText,
  PendingItem,
  VideoFrameTemp,
  Thumbnail,
  ExportPhotosResult,
} from '../types';
```

- [ ] **Step 2: 在文件末尾添加导出函数**

在 `src/utils/tauriCommands.ts` 的 `getOriginalFile` 函数之后（约 line 389），添加:

```typescript
// ==================== 导出照片 ====================

export async function exportProjectPhotos(
  projectId: number,
  savePath: string
): Promise<ExportPhotosResult> {
  return invoke('export_project_photos', { projectId, savePath });
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src/utils/tauriCommands.ts
git commit -m "feat: add exportProjectPhotos tauri command wrapper"
```

---

### Task 6: 前端 — PeriodSelectPage 添加导出按钮

**Files:**
- Modify: `src/pages/PeriodSelectPage.tsx:1-27` (import 新增)
- Modify: `src/pages/PeriodSelectPage.tsx:72-106` (添加 isExporting 状态)
- Modify: `src/pages/PeriodSelectPage.tsx:560-602` (顶部工具栏添加导出按钮)
- Modify: `src/pages/PeriodSelectPage.tsx:540-558` (添加 handleExport 函数)

- [ ] **Step 1: 在 import 中添加导出相关依赖**

修改 `src/pages/PeriodSelectPage.tsx` 第 1-27 行的 import，在已有的 import 之后:
- 在 lucide-react import 中添加 `Download`（如果尚没有的话）
- 在 tauriCommands import 中添加 `exportProjectPhotos` 和 `saveFile`

```typescript
import {
  FolderOpen,
  Plus,
  Image,
  Video as VideoIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Download,  // ← 新增
} from 'lucide-react';
```

```typescript
import {
  getPeriods,
  generatePeriods,
  createPeriod,
  getPeriodVideos,
  scanPeriodFolder,
  selectFolder,
  generateVideoFrames,
  generateVideoFramesByInterval,
  getVideoThumbnail,
  getPeriodStats,
  generateCollage,
  exportProjectPhotos,  // ← 新增
  saveFile,              // ← 新增
} from '../utils/tauriCommands';
```

- [ ] **Step 2: 添加 isExporting 状态**

在 `src/pages/PeriodSelectPage.tsx` 的 Local State 区域（约 line 100-106），在 `generatingCollage` 之后添加:

```typescript
  const [isExporting, setIsExporting] = useState(false);
```

- [ ] **Step 3: 添加 handleExport 函数**

在 `completedCount` 定义之前（约 line 555），添加导出处理函数:

```typescript
  const handleExport = async () => {
    if (!projectId || isExporting) return;

    // 计算默认 ZIP 文件名
    const completedPeriods = periods.filter(p => p.selected_photo_id);
    if (completedPeriods.length === 0) {
      showToast('warning', '无法导出', '没有可导出的照片，请先在周期中确认最终照片');
      return;
    }

    const formatDateShort = (dateStr: string) => {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    const earliest = formatDateShort(completedPeriods[0].start_date);
    const latest = formatDateShort(completedPeriods[completedPeriods.length - 1].end_date);
    const defaultName = `${currentProject?.name || '导出'}-${earliest}-${latest}.zip`;

    // 打开系统保存对话框
    const savePath = await saveFile(defaultName);
    if (!savePath) return; // 用户取消

    setIsExporting(true);
    try {
      const result = await exportProjectPhotos(parseInt(projectId), savePath);
      const sizeMB = (result.total_size / 1024 / 1024).toFixed(1);
      const dirName = result.file_path.split(/[/\\]/).slice(0, -1).join('/');
      showToast(
        'success',
        '导出成功',
        `${result.photo_count} 张照片 · ${sizeMB} MB · 保存至 ${dirName}`
      );
    } catch (error: any) {
      if (error?.toString?.().includes('没有可导出的照片')) {
        showToast('warning', '无法导出', error.toString());
      } else {
        showToast('error', '导出失败', error?.toString?.() || '导出过程中发生错误');
      }
    } finally {
      setIsExporting(false);
    }
  };
```

- [ ] **Step 4: 在顶部工具栏右侧添加导出按钮**

修改 `src/pages/PeriodSelectPage.tsx` 第 595-601 行的右侧区域，在完成计数之前添加导出按钮:

```tsx
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting || periods.filter(p => p.selected_photo_id).length === 0}
            className="btn btn-gradient btn-sm flex items-center gap-2"
            title="导出所有周期的最终确认照片为 ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? '正在导出...' : '导出照片'}
          </button>
          {currentPeriod && (
            <span className="text-xs text-stone-400">
              {completedCount}/{periods.length} 已完成
            </span>
          )}
        </div>
```

注意: `btn-gradient` 是现有的 CSS 类，对应品牌渐变样式。如果没有该类，使用 `btn btn-primary btn-sm` 作为替代。

- [ ] **Step 5: 检查编译**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src/pages/PeriodSelectPage.tsx
git commit -m "feat: add export photos button to PeriodSelectPage toolbar"
```

---

### Task 7: 前端 — ProjectOverviewPage 添加导出卡片

**Files:**
- Modify: `src/pages/ProjectOverviewPage.tsx:1-6` (import 新增)
- Modify: `src/pages/ProjectOverviewPage.tsx:11+` (添加 isExporting 状态)
- Modify: `src/pages/ProjectOverviewPage.tsx:90-130` (快捷操作区改为 4 列并添加导出卡片)

- [ ] **Step 1: 在 import 中添加导出相关依赖**

修改 `src/pages/ProjectOverviewPage.tsx` 第 1-6 行:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Calendar, Image, Clock, Video, History, Download } from 'lucide-react'; // ← 添加 Download
import { useAppStore } from '../store';
import { getPeriods, exportProjectPhotos, saveFile } from '../utils/tauriCommands'; // ← 添加 exportProjectPhotos, saveFile
import type { Period } from '../types';
```

- [ ] **Step 2: 添加 isExporting 状态和 handleExport 函数**

在 `src/pages/ProjectOverviewPage.tsx` 的 `loading` state 之后（约 line 12），添加:

```typescript
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentProject || isExporting) return;

    const completedPeriods = periods.filter(p => p.selected_photo_id);
    if (completedPeriods.length === 0) {
      showToast('warning', '无法导出', '没有可导出的照片，请先在周期中确认最终照片');
      return;
    }

    const formatDateShort = (dateStr: string) => {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };

    const earliest = formatDateShort(completedPeriods[0].start_date);
    const latest = formatDateShort(completedPeriods[completedPeriods.length - 1].end_date);
    const defaultName = `${currentProject.name}-${earliest}-${latest}.zip`;

    const savePath = await saveFile(defaultName);
    if (!savePath) return;

    setIsExporting(true);
    try {
      const result = await exportProjectPhotos(currentProject.id, savePath);
      const sizeMB = (result.total_size / 1024 / 1024).toFixed(1);
      const dirName = result.file_path.split(/[/\\]/).slice(0, -1).join('/');
      showToast(
        'success',
        '导出成功',
        `${result.photo_count} 张照片 · ${sizeMB} MB · 保存至 ${dirName}`
      );
    } catch (error: any) {
      if (error?.toString?.().includes('没有可导出的照片')) {
        showToast('warning', '无法导出', error.toString());
      } else {
        showToast('error', '导出失败', error?.toString?.() || '导出过程中发生错误');
      }
    } finally {
      setIsExporting(false);
    }
  };
```

注意: 需要在文件顶部添加 `import { showToast } from '../store/toastStore';`

- [ ] **Step 3: 修改快捷操作区为 4 列并添加导出卡片**

修改 `src/pages/ProjectOverviewPage.tsx` 第 96 行的 grid 从 `grid-cols-3` 改为 `grid-cols-4`，并在三个按钮之后添加第四个导出卡片:

```tsx
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('periods')}
              className="p-5 rounded-xl bg-primary-50 hover:bg-primary-100 transition-all text-left group border border-transparent hover:border-primary-200"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Image className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">开始选照片</h3>
              <p className="text-sm text-stone-500 mt-1">为每个周期选择代表照片</p>
            </button>

            <button
              onClick={() => navigate('generate')}
              className="p-5 rounded-xl bg-success-bg hover:bg-success-bg/60 transition-all text-left group border border-transparent hover:border-success-border"
            >
              <div className="w-12 h-12 rounded-lg bg-success text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">生成视频</h3>
              <p className="text-sm text-stone-500 mt-1">配置并生成成长视频</p>
            </button>

            <button
              onClick={() => navigate('history')}
              className="p-5 rounded-xl bg-stash-bg hover:bg-stash-bg/60 transition-all text-left group border border-transparent hover:border-stash-border"
            >
              <div className="w-12 h-12 rounded-lg bg-stash text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <History className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">历史记录</h3>
              <p className="text-sm text-stone-500 mt-1">查看已生成的视频</p>
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0}
              className="p-5 rounded-xl bg-warning-bg hover:bg-warning-bg/60 transition-all text-left group border border-transparent hover:border-warning-border disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-lg bg-warning-gradient text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-900">
                {isExporting ? '正在导出...' : '导出照片'}
              </h3>
              <p className="text-sm text-stone-500 mt-1">导出确认照片为 ZIP</p>
            </button>
          </div>
        </div>
```

注意: `bg-warning-gradient` 如果不存在于 Tailwind config，需要检查 `src/index.css` 中的 CSS 变量定义，使用等效的渐变类。实际可使用 `bg-gradient-to-br from-[var(--warning)] to-[var(--error)]"` 作为替代。

- [ ] **Step 4: 检查编译**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add src/pages/ProjectOverviewPage.tsx
git commit -m "feat: add export photos card to ProjectOverviewPage"
```

---

### Task 8: 集成测试 — cargo build + dev 启动验证

**Files:** 无新文件

- [ ] **Step 1: Rust 完整编译**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video\src-tauri && cargo build`
Expected: 编译成功，无错误

- [ ] **Step 2: 前端完整编译**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video && pnpm build`
Expected: Vite 构建成功，无错误

- [ ] **Step 3: 开发模式启动验证**

Run: `cd C:\Users\sesa621561\Documents\repos\baby-growth-video && pnpm tauri dev` (后台运行)
Expected: 应用窗口正常启动

手动验证:
- 进入一个已有项目的周期选择页 → 检查顶部工具栏是否有导出按钮
- 进入项目概览页 → 检查快捷操作区是否有导出卡片
- 点击导出按钮 → 检查是否弹出系统保存对话框
- 保存对话框确认 → 检查是否显示导出成功 toast
- 没有最终确认照片的项目 → 检查导出按钮是否 disabled 或显示 warning

- [ ] **Step 4: Final Commit（如有调试修改）**

```bash
cd C:\Users\sesa621561\Documents\repos\baby-growth-video
git add -A
git commit -m "feat: complete export photos ZIP feature - integration tested"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ ZIP 命名 yyyyMMdd-yyyyMMdd → Task 3 (format_date 函数)
- ✅ 内部按周期分文件夹 → Task 3 (folder_name 构造)
- ✅ 仅最终确认照片 → Task 2 (get_final_thumbnails_for_project)
- ✅ 照片保留原始文件名 → Task 3 (original_file_name)
- ✅ 文件名冲突加 ID 前缀 → Task 3 (used_names HashSet)
- ✅ 无 final 照片周期跳过 → Task 3 (continue on empty thumbs)
- ✅ 文件不存在跳过计数 → Task 3 (skipped_count)
- ✅ 导出按钮周期选择页 → Task 6
- ✅ 导出按钮项目概览页 → Task 7
- ✅ 系统保存对话框 → Task 6 & 7 (saveFile)
- ✅ Success toast → Task 6 & 7 (showToast success)
- ✅ Warning toast 无照片 → Task 6 & 7 (showToast warning)
- ✅ Error toast → Task 6 & 7 (showToast error)

**2. Placeholder scan:** 无 TBD/TODO/implement later 等占位符

**3. Type consistency:**
- ExportPhotosResult 字段名前后端一致 (file_path, photo_count, skipped_count, total_size, period_count)
- tauriCommands.ts 函数名与 invoke command 名一致 (export_project_photos)
- Thumbnail.original_path, original_file_name 在 Rust 和 TS 中一致
