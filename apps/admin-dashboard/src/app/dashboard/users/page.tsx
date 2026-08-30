'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import { useAuth } from '../../../lib/auth-context';
import { User, Cinema, UserRole } from '../../../lib/types';
import apiClient, { extractList, resolveImageUrl } from '../../../lib/api-client';
import {
  Users as UsersIcon,
  ShieldCheck,
  Building2,
  Search,
  AlertCircle,
  Sparkles,
  UserPlus,
  Lock,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Copy,
} from 'lucide-react';

export default function UsersManagementPage() {
  const { user: currentUser, role: currentRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Promotion / Edit Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [targetRole, setTargetRole] = useState<UserRole>('cinema_admin');
  const [targetCinemaId, setTargetCinemaId] = useState<string>('');
  
  // Invite Staff Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhoneNumber, setInvitePhoneNumber] = useState('');
  const [inviteBirthDate, setInviteBirthDate] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('cinema_admin');
  const [inviteCinemaId, setInviteCinemaId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isInviteSubmitted, setIsInviteSubmitted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, cinemasRes] = await Promise.all([
        apiClient.get('/admin/users').catch(() => apiClient.get('/users')),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
      ]);

      const uList = extractList<User>(usersRes.data);
      const cList = extractList<Cinema>(cinemasRes.data);

      setUsers(uList);
      setCinemas(cList);

      if (cList.length > 0) {
        if (!targetCinemaId) setTargetCinemaId(cList[0].id);
        if (!inviteCinemaId) setInviteCinemaId(cList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch real users:', err);
      setError('Could not retrieve user data from server.');
      setUsers([]);
      setCinemas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Promote / Edit Role Modal
  const handleOpenPromoteModal = (targetUser: User) => {
    setSelectedUser(targetUser);
    setTargetRole(targetUser.role || 'cinema_admin');
    setTargetCinemaId(targetUser.cinemaId || cinemas[0]?.id || '');
    setError(null);
    setSuccessMsg(null);
    setIsPromoteModalOpen(true);
  };

  // Submit Role Change
  const handlePromoteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const requiresBranch = ['cinema_admin', 'staff', 'gate_checker'].includes(targetRole);

    try {
      await apiClient.patch(`/users/${selectedUser.id}/role`, {
        role: targetRole.toUpperCase(),
        cinemaId: requiresBranch ? targetCinemaId : undefined,
      });

      setSuccessMsg(
        `User ${selectedUser.email} role updated to ${targetRole.replace('_', ' ').toUpperCase()} successfully!`,
      );
      setTimeout(() => {
        setIsPromoteModalOpen(false);
        fetchData();
      }, 1200);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to update user role.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Open Invite Staff Modal
  const handleOpenInviteModal = () => {
    setInviteFullName('');
    setInviteEmail('');
    setInvitePhoneNumber('');
    setInviteBirthDate('');
    setInviteRole('cinema_admin');
    setInviteCinemaId(cinemas[0]?.id || '');
    setAdminPassword('');
    setIsInviteSubmitted(false);
    setError(null);
    setSuccessMsg(null);
    setIsInviteModalOpen(true);
  };

  // Submit Invite Staff
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const requiresBranch = ['cinema_admin', 'staff', 'gate_checker'].includes(inviteRole);

    try {
      await apiClient.post('/users/staff', {
        fullName: inviteFullName,
        email: inviteEmail,
        phoneNumber: invitePhoneNumber || undefined,
        birthDate: inviteBirthDate || undefined,
        role: inviteRole,
        cinemaId: requiresBranch ? inviteCinemaId : undefined,
        adminPassword: adminPassword,
      });

      setIsInviteSubmitted(true);
      setSuccessMsg(
        `Staff invitation created successfully. An activation link has been dispatched to ${inviteEmail}.`,
      );
      fetchData();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to invite staff member. Please verify your administrative confirmation password.',
      );
    } finally {
      setSaving(false);
    }
  };

  const getRoleVariant = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'super_admin':
        return 'gold';
      case 'admin':
        return 'blue';
      case 'cinema_admin':
        return 'emerald';
      case 'gate_checker':
      case 'staff':
      case 'accountant':
      case 'marketing':
        return 'rose';
      default:
        return 'slate';
    }
  };

  const getStatusVariant = (status?: string): 'gold' | 'emerald' | 'rose' | 'crimson' | 'slate' => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'emerald';
      case 'PENDING_ACTIVATION':
        return 'gold';
      case 'SUSPENDED':
        return 'rose';
      case 'BLOCKED':
        return 'crimson';
      default:
        return 'slate';
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const safeCinemas = Array.isArray(cinemas) ? cinemas : [];

  const filteredUsers = safeUsers.filter(
    (u) =>
      u?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u?.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u?.role && u.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u?.phoneNumber && u.phoneNumber.includes(searchQuery)),
  );

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              User & Staff Operations
            </h1>
            <Badge variant="gold" size="sm">
              Staff Management Hub
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Invite cinema branch managers, gate ticket checkers, and maintain hierarchical access control.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenInviteModal}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-red-600/30 hover:from-red-500 hover:to-rose-500 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite New Staff</span>
          </button>
        </div>
      </div>

      {/* Search & Overview Stats */}
      <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email, name, phone, or role..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] py-2.5 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Total Members: <strong className="text-slate-900 dark:text-slate-100">{safeUsers.length}</strong>
          </span>
          <span>•</span>
          <span>
            Active: <strong className="text-emerald-500">{safeUsers.filter((u) => u.status === 'ACTIVE').length}</strong>
          </span>
          <span>•</span>
          <span>
            Pending:{' '}
            <strong className="text-amber-500">
              {safeUsers.filter((u) => u.status === 'PENDING_ACTIVATION').length}
            </strong>
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-5 py-3.5">User Account</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Cinema Branch</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5">Joined Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      Loading real accounts from database...
                    </span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UsersIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-slate-600 dark:text-slate-300">No matching user accounts found</p>
                      <p className="text-[11px] text-slate-400">Click &ldquo;Invite New Staff&rdquo; above to onboard your first cinema manager.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const assignedCinema = safeCinemas.find((c) => c.id === u.cinemaId);
                  const avatarSrc = resolveImageUrl(u.avatarUrl || u.avatarKey);

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={u.name || 'User'}
                              className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-rose-700 font-bold text-white text-xs shadow-sm shadow-red-600/30">
                              {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{u.name || 'Anonymous User'}</p>
                            <p className="text-[11px] text-slate-500">{u.email}</p>
                            {u.phoneNumber && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="h-2.5 w-2.5" />
                                <span>{u.phoneNumber}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant={getRoleVariant(u.role)} size="sm">
                          {u.role ? u.role.replace('_', ' ').toUpperCase() : 'USER'}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {assignedCinema ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            <span className="font-medium text-slate-900 dark:text-slate-200">{assignedCinema.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Global / Unassigned</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant={getStatusVariant(u.status)} size="sm">
                          {u.status?.replace('_', ' ') || 'ACTIVE'}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenPromoteModal(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
                          <span>Edit Role</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Invite New Staff */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite New Cinema Staff Member"
        subtitle="Onboard a manager, accountant, or ticket gate checker with branch-level scoping"
      >
        {isInviteSubmitted ? (
          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Invitation Dispatched!</p>
                <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                  An invitation link has been dispatched to <strong>{inviteEmail}</strong>. The staff member can complete their password setup via the link provided in the email.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  fetchData();
                }}
                className="rounded-xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-5 py-2 font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInviteStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    placeholder="e.g. Ahmed Mahmoud"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. manager@cinema.com"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={invitePhoneNumber}
                    onChange={(e) => setInvitePhoneNumber(e.target.value)}
                    placeholder="+201001234567"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Birth Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={inviteBirthDate}
                    onChange={(e) => setInviteBirthDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Staff Role *
                  </label>
                  <select
                    required
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                  >
                    <option value="cinema_admin">Cinema Admin (Branch Manager)</option>
                    <option value="gate_checker">Gate Checker (Ticket Scanner)</option>
                    <option value="staff">Staff (Theater Attendant)</option>
                    <option value="accountant">Accountant (Financial Auditor)</option>
                    <option value="marketing">Marketing (Promotions Specialist)</option>
                    {currentRole === 'super_admin' && (
                      <>
                        <option value="admin">Admin (System Co-Admin)</option>
                        <option value="super_admin">Super Admin (Global Authority)</option>
                      </>
                    )}
                  </select>
                </div>

                {['cinema_admin', 'staff', 'gate_checker'].includes(inviteRole) && (
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Cinema Branch *
                    </label>
                    <select
                      required
                      value={inviteCinemaId}
                      onChange={(e) => setInviteCinemaId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                    >
                      {safeCinemas.length === 0 ? (
                        <option value="">No branches created yet</option>
                      ) : (
                        safeCinemas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.city})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Sudo Password Confirmation */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Admin Confirmation Password (Sudo Mode) *
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter your current account password to authorize"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Security safeguard protected by sliding-window rate limiting.
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2 font-semibold text-white shadow-sm shadow-red-600/30 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {saving ? 'Creating Staff Account...' : 'Send Staff Invitation'}
                </button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* Modal 2: Promotion / Edit User Role */}
      <Modal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        title="Promote User Role & Assign Branch"
        subtitle={`Modifying privileges for ${selectedUser?.email}`}
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handlePromoteUser} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Role Hierarchy *
            </label>
            <select
              required
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
            >
              <option value="super_admin">SUPER_ADMIN (Global Authority)</option>
              <option value="admin">ADMIN (Platform Operations)</option>
              <option value="cinema_admin">CINEMA_ADMIN (Branch General Manager)</option>
              <option value="gate_checker">GATE_CHECKER (Ticket Scanner Role)</option>
              <option value="staff">STAFF (Theater Attendant)</option>
              <option value="accountant">ACCOUNTANT (Financial Auditor)</option>
              <option value="marketing">MARKETING (Promotions Specialist)</option>
              <option value="user">USER (Standard Customer)</option>
            </select>
          </div>

          {['cinema_admin', 'staff', 'gate_checker'].includes(targetRole) && (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assigned Cinema Branch *
              </label>
              <select
                required
                value={targetCinemaId}
                onChange={(e) => setTargetCinemaId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none"
              >
                {safeCinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-slate-200">Notice:</span> Changing a staff member&apos;s role will invalidate their active session tokens and enforce re-authentication.
          </div>

          <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsPromoteModalOpen(false)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2 font-semibold text-white shadow-sm shadow-red-600/30 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 transition-all cursor-pointer"
            >
              {saving ? 'Updating...' : 'Confirm Role Update'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
