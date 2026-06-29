# AI 过渡帧集成 — 视频管道 (Phase 3)

> 日期: 2026-06-29
> 状态: Completed
> 依赖: Phase 1 (设置基础设施) + Phase 2 (AI Provider 核心)

## 概述

将 AI Provider 与现有 FFmpeg 视频生成管线完整集成。视频生成从同步阻塞改为 async Tauri 命令，支持真实进度推送和 AI 失败降级。

## 核心改动

### 1. VideoConfig 扩展 (`video.rs`)

```rust
pub struct VideoConfig {
    // ... 原有字段 ...
    pub ai_enabled: bool,  // 新增：是否启用 AI 过渡帧
}
```

### 2. AI 帧生成函数 (`video.rs`)

```rust
fn generate_ai_frames(
    db: &Database,
    project_id: i64,
    photos: &[(Period, Photo)],
    app_handle: &tauri::AppHandle,
) -> Result<(Vec<String>, f64), String>
```

- 读取 AI 设置创建 Provider
- 遍历相邻照片对，调用 `provider.generate_image()` 生成过渡帧
- 图片保存到 `{data_dir}/projects/{id}/ai_frames/transition_XXX.png`
- 通过 Tauri event 推送实时进度
- 任一帧失败即整体回退（Err），触发标准转场降级

### 3. AI 模式 FFmpeg 命令 (`video.rs`)

```rust
fn build_ffmpeg_command_with_ai(
    photos, ai_frames, ai_frame_duration, config, output_path
) -> Vec<String>
```

**设计决策：concat 模式（非 xfade）**

避免 xfade 偏移量计算在变长输入下的复杂度。AI 过渡帧本身就是装饰性过渡内容，直接 concat 拼接即可：

```
[photo0][ai_frame0][photo1][ai_frame1][photo2] → concat → [v]
```

时间轴: `photo(3s) → ai(1.5s) → photo(3s) → ai(1.5s) → photo(3s) = 12s`

### 4. 异步视频生成 (`video.rs`)

```rust
pub async fn generate_growth_video_async(
    db: Arc<Mutex<Database>>,
    project_id: i64,
    config: VideoConfig,
    output_path: String,
    app_handle: tauri::AppHandle,
) -> Result<ExportRecord, String>
```

四阶段流程：

| 阶段 | 进度 | 说明 |
|------|------|------|
| Phase 1: 准备 | 5% | 读取照片、创建导出记录 |
| Phase 2: AI 生成 | 10-40% | 尝试生成 AI 过渡帧，失败则降级 |
| Phase 3: 构建命令 | - | 根据有无 AI 帧选择 concat/xfade 模式 |
| Phase 4: FFmpeg | 50-90% | spawn_blocking 执行，避免阻塞主线程 |

### 5. 降级策略

```
AI 启用 → 尝试生成过渡帧
  ├─ 成功 → concat 模式（AI 帧作为过渡）
  └─ 失败 → 标准 xfade 模式 + 前端降级通知
AI 未启用 → 标准 xfade 模式
```

### 6. Tauri 事件进度推送

```rust
#[derive(Clone, Serialize)]
pub struct GenerationProgress {
    pub stage: String,      // "preparing" | "ai_generation" | "ai_fallback" | "ffmpeg_encoding" | "complete" | "error"
    pub current: usize,
    pub total: usize,
    pub percentage: i32,    // 0-100
    pub message: String,
}
```

事件名: `generation-progress`

### 7. Tauri 命令更新 (`main.rs`)

旧同步命令被替换为异步版本：

```rust
#[tauri::command]
async fn generate_growth_video(
    project_id: i64,
    config: video::VideoConfig,
    output_path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,  // 新增：事件推送
) -> Result<db::ExportRecord, String>
```

## 前端同步改动

- `types.ts`: `VideoConfig` 添加 `ai_enabled: boolean`
- `VideoGeneratePage.tsx`: config 初始值含 `ai_enabled`，AI 开关联动 `config.ai_enabled`

## 编译结果

```
cargo check: ✓ 0 errors, 3 warnings (expected: dead code for old sync functions)
vite build:  ✓ 1410 modules, 3.76s
```

## 待完成 (Phase 4)

- [ ] 前端监听 `generation-progress` Tauri event 替换模拟进度条
- [ ] AI 降级提示 UI 展示
- [ ] AI 帧生成进度实时显示（"正在生成 AI 过渡帧 2/5..."）
