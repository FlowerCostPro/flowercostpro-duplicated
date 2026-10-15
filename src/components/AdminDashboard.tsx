import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, CreditCard, RefreshCw, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, Circle as XCircle, Shield, Download, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscribedAt: string | null;
  lastSignIn: string | null;
  orderCount: number;
  hasFeedback: boolean;
  isAdmin: boolean;
}

interface AdminDashboardProps {
  user: any;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function getTrialStatus(u: AdminUser): { label: string; color: string } {
  const now = new Date();
  const status = u.subscriptionStatus;

  if (status === 'active') return { label: 'Paid Subscriber', color: 'green' };
  if (status === 'canceled') return { label: 'Canceled', color: 'red' };
  if (status === 'past_due') return { label: 'Past Due', color: 'orange' };

  // trialing / null / other — check trial_ends_at
  if (u.trialEndsAt) {
    const trialEnd = new Date(u.trialEndsAt);
    const created = new Date(u.createdAt);
    const standardEnd = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);

    if (trialEnd < now) return { label: 'Trial Expired', color: 'gray' };
    // Extended if trial_ends_at is more than 1 day beyond the standard 14-day window
    if (trialEnd.getTime() > standardEnd.getTime() + 24 * 60 * 60 * 1000) {
      return { label: 'Trial Extended (30 days)', color: 'blue' };
    }
    return { label: 'In Trial', color: 'blue' };
  }

  return { label: 'In Trial', color: 'blue' };
}

const statusBadge = (color: string, label: string) => {
  const classes: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-700',
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${classes[color] ?? classes.gray}`}>
      {label}
    </span>
  );
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

function isPayingSubscriber(u: AdminUser): boolean {
  return u.subscriptionStatus === 'active' || u.subscriptionStatus === 'past_due';
}

function canRestartTrial(u: AdminUser): boolean {
  if (isPayingSubscriber(u)) return false;
  const status = getTrialStatus(u);
  // Show restart for expired trials or users who never started using the app (no orders)
  return status.label === 'Trial Expired' || (u.orderCount === 0 && status.label !== 'In Trial' && status.label !== 'Trial Extended (30 days)');
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [restartConfirm, setRestartConfirm] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-admin-data`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 403) throw new Error('Access denied — admin only');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const json = await res.json();
      setUsers(json.users ?? []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleExportEmails = () => {
    const headers = ['Email', 'Signup Date', 'Trial Status', 'Last Sign-In'];
    const rows = users.map(u => {
      const status = getTrialStatus(u);
      return [
        u.email,
        fmtDateTime(u.createdAt),
        status.label,
        fmtDateTime(u.lastSignIn),
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowercostpro-users-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestartTrial = async () => {
    if (!restartConfirm) return;
    setActionLoading(restartConfirm.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-admin-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'restart_trial', userId: restartConfirm.id }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      showToast(`Trial restarted for ${restartConfirm.email} — 14 days from today.`, 'success');
      setRestartConfirm(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message ?? 'Failed to restart trial', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-admin-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'delete_account', userId: deleteConfirm.id, confirmEmail: deleteEmailInput }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      showToast(`Account deleted for ${deleteConfirm.email}.`, 'success');
      setDeleteConfirm(null);
      setDeleteEmailInput('');
      await fetchData();
    } catch (err: any) {
      showToast(err.message ?? 'Failed to delete account', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Summary stats
  const totalSignups = users.length;
  const inTrial = users.filter(u => {
    const s = getTrialStatus(u);
    return s.label === 'In Trial' || s.label === 'Trial Extended (30 days)';
  }).length;
  const paying = users.filter(u => u.subscriptionStatus === 'active').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading admin data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center border border-red-200">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Could not load admin data</h2>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">
                Signed in as {user?.email}
                {lastRefreshed && ` · Refreshed ${lastRefreshed.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportEmails}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export emails
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <a
              href="/"
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`rounded-lg shadow-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalSignups}</div>
              <div className="text-sm text-gray-500">Total signups</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
            <div className="bg-amber-50 p-3 rounded-full">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{inTrial}</div>
              <div className="text-sm text-gray-500">Currently in trial</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-full">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{paying}</div>
              <div className="text-sm text-gray-500">Paying subscribers</div>
            </div>
          </div>
        </div>

        {/* Users table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All Users</h2>
            <span className="text-xs text-gray-400">{users.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Signed Up</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Trial Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Arrangements</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Feedback</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const trialStatus = getTrialStatus(u);
                  const showRestart = canRestartTrial(u);
                  const showDelete = !isPayingSubscriber(u);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{u.email}</span>
                          {u.isAdmin && (
                            <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded font-medium">
                              admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmt(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        {statusBadge(trialStatus.color, trialStatus.label)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmt(u.lastSignIn)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${u.orderCount > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {u.orderCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.hasFeedback ? (
                          <CheckCircle className="w-4 h-4 text-green-500 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 inline" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {showRestart && (
                            <button
                              onClick={() => setRestartConfirm(u)}
                              disabled={actionLoading === u.id}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 whitespace-nowrap"
                              title="Restart 14-day trial"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restart trial
                            </button>
                          )}
                          {showDelete && (
                            <button
                              onClick={() => { setDeleteConfirm(u); setDeleteEmailInput(''); }}
                              disabled={actionLoading === u.id}
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 whitespace-nowrap"
                              title="Delete account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                          {isPayingSubscriber(u) && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Restart Trial Confirmation Modal */}
      {restartConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <RotateCcw className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Restart Trial</h3>
            </div>
            <p className="text-gray-700 mb-6">
              Restart trial for <strong>{restartConfirm.email}</strong>? They will get a fresh 14-day trial starting today.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRestartConfirm(null)}
                disabled={actionLoading === restartConfirm.id}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestartTrial}
                disabled={actionLoading === restartConfirm.id}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === restartConfirm.id ? 'Restarting…' : 'Yes, restart trial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
            </div>
            <p className="text-gray-700 mb-4">
              This will permanently delete the account for <strong>{deleteConfirm.email}</strong> and all associated data. This cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-2">
              To confirm, type the email address exactly:
            </p>
            <input
              type="text"
              value={deleteEmailInput}
              onChange={(e) => setDeleteEmailInput(e.target.value)}
              placeholder={deleteConfirm.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteEmailInput(''); }}
                disabled={actionLoading === deleteConfirm.id}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={actionLoading === deleteConfirm.id || deleteEmailInput.toLowerCase().trim() !== deleteConfirm.email.toLowerCase().trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === deleteConfirm.id ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
