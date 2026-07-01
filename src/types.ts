// ==================== 数据库模型 ====================

export interface Baby {
  id: number;
  name: string;
  nickname?: string;
  birth_date: string;
  gender: string;
  avatar_path?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  baby_id: number;
  name: string;
  description?: string;
  period_days: number;
  status: string;
  output_path?: string;
  created_at: string;
  updated_at: string;
}

export interface Period {
  id: number;
  project_id: number;
  name: string;
  start_date: string;
  end_date: string;
  period_type: string;
  sort_order: number;
  selected_photo_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: number;
  period_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  taken_at?: string;
  description?: string;
  is_selected: boolean;
  is_multi_selected: boolean;
  is_final: boolean;
  thumbnail_path?: string;
  source: 'scan' | 'collage';
  created_at: string;
}

export interface Video {
  id: number;
  period_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  duration: number;
  width: number;
  height: number;
  taken_at?: string;
  created_at: string;
}

export interface VideoFrame {
  id: number;
  video_id: number;
  period_id: number;
  file_path?: string;
  thumbnail_path?: string;
  time_seconds: number;
  is_selected: boolean;
  is_multi_selected: boolean;
  is_final: boolean;
  created_at: string;
}

export interface ExportRecord {
  id: number;
  project_id: number;
  output_path: string;
  file_name: string;
  file_size: number;
  duration: number;
  resolution: string;
  status: string;
  error_message?: string;
  created_at: string;
}

// ==================== 扫描 ====================

export interface ScanResult {
  photos: Thumbnail[];
  videos: Video[];
  total_photos: number;
  total_videos: number;
  recognized_photos: number;
  recognized_videos: number;
  skipped_duplicate_photos: number;
  skipped_duplicate_videos: number;
  skipped_no_date_photos: number;
  skipped_no_date_videos: number;
  skipped_no_period_photos: number;
  skipped_no_period_videos: number;
  skipped_copy_failed_photos: number;
  skipped_copy_failed_videos: number;
}

export interface ScanResultsBatch {
  photos: Thumbnail[];
  videos: Video[];
  total_photos: number;
  total_videos: number;
  recognized_photos: number;
  recognized_videos: number;
  skipped_duplicate_photos: number;
  skipped_duplicate_videos: number;
  skipped_no_date_photos: number;
  skipped_no_date_videos: number;
  skipped_no_period_photos: number;
  skipped_no_period_videos: number;
  skipped_copy_failed_photos: number;
  skipped_copy_failed_videos: number;
  processed_files: number;
  total_files: number;
}

export interface ScanLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  fileName?: string;
}

export interface ScanLogFile {
  project_id: number;
  scanned_at: string;
  folder_path: string;
  total_files: number;
  logs: ScanLog[];
}

// ==================== 向导步骤 ====================

export type WizardStep = 1 | 2 | 3 | 4 | 5;

// ==================== 视频配置 ====================

export interface VideoConfig {
  resolution: '720p' | '1080p' | '4k';
  fps: number;
  photo_duration: number;
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transition_duration: number;
  background_music?: string;
  output_format: 'mp4' | 'mov' | 'avi';
  ai_enabled: boolean;
  video_mode: 'standard' | 'agnes';
}

// ==================== Agnes 照片文字 ====================

export interface PhotoText {
  period_id: number;
  text: string;
}

// ==================== AI 设置 ====================

export interface AiSettings {
  provider: string;
  api_endpoint: string;
  api_key: string;
  model: string;
  enabled: boolean;
  style_preset: string;
  custom_prompt: string;
  frame_duration: number;
}

// ==================== 选择 ====================

export interface SelectableItem {
  type: 'photo' | 'video_frame';
  item: Photo | VideoFrame;
}

// ==================== 周期统计 ====================

export interface PeriodStats {
  period_id: number;
  photo_count: number;
  video_count: number;
  pending_count: number;
  has_final: boolean;
}

// ==================== 待处理项 & 临时帧 ====================

export interface PendingItem {
  item_type: 'photo' | 'collage' | 'video_frame';
  id: number;
  period_id: number;
  file_path?: string;
  file_name?: string;
  thumbnail_path?: string;
  width: number;
  height: number;
  time_seconds?: number;
  taken_at?: string;
  is_final: boolean;
  source?: 'scan' | 'collage';
}

export interface VideoFrameTemp {
  id: number;
  video_id: number;
  period_id: number;
  time_seconds: number;
  temp_thumb_path: string;
  created_at: string;
}

// ==================== 缩略图 ====================

export interface Thumbnail {
  id: number;
  project_id: number;
  period_id: number;
  source_type: 'scan' | 'video_frame' | 'collage';
  source_id?: number;
  original_path: string;
  original_file_name: string;
  original_width: number;
  original_height: number;
  original_file_size: number;
  base64_data: string;
  width: number;
  height: number;
  is_selected: boolean;
  is_final: boolean;
  taken_at?: string;
  created_at: string;
}
