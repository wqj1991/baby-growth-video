use crate::db::{Database, NewPhoto, NewVideo, Photo, Video};
use crate::video;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
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
}

const PHOTO_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif", "tiff", "tif",
];

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "flv", "wmv", "webm", "m4v", "3gp",
];

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
    // 尝试从文件名中提取日期，格式如 YYYY-MM-DD 或 YYYYMMDD
    let re = Regex::new(r"(\d{4})[-_]?(\d{2})[-_]?(\d{2})").ok()?;
    let caps = re.captures(filename)?;
    let year = caps.get(1)?.as_str();
    let month = caps.get(2)?.as_str();
    let day = caps.get(3)?.as_str();

    // 验证日期是否合理
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

fn get_image_dimensions(path: &Path) -> (i64, i64) {
    // 尝试读取图片尺寸
    if let Ok(img) = image::open(path) {
        return (img.width() as i64, img.height() as i64);
    }
    (0, 0)
}

fn get_video_info(path: &Path) -> (f64, i64, i64) {
    // 使用ffmpeg获取视频信息
    match video::get_video_info(path.to_str().unwrap_or("")) {
        Ok((duration, width, height)) => (duration, width, height),
        Err(_) => (0.0, 0, 0),
    }
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

pub fn scan_media_folder(
    db: &Database,
    project_id: i64,
    folder_path: &str,
) -> Result<ScanResult, String> {
    let folder = Path::new(folder_path);
    if !folder.exists() {
        return Err("文件夹不存在".to_string());
    }

    // 获取项目的所有周期
    let periods = db.get_periods(project_id).map_err(|e| e.to_string())?;

    // 获取已有的文件路径，用于去重
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

    let mut photos: Vec<Photo> = Vec::new();
    let mut videos: Vec<Video> = Vec::new();
    let mut total_photos = 0i64;
    let mut total_videos = 0i64;
    let mut skipped_duplicate_photos = 0i64;
    let mut skipped_duplicate_videos = 0i64;
    let mut skipped_no_date_photos = 0i64;
    let mut skipped_no_date_videos = 0i64;
    let mut skipped_no_period_photos = 0i64;
    let mut skipped_no_period_videos = 0i64;

    // 遍历文件夹
    for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_path = path.to_string_lossy().to_string();
        let is_photo = is_photo_file(path);
        let is_video = is_video_file(path);

        if !is_photo && !is_video {
            continue;
        }

        if is_photo {
            total_photos += 1;
        } else {
            total_videos += 1;
        }

        // 检查是否已经存在（去重）
        if existing_paths.contains(&file_path) {
            if is_photo {
                skipped_duplicate_photos += 1;
            } else {
                skipped_duplicate_videos += 1;
            }
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // 尝试从文件名提取日期
        let date_str = extract_date_from_filename(&file_name);

        // 如果无法提取日期，跳过
        if date_str.is_none() {
            if is_photo {
                skipped_no_date_photos += 1;
            } else {
                skipped_no_date_videos += 1;
            }
            continue;
        }

        // 查找对应的周期
        let period_id = find_period_for_date(&periods, date_str.as_ref().unwrap());

        // 如果没有匹配的周期，跳过
        let period_id = match period_id {
            Some(id) => id,
            None => {
                if is_photo {
                    skipped_no_period_photos += 1;
                } else {
                    skipped_no_period_videos += 1;
                }
                continue;
            }
        };

        let file_size = get_file_size(path);

        if is_photo {
            let (width, height) = get_image_dimensions(path);

            let new_photo = NewPhoto {
                period_id,
                file_path: file_path.clone(),
                file_name: file_name.clone(),
                file_size,
                width,
                height,
                taken_at: date_str.clone(),
            };

            match db.add_photo(&new_photo) {
                Ok(photo) => {
                    existing_paths.insert(file_path);
                    photos.push(photo);
                }
                Err(e) => eprintln!("添加照片失败: {}", e),
            }
        } else {
            let (duration, width, height) = get_video_info(path);

            let new_video = NewVideo {
                period_id,
                file_path: file_path.clone(),
                file_name: file_name.clone(),
                file_size,
                duration,
                width,
                height,
                taken_at: date_str.clone(),
            };

            match db.add_video(&new_video) {
                Ok(video) => {
                    existing_paths.insert(file_path);
                    videos.push(video);
                }
                Err(e) => eprintln!("添加视频失败: {}", e),
            }
        }
    }

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
    })
}
