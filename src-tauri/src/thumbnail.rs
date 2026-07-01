use base64::Engine;
use fast_image_resize::{FilterType, ResizeAlg, Resizer, ResizeOptions};
use fast_image_resize::images::Image;
use std::path::Path;
const THUMB_WIDTH: u32 = 300;

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
    let rgba_img = img.to_rgba8();

    let (width, height) = (rgba_img.width(), rgba_img.height());
    let ratio = thumb_width as f64 / width as f64;
    let new_height = (height as f64 * ratio) as u32;

    let mut dst_image = Image::new(thumb_width, new_height, fast_image_resize::PixelType::U8x4);

    let mut resizer = Resizer::new();
    let options = ResizeOptions {
        algorithm: ResizeAlg::Interpolation(FilterType::Bilinear),
        ..ResizeOptions::default()
    };
    resizer.resize(&rgba_img, &mut dst_image, Some(&options))
        .map_err(|e| format!("Failed to resize: {}", e))?;

    let scaled_rgba = image::RgbaImage::from_raw(thumb_width, new_height, dst_image.buffer().to_vec())
        .ok_or("Failed to create scaled image")?;

    let mut rgb_data = Vec::with_capacity((thumb_width * new_height * 3) as usize);
    for pixel in scaled_rgba.pixels() {
        rgb_data.extend_from_slice(&[pixel[0], pixel[1], pixel[2]]);
    }
    let scaled_rgb = image::RgbImage::from_raw(thumb_width, new_height, rgb_data)
        .ok_or("Failed to create RGB image")?;

    let mut buffer = std::io::Cursor::new(Vec::new());
    scaled_rgb.write_to(&mut buffer, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let base64_str = base64::engine::general_purpose::STANDARD.encode(buffer.into_inner());
    
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}

pub fn generate_thumbnail_base64_fixed(source_path: &str) -> Result<String, String> {
    generate_thumbnail_base64(source_path, THUMB_WIDTH, (THUMB_WIDTH as f64 * 0.75) as u32)
}
