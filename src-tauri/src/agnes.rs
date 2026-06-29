use serde::Deserialize;
use std::time::Duration;

// ==================== Agnes AI 视频生成客户端 ====================

const AGNES_BASE_URL: &str = "https://apihub.agnes-ai.com/v1";
const AGNES_MODEL: &str = "agnes-video-v2.0";
const POLL_INTERVAL_SECS: u64 = 8;
const MAX_POLL_ATTEMPTS: u32 = 60; // ~8 分钟超时

/// keyframes 模式请求参数
pub struct KeyframesRequest {
    pub prompt: String,
    pub images: Vec<String>, // base64 data URIs
    pub num_frames: u32,
    pub frame_rate: u32,
}

/// 轮询响应
#[derive(Debug, Deserialize)]
struct AgnesVideoResponse {
    id: String,
    status: String,
    #[serde(default)]
    remixed_from_video_id: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

/// 创建视频任务响应
#[derive(Debug, Deserialize)]
struct AgnesCreateResponse {
    id: String,
}

pub struct AgnesVideoClient {
    api_key: String,
    base_url: String,
}

impl AgnesVideoClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            base_url: AGNES_BASE_URL.to_string(),
        }
    }

    /// 创建 keyframes 模式视频任务
    /// 返回 video_id
    pub fn create_keyframes_video(&self, req: &KeyframesRequest) -> Result<String, String> {
        let client = reqwest::blocking::Client::new();

        let body = serde_json::json!({
            "model": AGNES_MODEL,
            "prompt": req.prompt,
            "extra_body": {
                "image": req.images,
                "mode": "keyframes"
            },
            "num_frames": req.num_frames,
            "frame_rate": req.frame_rate,
        });

        let response = client
            .post(format!("{}/videos", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .timeout(Duration::from_secs(30))
            .send()
            .map_err(|e| format!("创建视频任务失败: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body_text = response.text().unwrap_or_default();
            return Err(format!("API 错误 ({}): {}", status.as_u16(), body_text));
        }

        let create_resp: AgnesCreateResponse = response
            .json()
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(create_resp.id)
    }

    /// 轮询视频任务状态
    /// 返回 (status, download_url_or_error)
    pub fn poll_video(&self, video_id: &str) -> Result<PollResult, String> {
        let client = reqwest::blocking::Client::new();

        let response = client
            .get(format!("{}/videos/{}", self.base_url, video_id))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .timeout(Duration::from_secs(15))
            .send()
            .map_err(|e| format!("轮询视频状态失败: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body_text = response.text().unwrap_or_default();
            return Err(format!("API 错误 ({}): {}", status.as_u16(), body_text));
        }

        let video: AgnesVideoResponse = response
            .json()
            .map_err(|e| format!("解析响应失败: {}", e))?;

        match video.status.as_str() {
            "completed" => {
                if let Some(url) = video.remixed_from_video_id {
                    Ok(PollResult::Completed { download_url: url })
                } else {
                    Ok(PollResult::Completed {
                        download_url: format!(
                            "{}/videos/{}/download",
                            self.base_url, video.id
                        ),
                    })
                }
            }
            "failed" => {
                Err(video
                    .error
                    .unwrap_or_else(|| "未知错误".to_string()))
            }
            "queued" | "processing" | "generating" | "rendering" => {
                Ok(PollResult::Pending)
            }
            other => Err(format!("未知任务状态: {}", other)),
        }
    }

    /// 下载视频文件到指定路径
    pub fn download_video(&self, url: &str, output_path: &str) -> Result<(), String> {
        let client = reqwest::blocking::Client::new();

        let response = client
            .get(url)
            .timeout(Duration::from_secs(300)) // 下载可能较大
            .send()
            .map_err(|e| format!("下载视频失败: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body_text = response.text().unwrap_or_default();
            return Err(format!("下载失败 ({}): {}", status.as_u16(), body_text));
        }

        let bytes = response
            .bytes()
            .map_err(|e| format!("读取视频数据失败: {}", e))?;

        std::fs::write(output_path, &bytes)
            .map_err(|e| format!("保存视频文件失败: {}", e))?;

        Ok(())
    }

    /// 完整流程：创建 → 轮询（带进度回调）→ 下载
    pub fn generate_video_blocking<F>(
        &self,
        req: &KeyframesRequest,
        output_path: &str,
        progress_callback: F,
    ) -> Result<(), String>
    where
        F: Fn(&str, u32, u32, &str), // stage, current_attempt, max_attempts, message
    {
        progress_callback("agnes_creating", 0, 1, "正在创建 Agnes 视频任务...");

        let video_id = self.create_keyframes_video(req)?;

        progress_callback(
            "agnes_encoding",
            0,
            MAX_POLL_ATTEMPTS,
            &format!("Agnes 正在生成视频 (ID: {})...", &video_id[..8.min(video_id.len())]),
        );

        // 轮询直到完成
        for attempt in 1..=MAX_POLL_ATTEMPTS {
            match self.poll_video(&video_id)? {
                PollResult::Completed { download_url } => {
                    progress_callback(
                        "agnes_downloading",
                        attempt,
                        MAX_POLL_ATTEMPTS,
                        "正在下载生成的视频...",
                    );

                    self.download_video(&download_url, output_path)?;

                    progress_callback(
                        "complete",
                        attempt,
                        MAX_POLL_ATTEMPTS,
                        "Agnes 视频生成完成！",
                    );
                    return Ok(());
                }
                PollResult::Pending => {
                    let elapsed = attempt * POLL_INTERVAL_SECS as u32;
                    progress_callback(
                        "agnes_encoding",
                        attempt,
                        MAX_POLL_ATTEMPTS,
                        &format!("Agnes 正在处理视频... 已等待 {}s", elapsed),
                    );
                    std::thread::sleep(Duration::from_secs(POLL_INTERVAL_SECS));
                }
            }
        }

        Err(format!(
            "视频生成超时（已等待 {}s）",
            MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECS as u32
        ))
    }
}

pub enum PollResult {
    Completed { download_url: String },
    Pending,
}
