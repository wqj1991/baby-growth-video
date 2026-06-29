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
    <div className="w-64 flex-shrink-0 glass-strong border-r border-white/40 py-8 px-5 flex flex-col">
      {/* 顶部标题 */}
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-warmth-400 mb-1">创建流程</p>
        <div className="h-px bg-gradient-to-r from-warmth-300/50 via-warmth-300/20 to-transparent" />
      </div>

      {/* 步骤列表 */}
      <div className="flex-1 space-y-0">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <div key={step.number} className="relative">
              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div className="absolute left-[27px] top-[52px] w-px h-[calc(100%+4px)]">
                  <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      background: isCompleted
                        ? 'linear-gradient(180deg, #f58b3d 0%, #e06a1e 50%, #f58b3d 100%)'
                        : 'linear-gradient(180deg, #e8e6de 0%, #e8e6de 100%)',
                    }}
                  />
                  {isCurrent && (
                    <div
                      className="absolute inset-0 transition-all duration-700"
                      style={{
                        background: 'linear-gradient(180deg, #f58b3d 0%, #e06a1e 50%, #e8e6de 100%)',
                      }}
                    />
                  )}
                </div>
              )}

              {/* 步骤按钮 */}
              <button
                onClick={() => isClickable && onStepClick(step.number)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-300 group ${
                  isCurrent
                    ? 'bg-white/80 shadow-md shadow-warmth-200/20'
                    : isCompleted
                    ? 'hover:bg-white/40 cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                {/* 步骤圆圈 */}
                <div
                  className={`relative w-[54px] h-[54px] rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isCurrent
                      ? 'bg-gradient-to-br from-warmth-400 to-warmth-500 text-white shadow-lg shadow-warmth-400/25 scale-105'
                      : isCompleted
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-md shadow-emerald-400/20'
                      : 'bg-stone-100 text-stone-400'
                  } ${
                    isClickable ? 'group-hover:scale-105 group-hover:shadow-lg' : ''
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <span className="text-lg font-bold tracking-tight">{step.number}</span>
                  ) : (
                    <span className="text-base font-semibold">{step.number}</span>
                  )}
                </div>

                {/* 步骤文字 */}
                <div className="text-left">
                  <p
                    className={`text-sm font-semibold transition-colors duration-300 ${
                      isCurrent
                        ? 'text-warmth-600'
                        : isCompleted
                        ? 'text-stone-700'
                        : 'text-stone-400'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p
                    className={`text-xs mt-0.5 transition-colors duration-300 ${
                      isCurrent
                        ? 'text-warmth-400 font-medium'
                        : isCompleted
                        ? 'text-stone-400'
                        : 'text-stone-300'
                    }`}
                  >
                    {isCompleted ? '已完成' : isCurrent ? '进行中' : `步骤 ${step.number}`}
                  </p>
                </div>

                {/* 当前步骤指示点 */}
                {isCurrent && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-warmth-400 animate-pulse shadow-sm shadow-warmth-400/50" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 底部进度 */}
      <div className="mt-auto pt-6 px-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-stone-500">整体进度</span>
          <span className="text-xs font-bold text-warmth-500">
            {Math.round((steps.filter(s => s.number <= currentStep).length / steps.length) * 100)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-200/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-warmth-400 to-warmth-500 transition-all duration-700 ease-out"
            style={{
              width: `${(steps.filter(s => s.number <= currentStep).length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
