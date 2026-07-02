import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import type {
  Baby,
  Project,
  Period,
  Video,
  ExportRecord,
  ScanResult,
  ScanResultsBatch,
  ScanLog,
  ScanLogFile,
  VideoConfig,
  AiSettings,
  PeriodStats,
  PhotoText,
  PendingItem,
  VideoFrameTemp,
  Thumbnail,
  ExportPhotosResult,
} from '../types';



/**
 * 将本地文件路径转换为可在 WebView 中加载的 media 协议 URL
 * 解决 Tauri 2.0 中 file:// 协议被安全策略阻止的问题
 */
export function fileToMediaUrl(filePath: string): string {
  // 使用 Tauri 官方协议转换，避免 WebView 无法识别自定义 scheme
  return convertFileSrc(filePath);
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
  periodDays: number,
  endDate?: string
): Promise<Period[]> {
  return invoke('generate_periods', { projectId, birthDate, periodDays, endDate });
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

// 获取周期统计信息
export async function getPeriodStats(projectId: number): Promise<PeriodStats[]> {
  return invoke('get_period_stats', { projectId });
}



// ==================== 视频相关 ====================

// 获取周期的所有视频
export async function getPeriodVideos(periodId: number): Promise<Video[]> {
  return invoke('get_period_videos', { periodId });
}

// 生成视频截图（按数量）
export async function generateVideoFrames(videoId: number, count: number): Promise<VideoFrameTemp[]> {
  return invoke('generate_video_frames', { videoId, count });
}

// 生成视频截图（按间隔）
export async function generateVideoFramesByInterval(videoId: number, intervalSeconds: number): Promise<VideoFrameTemp[]> {
  return invoke('generate_video_frames_by_interval', { videoId, intervalSeconds });
}

// 在指定时间点截取单帧
export async function generateVideoFrameAtTime(videoId: number, timeSeconds: number): Promise<VideoFrameTemp> {
  return invoke('generate_video_frame_at_time', { videoId, timeSeconds });
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

// 监听扫描结果批次事件（每10条记录推送一次）
export async function onScanResultsBatch(
  callback: (batch: ScanResultsBatch) => void
): Promise<() => void> {
  const unlisten = await listen<ScanResultsBatch>('scan://results-batch', (event) => {
    callback(event.payload);
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
  outputPath: string,
  overallPrompt?: string,
  photoTexts?: PhotoText[],
  taskId?: string,
): Promise<ExportRecord> {
  return invoke('generate_growth_video', {
    projectId,
    config,
    outputPath,
    overallPrompt: overallPrompt || null,
    photoTexts: photoTexts || null,
    taskId: taskId || null,
  });
}

// 获取生成进度
export async function getGenerationProgress(taskId: string): Promise<number> {
  return invoke('get_generation_progress', { taskId });
}

// 取消视频生成
export async function cancelGeneration(taskId: string): Promise<void> {
  return invoke('cancel_generation', { taskId });
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

// 保存音乐文件
export async function saveMusicFile(projectId: number, musicData: Uint8Array, musicName: string): Promise<string> {
  return invoke('save_music_file', { projectId, musicData, musicName });
}

// ==================== 拼图生成 ====================

export interface CollageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  order: number;
  rotation: number;
  flip_h: boolean;
  flip_v: boolean;
}

export interface CollageRequest {
  template_id: string;
  period_id: number;
  output_width: number;
  output_height: number;
  gap_px: number;
  jpeg_quality: number;
  photo_paths: string[];
  regions: CollageRegion[];
}

export interface CollageResult {
  output_path: string;
}

export async function generateCollage(
  req: CollageRequest,
  projectId: number,
): Promise<CollageResult> {
  return invoke('generate_collage', { request: req, projectId });
}

// ==================== 设置相关 ====================

// 获取所有设置
export async function getSettings(): Promise<Record<string, string>> {
  return invoke('get_settings');
}

// 保存设置 (批量)
export async function saveSettings(settings: Record<string, string>): Promise<void> {
  return invoke('save_settings', { settings });
}

// 获取 AI 设置
export async function getAiSettings(): Promise<AiSettings> {
  return invoke('get_ai_settings');
}

// 测试 AI 连接
export async function testAiConnection(): Promise<string> {
  return invoke('test_ai_connection');
}

// ==================== 待处理项 & 临时帧 ====================

export async function getPendingItems(periodId: number): Promise<PendingItem[]> {
  return invoke('get_pending_items', { periodId });
}

export async function deleteSelectedItem(itemType: string, itemId: number): Promise<void> {
  return invoke('delete_selected_item', { itemType, itemId });
}

export async function generateThumbnail(sourcePath: string, projectId: number, uuid: string): Promise<string> {
  return invoke('generate_thumbnail', { sourcePath, projectId, uuid });
}

export async function persistVideoFrame(tempId: number, projectId: number): Promise<void> {
  return invoke('persist_video_frame', { tempId, projectId });
}

export async function discardTempFrames(videoId: number): Promise<void> {
  return invoke('discard_temp_frames', { videoId });
}

export async function getTempFrames(videoId: number): Promise<VideoFrameTemp[]> {
  return invoke('get_temp_frames', { videoId });
}

// ==================== 缩略图操作 ====================

export async function getPeriodThumbnails(periodId: number): Promise<Thumbnail[]> {
  return invoke('get_period_thumbnails', { periodId });
}

export async function getProjectFinalThumbnails(projectId: number): Promise<Thumbnail[]> {
  return invoke('get_project_final_thumbnails', { projectId });
}

export async function getPeriodPendingThumbnails(periodId: number): Promise<Thumbnail[]> {
  return invoke('get_period_pending_thumbnails', { periodId });
}

export async function addToPending(thumbnailId: number): Promise<void> {
  return invoke('add_to_pending', { thumbnailId });
}

export async function removeFromPending(thumbnailId: number): Promise<void> {
  return invoke('remove_from_pending', { thumbnailId });
}

export async function setFinalThumbnail(periodId: number, thumbnailId: number): Promise<void> {
  return invoke('set_final_thumbnail', { periodId, thumbnailId });
}

export async function cancelFinalThumbnail(periodId: number): Promise<void> {
  return invoke('cancel_final_thumbnail', { periodId });
}

export async function deleteThumbnail(thumbnailId: number): Promise<void> {
  return invoke('delete_thumbnail', { thumbnailId });
}

export async function getOriginalFile(thumbnailId: number): Promise<string> {
  return invoke('get_original_file', { thumbnailId });
}

// ==================== 导出照片 ====================

export async function exportProjectPhotos(
  projectId: number,
  savePath: string
): Promise<ExportPhotosResult> {
  return invoke('export_project_photos', { projectId, savePath });
}
