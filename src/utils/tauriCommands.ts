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
  VideoConfig,
} from '../types';

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

// ==================== 视频相关 ====================

// 获取周期的所有视频
export async function getPeriodVideos(periodId: number): Promise<Video[]> {
  return invoke('get_period_videos', { periodId });
}

// 获取视频截图
export async function getVideoFrames(videoId: number): Promise<VideoFrame[]> {
  return invoke('get_video_frames', { videoId });
}

// 生成视频截图
export async function generateVideoFrames(videoId: number, count: number): Promise<VideoFrame[]> {
  return invoke('generate_video_frames', { videoId, count });
}

// 设置最终选中的视频截图
export async function setFinalVideoFrame(periodId: number, frameId: number): Promise<void> {
  return invoke('set_final_video_frame', { periodId, frameId });
}

// ==================== 扫描文件 ====================

// 扫描文件夹中的照片和视频
export async function scanMediaFolder(
  projectId: number,
  folderPath: string
): Promise<ScanResult> {
  return invoke('scan_media_folder', { projectId, folderPath });
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
