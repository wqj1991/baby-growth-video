#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod media;
mod video;
mod ai;
mod agnes;
mod collage;
mod thumbnail;

use db::Database;
use std::sync::{Arc, Mutex};
use tauri::State;
use tauri_plugin_dialog::init as init_dialog;
use tauri_plugin_fs::init as init_fs;
use tauri_plugin_shell::init as init_shell;
use base64::Engine;
use uuid::Uuid;
use walkdir::WalkDir;

struct AppState {
    db: Arc<Mutex<Database>>,
}

// ==================== 数据库操作 ====================

#[tauri::command]
fn init_database(state: State<AppState>) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|e| e.to_string())?;
    db.init().map_err(|e| e.to_string())
}

// ==================== 宝宝相关 ====================

#[tauri::command]
fn get_babies(state: State<AppState>) -> Result<Vec<db::Baby>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_babies().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_baby(baby: db::NewBaby, state: State<AppState>) -> Result<db::Baby, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_baby(&baby).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_baby(baby: db::Baby, state: State<AppState>) -> Result<db::Baby, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_baby(&baby).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_baby(baby_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_baby(baby_id).map_err(|e| e.to_string())
}

// ==================== 项目相关 ====================

#[tauri::command]
fn get_projects(baby_id: i64, state: State<AppState>) -> Result<Vec<db::Project>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_projects(baby_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project(project: db::NewProject, state: State<AppState>) -> Result<db::Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_project(&project).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project(project: db::Project, state: State<AppState>) -> Result<db::Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_project(&project).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_project(project_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_project(project_id).map_err(|e| e.to_string())?;
    media::delete_project_dir(project_id).map_err(|e| e.to_string())
}

// ==================== 周期相关 ====================

#[tauri::command]
fn get_periods(project_id: i64, state: State<AppState>) -> Result<Vec<db::Period>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_periods(project_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_periods(
    project_id: i64,
    birth_date: String,
    period_days: i64,
    end_date: Option<String>,
    state: State<AppState>,
) -> Result<Vec<db::Period>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.generate_periods(project_id, &birth_date, period_days, end_date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn create_period(period: db::NewPeriod, state: State<AppState>) -> Result<db::Period, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_period(&period).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_period(period: db::Period, state: State<AppState>) -> Result<db::Period, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_period(&period).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_period(period_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_period(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_period_stats(project_id: i64, state: State<AppState>) -> Result<Vec<db::PeriodStats>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_period_stats(project_id).map_err(|e| e.to_string())
}

// ==================== 缩略图相关 ====================

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

#[tauri::command]
fn get_original_file(thumbnail_id: i64, state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let thumbnail = db.get_thumbnail_by_id(thumbnail_id).map_err(|e| e.to_string())?;
    thumbnail::generate_thumbnail_base64_fixed(&thumbnail.original_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_pending(thumbnail_id: i64, state: State<AppState>) -> Result<db::Thumbnail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut thumbnail = db.get_thumbnail_by_id(thumbnail_id).map_err(|e| e.to_string())?;
    thumbnail.is_selected = true;
    db.update_thumbnail(&thumbnail).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_from_pending(thumbnail_id: i64, state: State<AppState>) -> Result<db::Thumbnail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut thumbnail = db.get_thumbnail_by_id(thumbnail_id).map_err(|e| e.to_string())?;
    thumbnail.is_selected = false;
    db.update_thumbnail(&thumbnail).map_err(|e| e.to_string())
}

// ==================== 视频相关 ====================

#[tauri::command]
fn get_period_videos(period_id: i64, state: State<AppState>) -> Result<Vec<db::Video>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_period_videos(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_video_frames(
    video_id: i64,
    count: i64,
    state: State<AppState>,
) -> Result<Vec<db::VideoFrameTemp>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    video::generate_video_frames(&db, video_id, count).map_err(|e| e.to_string())
}

// ==================== 扫描文件 ====================

#[tauri::command]
async fn scan_media_folder(
    project_id: i64,
    folder_path: String,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<media::ScanResult, String> {
    let db = state.db.clone();
    let window2 = window.clone();
    let folder_path2 = folder_path.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        // ========== Lock 1: 读取 periods + 已有文件路径（毫秒级）==========
        let (periods, existing_paths) = {
            let db = db.lock().map_err(|e| e.to_string())?;
            let periods = db.get_periods(project_id).map_err(|e| e.to_string())?;
            let mut paths = std::collections::HashSet::new();
            for period in &periods {
                if let Ok(thumbnails) = db.get_period_thumbnails(period.id) {
                    for t in thumbnails { paths.insert(t.original_path); }
                }
                if let Ok(videos) = db.get_period_videos(period.id) {
                    for v in videos { paths.insert(v.file_path); }
                }
            }
            Ok::<_, String>((periods, paths))
        }?; // 锁释放

        // ========== Phase 2: 文件处理 + 分批保存到数据库（秒级）==========
        // 无锁执行文件处理，每批完成时短暂获取锁保存到数据库
        let scan_result = media::process_media_folder(
            project_id, &folder_path2, &periods, &existing_paths, &window2, &db
        )?;

        // ========== Phase 3: 保存日志（无锁 IO）==========
        let total_files = scan_result.total_photos + scan_result.total_videos;
        if let Err(e) = media::save_scan_log(project_id, &folder_path2, total_files, scan_result.scan_logs) {
            eprintln!("保存扫描日志失败: {}", e);
        }

        Ok(media::ScanResult {
            photos: Vec::new(),
            videos: Vec::new(),
            total_photos: scan_result.total_photos,
            total_videos: scan_result.total_videos,
            recognized_photos: scan_result.new_photos.len() as i64,
            recognized_videos: scan_result.new_videos.len() as i64,
            skipped_duplicate_photos: scan_result.skipped_duplicate_photos,
            skipped_duplicate_videos: scan_result.skipped_duplicate_videos,
            skipped_no_date_photos: scan_result.skipped_no_date_photos,
            skipped_no_date_videos: scan_result.skipped_no_date_videos,
            skipped_no_period_photos: scan_result.skipped_no_period_photos,
            skipped_no_period_videos: scan_result.skipped_no_period_videos,
            skipped_copy_failed_photos: scan_result.skipped_copy_failed_photos,
            skipped_copy_failed_videos: scan_result.skipped_copy_failed_videos,
        })
    }).await.map_err(|e| format!("Task failed: {}", e))?;

    result
}

#[tauri::command]
fn get_video_thumbnail(video_path: String) -> Result<String, String> {
    video::get_video_thumbnail(&video_path)
}

#[tauri::command]
async fn scan_period_folder(
    project_id: i64,
    period_id: i64,
    folder_path: String,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<media::ScanResult, String> {
    let db = state.db.clone();
    let folder_path2 = folder_path.clone();
    let window2 = window.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        // ========== Lock 1: 获取周期信息 + 删除旧 DB 记录（毫秒级）==========
        let (period, old_file_paths) = {
            let db = db.lock().map_err(|e| e.to_string())?;
            let period = db.get_period(period_id).map_err(|e| e.to_string())?;

            // 收集旧文件路径（用于后续删除文件）
            let mut paths = Vec::new();
            if let Ok(thumbnails) = db.get_period_thumbnails(period_id) {
                for t in &thumbnails { paths.push(t.original_path.clone()); }
            }
            if let Ok(videos) = db.get_period_videos(period_id) {
                for v in &videos { paths.push(v.file_path.clone()); }
            }

            // 删除旧 DB 记录
            db.delete_period_thumbnails(period_id).ok();
            db.delete_period_videos(period_id).ok();

            Ok::<_, String>((period, paths))
        }?; // 锁释放

        // ========== 删除旧物理文件（无锁 IO）==========
        for path in &old_file_paths {
            let path_obj = std::path::Path::new(path);
            if path_obj.is_dir() {
                for entry in WalkDir::new(path_obj)
                    .into_iter()
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_file())
                    .collect::<Vec<_>>()
                {
                    std::fs::remove_file(entry.path()).ok();
                }
                for entry in WalkDir::new(path_obj)
                    .into_iter()
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                {
                    std::fs::remove_dir(entry.path()).ok();
                }
            } else {
                if let Err(e) = std::fs::remove_file(path) {
                    eprintln!("删除旧文件失败: {} -> {}", path, e);
                }
            }
        }

        // ========== Phase 2: 处理新文件 + 分批保存到数据库（秒级）==========
        // 无锁执行文件处理，每批完成时短暂获取锁保存到数据库
        let scan_result = media::process_period_folder(
            project_id, period_id, &folder_path2, &period, &window2, &db
        )?;

        let recognized_photos = scan_result.new_photos.len() as i64;
        let recognized_videos = scan_result.new_videos.len() as i64;

        // ========== Phase 3: 保存日志（无锁 IO）==========
        let total_files = scan_result.total_photos + scan_result.total_videos;
        if let Err(e) = media::save_scan_log(project_id, &folder_path2, total_files, scan_result.scan_logs) {
            eprintln!("保存扫描日志失败: {}", e);
        }

        Ok(media::ScanResult {
            photos: Vec::new(),
            videos: Vec::new(),
            total_photos: scan_result.total_photos,
            total_videos: scan_result.total_videos,
            recognized_photos,
            recognized_videos,
            skipped_duplicate_photos: scan_result.skipped_duplicate_photos,
            skipped_duplicate_videos: scan_result.skipped_duplicate_videos,
            skipped_no_date_photos: scan_result.skipped_no_date_photos,
            skipped_no_date_videos: scan_result.skipped_no_date_videos,
            skipped_no_period_photos: scan_result.skipped_no_period_photos,
            skipped_no_period_videos: scan_result.skipped_no_period_videos,
            skipped_copy_failed_photos: scan_result.skipped_copy_failed_photos,
            skipped_copy_failed_videos: scan_result.skipped_copy_failed_videos,
        })
    }).await.map_err(|e| format!("Task failed: {}", e))?;

    result
}

#[tauri::command]
fn get_scan_log(project_id: i64) -> Result<Option<media::ScanLogFile>, String> {
    media::load_scan_log(project_id)
}

// ==================== 视频生成 ====================

#[tauri::command]
async fn generate_growth_video(
    project_id: i64,
    config: video::VideoConfig,
    output_path: String,
    overall_prompt: Option<String>,
    photo_texts: Option<Vec<video::PhotoText>>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<db::ExportRecord, String> {
    let db = state.db.clone();

    if config.video_mode == "agnes" {
        video::generate_growth_video_agnes(
            db,
            project_id,
            config,
            overall_prompt.unwrap_or_default(),
            photo_texts.unwrap_or_default(),
            output_path,
            app_handle,
        )
        .await
    } else {
        video::generate_growth_video_async(db, project_id, config, output_path, app_handle).await
    }
}

#[tauri::command]
fn get_generation_progress(task_id: String) -> Result<i32, String> {
    Ok(video::get_progress(&task_id))
}

// ==================== 导出记录 ====================

#[tauri::command]
fn get_export_records(
    project_id: i64,
    state: State<AppState>,
) -> Result<Vec<db::ExportRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_export_records(project_id).map_err(|e| e.to_string())
}

// ==================== 拼图生成 ====================

#[tauri::command]
fn generate_collage(
    request: collage::CollageRequest,
    project_id: i64,
    state: State<AppState>,
) -> Result<collage::CollageResult, String> {
    let result = collage::generate_collage(&request, project_id)?;

    // Generate thumbnail for the collage output (store as base64)
    let uuid = Uuid::new_v4().to_string();
    let thumb_path = match crate::thumbnail::generate_thumbnail_base64_fixed(
        &result.output_path,
    ) {
        Ok(b) => Some(b),
        Err(e) => {
            eprintln!("Collage thumbnail generation failed: {}", e);
            None
        }
    };

    // Get collage dimensions
    let (w, h) = crate::thumbnail::get_image_dimensions(&result.output_path)
        .unwrap_or((request.output_width as u32, request.output_height as u32));

    // Get file size
    let metadata = std::fs::metadata(&result.output_path)
        .map_err(|e| format!("Failed to read collage file: {}", e))?;
    let file_size = metadata.len() as i64;

    // Persist to DB
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_thumbnails(&[db::NewThumbnail {
        project_id,
        period_id: request.period_id,
        source_type: "collage".to_string(),
        source_id: None,
        original_path: result.output_path.clone(),
        original_file_name: format!("collage_{}.jpg", uuid),
        original_width: w as i64,
        original_height: h as i64,
        original_file_size: file_size,
        base64_data: thumb_path,
        width: 0,
        height: 0,
        taken_at: None,
    }])
    .map_err(|e| e.to_string())?;

    Ok(result)
}

// ==================== 设置相关 ====================

#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<std::collections::HashMap<String, String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_settings().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_settings(
    settings: std::collections::HashMap<String, String>,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    for (key, value) in settings.iter() {
        db.set_setting(key, value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_ai_settings(state: State<AppState>) -> Result<db::AiSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_ai_settings().map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_ai_connection(state: State<'_, AppState>) -> Result<String, String> {
    let settings = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_ai_settings().map_err(|e| e.to_string())?
    };

    ai::test_connection_async(&settings).await
}

// ==================== 图片加载 ====================

#[tauri::command]
fn get_image_base64(file_path: String) -> Result<String, String> {
    // 读取文件内容
    let content = std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    
    // 根据扩展名推断 MIME 类型
    let ext = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mime_type = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "heic" | "heif" => "image/heic",
        "tiff" | "tif" => "image/tiff",
        _ => "application/octet-stream",
    };
    
    // 转换为 base64
    let base64 = base64::engine::general_purpose::STANDARD.encode(&content);
    
    // 返回 data URL 格式
    Ok(format!("data:{};base64,{}", mime_type, base64))
}

// ==================== 缩略图生成 ====================

#[tauri::command]
fn generate_thumbnail(
    source_path: String,
    _project_id: i64,
    _uuid: String,
) -> Result<String, String> {
    crate::thumbnail::generate_thumbnail_base64_fixed(&source_path)
}

// ==================== 临时帧持久化 ====================

#[tauri::command]
fn persist_video_frame(
    temp_id: i64,
    project_id: i64,
    state: State<'_, AppState>,
) -> Result<db::Thumbnail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    let temp = db.get_temp_frame_by_id(temp_id).map_err(|e| e.to_string())?;
    
    let data_dir = dirs_next::data_dir().ok_or("Cannot get data directory")?;
    let project_dir = data_dir.join("baby-growth-video").join("projects").join(project_id.to_string());
    let frames_dir = project_dir.join("frames");
    let thumb_dir = project_dir.join("thumbnails");
    std::fs::create_dir_all(&frames_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    
    let uuid = uuid::Uuid::new_v4().to_string();
    let dest_frame = frames_dir.join(format!("{}_frame.jpg", uuid));
    let dest_thumb = thumb_dir.join(format!("{}_thumb.jpg", uuid));
    
    // Move thumbnail
    std::fs::rename(&temp.temp_thumb_path, &dest_thumb)
        .map_err(|e| format!("Failed to move thumbnail: {}", e))?;
    
    // Derive temp frame path from thumb path using UUID extraction
    let temp_frame_path = {
        let parent = std::path::Path::new(&temp.temp_thumb_path).parent().unwrap_or(std::path::Path::new("."));
        let stem = std::path::Path::new(&temp.temp_thumb_path)
            .file_stem().unwrap_or_default().to_string_lossy();
        let frame_stem = stem.strip_suffix("_thumb").unwrap_or(&stem);
        parent.join(format!("{}_frame.jpg", frame_stem))
    };
    
    if temp_frame_path.exists() {
        std::fs::rename(&temp_frame_path, &dest_frame)
            .map_err(|e| format!("Failed to move frame: {}", e))?;
    }
    
    let new_thumbnail = db::NewThumbnail {
        project_id,
        period_id: temp.period_id,
        source_type: "video".to_string(),
        source_id: Some(temp.video_id),
        original_path: dest_frame.to_string_lossy().to_string(),
        original_file_name: format!("{}_frame.jpg", uuid),
        original_width: 0,
        original_height: 0,
        original_file_size: 0,
        base64_data: Some(dest_thumb.to_string_lossy().to_string()),
        width: 0,
        height: 0,
        taken_at: None,
    };
    
    let mut thumbnails = db.add_thumbnails(&[new_thumbnail]).map_err(|e| e.to_string())?;
    db.delete_temp_frame(temp_id).map_err(|e| e.to_string())?;
    
    thumbnails.pop().ok_or("Failed to persist thumbnail".to_string())
}

#[tauri::command]
fn discard_temp_frames(
    video_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let paths = db.delete_all_temp_frames(video_id).map_err(|e| e.to_string())?;
    for p in &paths {
        // Derive frame path from thumb path using UUID extraction
        let frame_path = {
            let parent = std::path::Path::new(p).parent().unwrap_or(std::path::Path::new("."));
            let stem = std::path::Path::new(p)
                .file_stem().unwrap_or_default().to_string_lossy();
            let frame_stem = stem.strip_suffix("_thumb").unwrap_or(&stem);
            parent.join(format!("{}_frame.jpg", frame_stem))
        };
        if let Err(e) = std::fs::remove_file(p) {
            eprintln!("Failed to remove temp thumb file {}: {}", p, e);
        }
        if let Err(e) = std::fs::remove_file(&frame_path) {
            eprintln!("Failed to remove temp frame file {}: {}", frame_path.display(), e);
        }
    }
    Ok(())
}

#[tauri::command]
fn delete_selected_item(
    item_type: String,
    item_id: i64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let paths = db.delete_from_pending(&item_type, item_id).map_err(|e| e.to_string())?;
    if let Some((file_path, thumb_path)) = paths {
        let _ = std::fs::remove_file(&file_path);
        if let Some(tp) = thumb_path {
            let _ = std::fs::remove_file(&tp);
        }
    }
    Ok(())
}

#[tauri::command]
fn get_pending_items(
    period_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<db::PendingItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_pending_items(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_temp_frames(
    video_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<db::VideoFrameTemp>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_temp_frames(video_id).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut db = Database::new();
    if let Err(e) = db.init() {
        eprintln!("Failed to initialize database: {}", e);
    }
    
    tauri::Builder::default()
        .manage(AppState {
            db: Arc::new(Mutex::new(db)),
        })
        .plugin(init_dialog())
        .plugin(init_fs())
        .plugin(init_shell())
        .invoke_handler(tauri::generate_handler![
            init_database,
            get_babies,
            create_baby,
            update_baby,
            delete_baby,
            get_projects,
            create_project,
            update_project,
            delete_project,
            get_periods,
            generate_periods,
            create_period,
            update_period,
            delete_period,
            get_period_stats,
            get_period_thumbnails,
            update_thumbnail,
            set_final_thumbnail,
            cancel_final_thumbnail,
            delete_thumbnail,
            get_original_file,
            add_to_pending,
            remove_from_pending,
            get_period_videos,
            generate_video_frames,
            get_video_thumbnail,
            scan_media_folder,
            scan_period_folder,
            get_scan_log,
            generate_growth_video,
            get_generation_progress,
            get_export_records,
            get_image_base64,
            generate_collage,
            get_settings,
            save_settings,
            get_ai_settings,
            test_ai_connection,
            generate_thumbnail,
            persist_video_frame,
            discard_temp_frames,
            delete_selected_item,
            get_pending_items,
            get_temp_frames,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
