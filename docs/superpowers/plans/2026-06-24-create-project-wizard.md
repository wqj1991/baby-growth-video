# 创建项目向导实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 为宝宝成长视频制作工具添加完整的 5 步创建项目向导流程，包含左侧步骤导航、照片扫描、周期生成和项目概览页。

**架构:** 采用独立页面 + Zustand 状态管理的架构。向导页面包含左侧步骤栏和右侧内容区，每个步骤为独立组件，通过 createProjectStore 共享状态。项目概览页作为项目详情页的默认子路由。

**技术栈:** React 18 + TypeScript + Zustand + React Router v6 + Tailwind CSS + Tauri

## 全局约束

- 遵循现有代码风格和目录结构
- 使用 TypeScript 严格类型
- 所有新组件使用函数式组件 + Hooks
- 样式使用 Tailwind CSS，遵循现有 className 命名规范
- 状态管理使用 Zustand，遵循现有 store 模式
- 路由使用 React Router v6，遵循现有路由结构
- 与 Tauri 后端交互通过 `src/utils/tauriCommands.ts` 封装

---

## 文件结构映射

### 新增文件
| 文件路径 | 职责 |
|---------|------|
| `src/store/createProjectStore.ts` | 向导状态管理 store |
| `src/components/WizardSidebar.tsx` | 左侧步骤导航组件 |
| `src/pages/CreateProjectPage.tsx` | 向导主页面 |
| `src/pages/create-project/Step1SelectBaby.tsx` | 步骤1：选择宝宝 |
| `src/pages/create-project/Step2ProjectInfo.tsx` | 步骤2：项目信息 |
| `src/pages/create-project/Step3SelectFolder.tsx` | 步骤3：选择文件夹 |
| `src/pages/create-project/Step4GeneratePeriods.tsx` | 步骤4：生成周期 |
| `src/pages/create-project/Step5Complete.tsx` | 步骤5：完成 |
| `src/pages/ProjectOverviewPage.tsx` | 项目概览页 |

### 修改文件
| 文件路径 | 修改内容 |
|---------|---------|
| `src/App.tsx` | 添加新路由 |
| `src/pages/ProjectPage.tsx` | 添加 overview 子路由，设为默认 |
| `src/pages/HomePage.tsx` | 新建项目按钮跳转到向导页 |
| `src/utils/tauriCommands.ts` | 确保所有需要的命令都已封装 |
| `src/types/index.ts` | 添加向导相关类型定义 |

---

## 任务列表

### Task 1: 类型定义与 Store 基础

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/store/createProjectStore.ts`

**Interfaces:**
- Produces: `CreateProjectState` interface, `useCreateProjectStore` hook

- [ ] **Step 1: 在 types/index.ts 中添加向导相关类型**

在现有类型文件末尾添加：

```typescript
// 向导步骤类型
export type WizardStep = 1 | 2 | 3 | 4 | 5;

// 扫描结果类型（如已存在则跳过）
export interface ScanResult {
  total_photos: number;
  total_videos: number;
  recognized_photos: number;
  unrecognized_photos: number;
  duplicate_photos: number;
}

// 项目信息
export interface ProjectInfo {
  name: string;
  description: string;
  periodDays: number;
  includeSpecialDates: boolean;
}
```

- [ ] **Step 2: 验证类型文件可正常编译**

Run: `npx tsc --noEmit src/types/index.ts`
Expected: 无类型错误

- [ ] **Step 3: 创建 createProjectStore.ts**

创建 `src/store/createProjectStore.ts`：

```typescript
import { create } from 'zustand';
import type { WizardStep, ScanResult, Period, Baby } from '../types';

interface CreateProjectState {
  // 当前步骤
  currentStep: WizardStep;
  
  // 步骤1：宝宝
  selectedBaby: Baby | null;
  
  // 步骤2：项目信息
  projectName: string;
  projectDescription: string;
  periodDays: number;
  includeSpecialDates: boolean;
  
  // 步骤3：文件夹
  folderPath: string | null;
  scanResult: ScanResult | null;
  isScanning: boolean;
  
  // 步骤4：周期
  periods: Period[];
  isGeneratingPeriods: boolean;
  
  // Actions
  setCurrentStep: (step: WizardStep) => void;
  setSelectedBaby: (baby: Baby) => void;
  setProjectInfo: (info: { name: string; description: string; periodDays: number; includeSpecialDates: boolean }) => void;
  setFolderPath: (path: string) => void;
  setScanResult: (result: ScanResult) => void;
  setIsScanning: (scanning: boolean) => void;
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
  folderPath: null,
  scanResult: null,
  isScanning: false,
  periods: [],
  isGeneratingPeriods: false,
  
  setCurrentStep: (step) => set({ currentStep: step }),
  setSelectedBaby: (baby) => set({ selectedBaby: baby }),
  setProjectInfo: (info) => set({
    projectName: info.name,
    projectDescription: info.description,
    periodDays: info.periodDays,
    includeSpecialDates: info.includeSpecialDates,
  }),
  setFolderPath: (path) => set({ folderPath: path }),
  setScanResult: (result) => set({ scanResult: result }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),
  setPeriods: (periods) => set({ periods }),
  setIsGeneratingPeriods: (generating) => set({ isGeneratingPeriods: generating }),
  reset: () => set({
    currentStep: 1,
    selectedBaby: null,
    projectName: '',
    projectDescription: '',
    periodDays: 7,
    includeSpecialDates: false,
    folderPath: null,
    scanResult: null,
    isScanning: false,
    periods: [],
    isGeneratingPeriods: false,
  }),
}));
```

- [ ] **Step 4: 验证 store 可正常编译**

Run: `npx tsc --noEmit src/store/createProjectStore.ts`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/store/createProjectStore.ts
git commit -m "feat: 添加创建项目向导的类型定义和状态 store"
```

---

### Task 2: WizardSidebar 步骤导航组件

**Files:**
- Create: `src/components/WizardSidebar.tsx`

**Interfaces:**
- Consumes: 步骤列表、当前步骤、已完成步骤
- Produces: `WizardSidebar` React 组件

- [ ] **Step 1: 创建 WizardSidebar 组件**

创建 `src/components/WizardSidebar.tsx`：

```typescript
import { Check } from 'lucide-react';

interface Step {
  number: number;
  title: string;
}

interface WizardSidebarProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
}

export default function WizardSidebar({ steps, currentStep, onStepClick }: WizardSidebarProps) {
  return (
    <div className="w-56 bg-gray-50 border-r border-gray-200 py-6 px-4">
      <div className="space-y-1">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isClickable = isCompleted && onStepClick;
          
          return (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div
                  className={`absolute left-5 top-10 w-0.5 h-8 ${
                    isCompleted ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                />
              )}
              
              <button
                onClick={() => isClickable && onStepClick(step.number)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-primary-50 text-primary-600'
                    : isCompleted
                    ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                    : 'text-gray-400 cursor-default'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                    isCurrent
                      ? 'bg-primary-500 text-white'
                      : isCompleted
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  isCurrent ? 'text-primary-700' : ''
                }`}>
                  {step.title}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证组件可正常编译**

Run: `npx tsc --noEmit src/components/WizardSidebar.tsx`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/WizardSidebar.tsx
git commit -m "feat: 添加向导左侧步骤导航组件"
```

---

### Task 3: CreateProjectPage 主页面框架

**Files:**
- Create: `src/pages/CreateProjectPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `WizardSidebar` 组件, `useCreateProjectStore`
- Produces: 向导主页面框架 + 路由配置

- [ ] **Step 1: 创建 create-project 目录和占位步骤组件**

```bash
mkdir -p src/pages/create-project
```

创建 5 个简单的占位步骤组件（后续任务会完善）：

`src/pages/create-project/Step1SelectBaby.tsx`:
```typescript
export default function Step1SelectBaby() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">选择宝宝</h2>
      <p className="text-gray-500">步骤1内容</p>
    </div>
  );
}
```

`src/pages/create-project/Step2ProjectInfo.tsx`:
```typescript
export default function Step2ProjectInfo() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">项目信息</h2>
      <p className="text-gray-500">步骤2内容</p>
    </div>
  );
}
```

`src/pages/create-project/Step3SelectFolder.tsx`:
```typescript
export default function Step3SelectFolder() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">选择照片文件夹</h2>
      <p className="text-gray-500">步骤3内容</p>
    </div>
  );
}
```

`src/pages/create-project/Step4GeneratePeriods.tsx`:
```typescript
export default function Step4GeneratePeriods() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">生成周期</h2>
      <p className="text-gray-500">步骤4内容</p>
    </div>
  );
}
```

`src/pages/create-project/Step5Complete.tsx`:
```typescript
export default function Step5Complete() {
  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">完成</h2>
      <p className="text-gray-500">步骤5内容</p>
    </div>
  );
}
```

- [ ] **Step 2: 创建 CreateProjectPage 主页面**

创建 `src/pages/CreateProjectPage.tsx`：

```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import WizardSidebar from '../components/WizardSidebar';
import { useCreateProjectStore } from '../store/createProjectStore';
import Step1SelectBaby from './create-project/Step1SelectBaby';
import Step2ProjectInfo from './create-project/Step2ProjectInfo';
import Step3SelectFolder from './create-project/Step3SelectFolder';
import Step4GeneratePeriods from './create-project/Step4GeneratePeriods';
import Step5Complete from './create-project/Step5Complete';

const steps = [
  { number: 1, title: '选择宝宝' },
  { number: 2, title: '项目信息' },
  { number: 3, title: '选择照片' },
  { number: 4, title: '生成周期' },
  { number: 5, title: '完成' },
];

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { currentStep, setCurrentStep, reset } = useCreateProjectStore();

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handleCancel = () => {
    if (confirm('确定要取消创建吗？已填写的信息将会丢失。')) {
      reset();
      navigate('/');
    }
  };

  const handleStepClick = (stepNumber: number) => {
    if (stepNumber < currentStep) {
      setCurrentStep(stepNumber as 1 | 2 | 3 | 4 | 5);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1SelectBaby />;
      case 2:
        return <Step2ProjectInfo />;
      case 3:
        return <Step3SelectFolder />;
      case 4:
        return <Step4GeneratePeriods />;
      case 5:
        return <Step5Complete />;
      default:
        return null;
    }
  };

  const canGoNext = currentStep < 5;
  const canGoPrev = currentStep > 1;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">新建成长视频项目</h1>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧步骤栏 */}
        <WizardSidebar
          steps={steps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {renderStepContent()}
          </div>

          {/* 底部操作栏 */}
          {currentStep < 5 && (
            <div className="flex items-center justify-between px-8 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handlePrev}
                disabled={!canGoPrev}
                className={`btn ${canGoPrev ? 'btn-secondary' : 'btn-disabled'}`}
              >
                上一步
              </button>
              <button
                onClick={handleNext}
                disabled={!canGoNext}
                className={`btn ${canGoNext ? 'btn-primary' : 'btn-disabled'}`}
              >
                {currentStep === 4 ? '创建项目' : '下一步'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 App.tsx 中添加路由**

修改 `src/App.tsx`，在路由中添加：

```tsx
<Route path="/create-project" element={<CreateProjectPage />} />
```

确保导入 CreateProjectPage 组件。

- [ ] **Step 4: 验证页面可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/pages/CreateProjectPage.tsx src/pages/create-project/ src/App.tsx
git commit -m "feat: 添加创建项目向导主页面框架"
```

---

### Task 4: 步骤1 - 选择宝宝

**Files:**
- Modify: `src/pages/create-project/Step1SelectBaby.tsx`
- Modify: `src/utils/tauriCommands.ts` (如需要)

**Interfaces:**
- Consumes: `useCreateProjectStore`, `getBabies` 命令
- Produces: 完整的步骤1选择宝宝功能

- [ ] **Step 1: 完善 Step1SelectBaby 组件**

替换 `src/pages/create-project/Step1SelectBaby.tsx` 内容：

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Plus } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { getBabies } from '../../utils/tauriCommands';
import type { Baby as BabyType } from '../../types';

export default function Step1SelectBaby() {
  const navigate = useNavigate();
  const { selectedBaby, setSelectedBaby } = useCreateProjectStore();
  const [babies, setBabies] = useState<BabyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBabies();
  }, []);

  const loadBabies = async () => {
    try {
      const data = await getBabies();
      setBabies(data);
      if (data.length === 1 && !selectedBaby) {
        setSelectedBaby(data[0]);
      }
    } catch (error) {
      console.error('加载宝宝列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBaby = (baby: BabyType) => {
    setSelectedBaby(baby);
  };

  const handleAddBaby = () => {
    navigate('/baby-setup');
  };

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-2">选择宝宝</h2>
        <p className="text-gray-500 mb-6">选择要为哪个宝宝创建成长视频</p>
        <div className="text-center py-12 text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-2">选择宝宝</h2>
      <p className="text-gray-500 mb-6">选择要为哪个宝宝创建成长视频</p>

      {babies.length === 0 ? (
        <div className="text-center py-12">
          <Baby className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">还没有添加宝宝信息</p>
          <button onClick={handleAddBaby} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            添加宝宝
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {babies.map((baby) => (
            <div
              key={baby.id}
              onClick={() => handleSelectBaby(baby)}
              className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
                selectedBaby?.id === baby.id
                  ? 'bg-primary-50 border-primary-300'
                  : 'bg-gray-50 border-transparent hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  baby.gender === 'boy' ? 'bg-blue-100' : baby.gender === 'girl' ? 'bg-pink-100' : 'bg-gray-100'
                }`}>
                  <Baby className={`w-6 h-6 ${
                    baby.gender === 'boy' ? 'text-blue-600' : baby.gender === 'girl' ? 'text-pink-600' : 'text-gray-600'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{baby.name}</p>
                  <p className="text-sm text-gray-500">{baby.birth_date} 出生</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {babies.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleAddBaby}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            添加新宝宝
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 在 CreateProjectPage 中添加步骤验证**

修改 `CreateProjectPage.tsx`，为下一步按钮添加验证逻辑：

```typescript
const canGoNext = () => {
  switch (currentStep) {
    case 1:
      return !!selectedBaby;
    // 其他步骤后续添加
    default:
      return currentStep < 5;
  }
};
```

并将 `canGoNext` 从变量改为函数调用。

- [ ] **Step 3: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/pages/create-project/Step1SelectBaby.tsx src/pages/CreateProjectPage.tsx
git commit -m "feat: 完成向导步骤1 - 选择宝宝"
```

---

### Task 5: 步骤2 - 项目信息

**Files:**
- Modify: `src/pages/create-project/Step2ProjectInfo.tsx`
- Modify: `src/pages/CreateProjectPage.tsx`

**Interfaces:**
- Consumes: `useCreateProjectStore`
- Produces: 完整的步骤2项目信息表单

- [ ] **Step 1: 完善 Step2ProjectInfo 组件**

替换 `src/pages/create-project/Step2ProjectInfo.tsx` 内容：

```typescript
import { useEffect, useState } from 'react';
import { useCreateProjectStore } from '../../store/createProjectStore';

const periodPresets = [
  { label: '每周', days: 7 },
  { label: '每半月', days: 15 },
  { label: '每月', days: 30 },
  { label: '百天', days: 100 },
];

export default function Step2ProjectInfo() {
  const {
    selectedBaby,
    projectName,
    projectDescription,
    periodDays,
    includeSpecialDates,
    setProjectInfo,
  } = useCreateProjectStore();

  const [localName, setLocalName] = useState(projectName);
  const [localDesc, setLocalDesc] = useState(projectDescription);
  const [localPeriodDays, setLocalPeriodDays] = useState(periodDays);
  const [localIncludeSpecial, setLocalIncludeSpecial] = useState(includeSpecialDates);

  useEffect(() => {
    if (!localName && selectedBaby) {
      const defaultName = `${selectedBaby.name}成长视频`;
      setLocalName(defaultName);
      updateStore(defaultName, localDesc, localPeriodDays, localIncludeSpecial);
    }
  }, [selectedBaby]);

  const updateStore = (name: string, desc: string, days: number, special: boolean) => {
    setProjectInfo({
      name,
      description: desc,
      periodDays: days,
      includeSpecialDates: special,
    });
  };

  const handleNameChange = (value: string) => {
    setLocalName(value);
    updateStore(value, localDesc, localPeriodDays, localIncludeSpecial);
  };

  const handleDescChange = (value: string) => {
    setLocalDesc(value);
    updateStore(localName, value, localPeriodDays, localIncludeSpecial);
  };

  const handlePeriodDaysChange = (value: number) => {
    setLocalPeriodDays(value);
    updateStore(localName, localDesc, value, localIncludeSpecial);
  };

  const handleSpecialChange = (checked: boolean) => {
    setLocalIncludeSpecial(checked);
    updateStore(localName, localDesc, localPeriodDays, checked);
  };

  const isValid = localName.trim().length > 0 && localPeriodDays >= 1 && localPeriodDays <= 365;

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">项目信息</h2>
      <p className="text-gray-500 mb-6">设置视频项目的基本信息</p>

      <div className="space-y-6">
        {/* 项目名称 */}
        <div className="form-group">
          <label className="form-label">项目名称 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={localName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="请输入项目名称"
            className="input"
            maxLength={50}
          />
          <p className="text-xs text-gray-400 mt-1">{localName.length}/50</p>
        </div>

        {/* 项目描述 */}
        <div className="form-group">
          <label className="form-label">项目描述</label>
          <textarea
            value={localDesc}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder="简单介绍一下这个视频..."
            className="input min-h-[100px] resize-none"
            maxLength={200}
          />
          <p className="text-xs text-gray-400 mt-1">{localDesc.length}/200</p>
        </div>

        {/* 周期天数 */}
        <div className="form-group">
          <label className="form-label">周期天数 <span className="text-red-500">*</span></label>
          <div className="flex gap-2 mb-3">
            {periodPresets.map((preset) => (
              <button
                key={preset.days}
                onClick={() => handlePeriodDaysChange(preset.days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  localPeriodDays === preset.days
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={localPeriodDays}
              onChange={(e) => handlePeriodDaysChange(parseInt(e.target.value) || 1)}
              className="input w-24"
              min={1}
              max={365}
            />
            <span className="text-gray-500">天</span>
          </div>
        </div>

        {/* 特殊日期 */}
        <div className="form-group">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localIncludeSpecial}
              onChange={(e) => handleSpecialChange(e.target.checked)}
              className="w-5 h-5 rounded text-primary-500"
            />
            <div>
              <span className="font-medium text-gray-900">包含特殊日期</span>
              <p className="text-sm text-gray-500">自动添加满月、百天、半岁、一岁等特殊周期</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 CreateProjectPage 的验证逻辑**

在 `CreateProjectPage.tsx` 的 `canGoNext` 函数中添加步骤2验证：

```typescript
case 2:
  return projectName.trim().length > 0 && periodDays >= 1 && periodDays <= 365;
```

- [ ] **Step 3: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/pages/create-project/Step2ProjectInfo.tsx src/pages/CreateProjectPage.tsx
git commit -m "feat: 完成向导步骤2 - 项目信息"
```

---

### Task 6: 步骤3 - 选择照片文件夹

**Files:**
- Modify: `src/pages/create-project/Step3SelectFolder.tsx`
- Modify: `src/pages/CreateProjectPage.tsx`
- Modify: `src/utils/tauriCommands.ts` (如需要)

**Interfaces:**
- Consumes: `useCreateProjectStore`, `scan_media_folder` 命令
- Produces: 完整的步骤3文件夹选择和扫描功能

- [ ] **Step 1: 完善 Step3SelectFolder 组件**

替换 `src/pages/create-project/Step3SelectFolder.tsx` 内容：

```typescript
import { useState } from 'react';
import { Folder, Image, Film, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { scanMediaFolder, selectFolder } from '../../utils/tauriCommands';
import type { ScanResult } from '../../types';

export default function Step3SelectFolder() {
  const {
    folderPath,
    scanResult,
    isScanning,
    setFolderPath,
    setScanResult,
    setIsScanning,
  } = useCreateProjectStore();

  const [scanProgress, setScanProgress] = useState(0);

  const handleSelectFolder = async () => {
    try {
      const path = await selectFolder();
      if (path) {
        setFolderPath(path);
        setScanResult(null);
      }
    } catch (error) {
      console.error('选择文件夹失败:', error);
    }
  };

  const handleScan = async () => {
    if (!folderPath) return;

    setIsScanning(true);
    setScanProgress(0);

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const result: ScanResult = await scanMediaFolder(0, folderPath); // projectId 临时用0
      
      clearInterval(progressInterval);
      setScanProgress(100);
      setScanResult(result);
    } catch (error) {
      console.error('扫描失败:', error);
      alert('扫描文件夹失败，请重试');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescan = () => {
    setScanResult(null);
    setScanProgress(0);
    handleScan();
  };

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">选择照片文件夹</h2>
      <p className="text-gray-500 mb-6">选择宝宝照片所在的文件夹，系统会自动扫描并按日期分类</p>

      {/* 选择文件夹 */}
      <div className="mb-6">
        <label className="form-label">照片文件夹</label>
        <div className="flex gap-3">
          <div className="flex-1 input flex items-center gap-2 overflow-hidden">
            <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className="truncate text-gray-700">
              {folderPath || '未选择文件夹'}
            </span>
          </div>
          <button onClick={handleSelectFolder} className="btn btn-secondary">
            选择文件夹
          </button>
        </div>
      </div>

      {/* 扫描按钮 */}
      {folderPath && !scanResult && (
        <div className="mb-6">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className={`btn btn-primary w-full ${isScanning ? 'opacity-75' : ''}`}
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                扫描中...
              </>
            ) : (
              '开始扫描'
            )}
          </button>

          {isScanning && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                正在扫描照片... {scanProgress}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* 扫描结果 */}
      {scanResult && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              扫描完成
            </h3>
            <button
              onClick={handleRescan}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              重新扫描
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Image className="w-4 h-4" />
                <span className="text-sm">照片总数</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{scanResult.total_photos}</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Film className="w-4 h-4" />
                <span className="text-sm">视频总数</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{scanResult.total_videos}</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">已识别日期</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{scanResult.recognized_photos}</p>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">未识别/重复</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {scanResult.unrecognized_photos + scanResult.duplicate_photos}
              </p>
            </div>
          </div>

          {scanResult.total_photos === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                ⚠️ 未找到任何照片，你可以继续创建项目，后续再添加照片
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 确保 tauriCommands 中有 selectFolder 和 scanMediaFolder**

检查 `src/utils/tauriCommands.ts`，如果缺少则添加：

```typescript
export async function selectFolder(): Promise<string> {
  // 使用 Tauri dialog 插件选择文件夹
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    directory: true,
    multiple: false,
  });
  return selected as string;
}

export async function scanMediaFolder(projectId: number, folderPath: string) {
  return invoke('scan_media_folder', { projectId, folderPath });
}
```

- [ ] **Step 3: 更新 CreateProjectPage 的验证逻辑**

在 `canGoNext` 中添加步骤3验证：

```typescript
case 3:
  return !!scanResult;
```

- [ ] **Step 4: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/pages/create-project/Step3SelectFolder.tsx src/pages/CreateProjectPage.tsx src/utils/tauriCommands.ts
git commit -m "feat: 完成向导步骤3 - 选择照片文件夹并扫描"
```

---

### Task 7: 步骤4 - 生成周期

**Files:**
- Modify: `src/pages/create-project/Step4GeneratePeriods.tsx`
- Modify: `src/pages/CreateProjectPage.tsx`

**Interfaces:**
- Consumes: `useCreateProjectStore`, `generate_periods` 命令
- Produces: 完整的步骤4周期生成和预览功能

- [ ] **Step 1: 完善 Step4GeneratePeriods 组件**

替换 `src/pages/create-project/Step4GeneratePeriods.tsx` 内容：

```typescript
import { useState } from 'react';
import { Calendar, RefreshCw, Star, CheckCircle } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { generatePeriods } from '../../utils/tauriCommands';
import type { Period } from '../../types';

const specialPeriodNames = ['满月', '百天', '半岁', '一岁'];

export default function Step4GeneratePeriods() {
  const {
    selectedBaby,
    periodDays,
    includeSpecialDates,
    periods,
    isGeneratingPeriods,
    setPeriods,
    setIsGeneratingPeriods,
  } = useCreateProjectStore();

  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!selectedBaby) return;

    setIsGeneratingPeriods(true);
    try {
      const result: Period[] = await generatePeriods(
        0, // projectId 临时用0
        selectedBaby.birth_date,
        periodDays
      );
      setPeriods(result);
    } catch (error) {
      console.error('生成周期失败:', error);
      alert('生成周期失败，请重试');
    } finally {
      setIsGeneratingPeriods(false);
    }
  };

  const isSpecialPeriod = (period: Period) => {
    return specialPeriodNames.some(name => period.name?.includes(name));
  };

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">生成周期</h2>
      <p className="text-gray-500 mb-6">根据宝宝出生日期和周期设置，自动生成成长周期</p>

      {/* 设置摘要 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">周期设置</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">出生日期：</span>
            <span className="font-medium text-gray-900">{selectedBaby?.birth_date || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">周期：</span>
            <span className="font-medium text-gray-900">{periodDays} 天</span>
          </div>
          <div>
            <span className="text-gray-500">特殊日期：</span>
            <span className="font-medium text-gray-900">{includeSpecialDates ? '包含' : '不包含'}</span>
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      {periods.length === 0 && (
        <button
          onClick={handleGenerate}
          disabled={isGeneratingPeriods || !selectedBaby}
          className={`btn btn-primary w-full ${isGeneratingPeriods ? 'opacity-75' : ''}`}
        >
          {isGeneratingPeriods ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              生成周期
            </>
          )}
        </button>
      )}

      {/* 周期列表 */}
      {periods.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                周期生成完成
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                共生成 {periods.length} 个周期
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGeneratingPeriods}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isGeneratingPeriods ? 'animate-spin' : ''}`} />
              重新生成
            </button>
          </div>

          {/* 周期概览（折叠/展开） */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-gray-700">
                查看周期列表 ({periods.length} 个)
              </span>
              <span className="text-gray-400">{expanded ? '收起' : '展开'}</span>
            </button>

            {expanded && (
              <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
                {periods.map((period, index) => {
                  const isSpecial = isSpecialPeriod(period);
                  return (
                    <div
                      key={period.id || index}
                      className={`px-4 py-3 border-b border-gray-100 last:border-b-0 flex items-center justify-between ${
                        isSpecial ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {period.name || `第${index + 1}周期`}
                        </span>
                        {isSpecial && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            特殊
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {period.start_date} ~ {period.end_date}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 确保 tauriCommands 中有 generatePeriods**

检查并添加：

```typescript
export async function generatePeriods(projectId: number, birthDate: string, periodDays: number) {
  return invoke('generate_periods', { projectId, birthDate, periodDays });
}
```

- [ ] **Step 3: 更新 CreateProjectPage 的验证逻辑**

在 `canGoNext` 中添加步骤4验证：

```typescript
case 4:
  return periods.length > 0;
```

- [ ] **Step 4: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/pages/create-project/Step4GeneratePeriods.tsx src/pages/CreateProjectPage.tsx src/utils/tauriCommands.ts
git commit -m "feat: 完成向导步骤4 - 生成周期"
```

---

### Task 8: 步骤5 - 完成 & 创建项目

**Files:**
- Modify: `src/pages/create-project/Step5Complete.tsx`
- Modify: `src/pages/CreateProjectPage.tsx`

**Interfaces:**
- Consumes: `useCreateProjectStore`, `create_project` 命令
- Produces: 完成页面和实际创建项目逻辑

- [ ] **Step 1: 完善 Step5Complete 组件**

替换 `src/pages/create-project/Step5Complete.tsx` 内容：

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Baby, Calendar, Image, ArrowRight, Play } from 'lucide-react';
import { useCreateProjectStore } from '../../store/createProjectStore';
import { useAppStore } from '../../store';
import { createProject } from '../../utils/tauriCommands';
import type { Project } from '../../types';

export default function Step5Complete() {
  const navigate = useNavigate();
  const {
    selectedBaby,
    projectName,
    projectDescription,
    periodDays,
    folderPath,
    scanResult,
    periods,
    reset,
  } = useCreateProjectStore();
  const { setCurrentProject, setCurrentBaby } = useAppStore();

  const [creating, setCreating] = useState(true);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createTheProject();
  }, []);

  const createTheProject = async () => {
    if (!selectedBaby) {
      setError('未选择宝宝');
      setCreating(false);
      return;
    }

    setCreating(true);
    try {
      const project: Project = await createProject({
        baby_id: selectedBaby.id,
        name: projectName,
        description: projectDescription,
        period_days: periodDays,
      });

      setCreatedProject(project);
      setCurrentProject(project);
      setCurrentBaby(selectedBaby);
    } catch (err) {
      console.error('创建项目失败:', err);
      setError('创建项目失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleGoToOverview = () => {
    if (createdProject) {
      reset();
      navigate(`/project/${createdProject.id}/overview`);
    }
  };

  const handleGoToPeriods = () => {
    if (createdProject) {
      reset();
      navigate(`/project/${createdProject.id}/periods`);
    }
  };

  const handleRetry = () => {
    setError(null);
    createTheProject();
  };

  if (creating) {
    return (
      <div className="p-8 text-center">
        <div className="py-16">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Calendar className="w-8 h-8 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">正在创建项目...</h2>
          <p className="text-gray-500">请稍候，正在为您创建成长视频项目</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="py-16">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">创建失败</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={handleRetry} className="btn btn-primary">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">项目创建成功！</h2>
        <p className="text-gray-500">你的成长视频项目已经准备好了</p>
      </div>

      {/* 项目信息摘要 */}
      <div className="max-w-md mx-auto bg-gray-50 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">项目信息</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Baby className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">宝宝：</span>
            <span className="font-medium text-gray-900">{selectedBaby?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">项目：</span>
            <span className="font-medium text-gray-900">{projectName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Image className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">周期：</span>
            <span className="font-medium text-gray-900">{periods.length} 个周期</span>
          </div>
          {scanResult && (
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">照片：</span>
              <span className="font-medium text-gray-900">{scanResult.total_photos} 张</span>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="max-w-md mx-auto space-y-3">
        <button
          onClick={handleGoToOverview}
          className="btn btn-primary w-full"
        >
          查看项目概览
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleGoToPeriods}
          className="btn btn-secondary w-full"
        >
          <Play className="w-4 h-4" />
          立即开始选照片
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 确保 tauriCommands 中有 createProject**

检查并添加：

```typescript
export async function createProject(project: any) {
  return invoke('create_project', { project });
}
```

- [ ] **Step 3: 更新 CreateProjectPage，步骤5隐藏底部按钮**

因为步骤5有自己的操作按钮，所以确保在步骤5时隐藏底部的上一步/下一步按钮。

- [ ] **Step 4: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/pages/create-project/Step5Complete.tsx src/pages/CreateProjectPage.tsx src/utils/tauriCommands.ts
git commit -m "feat: 完成向导步骤5 - 创建项目和完成页"
```

---

### Task 9: 项目概览页

**Files:**
- Create: `src/pages/ProjectOverviewPage.tsx`
- Modify: `src/pages/ProjectPage.tsx`

**Interfaces:**
- Consumes: `useAppStore`, 项目和周期数据
- Produces: 完整的项目概览页面

- [ ] **Step 1: 创建 ProjectOverviewPage 组件**

创建 `src/pages/ProjectOverviewPage.tsx`：

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, Calendar, Image, Clock, Play, Video, History, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';
import { getPeriods } from '../utils/tauriCommands';
import type { Period } from '../types';

export default function ProjectOverviewPage() {
  const navigate = useNavigate();
  const { currentProject, currentBaby } = useAppStore();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentProject) {
      loadPeriods();
    }
  }, [currentProject]);

  const loadPeriods = async () => {
    if (!currentProject) return;
    try {
      const data = await getPeriods(currentProject.id);
      setPeriods(data);
    } catch (error) {
      console.error('加载周期失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = periods.filter(p => p.selected_photo_id).length;
  const totalCount = periods.length;
  const progressPercent = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;
  const remainingCount = totalCount - selectedCount;

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12 text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* 基础信息卡片 */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">{currentProject?.name}</h1>
            <p className="text-primary-100">{currentProject?.description || '暂无描述'}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-1.5">
            <Baby className="w-4 h-4" />
            <span className="text-sm font-medium">{currentBaby?.name}</span>
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 opacity-80" />
            <span>周期：{currentProject?.period_days}天</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 opacity-80" />
            <span>创建于 {currentProject?.created_at}</span>
          </div>
        </div>
      </div>

      {/* 数据统计卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <div className="w-5 h-5 text-blue-600">📊</div>
              </div>
              <span className="text-gray-600">完成进度</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{progressPercent}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Image className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-gray-600">已选照片</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {selectedCount}
              <span className="text-lg font-normal text-gray-400"> / {totalCount}</span>
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-gray-600">剩余周期</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{remainingCount}</p>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="text-lg font-semibold">快捷操作</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => navigate('periods')}
              className="p-4 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Image className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">开始选照片</h3>
              <p className="text-sm text-gray-500 mt-1">为每个周期选择代表照片</p>
            </button>

            <button
              onClick={() => navigate('generate')}
              className="p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-lg bg-green-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">生成视频</h3>
              <p className="text-sm text-gray-500 mt-1">配置并生成成长视频</p>
            </button>

            <button
              onClick={() => navigate('history')}
              className="p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors text-left group"
            >
              <div className="w-12 h-12 rounded-lg bg-purple-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <History className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">历史记录</h3>
              <p className="text-sm text-gray-500 mt-1">查看已生成的视频</p>
            </button>
          </div>
        </div>
      </div>

      {/* 周期概览 */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold">周期概览</h2>
          <button
            onClick={() => navigate('periods')}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            查看全部
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-6 gap-3">
            {periods.slice(0, 12).map((period, index) => {
              const isSelected = !!period.selected_photo_id;
              return (
                <div
                  key={period.id}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-center p-2 ${
                    isSelected
                      ? 'bg-green-50 border-2 border-green-200'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                    isSelected ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isSelected ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 truncate w-full">
                    {period.name || `第${index + 1}周`}
                  </span>
                </div>
              );
            })}
          </div>
          {periods.length > 12 && (
            <p className="text-center text-sm text-gray-400 mt-4">
              还有 {periods.length - 12} 个周期...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 ProjectPage 中添加 overview 子路由**

修改 `src/pages/ProjectPage.tsx`：

1. 在 navItems 中添加 overview 作为第一项
2. 设置默认重定向到 overview

```typescript
const navItems = [
  { path: 'overview', icon: LayoutDashboard, label: '项目概览' },
  { path: 'periods', icon: Calendar, label: '周期选择' },
  { path: 'generate', icon: Video, label: '生成视频' },
  { path: 'history', icon: History, label: '历史记录' },
];
```

并在 Outlet 附近添加默认重定向逻辑，或者在 App.tsx 路由配置中添加 Index 路由。

- [ ] **Step 3: 确保 tauriCommands 中有 getPeriods**

检查并添加：

```typescript
export async function getPeriods(projectId: number) {
  return invoke('get_periods', { projectId });
}
```

- [ ] **Step 4: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectOverviewPage.tsx src/pages/ProjectPage.tsx src/utils/tauriCommands.ts
git commit -m "feat: 添加项目概览页面"
```

---

### Task 10: 首页入口 & 路由完善

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: 现有首页组件
- Produces: 完整的导航入口和路由配置

- [ ] **Step 1: 完善首页的新建项目按钮**

修改 `src/pages/HomePage.tsx`：

1. "创建新项目"按钮添加点击事件，跳转到 `/create-project`
2. "新建项目"快捷卡片也添加跳转

```typescript
const handleCreateProject = () => {
  navigate('/create-project');
};
```

给所有"新建项目"相关的按钮和卡片绑定这个事件。

- [ ] **Step 2: 完善 App.tsx 路由配置**

确保路由配置完整：
- `/create-project` 路由
- `/project/:projectId/overview` 子路由
- `/project/:projectId` 默认重定向到 overview

- [ ] **Step 3: 验证可正常编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 启动开发环境测试**

Run: `npm run tauri:dev`
Expected: 应用正常启动，向导流程可正常点击

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx src/App.tsx
git commit -m "feat: 完善首页入口和路由配置"
```

---

## 自检清单

### Spec 覆盖检查
- ✅ 5步向导流程 - Task 1-8 覆盖
- ✅ 左侧步骤导航 - Task 2 覆盖
- ✅ 选择宝宝 - Task 4 覆盖
- ✅ 项目信息表单 - Task 5 覆盖
- ✅ 文件夹选择和扫描 - Task 6 覆盖
- ✅ 周期生成和预览 - Task 7 覆盖
- ✅ 完成页面 - Task 8 覆盖
- ✅ 项目概览页 - Task 9 覆盖
- ✅ 状态管理 - Task 1 覆盖
- ✅ 首页入口 - Task 10 覆盖

### 占位符检查
- 所有步骤都有具体的代码实现
- 没有 TBD / TODO 等占位符
- 每个任务都有明确的验证步骤

### 类型一致性检查
- Store 中的类型与组件使用一致
- 步骤编号统一使用 1-5
- 文件路径与实际项目结构一致

---

## 执行方式

计划完成并保存到 `docs/superpowers/plans/2026-06-24-create-project-wizard.md`。

**两个执行选项：**

**1. Subagent-Driven (推荐)** - 每个任务派发一个独立的 subagent，任务间有 review 环节，迭代更快

**2. Inline Execution** - 在当前会话中按顺序执行，有检查点用于 review

你想用哪种方式执行？
