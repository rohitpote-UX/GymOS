import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Plus, ShieldCheck, User, Users, X } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  primary_branch?: {
    id: number;
    name: string;
  };
  branches?: Array<{
    id: number;
    name: string;
  }>;
}

interface BranchItem {
  id: number;
  name: string;
}

export const Staff: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState('branch_manager');
  const [primaryBranchId, setPrimaryBranchId] = useState('');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const [staffRes, branchesRes] = await Promise.all([
        api.get<StaffUser[]>('/staff'),
        api.get<BranchItem[]>('/branches'),
      ]);
      setStaff(staffRes.data);
      setBranches(branchesRes.data);
      if (branchesRes.data.length > 0 && !primaryBranchId) {
        setPrimaryBranchId(branchesRes.data[0].id.toString());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/staff', {
        name,
        email,
        phone,
        password,
        role,
        primary_branch_id: parseInt(primaryBranchId, 10),
      });
      setModalOpen(false);
      resetForm();
      fetchStaff();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('password123');
    setRole('branch_manager');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>{t('staff.title', 'Staff & Access Permissions')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('staff.subtitle', 'Manage managers, front-desk personnel, trainers, and location assignments')}
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('staff.add_staff', 'Add Staff Member')}</span>
        </button>
      </div>

      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-4">{t('staff.full_name', 'Name')}</th>
              <th className="py-3.5 px-4">{t('common.email', 'Email')}</th>
              <th className="py-3.5 px-4">{t('common.phone', 'Phone')}</th>
              <th className="py-3.5 px-4">{t('staff.role', 'Role')}</th>
              <th className="py-3.5 px-4">{t('staff.assigned_branches', 'Home Branch')}</th>
              <th className="py-3.5 px-4">{t('staff.active_status', 'Status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                    {s.name[0]}
                  </div>
                  <span>{s.name}</span>
                </td>
                <td className="py-3.5 px-4 text-slate-300">{s.email}</td>
                <td className="py-3.5 px-4 text-slate-400">{s.phone || '—'}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded uppercase font-semibold text-[10px] bg-slate-800 text-emerald-400">
                    {s.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-400">{s.primary_branch?.name || 'All Branches'}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Add Staff Account</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sneha Kapoor"
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@ironcore.in"
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9820055443"
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="branch_manager">Branch Manager</option>
                    <option value="trainer">Trainer</option>
                    <option value="front_desk">Front Desk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Home Branch *</label>
                  <select
                    value={primaryBranchId}
                    onChange={(e) => setPrimaryBranchId(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
