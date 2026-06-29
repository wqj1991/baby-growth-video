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

// 照片
export interface Photo {
  id: number;
  period_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  taken_at?: string; // 拍摄时间
  description?: string;
  is_selected: boolean; // 是否被标记为候选
  is_multi_selected: boolean; // 是否被选中用于拼图
  is_final: boolean; // 是否最终选中
  created_at: string;
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

// 视频截图
export interface VideoFrame {
  id: number;
  video_id: number;
  period_id: number;
  file_path: string; // 截图保存路径
  time_seconds: number; // 在视频中的时间点
  is_selected: boolean;
  is_multi_selected: boolean;
  is_final: boolean;
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
  photos: Photo[];
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

// 待选区项目（照片 + 视频帧）
export type SelectableItem = 
  | { type: 'photo'; item: Photo }
  | { type: 'frame'; item: VideoFrame };
