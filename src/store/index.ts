import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Baby, Project, Period, Video, VideoFrame, ExportRecord, ScanLog, PeriodStats, AiSettings, PendingItem, VideoFrameTemp, Thumbnail } from '../types';
import type { CollageTemplate, RegionTransform } from '../utils/collageTemplates';
import { getTemplateById, DEFAULT_TRANSFORM } from '../utils/collageTemplates';
import { getPeriodThumbnails, addToPending, removeFromPending, setFinalThumbnail, cancelFinalThumbnail, deleteThumbnail, getOriginalFile } from '../utils/tauriCommands';

interface AppState {
  // 当前选中的宝宝
  currentBaby: Baby | null;
  setCurrentBaby: (baby: Baby | null) => void;

  // 当前项目
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // 周期列表
  periods: Period[];
  setPeriods: (periods: Period[]) => void;
  addPeriod: (period: Period) => void;
  updatePeriod: (period: Period) => void;
  removePeriod: (periodId: number) => void;

  // 当前周期
  currentPeriod: Period | null;
  setCurrentPeriod: (period: Period | null) => void;

  // 当前周期的视频
  currentVideos: Video[];
  setCurrentVideos: (videos: Video[]) => void;

  // 导出记录
  exportRecords: ExportRecord[];
  setExportRecords: (records: ExportRecord[]) => void;

  // UI状态
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;

  // 扫描日志
  scanLogs: ScanLog[];
  isLogExpanded: boolean;
  autoScrollLog: boolean;
  addScanLog: (log: Omit<ScanLog, 'id'>) => void;
  addScanLogs: (logs: Array<Omit<ScanLog, 'id'>>) => void;
  clearScanLogs: () => void;
  toggleLogExpanded: () => void;
  toggleAutoScrollLog: () => void;

  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

  generationProgress: number;
  setGenerationProgress: (progress: number) => void;

  generationStage: string;
  setGenerationStage: (stage: string) => void;

  generationMessage: string;
  setGenerationMessage: (message: string) => void;

  generationFallback: boolean;
  setGenerationFallback: (fallback: boolean) => void;

  fallbackReason: string;
  setFallbackReason: (reason: string) => void;

  periodStats: Record<number, PeriodStats>;
  setPeriodStats: (stats: PeriodStats[]) => void;
  updatePeriodStat: (periodId: number, updates: Partial<PeriodStats>) => void;
  resetPeriodStats: () => void;

  // 拼图工作区状态
  collageMode: boolean;
  setCollageMode: (mode: boolean) => void;
  selectedTemplateId: string | null; // 当前选中的模板 ID
  setSelectedTemplateId: (id: string | null) => void;
  selectedTemplate: CollageTemplate | null; // 当前选中的模板对象（派生）
  collageGap: number; // px
  setCollageGap: (gap: number) => void;
  collagePhotoOrder: number[]; // photo IDs in order
  setCollagePhotoOrder: (order: number[]) => void;
  // 区域编辑
  selectedRegionIndex: number | null; // 当前选中的区域索引
  setSelectedRegionIndex: (idx: number | null) => void;
  regionTransforms: Record<number, RegionTransform>; // key = region index
  setRegionTransform: (regionIdx: number, tf: Partial<RegionTransform>) => void;
  resetRegionTransforms: () => void;
  // 导出设置
  collageQuality: number; // 60-100
  setCollageQuality: (q: number) => void;
  collageOutputSize: number; // e.g. 1080, 2048
  setCollageOutputSize: (size: number) => void;

  // 视频播放器状态
  showVideoPlayer: boolean;
  setShowVideoPlayer: (show: boolean) => void;
  currentPlayingVideo: Video | null;
  setCurrentPlayingVideo: (video: Video | null) => void;

  // 截帧相关
  capturedFrame: VideoFrame | null;
  setCapturedFrame: (frame: VideoFrame | null) => void;
  showCaptureResult: boolean;
  setShowCaptureResult: (show: boolean) => void;

  // AI 设置
  aiSettings: AiSettings;
  setAiSettings: (settings: Partial<AiSettings>) => void;

  // 待处理项
  pendingItems: PendingItem[];
  pendingLoading: boolean;
  deletingItemId: number | null;
  loadPendingItems: (periodId: number) => Promise<void>;
  deletePendingItem: (itemType: string, itemId: number) => Promise<void>;

  // 临时帧
  tempFrames: VideoFrameTemp[];
  persistVideoFrame: (tempId: number, projectId: number) => Promise<void>;
  discardTempFrames: (videoId: number) => Promise<void>;
  loadTempFrames: (videoId: number) => Promise<void>;

  // 缩略图相关状态
  thumbnails: Thumbnail[];
  setThumbnails: (thumbnails: Thumbnail[]) => void;
  loadThumbnails: (periodId: number) => Promise<void>;
  addThumbToPending: (id: number) => Promise<void>;
  removeThumbFromPending: (id: number) => Promise<void>;
  setThumbAsFinal: (id: number) => Promise<void>;
  cancelThumbFinal: () => Promise<void>;
  deleteThumb: (id: number) => Promise<void>;
  previewOriginal: (id: number) => Promise<string>;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'siliconflow',
  api_endpoint: 'https://api.siliconflow.cn/v1/images/generations',
  api_key: '',
  model: 'black-forest-labs/FLUX.1-schnell',
  enabled: false,
  style_preset: 'warm_glow',
  custom_prompt: '',
  frame_duration: 1.5,
};

export const useAppStore = create<AppState>((set, get) => ({
  currentBaby: null,
  setCurrentBaby: (baby) => set({ currentBaby: baby }),

  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  periods: [],
  setPeriods: (periods) => set({ periods }),
  addPeriod: (period) => set((state) => ({ periods: [...state.periods, period] })),
  updatePeriod: (period) => set((state) => ({
    periods: state.periods.map(p => p.id === period.id ? period : p)
  })),
  removePeriod: (periodId) => set((state) => ({
    periods: state.periods.filter(p => p.id !== periodId)
  })),

  currentPeriod: null,
  setCurrentPeriod: (period) => set({ currentPeriod: period }),

  currentVideos: [],
  setCurrentVideos: (videos) => set({ currentVideos: videos }),

  exportRecords: [],
  setExportRecords: (records) => set({ exportRecords: records }),

  isScanning: false,
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  scanLogs: [],
  isLogExpanded: false,
  autoScrollLog: true,

  addScanLog: (log) =>
    set((state) => {
      const newLog = {
        ...log,
        id: `${log.timestamp}-${state.scanLogs.length}`,
      };
      const allLogs = [...state.scanLogs, newLog];
      const maxLogs = 1000;
      const trimmedLogs = allLogs.length > maxLogs
        ? allLogs.slice(allLogs.length - maxLogs)
        : allLogs;
      return {
        scanLogs: trimmedLogs,
      };
    }),

  addScanLogs: (logs) =>
    set((state) => {
      const startIndex = state.scanLogs.length;
      const newLogs = logs.map((log, index) => ({
        ...log,
        id: `${log.timestamp}-${startIndex + index}`,
      }));
      const allLogs = [...state.scanLogs, ...newLogs];
      const maxLogs = 1000;
      const trimmedLogs = allLogs.length > maxLogs
        ? allLogs.slice(allLogs.length - maxLogs)
        : allLogs;
      return {
        scanLogs: trimmedLogs,
      };
    }),

  clearScanLogs: () => set({ scanLogs: [] }),

  toggleLogExpanded: () =>
    set((state) => ({ isLogExpanded: !state.isLogExpanded })),

  toggleAutoScrollLog: () =>
    set((state) => ({ autoScrollLog: !state.autoScrollLog })),

  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),

  generationProgress: 0,
  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  generationStage: '',
  setGenerationStage: (stage) => set({ generationStage: stage }),

  generationMessage: '',
  setGenerationMessage: (message) => set({ generationMessage: message }),

  generationFallback: false,
  setGenerationFallback: (fallback) => set({ generationFallback: fallback }),

  fallbackReason: '',
  setFallbackReason: (reason) => set({ fallbackReason: reason }),

  periodStats: {},
  setPeriodStats: (stats) => set((state) => {
    const newStats: Record<number, PeriodStats> = {};
    stats.forEach(s => { newStats[s.period_id] = s; });
    return { periodStats: { ...state.periodStats, ...newStats } };
  }),
  updatePeriodStat: (periodId, updates) => set((state) => {
    const existing = state.periodStats[periodId];
    if (!existing) return state;
    return {
      periodStats: {
        ...state.periodStats,
        [periodId]: { ...existing, ...updates }
      }
    };
  }),
  resetPeriodStats: () => set({ periodStats: {} }),

  // 拼图工作区状态
  collageMode: false,
  setCollageMode: (mode) => set({ collageMode: mode }),
  selectedTemplateId: null,
  setSelectedTemplateId: (id) => set((state) => ({
    selectedTemplateId: id,
    selectedTemplate: id ? getTemplateById(id) ?? state.selectedTemplate : null,
  })),
  selectedTemplate: null,
  collageGap: 3,
  setCollageGap: (gap) => set({ collageGap: gap }),
  collagePhotoOrder: [],
  setCollagePhotoOrder: (order) => set({ collagePhotoOrder: order }),
  // 区域编辑
  selectedRegionIndex: null,
  setSelectedRegionIndex: (idx) => set({ selectedRegionIndex: idx }),
  regionTransforms: {},
  setRegionTransform: (regionIdx, tf) =>
    set((state) => ({
      regionTransforms: {
        ...state.regionTransforms,
        [regionIdx]: {
          ...(state.regionTransforms[regionIdx] || DEFAULT_TRANSFORM),
          ...tf,
        },
      },
    })),
  resetRegionTransforms: () => set({ regionTransforms: {}, selectedRegionIndex: null }),
  // 导出设置
  collageQuality: 92,
  setCollageQuality: (q) => set({ collageQuality: q }),
  collageOutputSize: 1080,
  setCollageOutputSize: (size) => set({ collageOutputSize: size }),

  // 视频播放器状态
  showVideoPlayer: false,
  setShowVideoPlayer: (show) => set({ showVideoPlayer: show }),
  currentPlayingVideo: null,
  setCurrentPlayingVideo: (video) => set({ currentPlayingVideo: video }),

  // 截帧相关
  capturedFrame: null,
  setCapturedFrame: (frame) => set({ capturedFrame: frame }),
  showCaptureResult: false,
  setShowCaptureResult: (show) => set({ showCaptureResult: show }),

  // AI 设置
  aiSettings: { ...DEFAULT_AI_SETTINGS },
  setAiSettings: (partial) =>
    set((state) => ({ aiSettings: { ...state.aiSettings, ...partial } })),

  // 待处理项
  pendingItems: [],
  pendingLoading: false,
  deletingItemId: null,

  loadPendingItems: async (periodId: number) => {
    set({ pendingLoading: true });
    try {
      const items = await invoke<PendingItem[]>('get_pending_items', { periodId });
      set({ pendingItems: items, pendingLoading: false });
    } catch (e) {
      console.error('Failed to load pending items:', e);
      set({ pendingLoading: false });
    }
  },

  deletePendingItem: async (itemType: string, itemId: number) => {
    set({ deletingItemId: itemId });
    try {
      await invoke('delete_selected_item', { itemType, itemId });
      const state = get();
      set({
        pendingItems: state.pendingItems.filter(
          i => !(i.item_type === itemType && i.id === itemId)
        ),
        deletingItemId: null,
      });
    } catch (e) {
      console.error('Failed to delete item:', e);
      set({ deletingItemId: null });
    }
  },

  // 临时帧
  tempFrames: [],

  persistVideoFrame: async (tempId: number, projectId: number) => {
    try {
      await invoke('persist_video_frame', { tempId, projectId });
    } catch (e) {
      console.error('Failed to persist video frame:', e);
      throw e;
    }
  },

  discardTempFrames: async (videoId: number) => {
    try {
      await invoke('discard_temp_frames', { videoId });
      set({ tempFrames: [] });
    } catch (e) {
      console.error('Failed to discard temp frames:', e);
    }
  },

  loadTempFrames: async (videoId: number) => {
    try {
      const frames = await invoke<VideoFrameTemp[]>('get_temp_frames', { videoId });
      set({ tempFrames: frames });
    } catch (e) {
      console.error('Failed to load temp frames:', e);
    }
  },

  // 缩略图相关
  thumbnails: [],
  setThumbnails: (thumbnails) => set({ thumbnails }),

  loadThumbnails: async (periodId: number) => {
    try {
      const thumbs = await getPeriodThumbnails(periodId);
      set((state) => {
        const newPeriodStats = { ...state.periodStats };
        const existing = newPeriodStats[periodId];
        const photoCount = thumbs.filter(t => t.source_type === 'scan').length;
        const pendingCount = thumbs.filter(t => t.is_selected).length;
        const hasFinal = thumbs.some(t => t.is_final);

        if (existing) {
          newPeriodStats[periodId] = {
            ...existing,
            photo_count: photoCount,
            pending_count: pendingCount,
            has_final: hasFinal,
          };
        } else {
          newPeriodStats[periodId] = {
            period_id: periodId,
            photo_count: photoCount,
            video_count: 0,
            pending_count: pendingCount,
            has_final: hasFinal,
          };
        }
        return { thumbnails: thumbs, periodStats: newPeriodStats };
      });
    } catch (e) {
      console.error('Failed to load thumbnails:', e);
    }
  },

  addThumbToPending: async (id: number) => {
    try {
      await addToPending(id);
      set((state) => {
        const thumb = state.thumbnails.find(t => t.id === id);
        // 如果已经选中，不重复计数
        if (!thumb || thumb.is_selected) return { thumbnails: state.thumbnails };
        const periodId = thumb.period_id;
        const newThumbnails = state.thumbnails.map(t => 
          t.id === id ? { ...t, is_selected: true } : t
        );
        const newPeriodStats = { ...state.periodStats };
        if (periodId && newPeriodStats[periodId]) {
          newPeriodStats[periodId] = {
            ...newPeriodStats[periodId],
            pending_count: (newPeriodStats[periodId].pending_count || 0) + 1,
          };
        }
        return { thumbnails: newThumbnails, periodStats: newPeriodStats };
      });
    } catch (e) {
      console.error('Failed to add to pending:', e);
    }
  },

  removeThumbFromPending: async (id: number) => {
    try {
      await removeFromPending(id);
      set((state) => {
        const thumb = state.thumbnails.find(t => t.id === id);
        // 如果已经取消选中，不重复减计数
        if (!thumb || !thumb.is_selected) return { thumbnails: state.thumbnails };
        const periodId = thumb.period_id;
        const newThumbnails = state.thumbnails.map(t => 
          t.id === id ? { ...t, is_selected: false } : t
        );
        const newPeriodStats = { ...state.periodStats };
        if (periodId && newPeriodStats[periodId]) {
          newPeriodStats[periodId] = {
            ...newPeriodStats[periodId],
            pending_count: Math.max(0, (newPeriodStats[periodId].pending_count || 0) - 1),
          };
        }
        return { thumbnails: newThumbnails, periodStats: newPeriodStats };
      });
    } catch (e) {
      console.error('Failed to remove from pending:', e);
    }
  },

  setThumbAsFinal: async (id: number) => {
    const state = get();
    if (!state.currentPeriod) return;
    try {
      await setFinalThumbnail(state.currentPeriod.id, id);
      set((state) => ({
        thumbnails: state.thumbnails.map(t => ({
          ...t,
          is_final: t.id === id
        }))
      }));
    } catch (e) {
      console.error('Failed to set final:', e);
    }
  },

  cancelThumbFinal: async () => {
    const state = get();
    if (!state.currentPeriod) return;
    try {
      await cancelFinalThumbnail(state.currentPeriod.id);
      set((state) => ({
        thumbnails: state.thumbnails.map(t => ({ ...t, is_final: false }))
      }));
    } catch (e) {
      console.error('Failed to cancel final:', e);
    }
  },

  deleteThumb: async (id: number) => {
    try {
      await deleteThumbnail(id);
      set((state) => ({
        thumbnails: state.thumbnails.filter(t => t.id !== id)
      }));
    } catch (e) {
      console.error('Failed to delete thumbnail:', e);
    }
  },

  previewOriginal: async (id: number): Promise<string> => {
    return getOriginalFile(id);
  },
}));

/** 检查 AI 是否已配置完整 */
export function isAiConfigured(): boolean {
  const s = useAppStore.getState().aiSettings;
  return s.enabled && !!s.api_key && !!s.api_endpoint && !!s.model;
}
