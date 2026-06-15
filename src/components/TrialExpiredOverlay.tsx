import React, { useState } from 'react';
import { Lock, CreditCard, LogOut, Flower } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TrialExpiredOverlayProps {
  userId: string;
  email: string;
  isCanceled: boolean;
  onLogout: () => void;
  isSimulated: boolean;
}

const TrialExpiredOverlay: React.FC<TrialExpiredOverlayProps> = ({
  userId,
  email,
  isCanceled,
  onLogout,
  isSimulated,
}) => {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId, email }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 px-8 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flower className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">FlowerCost Pro</span>
          </div>
          <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {isCanceled ? 'Subscription Canceled' : 'Your Free Trial Has Ended'}
          </h2>
          <p className="text-green-100 text-sm mt-2">
            {isCanceled
              ? 'Resubscribe to regain full access to your account.'
              : 'Subscribe to continue growing your floral business.'}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <ul className="space-y-3 mb-6">
            {[
              'Unlimited order creation & tracking',
              'Real-time profit analytics',
              'Product library & inventory alerts',
              'Arrangement recipes & POS integration',
              'Unlimited designer accounts',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <div className="bg-green-50 rounded-xl p-4 mb-6 text-center border border-green-200">
            <div className="text-3xl font-bold text-green-700">$25</div>
            <div className="text-sm text-green-600">per month</div>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={loading || isSimulated}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            {loading ? 'Redirecting to checkout...' : isCanceled ? 'Resubscribe — $25/mo' : 'Subscribe Now — $25/mo'}
          </button>

          {isSimulated && (
            <p className="text-center text-xs text-amber-600 mt-2 font-medium">
              Simulation mode — checkout disabled
            </p>
          )}

          <button
            onClick={onLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredOverlay;
