# Fast Thumbnail Generation Design

## 1. Overview

This design document describes the implementation of high-performance thumbnail generation using `fast_image_resize`, `rayon`, and `image` crates. The goal is to prioritize speed while maintaining acceptable image quality.

## 2. Goals

- Replace current `image::resize` with `fast_image_resize` for improved performance
- Target thumbnail width: 300px (reduced from 400px)
- Use Bilinear interpolation for balanced speed/quality
- Maintain parallel processing with rayon
- Keep API compatibility with existing code

## 3. Architecture

### 3.1 Technology Stack

| Component | Library | Version | Purpose |
|-----------|---------|---------|---------|
| Image Resizing | fast_image_resize | 4.x | High-performance SIMD-accelerated resizing |
| Parallel Processing | rayon | 1.8 | Multi-threaded batch processing |
| Image I/O | image | 0.24 | Read original images, encode output |
| Base64 Encoding | base64 | 0.22 | Encode thumbnail to Base64 |

### 3.2 Data Flow

```
Original Image File
       │
       ▼
  image::open() ──► DynamicImage
       │
       ▼
  Convert to ImageView
       │
       ▼
fast_image_resize::Resizer (Bilinear)
       │
       ▼
  Resized ImageView
       │
       ▼
  Convert to DynamicImage
       │
       ▼
  Encode to JPEG
       │
       ▼
  Base64 Encode
       │
       ▼
  Return Base64 String
```

## 4. API Design

### 4.1 Public Functions

| Function | Description |
|----------|-------------|
| `generate_thumbnail_base64(source_path: &str, thumb_width: u32)` | Generate Base64 thumbnail with specified width |
| `generate_thumbnail_base64_fixed(source_path: &str)` | Generate Base64 thumbnail with fixed 300px width |
| `get_image_dimensions(path: &str)` | Get original image dimensions |

### 4.2 Constants

```rust
const THUMB_WIDTH: u32 = 300;
```

## 5. Implementation Details

### 5.1 fast_image_resize Integration

```rust
// 1. Read image with image crate
let img = image::open(source_path)?;

// 2. Convert to ImageView
let (width, height) = (img.width(), img.height());
let mut pixels = img.to_rgba8().into_vec();
let src_view = ImageView::new(
    width,
    height,
    &pixels,
    PixelType::U8x4,
);

// 3. Calculate target dimensions
let ratio = thumb_width as f64 / width as f64;
let new_height = (height as f64 * ratio) as u32;

// 4. Create destination buffer
let mut dst_pixels = vec![0u8; 4 * thumb_width as usize * new_height as usize];
let mut dst_view = ImageViewMut::new(
    thumb_width,
    new_height,
    &mut dst_pixels,
    PixelType::U8x4,
);

// 5. Resize using Bilinear algorithm
let mut resizer = Resizer::new(ResizeAlg::Bilinear);
resizer.resize(&src_view, &mut dst_view)?;

// 6. Encode to JPEG and Base64
```

### 5.2 Parallel Processing

Parallel batch processing is handled in `media.rs` using rayon:

```rust
photos.par_iter()
    .map(|(dest_path, ...)| {
        match thumbnail::generate_thumbnail_base64_fixed(dest_path) {
            Ok(base64_data) => Some(NewThumbnail { ... }),
            Err(e) => None,
        }
    })
    .filter_map(|x| x)
    .collect()
```

## 6. Performance Considerations

- **SIMD Acceleration**: fast_image_resize automatically uses SIMD instructions (AVX2, SSE4.1, NEON)
- **Reduced Resolution**: 300px width reduces processing time compared to 400px
- **Bilinear Interpolation**: Faster than CatmullRom while maintaining acceptable quality
- **Parallel I/O**: rayon distributes work across CPU cores

## 7. Backward Compatibility

- Existing API signatures are preserved
- `generate_thumbnail_base64` and `generate_thumbnail_base64_fixed` remain compatible
- Old functions marked with `#[allow(dead_code)]` for future removal

## 8. Testing

- Verify compilation succeeds
- Verify thumbnail generation works correctly
- Verify Base64 output format matches expectations
