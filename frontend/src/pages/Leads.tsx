import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Target,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Lead {
  id: number;
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  source: string;
  fitness_goal: string;
  status: 'new' | 'contacted' | 'trial_booked' | 'converted' | 'lost';
  followup_date?: string;
  trial_date?: string;
  trial_status?: string;
  lost_reason?: string;
  notes?: string;
  assigned_staff?: { id: number; name: string };
  followups?: Array<{
    id: number;
    type: string;
    summary: string;
    followup_date: string;
    next_followup_date?: string;
    user?: { name: string };
  }>;
}

interface PipelineStats {
  new?: number;
  contacted?: number;
  trial_booked?: number;
  converted?: number;
  lost?: number;
  total?: number;
}

export default function Leads() {
  const { t } = useTranslation();
  const { activeBranchId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<PipelineStats>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');

  // Plans & Staff for conversion & assignment
  const [plans, setPlans] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [followupModalLead, setFollowupModalLead] = useState<Lead | null>(null);
  const [trialModalLead, setTrialModalLead] = useState<Lead | null>(null);
  const [convertModalLead, setConvertModalLead] = useState<Lead | null>(null);
  const [lostModalLead, setLostModalLead] = useState<Lead | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Lead Form
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'male',
    source: 'walk_in',
    fitness_goal: 'general_fitness',
    followup_date: new Date().toISOString().split('T')[0],
    assigned_user_id: '',
    notes: '',
  });

  // Follow-up Form
  const [followupForm, setFollowupForm] = useState({
    type: 'call',
    summary: '',
    next_followup_date: '',
    update_status: '',
  });

  // Trial Form
  const [trialForm, setTrialForm] = useState({
    trial_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Convert Form
  const [convertForm, setConvertForm] = useState({
    gender: 'male',
    membership_plan_id: '',
    paid_amount: '',
    discount_amount: '0',
    payment_method: 'upi',
  });

  // Lost Form
  const [lostReason, setLostReason] = useState('joined_another_gym');
  const [lostNotes, setLostNotes] = useState('');

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (activeBranchId) params.branch_id = String(activeBranchId);

      const [resLeads, resPlans, resStaff] = await Promise.all([
        api.get('/leads', { params }),
        api.get('/membership-plans'),
        api.get('/staff'),
      ]);

      setLeads(resLeads.data.data || resLeads.data || []);
      setStats(resLeads.data.counts || {});
      setPlans(resPlans.data || []);
      setStaffList(resStaff.data || []);
    } catch (err: any) {
      console.error('Failed to load leads', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [activeBranchId, statusFilter, sourceFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/leads', {
        ...newLeadForm,
        branch_id: activeBranchId,
      });
      setSuccess('New enquiry captured successfully.');
      setCreateModalOpen(false);
      setNewLeadForm({
        name: '',
        phone: '',
        email: '',
        gender: 'male',
        source: 'walk_in',
        fitness_goal: 'general_fitness',
        followup_date: new Date().toISOString().split('T')[0],
        assigned_user_id: '',
        notes: '',
      });
      fetchLeads();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to capture enquiry.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupModalLead) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/leads/${followupModalLead.id}/follow-up`, followupForm);
      setSuccess(`Follow-up logged for ${followupModalLead.name}.`);
      setFollowupModalLead(null);
      setFollowupForm({ type: 'call', summary: '', next_followup_date: '', update_status: '' });
      fetchLeads();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to log follow-up.');
    } finally {
      setSaving(false);
    }
  };

  const handleBookTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialModalLead) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/leads/${trialModalLead.id}/book-trial`, trialForm);
      setSuccess(`Trial booked for ${trialModalLead.name} on ${trialForm.trial_date}.`);
      setTrialModalLead(null);
      fetchLeads();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to book trial.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertModalLead) return;
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        gender: convertForm.gender,
      };
      if (convertForm.membership_plan_id) {
        payload.membership_plan_id = convertForm.membership_plan_id;
        payload.paid_amount = parseFloat(convertForm.paid_amount) || 0;
        payload.discount_amount = parseFloat(convertForm.discount_amount) || 0;
        payload.payment_method = convertForm.payment_method;
      }

      await api.post(`/leads/${convertModalLead.id}/convert`, payload);
      setSuccess(`🎉 Congratulations! Lead ${convertModalLead.name} has been converted into an active Member!`);
      setConvertModalLead(null);
      fetchLeads();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert lead.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostModalLead) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/leads/${lostModalLead.id}/mark-lost`, {
        lost_reason: lostReason,
        notes: lostNotes,
      });
      setSuccess(`Lead ${lostModalLead.name} marked as lost.`);
      setLostModalLead(null);
      fetchLeads();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark lost.');
    } finally {
      setSaving(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(s) ||
      l.phone.includes(s) ||
      (l.email && l.email.toLowerCase().includes(s))
    );
  });

  const total = Number(stats.total || leads.length || 0);
  const converted = Number(stats.converted || 0);
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-400" />
            {t('leads.title', 'Leads & Enquiries CRM')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('leads.subtitle', 'Capture prospective gym enquiries, schedule trial sessions, and convert into paying members.')}
          </p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setCreateModalOpen(true);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          {t('leads.add_lead', 'Capture Enquiry')}
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Pipeline Metric Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate block">Total Leads</span>
          <div className="text-lg sm:text-xl font-bold text-white mt-1">{total}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider truncate block">New</span>
          <div className="text-lg sm:text-xl font-bold text-blue-400 mt-1">{stats.new || 0}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider truncate block">Contacted</span>
          <div className="text-lg sm:text-xl font-bold text-amber-400 mt-1">{stats.contacted || 0}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider truncate block">Trials Booked</span>
          <div className="text-lg sm:text-xl font-bold text-purple-400 mt-1">{stats.trial_booked || 0}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider truncate block">Converted</span>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">{stats.converted || 0}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate block">Conversion %</span>
          <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <span>{conversionRate}%</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/40 border border-slate-800/80 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search lead by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#131b2e] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#131b2e] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="trial_booked">Trial Booked</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="bg-[#131b2e] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Sources</option>
          <option value="walk_in">Walk-in</option>
          <option value="instagram">Instagram</option>
          <option value="google">Google</option>
          <option value="referral">Referral</option>
          <option value="website">Website</option>
          <option value="phone_enquiry">Phone Call</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No enquiries found</p>
            <p className="text-xs text-slate-500 mt-1">Capture new prospect details using the button above.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-slate-800/70">
              {filteredLeads.map((lead) => {
                const isConverted = lead.status === 'converted';
                const isLost = lead.status === 'lost';
                return (
                  <div key={lead.id} className="p-4 hover:bg-slate-800/30 transition-colors space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-sm text-white">{lead.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 capitalize font-medium">
                            {lead.source.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">
                            Goal: {lead.fitness_goal.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          lead.status === 'converted'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : lead.status === 'trial_booked'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : lead.status === 'contacted'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : lead.status === 'lost'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {lead.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div className="space-y-0.5">
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-emerald-400 font-mono text-xs flex items-center gap-1 hover:underline"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone}</span>
                        </a>
                        {lead.email && <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{lead.email}</div>}
                      </div>

                      <div className="text-right text-[11px] font-mono">
                        {lead.followup_date && (
                          <div className="text-amber-400 flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            <span>{lead.followup_date}</span>
                          </div>
                        )}
                        {lead.trial_date && (
                          <div className="text-purple-400 font-semibold">
                            Trial: {lead.trial_date}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-[11px] text-slate-400">
                        {lead.assigned_staff?.name ? `Staff: ${lead.assigned_staff.name}` : 'Unassigned'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {!isConverted && !isLost && (
                          <>
                            <button
                              onClick={() => {
                                setError(null);
                                setFollowupModalLead(lead);
                              }}
                              className="p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl bg-slate-800 border border-slate-700 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                              title="Call / Chat"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setError(null);
                                setTrialModalLead(lead);
                              }}
                              className="p-2 hover:bg-purple-500/20 text-purple-300 rounded-xl bg-slate-800 border border-slate-700 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                              title="Book Trial"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setError(null);
                                setConvertModalLead(lead);
                              }}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer text-xs flex items-center gap-1 min-h-[38px]"
                              title="Convert to Member"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Convert
                            </button>
                            <button
                              onClick={() => {
                                setError(null);
                                setLostModalLead(lead);
                              }}
                              className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                              title="Mark Lost"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {isConverted && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Active Member
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                    <th className="py-3 px-4">Lead Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Fitness Goal</th>
                    <th className="py-3 px-4">Follow-up</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Owner / Staff</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLeads.map((lead) => {
                    const isConverted = lead.status === 'converted';
                    const isLost = lead.status === 'lost';
                    return (
                      <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{lead.name}</div>
                          {lead.gender && (
                            <span className="text-[10px] text-slate-500 capitalize">{lead.gender}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
                          </div>
                          {lead.email && <div className="text-[10px] text-slate-500">{lead.email}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 capitalize font-medium">
                            {lead.source.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 capitalize">
                          {lead.fitness_goal.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          {lead.followup_date ? (
                            <div className="flex items-center gap-1 font-mono text-slate-300">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {lead.followup_date}
                            </div>
                          ) : (
                            '—'
                          )}
                          {lead.trial_date && (
                            <div className="text-[10px] text-purple-400 font-medium">
                              Trial: {lead.trial_date}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              lead.status === 'converted'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : lead.status === 'trial_booked'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : lead.status === 'contacted'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : lead.status === 'lost'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {lead.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {lead.assigned_staff?.name || 'Unassigned'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isConverted && !isLost && (
                              <>
                                <button
                                  onClick={() => {
                                    setError(null);
                                    setFollowupModalLead(lead);
                                  }}
                                  className="p-1.5 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Log Follow-up Call / Chat"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setError(null);
                                    setTrialModalLead(lead);
                                  }}
                                  className="p-1.5 hover:bg-purple-500/10 text-slate-300 hover:text-purple-400 rounded-lg transition-colors cursor-pointer"
                                  title="Book Free Trial"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setError(null);
                                    setConvertModalLead(lead);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                                  title="Convert Lead to Member"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  Convert
                                </button>
                                <button
                                  onClick={() => {
                                    setError(null);
                                    setLostModalLead(lead);
                                  }}
                                  className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                  title="Mark Lost"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {isConverted && (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active Member
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Capture Enquiry Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Capture New Lead Enquiry
              </h2>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Prospect Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Batra"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="98200XXXXX"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="vikram@gmail.com"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Lead Source *</label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="walk_in">Walk-in</option>
                    <option value="instagram">Instagram</option>
                    <option value="google">Google Search / Ads</option>
                    <option value="referral">Member Referral</option>
                    <option value="phone_enquiry">Phone Call</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Fitness Goal</label>
                  <select
                    value={newLeadForm.fitness_goal}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, fitness_goal: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="weight_loss">Weight Loss</option>
                    <option value="muscle_gain">Muscle Building</option>
                    <option value="general_fitness">General Fitness</option>
                    <option value="bodybuilding">Bodybuilding</option>
                    <option value="personal_training">Personal Training</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={newLeadForm.followup_date}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, followup_date: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Assigned Staff</label>
                  <select
                    value={newLeadForm.assigned_user_id}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, assigned_user_id: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Enquiry Notes</label>
                <textarea
                  rows={2}
                  placeholder="Budget, timing preferences, previous gym experience..."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Follow-up Modal */}
      {followupModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-amber-400" />
                Log Follow-up: {followupModalLead.name}
              </h2>
              <button onClick={() => setFollowupModalLead(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleLogFollowup} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Interaction Type *</label>
                  <select
                    value={followupForm.type}
                    onChange={(e) => setFollowupForm({ ...followupForm, type: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="call">Phone Call</option>
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="in_person">In-Person Visit</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Next Follow-up Date</label>
                  <input
                    type="date"
                    value={followupForm.next_followup_date}
                    onChange={(e) => setFollowupForm({ ...followupForm, next_followup_date: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Discussion Summary *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What was discussed with prospect? What was their feedback?"
                  value={followupForm.summary}
                  onChange={(e) => setFollowupForm({ ...followupForm, summary: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setFollowupModalLead(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold px-5 py-2 rounded-xl cursor-pointer">
                  {saving ? 'Saving...' : 'Record Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Convert Lead Modal */}
      {convertModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                Convert Enquiry to Member: {convertModalLead.name}
              </h2>
              <button onClick={() => setConvertModalLead(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              This will automatically create a formal Member record with a unique member code (e.g. MEM-000X) and enrol them in the selected membership package.
            </p>

            <form onSubmit={handleConvertLead} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Select Membership Plan</label>
                <select
                  value={convertForm.membership_plan_id}
                  onChange={(e) => {
                    const planId = e.target.value;
                    const selected = plans.find((p) => String(p.id) === planId);
                    setConvertForm({
                      ...convertForm,
                      membership_plan_id: planId,
                      paid_amount: selected ? String(selected.price) : '',
                    });
                  }}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">No Plan (Register Member Only)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.price).toLocaleString('en-IN')} ({p.duration_days} Days)
                    </option>
                  ))}
                </select>
              </div>

              {convertForm.membership_plan_id && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Amount Paid Today (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={convertForm.paid_amount}
                        onChange={(e) => setConvertForm({ ...convertForm, paid_amount: e.target.value })}
                        className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Discount Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={convertForm.discount_amount}
                        onChange={(e) => setConvertForm({ ...convertForm, discount_amount: e.target.value })}
                        className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Payment Method</label>
                    <select
                      value={convertForm.payment_method}
                      onChange={(e) => setConvertForm({ ...convertForm, payment_method: e.target.value })}
                      className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="upi">UPI / GPay / Paytm</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card / POS</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setConvertModalLead(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer">
                  {saving ? 'Converting...' : 'Convert to Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Trial Modal */}
      {trialModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Book Trial Session: {trialModalLead.name}
              </h2>
              <button onClick={() => setTrialModalLead(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleBookTrial} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Trial Workout Date *</label>
                <input
                  type="date"
                  required
                  value={trialForm.trial_date}
                  onChange={(e) => setTrialForm({ ...trialForm, trial_date: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Workout Notes / Target Machine</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Free weights introduction, legs machine demo..."
                  value={trialForm.notes}
                  onChange={(e) => setTrialForm({ ...trialForm, notes: e.target.value })}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setTrialModalLead(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer">
                  {saving ? 'Booking...' : 'Confirm Trial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Lost Modal */}
      {lostModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                Mark Lead as Lost: {lostModalLead.name}
              </h2>
              <button onClick={() => setLostModalLead(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleMarkLost} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Reason for Lost Lead *</label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="too_expensive">Membership Fees Too High / Budget Issue</option>
                  <option value="joined_another_gym">Joined Another Gym / Competitor</option>
                  <option value="distance_location">Distance / Location Inconvenient</option>
                  <option value="timing_issue">Workout Timings Incompatible</option>
                  <option value="no_response">Unresponsive / Did Not Answer Calls</option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Feedback Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any competitor details or pricing feedback..."
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setLostModalLead(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer">
                  {saving ? 'Updating...' : 'Confirm Lost'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
