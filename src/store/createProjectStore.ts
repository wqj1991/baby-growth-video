import { create } from 'zustand';
import type { WizardStep, Baby, Period, ScanResult, ScanLog, ScanResultsBatch } from '../types';

interface CreateProjectState {
  // 当前步骤
  currentStep: WizardStep;

  // 步骤1：选择宝宝
  selectedBaby: Baby | null;

  // 步骤2：项目信息
  projectName: string;
  projectDescription: string;
  periodDays: number;
  includeSpecialDates: boolean;
  endDate: string;

  // 项目ID（创建后保存）
  projectId: number | null;

  // 步骤3：选择文件夹
  folderPath: string | null;
  scanResult: ScanResult | null;
  isScanning: boolean;

  // 扫描进度
  scanProgress: { processed: number; total: number } | null;

  // 扫描日志
  scanLogs: ScanLog[];
  isLogExpanded: boolean;
  autoScrollLog: boolean;

  // 步骤4：生成周期
  periods: Period[];
  isGeneratingPeriods: boolean;

  // Actions
  setCurrentStep: (step: WizardStep) => void;
  setSelectedBaby: (baby: Baby) => void;
  setProjectInfo: (info: {
    name: string;
    description: string;
    periodDays: number;
    includeSpecialDates: boolean;
    endDate: string;
  }) => void;
  setProjectId: (id: number) => void;
  setFolderPath: (path: string) => void;
  setScanResult: (result: ScanResult | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setScanProgress: (progress: { processed: number; total: number } | null) => void;
  addScanLog: (log: Omit<ScanLog, 'id'>) => void;
  addScanLogs: (logs: Array<Omit<ScanLog, 'id'>>) => void;
  clearScanLogs: () => void;
  toggleLogExpanded: () => void;
  toggleAutoScrollLog: () => void;
  setPeriods: (periods: Period[]) => void;
  setIsGeneratingPeriods: (generating: boolean) => void;
  addScanResultBatch: (batch: ScanResultsBatch) => void;
  reset: () => void;
}

export const useCreateProjectStore = create<CreateProjectState>((set) => ({
  currentStep: 1,
  selectedBaby: null,
  projectName: '',
  projectDescription: '',
  periodDays: 7,
  includeSpecialDates: false,
  endDate: '',
  projectId: null,
  folderPath: null,
  scanResult: null,
  isScanning: false,
  scanProgress: null,
  scanLogs: [],
  isLogExpanded: false,
  autoScrollLog: true,
  periods: [],
  isGeneratingPeriods: false,

  setCurrentStep: (step) => set({ currentStep: step }),

  setSelectedBaby: (baby) => set({ selectedBaby: baby }),

  setProjectInfo: (info) =>
    set({
      projectName: info.name,
      projectDescription: info.description,
      periodDays: info.periodDays,
      includeSpecialDates: info.includeSpecialDates,
      endDate: info.endDate || '',
    }),

  setProjectId: (id) => set({ projectId: id }),

  setFolderPath: (path) => set({ folderPath: path }),
  setScanProgress: (progress: { processed: number; total: number } | null) => set({ scanProgress: progress }),

  setScanResult: (result) =>
    set((state) => {
      if (!result) {
        return { scanResult: null };
      }
      const currentResult = state.scanResult;
      if (!currentResult) {
        return { scanResult: result };
      }
      return {
        scanResult: {
          ...result,
          photos: currentResult.photos,
          videos: currentResult.videos,
          recognized_photos: result.recognized_photos || currentResult.recognized_photos,
          recognized_videos: result.recognized_videos || currentResult.recognized_videos,
        },
      };
    }),

  setIsScanning: (scanning) => set({ isScanning: scanning }),

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
      // 最多保留 1000 条日志，防止内存占用过大
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

  setPeriods: (periods) => set({ periods }),

  setIsGeneratingPeriods: (generating) => set({ isGeneratingPeriods: generating }),

  addScanResultBatch: (batch) =>
    set((state) => {
      const currentResult = state.scanResult;
      if (!currentResult) {
        return {
          scanResult: {
            photos: batch.photos,
            videos: batch.videos,
            total_photos: batch.total_photos || 0,
            total_videos: batch.total_videos || 0,
            recognized_photos: batch.recognized_photos,
            recognized_videos: batch.recognized_videos,
            skipped_duplicate_photos: batch.skipped_duplicate_photos || 0,
            skipped_duplicate_videos: batch.skipped_duplicate_videos || 0,
            skipped_no_date_photos: batch.skipped_no_date_photos || 0,
            skipped_no_date_videos: batch.skipped_no_date_videos || 0,
            skipped_no_period_photos: batch.skipped_no_period_photos || 0,
            skipped_no_period_videos: batch.skipped_no_period_videos || 0,
            skipped_copy_failed_photos: batch.skipped_copy_failed_photos || 0,
            skipped_copy_failed_videos: batch.skipped_copy_failed_videos || 0,
          },
        };
      }
      return {
        scanResult: {
          ...currentResult,
          photos: [...currentResult.photos, ...batch.photos],
          videos: [...currentResult.videos, ...batch.videos],
          total_photos: batch.total_photos || currentResult.total_photos,
          total_videos: batch.total_videos || currentResult.total_videos,
          recognized_photos: currentResult.recognized_photos + batch.recognized_photos,
          recognized_videos: currentResult.recognized_videos + batch.recognized_videos,
          skipped_duplicate_photos: batch.skipped_duplicate_photos || currentResult.skipped_duplicate_photos,
          skipped_duplicate_videos: batch.skipped_duplicate_videos || currentResult.skipped_duplicate_videos,
          skipped_no_date_photos: batch.skipped_no_date_photos || currentResult.skipped_no_date_photos,
          skipped_no_date_videos: batch.skipped_no_date_videos || currentResult.skipped_no_date_videos,
          skipped_no_period_photos: batch.skipped_no_period_photos || currentResult.skipped_no_period_photos,
          skipped_no_period_videos: batch.skipped_no_period_videos || currentResult.skipped_no_period_videos,
          skipped_copy_failed_photos: batch.skipped_copy_failed_photos || currentResult.skipped_copy_failed_photos,
          skipped_copy_failed_videos: batch.skipped_copy_failed_videos || currentResult.skipped_copy_failed_videos,
        },
      };
    }),

  reset: () =>
    set({
      currentStep: 1,
      selectedBaby: null,
      projectName: '',
      projectDescription: '',
      periodDays: 7,
      includeSpecialDates: false,
      endDate: '',
      projectId: null,
      folderPath: null,
      scanResult: null,
      isScanning: false,
      scanProgress: null,
      scanLogs: [],
      isLogExpanded: false,
      autoScrollLog: true,
      periods: [],
      isGeneratingPeriods: false,
    }),
}));
