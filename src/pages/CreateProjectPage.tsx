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
  const { currentStep, setCurrentStep, reset, selectedBaby } = useCreateProjectStore();

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

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return !!selectedBaby;
      // 其他步骤后续添加
      default:
        return currentStep < 5;
    }
  };
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
                className={`btn ${canGoPrev ? 'btn-secondary' : 'opacity-50 cursor-not-allowed'}`}
              >
                上一步
              </button>
              <button
                onClick={handleNext}
                disabled={!canGoNext()}
                className={`btn ${canGoNext() ? 'btn-primary' : 'opacity-50 cursor-not-allowed'}`}
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
