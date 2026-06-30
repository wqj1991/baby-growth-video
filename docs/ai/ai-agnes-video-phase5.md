# Phase 5: Agnes AI 视频生成集成

## 概述

将 Agnes AI 的图生视频（keyframes 模式）能力集成到项目中，作为与标准 FFmpeg 并列的第二条生成链路。

## 架构决策

### ADR-006: Agnes 作为独立视频生成模式

**Context**: Agnes AI 提供 keyframes 模式，多张照片→一条 prompt→完整动态视频，与现有 FFmpeg 管线是互补关系。
**Decision**: 新增并列的视频生成模式，而非替换现有管线。用户在前端选择"标准"或"Agnes AI"。
**Consequences**: 
- 两条独立的异步管线，代码清晰隔离
- Agnes 失败自动回退到标准 FFmpeg 模式
- 统一 Tauri 命令 `generate_growth_video` 根据 `video_mode` 分发

## 文件改动

### 新增文件
| 文件 | 说明 |
|------|------|
| `src-tauri/src/agnes.rs` | AgnesVideoClient — 创建/轮询/下载三阶段 API 客户端 |
| `src-tauri/resources/Roboto-Regular.ttf` | 文字叠加渲染用字体 (嵌入二进制) |

### 修改文件
| 文件 | 改动 |
|------|------|
| `Cargo.toml` | + `imageproc = "0.23"`, + `rusttype = "0.9"` |
| `src/video.rs` | + `PhotoText` 结构体, + `render_text_on_photo()`, + `generate_growth_video_agnes()` |
| `src/main.rs` | 统一 `generate_growth_video` 命令分发 (video_mode standard/agnes), + `mod agnes` |
| `src/types.ts` | + `video_mode` 字段, + `PhotoText` 接口 |
| `src/utils/tauriCommands.ts` | `generateGrowthVideo()` 新增 optional params |
| `src/pages/VideoGeneratePage.tsx` | 模式切换 UI, Agnes 描述输入, 照片标注编辑器, 新阶段适配 |

## 数据流

```
前端选择 "Agnes AI 模式"
  │
  ├─ 视频整体描述 (overall_prompt)
  ├─ 可选: 每张照片文字标注 (photo_texts)
  │
  ▼
generate_growth_video(video_mode="agnes")
  │
  ├─ Phase 1: 读取 DB 中的 AI 设置 (API Key)
  ├─ Phase 2: 文字预处理 — render_text_on_photo()
  │    └─ Rust image + imageproc 在照片底部渲染半透明黑底白字
  │    └─ 输出 base64 data URI
  ├─ Phase 3: Agnes API 调用 — AgnesVideoClient
  │    ├─ create_keyframes_video() → video_id
  │    ├─ 每 8s 轮询 poll_video() → pending/completed
  │    └─ download_video() → output_path
  │    └─ 全程推送 generation-progress 事件
  ├─ Phase 4: 降级策略
  │    └─ Agnes 失败/超时 → 自动回退 generate_growth_video_async()
  │
  ▼
ExportRecord (status: success/error)
```

## Agnes API 参数

```
POST https://apihub.agnes-ai.com/v1/videos
body:
  model: "agnes-video-v2.0"
  prompt: "整体描述"
  extra_body:
    image: ["data:image/png;base64,...", ...]
    mode: "keyframes"
  num_frames: photo_count * 24 * 3 (每张约3秒, 最大600)
  frame_rate: 用户配置的 fps
```

## 降级策略

| 场景 | 处理 |
|------|------|
| API Key 未配置 | 前端禁用 Agnes 按钮 |
| Agnes API 不可用 | 回退标准 FFmpeg + generation-progress(agnes_fallback) |
| 任务超时 (8分钟) | 回退标准 FFmpeg |
| 视频下载失败 | 回退标准 FFmpeg |

## 进度阶段

| stage | 百分比 | 说明 |
|-------|--------|------|
| preparing | 5% | 读取照片和设置 |
| preprocessing | 5-15% | 文字叠加渲染 |
| agnes_creating | 20-25% | 创建视频任务 |
| agnes_encoding | 25-75% | 轮询等待渲染 |
| agnes_downloading | 80% | 下载视频 |
| complete | 100% | 完成 |
| agnes_fallback | 100% | 降级通知 |

## 已知限制

1. **base64 传输**: 多张照片编码为 base64，大照片可能超出 API 请求体限制。后续可改为 URL 上传
2. **轮询阻塞**: 使用 `spawn_blocking` + `thread::sleep`，占用 tokio 线程池。后续可改为 async 轮询
3. **无断点续传**: 视频下载不支持断点续传
4. **文字字体**: 固定使用 Roboto Regular，不支持用户选择字体/位置/样式

## 编译结果

```
cargo check: ✓ 0 errors (2 unused warnings)
vite build:  ✓ 0 errors (4.87s)
```
