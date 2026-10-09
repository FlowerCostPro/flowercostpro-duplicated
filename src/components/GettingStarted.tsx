import React from 'react';
import { ArrowRight, Check, Eye, Mail, MessageCircle, Phone } from 'lucide-react';
import { GUIDE_STEPS, TOTAL_GUIDE_STEPS } from '../lib/guideSteps';

interface GettingStartedProps {
  onShowFeedback: () => void;
  completedSteps: Set<number>;
  guideHidden: boolean;
  onStartGuideStep: (step: number) => void;
  onShowGuide: () => void;
  onFinishGuide: () => void;
}

const GettingStarted: React.FC<GettingStartedProps> = ({
  onShowFeedback,
  completedSteps,
  guideHidden,
  onStartGuideStep,
  onShowGuide,
  onFinishGuide
}) => {
  const completedCount = completedSteps.size;
  const allDone = completedCount >= TOTAL_GUIDE_STEPS;
  const progressPercent = (completedCount / TOTAL_GUIDE_STEPS) * 100;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-blue-50 p-5 sm:p-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-700">FlowerCost Pro</p>
        <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">Getting Started</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-gray-700 sm:text-xl">
          Built by florists, for florists. Go from sign-up to your first priced arrangement in about 10 minutes.
        </p>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {completedCount} of {TOTAL_GUIDE_STEPS} steps done
            </p>
            {guideHidden && (
              <button
                onClick={onShowGuide}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
              >
                <Eye className="h-4 w-4" />
                Show guide
              </button>
            )}
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-green-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {allDone && (
        <section className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-100 to-green-50 p-5 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">You're all set! 🎉</h2>
          <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">
            You've completed every step. Your shop is ready to price arrangements with confidence.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <a href="mailto:Karen@flowercostpro.com" className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700">
              <Mail className="h-5 w-5" />
              Email us
            </a>
            <a href="tel:6145045436" className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700">
              <Phone className="h-5 w-5" />
              Call us
            </a>
            <a href="https://m.me/61579613631131" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700">
              <MessageCircle className="h-5 w-5" />
              Message us on Messenger
            </a>
          </div>
          <p className="mt-4 text-center text-base font-medium text-gray-700">614-504-5436</p>
        </section>
      )}

      <div className="space-y-4">
        {GUIDE_STEPS.map((step) => {
          const Icon = step.icon;
          const isDone = completedSteps.has(step.number);
          const isOptional = step.optional;
          return (
            <article
              key={step.number}
              className={`rounded-2xl border p-5 shadow-sm sm:p-7 transition-colors ${
                isDone ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white sm:h-12 sm:w-12 ${
                  isDone ? 'bg-green-600' : 'bg-gray-400'
                }`}>
                  {isDone ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : step.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 flex-shrink-0 text-green-700" />
                    <h2 className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl">{step.title}</h2>
                    {isOptional && (
                      <span className="ml-2 flex-shrink-0 text-xs font-medium text-gray-400">(optional)</span>
                    )}
                    {isDone && (
                      <span className="ml-auto flex-shrink-0 text-xs font-semibold text-green-700">Done</span>
                    )}
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">{step.description}</p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      onClick={() => onStartGuideStep(step.number)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold text-white transition-colors sm:w-auto ${
                        isDone ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {isDone ? 'Open again' : step.buttonLabel}
                      <ArrowRight className="h-5 w-5" />
                    </button>
                    {isOptional && !isDone && (
                      <button
                        onClick={onFinishGuide}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 underline"
                      >
                        Skip this step
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7">
        <h2 className="text-2xl font-bold text-gray-900">Want a hand getting set up?</h2>
        <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">
          Reach out and we'll schedule a free 15-minute call to walk you through your first recipes.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <a href="mailto:Karen@flowercostpro.com" className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700">
            <Mail className="h-5 w-5" />
            Email us
          </a>
          <a href="tel:6145045436" className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700">
            <Phone className="h-5 w-5" />
            Call us
          </a>
          <a href="https://m.me/61579613631131" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700">
            <MessageCircle className="h-5 w-5" />
            Message us on Messenger
          </a>
        </div>
        <p className="mt-4 text-center text-base font-medium text-gray-700">614-504-5436</p>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-7">
        <h2 className="text-2xl font-bold text-gray-900">Feedback</h2>
        <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">
          FlowerCost Pro exists because florists told us what they needed. Tell us what you liked, what you didn't, and what feature you wish it had. Yours could be the next feature we build.
        </p>
        <button
          onClick={onShowFeedback}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700 sm:w-auto"
        >
          Send Feedback
          <ArrowRight className="h-5 w-5" />
        </button>
      </section>
    </div>
  );
};

export default GettingStarted;
