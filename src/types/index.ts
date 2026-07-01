// 宝宝信息
export interface Baby {
  id: number;
  name: string;
  nickname?: string;
  birth_date: string; // ISO date string
  gender: 'boy' | 'girl' | 'unknown';
  avatar_path?: string;
  created_at: string;
  updated_at: string;
}

// 项目（每个宝宝可以有多个视频项目）
export interface Project {
  id: number;
  baby_id: number;
  name: string;
  description?: string;
  period_days: number; // 周期天数，默认7天
  status: 'draft' | 'completed';
  output_path?: string;
  created_at: string;
  updated_at: string;
}

// 周期
export interface Period {
  id: number;
  project_id: number;
  name: string; // 周期名称，如"第1周"、"满月"、"百天"
  start_date: string;
  end_date: string;
  period_type: 'auto' | 'custom'; // 自动生成或自定义添加
  sort_order: number;
  selected_photo_id?: number; // 最终选中的照片
  created_at: string;
  updated_at: string;
}

// 视频
export interface Video {
  id: number;
  period_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  duration: number; // 时长（秒）
  width: number;
  height: number;
  taken_at?: string;
  created_at: string;
}

// 导出记录
export interface ExportRecord {
  id: number;
  project_id: number;
  output_path: string;
  file_name: string;
  file_size: number;
  duration: number;
  resolution: string;
  status: 'success' | 'failed' | 'processing';
  error_message?: string;
  created_at: string;
}

// 扫描结果
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

// 扫描结果批次（增量推送）
export interface ScanResultsBatch {
  photos: Thumbnail[];
  videos: Video[];
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

// 扫描日志
export interface ScanLog {
  id: string;
  level: 'success' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
  fileName?: string;
}

// 扫描日志文件（持久化格式）
export interface ScanLogFile {
  project_id: number;
  scanned_at: string; // ISO date string
  folder_path: string;
  total_files: number;
  logs: Array<Omit<ScanLog, 'id'>>;
}

// 视频生成配置
export interface VideoConfig {
  resolution: '720p' | '1080p' | '4k';
  fps: number;
  photo_duration: number; // 每张照片显示时长（秒）
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transition_duration: number; // 转场时长（秒）
  background_music?: string; // 背景音乐路径
  output_format: 'mp4' | 'mov' | 'avi';
}

// ==================== 创建项目向导相关类型 ====================

// 向导步骤类型
export type WizardStep = 1 | 2 | 3 | 4 | 5;

// 项目信息（向导步骤2使用）
export interface ProjectInfo {
  name: string;
  description: string;
  period_days: number;
  include_special_dates: boolean;
}

// 周期统计信息
export interface PeriodStats {
  period_id: number;
  photo_count: number;
  video_count: number;
  pending_count: number;
  has_final: boolean;
}

// Toast 通知
export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 默认 4000
}

// 统一缩略图类型
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

// 缩略图状态
export type ThumbnailState = 'in_photos' | 'in_pending' | 'final';

// PendingItem 类型保留用于向后兼容，但内部使用 thumbnail
export interface PendingItem {
  item_type: 'photo' | 'video_frame' | 'collage';
  id: number;
  period_id: number;
  file_path: string | null;
  file_name: string | null;
  thumbnail_path: string | null;
  width: number;
  height: number;
  time_seconds: number | null;
  taken_at: string | null;
  is_final: boolean;
  source: string | null;
}
