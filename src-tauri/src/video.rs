use crate::db::{Database, ExportRecord, NewExportRecord, Photo, Period, VideoFrame, NewVideoFrame};
use crate::ai;
use crate::agnes;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use base64::Engine;
use tauri::Emitter;

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
    pub ai_enabled: bool,
    pub video_mode: String, // "standard" | "agnes"
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

// ==================== AI 过渡帧 ====================

/// 进度事件 payload
#[derive(Debug, Clone, Serialize)]
pub struct GenerationProgress {
    pub stage: String,
    pub current: usize,
    pub total: usize,
    pub percentage: i32,
    pub message: String,
}

/// 获取项目的 AI 帧存放目录
fn get_ai_frames_dir(project_id: i64) -> PathBuf {
    let mut path = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("baby-growth-video");
    path.push("projects");
    path.push(project_id.to_string());
    path.push("ai_frames");
    path
}

/// 为每对相邻照片生成 AI 过渡帧
/// 返回 AI 帧路径列表，失败或未配置则返回 Err
fn generate_ai_frames(
    db: &Database,
    project_id: i64,
    photos: &[(Period, Photo)],
    app_handle: &tauri::AppHandle,
) -> Result<(Vec<String>, f64), String> {
    let settings = db
        .get_ai_settings()
        .map_err(|e| format!("读取 AI 设置失败: {}", e))?;

    if settings.api_key.is_empty() {
        return Err("AI 未配置（缺少 API Key）".to_string());
    }

    let provider = ai::create_provider(&settings)?;
    let total = photos.len().saturating_sub(1);

    if total == 0 {
        return Ok((vec![], settings.frame_duration));
    }

    let ai_frames_dir = get_ai_frames_dir(project_id);
    std::fs::create_dir_all(&ai_frames_dir)
        .map_err(|e| format!("创建 AI 帧目录失败: {}", e))?;

    let image_size = format!(
        "{}x{}",
        get_resolution_size(&"1080p".to_string()).0,
        get_resolution_size(&"1080p".to_string()).1
    );

    let mut ai_frame_paths = Vec::with_capacity(total);

    for i in 0..total {
        let prev_name = &photos[i].0.name;
        let next_name = &photos[i + 1].0.name;

        let prompt = ai::build_transition_prompt(&settings, prev_name, next_name);
        let output_path = ai_frames_dir
            .join(format!("transition_{:03}.png", i))
            .to_string_lossy()
            .to_string();

        let _ = app_handle.emit(
            "generation-progress",
            GenerationProgress {
                stage: "ai_generation".to_string(),
                current: i + 1,
                total,
                percentage: 10 + ((i + 1) as f64 / total as f64 * 30.0) as i32,
                message: format!("正在生成 AI 过渡帧 {}/{}（{} → {}）...", i + 1, total, prev_name, next_name),
            },
        );

        match provider.generate_image(&prompt, &image_size, &output_path) {
            Ok(path) => ai_frame_paths.push(path),
            Err(e) => {
                return Err(format!(
                    "AI 帧 {}/{} 生成失败（{} → {}）: {}",
                    i + 1, total, prev_name, next_name, e
                ));
            }
        }
    }

    Ok((ai_frame_paths, settings.frame_duration))
}

/// 构建含 AI 过渡帧的 FFmpeg 命令（concat 模式，不用 xfade）
fn build_ffmpeg_command_with_ai(
    photos: &[(Period, Photo)],
    ai_frames: &[String],
    ai_frame_duration: f64,
    config: &VideoConfig,
    output_path: &str,
) -> Vec<String> {
    let (width, height) = get_resolution_size(&config.resolution);
    let mut args = Vec::new();

    // 输入：交替排列照片和 AI 帧
    let mut total_inputs: usize = 0;
    for i in 0..photos.len() {
        // 照片
        args.push("-loop".to_string());
        args.push("1".to_string());
        args.push("-t".to_string());
        args.push(config.photo_duration.to_string());
        args.push("-i".to_string());
        args.push(photos[i].1.file_path.clone());
        total_inputs += 1;

        // AI 帧（最后一张照片后面不加）
        if i < ai_frames.len() {
            args.push("-loop".to_string());
            args.push("1".to_string());
            args.push("-t".to_string());
            args.push(ai_frame_duration.to_string());
            args.push("-i".to_string());
            args.push(ai_frames[i].clone());
            total_inputs += 1;
        }
    }

    // 背景音乐（最后一个输入）
    let music_input_idx = total_inputs;
    if let Some(music_path) = &config.background_music {
        args.push("-i".to_string());
        args.push(music_path.clone());
    }

    // filter_complex: 缩放所有输入 + concat
    let mut filter_complex = String::new();
    for i in 0..total_inputs {
        filter_complex.push_str(&format!(
            "[{}:v]scale={}:{}:force_original_aspect_ratio=increase,crop={}:{},format=yuv420p,setdar={}/{},setsar=1[v{}];",
            i, width, height, width, height, width, height, i
        ));
    }

    // concat 拼接
    for i in 0..total_inputs {
        filter_complex.push_str(&format!("[v{}]", i));
    }
    filter_complex.push_str(&format!("concat=n={}:v=1:a=0[v]", total_inputs));

    args.push("-filter_complex".to_string());
    args.push(filter_complex);

    // 输出映射
    args.push("-map".to_string());
    args.push("[v]".to_string());

    if config.background_music.is_some() {
        args.push("-map".to_string());
        args.push(format!("{}:a", music_input_idx));
        args.push("-shortest".to_string());
    }

    // 编码参数
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

// ==================== 照片文字叠加 ====================

/// 照片文字标注
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoText {
    pub period_id: i64,
    pub text: String,
}

/// 使用 image 库在照片底部渲染半透明黑底+白色文字
fn render_text_on_photo(
    input_path: &str,
    output_path: &str,
    text: &str,
) -> Result<(), String> {
    use image::{GenericImageView, Rgba, RgbaImage};
    use imageproc::drawing::draw_text_mut;
    use rusttype::{Font, Scale};

    let img = image::open(input_path)
        .map_err(|e| format!("读取图片失败: {}", e))?;

    let (width, height) = img.dimensions();
    let mut canvas = RgbaImage::from_pixel(width, height, Rgba([0, 0, 0, 0]));

    // 复制原图
    for y in 0..height {
        for x in 0..width {
            let pixel = img.get_pixel(x, y);
            canvas.put_pixel(x, y, pixel);
        }
    }

    if text.is_empty() {
        canvas.save(output_path)
            .map_err(|e| format!("保存图片失败: {}", e))?;
        return Ok(());
    }

    // 底部半透明黑色条
    let bar_height: u32 = (height as f64 * 0.12).min(100.0) as u32;
    let bar_y = height.saturating_sub(bar_height);
    let alpha: u8 = 160;
    for y in bar_y..height {
        for x in 0..width {
            let original = canvas.get_pixel(x, y);
            let blended = Rgba([
                ((original[0] as u16 * (255 - alpha) as u16) / 255) as u8,
                ((original[1] as u16 * (255 - alpha) as u16) / 255) as u8,
                ((original[2] as u16 * (255 - alpha) as u16) / 255) as u8,
                255,
            ]);
            canvas.put_pixel(x, y, blended);
        }
    }

    // 加载嵌入式字体
    let font_data: &[u8] = include_bytes!("../resources/Roboto-Regular.ttf");
    let font = Font::try_from_bytes(font_data)
        .ok_or_else(|| "无法解析字体文件".to_string())?;

    // 计算字号
    let scale = Scale::uniform((bar_height as f32 * 0.55).min(40.0).max(16.0));

    // 文字居中
    let text_width = text.len() as f32 * scale.x * 0.5;
    let x_offset = ((width as f32 - text_width) / 2.0).max(4.0) as i32;
    let y_offset = (bar_y + (bar_height as f32 * 0.18) as u32) as i32;

    draw_text_mut(
        &mut canvas,
        Rgba([255, 255, 255, 255]),
        x_offset,
        y_offset,
        scale,
        &font,
        text,
    );

    canvas
        .save(output_path)
        .map_err(|e| format!("保存处理后图片失败: {}", e))?;

    Ok(())
}

/// 将图片文件转为 base64 data URI
fn photo_to_base64_uri(path: &str) -> Result<String, String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };

    let bytes = std::fs::read(path)
        .map_err(|e| format!("读取照片失败: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

// ==================== Agnes AI 视频生成管线 ====================

pub async fn generate_growth_video_agnes(
    db: Arc<Mutex<Database>>,
    project_id: i64,
    config: VideoConfig,
    overall_prompt: String,
    photo_texts: Vec<PhotoText>,
    output_path: String,
    app_handle: tauri::AppHandle,
) -> Result<ExportRecord, String> {
    // ── Phase 1: 读取设置和照片 ──
    let (settings, photos, record) = {
        let db = db.lock().map_err(|e| e.to_string())?;
        let settings = db.get_ai_settings().map_err(|e| e.to_string())?;
        let photos = get_final_photos_for_project(&db, project_id)?;

        if photos.is_empty() {
            return Err("没有选中的照片".to_string());
        }

        let output_file = Path::new(&output_path);
        let file_name = output_file
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("output.mp4")
            .to_string();

        if let Some(parent) = output_file.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let new_record = NewExportRecord {
            project_id,
            output_path: output_path.clone(),
            file_name: file_name.clone(),
            file_size: 0,
            duration: 0.0, // Agnes 生成，时长为估算
            resolution: config.resolution.clone(),
            status: "processing".to_string(),
            error_message: None,
        };

        let record = db
            .create_export_record(&new_record)
            .map_err(|e| e.to_string())?;

        (settings, photos, record)
    };

    let total = photos.len();

    let _ = app_handle.emit(
        "generation-progress",
        GenerationProgress {
            stage: "preparing".to_string(),
            current: 0,
            total,
            percentage: 5,
            message: format!("正在准备 {} 张照片...", total),
        },
    );

    // ── Phase 2: 文字预处理 ──
    let temp_dir = get_ai_frames_dir(project_id).join("agnes_temp");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;

    let text_map: HashMap<i64, &str> = photo_texts
        .iter()
        .map(|pt| (pt.period_id, pt.text.as_str()))
        .collect();

    let mut processed_images: Vec<String> = Vec::with_capacity(total);

    for (i, (period, photo)) in photos.iter().enumerate() {
        let text = text_map.get(&period.id).copied().unwrap_or("");

        if text.is_empty() {
            // 不需要文字叠加，直接 base64 编码
            let uri = photo_to_base64_uri(&photo.file_path)?;
            processed_images.push(uri);
        } else {
            let rendered_path = temp_dir
                .join(format!("processed_{:03}.png", i))
                .to_string_lossy()
                .to_string();

            render_text_on_photo(&photo.file_path, &rendered_path, text)?;

            let uri = photo_to_base64_uri(&rendered_path)?;
            processed_images.push(uri);
        }

        let _ = app_handle.emit(
            "generation-progress",
            GenerationProgress {
                stage: "preprocessing".to_string(),
                current: i + 1,
                total,
                percentage: 5 + ((i + 1) as f64 / total as f64 * 10.0) as i32,
                message: format!("正在处理照片 {}/{}...", i + 1, total),
            },
        );
    }

    // ── Phase 3: 调用 Agnes API ──
    let api_key = settings.api_key.clone();
    let output_clone = output_path.clone();
    let ah = app_handle.clone();
    let config_resolution = config.resolution.clone();

    let agnes_result = tauri::async_runtime::spawn_blocking(move || {
        let client = agnes::AgnesVideoClient::new(&api_key);
        let (_width, _height) = get_resolution_size(&config.resolution);

        let req = agnes::KeyframesRequest {
            prompt: if overall_prompt.is_empty() {
                "A warm, cinematic montage of a growing child's precious moments, soft lighting, smooth transitions, family love".to_string()
            } else {
                overall_prompt
            },
            images: processed_images,
            num_frames: (total as u32 * 24 * 3).min(600).max(60), // 每张照片约3秒
            frame_rate: config.fps as u32,
        };

        let _ = ah.emit(
            "generation-progress",
            GenerationProgress {
                stage: "agnes_creating".to_string(),
                current: 0,
                total: 1,
                percentage: 20,
                message: "正在调用 Agnes AI 创建视频任务...".to_string(),
            },
        );

        client.generate_video_blocking(&req, &output_clone, |stage, current, total, message| {
            let percentage = match stage {
                "agnes_creating" => 25,
                "agnes_encoding" => 25 + ((current as f64 / total as f64 * 50.0) as i32),
                "agnes_downloading" => 80,
                "complete" => 100,
                _ => 30,
            };

            let _ = ah.emit(
                "generation-progress",
                GenerationProgress {
                    stage: stage.to_string(),
                    current: current as usize,
                    total: total as usize,
                    percentage,
                    message: message.to_string(),
                },
            );
        })?;

        Ok::<_, String>(())
    })
    .await
    .map_err(|e| format!("Agnes 任务异常: {}", e))?;

    // ── Phase 4: 更新记录 ──
    match agnes_result {
        Ok(()) => {
            let file_size = std::fs::metadata(&output_path)
                .map(|m| m.len() as i64)
                .unwrap_or(0);

            let mut updated_record = record.clone();
            updated_record.status = "success".to_string();
            updated_record.file_size = file_size;

            let _ = app_handle.emit(
                "generation-progress",
                GenerationProgress {
                    stage: "complete".to_string(),
                    current: total,
                    total,
                    percentage: 100,
                    message: "视频生成完成！".to_string(),
                },
            );

            Ok(updated_record)
        }
        Err(e) => {
            // ── 降级：回退到标准 FFmpeg 模式 ──
            let _ = app_handle.emit(
                "generation-progress",
                GenerationProgress {
                    stage: "agnes_fallback".to_string(),
                    current: 0,
                    total,
                    percentage: 100,
                    message: format!("Agnes 视频生成失败，回退到标准 FFmpeg: {}", e),
                },
            );

            let fallback_config = VideoConfig {
                resolution: config_resolution,
                fps: config.fps,
                photo_duration: config.photo_duration,
                transition: config.transition.clone(),
                transition_duration: config.transition_duration,
                background_music: config.background_music.clone(),
                output_format: config.output_format.clone(),
                ai_enabled: false,
                video_mode: "standard".to_string(),
            };

            // 降级到标准 async 管线
            Box::pin(generate_growth_video_async(
                db,
                project_id,
                fallback_config,
                output_path,
                app_handle,
            ))
            .await
        }
    }
}

pub async fn generate_growth_video_async(
    db: Arc<Mutex<Database>>,
    project_id: i64,
    config: VideoConfig,
    output_path: String,
    app_handle: tauri::AppHandle,
) -> Result<ExportRecord, String> {
    // ── Phase 1: 读取照片 + 创建导出记录 ──
    let (photos, record) = {
        let db = db.lock().map_err(|e| e.to_string())?;
        let photos = get_final_photos_for_project(&db, project_id)?;

        if photos.is_empty() {
            return Err("没有选中的照片".to_string());
        }

        let output_file = Path::new(&output_path);
        let file_name = output_file
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("output.mp4")
            .to_string();

        if let Some(parent) = output_file.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let new_record = NewExportRecord {
            project_id,
            output_path: output_path.clone(),
            file_name: file_name.clone(),
            file_size: 0,
            duration: photos.len() as f64 * config.photo_duration,
            resolution: config.resolution.clone(),
            status: "processing".to_string(),
            error_message: None,
        };

        let record = db
            .create_export_record(&new_record)
            .map_err(|e| e.to_string())?;
        (photos, record)
    };

    let _ = app_handle.emit(
        "generation-progress",
        GenerationProgress {
            stage: "preparing".to_string(),
            current: 0,
            total: photos.len(),
            percentage: 5,
            message: "准备生成视频...".to_string(),
        },
    );

    // ── Phase 2: AI 过渡帧生成（如启用）──
    let ai_data: Option<(Vec<String>, f64)> = if config.ai_enabled {
        let db_c = db.clone();
        let photos_c = photos.clone();
        let ah_c = app_handle.clone();

        let result = tauri::async_runtime::spawn_blocking(move || {
            let db = db_c.lock().map_err(|e| e.to_string())?;
            generate_ai_frames(&db, project_id, &photos_c, &ah_c)
        })
        .await
        .map_err(|e| format!("AI 生成任务异常: {}", e))?;

        match result {
            Ok(data) => Some(data),
            Err(e) => {
                // ── 降级：回退到标准转场 ──
                let _ = app_handle.emit(
                    "generation-progress",
                    GenerationProgress {
                        stage: "ai_fallback".to_string(),
                        current: 0,
                        total: photos.len(),
                        percentage: 10,
                        message: format!("AI 过渡帧生成失败，回退到标准转场: {}", e),
                    },
                );
                None
            }
        }
    } else {
        None
    };

    // ── Phase 3: 构建 FFmpeg 命令 ──
    let ffmpeg_args = match &ai_data {
        Some((frames, duration)) => {
            build_ffmpeg_command_with_ai(&photos, frames, *duration, &config, &output_path)
        }
        None => generate_ffmpeg_command(&photos, &config, &output_path),
    };

    // ── Phase 4: 执行 FFmpeg ──
    let ah = app_handle.clone();
    let output_clone = output_path.clone();

    let ffmpeg_result = tauri::async_runtime::spawn_blocking(move || {
        let _ = ah.emit(
            "generation-progress",
            GenerationProgress {
                stage: "ffmpeg_encoding".to_string(),
                current: 0,
                total: 1,
                percentage: 50,
                message: "正在编码视频...".to_string(),
            },
        );

        let status = Command::new(get_ffmpeg_path())
            .args(&ffmpeg_args)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map_err(|e| format!("执行 FFmpeg 失败: {}", e))?;

        if !status.success() {
            return Err("视频生成失败（FFmpeg 返回非零状态码）".to_string());
        }

        let file_size = std::fs::metadata(&output_clone)
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        Ok(file_size)
    })
    .await
    .map_err(|e| format!("FFmpeg 任务异常: {}", e))?;

    match ffmpeg_result {
        Ok(file_size) => {
            let mut updated_record = record.clone();
            updated_record.status = "success".to_string();
            updated_record.file_size = file_size;

            let _ = app_handle.emit(
                "generation-progress",
                GenerationProgress {
                    stage: "complete".to_string(),
                    current: photos.len(),
                    total: photos.len(),
                    percentage: 100,
                    message: "视频生成完成！".to_string(),
                },
            );

            Ok(updated_record)
        }
        Err(e) => {
            let _ = app_handle.emit(
                "generation-progress",
                GenerationProgress {
                    stage: "error".to_string(),
                    current: 0,
                    total: photos.len(),
                    percentage: 100,
                    message: format!("视频生成失败: {}", e),
                },
            );
            Err(e)
        }
    }
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
