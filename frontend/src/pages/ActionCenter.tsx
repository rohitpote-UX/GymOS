import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  TrendingDown,
  User,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatDate } from '../lib/formatters';

interface ActionItem {
  id: number;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description?: string;
  reference_type?: string;
  reference_id?: number;
  metadata?: Record<string, any>;
  status: 'pending' | 'in_progress' | 'resolved' | 'cancelled';
  due_date?: string;
  created_at: string;
  assignee?: {
    id: number;
    name: string;
    role: string;
  };
  resolver?: {
    id: number;
    name: string;
  };
  resolution_notes?: string;
}

interface TriageRadar {
  expiring_memberships: number;
  overdue_payments: number;
  inactive_members_10d: number;
  low_stock_items: number;
  expiring_products_30d: number;
  uncontacted_leads_24h: number;
  unresolved_tickets: number;
  pending_pt_sessions: number;
  critical_categories: number;
  warning_categories: number;
}

interface StaffMember {
  id: number;
  name: string;
  role: string;
}

export default function ActionCenter() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user, activeBranch } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [radar, setRadar] = useState<TriageRadar | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [severityFilter, setSeverityFilter] = useState<string>(searchParams.get('severity') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || searchParams.get('search') || '');

  // Modals state
  const [assignModalItem, setAssignModalItem] = useState<ActionItem | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [resolveModalItem, setResolveModalItem] = useState<ActionItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Item Form State
  const [newType, setNewType] = useState('manual_task');
  const [newSeverity, setNewSeverity] = useState<'critical' | 'warning' | 'info'>('warning');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState('');

  const fetchActionCenterData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;

      const res = await api.get('/action-center', { params });
      setItems(res.data.items?.data || res.data.items || []);
      setRadar(res.data.radar || null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff');
      setStaffList(res.data.staff || res.data.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchActionCenterData();
    fetchStaff();
  }, [statusFilter, severityFilter]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalItem || !selectedStaffId) return;

    try {
      setIsSubmitting(true);
      await api.post(`/action-center/${assignModalItem.id}/assign`, {
        user_id: Number(selectedStaffId),
      });
      setAssignModalItem(null);
      fetchActionCenterData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveModalItem) return;

    try {
      setIsSubmitting(true);
      await api.post(`/action-center/${resolveModalItem.id}/resolve`, {
        resolution_notes: resolutionNotes,
      });
      setResolveModalItem(null);
      setResolutionNotes('');
      fetchActionCenterData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/action-center', {
        type: newType,
        severity: newSeverity,
        title: newTitle,
        description: newDescription,
        assigned_to_user_id: newAssigneeId ? Number(newAssigneeId) : null,
        due_date: newDueDate || null,
      });
      setCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      fetchActionCenterData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      (item.assignee?.name && item.assignee.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{t('actionCenter.title', 'Action Center')}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                {t('actionCenter.live_radar', 'Live Radar')}
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('actionCenter.subtitle', 'Central operations radar: triage expiring plans, dues and inactive members')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchActionCenterData()}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('actionCenter.refresh', 'Refresh')}</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('actionCenter.create_action', 'Create Action')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Operational Triage Radar Grid */}
      {radar && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <button
            onClick={() => setSearchQuery(searchQuery === 'expiring' ? '' : 'expiring')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'expiring'
                ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-500/30'
                : radar.expiring_memberships > 0
                ? 'border-amber-500/30 hover:border-amber-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.expiring_memberships > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.expiring_7d', 'Expiring 7D')}</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.expiring_memberships > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {radar.expiring_memberships}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.need_renewals', 'Need renewals')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'due' ? '' : 'due')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'due'
                ? 'border-rose-400 bg-rose-500/10 ring-2 ring-rose-500/30'
                : radar.overdue_payments > 0
                ? 'border-rose-500/30 hover:border-rose-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.overdue_payments > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.overdue_dues', 'Overdue Dues')}</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.overdue_payments > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {radar.overdue_payments}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.members_owing', 'Members owing')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'inactive' ? '' : 'inactive')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'inactive'
                ? 'border-indigo-400 bg-indigo-500/10 ring-2 ring-indigo-500/30'
                : radar.inactive_members_10d > 0
                ? 'border-indigo-500/30 hover:border-indigo-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.inactive_members_10d > 0 ? 'text-indigo-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.inactive_10d', 'Inactive 10D')}</span>
              <UserMinus className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.inactive_members_10d > 0 ? 'text-indigo-400' : 'text-slate-300'}`}>
              {radar.inactive_members_10d}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.churn_danger', 'Churn danger')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'stock' ? '' : 'stock')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'stock'
                ? 'border-orange-400 bg-orange-500/10 ring-2 ring-orange-500/30'
                : radar.low_stock_items > 0
                ? 'border-orange-500/30 hover:border-orange-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.low_stock_items > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.low_stock', 'Low Stock')}</span>
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.low_stock_items > 0 ? 'text-orange-400' : 'text-slate-300'}`}>
              {radar.low_stock_items}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.below_threshold', 'Below threshold')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'batch' ? '' : 'batch')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'batch'
                ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-500/30'
                : radar.expiring_products_30d > 0
                ? 'border-amber-500/30 hover:border-amber-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.expiring_products_30d > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.expiring_batches', 'Expiring Batches')}</span>
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.expiring_products_30d > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {radar.expiring_products_30d}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.next_30_days', 'Next 30 days')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'lead' ? '' : 'lead')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'lead'
                ? 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-500/30'
                : radar.uncontacted_leads_24h > 0
                ? 'border-sky-500/30 hover:border-sky-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.uncontacted_leads_24h > 0 ? 'text-sky-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.cold_leads', 'Cold Leads')}</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.uncontacted_leads_24h > 0 ? 'text-sky-400' : 'text-slate-300'}`}>
              {radar.uncontacted_leads_24h}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.uncalled_24h', '>24h uncalled')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'ticket' ? '' : 'ticket')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'ticket'
                ? 'border-rose-400 bg-rose-500/10 ring-2 ring-rose-500/30'
                : radar.unresolved_tickets > 0
                ? 'border-rose-500/30 hover:border-rose-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.unresolved_tickets > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.open_tickets', 'Open Tickets')}</span>
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.unresolved_tickets > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {radar.unresolved_tickets}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.need_resolution', 'Need resolution')}</span>
          </button>

          <button
            onClick={() => setSearchQuery(searchQuery === 'pt' ? '' : 'pt')}
            className={`text-left bg-[#0f172a] border p-3 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
              searchQuery === 'pt'
                ? 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                : radar.pending_pt_sessions > 0
                ? 'border-emerald-500/30 hover:border-emerald-500/50'
                : 'border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className={`flex items-center justify-between ${radar.pending_pt_sessions > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider">{t('actionCenter.pending_pt', 'Pending PT')}</span>
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className={`mt-2 text-2xl font-black ${radar.pending_pt_sessions > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {radar.pending_pt_sessions}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">{t('actionCenter.unlogged_workouts', 'Unlogged workouts')}</span>
          </button>
        </div>
      )}

      {/* Control Bar: Search & Filters */}
      <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('actionCenter.search_placeholder', 'Search action items or assignees...')}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'all', label: t('actionCenter.status_all', 'All') },
              { id: 'pending', label: t('actionCenter.status_pending', 'Pending') },
              { id: 'in_progress', label: t('actionCenter.status_in_progress', 'In Progress') },
              { id: 'resolved', label: t('actionCenter.status_resolved', 'Resolved') },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'all', label: t('actionCenter.severity_all', 'All') },
              { id: 'critical', label: t('actionCenter.severity_critical', 'Critical') },
              { id: 'warning', label: t('actionCenter.severity_warning', 'Warning') },
              { id: 'info', label: t('actionCenter.severity_info', 'Info') },
            ].map((sev) => (
              <button
                key={sev.id}
                onClick={() => setSeverityFilter(sev.id)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                  severityFilter === sev.id
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Items List */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span>{t('actionCenter.scanning_registers', 'Scanning operational registers...')}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <span className="font-semibold text-slate-200 text-sm">{t('actionCenter.all_in_order', 'All operations in order')}</span>
            <span className="text-slate-500">{t('actionCenter.no_items_match', 'No pending operational triage items match current criteria.')}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">{t('actionCenter.col_severity_status', 'Severity & Status')}</th>
                  <th className="py-3 px-4">{t('actionCenter.col_action_context', 'Action Item & Context')}</th>
                  <th className="py-3 px-4">{t('actionCenter.col_category', 'Category')}</th>
                  <th className="py-3 px-4">{t('actionCenter.col_assigned_staff', 'Assigned Staff')}</th>
                  <th className="py-3 px-4">{t('actionCenter.col_due_date', 'Due Date')}</th>
                  <th className="py-3 px-4 text-right">{t('actionCenter.col_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Severity & Status */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.severity === 'critical'
                              ? 'bg-rose-500 animate-pulse'
                              : item.severity === 'warning'
                              ? 'bg-amber-400'
                              : 'bg-sky-400'
                          }`}
                        />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.severity === 'critical'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : item.severity === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          }`}
                        >
                          {item.severity}
                        </span>
                        <span
                          className={`text-[10px] capitalize px-1.5 py-0.5 rounded ${
                            item.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Action Item & Context */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-white truncate">{item.title}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.description}</div>
                      )}
                      {item.resolution_notes && (
                        <div className="text-[11px] text-emerald-400/90 italic mt-1 bg-emerald-950/20 p-1.5 rounded border border-emerald-900/30">
                          Resolution: {item.resolution_notes}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {item.type}
                      </span>
                    </td>

                    {/* Assigned Staff */}
                    <td className="py-3.5 px-4">
                      {item.assignee ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-200">{item.assignee.name}</span>
                          <span className="text-[10px] text-slate-500 capitalize">({item.assignee.role})</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">{t('actionCenter.unassigned', 'Unassigned')}</span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {item.due_date || new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status !== 'resolved' && (
                          <>
                            <button
                              onClick={() => {
                                setAssignModalItem(item);
                                setSelectedStaffId(item.assignee?.id || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 cursor-pointer"
                            >
                              {t('actionCenter.btn_assign', 'Assign')}
                            </button>
                            <button
                              onClick={() => {
                                setResolveModalItem(item);
                                setResolutionNotes('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold cursor-pointer"
                            >
                              {t('actionCenter.btn_resolve', 'Resolve')}
                            </button>
                          </>
                        )}
                        {item.status === 'resolved' && (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('actionCenter.btn_resolved', 'Resolved')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{t('actionCenter.assign_modal_title', 'Assign Staff Member')}</h3>
              <button
                onClick={() => setAssignModalItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {t('actionCenter.assign_modal_desc', 'Select who should take ownership of:')}{' '}
              <span className="font-semibold text-white">"{assignModalItem.title}"</span>
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('actionCenter.assign_select_staff', 'Select Staff')}</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{t('actionCenter.assign_choose_placeholder', 'Choose Staff Member...')}</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedStaffId}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t('actionCenter.assign_saving', 'Assigning...') : t('actionCenter.assign_btn_save', 'Save Assignment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{t('actionCenter.resolve_modal_title', 'Mark Action as Resolved')}</h3>
              <button
                onClick={() => setResolveModalItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {t('actionCenter.resolve_modal_desc', 'Confirm resolution for:')} <span className="font-semibold text-white">"{resolveModalItem.title}"</span>
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  {t('actionCenter.resolve_notes_label', 'Resolution Notes / Actions Taken')}
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={t('actionCenter.resolve_notes_placeholder', 'e.g. Called member; renewal fee collected via UPI.')}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !resolutionNotes}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t('actionCenter.resolve_saving', 'Resolving...') : t('actionCenter.resolve_btn_confirm', 'Confirm Resolution')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Action Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{t('actionCenter.create_modal_title', 'Create New Operational Task')}</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t('actionCenter.create_type_label', 'Type')}</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="manual_task">General Operational Task</option>
                    <option value="equipment_maintenance">Equipment Maintenance</option>
                    <option value="member_followup">Member Follow-up</option>
                    <option value="cleanliness_check">Sanitation / Cleanliness</option>
                    <option value="inventory_audit">Stock Audit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t('actionCenter.create_severity_label', 'Severity')}</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="critical">{t('actionCenter.severity_critical', 'Critical')}</option>
                    <option value="warning">{t('actionCenter.severity_warning', 'Warning')}</option>
                    <option value="info">{t('actionCenter.severity_info', 'Info')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t('actionCenter.create_title_label', 'Title')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('actionCenter.create_title_placeholder', 'e.g. Inspect Treadmill #3 motor noise')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t('actionCenter.create_desc_label', 'Description / Notes')}</label>
                <textarea
                  rows={2}
                  placeholder={t('actionCenter.create_desc_placeholder', 'Details and instructions for staff...')}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t('actionCenter.create_assign_label', 'Assign To')}</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="">{t('actionCenter.unassigned', 'Unassigned')}</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t('common.date', 'Due Date')}</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? t('common.loading', 'Creating...') : t('actionCenter.create_btn_save', 'Create Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
