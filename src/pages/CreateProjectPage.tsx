import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import WizardSidebar from '../components/WizardSidebar';
import ErrorBoundary from '../components/ErrorBoundary';
import { useCreateProjectStore } from '../store/createProjectStore';
import { createProject } from '../utils/tauriCommands';
import Step1SelectBaby from './create-project/Step1SelectBaby';
import Step2ProjectInfo from './create-project/Step2ProjectInfo';
import Step3GeneratePeriods from './create-project/Step3GeneratePeriods';
import Step4SelectFolder from './create-project/Step4SelectFolder';
import Step5Complete from './create-project/Step5Complete';

const steps = [
  { number: 1, title: '选择宝宝' },
  { number: 2, title: '项目信息' },
  { number: 3, title: '生成周期' },
  { number: 4, title: '选择照片' },
  { number: 5, title: '完成' },
];

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const {
    currentStep, setCurrentStep, reset, selectedBaby, projectName,
    periodDays, scanResult, periods, setProjectId, projectId } = useCreateProjectStore();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    console.log('CreateProjectPage 已加载，当前步骤:', currentStep);
    console.log('窗口尺寸:', window.innerWidth, 'x', window.innerHeight);
  }, []);

  const handleNext = async () => {
    if (currentStep === 2 && !projectId) {
      setIsCreating(true);
      try {
        if (!selectedBaby) return;
        const project = await createProject({
          baby_id: selectedBaby.id,
          name: projectName,
          description: '',
          period_days: periodDays,
          status: 'draft',
        });
        setProjectId(project.id);
        setCurrentStep(3);
      } catch (error) {
        console.error('创建项目失败:', error);
        alert('创建项目失败，请重试');
      } finally {
        setIsCreating(false);
      }
    } else if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  const handleCancel = () => {
    if (window.confirm('确定要取消创建吗？已填写的信息将会丢失。')) {
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
      case 1: return <Step1SelectBaby />;
      case 2: return <Step2ProjectInfo />;
      case 3: return <Step3GeneratePeriods />;
      case 4: return <Step4SelectFolder />;
      case 5: return <Step5Complete />;
      default: return null;
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1: return !!selectedBaby;
      case 2: return projectName.trim().length > 0 && periodDays >= 1 && periodDays <= 365;
      case 3: return periods.length > 0;
      case 4: return !!scanResult;
      default: return currentStep < 5;
    }
  };
  const canGoPrev = currentStep > 1;

  const currentStepTitle = steps.find(s => s.number === currentStep)?.title || '';

  return (
    <ErrorBoundary>
      <div className="w-full h-screen flex flex-col bg-stone-50/50">
        {/* === 顶部导航栏 === */}
        <div className="glass-strong flex items-center justify-between px-6 py-3.5 border-b border-white/40 flex-shrink-0 z-10">
          {/* 左侧：返回 + 标题 + 步骤指示 */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="p-2 -ml-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100/80 rounded-xl transition-all duration-200"
              title="取消创建"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="h-6 w-px bg-stone-200" />

            <div>
              <h1 className="text-base font-bold text-stone-800 tracking-tight">新建成长视频项目</h1>
              <p className="text-xs text-stone-400 -mt-0.5">步骤 {currentStep} — {currentStepTitle}</p>
            </div>
          </div>

          {/* 右侧：步骤进度指示器 + 关闭 */}
          <div className="flex items-center gap-5">
            {/* 迷你步骤条 */}
            <div className="hidden sm:flex items-center gap-1.5">
              {steps.map((s, i) => (
                <div key={s.number} className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      s.number < currentStep
                        ? 'bg-success shadow-sm shadow-success/30'
                        : s.number === currentStep
                        ? 'bg-warmth-400 w-3 h-3 shadow-sm shadow-warmth-300/40'
                        : 'bg-stone-300'
                    }`}
                  />
                  {i < steps.length - 1 && (
                    <div className="w-4 h-px mx-0.5 bg-stone-200" />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleCancel}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100/80 rounded-xl transition-all duration-200"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* === 主体内容区 === */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧步骤导航 */}
          <WizardSidebar
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />

          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-stone-50 via-white to-warmth-50/30">
            <div className="flex-1 overflow-auto">
              <ErrorBoundary>
                {renderStepContent()}
              </ErrorBoundary>
            </div>

            {/* === 底部操作栏 === */}
            {currentStep < 5 && (
              <div className="glass-strong flex items-center justify-between px-8 py-4 border-t border-white/40 flex-shrink-0">
                <button
                  onClick={handlePrev}
                  disabled={!canGoPrev}
                  className={`group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    canGoPrev
                      ? 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300 hover:text-stone-800 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0'
                      : 'text-stone-300 border border-stone-100 cursor-not-allowed'
                  }`}
                >
                  <span className="text-base leading-none transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
                  上一步
                </button>

                {/* 步骤进度文字 */}
                <div className="text-xs text-stone-400 font-medium">
                  {currentStep} / {steps.length - 1}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!canGoNext() || isCreating}
                  className={`group inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    canGoNext() && !isCreating
                      ? 'bg-gradient-to-r from-warmth-400 to-warmth-500 text-white shadow-lg shadow-warmth-400/25 hover:shadow-xl hover:shadow-warmth-400/35 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isCreating ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      创建中...
                    </>
                  ) : currentStep === 4 ? (
                    <>
                      创建项目
                      <span className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-0.5">✨</span>
                    </>
                  ) : (
                    <>
                      下一步
                      <span className="text-base leading-none transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
