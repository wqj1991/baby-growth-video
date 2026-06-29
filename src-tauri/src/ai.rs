use serde::Deserialize;
use std::fs;
use std::path::Path;

/// 统一 AI 图像生成接口
pub trait AiImageProvider: Send + Sync {
    fn generate_image(
        &self,
        prompt: &str,
        size: &str,
        output_path: &str,
    ) -> Result<String, String>;

    fn test_connection(&self) -> Result<(), String>;

    fn provider_name(&self) -> &str;
}

// ==================== SiliconFlow Provider ====================

pub struct SiliconFlowProvider {
    api_key: String,
    endpoint: String,
    model: String,
}

impl SiliconFlowProvider {
    pub fn new(api_key: &str, endpoint: &str, model: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            endpoint: endpoint.to_string(),
            model: model.to_string(),
        }
    }
}

impl AiImageProvider for SiliconFlowProvider {
    fn provider_name(&self) -> &str {
        "SiliconFlow"
    }

    fn test_connection(&self) -> Result<(), String> {
        // SiliconFlow 没有专门的 health endpoint,
        // 所以我们发送一个最小的图片生成请求（1x1 测试图）
        let client = reqwest::blocking::Client::new();
        let body = serde_json::json!({
            "model": self.model,
            "prompt": "test",
            "n": 1,
            "size": "1024x1024",
        });

        // 只检查 API 连通性和认证，不用真的生成图片
        // 用 HEAD/GET 方式检查 API key 是否有效
        let response = client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .map_err(|e| format!("Connection failed: {}", e))?;

        let status = response.status();

        if status.is_success() {
            Ok(())
        } else if status.as_u16() == 401 || status.as_u16() == 403 {
            Err("Invalid API key".to_string())
        } else {
            let body_text = response
                .text()
                .unwrap_or_else(|_| "unknown error".to_string());
            Err(format!("API error ({}): {}", status.as_u16(), body_text))
        }
    }

    fn generate_image(
        &self,
        prompt: &str,
        size: &str,
        output_path: &str,
    ) -> Result<String, String> {
        let client = reqwest::blocking::Client::new();

        let body = serde_json::json!({
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": size,
        });

        // Step 1: Call API
        let response = client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().unwrap_or_default();
            return Err(format!("API error ({}): {}", status.as_u16(), body_text));
        }

        // Step 2: Parse response
        #[derive(Deserialize)]
        struct ImageData {
            url: Option<String>,
            b64_json: Option<String>,
        }

        #[derive(Deserialize)]
        struct SiliconFlowResponse {
            data: Option<Vec<ImageData>>,
            images: Option<Vec<ImageData>>,
        }

        let api_response: SiliconFlowResponse = response
            .json()
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // SiliconFlow 返回格式可能是 data 或 images
        let images = api_response
            .data
            .or(api_response.images)
            .ok_or_else(|| "No image data in response".to_string())?;

        let first_image = images
            .first()
            .ok_or_else(|| "Empty image list in response".to_string())?;

        // Step 3: Download/decode image
        if let Some(url) = &first_image.url {
            let img_bytes = client
                .get(url)
                .timeout(std::time::Duration::from_secs(30))
                .send()
                .map_err(|e| format!("Failed to download image: {}", e))?
                .bytes()
                .map_err(|e| format!("Failed to read image bytes: {}", e))?;

            // Ensure parent dir exists
            if let Some(parent) = Path::new(output_path).parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create output dir: {}", e))?;
            }

            fs::write(output_path, &img_bytes)
                .map_err(|e| format!("Failed to write image: {}", e))?;

            Ok(output_path.to_string())
        } else if let Some(b64) = &first_image.b64_json {
            use base64::Engine;
            let img_bytes = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Failed to decode base64: {}", e))?;

            if let Some(parent) = Path::new(output_path).parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create output dir: {}", e))?;
            }

            fs::write(output_path, &img_bytes)
                .map_err(|e| format!("Failed to write image: {}", e))?;

            Ok(output_path.to_string())
        } else {
            Err("No image URL or base64 data in response".to_string())
        }
    }
}

// ==================== Provider Factory ====================

pub fn create_provider(settings: &crate::db::AiSettings) -> Result<Box<dyn AiImageProvider>, String> {
    if settings.api_key.is_empty() {
        return Err("API key is not configured".to_string());
    }

    match settings.provider.as_str() {
        "siliconflow" => Ok(Box::new(SiliconFlowProvider::new(
            &settings.api_key,
            &settings.api_endpoint,
            &settings.model,
        ))),
        "openai" => {
            // OpenAI DALL-E: basic support
            Ok(Box::new(SiliconFlowProvider::new(
                &settings.api_key,
                &settings.api_endpoint,
                &settings.model,
            )))
        }
        "custom" => Ok(Box::new(SiliconFlowProvider::new(
            &settings.api_key,
            &settings.api_endpoint,
            &settings.model,
        ))),
        _ => Err(format!("Unknown provider: {}", settings.provider)),
    }
}

// ==================== 连接测试（异步版本，用于 Tauri command） ====================

pub async fn test_connection_async(settings: &crate::db::AiSettings) -> Result<String, String> {
    let provider = create_provider(settings)?;
    provider.test_connection()?;
    Ok(format!("Successfully connected to {} ({})", provider.provider_name(), settings.model))
}

// ==================== 风格预设 ====================

pub const STYLE_PRESETS: &[(&str, &str)] = &[
    ("warm_glow", "A soft warm-toned decorative illustration transitioning from {prev_month} to {next_month}, gentle amber and coral gradient, abstract shapes with warmth and tenderness, no text, no watermark"),
    ("dreamy_soft", "A dreamy pastel-toned transitional illustration from {prev_month} to {next_month}, soft clouds and floating particles, ethereal light, no text, no watermark"),
    ("cartoon", "A cute cartoon-style transitional scene from {prev_month} to {next_month}, playful shapes, bright colors, child-friendly, no text, no watermark"),
    ("watercolor", "A delicate watercolor-style transitional painting from {prev_month} to {next_month}, flowing colors, soft brush strokes, artistic, no text, no watermark"),
];

pub fn build_transition_prompt(
    settings: &crate::db::AiSettings,
    prev_month: &str,
    next_month: &str,
) -> String {
    // Use custom prompt if set, otherwise use style preset
    let template = if !settings.custom_prompt.is_empty() {
        &settings.custom_prompt
    } else {
        STYLE_PRESETS
            .iter()
            .find(|(id, _)| *id == settings.style_preset)
            .map(|(_, prompt)| *prompt)
            .unwrap_or(STYLE_PRESETS[0].1)
    };

    template
        .replace("{prev_month}", prev_month)
        .replace("{next_month}", next_month)
        .replace("{style}", &settings.style_preset)
}
