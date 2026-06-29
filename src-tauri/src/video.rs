use crate::db::{Database, ExportRecord, NewExportRecord, Photo, Period, VideoFrame, NewVideoFrame};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::collections::HashMap;
use base64::Engine;

fn get_ffmpeg_path() -> PathBuf {
    let exe_path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let exe_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    
    let ffmpeg_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    
    let resources_dirs = [
        exe_dir.join("resources").join("ffmpeg"),
        exe_dir.join("..").join("resources").join("ffmpeg"),
        exe_dir.to_path_buf(),
    ];
    
    for dir in resources_dirs {
        let ffmpeg_path = dir.join(ffmpeg_name);
        if ffmpeg_path.exists() {
            return ffmpeg_path;
        }
    }
    
    PathBuf::from(ffmpeg_name)
}

fn get_ffprobe_path() -> PathBuf {
    let ffmpeg_path = get_ffmpeg_path();
    if ffmpeg_path.file_name().is_some() {
        let ffprobe_name = if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" };
        let mut ffprobe_path = ffmpeg_path.clone();
        ffprobe_path.set_file_name(ffprobe_name);
        if ffprobe_path.exists() {
            return ffprobe_path;
        }
    }
    
    PathBuf::from(if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoConfig {
    pub resolution: String,
    pub fps: i64,
    pub photo_duration: f64,
    pub transition: String,
    pub transition_duration: f64,
    pub background_music: Option<String>,
    pub output_format: String,
}

// 全局进度跟踪
lazy_static::lazy_static! {
    static ref PROGRESS_MAP: Mutex<HashMap<String, i32>> = Mutex::new(HashMap::new());
}

pub fn set_progress(task_id: &str, progress: i32) {
    if let Ok(mut map) = PROGRESS_MAP.lock() {
        map.insert(task_id.to_string(), progress);
    }
}

pub fn get_progress(task_id: &str) -> i32 {
    if let Ok(map) = PROGRESS_MAP.lock() {
        map.get(task_id).copied().unwrap_or(0)
    } else {
        0
    }
}

fn get_resolution_size(resolution: &str) -> (i64, i64) {
    match resolution {
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        "4k" => (3840, 2160),
        _ => (1920, 1080),
    }
}

fn get_final_photos_for_project(db: &Database, project_id: i64) -> Result<Vec<(Period, Photo)>, String> {
    let periods = db.get_periods(project_id).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for period in periods {
        if let Some(photo_id) = period.selected_photo_id {
            let photos = db.get_period_photos(period.id).map_err(|e| e.to_string())?;
            if let Some(photo) = photos.into_iter().find(|p| p.id == photo_id) {
                result.push((period, photo));
            }
        }
    }

    result.sort_by_key(|(period, _)| period.sort_order);
    Ok(result)
}

fn generate_ffmpeg_command(
    photos: &[(Period, Photo)],
    config: &VideoConfig,
    output_path: &str,
) -> Vec<String> {
    let (width, height) = get_resolution_size(&config.resolution);
    let mut args = Vec::new();

    // 输入参数
    for (_, photo) in photos {
        args.push("-loop".to_string());
        args.push("1".to_string());
        args.push("-t".to_string());
        args.push(config.photo_duration.to_string());
        args.push("-i".to_string());
        args.push(photo.file_path.clone());
    }

    // 背景音乐
    if let Some(music_path) = &config.background_music {
        args.push("-i".to_string());
        args.push(music_path.clone());
    }

    // 滤镜复杂图
    let mut filter_complex = String::new();
    let photo_count = photos.len();

    for i in 0..photo_count {
        // 缩放和裁剪到目标分辨率，保持比例并居中裁剪
        filter_complex.push_str(&format!(
            "[{}:v]scale={}:{}:force_original_aspect_ratio=increase,crop={}:{},format=yuv420p,setdar={}/{},setsar=1[v{}];",
            i, width, height, width, height, width, height, i
        ));
    }

    // 转场效果
    if config.transition != "none" && photo_count > 1 {
        let mut current = "v0".to_string();
        for i in 1..photo_count {
            let transition_name = match config.transition.as_str() {
                "fade" => "fade",
                "slide" => "slide",
                "zoom" => "fade", // zoom用fade替代，简化实现
                _ => "fade",
            };

            let offset = (config.photo_duration - config.transition_duration).max(0.0);

            filter_complex.push_str(&format!(
                "[{}][v{}]{}=duration={}:offset={}:alpha=1[out{}];",
                current, i, transition_name, config.transition_duration, offset, i
            ));
            current = format!("out{}", i);
        }

        filter_complex.push_str(&format!("[{}]format=yuv420p[v]", current));
    } else if photo_count == 1 {
        filter_complex.push_str("[v0]format=yuv420p[v]");
    } else {
        // 无转场，直接拼接
        for i in 0..photo_count {
            filter_complex.push_str(&format!("[v{}]", i));
        }
        filter_complex.push_str(&format!("concat=n={}:v=1:a=0[v]", photo_count));
    }

    args.push("-filter_complex".to_string());
    args.push(filter_complex);

    // 输出参数
    args.push("-map".to_string());
    args.push("[v]".to_string());

    // 音频
    if config.background_music.is_some() {
        args.push("-map".to_string());
        args.push(format!("{}:a", photo_count));
        args.push("-shortest".to_string());
    }

    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-preset".to_string());
    args.push("medium".to_string());
    args.push("-crf".to_string());
    args.push("23".to_string());
    args.push("-r".to_string());
    args.push(config.fps.to_string());

    args.push("-y".to_string());
    args.push(output_path.to_string());

    args
}

pub fn generate_growth_video(
    db: &Database,
    project_id: i64,
    config: &VideoConfig,
    output_path: &str,
) -> Result<ExportRecord, String> {
    // 获取所有最终选中的照片
    let photos = get_final_photos_for_project(db, project_id)?;

    if photos.is_empty() {
        return Err("没有选中的照片".to_string());
    }

    let output_file = Path::new(output_path);
    let file_name = output_file
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("output.mp4")
        .to_string();

    // 确保输出目录存在
    if let Some(parent) = output_file.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // 创建导出记录
    let new_record = NewExportRecord {
        project_id,
        output_path: output_path.to_string(),
        file_name: file_name.clone(),
        file_size: 0,
        duration: photos.len() as f64 * config.photo_duration,
        resolution: config.resolution.clone(),
        status: "processing".to_string(),
        error_message: None,
    };

    let record = db.create_export_record(&new_record).map_err(|e| e.to_string())?;
    let task_id = record.id.to_string();

    // 设置初始进度
    set_progress(&task_id, 5);

    // 生成ffmpeg命令
    let ffmpeg_args = generate_ffmpeg_command(&photos, config, output_path);

    // 设置进度：准备完成
    set_progress(&task_id, 10);

    // 执行ffmpeg命令（静默模式）
    let status = Command::new(get_ffmpeg_path())
        .args(&ffmpeg_args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| format!("执行FFmpeg失败: {}", e))?;

    if !status.success() {
        set_progress(&task_id, 100);
        return Err("视频生成失败".to_string());
    }

    // 设置进度：完成
    set_progress(&task_id, 100);

    // 获取文件大小
    let file_size = std::fs::metadata(output_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    // 更新导出记录
    let mut updated_record = record.clone();
    updated_record.status = "success".to_string();
    updated_record.file_size = file_size;

    Ok(updated_record)
}

// 获取视频信息（时长、分辨率）
pub fn get_video_info(path: &str) -> Result<(f64, i64, i64), String> {
    let output = Command::new(get_ffprobe_path())
        .args([
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height:format=duration",
            "-of", "default=noprint_wrappers=1",
            path,
        ])
        .stderr(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("执行ffprobe失败: {}", e))?;

    if !output.status.success() {
        return Err("获取视频信息失败".to_string());
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut duration = 0.0;
    let mut width = 0;
    let mut height = 0;

    for line in output_str.lines() {
        if let Some(value) = line.strip_prefix("width=") {
            width = value.parse().unwrap_or(0);
        } else if let Some(value) = line.strip_prefix("height=") {
            height = value.parse().unwrap_or(0);
        } else if let Some(value) = line.strip_prefix("duration=") {
            duration = value.parse().unwrap_or(0.0);
        }
    }

    Ok((duration, width as i64, height as i64))
}

pub fn get_video_thumbnail(video_path: &str) -> Result<String, String> {
    let output_path = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("baby-growth-video")
        .join("thumbnails")
        .join(format!("{}.jpg", uuid::Uuid::new_v4()));
    
    std::fs::create_dir_all(output_path.parent().unwrap_or_else(|| std::path::Path::new(".")))
        .map_err(|e| e.to_string())?;
    
    let status = Command::new(get_ffmpeg_path())
        .args([
            "-ss", "0",
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            "-y",
            "-v", "error",
            output_path.to_str().unwrap_or("thumbnail.jpg"),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    
    match status {
        Ok(s) if s.success() => {
            let image_data = std::fs::read(&output_path).map_err(|e| e.to_string())?;
            let base64 = base64::engine::general_purpose::STANDARD.encode(&image_data);
            let _ = std::fs::remove_file(output_path);
            Ok(format!("data:image/jpeg;base64,{}", base64))
        }
        Ok(_) => Err("ffmpeg执行失败".to_string()),
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                Err("未找到ffmpeg，请确保已安装并添加到系统PATH".to_string())
            } else {
                Err(format!("截图失败: {}", e))
            }
        }
    }
}

// 生成视频截图
pub fn generate_video_frames(
    db: &Database,
    video_id: i64,
    count: i64,
) -> Result<Vec<VideoFrame>, String> {
    // 获取视频信息
    let video = db.get_video_by_id(video_id).map_err(|e| e.to_string())?;

    let video_path = &video.file_path;
    let duration = video.duration;

    // 如果时长为0，尝试获取视频信息
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

    // 计算截图时间点
    let interval = actual_duration / (count + 1) as f64;
    let mut frames = Vec::new();

    // 创建截图保存目录（在应用数据目录下）
    let frames_dir = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("baby-growth-video")
        .join("frames")
        .join(video_id.to_string());
    std::fs::create_dir_all(&frames_dir).map_err(|e| e.to_string())?;

    let video_stem = Path::new(video_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video");

    for i in 1..=count {
        let time_seconds = interval * i as f64;
        let frame_file_name = format!("{}_frame_{:03}.jpg", video_stem, i);
        let frame_path = frames_dir.join(&frame_file_name);

        // 使用ffmpeg截图（静默模式）
        let status = Command::new(get_ffmpeg_path())
            .args([
                "-ss", &time_seconds.to_string(),
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "2",
                "-y",
                "-v", "error",
                frame_path.to_str().unwrap_or("frame.jpg"),
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map_err(|e| format!("截图失败: {}", e))?;

        if status.success() {
            let new_frame = NewVideoFrame {
                video_id,
                period_id: video.period_id,
                file_path: frame_path.to_string_lossy().to_string(),
                time_seconds,
            };

            match db.add_video_frame(&new_frame) {
                Ok(frame) => frames.push(frame),
                Err(e) => eprintln!("保存截图失败: {}", e),
            }
        }
    }

    Ok(frames)
}
