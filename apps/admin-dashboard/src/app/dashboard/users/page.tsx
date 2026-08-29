'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import { useAuth } from '../../../lib/auth-context';
import { User, Cinema, UserRole } from '../../../lib/types';
import apiClient, { extractList } from '../../../lib/api-client';
import {
  Users,
  ShieldCheck,
  Building2,
  Search,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function UsersManagementPage() {
  const { user: currentUser, role: currentRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Promotion Form State
  const [targetRole, setTargetRole] = useState<UserRole>('cinema_admin');
  const [targetCinemaId, setTargetCinemaId] = useState<string>('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, cinemasRes] = await Promise.all([
        apiClient.get('/admin/users').catch(() =>
          apiClient.get('/users').catch(() => ({
            data: {
              items: [
                {
                  id: 'super-admin-1',
                  name: 'SUPER ADMIN',
                  email: 'superadmin@booking.local',
                  role: 'super_admin',
                  status: 'ACTIVE',
                  createdAt: new Date().toISOString(),
                },
                {
                  id: 'admin-user-2',
                  name: 'HQ Cinema Admin',
                  email: 'cinemaadmin@booking.local',
                  role: 'cinema_admin',
                  status: 'ACTIVE',
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          })),
        ),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
      ]);

      const uList = extractList<User>(usersRes.data);
      const cList = extractList<Cinema>(cinemasRes.data);

      setUsers(uList.length > 0 ? uList : [
        {
          id: 'super-admin-1',
          name: 'SUPER ADMIN',
          email: 'superadmin@booking.local',
          role: 'super_admin',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'admin-user-2',
          name: 'Cinema Admin',
          email: 'cinemaadmin@booking.local',
          role: 'cinema_admin',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
      ]);
      setCinemas(cList);
      if (cList.length > 0 && !targetCinemaId) {
        setTargetCinemaId(cList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setUsers([]);
      setCinemas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenPromoteModal = (targetUser: User) => {
    setSelectedUser(targetUser);
    setTargetRole(targetUser.role || 'cinema_admin');
    setTargetCinemaId(targetUser.cinemaId || cinemas[0]?.id || '');
    setError(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handlePromoteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const requiresBranch = [
      'cinema_admin',
      'staff',
      'gate_checker',
    ].includes(targetRole);

    try {
      await apiClient.patch(`/users/${selectedUser.id}/role`, {
        role: targetRole.toUpperCase(),
        cinemaId: requiresBranch ? targetCinemaId : undefined,
      });

      setSuccessMsg(
        `User ${selectedUser.email} successfully promoted to ${targetRole.toUpperCase()}! Previous sessions purged.`,
      );
      setTimeout(() => {
        setIsModalOpen(false);
        fetchData();
      }, 1200);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to update user role',
      );
    } finally {
      setSaving(false);
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'super_admin':
        return 'gold';
      case 'admin':
        return 'blue';
      case 'cinema_admin':
        return 'emerald';
      case 'gate_checker':
      case 'staff':
        return 'rose';
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
      (u?.role && u.role.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              User & Staff Roles
            </h1>
            <Badge variant="gold" size="sm">
              Super Admin Exclusive
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enforce hierarchical RBAC, promote staff members, and assign cinema branch affiliations.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mt-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by email, name, or role..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-5 py-3">User Account</th>
                <th className="px-5 py-3">Current Role</th>
                <th className="px-5 py-3">Assigned Branch</th>
                <th className="px-5 py-3">Account Status</th>
                <th className="px-5 py-3 text-right">RBAC Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Loading user accounts...
                    </span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    No users matching your query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const assignedCinema = safeCinemas.find(
                    (c) => c.id === u.cinemaId,
                  );

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700">
                            {u.name?.charAt(0) || u.email?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{u.name || 'User'}</p>
                            <p className="text-[11px] text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant={getRoleVariant(u.role)} size="sm">
                          {u.role ? u.role.replace('_', ' ') : 'USER'}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {assignedCinema ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>{assignedCinema.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Global / Unassigned</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge variant="emerald" size="sm">
                          {u.status || 'ACTIVE'}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenPromoteModal(u)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Promote</span>
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

      {/* Promotion Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Promote User Role & Assign Branch"
        subtitle={`Modifying privileges for ${selectedUser?.email}`}
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handlePromoteUser} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Select Role Hierarchy *
            </label>
            <select
              required
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="super_admin">SUPER_ADMIN (Global Authority)</option>
              <option value="admin">ADMIN (Platform Operations)</option>
              <option value="cinema_admin">CINEMA_ADMIN (Branch General Manager)</option>
              <option value="staff">STAFF (Theater Attendant)</option>
              <option value="gate_checker">GATE_CHECKER (Ticket Scanner Role)</option>
              <option value="user">USER (Standard Customer)</option>
            </select>
          </div>

          {['cinema_admin', 'staff', 'gate_checker'].includes(targetRole) && (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Assigned Cinema Branch *
              </label>
              <select
                required
                value={targetCinemaId}
                onChange={(e) => setTargetCinemaId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {safeCinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-slate-200">Notice:</span> Changing a staff member's role will require them to sign in again to activate their updated permissions.
          </div>

          <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Promoting...' : 'Confirm Role Elevation'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
