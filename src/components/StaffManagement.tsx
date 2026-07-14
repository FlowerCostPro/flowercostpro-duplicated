import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Mail, Eye, EyeOff, Loader as Loader2, Copy, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted: boolean;
}

interface StaffManagementProps {
  ownerId: string;
  ownerEmail: string;
}

const StaffManagement: React.FC<StaffManagementProps> = ({ ownerId, ownerEmail }) => {
  const { showToast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({ email: '', password: '', fullName: '', confirm: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const loadStaff = async () => {
    const { data, error } = await supabase.rpc('get_my_staff');
    if (!error && data) setStaff(data as StaffMember[]);
  };

  const loadInvites = async () => {
    const { data, error } = await supabase
      .from('staff_invites')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('accepted', false)
      .order('created_at', { ascending: false });
    if (!error && data) setInvites(data as PendingInvite[]);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStaff(), loadInvites()]);
      setLoading(false);
    })();
  }, [ownerId]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (createForm.password !== createForm.confirm) {
      setCreateError('Passwords do not match');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }
    if (!createForm.fullName.trim()) {
      setCreateError('Full name is required');
      return;
    }

    setCreateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: createForm.email.trim().toLowerCase(),
            password: createForm.password,
            fullName: createForm.fullName.trim(),
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Failed to create staff account');

      showToast(`Staff account created for ${createForm.email}`, 'success');
      setCreateForm({ email: '', password: '', fullName: '', confirm: '' });
      setShowCreateForm(false);
      await loadStaff();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_invites')
        .insert({ owner_id: ownerId, email: inviteEmail.trim().toLowerCase() })
        .select()
        .single();

      if (error) throw error;

      showToast('Invite created — copy the link below to share it', 'success');
      setInviteEmail('');
      setShowInviteForm(false);
      await loadInvites();
    } catch (err: any) {
      showToast(err.message ?? 'Failed to create invite', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}?invite=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const deleteInvite = async (inviteId: string) => {
    const { error } = await supabase.from('staff_invites').delete().eq('id', inviteId);
    if (!error) {
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      showToast('Invite removed', 'success');
    }
  };

  const removeStaff = async (staffId: string) => {
    setRemovingId(staffId);
    try {
      const { error } = await supabase.rpc('remove_staff_member', { p_staff_id: staffId });
      if (error) throw error;
      setStaff(prev => prev.filter(s => s.id !== staffId));
      showToast('Staff member removed', 'success');
    } catch (err: any) {
      showToast(err.message ?? 'Failed to remove staff member', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const pendingInvites = invites.filter(i => new Date(i.expires_at) > new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Team Members</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your shop's designers. Staff can build arrangements and view recipes — they cannot access costs, settings, or reports.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowInviteForm(!showInviteForm); setShowCreateForm(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Invite by email
          </button>
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setShowInviteForm(false); setCreateError(null); }}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Create login
          </button>
        </div>
      </div>

      {/* Create staff form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4">Create Staff Login</h4>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={createForm.fullName}
                  onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="jane@yourshop.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={createForm.confirm}
                  onChange={e => setCreateForm({ ...createForm, confirm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Repeat password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {createLoading ? 'Creating...' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setCreateError(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-1">Send Invite Link</h4>
          <p className="text-sm text-gray-500 mb-4">
            The staff member will receive a link to create their own login. The link expires in 7 days.
          </p>
          <form onSubmit={handleSendInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              placeholder="designer@yourshop.com"
              required
            />
            <button
              type="submit"
              disabled={inviteLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {inviteLoading ? 'Sending...' : 'Generate Link'}
            </button>
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-500" />
            Pending Invites
          </h4>
          <div className="space-y-2">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{invite.email}</div>
                  <div className="text-xs text-gray-500">
                    Expires {new Date(invite.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => copyInviteLink(invite.token)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-amber-300 text-amber-700 rounded-md hover:bg-amber-100 transition-colors"
                >
                  {copiedToken === invite.token ? (
                    <><Check className="w-3 h-3" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copy link</>
                  )}
                </button>
                <button
                  onClick={() => deleteInvite(invite.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                  title="Delete invite"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff list */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-gray-800">
            Active Staff ({loading ? '…' : staff.length})
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No staff accounts yet.</p>
            <p className="text-gray-400 text-sm">Use "Create login" or "Invite by email" above to add your first designer.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {staff.map(member => (
              <div key={member.id} className="flex items-center gap-4 px-6 py-4">
                <div className="bg-green-100 rounded-full w-9 h-9 flex items-center justify-center text-sm font-semibold text-green-700 flex-shrink-0">
                  {(member.full_name ?? member.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">
                    {member.full_name ?? '(no name)'}
                  </div>
                  <div className="text-sm text-gray-500 truncate">{member.email}</div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                  Added {new Date(member.created_at).toLocaleDateString()}
                </div>
                <button
                  onClick={() => removeStaff(member.id)}
                  disabled={removingId === member.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors flex-shrink-0"
                  title="Remove staff member"
                >
                  {removingId === member.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Staff access:</strong> Staff can build orders, see retail prices, and use the recipe library.
        They cannot see wholesale costs, markup settings, profit reports, or this management page.
        Only you (the owner) can add or remove staff accounts.
      </div>
    </div>
  );
};

export default StaffManagement;
