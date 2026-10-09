import React from 'react';
import { ArrowRight, BookOpen, Mail, MessageCircle, Phone, Settings, ShoppingCart, Sprout } from 'lucide-react';

interface GettingStartedProps {
  onSectionChange: (section: string) => void;
  onShowFeedback: () => void;
}

interface Step {
  number: number;
  title: string;
  description: string;
  buttonLabel: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Set your default markup',
    description: 'Go to Settings and enter your default markup. This is the percentage the app uses to price arrangements unless you choose a different pricing profile. Then fill in your shop details and tap Save Settings.',
    buttonLabel: 'Open Settings',
    section: 'settings',
    icon: Settings
  },
  {
    number: 2,
    title: 'Add pricing profiles',
    description: "Not every order should be priced the same way. Create a separate profile for each type of order, for example Everyday / walk-in, Weddings, and Holidays (Valentine's Day, Mother's Day). The right markup is applied automatically, with no adjusting by hand.",
    buttonLabel: 'Set up pricing profiles',
    section: 'settings',
    icon: Settings
  },
  {
    number: 3,
    title: 'Add your flowers and supplies',
    description: 'Start with something you already know the price of: a dozen roses. In the Product Library, add each item that goes into it with your wholesale cost: roses, greens, filler, vase, ribbon.',
    buttonLabel: 'Open Product Library',
    section: 'products',
    icon: Sprout
  },
  {
    number: 4,
    title: 'Build your Dozen Roses recipe',
    description: 'Go to Arrangement Recipes, create a recipe called "Dozen Roses," and add the items from Step 3. Watch the price build as you go. Compare it to what you charge today. Is your margin where you want it?',
    buttonLabel: 'Open Arrangement Recipes',
    section: 'recipes',
    icon: BookOpen
  },
  {
    number: 5,
    title: 'Create your first order',
    description: 'Create an order using your Dozen Roses recipe. This is where it clicks: anyone on your team can pull up the arrangement and have it priced instantly. Your margin stays protected, and your wholesale costs are never shown to staff.',
    buttonLabel: 'Create an Order',
    section: 'create-order',
    icon: ShoppingCart
  }
];

const GettingStarted: React.FC<GettingStartedProps> = ({ onSectionChange, onShowFeedback }) => {
  const openSection = (section: string, scrollToPricingProfiles = false) => {
    onSectionChange(section);
    if (scrollToPricingProfiles) {
      window.setTimeout(() => {
        document.getElementById('pricing-profiles')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-blue-50 p-5 sm:p-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-700">FlowerCost Pro</p>
        <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">Getting Started</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-gray-700 sm:text-xl">
          Built by florists, for florists. Go from sign-up to your first priced arrangement in about 10 minutes.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article key={step.number} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-lg font-bold text-white sm:h-12 sm:w-12">
                  {step.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 flex-shrink-0 text-green-700" />
                    <h2 className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl">{step.title}</h2>
                  </div>
                  <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">{step.description}</p>
                  <button
                    onClick={() => openSection(step.section, step.number === 2)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-green-700 sm:w-auto"
                  >
                    {step.buttonLabel}
                    <ArrowRight className="h-5 w-5" />
                  </button>
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
