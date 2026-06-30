use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use image::{GenericImageView, ImageBuffer, Rgba, Rgb, ColorType};
use imageproc::geometric_transformations::{rotate_about_center, Interpolation};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollageRegion {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub order: i64,
    pub rotation: i64,
    pub flip_h: bool,
    pub flip_v: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CollageRequest {
    pub template_id: String,
    pub output_width: i64,
    pub output_height: i64,
    pub gap_px: i64,
    pub jpeg_quality: i64,
    pub photo_paths: Vec<String>,
    pub regions: Vec<CollageRegion>,
}

#[derive(Debug, Serialize)]
pub struct CollageResult {
    pub output_path: String,
}

fn get_project_collages_dir(project_id: i64) -> PathBuf {
    let mut path = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("baby-growth-video");
    path.push("projects");
    path.push(project_id.to_string());
    path.push("collages");
    path
}

fn compute_cover_crop(
    img_width: u32,
    img_height: u32,
    target_width: u32,
    target_height: u32,
) -> (u32, u32, u32, u32) {
    let img_ratio = img_width as f64 / img_height as f64;
    let target_ratio = target_width as f64 / target_height as f64;

    let (crop_x, crop_y, crop_w, crop_h) = if img_ratio > target_ratio {
        let crop_w = (img_height as f64 * target_ratio) as u32;
        let crop_x = (img_width - crop_w) / 2;
        (crop_x, 0, crop_w, img_height)
    } else {
        let crop_h = (img_width as f64 / target_ratio) as u32;
        let crop_y = (img_height - crop_h) / 2;
        (0, crop_y, img_width, crop_h)
    };

    (crop_x, crop_y, crop_w, crop_h)
}

fn apply_flips(img: &ImageBuffer<Rgba<u8>, Vec<u8>>, flip_h: bool, flip_v: bool) -> ImageBuffer<Rgba<u8>, Vec<u8>> {
    let w = img.width();
    let h = img.height();
    let mut result = ImageBuffer::new(w, h);

    for y in 0..h {
        for x in 0..w {
            let src_x = if flip_h { w - 1 - x } else { x };
            let src_y = if flip_v { h - 1 - y } else { y };
            result.put_pixel(x, y, *img.get_pixel(src_x, src_y));
        }
    }
    
    result
}

fn apply_rotation(img: &ImageBuffer<Rgba<u8>, Vec<u8>>, rotation: i64) -> ImageBuffer<Rgba<u8>, Vec<u8>> {
    let angle_deg = rotation as f32;
    if angle_deg == 0.0 {
        return img.clone();
    }
    
    let angle_rad = angle_deg.to_radians();
    
    rotate_about_center(
        img,
        angle_rad,
        Interpolation::Bilinear,
        Rgba([0, 0, 0, 0]),
    )
}

pub fn generate_collage(req: CollageRequest, project_id: i64) -> Result<CollageResult, String> {
    let output_width = req.output_width as u32;
    let output_height = req.output_height as u32;
    let gap_px = req.gap_px as u32;
    let quality = req.jpeg_quality;

    if output_width == 0 || output_height == 0 {
        return Err("Output dimensions cannot be zero".to_string());
    }

    if req.photo_paths.is_empty() {
        return Err("No photo paths provided".to_string());
    }

    if req.regions.is_empty() {
        return Err("No regions provided".to_string());
    }

    let mut output = ImageBuffer::new(output_width, output_height);

    for x in 0..output_width {
        for y in 0..output_height {
            output.put_pixel(x, y, Rgba([245, 245, 245, 255]));
        }
    }

    let regions_sorted = {
        let mut sorted = req.regions.clone();
        sorted.sort_by_key(|r| r.order);
        sorted
    };

    for region in regions_sorted {
        let order_idx = region.order as usize;
        if order_idx >= req.photo_paths.len() {
            continue;
        }

        let photo_path = &req.photo_paths[order_idx];
        let path = std::path::Path::new(photo_path);
        
        if !path.exists() {
            return Err(format!("Photo file does not exist: {}", photo_path));
        }

        let img = image::open(path)
            .map_err(|e| format!("Failed to open image {}: {}", photo_path, e))?;

        let img_rgba = img.to_rgba8();

        let region_x = (region.x * req.output_width as f64) as u32;
        let region_y = (region.y * req.output_height as f64) as u32;
        let region_w = (region.w * req.output_width as f64) as u32;
        let region_h = (region.h * req.output_height as f64) as u32;

        let adjusted_x = region_x + gap_px / 2;
        let adjusted_y = region_y + gap_px / 2;
        let adjusted_w = if region_w > gap_px { region_w - gap_px } else { region_w };
        let adjusted_h = if region_h > gap_px { region_h - gap_px } else { region_h };

        if adjusted_w == 0 || adjusted_h == 0 {
            continue;
        }

        let (crop_x, crop_y, crop_w, crop_h) = compute_cover_crop(
            img_rgba.width(),
            img_rgba.height(),
            adjusted_w,
            adjusted_h,
        );

        let cropped = img_rgba.view(crop_x, crop_y, crop_w, crop_h).to_image();

        let scaled = image::imageops::resize(
            &cropped,
            adjusted_w,
            adjusted_h,
            image::imageops::FilterType::Lanczos3,
        );

        let flipped = apply_flips(&scaled, region.flip_h, region.flip_v);

        let rotated = apply_rotation(&flipped, region.rotation);

        let rot_w = rotated.width();
        let rot_h = rotated.height();

        let paste_x = if rot_w > adjusted_w {
            adjusted_x as i32 - ((rot_w - adjusted_w) / 2) as i32
        } else {
            adjusted_x as i32 + ((adjusted_w - rot_w) / 2) as i32
        };

        let paste_y = if rot_h > adjusted_h {
            adjusted_y as i32 - ((rot_h - adjusted_h) / 2) as i32
        } else {
            adjusted_y as i32 + ((adjusted_h - rot_h) / 2) as i32
        };

        for y in 0..rot_h {
            for x in 0..rot_w {
                let out_x = paste_x + x as i32;
                let out_y = paste_y + y as i32;

                if out_x >= 0 && out_x < output_width as i32 && out_y >= 0 && out_y < output_height as i32 {
                    let pixel = rotated.get_pixel(x, y);
                    if pixel[3] > 0 {
                        output.put_pixel(out_x as u32, out_y as u32, *pixel);
                    }
                }
            }
        }
    }

    let collages_dir = get_project_collages_dir(project_id);
    std::fs::create_dir_all(&collages_dir)
        .map_err(|e| format!("Failed to create collages directory {}: {}", collages_dir.display(), e))?;

    let uuid = uuid::Uuid::new_v4().to_string();
    let filename = format!("{}_collage.jpg", uuid);
    let output_path = collages_dir.join(&filename);

    let quality_percent = std::cmp::max(1, std::cmp::min(100, quality)) as u8;
    let mut jpeg_encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
        std::fs::File::create(&output_path)
            .map_err(|e| format!("Failed to create output file {}: {}", output_path.display(), e))?,
        quality_percent,
    );

    let rgb_output: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(output_width, output_height, |x, y| {
        let p = output.get_pixel(x, y);
        Rgb([p[0], p[1], p[2]])
    });

    image::codecs::jpeg::JpegEncoder::encode(
        &mut jpeg_encoder,
        &rgb_output,
        rgb_output.width(),
        rgb_output.height(),
        ColorType::Rgb8,
    )
    .map_err(|e| format!("Failed to write output image: {}", e))?;

    Ok(CollageResult {
        output_path: output_path.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_cover_crop_landscape() {
        let (x, y, w, h) = compute_cover_crop(1920, 1080, 100, 100);
        assert_eq!(x, 420);
        assert_eq!(y, 0);
        assert_eq!(w, 1080);
        assert_eq!(h, 1080);
    }

    #[test]
    fn test_compute_cover_crop_portrait() {
        let (x, y, w, h) = compute_cover_crop(1080, 1920, 100, 100);
        assert_eq!(x, 0);
        assert_eq!(y, 420);
        assert_eq!(w, 1080);
        assert_eq!(h, 1080);
    }

    #[test]
    fn test_compute_cover_crop_square() {
        let (x, y, w, h) = compute_cover_crop(1000, 1000, 100, 100);
        assert_eq!(x, 0);
        assert_eq!(y, 0);
        assert_eq!(w, 1000);
        assert_eq!(h, 1000);
    }
}