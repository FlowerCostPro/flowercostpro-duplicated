import React, { useState, useEffect, FormEvent } from 'react';
import { Eye, EyeOff, UserPlus, Loader as Loader2, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StaffInviteAcceptanceProps {
  token: string;
  onAuthSuccess: () => void;
  onBackToLanding: () => void;
}

interface InviteInfo {
  id: string;
  owner_id: string;
  email: string;
  expires_at: string;
  accepted: boolean;
  store_name: string | null;
}

const StaffInviteAcceptance: React.FC<StaffInviteAcceptanceProps> = ({ token, onAuthSuccess, onBackToLanding }) => {
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-invite?action=lookup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ token }),
          }
        );

        if (!res.ok) {
          setInviteError('This invitation link is invalid or has expired.');
          setLoadingInvite(false);
          return;
        }

        const data = await res.json();
        if (data.error || !data.id) {
          setInviteError('This invitation link is invalid, has already been used, or has expired.');
          setLoadingInvite(false);
          return;
        }

        setInviteInfo(data as unknown as InviteInfo);
        setLoadingInvite(false);
      } catch {
        setInviteError('This invitation link is invalid or has expired.');
        setLoadingInvite(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Your name is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteInfo!.email,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) {
        throw new Error('Account creation failed — no user ID returned.');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/staff-invite?action=accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ token, userId }),
        }
      );

      if (!res.ok) {
        throw new Error('Your account was created but the invite could not be linked. Please contact the shop owner.');
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteInfo!.email,
        password,
      });

      if (signInError || !signInData?.user) {
        setError('Account created and linked! Please sign in with your new credentials.');
        setSubmitting(false);
        return;
      }

      onAuthSuccess();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (inviteError || !inviteInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invitation Invalid</h1>
          <p className="text-gray-600 mb-6">{inviteError ?? 'This invitation link is invalid or has expired.'}</p>
          <p className="text-sm text-gray-500 mb-6">
            Please ask your shop owner to send you a new invitation link.
          </p>
          <button
            onClick={onBackToLanding}
            className="text-green-600 hover:text-green-700 font-medium"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="FlowerCost Pro" className="h-28 w-auto mx-auto mb-4" />
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
            <Store className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              {inviteInfo.store_name || 'A flower shop'} has invited you
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Join the Team</h1>
          <p className="text-gray-600">
            Create your login to start building arrangements.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Email:</span> {inviteInfo.email}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium text-gray-700">Expires:</span>{' '}
            {new Date(inviteInfo.expires_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter your full name"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Repeat password"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Create Staff Login
              </>
            )}
          </button>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800 font-medium mb-1">Staff account</p>
          <p className="text-xs text-blue-700">
            You'll be able to build arrangements and use the recipe library. You won't see costs, settings, or reports.
          </p>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={onBackToLanding}
            className="text-gray-600 hover:text-gray-700 font-medium text-sm"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffInviteAcceptance;
