#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod media;
mod video;

use db::Database;
use std::sync::{Arc, Mutex};
use tauri::State;
use tauri_plugin_dialog::init as init_dialog;
use tauri_plugin_fs::init as init_fs;
use tauri_plugin_shell::init as init_shell;
use base64::Engine;

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
    state: State<AppState>,
) -> Result<Vec<db::Period>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.generate_periods(project_id, &birth_date, period_days)
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

// ==================== 照片相关 ====================

#[tauri::command]
fn get_period_photos(period_id: i64, state: State<AppState>) -> Result<Vec<db::Photo>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_period_photos(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_photo(photo: db::Photo, state: State<AppState>) -> Result<db::Photo, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_photo(&photo).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_final_photo(period_id: i64, photo_id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_final_photo(period_id, photo_id).map_err(|e| e.to_string())
}

// ==================== 视频相关 ====================

#[tauri::command]
fn get_period_videos(period_id: i64, state: State<AppState>) -> Result<Vec<db::Video>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_period_videos(period_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_video_frames(video_id: i64, state: State<AppState>) -> Result<Vec<db::VideoFrame>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_video_frames(video_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_video_frames(
    video_id: i64,
    count: i64,
    state: State<AppState>,
) -> Result<Vec<db::VideoFrame>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    video::generate_video_frames(&db, video_id, count).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_final_video_frame(
    period_id: i64,
    frame_id: i64,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_final_video_frame(period_id, frame_id)
        .map_err(|e| e.to_string())
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
    let window = window.clone();
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        media::scan_media_folder(&db, project_id, &folder_path, window)
    }).await.map_err(|e| format!("Task failed: {}", e))?;
    
    result
}

#[tauri::command]
async fn scan_period_folder(
    project_id: i64,
    period_id: i64,
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<media::ScanResult, String> {
    let db = state.db.clone();
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        let db = db.lock().map_err(|e| e.to_string())?;
        media::scan_period_folder(&db, project_id, period_id, &folder_path)
    }).await.map_err(|e| format!("Task failed: {}", e))?;
    
    result
}

#[tauri::command]
fn get_scan_log(project_id: i64) -> Result<Option<media::ScanLogFile>, String> {
    media::load_scan_log(project_id)
}

// ==================== 视频生成 ====================

#[tauri::command]
fn generate_growth_video(
    project_id: i64,
    config: video::VideoConfig,
    output_path: String,
    state: State<AppState>,
) -> Result<db::ExportRecord, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    video::generate_growth_video(&db, project_id, &config, &output_path)
        .map_err(|e| e.to_string())
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
            get_period_photos,
            update_photo,
            set_final_photo,
            get_period_videos,
            get_video_frames,
            generate_video_frames,
            set_final_video_frame,
            scan_media_folder,
            scan_period_folder,
            get_scan_log,
            generate_growth_video,
            get_generation_progress,
            get_export_records,
            get_image_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
