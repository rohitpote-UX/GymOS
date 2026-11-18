import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Edit2,
  Eye,
  Key,
  LifeBuoy,
  LogOut,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

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
  saas_plan_id?: number;
  plan?: {
    id: number;
    name: string;
  };
}

interface SaasPlanItem {
  id: number;
  name: string;
  price: number;
  interval: string;
}

interface PlatformTicket {
  id: number;
  ticket_number: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
  gym?: {
    id: number;
    name: string;
    slug: string;
  };
  creator?: {
    id: number;
    name: string;
    email: string;
  };
  messages?: Array<{
    id: number;
    message: string;
    created_at: string;
    user?: {
      name: string;
      role: string;
    };
  }>;
}

interface AuditRecord {
  id: number;
  event: string;
  ip_address: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
  payload?: Record<string, any>;
}

export const AdminDashboard: React.FC = () => {
  const { user, impersonate, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'gyms' | 'tickets' | 'audit'>('gyms');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [plans, setPlans] = useState<SaasPlanItem[]>([]);
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editGymModal, setEditGymModal] = useState<GymRecord | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<GymRecord | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPlanId, setRegPlanId] = useState<number | ''>('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regOwnerEmail, setRegOwnerEmail] = useState('');
  const [regOwnerPassword, setRegOwnerPassword] = useState('Password@123');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPlanId, setEditPlanId] = useState<number | ''>('');

  // Reset Password State
  const [customPassword, setCustomPassword] = useState('');

  // Selected Ticket for reply
  const [selectedTicket, setSelectedTicket] = useState<PlatformTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [ticketStatusUpdate, setTicketStatusUpdate] = useState('');

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, gymsRes, plansRes] = await Promise.all([
        api.get<{ metrics: PlatformMetrics }>('/admin/overview'),
        api.get<{ data: GymRecord[] }>(`/admin/gyms${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api.get<SaasPlanItem[]>('/admin/plans').catch(() => ({ data: [] })),
      ]);
      setMetrics(overviewRes.data.metrics);
      setGyms(gymsRes.data.data);
      setPlans(plansRes.data || []);
      if (!regPlanId && plansRes.data && plansRes.data.length > 0) {
        setRegPlanId(plansRes.data[0].id);
      }
    } catch (err) {
      setToast(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await api.get<{ data: PlatformTicket[] }>('/admin/support-tickets');
      setTickets(res.data.data || []);
    } catch {
      // ignore
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get<{ data: AuditRecord[] }>('/admin/audit');
      setAuditLogs(res.data.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [search]);

  useEffect(() => {
    if (activeTab === 'tickets') fetchTickets();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

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

  const handleRegisterGym = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await api.post('/admin/gyms', {
        name: regName,
        email: regEmail,
        phone: regPhone,
        saas_plan_id: regPlanId,
        owner_name: regOwnerName,
        owner_email: regOwnerEmail,
        owner_password: regOwnerPassword,
      });

      setRegisterModalOpen(false);
      setToast(`Gym '${res.data.gym?.name}' onboarded successfully!`);
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegOwnerName('');
      setRegOwnerEmail('');
      fetchOverview();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGymSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGymModal) return;

    try {
      setIsSubmitting(true);
      await api.put(`/admin/gyms/${editGymModal.id}`, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        saas_plan_id: editPlanId ? Number(editPlanId) : undefined,
      });

      setEditGymModal(null);
      setToast('Gym details updated successfully.');
      fetchOverview();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal) return;

    try {
      setIsSubmitting(true);
      const res = await api.post(`/admin/gyms/${resetPasswordModal.id}/reset-owner-password`, {
        password: customPassword || undefined,
      });

      setTempPasswordResult(res.data.temporary_password);
      setToast(`Password reset for ${res.data.owner_email}`);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await api.post(`/admin/support-tickets/${selectedTicket.id}/reply`, {
        message: replyMessage,
        status: ticketStatusUpdate || undefined,
      });

      setSelectedTicket(res.data.ticket || null);
      setReplyMessage('');
      setToast('Reply sent to gym owner.');
      fetchTickets();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
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
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Super-Admin Control Plane</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  Platform Root
                </span>
              </h1>
              <p className="text-xs text-purple-400 font-medium">
                Multi-Tenant Oversight, SaaS Licensing & Enterprise Support
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="dropdown" />
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-purple-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard New Gym</span>
            </button>

            <button
              onClick={() => logout()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="p-3 bg-slate-800 border border-purple-500/40 rounded-xl text-xs text-purple-300 flex items-center justify-between">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('gyms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'gyms'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Gym Tenants Directory</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
              {gyms.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Platform Support Tickets</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
              {tickets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* TAB 1: Gym Tenants Directory */}
        {activeTab === 'gyms' && (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <span>Gym Tenants Directory</span>
                </h2>
                <p className="text-xs text-slate-400">Manage tenant accounts, extend licenses, reset passwords, and impersonate owners</p>
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleImpersonate(g)}
                            title="Log in as Gym Owner (Customer Support)"
                            className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Impersonate</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditGymModal(g);
                              setEditName(g.name);
                              setEditEmail(g.email || '');
                              setEditPhone(g.phone || '');
                              setEditPlanId(g.saas_plan_id || (g.plan?.id || ''));
                            }}
                            title="Edit Gym Settings"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setResetPasswordModal(g);
                              setCustomPassword('');
                              setTempPasswordResult(null);
                            }}
                            title="Reset Owner Password"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleExtend(g, 30)}
                            title="Extend 30 Days"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer font-mono"
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
        )}

        {/* TAB 2: Platform Support Tickets */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${selectedTicket ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden`}>
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-purple-400" />
                  <span>Enterprise Support Requests (Owners ↔ Platform)</span>
                </h3>
              </div>

              {tickets.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">No platform support tickets open.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Ticket</th>
                        <th className="py-2.5 px-3">Gym & Owner</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {tickets.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTicket(t)}
                          className={`hover:bg-slate-800/40 cursor-pointer ${
                            selectedTicket?.id === t.id ? 'bg-purple-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-purple-400">{t.ticket_number}</td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-white block">{t.gym?.name}</span>
                            <span className="text-[10px] text-slate-400">{t.creator?.email}</span>
                          </td>
                          <td className="py-3 px-3 text-white max-w-xs truncate">{t.subject}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Selected Ticket Thread */}
            {selectedTicket && (
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl flex flex-col h-[520px] overflow-hidden">
                <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-purple-400 font-bold text-xs">{selectedTicket.ticket_number}</span>
                    <h4 className="text-xs font-bold text-white truncate mt-0.5">{selectedTicket.subject}</h4>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs text-slate-200">
                    <span className="text-[10px] text-purple-400 font-semibold block mb-1">
                      {selectedTicket.creator?.name} ({selectedTicket.gym?.name}):
                    </span>
                    <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>

                  {(selectedTicket.messages || []).map((m) => (
                    <div key={m.id} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 text-xs text-slate-200">
                      <span className="text-[10px] text-slate-400 block mb-0.5">
                        {m.user?.name} ({m.user?.role}):
                      </span>
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
                  <select
                    value={ticketStatusUpdate}
                    onChange={(e) => setTicketStatusUpdate(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="">Status: Keep Current ({selectedTicket.status})</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  <form onSubmit={handleTicketReply} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Post official Super-Admin reply..."
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !replyMessage.trim()}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Platform Audit Trail</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Event</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">IP Address</th>
                    <th className="py-2.5 px-4">Payload Snippet</th>
                    <th className="py-2.5 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {auditLogs.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-purple-400 font-semibold">{a.event}</td>
                      <td className="py-3 px-4 text-white">{a.user?.name || 'System / Platform'}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{a.ip_address || '—'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                        {a.payload ? JSON.stringify(a.payload) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 text-[11px]">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Onboard New Gym Modal */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>Onboard New Gym Tenant</span>
              </h3>
              <button onClick={() => setRegisterModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterGym} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Gym Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Iron Forge Fitness"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Gym Email</label>
                  <input
                    type="email"
                    required
                    placeholder="info@ironforge.in"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phone (+91)</label>
                  <input
                    type="text"
                    required
                    placeholder="9820011223"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">SaaS Plan</label>
                  <select
                    value={regPlanId}
                    onChange={(e) => setRegPlanId(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price}/{p.interval})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-2">
                  Owner Admin User Account
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Owner Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Vikram Rathore"
                      value={regOwnerName}
                      onChange={(e) => setRegOwnerName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Owner Login Email</label>
                    <input
                      type="email"
                      required
                      placeholder="vikram@ironforge.in"
                      value={regOwnerEmail}
                      onChange={(e) => setRegOwnerEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Initial Password</label>
                  <input
                    type="text"
                    required
                    value={regOwnerPassword}
                    onChange={(e) => setRegOwnerPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Onboarding...' : 'Create Gym Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Gym Modal */}
      {editGymModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Edit Gym: {editGymModal.name}</h3>
              <button onClick={() => setEditGymModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditGymSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Gym Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Gym Email</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Gym Phone</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">SaaS Plan</label>
                <select
                  value={editPlanId}
                  onChange={(e) => setEditPlanId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price}/{p.interval})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditGymModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Owner Password Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Reset Owner Password</span>
              </h3>
              <button onClick={() => setResetPasswordModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Reset password for owner of <span className="font-semibold text-white">"{resetPasswordModal.name}"</span>.
              All active sessions for this owner will be revoked immediately for security.
            </p>

            {tempPasswordResult ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <span className="text-xs text-emerald-400 font-bold block">Password Successfully Reset!</span>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-sm text-white select-all text-center">
                  {tempPasswordResult}
                </div>
                <p className="text-[11px] text-slate-400">Share this temporary password securely with the gym owner.</p>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Set Custom Password (or leave empty to auto-generate random 12-char password)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generate secure password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
