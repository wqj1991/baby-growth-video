# Fast Thumbnail Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement high-performance thumbnail generation using fast_image_resize with Bilinear interpolation, targeting 300px width for speed.

**Architecture:** Replace image::resize with fast_image_resize for SIMD-accelerated scaling. Use Bilinear interpolation for balanced speed/quality. Keep rayon for parallel batch processing.

**Tech Stack:** Rust, fast_image_resize 4.x, rayon 1.8, image 0.24, base64 0.22

---

## File Structure

| File | Responsibility |
|------|---------------|
| `Cargo.toml` | Add fast_image_resize dependency |
| `src/thumbnail.rs` | Core thumbnail generation logic |
| `src/media.rs` | Batch parallel processing (uses thumbnail.rs) |
| `src/main.rs` | Tauri commands that use thumbnail generation |

---

### Task 1: Add fast_image_resize dependency

**Files:**
- Modify: `Cargo.toml`

- [ ] **Step 1: Add dependency to Cargo.toml**

```toml
[dependencies]
# ... existing dependencies ...
fast_image_resize = "4"
```

- [ ] **Step 2: Commit**

```bash
git add Cargo.toml
git commit -m "chore: add fast_image_resize dependency"
```

---

### Task 2: Rewrite thumbnail.rs with fast_image_resize

**Files:**
- Modify: `src/thumbnail.rs`

- [ ] **Step 1: Replace thumbnail.rs content**

```rust
use base64::Engine;
use fast_image_resize::{ResizeAlg, Resizer, ImageView, ImageViewMut, PixelType};
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

    let mut pixels = img.to_rgba8().into_vec();
    let src_view = ImageView::new(
        width,
        height,
        &pixels,
        PixelType::U8x4,
    ).map_err(|e| format!("Failed to create source view: {}", e))?;

    let mut dst_pixels = vec![0u8; 4 * THUMB_WIDTH as usize * new_height as usize];
    let mut dst_view = ImageViewMut::new(
        THUMB_WIDTH,
        new_height,
        &mut dst_pixels,
        PixelType::U8x4,
    ).map_err(|e| format!("Failed to create destination view: {}", e))?;

    let mut resizer = Resizer::new(ResizeAlg::Bilinear);
    resizer.resize(&src_view, &mut dst_view).map_err(|e| format!("Failed to resize: {}", e))?;

    let scaled = image::RgbaImage::from_raw(THUMB_WIDTH, new_height, dst_pixels)
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

    let mut pixels = img.to_rgba8().into_vec();
    let src_view = ImageView::new(
        width,
        height,
        &pixels,
        PixelType::U8x4,
    ).map_err(|e| format!("Failed to create source view: {}", e))?;

    let mut dst_pixels = vec![0u8; 4 * thumb_width as usize * new_height as usize];
    let mut dst_view = ImageViewMut::new(
        thumb_width,
        new_height,
        &mut dst_pixels,
        PixelType::U8x4,
    ).map_err(|e| format!("Failed to create destination view: {}", e))?;

    let mut resizer = Resizer::new(ResizeAlg::Bilinear);
    resizer.resize(&src_view, &mut dst_view).map_err(|e| format!("Failed to resize: {}", e))?;

    let scaled = image::RgbaImage::from_raw(thumb_width, new_height, dst_pixels)
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
```

- [ ] **Step 2: Commit**

```bash
git add src/thumbnail.rs
git commit -m "refactor: rewrite thumbnail generation with fast_image_resize"
```

---

### Task 3: Verify compilation

**Files:**
- None (verification task)

- [ ] **Step 1: Run cargo build**

Run: `cargo build`
Expected: Compilation succeeds with no errors

- [ ] **Step 2: Commit**

```bash
git commit -m "verify: fast thumbnail implementation compiles successfully"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ fast_image_resize integration
- ✅ 300px target width
- ✅ Bilinear interpolation
- ✅ rayon parallel processing (already in media.rs)
- ✅ API compatibility

**2. Placeholder scan:**
- No TBD/TODO placeholders

**3. Type consistency:**
- Function signatures match existing API
- THUMB_WIDTH constant updated from 400 to 300
