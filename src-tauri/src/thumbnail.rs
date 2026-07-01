use base64::Engine;
use fast_image_resize::{FilterType, IntoImageView, ResizeAlg, Resizer, ResizeOptions};
use fast_image_resize::images::Image;
use std::path::Path;

const THUMB_WIDTH: u32 = 300;

pub fn generate_thumbnail(
    source_path: &str,
    project_id: i64,
    uuid: &str,
) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    let img = image::open(source).map_err(|e| format!("Failed to open image: {}", e))?;

    let (width, height) = (img.width(), img.height());
    let ratio = THUMB_WIDTH as f64 / width as f64;
    let new_height = (height as f64 * ratio) as u32;

    let pixel_type = img.pixel_type().ok_or("Unsupported pixel type")?;
    let mut dst_image = Image::new(THUMB_WIDTH, new_height, pixel_type);

    let mut resizer = Resizer::new();
    let options = ResizeOptions {
        algorithm: ResizeAlg::Interpolation(FilterType::Bilinear),
        ..ResizeOptions::default()
    };
    resizer.resize(&img, &mut dst_image, Some(&options))
        .map_err(|e| format!("Failed to resize: {}", e))?;

    let scaled = image::RgbaImage::from_raw(THUMB_WIDTH, new_height, dst_image.buffer().to_vec())
        .ok_or("Failed to create scaled image")?;

    let data_dir = dirs_next::data_dir()
        .ok_or("Cannot get data directory".to_string())?;
    let thumb_dir = data_dir
        .join("baby-growth-video")
        .join("projects")
        .join(project_id.to_string())
        .join("thumbnails");
    std::fs::create_dir_all(&thumb_dir)
        .map_err(|e| format!("Failed to create thumbnail directory: {}", e))?;

    let thumb_path = thumb_dir.join(format!("{}_thumb.jpg", uuid));

    let mut output = std::fs::File::create(&thumb_path)
        .map_err(|e| format!("Failed to create thumbnail file: {}", e))?;

    scaled.write_to(&mut output, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to write thumbnail: {}", e))?;

    Ok(thumb_path.to_string_lossy().to_string())
}

pub fn get_image_dimensions(path: &str) -> Result<(u32, u32), String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    Ok((img.width(), img.height()))
}

pub fn generate_thumbnail_base64(source_path: &str, thumb_width: u32, _thumb_height: u32) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    let img = image::open(source).map_err(|e| format!("Failed to open image: {}", e))?;

    let (width, height) = (img.width(), img.height());
    let ratio = thumb_width as f64 / width as f64;
    let new_height = (height as f64 * ratio) as u32;

    let pixel_type = img.pixel_type().ok_or("Unsupported pixel type")?;
    let mut dst_image = Image::new(thumb_width, new_height, pixel_type);

    let mut resizer = Resizer::new();
    let options = ResizeOptions {
        algorithm: ResizeAlg::Interpolation(FilterType::Bilinear),
        ..ResizeOptions::default()
    };
    resizer.resize(&img, &mut dst_image, Some(&options))
        .map_err(|e| format!("Failed to resize: {}", e))?;

    let scaled = image::RgbaImage::from_raw(thumb_width, new_height, dst_image.buffer().to_vec())
        .ok_or("Failed to create scaled image")?;

    let mut buffer = std::io::Cursor::new(Vec::new());
    scaled.write_to(&mut buffer, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let base64_str = base64::engine::general_purpose::STANDARD.encode(buffer.into_inner());
    
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}

pub fn generate_thumbnail_base64_fixed(source_path: &str) -> Result<String, String> {
    generate_thumbnail_base64(source_path, THUMB_WIDTH, (THUMB_WIDTH as f64 * 0.75) as u32)
}
