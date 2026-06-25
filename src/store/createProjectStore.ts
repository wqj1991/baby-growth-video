import { create } from 'zustand';
import type { WizardStep, Baby, Period, ScanResult, ScanLog } from '../types';

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

  // 项目ID（创建后保存）
  projectId: number | null;

  // 步骤3：选择文件夹
  folderPath: string | null;
  scanResult: ScanResult | null;
  isScanning: boolean;

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
  }) => void;
  setProjectId: (id: number) => void;
  setFolderPath: (path: string) => void;
  setScanResult: (result: ScanResult | null) => void;
  setIsScanning: (scanning: boolean) => void;
  addScanLog: (log: Omit<ScanLog, 'id'>) => void;
  clearScanLogs: () => void;
  toggleLogExpanded: () => void;
  toggleAutoScrollLog: () => void;
  setPeriods: (periods: Period[]) => void;
  setIsGeneratingPeriods: (generating: boolean) => void;
  reset: () => void;
}

export const useCreateProjectStore = create<CreateProjectState>((set) => ({
  currentStep: 1,
  selectedBaby: null,
  projectName: '',
  projectDescription: '',
  periodDays: 7,
  includeSpecialDates: false,
  projectId: null,
  folderPath: null,
  scanResult: null,
  isScanning: false,
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
    }),

  setProjectId: (id) => set({ projectId: id }),

  setFolderPath: (path) => set({ folderPath: path }),

  setScanResult: (result) => set({ scanResult: result }),

  setIsScanning: (scanning) => set({ isScanning: scanning }),

  addScanLog: (log) =>
    set((state) => ({
      scanLogs: [
        ...state.scanLogs,
        {
          ...log,
          id: `${log.timestamp}-${state.scanLogs.length}`,
        },
      ],
    })),

  clearScanLogs: () => set({ scanLogs: [] }),

  toggleLogExpanded: () =>
    set((state) => ({ isLogExpanded: !state.isLogExpanded })),

  toggleAutoScrollLog: () =>
    set((state) => ({ autoScrollLog: !state.autoScrollLog })),

  setPeriods: (periods) => set({ periods }),

  setIsGeneratingPeriods: (generating) => set({ isGeneratingPeriods: generating }),

  reset: () =>
    set({
      currentStep: 1,
      selectedBaby: null,
      projectName: '',
      projectDescription: '',
      periodDays: 7,
      includeSpecialDates: false,
      projectId: null,
      folderPath: null,
      scanResult: null,
      isScanning: false,
      scanLogs: [],
      isLogExpanded: false,
      autoScrollLog: true,
      periods: [],
      isGeneratingPeriods: false,
    }),
}));
