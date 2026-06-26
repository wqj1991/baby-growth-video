import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import type {
  Baby,
  Project,
  Period,
  Photo,
  Video,
  VideoFrame,
  ExportRecord,
  ScanResult,
  ScanLog,
  ScanLogFile,
  VideoConfig,
} from '../types';

/**
 * 将本地文件路径转换为可在 WebView 中加载的 media 协议 URL
 * 解决 Tauri 2.0 中 file:// 协议被安全策略阻止的问题
 */
export function fileToMediaUrl(filePath: string): string {
  // 对文件路径进行 URL 编码，保留路径分隔符
  const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/').replace(/%5C/g, '/');
  return `media://localhost/${encoded}`;
}

/**
 * 读取本地图片文件并返回 base64 data URL
 * 用于在 WebView 中显示本地图片（替代 file:// 协议）
 */
export async function getImageBase64(filePath: string): Promise<string> {
  return invoke('get_image_base64', { filePath });
}

// ==================== 数据库操作 ====================

// 初始化数据库
export async function initDatabase(): Promise<void> {
  return invoke('init_database');
}

// ==================== 宝宝相关 ====================

// 获取所有宝宝
export async function getBabies(): Promise<Baby[]> {
  return invoke('get_babies');
}

// 创建宝宝
export async function createBaby(baby: Omit<Baby, 'id' | 'created_at' | 'updated_at'>): Promise<Baby> {
  return invoke('create_baby', { baby });
}

// 更新宝宝
export async function updateBaby(baby: Baby): Promise<Baby> {
  return invoke('update_baby', { baby });
}

// 删除宝宝
export async function deleteBaby(babyId: number): Promise<void> {
  return invoke('delete_baby', { babyId });
}

// ==================== 项目相关 ====================

// 获取宝宝的所有项目
export async function getProjects(babyId: number): Promise<Project[]> {
  return invoke('get_projects', { babyId });
}

// 创建项目
export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
  return invoke('create_project', { project });
}

// 更新项目
export async function updateProject(project: Project): Promise<Project> {
  return invoke('update_project', { project });
}

// 删除项目
export async function deleteProject(projectId: number): Promise<void> {
  return invoke('delete_project', { projectId });
}

// ==================== 周期相关 ====================

// 获取项目的所有周期
export async function getPeriods(projectId: number): Promise<Period[]> {
  return invoke('get_periods', { projectId });
}

// 自动生成周期
export async function generatePeriods(
  projectId: number,
  birthDate: string,
  periodDays: number
): Promise<Period[]> {
  return invoke('generate_periods', { projectId, birthDate, periodDays });
}

// 创建自定义周期
export async function createPeriod(period: Omit<Period, 'id' | 'created_at' | 'updated_at'>): Promise<Period> {
  return invoke('create_period', { period });
}

// 更新周期
export async function updatePeriod(period: Period): Promise<Period> {
  return invoke('update_period', { period });
}

// 删除周期
export async function deletePeriod(periodId: number): Promise<void> {
  return invoke('delete_period', { periodId });
}

// ==================== 照片相关 ====================

// 获取周期的所有照片
export async function getPeriodPhotos(periodId: number): Promise<Photo[]> {
  return invoke('get_period_photos', { periodId });
}

// 更新照片
export async function updatePhoto(photo: Photo): Promise<Photo> {
  return invoke('update_photo', { photo });
}

// 设置最终选中的照片
export async function setFinalPhoto(periodId: number, photoId: number): Promise<void> {
  return invoke('set_final_photo', { periodId, photoId });
}

// 取消最终选中的照片
export async function cancelFinalPhoto(periodId: number): Promise<void> {
  return invoke('cancel_final_photo', { periodId });
}

// ==================== 视频相关 ====================

// 获取周期的所有视频
export async function getPeriodVideos(periodId: number): Promise<Video[]> {
  return invoke('get_period_videos', { periodId });
}

// 获取视频截图
export async function getVideoFrames(videoId: number): Promise<VideoFrame[]> {
  return invoke('get_video_frames', { videoId });
}

// 生成视频截图（按数量）
export async function generateVideoFrames(videoId: number, count: number): Promise<VideoFrame[]> {
  return invoke('generate_video_frames', { videoId, count });
}

// 生成视频截图（按间隔）
export async function generateVideoFramesByInterval(videoId: number, intervalSeconds: number): Promise<VideoFrame[]> {
  return invoke('generate_video_frames_by_interval', { videoId, intervalSeconds });
}

// 设置最终选中的视频截图
export async function setFinalVideoFrame(periodId: number, frameId: number): Promise<void> {
  return invoke('set_final_video_frame', { periodId, frameId });
}

// 更新视频帧
export async function updateVideoFrame(frame: VideoFrame): Promise<VideoFrame> {
  return invoke('update_video_frame', { frame });
}

// 取消最终选中的视频帧
export async function cancelFinalVideoFrame(periodId: number): Promise<void> {
  return invoke('cancel_final_video_frame', { periodId });
}

// 获取视频缩略图
export async function getVideoThumbnail(videoPath: string): Promise<string> {
  return invoke('get_video_thumbnail', { videoPath });
}

// ==================== 扫描文件 ====================

// 扫描文件夹中的照片和视频
export async function scanMediaFolder(
  projectId: number,
  folderPath: string
): Promise<ScanResult> {
  return invoke('scan_media_folder', { projectId, folderPath });
}

// 按周期扫描文件夹
export async function scanPeriodFolder(
  projectId: number,
  periodId: number,
  folderPath: string
): Promise<ScanResult> {
  return invoke('scan_period_folder', { projectId, periodId, folderPath });
}

// 监听扫描日志事件
export async function onScanLog(
  callback: (log: Omit<ScanLog, 'id'>) => void
): Promise<() => void> {
  const unlisten = await listen<{
    level: ScanLog['level'];
    message: string;
    timestamp: number;
    file_name?: string;
  }>('scan://log', (event) => {
    callback({
      level: event.payload.level,
      message: event.payload.message,
      timestamp: event.payload.timestamp,
      fileName: event.payload.file_name,
    });
  });

  return unlisten;
}

// 获取项目的历史扫描日志
export async function getScanLog(
  projectId: number
): Promise<ScanLogFile | null> {
  return invoke('get_scan_log', { projectId });
}

// ==================== 视频生成 ====================

// 生成成长视频
export async function generateGrowthVideo(
  projectId: number,
  config: VideoConfig,
  outputPath: string
): Promise<ExportRecord> {
  return invoke('generate_growth_video', { projectId, config, outputPath });
}

// 获取生成进度
export async function getGenerationProgress(taskId: string): Promise<number> {
  return invoke('get_generation_progress', { taskId });
}

// ==================== 导出记录 ====================

// 获取项目的导出记录
export async function getExportRecords(projectId: number): Promise<ExportRecord[]> {
  return invoke('get_export_records', { projectId });
}

// ==================== 文件选择 ====================

// 选择文件夹
export async function selectFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
  });
  if (Array.isArray(result)) {
    return result[0] || null;
  }
  return result as string | null;
}

// 选择文件
export async function selectFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters,
  });
  if (Array.isArray(result)) {
    return result[0] || null;
  }
  return result as string | null;
}

// 保存文件
export async function saveFile(defaultName: string): Promise<string | null> {
  const result = await save({
    defaultPath: defaultName,
  });
  return result;
}
