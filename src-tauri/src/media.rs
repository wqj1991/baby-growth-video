use crate::db::{Database, NewPhoto, NewVideo, Photo, Video};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use tauri::Emitter;
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub photos: Vec<Photo>,
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

const PHOTO_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif", "tiff", "tif",
];

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

fn is_photo_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| PHOTO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn extract_date_from_filename(filename: &str) -> Option<String> {
    let re = Regex::new(r"(\d{4})[-_]?(\d{2})[-_]?(\d{2})").ok()?;
    let caps = re.captures(filename)?;
    let year = caps.get(1)?.as_str();
    let month = caps.get(2)?.as_str();
    let day = caps.get(3)?.as_str();

    let month_num: u32 = month.parse().ok()?;
    let day_num: u32 = day.parse().ok()?;
    if month_num < 1 || month_num > 12 || day_num < 1 || day_num > 31 {
        return None;
    }

    Some(format!("{}-{}-{}", year, month, day))
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

fn copy_file_to_project_dir(
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

    let mut source_file = File::open(source_path).map_err(|e| e.to_string())?;
    let mut dest_file = File::create(&dest_path).map_err(|e| e.to_string())?;

    let mut buffer = [0u8; 65536];
    loop {
        let bytes_read = source_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        dest_file.write_all(&buffer[..bytes_read]).map_err(|e| e.to_string())?;
    }

    Ok(dest_path.to_string_lossy().to_string())
}

pub fn delete_project_dir(project_id: i64) -> Result<(), String> {
    let project_dir = get_project_data_dir().join(project_id.to_string());
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn scan_media_folder(
    db: &Database,
    project_id: i64,
    folder_path: &str,
    window: tauri::Window,
) -> Result<ScanResult, String> {
    let folder = Path::new(folder_path);
    if !folder.exists() {
        return Err("文件夹不存在".to_string());
    }

    let mut scan_logs: Vec<ScanLogEntry> = Vec::new();

    emit_scan_log(&window, "info", format!("开始扫描文件夹: {}", folder_path), None, &mut scan_logs);

    let periods = db.get_periods(project_id).map_err(|e| e.to_string())?;

    let photos_dir = get_project_photos_dir(project_id);
    let videos_dir = get_project_videos_dir(project_id);

    let mut existing_paths = HashSet::new();
    for period in &periods {
        if let Ok(photos) = db.get_period_photos(period.id) {
            for photo in photos {
                existing_paths.insert(photo.file_path);
            }
        }
        if let Ok(videos) = db.get_period_videos(period.id) {
            for video in videos {
                existing_paths.insert(video.file_path);
            }
        }
    }

    let mut new_photos: Vec<NewPhoto> = Vec::new();
    let mut new_videos: Vec<NewVideo> = Vec::new();
    let mut total_photos = 0i64;
    let mut total_videos = 0i64;
    let mut skipped_duplicate_photos = 0i64;
    let mut skipped_duplicate_videos = 0i64;
    let mut skipped_no_date_photos = 0i64;
    let mut skipped_no_date_videos = 0i64;
    let mut skipped_no_period_photos = 0i64;
    let mut skipped_no_period_videos = 0i64;
    let mut skipped_copy_failed_photos = 0i64;
    let mut skipped_copy_failed_videos = 0i64;

    for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let is_photo = is_photo_file(path);
        let is_video = is_video_file(path);

        if !is_photo && !is_video {
            continue;
        }

        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        if is_photo {
            total_photos += 1;
        } else {
            total_videos += 1;
        }

        let date_str = extract_date_from_filename(&file_name);

        if date_str.is_none() {
            if is_photo {
                skipped_no_date_photos += 1;
            } else {
                skipped_no_date_videos += 1;
            }
            emit_scan_log(
                &window,
                "warn",
                format!("⚠ 无法识别日期: {}", file_name),
                Some(file_name.clone()),
                &mut scan_logs,
            );
            continue;
        }

        let period_id = match find_period_for_date(&periods, date_str.as_ref().unwrap()) {
            Some(id) => id,
            None => {
                if is_photo {
                    skipped_no_period_photos += 1;
                } else {
                    skipped_no_period_videos += 1;
                }
                emit_scan_log(
                    &window,
                    "warn",
                    format!("⚠ 日期不在周期内: {}", file_name),
                    Some(file_name.clone()),
                    &mut scan_logs,
                );
                continue;
            }
        };

        let dest_dir = if is_photo { &photos_dir } else { &videos_dir };
        let copied_path = match copy_file_to_project_dir(path, dest_dir) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("复制文件失败: {} -> {}", path.display(), e);
                if is_photo {
                    skipped_copy_failed_photos += 1;
                } else {
                    skipped_copy_failed_videos += 1;
                }
                emit_scan_log(
                    &window,
                    "error",
                    format!("✗ 复制失败: {} - {}", file_name, e),
                    Some(file_name.clone()),
                    &mut scan_logs,
                );
                continue;
            }
        };

        if existing_paths.contains(&copied_path) {
            fs::remove_file(&copied_path).ok();
            if is_photo {
                skipped_duplicate_photos += 1;
            } else {
                skipped_duplicate_videos += 1;
            }
            emit_scan_log(
                &window,
                "warn",
                format!("⚠ 跳过重复: {}", file_name),
                Some(file_name.clone()),
                &mut scan_logs,
            );
            continue;
        }

        let file_size = get_file_size(Path::new(&copied_path));

        if is_photo {
            let (width, height) = get_image_dimensions(Path::new(&copied_path));

            let new_photo = NewPhoto {
                period_id,
                file_path: copied_path.clone(),
                file_name: file_name.clone(),
                file_size,
                width,
                height,
                taken_at: date_str.clone(),
            };

            existing_paths.insert(copied_path);
            new_photos.push(new_photo);
            emit_scan_log(
                &window,
                "success",
                format!("✓ 已识别照片: {} ({})", file_name, date_str.clone().unwrap_or_default()),
                Some(file_name.clone()),
                &mut scan_logs,
            );
        } else {
            let new_video = NewVideo {
                period_id,
                file_path: copied_path.clone(),
                file_name: file_name.clone(),
                file_size,
                duration: 0.0,
                width: 0,
                height: 0,
                taken_at: date_str.clone(),
            };

            existing_paths.insert(copied_path);
            new_videos.push(new_video);
            emit_scan_log(
                &window,
                "success",
                format!("✓ 已识别视频: {} ({})", file_name, date_str.clone().unwrap_or_default()),
                Some(file_name.clone()),
                &mut scan_logs,
            );
        }
    }

    // 批量插入数据库（事务，性能提升 10-100 倍）
    let photos = db.add_photos(&new_photos).unwrap_or_else(|e| {
        eprintln!("批量插入照片失败: {}", e);
        Vec::new()
    });
    let videos = db.add_videos(&new_videos).unwrap_or_else(|e| {
        eprintln!("批量插入视频失败: {}", e);
        Vec::new()
    });

    let recognized_photos_count = photos.len() as i64;
    let recognized_videos_count = videos.len() as i64;

    let total_files = total_photos + total_videos;
    emit_scan_log(&window, "info", format!("扫描完成，共处理 {} 个文件", total_files), None, &mut scan_logs);

    // 保存日志到文件（失败不影响扫描结果）
    if let Err(e) = save_scan_log(project_id, folder_path, total_files, scan_logs) {
        eprintln!("保存扫描日志失败: {}", e);
    }

    Ok(ScanResult {
        photos,
        videos,
        total_photos,
        total_videos,
        recognized_photos: recognized_photos_count,
        recognized_videos: recognized_videos_count,
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

// ==================== 按周期扫描 ====================

pub fn scan_period_folder(
    db: &Database,
    project_id: i64,
    period_id: i64,
    folder_path: &str,
) -> Result<ScanResult, String> {
    let folder = Path::new(folder_path);
    if !folder.exists() {
        return Err("文件夹不存在".to_string());
    }

    // 获取周期信息
    let period = db.get_period(period_id).map_err(|e| e.to_string())?;
    let period_start = &period.start_date;
    let period_end = &period.end_date;

    // 清空该周期的旧文件
    // 1. 获取旧的照片和视频
    let old_photos = db.get_period_photos(period_id).unwrap_or_default();
    let old_videos = db.get_period_videos(period_id).unwrap_or_default();
    
    // 2. 删除磁盘上的文件
    for photo in &old_photos {
        if let Err(e) = fs::remove_file(&photo.file_path) {
            eprintln!("删除旧照片失败: {} -> {}", photo.file_path, e);
        }
    }
    for video in &old_videos {
        if let Err(e) = fs::remove_file(&video.file_path) {
            eprintln!("删除旧视频失败: {} -> {}", video.file_path, e);
        }
    }
    
    // 3. 删除数据库记录
    if let Err(e) = db.delete_period_photos(period_id) {
        eprintln!("删除周期照片记录失败: {}", e);
    }
    if let Err(e) = db.delete_period_videos(period_id) {
        eprintln!("删除周期视频记录失败: {}", e);
    }

    let photos_dir = get_project_photos_dir(project_id);
    let videos_dir = get_project_videos_dir(project_id);

    // 获取已存在的文件路径（用于去重） - 清空后应该是空的，但保留以防万一
    let mut existing_paths = HashSet::new();
    if let Ok(photos) = db.get_period_photos(period_id) {
        for photo in photos {
            existing_paths.insert(photo.file_path);
        }
    }
    if let Ok(videos) = db.get_period_videos(period_id) {
        for video in videos {
            existing_paths.insert(video.file_path);
        }
    }

    let mut new_photos: Vec<NewPhoto> = Vec::new();
    let mut new_videos: Vec<NewVideo> = Vec::new();
    let mut total_photos = 0i64;
    let mut total_videos = 0i64;
    let mut skipped_duplicate_photos = 0i64;
    let mut skipped_duplicate_videos = 0i64;
    let mut skipped_no_date_photos = 0i64;
    let mut skipped_no_date_videos = 0i64;
    let mut skipped_no_period_photos = 0i64;
    let mut skipped_no_period_videos = 0i64;
    let mut skipped_copy_failed_photos = 0i64;
    let mut skipped_copy_failed_videos = 0i64;

    for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let is_photo = is_photo_file(path);
        let is_video = is_video_file(path);

        if !is_photo && !is_video {
            continue;
        }

        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        if is_photo {
            total_photos += 1;
        } else {
            total_videos += 1;
        }

        // 提取日期
        let date_str = match extract_date_from_filename(&file_name) {
            Some(d) => d,
            None => {
                // 提取不到日期，跳过
                if is_photo {
                    skipped_no_date_photos += 1;
                } else {
                    skipped_no_date_videos += 1;
                }
                continue;
            }
        };

        // 判断是否在周期时间范围内
        if date_str < *period_start || date_str > *period_end {
            if is_photo {
                skipped_no_period_photos += 1;
            } else {
                skipped_no_period_videos += 1;
            }
            continue;
        }

        let dest_dir = if is_photo { &photos_dir } else { &videos_dir };
        let copied_path = match copy_file_to_project_dir(path, dest_dir) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("复制文件失败: {} -> {}", path.display(), e);
                if is_photo {
                    skipped_copy_failed_photos += 1;
                } else {
                    skipped_copy_failed_videos += 1;
                }
                continue;
            }
        };

        if existing_paths.contains(&copied_path) {
            fs::remove_file(&copied_path).ok();
            if is_photo {
                skipped_duplicate_photos += 1;
            } else {
                skipped_duplicate_videos += 1;
            }
            continue;
        }

        let file_size = get_file_size(Path::new(&copied_path));

        if is_photo {
            let (width, height) = get_image_dimensions(Path::new(&copied_path));

            let new_photo = NewPhoto {
                period_id,
                file_path: copied_path.clone(),
                file_name: file_name.clone(),
                file_size,
                width,
                height,
                taken_at: Some(date_str),
            };

            existing_paths.insert(copied_path);
            new_photos.push(new_photo);
        } else {
            let new_video = NewVideo {
                period_id,
                file_path: copied_path.clone(),
                file_name: file_name.clone(),
                file_size,
                duration: 0.0,
                width: 0,
                height: 0,
                taken_at: Some(date_str),
            };

            existing_paths.insert(copied_path);
            new_videos.push(new_video);
        }
    }

    // 批量插入数据库
    let photos = db.add_photos(&new_photos).unwrap_or_else(|e| {
        eprintln!("批量插入照片失败: {}", e);
        Vec::new()
    });
    let videos = db.add_videos(&new_videos).unwrap_or_else(|e| {
        eprintln!("批量插入视频失败: {}", e);
        Vec::new()
    });

    let recognized_photos_count = photos.len() as i64;
    let recognized_videos_count = videos.len() as i64;

    Ok(ScanResult {
        photos,
        videos,
        total_photos,
        total_videos,
        recognized_photos: recognized_photos_count,
        recognized_videos: recognized_videos_count,
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
