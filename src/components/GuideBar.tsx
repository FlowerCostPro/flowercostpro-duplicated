import React from 'react';
import { ArrowLeft, ArrowRight, Check, EyeOff } from 'lucide-react';
import { GUIDE_STEPS, TOTAL_GUIDE_STEPS } from '../lib/guideSteps';

interface GuideBarProps {
  step: number;
  justCompleted: boolean;
  onBack: () => void;
  onNext: () => void;
  onHide: () => void;
}

const GuideBar: React.FC<GuideBarProps> = ({ step, justCompleted, onBack, onNext, onHide }) => {
  const stepData = GUIDE_STEPS[step - 1];
  if (!stepData) return null;

  const isLast = step === TOTAL_GUIDE_STEPS;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-green-500 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
      <div className="mx-auto max-w-4xl px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          {justCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-green-700">
              <Check className="h-4 w-4 flex-shrink-0" />
              Step {step} done!
            </span>
          ) : (
            <p className="text-sm font-semibold text-gray-800 truncate">
              Step {step} of {TOTAL_GUIDE_STEPS}: {stepData.title}
            </p>
          )}
        </div>

        {!justCompleted && (
          <p className="mt-0.5 text-xs text-gray-600 leading-snug">{stepData.reminder}</p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Guide
          </button>
          <button
            onClick={onHide}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 whitespace-nowrap"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide guide
          </button>
          <div className="flex-1" />
          {isLast && justCompleted ? (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-md ring-2 ring-green-400 hover:bg-green-700 whitespace-nowrap"
            >
              You're all set! 🎉
            </button>
          ) : (
            <button
              onClick={onNext}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all ${
                justCompleted
                  ? 'bg-green-600 text-white shadow-md ring-2 ring-green-400 hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {justCompleted ? 'Next' : `Next: Step ${step + 1}`}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuideBar;
