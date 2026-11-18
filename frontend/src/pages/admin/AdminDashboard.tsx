import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Crown,
  Eye,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface PlatformMetrics {
  total_gyms: number;
  active_gyms: number;
  trial_gyms: number;
  suspended_gyms: number;
  total_members: number;
  total_branches: number;
  saas_revenue: number;
}

interface GymRecord {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  status: 'active' | 'suspended' | 'trial';
  subscription_expires_at?: string;
  branches_count: number;
  members_count: number;
  plan?: {
    id: number;
    name: string;
  };
}

export const AdminDashboard: React.FC = () => {
  const { user, impersonate, logout } = useAuth();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, gymsRes] = await Promise.all([
        api.get<{ metrics: PlatformMetrics }>('/admin/overview'),
        api.get<{ data: GymRecord[] }>(`/admin/gyms${search ? `?search=${encodeURIComponent(search)}` : ''}`),
      ]);
      setMetrics(overviewRes.data.metrics);
      setGyms(gymsRes.data.data);
    } catch (err) {
      setToast(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [search]);

  const handleSuspend = async (gym: GymRecord) => {
    try {
      await api.post(`/admin/gyms/${gym.id}/suspend`);
      setToast(`Gym '${gym.name}' has been suspended.`);
      fetchOverview();
    } catch (err) {
      setToast(errorMessage(err));
    }
  };

  const handleActivate = async (gym: GymRecord) => {
    try {
      await api.post(`/admin/gyms/${gym.id}/activate`);
      setToast(`Gym '${gym.name}' has been activated.`);
      fetchOverview();
    } catch (err) {
      setToast(errorMessage(err));
    }
  };

  const handleExtend = async (gym: GymRecord, days = 30) => {
    try {
      await api.post(`/admin/gyms/${gym.id}/extend-subscription`, { days });
      setToast(`Subscription for '${gym.name}' extended by ${days} days.`);
      fetchOverview();
    } catch (err) {
      setToast(errorMessage(err));
    }
  };

  const handleImpersonate = async (gym: GymRecord) => {
    try {
      await impersonate(gym.id);
    } catch (err) {
      setToast(errorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-950/40">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Super-Admin Control Plane
              </h1>
              <p className="text-xs text-purple-400 font-medium">
                Platform Multi-Tenant Oversight & License Operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Signed in as {user?.email}</span>
            <button
              onClick={() => logout()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="p-3 bg-slate-800 border border-purple-500/40 rounded-xl text-xs text-purple-300 flex items-center justify-between">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Platform Metrics KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Total Gyms</span>
            <span className="text-3xl font-black text-white">{metrics?.total_gyms || 0}</span>
            <p className="text-[11px] text-emerald-400 mt-1">
              {metrics?.active_gyms || 0} active • {metrics?.trial_gyms || 0} on trial
            </p>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Total Branches</span>
            <span className="text-3xl font-black text-white">{metrics?.total_branches || 0}</span>
            <p className="text-[11px] text-slate-400 mt-1">Across all gym networks</p>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Total Enrolled Members</span>
            <span className="text-3xl font-black text-white">{metrics?.total_members || 0}</span>
            <p className="text-[11px] text-emerald-400 mt-1">Platform-wide fitness users</p>
          </div>

          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">SaaS ARR / Revenue</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-400">₹</span>
              <span className="text-3xl font-black text-white">
                {metrics?.saas_revenue?.toLocaleString('en-IN') || 0}
              </span>
            </div>
            <p className="text-[11px] text-purple-400 mt-1">Razorpay subscriptions</p>
          </div>
        </div>

        {/* Gym Tenants Directory Table */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <span>Gym Tenants Directory</span>
              </h2>
              <p className="text-xs text-slate-400">Manage tenant accounts, extend licenses, and impersonate owners</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gyms by name, email, slug..."
                className="w-full bg-[#131b2e] border border-slate-700 text-xs rounded-xl pl-9 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Gym Tenant</th>
                  <th className="py-3 px-4">Slug / Domain</th>
                  <th className="py-3 px-4">SaaS Plan</th>
                  <th className="py-3 px-4">Branches</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {gyms.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white block">{g.name}</span>
                      <span className="text-[10px] text-slate-400">{g.email || g.phone}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-purple-400">/gyms/{g.slug}</td>
                    <td className="py-3.5 px-4 font-medium text-emerald-400">{g.plan?.name || 'Starter'}</td>
                    <td className="py-3.5 px-4 text-slate-300">{g.branches_count} location(s)</td>
                    <td className="py-3.5 px-4 text-slate-300">{g.members_count} members</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          g.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : g.status === 'trial'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleImpersonate(g)}
                          title="Log in as Gym Owner (Customer Support)"
                          className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>Impersonate</span>
                        </button>

                        <button
                          onClick={() => handleExtend(g, 30)}
                          title="Extend 30 Days"
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                        >
                          +30d
                        </button>

                        {g.status === 'active' ? (
                          <button
                            onClick={() => handleSuspend(g)}
                            title="Suspend Gym"
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(g)}
                            title="Activate Gym"
                            className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
