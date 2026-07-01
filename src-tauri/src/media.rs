use crate::db::{NewThumbnail, NewVideo, Thumbnail, Video};
use crate::thumbnail;
use crate::video;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use tauri::Emitter;
use uuid::Uuid;
use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use walkdir::WalkDir;

/// 每批次处理多少个文件后上报一次进度
const PROGRESS_BATCH_SIZE: usize = 50;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub photos: Vec<Thumbnail>,
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

/// 文件处理阶段的输出 — 尚未写入数据库
pub struct ProcessResult {
    pub new_photos: Vec<NewThumbnail>,
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

#[allow(dead_code)]
const PHOTO_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif", "tiff", "tif",
];

#[allow(dead_code)]
const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "flv", "wmv", "webm", "m4v", "3gp",
];

fn emit_scan_log(
    window: &tauri::Window,
    level: &str,
    message: String,
    file_name: Option<String>,
    logs: &mut Vec<ScanLogEntry>,
) {
    let entry = ScanLogEntry {
        level: level.to_string(),
        message: message.clone(),
        timestamp: chrono::Local::now().timestamp_millis(),
        file_name: file_name.clone(),
    };
    
    // emit 事件到前端
    if let Err(e) = window.emit("scan://log", &entry) {
        eprintln!("Failed to emit scan log event: {}", e);
    }
    
    // 收集到日志列表（用于持久化）
    logs.push(entry);
}

// ==================== 日志持久化 ====================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanLogEntry {
    pub level: String,
    pub message: String,
    pub timestamp: i64,
    pub file_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanLogFile {
    pub project_id: i64,
    pub scanned_at: String,
    pub folder_path: String,
    pub total_files: i64,
    pub logs: Vec<ScanLogEntry>,
}

fn get_scan_log_path(project_id: i64) -> PathBuf {
    let mut path = get_project_data_dir();
    path.push(project_id.to_string());
    path.push("scan-log.json");
    path
}

pub fn save_scan_log(
    project_id: i64,
    folder_path: &str,
    total_files: i64,
    logs: Vec<ScanLogEntry>,
) -> Result<(), String> {
    let log_file = ScanLogFile {
        project_id,
        scanned_at: chrono::Local::now().to_rfc3339(),
        folder_path: folder_path.to_string(),
        total_files,
        logs,
    };

    let path = get_scan_log_path(project_id);
    
    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&log_file).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn load_scan_log(project_id: i64) -> Result<Option<ScanLogFile>, String> {
    let path = get_scan_log_path(project_id);
    
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let log_file: ScanLogFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    Ok(Some(log_file))
}

// ==================== 格式检测 ====================

lazy_static::lazy_static! {
    static ref PHOTO_SET: HashSet<&'static str> = [
        "jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif", "tiff", "tif",
    ].into_iter().collect();

    static ref VIDEO_SET: HashSet<&'static str> = [
        "mp4", "mov", "avi", "mkv", "flv", "wmv", "webm", "m4v", "3gp",
    ].into_iter().collect();
}

fn is_photo_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| PHOTO_SET.contains(ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| VIDEO_SET.contains(ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_valid_date(year: i32, month: u32, day: u32) -> bool {
    chrono::NaiveDate::from_ymd_opt(year, month, day).is_some()
}

fn extract_wechat_timestamp(filename: &str) -> Option<String> {
    let re = Regex::new(r"mmexport(\d{13})").ok()?;
    let caps = re.captures(filename)?;
    let ts: i64 = caps.get(1)?.as_str().parse().ok()?;
    let dt = chrono::DateTime::from_timestamp_millis(ts)?;
    Some(dt.format("%Y-%m-%d").to_string())
}

fn extract_date_from_filename(filename: &str) -> Option<String> {
    // 微信导出图片格式: mmexport1740812345678.jpg
    if let Some(date) = extract_wechat_timestamp(filename) {
        return Some(date);
    }

    // 候选 1: 分隔格式
    // 支持 2025-03-01, 2025_03_01, 2025.03.01, 2025/03/01,
    //       2025年03月01日, 2025-3-1, 2025/3/1 等
    let re = Regex::new(r"(\d{4})[-_./年](\d{1,2})[-_./月](\d{1,2})[日]?").ok()?;
    for caps in re.captures_iter(filename) {
        let year: i32 = caps.get(1)?.as_str().parse().ok()?;
        let month: u32 = caps.get(2)?.as_str().parse().ok()?;
        let day: u32 = caps.get(3)?.as_str().parse().ok()?;
        if is_valid_date(year, month, day) {
            return Some(format!("{:04}-{:02}-{:02}", year, month, day));
        }
    }

    // 候选 2: 紧凑格式 YYYYMMDD 在连续数字串中
    let re = Regex::new(r"\d{8,}").ok()?;
    for m in re.find_iter(filename) {
        let s = m.as_str();
        if s.len() >= 8 {
            let year: i32 = s[0..4].parse().ok()?;
            let month: u32 = s[4..6].parse().ok()?;
            let day: u32 = s[6..8].parse().ok()?;
            if is_valid_date(year, month, day) {
                return Some(format!("{:04}-{:02}-{:02}", year, month, day));
            }
        }
    }

    // 候选 3: 两位年紧凑格式 YYMMDD
    let re = Regex::new(r"\d{6,}").ok()?;
    for m in re.find_iter(filename) {
        let s = m.as_str();
        if s.len() >= 6 && s.len() < 8 {
            let yy: i32 = s[0..2].parse().ok()?;
            let year = if yy >= 50 { 1900 + yy } else { 2000 + yy };
            let month: u32 = s[2..4].parse().ok()?;
            let day: u32 = s[4..6].parse().ok()?;
            if is_valid_date(year, month, day) {
                return Some(format!("{:04}-{:02}-{:02}", year, month, day));
            }
        }
    }

    None
}

fn get_file_size(path: &Path) -> i64 {
    std::fs::metadata(path)
        .map(|m| m.len() as i64)
        .unwrap_or(0)
}

fn get_jpeg_dimensions(path: &Path) -> (i64, i64) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 4];

    // 读取 SOI 标记
    match reader.read(&mut buf) {
        Ok(n) if n >= 2 => {}
        _ => return (0, 0),
    }
    if &buf[0..2] != b"\xFF\xD8" {
        return (0, 0);
    }

    let mut loop_count = 0;
    let max_loops = 100; // 防止无限循环

    loop {
        loop_count += 1;
        if loop_count > max_loops {
            return (0, 0);
        }

        // 读取段长度和标记
        match reader.read(&mut buf) {
            Ok(n) if n >= 4 => {}
            _ => return (0, 0), // 读取不足，文件可能损坏
        }

        let len = ((buf[0] as u32) << 8) | (buf[1] as u32);
        let marker = buf[2];
        let marker2 = buf[3];

        // 检查 len 是否合理（至少为 2，否则 skip_len 会是负数）
        if len < 2 {
            return (0, 0);
        }

        // SOF0 - SOF3 标记包含图像尺寸
        if marker == 0xFF && (marker2 >= 0xC0 && marker2 <= 0xC3) {
            let data_len = (len - 2) as usize;
            let mut tmp = vec![0u8; data_len];
            match reader.read(&mut tmp) {
                Ok(n) if n >= 5 => {
                    let height = ((tmp[3] as u32) << 8) | (tmp[4] as u32);
                    let width = ((tmp[5] as u32) << 8) | (tmp[6] as u32);
                    return (width as i64, height as i64);
                }
                _ => return (0, 0),
            }
        }

        // 跳过当前段
        let skip_len = (len - 2) as i64;
        if reader.seek_relative(skip_len).is_err() {
            return (0, 0);
        }
    }
}

fn get_png_dimensions(path: &Path) -> (i64, i64) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 24];
    if reader.read(&mut buf).is_err() {
        return (0, 0);
    }
    if &buf[0..8] != b"\x89PNG\r\n\x1a\n" {
        return (0, 0);
    }
    let width = u32::from_be_bytes([buf[16], buf[17], buf[18], buf[19]]);
    let height = u32::from_be_bytes([buf[20], buf[21], buf[22], buf[23]]);
    (width as i64, height as i64)
}

fn get_webp_dimensions(path: &Path) -> (i64, i64) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 12];
    if reader.read(&mut buf).is_err() {
        return (0, 0);
    }
    if &buf[0..4] != b"RIFF" || &buf[8..12] != b"WEBP" {
        return (0, 0);
    }

    let mut chunk_header = [0u8; 8];
    loop {
        if reader.read(&mut chunk_header).is_err() {
            return (0, 0);
        }
        let chunk_type = &chunk_header[4..8];
        let chunk_size = u32::from_le_bytes([chunk_header[0], chunk_header[1], chunk_header[2], chunk_header[3]]);

        if chunk_type == b"VP8 " {
            let mut vp8_data = vec![0u8; 10];
            if reader.read(&mut vp8_data).is_err() {
                return (0, 0);
            }
            let width = (u32::from_le_bytes([vp8_data[6], vp8_data[7], 0, 0]) & 0x3FFF) + 1;
            let height = (u32::from_le_bytes([vp8_data[8], vp8_data[9], 0, 0]) & 0x3FFF) + 1;
            return (width as i64, height as i64);
        } else if chunk_type == b"VP8L" {
            let mut vp8l_data = vec![0u8; 5];
            if reader.read(&mut vp8l_data).is_err() {
                return (0, 0);
            }
            let width = ((vp8l_data[2] as u32) << 8 | vp8l_data[1] as u32) + 1;
            let height = ((vp8l_data[4] as u32) << 8 | vp8l_data[3] as u32) + 1;
            return (width as i64, height as i64);
        }

        if reader.seek_relative(chunk_size as i64).is_err() {
            return (0, 0);
        }
    }
}

fn get_gif_dimensions(path: &Path) -> (i64, i64) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 10];
    if reader.read(&mut buf).is_err() {
        return (0, 0);
    }
    if &buf[0..6] != b"GIF87a" && &buf[0..6] != b"GIF89a" {
        return (0, 0);
    }
    let width = u16::from_le_bytes([buf[6], buf[7]]) as i64;
    let height = u16::from_le_bytes([buf[8], buf[9]]) as i64;
    (width, height)
}

fn get_bmp_dimensions(path: &Path) -> (i64, i64) {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return (0, 0),
    };
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 26];
    if reader.read(&mut buf).is_err() {
        return (0, 0);
    }
    if &buf[0..2] != b"BM" {
        return (0, 0);
    }
    let width = i32::from_le_bytes([buf[18], buf[19], buf[20], buf[21]]) as i64;
    let height = i32::from_le_bytes([buf[22], buf[23], buf[24], buf[25]]) as i64;
    (width.abs(), height.abs())
}

fn get_image_dimensions(path: &Path) -> (i64, i64) {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" => return get_jpeg_dimensions(path),
            "png" => return get_png_dimensions(path),
            "webp" => return get_webp_dimensions(path),
            "gif" => return get_gif_dimensions(path),
            "bmp" => return get_bmp_dimensions(path),
            _ => {}
        }
    }
    (0, 0)
}

fn find_period_for_date(
    periods: &[crate::db::Period],
    date_str: &str,
) -> Option<i64> {
    for period in periods {
        if date_str >= period.start_date.as_str() && date_str <= period.end_date.as_str() {
            return Some(period.id);
        }
    }
    None
}

fn get_project_data_dir() -> PathBuf {
    let mut path = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("baby-growth-video");
    path.push("projects");
    path
}

fn get_project_photos_dir(project_id: i64) -> PathBuf {
    let mut path = get_project_data_dir();
    path.push(project_id.to_string());
    path.push("photos");
    path
}

fn get_project_videos_dir(project_id: i64) -> PathBuf {
    let mut path = get_project_data_dir();
    path.push(project_id.to_string());
    path.push("videos");
    path
}

/// 备用复制函数（保留供未来回退使用）
#[allow(dead_code)]
fn copy_file_to_project_dir(
    source_path: &Path,
    dest_dir: &Path,
) -> Result<String, String> {
    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    let uuid = Uuid::new_v4().to_string();
    let dest_file_name = format!("{}_{}", uuid, file_name);
    let dest_path = dest_dir.join(&dest_file_name);
    fs::copy(source_path, &dest_path)
        .map(|_| dest_path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// 原子复制: 先复制到临时文件名，成功后再 rename
/// 避免并行复制时产生损坏的中途文件
fn copy_file_to_project_dir_atomic(
    source_path: &Path,
    dest_dir: &Path,
) -> Result<String, String> {
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;

    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    let uuid = Uuid::new_v4().to_string();
    let dest_file_name = format!("{}_{}", uuid, file_name);
    let dest_path = dest_dir.join(&dest_file_name);

    // 先写到临时文件
    let tmp_name = format!(".tmp_{}", dest_file_name);
    let tmp_path = dest_dir.join(&tmp_name);

    // 使用标准库的 copy（内部已优化为 8MB buffer）
    fs::copy(source_path, &tmp_path)
        .map_err(|e| e.to_string())?;

    // atomic rename
    fs::rename(&tmp_path, &dest_path)
        .map_err(|e| e.to_string())?;

    Ok(dest_path.to_string_lossy().to_string())
}

pub fn delete_project_dir(project_id: i64) -> Result<(), String> {
    let project_dir = get_project_data_dir().join(project_id.to_string());
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 单个文件的处理结果（纯数据，无副作用）
#[derive(Debug, Clone)]
#[allow(dead_code)]  // 调试用途，future-proof
struct ProcessedFile {
    file_path: PathBuf,           // 原始路径
    dest_path: PathBuf,           // 目标路径 (已复制)
    is_photo: bool,
    is_video: bool,
    date_str: String,
    file_name: String,
    file_size: i64,
    width: i64,
    height: i64,
    period_id: i64,
    // 视频专用
    duration: f64,
    // 跳过原因
    skip_reason: Option<SkipReason>,
}

#[derive(Debug, Clone)]
enum SkipReason {
    NoDate,
    NoPeriod,
    Duplicate,
    CopyFailed,
}

impl std::fmt::Display for SkipReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SkipReason::NoDate => write!(f, "无法识别日期"),
            SkipReason::NoPeriod => write!(f, "日期不在周期内"),
            SkipReason::Duplicate => write!(f, "重复文件"),
            SkipReason::CopyFailed => write!(f, "复制失败"),
        }
    }
}

/// 单个文件的处理逻辑 — 纯函数，无共享可变状态
fn process_single_entry(
    path: &Path,
    periods: &[crate::db::Period],
    existing_paths: &HashSet<String>,
    photos_dir: &Path,
    videos_dir: &Path,
) -> ProcessedFile {
    let is_photo = is_photo_file(path);
    let is_video = is_video_file(path);

    if !is_photo && !is_video {
        return ProcessedFile {
            file_path: path.to_path_buf(),
            dest_path: PathBuf::new(),
            is_photo: false,
            is_video: false,
            date_str: String::new(),
            file_name: String::new(),
            file_size: 0,
            width: 0,
            height: 0,
            period_id: 0,
            duration: 0.0,
            skip_reason: None,
        };
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // 提取日期
    let date_str = match extract_date_from_filename(&file_name) {
        Some(d) => d,
        None => {
            return ProcessedFile {
                file_path: path.to_path_buf(),
                dest_path: PathBuf::new(),
                is_photo,
                is_video,
                date_str: String::new(),
                file_name: file_name.clone(),
                file_size: 0,
                width: 0,
                height: 0,
                period_id: 0,
                duration: 0.0,
                skip_reason: Some(SkipReason::NoDate),
            };
        }
    };

    // 匹配周期
    let period_id = match find_period_for_date(periods, &date_str) {
        Some(id) => id,
        None => {
            return ProcessedFile {
                file_path: path.to_path_buf(),
                dest_path: PathBuf::new(),
                is_photo,
                is_video,
                date_str: date_str.clone(),
                file_name: file_name.clone(),
                file_size: 0,
                width: 0,
                height: 0,
                period_id: 0,
                duration: 0.0,
                skip_reason: Some(SkipReason::NoPeriod),
            };
        }
    };

    // 确定目标目录
    let dest_dir = if is_photo { photos_dir } else { videos_dir };

    // 复制文件
    let copied_path = match copy_file_to_project_dir_atomic(path, dest_dir) {
        Ok(p) => p,
        Err(_) => {
            return ProcessedFile {
                file_path: path.to_path_buf(),
                dest_path: PathBuf::new(),
                is_photo,
                is_video,
                date_str: date_str.clone(),
                file_name: file_name.clone(),
                file_size: 0,
                width: 0,
                height: 0,
                period_id: 0,
                duration: 0.0,
                skip_reason: Some(SkipReason::CopyFailed),
            };
        }
    };

    // 查重 (复制后查)
    if existing_paths.contains(&copied_path) {
        // 删除重复文件
        fs::remove_file(&copied_path).ok();
        return ProcessedFile {
            file_path: path.to_path_buf(),
            dest_path: PathBuf::new(),
            is_photo,
            is_video,
            date_str: date_str.clone(),
            file_name: file_name.clone(),
            file_size: 0,
            width: 0,
            height: 0,
            period_id: 0,
            duration: 0.0,
            skip_reason: Some(SkipReason::Duplicate),
        };
    }

    let file_size = get_file_size(Path::new(&copied_path));

    if is_photo {
        let (width, height) = get_image_dimensions(Path::new(&copied_path));
        ProcessedFile {
            file_path: path.to_path_buf(),
            dest_path: PathBuf::from(&copied_path),
            is_photo: true,
            is_video: false,
            date_str: date_str.clone(),
            file_name,
            file_size,
            width,
            height,
            period_id,
            duration: 0.0,
            skip_reason: None,
        }
    } else {
        // 视频: 获取时长
        let (duration, width, height) = video::get_video_info(&copied_path).unwrap_or((0.0, 0, 0));
        ProcessedFile {
            file_path: path.to_path_buf(),
            dest_path: PathBuf::from(&copied_path),
            is_photo: false,
            is_video: true,
            date_str: date_str.clone(),
            file_name,
            file_size,
            width,
            height,
            period_id,
            duration,
            skip_reason: None,
        }
    }
}

/// 纯文件处理阶段 — 无数据库依赖，不持锁
/// 遍历文件夹、提取日期、匹配周期、复制文件、解析尺寸、emit 进度事件
/// 返回尚未写入数据库的 NewPhoto/NewVideo 列表和统计信息
pub fn process_media_folder(
    project_id: i64,
    folder_path: &str,
    periods: &[crate::db::Period],
    existing_paths: &HashSet<String>,
    window: &tauri::Window,
) -> Result<ProcessResult, String> {
    let folder = Path::new(folder_path);
    if !folder.exists() {
        return Err("文件夹不存在".to_string());
    }

    let mut scan_logs: Vec<ScanLogEntry> = Vec::new();

    emit_scan_log(window, "info", format!("开始扫描文件夹: {}", folder_path), None, &mut scan_logs);

    let photos_dir = get_project_photos_dir(project_id);
    let videos_dir = get_project_videos_dir(project_id);

    // ==================== Phase 1: 收集所有条目路径 ====================
    let entries: Vec<PathBuf> = WalkDir::new(folder)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter(|e| is_photo_file(e.path()) || is_video_file(e.path()))
        .map(|e| e.path().to_path_buf())
        .collect();

    let total_count = entries.len() as i64;

    if total_count == 0 {
        emit_scan_log(window, "info", "文件夹中没有找到照片或视频文件".to_string(), None, &mut scan_logs);
        return Ok(ProcessResult {
            new_photos: vec![],
            new_videos: vec![],
            scan_logs,
            total_photos: 0,
            total_videos: 0,
            skipped_duplicate_photos: 0,
            skipped_duplicate_videos: 0,
            skipped_no_date_photos: 0,
            skipped_no_date_videos: 0,
            skipped_no_period_photos: 0,
            skipped_no_period_videos: 0,
            skipped_copy_failed_photos: 0,
            skipped_copy_failed_videos: 0,
        });
    }

    // ==================== Phase 2: 并行处理每个文件 ====================

    let entries_arc = entries;
    let periods_arc = periods.to_vec();
    let existing_arc = existing_paths.clone();
    let photos_dir_arc = photos_dir.clone();
    let videos_dir_arc = videos_dir.clone();

    // 计算每个类型的数量
    let mut total_photos = 0i64;
    let mut total_videos = 0i64;

    for path in &entries_arc {
        if is_photo_file(path) {
            total_photos += 1;
        } else {
            total_videos += 1;
        }
    }

    let processed_results: Vec<ProcessedFile> = entries_arc
        .par_iter()
        .map(|path| {
            process_single_entry(
                path,
                &periods_arc,
                &existing_arc,
                &photos_dir_arc,
                &videos_dir_arc,
            )
        })
        .collect();

    // ==================== Phase 3: 统计结果 ====================
    let mut new_photos: Vec<NewThumbnail> = Vec::new();
    let mut new_videos: Vec<NewVideo> = Vec::new();
    let mut processed_count = 0usize;

    let mut skipped_duplicate_photos = 0i64;
    let mut skipped_duplicate_videos = 0i64;
    let mut skipped_no_date_photos = 0i64;
    let mut skipped_no_date_videos = 0i64;
    let mut skipped_no_period_photos = 0i64;
    let mut skipped_no_period_videos = 0i64;
    let mut skipped_copy_failed_photos = 0i64;
    let mut skipped_copy_failed_videos = 0i64;

    // 用于批量生成缩略图的任务列表 (dest_path, uuid, project_id, photo_index)
    let mut thumb_tasks: Vec<(String, String, i64, usize)> = Vec::new();

    for result in &processed_results {
        processed_count += 1;

        // 每 BATCH 个文件 emit 一条进度
        if processed_count % PROGRESS_BATCH_SIZE == 0 {
            emit_scan_log(
                window,
                "info",
                format!("已处理 {}/{}", processed_count, total_count),
                None,
                &mut scan_logs,
            );
        }

        let _skip_reason = match &result.skip_reason {
            Some(reason) => {
                // 统计 skip
                match reason {
                    SkipReason::NoDate => {
                        if result.is_photo {
                            skipped_no_date_photos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 无法识别日期: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_no_date_videos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 无法识别日期: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                    SkipReason::NoPeriod => {
                        if result.is_photo {
                            skipped_no_period_photos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 日期不在周期内: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_no_period_videos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 日期不在周期内: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                    SkipReason::Duplicate => {
                        if result.is_photo {
                            skipped_duplicate_photos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 跳过重复: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_duplicate_videos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 跳过重复: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                    SkipReason::CopyFailed => {
                        if result.is_photo {
                            skipped_copy_failed_photos += 1;
                            emit_scan_log(window, "error", format!("✗ 复制失败: {} - 磁盘空间不足或权限不足", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_copy_failed_videos += 1;
                            emit_scan_log(window, "error", format!("✗ 复制失败: {} - 磁盘空间不足或权限不足", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                }
                Some(reason)
            }
            None => {
                // 成功处理
                if result.is_photo {
                    let dest_path_str = result.dest_path.to_string_lossy().to_string();

                    // Extract UUID from dest filename — format is {uuid}_{original_name}
                    let uuid = result.dest_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .and_then(|s| s.split('_').next())
                        .unwrap_or("unknown")
                        .to_string();

                    // 添加到批量生成任务列表 (dest_path, uuid, project_id, photo_index)
                    thumb_tasks.push((dest_path_str.clone(), uuid.clone(), project_id, new_photos.len()));

                    emit_scan_log(
                        window,
                        "success",
                        format!(
                            "✓ 已识别照片: {} ({})",
                            result.file_name, result.date_str
                        ),
                        Some(result.file_name.clone()),
                        &mut scan_logs,
                    );
                } else if result.is_video {
                    let new_video = NewVideo {
                        period_id: result.period_id,
                        file_path: result.dest_path.to_string_lossy().to_string(),
                        file_name: result.file_name.clone(),
                        file_size: result.file_size,
                        duration: result.duration,
                        width: result.width,
                        height: result.height,
                        taken_at: Some(result.date_str.clone()),
                    };
                    new_videos.push(new_video);

                    emit_scan_log(
                        window,
                        "success",
                        format!(
                            "✓ 已识别视频: {} ({})",
                            result.file_name, result.date_str
                        ),
                        Some(result.file_name.clone()),
                        &mut scan_logs,
                    );
                }
                None
            }
        };
    }

    // 批量并行生成缩略图
    let thumb_results = batch_generate_thumbnails(&thumb_tasks);

    // 第二次循环：使用批量生成的缩略图构建 NewPhoto
    for result in &processed_results {
        if result.skip_reason.is_none() && result.is_photo {
            let dest_path_str = result.dest_path.to_string_lossy().to_string();
            let uuid = result.dest_path
                .file_name()
                .and_then(|n| n.to_str())
                .and_then(|s| s.split('_').next())
                .unwrap_or("unknown")
                .to_string();

            let thumb_path = thumb_results.get(&uuid).cloned().flatten();

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
                base64_data: thumb_path,
                width: 0,
                height: 0,
                taken_at: Some(result.date_str.clone()),
            };
            new_photos.push(new_thumbnail);
        }
    }

    let total_files = total_photos + total_videos;
    emit_scan_log(window, "info", format!("扫描完成，共处理 {} 个文件", total_files), None, &mut scan_logs);

    Ok(ProcessResult {
        new_photos,
        new_videos,
        scan_logs,
        total_photos,
        total_videos,
        skipped_duplicate_photos,
        skipped_duplicate_videos,
        skipped_no_date_photos,
        skipped_no_date_videos,
        skipped_no_period_photos,
        skipped_no_period_videos,
        skipped_copy_failed_photos,
        skipped_copy_failed_videos,
    })
}

// ==================== 按周期扫描（并行版）====================

/// 按周期处理文件夹 — 无数据库依赖，不持锁
/// 调用前由 main.rs 预取 Period 数据并删除旧 DB 记录 + 旧文件
/// 本函数只做遍历、日期过滤、复制、尺寸解析
pub fn process_period_folder(
    project_id: i64,
    period_id: i64,
    folder_path: &str,
    period: &crate::db::Period,
    window: &tauri::Window,
) -> Result<ProcessResult, String> {
    let folder = Path::new(folder_path);
    if !folder.exists() {
        return Err("文件夹不存在".to_string());
    }

    let mut scan_logs: Vec<ScanLogEntry> = Vec::new();
    emit_scan_log(
        window,
        "info",
        format!("开始扫描周期文件夹: {}", folder_path),
        None,
        &mut scan_logs,
    );

    let period_start = period.start_date.clone();
    let period_end = period.end_date.clone();

    let photos_dir = get_project_photos_dir(project_id);
    let videos_dir = get_project_videos_dir(project_id);

    // 周期扫描使用空 existing_paths（旧记录已由调用方清理）
    let existing_paths = HashSet::new();

    let mut total_photos = 0i64;
    let mut total_videos = 0i64;

    // 收集条目
    let entries: Vec<PathBuf> = WalkDir::new(folder)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter(|e| is_photo_file(e.path()) || is_video_file(e.path()))
        .map(|e| e.path().to_path_buf())
        .collect();

    // 统计总数
    for path in &entries {
        if is_photo_file(path) {
            total_photos += 1;
        } else {
            total_videos += 1;
        }
    }

    // 并行处理（带周期日期过滤）
    let results: Vec<ProcessedFile> = entries
        .par_iter()
        .map(|path| {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let date_str = match extract_date_from_filename(&file_name) {
                Some(d) => d,
                None => {
                    return ProcessedFile {
                        file_path: path.clone(),
                        dest_path: PathBuf::new(),
                        is_photo: is_photo_file(path),
                        is_video: is_video_file(path),
                        date_str: String::new(),
                        file_name,
                        file_size: 0,
                        width: 0,
                        height: 0,
                        period_id,
                        duration: 0.0,
                        skip_reason: Some(SkipReason::NoDate),
                    };
                }
            };

            if date_str < period_start || date_str > period_end {
                let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
                return ProcessedFile {
                    file_path: path.clone(),
                    dest_path: PathBuf::new(),
                    is_photo: is_photo_file(path),
                    is_video: is_video_file(path),
                    date_str: date_str.clone(),
                    file_name,
                    file_size: 0,
                    width: 0,
                    height: 0,
                    period_id,
                    duration: 0.0,
                    skip_reason: Some(SkipReason::NoPeriod),
                };
            }

            // 正常处理 — 只用当前周期
            let cloned_period = period.clone();
            process_single_entry(
                path,
                &vec![cloned_period],
                &existing_paths,
                &photos_dir,
                &videos_dir,
            )
        })
        .collect();

    // 统计结果
    let mut new_photos: Vec<NewThumbnail> = Vec::new();
    let mut new_videos: Vec<NewVideo> = Vec::new();

    let mut skipped_duplicate_photos = 0i64;
    let mut skipped_duplicate_videos = 0i64;
    let mut skipped_no_date_photos = 0i64;
    let mut skipped_no_date_videos = 0i64;
    let mut skipped_no_period_photos = 0i64;
    let mut skipped_no_period_videos = 0i64;
    let mut skipped_copy_failed_photos = 0i64;
    let mut skipped_copy_failed_videos = 0i64;

    // 用于批量生成缩略图的任务列表
    let mut thumb_tasks: Vec<(String, String, i64, usize)> = Vec::new();

    for result in &results {
        match &result.skip_reason {
            None => {
                if result.is_photo {
                    let dest_path_str = result.dest_path.to_string_lossy().to_string();

                    // Extract UUID from dest filename — format is {uuid}_{original_name}
                    let uuid = result.dest_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .and_then(|s| s.split('_').next())
                        .unwrap_or("unknown")
                        .to_string();

                    // 添加到批量生成任务列表
                    thumb_tasks.push((dest_path_str.clone(), uuid.clone(), project_id, new_photos.len()));

                    // 暂时用 None，缩略图路径将在批量生成后从结果中获取
                    let thumb_path: Option<String> = None;

                    new_photos.push(NewThumbnail {
                        project_id,
                        period_id: result.period_id,
                        source_type: "scan".to_string(),
                        source_id: None,
                        original_path: dest_path_str,
                        original_file_name: result.file_name.clone(),
                        original_width: result.width,
                        original_height: result.height,
                        original_file_size: result.file_size,
                        base64_data: thumb_path,
                        width: 0,
                        height: 0,
                        taken_at: Some(result.date_str.clone()),
                    });

                    emit_scan_log(
                        window,
                        "success",
                        format!("✓ 已识别照片: {} ({})", result.file_name, result.date_str),
                        Some(result.file_name.clone()),
                        &mut scan_logs,
                    );
                } else if result.is_video {
                    new_videos.push(NewVideo {
                        period_id: result.period_id,
                        file_path: result.dest_path.to_string_lossy().to_string(),
                        file_name: result.file_name.clone(),
                        file_size: result.file_size,
                        duration: result.duration,
                        width: result.width,
                        height: result.height,
                        taken_at: Some(result.date_str.clone()),
                    });

                    emit_scan_log(
                        window,
                        "success",
                        format!("✓ 已识别视频: {} ({})", result.file_name, result.date_str),
                        Some(result.file_name.clone()),
                        &mut scan_logs,
                    );
                }
            }
            Some(skip) => {
                match skip {
                    SkipReason::NoDate => {
                        if result.is_photo {
                            skipped_no_date_photos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 无法识别日期: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_no_date_videos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 无法识别日期: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                    SkipReason::NoPeriod => {
                        if result.is_photo {
                            skipped_no_period_photos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 日期不在周期内: {} ({})", result.file_name, result.date_str), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_no_period_videos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 日期不在周期内: {} ({})", result.file_name, result.date_str), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                    SkipReason::Duplicate => {
                        if result.is_photo {
                            skipped_duplicate_photos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 跳过重复: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_duplicate_videos += 1;
                            emit_scan_log(window, "warn", format!("⚠ 跳过重复: {}", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                    SkipReason::CopyFailed => {
                        if result.is_photo {
                            skipped_copy_failed_photos += 1;
                            emit_scan_log(window, "error", format!("✗ 复制失败: {} - 磁盘空间不足或权限不足", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        } else {
                            skipped_copy_failed_videos += 1;
                            emit_scan_log(window, "error", format!("✗ 复制失败: {} - 磁盘空间不足或权限不足", result.file_name), Some(result.file_name.clone()), &mut scan_logs);
                        }
                    }
                }
            }
        }
    }

    // 批量并行生成缩略图
    let thumb_results = batch_generate_thumbnails(&thumb_tasks);

    // 第二次循环：使用批量生成的缩略图构建 NewThumbnail
    let mut updated_photos: Vec<NewThumbnail> = Vec::new();
    for result in &results {
        if result.skip_reason.is_none() && result.is_photo {
            let dest_path_str = result.dest_path.to_string_lossy().to_string();
            let uuid = result.dest_path
                .file_name()
                .and_then(|n| n.to_str())
                .and_then(|s| s.split('_').next())
                .unwrap_or("unknown")
                .to_string();

            let thumb_path = thumb_results.get(&uuid).cloned().flatten();

            updated_photos.push(NewThumbnail {
                project_id,
                period_id: result.period_id,
                source_type: "scan".to_string(),
                source_id: None,
                original_path: dest_path_str,
                original_file_name: result.file_name.clone(),
                original_width: result.width,
                original_height: result.height,
                original_file_size: result.file_size,
                base64_data: thumb_path,
                width: 0,
                height: 0,
                taken_at: Some(result.date_str.clone()),
            });
        }
    }

    let total_files = total_photos + total_videos;
    emit_scan_log(
        window,
        "info",
        format!(
            "周期扫描完成，共处理 {} 个文件：照片 {} 张，视频 {} 个",
            total_files, total_photos, total_videos
        ),
        None,
        &mut scan_logs,
    );

    Ok(ProcessResult {
        new_photos: updated_photos,
        new_videos,
        scan_logs,
        total_photos,
        total_videos,
        skipped_duplicate_photos,
        skipped_duplicate_videos,
        skipped_no_date_photos,
        skipped_no_date_videos,
        skipped_no_period_photos,
        skipped_no_period_videos,
        skipped_copy_failed_photos,
        skipped_copy_failed_videos,
    })
}

/// 批量并行生成缩略图
/// 输入: Vec<(dest_path, uuid, project_id, photo_index)>
/// 输出: HashMap<uuid, thumbnail_path或None>
pub fn batch_generate_thumbnails(
    photos: &[(String, String, i64, usize)],  // (dest_path, uuid, project_id, photo_index)
) -> HashMap<String, Option<String>> {
    photos.par_iter()
        .map_init(
            || (),  // 每个线程独立的资源（当前无需预分配）
            |(), (dest_path, uuid, project_id, _idx)| {
                match thumbnail::generate_thumbnail(dest_path, *project_id, uuid) {
                    Ok(path) => (uuid.clone(), Some(path)),
                    Err(e) => {
                        eprintln!("缩略图生成失败 {}: {}", dest_path, e);
                        (uuid.clone(), None)
                    }
                }
            },
        )
        .collect()
}
