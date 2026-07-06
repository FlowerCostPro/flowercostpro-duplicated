import React, { useState } from 'react';
import { Clock, X, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionBannerProps {
  userId: string;
  email: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({
  userId,
  email,
  subscriptionStatus,
  trialEndsAt,
}) => {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (subscriptionStatus === 'active') return null;

  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const now = new Date();
  const daysLeft = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const trialExpired = daysLeft <= 0;

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
      } else {
        console.error('No checkout URL returned:', data);
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (subscriptionStatus === 'past_due') {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            Payment failed — please update your billing details to keep access.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="bg-white text-red-600 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Update Billing'}
          </button>
          <button onClick={() => setDismissed(true)} className="text-red-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (subscriptionStatus === 'canceled') {
    return (
      <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-yellow-400" />
          <span className="text-sm font-medium">
            Your subscription has been canceled. Resubscribe to regain full access.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Resubscribe — $25/mo'}
          </button>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Trialing state
  if (trialExpired) {
    return (
      <div className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            Your free trial has ended. Subscribe to continue using FlowerCost Pro.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="bg-white text-orange-600 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-orange-50 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Subscribe — $25/mo'}
          </button>
          <button onClick={() => setDismissed(true)} className="text-orange-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (daysLeft <= 7) {
    return (
      <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {daysLeft === 1 ? '1 day' : `${daysLeft} days`} left in your free trial.
            Subscribe now to keep access — $25/month after trial.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="bg-white text-amber-600 px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-amber-50 transition-colors disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Subscribe Now'}
          </button>
          <button onClick={() => setDismissed(true)} className="text-amber-100 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Early in trial — show a soft info bar
  return (
    <div className="bg-green-700 text-white px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-300" />
        <span className="text-sm">
          Free trial active — <strong>{daysLeft} days</strong> remaining. $25/month after trial ends.
        </span>
      </div>
      <button onClick={() => setDismissed(true)} className="text-green-300 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SubscriptionBanner;
