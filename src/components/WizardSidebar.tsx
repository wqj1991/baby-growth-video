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
