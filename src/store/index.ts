import { create } from 'zustand';
import type { Baby, Project, Period, Photo, Video, VideoFrame, ExportRecord } from '../types';

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

  // 当前周期的照片
  currentPhotos: Photo[];
  setCurrentPhotos: (photos: Photo[]) => void;
  updatePhoto: (photo: Photo) => void;

  // 当前周期的视频
  currentVideos: Video[];
  setCurrentVideos: (videos: Video[]) => void;

  // 视频截图
  currentVideoFrames: VideoFrame[];
  setCurrentVideoFrames: (frames: VideoFrame[]) => void;

  // 导出记录
  exportRecords: ExportRecord[];
  setExportRecords: (records: ExportRecord[]) => void;

  // UI状态
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;

  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

  generationProgress: number;
  setGenerationProgress: (progress: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
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

  currentPhotos: [],
  setCurrentPhotos: (photos) => set({ currentPhotos: photos }),
  updatePhoto: (photo) => set((state) => ({
    currentPhotos: state.currentPhotos.map(p => p.id === photo.id ? photo : p)
  })),

  currentVideos: [],
  setCurrentVideos: (videos) => set({ currentVideos: videos }),

  currentVideoFrames: [],
  setCurrentVideoFrames: (frames) => set({ currentVideoFrames: frames }),

  exportRecords: [],
  setExportRecords: (records) => set({ exportRecords: records }),

  isScanning: false,
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),

  generationProgress: 0,
  setGenerationProgress: (progress) => set({ generationProgress: progress }),
}));
