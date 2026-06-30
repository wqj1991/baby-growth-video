use image::imageops::FilterType;
use std::path::Path;

const THUMB_WIDTH: u32 = 400;
const THUMB_QUALITY: u8 = 75;

/// Generate a thumbnail, saved to projects/{project_id}/thumbnails/{uuid}_thumb.jpg
/// Returns the absolute path of the thumbnail
pub fn generate_thumbnail(
    source_path: &str,
    project_id: i64,
    uuid: &str,
) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    // Open source image
    let img = image::open(source).map_err(|e| format!("Failed to open image: {}", e))?;

    // Scale to width 400px, maintaining aspect ratio
    let ratio = THUMB_WIDTH as f64 / img.width() as f64;
    let new_height = (img.height() as f64 * ratio) as u32;
    let scaled = img.resize(THUMB_WIDTH, new_height, FilterType::Lanczos3);

    // Output path
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

    // Save as JPEG with quality 75
    let mut output = std::fs::File::create(&thumb_path)
        .map_err(|e| format!("Failed to create thumbnail file: {}", e))?;

    scaled.write_to(&mut output, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to write thumbnail: {}", e))?;

    Ok(thumb_path.to_string_lossy().to_string())
}

/// Get image dimensions (helper for collage/video frame scenarios)
pub fn get_image_dimensions(path: &str) -> Result<(u32, u32), String> {
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    Ok((img.width(), img.height()))
}
