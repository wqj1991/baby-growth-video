# AI 过渡帧生成 — 架构设计文档

> 日期: 2026-06-29
> 状态: Proposed

## 1. 需求概述

在宝宝成长视频制作流程中，当两张照片之间需要转场过渡时，调用云端 AI 图像生成 API 来创建装饰性过渡帧。这些 AI 生成的帧将作为额外输入插入 FFmpeg 视频生成管道，使得最终视频拥有更具艺术感的过渡效果。

用户需要在全局设置页面预先配置 AI 模型（Provider、API Key、Endpoint、Model），视频生成时可选择是否启用 AI 过渡帧。

### 核心场景

- 用户在设置页配置 AI 模型参数 → 测试连通性 → 保存
- 用户在视频生成页勾选 "AI 智能过渡" → 视频生成时自动调用 AI
- API 调用失败时自动回退到标准 FFmpeg 转场（fade/slide/zoom）

---

## 2. 架构决策记录

### ADR-001: AI 调用放在 Rust 后端

**Status**: Proposed

**Context**: 需要决定 AI API 调用由前端 JS 还是 Rust 后端发起。前者灵活且不增加 Rust 依赖，后者安全且与现有架构一致。

**Decision**: 所有 AI API 调用由 Rust 后端发起。API Key 存储在 SQLite 中，仅 Rust 侧可读取。生成的图片直接写入磁盘（项目数据目录），FFmpeg 可直接引用路径。

**Consequences**:
- ✅ API Key 不暴露给前端 JS heap，安全性更好
- ✅ 图片直接落盘，无需 IPC 传输 base64，性能更优
- ✅ 与现有 "Rust 干重活，前端管 UI" 模式一致
- ❌ 需在 Rust 端引入 HTTP client 依赖（reqwest）
- ❌ Rust async 复杂度增加（但 Tauri 已支持 async command）

### ADR-002: Settings 存储 — SQLite key-value 表

**Status**: Proposed

**Context**: 需要持久化用户配置（AI 模型参数、风格偏好等）。可选方案包括：SQLite 表、JSON/TOML 配置文件、系统密钥管理混合方案。

**Decision**: 在现有 SQLite 数据库中新增 `settings` 表，采用 key-value 结构存储。API Key 作为普通值存储（桌面应用，用户控制本机安全）。

**Consequences**:
- ✅ 与现有 7 表架构一致，Database 类可统一管理
- ✅ 轻量，无需额外的文件 I/O 或密钥管理依赖
- ✅ 查询方便，Rust 侧直接从 db 读取配置
- ❌ API Key 明文存储在 SQLite（桌面应用场景可接受）
- ❌ 不支持手动编辑配置文件（但可通过 UI 修改）

### ADR-003: Provider trait 统一接口

**Status**: Proposed

**Context**: 需要支持多个 AI 图像生成 Provider（OpenAI DALL-E、SiliconFlow FLUX、自定义 endpoint）。可选方案包括：trait 抽象 vs 硬编码单一 API。

**Decision**: 定义 `AiImageProvider` trait，各 provider 独立实现。先用 SiliconFlow（国内访问稳定、FLUX 模型性价比高）实现首个 provider，后续按需扩展。

**Consequences**:
- ✅ 扩展性强，新增 provider 只需实现 trait
- ✅ 可 mock 测试，不依赖真实 API
- ✅ 用户切换 provider 时核心逻辑不变
- ❌ 增加一层抽象，初期开发量稍大
- ❌ 各 provider API 差异可能需要适配器层

### ADR-004: 降级策略 — API 失败回退标准转场

**Status**: Proposed

**Context**: AI API 调用可能因网络、Key 过期、服务宕机等原因失败。不能让 AI 失败阻断用户的核心视频生成功能。

**Decision**: AI API 调用失败时，自动回退到 FFmpeg 内置转场（fade），并在前端通过 Tauri event 通知用户。部分失败（如 5 张过渡帧中 3 张成功）也允许继续生成，失败的帧用标准转场替代。

**Consequences**:
- ✅ 核心功能不受 AI 服务可用性影响
- ✅ 用户体验平滑，不会因 API 问题无法生成视频
- ❌ 视频效果可能不一致（部分 AI 帧 + 部分标准转场）
- ❌ 需要前端显示明确的降级提示

### ADR-005: 异步生成 + Tauri event 推送进度

**Status**: Proposed

**Context**: 当前视频生成是同步阻塞的（TD-001），前端进度条是模拟的（TD-008）。AI 过渡帧生成增加了额外的异步等待时间，必须解决这两个技术债。

**Decision**: 将 `generate_growth_video` 改为 async Tauri command。AI 帧生成和 FFmpeg 处理均在 async 上下文中执行。通过 Tauri event 系统向前端推送真实进度（AI 生成进度 + FFmpeg 进度）。

**Consequences**:
- ✅ 解决 TD-001（同步阻塞）和 TD-008（模拟进度条）两个 P0 技术债
- ✅ 前端可展示真实进度（"正在生成第 3/10 个过渡帧..."）
- ❌ 需重写视频生成核心流程（从 sync 到 async）
- ❌ 进度解析需要从 FFmpeg stderr 提取（已有 PROGRESS_MAP 可扩展）

---

## 3. 数据库设计

### 新增 settings 表

```sql
CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL,
    type    TEXT NOT NULL DEFAULT 'string',  -- 'string' | 'number' | 'json'
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 预设 key 清单

| key | type | 默认值 | 说明 |
|-----|------|--------|------|
| `ai_provider` | string | `"siliconflow"` | Provider 标识 |
| `ai_api_endpoint` | string | `"https://api.siliconflow.cn/v1/images/generations"` | API 地址 |
| `ai_api_key` | string | `""` | API Key（加密存储可选） |
| `ai_model` | string | `"black-forest-labs/FLUX.1-schnell"` | 模型标识 |
| `ai_enabled` | string | `"false"` | 是否全局启用 AI 过渡 |
| `ai_style_preset` | string | `"warm_glow"` | 风格预设标识 |
| `ai_custom_prompt` | string | (默认模板) | 自定义 prompt 模板 |
| `ai_frame_duration` | number | `1.5` | AI 过渡帧持续时间(秒) |
| `ai_image_size` | string | `"1024x1024"` | 生成图片尺寸 |
| `default_output_path` | string | (系统数据目录) | 默认输出路径 |

---

## 4. Rust 后端设计

### 新增模块: `src-tauri/src/ai.rs`

```rust
// Provider trait — 统一 AI 图像生成接口
pub trait AiImageProvider: Send + Sync {
    fn generate_image(
        &self,
        prompt: &str,
        size: &str,
        output_path: &str,
    ) -> Result<String, String>;  // 返回生成的图片路径
}

// SiliconFlow 实现（首个 provider）
pub struct SiliconFlowProvider {
    api_key: String,
    endpoint: String,
    model: String,
}

impl AiImageProvider for SiliconFlowProvider {
    fn generate_image(&self, prompt: &str, size: &str, output_path: &str) -> Result<String, String> {
        // 1. 构建 HTTP request body (JSON: prompt, model, size)
        // 2. POST 到 SiliconFlow API
        // 3. 解析 response，提取 image URL 或 base64
        // 4. 下载/解码图片，写入 output_path
        // 5. 返回 output_path
    }
}

// OpenAI 实现（后续扩展）
pub struct OpenAiProvider { ... }

// Provider 工厂
pub fn create_provider(settings: &AiSettings) -> Result<Box<dyn AiImageProvider>, String> {
    match settings.provider.as_str() {
        "siliconflow" => Ok(Box::new(SiliconFlowProvider::new(settings))),
        "openai" => Ok(Box::new(OpenAiProvider::new(settings))),
        _ => Err("Unknown provider"),
    }
}
```

### AI 过渡帧生成流程

```rust
// 在 video.rs 中新增
pub async fn generate_ai_transition_frames(
    db: &Database,
    project_id: i64,
    photos: &[PhotoInfo],
    app_handle: &tauri::AppHandle,
) -> Result<Vec<String>, String> {
    // 1. 从 settings 表读取 AI 配置
    let settings = db.get_ai_settings()?;

    // 2. 创建 provider
    let provider = create_provider(&settings)?;

    // 3. 为每对相邻照片生成过渡帧
    let mut ai_frame_paths = Vec::new();
    for i in 0..(photos.len() - 1) {
        let prompt = build_transition_prompt(
            &settings,
            &photos[i],   // 前一张照片信息
            &photos[i+1], // 后一张照片信息
        );

        let output_path = format!(
            "{}/projects/{}/ai_frames/transition_{}.png",
            data_dir, project_id, i
        );

        // 尝试生成，失败则回退
        match provider.generate_image(&prompt, &settings.ai_image_size, &output_path) {
            Ok(path) => {
                ai_frame_paths.push(path);
                emit_progress(app_handle, i, photos.len() - 1, "ai_frame_generated");
            }
            Err(e) => {
                // 降级：标记为标准转场
                ai_frame_paths.push("__fallback__".to_string());
                emit_progress(app_handle, i, photos.len() - 1, "ai_frame_failed");
            }
        }
    }

    Ok(ai_frame_paths)
}
```

### Prompt 构建逻辑

```rust
fn build_transition_prompt(settings: &AiSettings, prev: &PhotoInfo, next: &PhotoInfo) -> String {
    let template = if settings.style_preset == "custom" {
        &settings.custom_prompt
    } else {
        &STYLE_PRESETS[&settings.style_preset]
    };

    template
        .replace("{prev_month}", &prev.period_name)
        .replace("{next_month}", &next.period_name)
        .replace("{style}", &settings.style_preset)
}
```

### 预设风格模板

| preset | prompt 模板 |
|--------|-------------|
| `warm_glow` | "A soft warm-toned decorative illustration transitioning from {prev_month} to {next_month}, gentle amber and coral gradient, abstract shapes with warmth and tenderness, no text" |
| `dreamy_soft` | "A dreamy pastel-toned transitional illustration from {prev_month} to {next_month}, soft clouds and floating particles, ethereal light, no text" |
| `cartoon` | "A cute cartoon-style transitional scene from {prev_month} to {next_month}, playful shapes, bright colors, child-friendly, no text" |
| `watercolor` | "A delicate watercolor-style transitional painting from {prev_month} to {next_month}, flowing colors, soft brush strokes, artistic, no text" |

---

## 5. FFmpeg 集成修改

### 当前 FFmpeg 命令结构

```
ffmpeg -loop 1 -t 3 -i photo1.jpg
       -loop 1 -t 3 -i photo2.jpg
       -loop 1 -t 3 -i photo3.jpg
       -filter_complex "[0][1]xfade=fade:duration=0.5:offset=2.5[v01];
                         [v01][2]xfade=fade:duration=0.5:offset=5.5[vout]"
       -map "[vout]" output.mp4
```

### AI 过渡帧加入后

```
ffmpeg -loop 1 -t 3 -i photo1.jpg
       -loop 1 -t 1.5 -i ai_transition_0.png   ← AI 帧
       -loop 1 -t 3 -i photo2.jpg
       -loop 1 -t 1.5 -i ai_transition_1.png   ← AI 帧
       -loop 1 -t 3 -i photo3.jpg
       -filter_complex "[0][1]xfade=fade:duration=0.3:offset=2.7[v01];
                         [v01][2]xfade=fade:duration=0.3:offset=4.2[v02];
                         [v02][3]xfade=fade:duration=0.3:offset=6.7[v03];
                         [v03][4]xfade=fade:duration=0.3:offset=8.2[vout]"
       -map "[vout]" output.mp4
```

关键变化：
- 每两张照片之间插入一个 AI 过渡帧作为独立输入
- 过渡帧持续时间较短（1-2 秒），由 `ai_frame_duration` 配置
- xfade offset 需要重新计算，因为输入数量翻倍

---

## 6. 前端设计

### 新增路由

```tsx
// App.tsx 新增
<Route path="/settings" element={<SettingsPage />} />
```

### 设置页面组件

```tsx
// src/pages/SettingsPage.tsx
- 两个 tab: "AI model" | "General"
- AI model tab: Provider, Endpoint, API Key, Model, Test connection
- Transition style tab: Style preset, Custom prompt, Frame duration
- Save / Cancel 按钮
```

### Zustand store 扩展

```tsx
// src/store/index.ts 新增字段
aiSettings: {
  provider: string;
  apiEndpoint: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  stylePreset: string;
  customPrompt: string;
  frameDuration: number;
}
```

### 新增 Tauri 命令

| 命令 | 说明 |
|------|------|
| `get_settings` | 读取所有设置 |
| `save_settings` | 保存设置（key-value map） |
| `test_ai_connection` | 测试 AI API 连通性（调用一次小请求） |
| `generate_growth_video_async` | 异步版视频生成（替代现有同步版） |

### VideoGeneratePage 修改

- 新增 "AI 智能过渡" 开关（toggle）
- 开关开启时显示风格选择和预览
- 进度条改为真实进度（监听 Tauri event）

---

## 7. 新增 Rust 依赖

```toml
# Cargo.toml 新增
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }  # HTTP client
tokio = { version = "1", features = ["full"] }                      # async runtime（Tauri 已依赖）
serde_json = "1.0"                                                   # JSON 解析
```

> 注意: reqwest 使用 rustls-tls（纯 Rust TLS），避免系统 OpenSSL 依赖问题。Tauri 已依赖 tokio，无需重复引入。

---

## 8. 实施阶段建议

### Phase 1: 设置基础设施（3-4 天）
1. 新增 `settings` 表到 db.rs
2. 实现 settings CRUD 命令（get_settings, save_settings）
3. 创建 SettingsPage 前端页面
4. 激活侧边栏设置按钮

### Phase 2: AI Provider 核心（3-4 天）
1. 创建 ai.rs 模块，定义 AiImageProvider trait
2. 实现 SiliconFlowProvider（reqwest HTTP）
3. 实现 test_ai_connection 命令
4. 设置页增加 "Test connection" 功能

### Phase 3: 视频管道集成（3-4 天）
1. 重写 generate_growth_video 为 async 版本
2. 实现 AI 过渡帧生成逻辑
3. 修改 FFmpeg 命令构建（支持插入 AI 帧）
4. 实现降级策略
5. 实现 Tauri event 进度推送

### Phase 4: 前端完善（2-3 天）
1. VideoGeneratePage 增加 AI 过渡开关
2. 进度条改为监听真实事件
3. 风格预设 UI
4. 降级提示 UI

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| AI API 响应慢（>30s/帧） | 10 张过渡帧需 5 分钟 | 并行请求 + 进度提示 + 可选跳过 |
| API Key 泄露风险 | 用户财产损失 | SQLite 存储 + 前端 masked input + 不日志记录 |
| FFmpeg offset 计算错误 | 视频转场错位 | 先用固定参数测试，再动态计算 |
| reqwest 编译复杂度 | 增加构建时间 | 使用 rustls-tls 避免系统 OpenSSL |
| AI 生图质量不稳定 | 过渡帧效果差 | 风格预设固定 prompt + 降级策略 |
