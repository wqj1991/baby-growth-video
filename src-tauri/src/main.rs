#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod media;
mod video;

use db::Database;
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_dialog::init as init_dialog;
use tauri_plugin_fs::init as init_fs;
use tauri_plugin_shell::init as init_shell;

struct AppState {
    db: Mutex<Database>,
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
fn scan_media_folder(
    project_id: i64,
    folder_path: String,
    window: tauri::Window,
    state: State<AppState>,
) -> Result<media::ScanResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    media::scan_media_folder(&db, project_id, &folder_path, window).map_err(|e| e.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut db = Database::new();
    if let Err(e) = db.init() {
        eprintln!("Failed to initialize database: {}", e);
    }
    
    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(db),
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
            generate_growth_video,
            get_generation_progress,
            get_export_records,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
