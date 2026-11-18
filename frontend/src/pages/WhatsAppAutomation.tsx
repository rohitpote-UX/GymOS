import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  Globe,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface WhatsAppTemplate {
  id: number;
  template_name?: string;
  name: string;
  category: string;
  language?: string;
  body_text: string;
  variables: string[];
  is_active: boolean;
  meta_template_name?: string;
  meta_status?: string;
}

interface WhatsAppLog {
  id: number;
  recipient_phone: string;
  recipient_name: string;
  category: string;
  message_body: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  provider_message_id?: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export default function WhatsAppAutomation() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'logs' | 'templates'>('logs');
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter logs & templates
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [templateLangFilter, setTemplateLangFilter] = useState<'all' | 'en' | 'mr' | 'hi'>('all');

  // Edit template modal
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editBodyText, setEditBodyText] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Dispatch modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchCategory, setDispatchCategory] = useState('welcome');
  const [dispatchLanguage, setDispatchLanguage] = useState<'en' | 'mr' | 'hi'>('en');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>({
    member_name: '',
    plan_name: 'Annual Gold Elite',
    amount: '15000',
    expiry_date: '2027-02-18',
  });
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/whatsapp/templates', { params: { language: 'all' } });
      setTemplates(res.data.templates || []);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const res = await api.get('/whatsapp/logs', { params });
      setLogs(res.data.logs?.data || res.data.logs || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, [statusFilter, categoryFilter]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      setSavingTemplate(true);
      await api.put(`/whatsapp/templates/${editingTemplate.id}`, {
        body_text: editBodyText,
      });
      setEditingTemplate(null);
      fetchTemplates();
      setSuccessMessage('Template updated successfully');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSending(true);
      const res = await api.post('/whatsapp/send', {
        category: dispatchCategory,
        recipient_phone: recipientPhone,
        recipient_name: recipientName,
        variables: variableInputs,
        language: dispatchLanguage,
      });

      setDispatchModalOpen(false);
      setRecipientPhone('');
      setRecipientName('');
      setSuccessMessage(`Automated WhatsApp dispatched. Status: ${res.data.log?.status}`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchLogs();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: WhatsAppLog['status']) => {
    switch (status) {
      case 'read':
        return (
          <span className="flex items-center gap-1 text-sky-400 font-semibold bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full text-[10px]">
            <CheckCheck className="w-3 h-3 text-sky-400" /> Read
          </span>
        );
      case 'delivered':
        return (
          <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
            <CheckCheck className="w-3 h-3 text-emerald-400" /> Delivered
          </span>
        );
      case 'sent':
        return (
          <span className="flex items-center gap-1 text-slate-300 font-semibold bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full text-[10px]">
            <Check className="w-3 h-3" /> Sent
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full text-[10px]">
            <X className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px]">
            <Clock className="w-3 h-3" /> Queued
          </span>
        );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-emerald-400" />
              <span>WhatsApp Business Automation</span>
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Meta Cloud Platform
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated server-side notifications for receipts, renewals, check-ins, and follow-ups with full delivery receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchTemplates();
              fetchLogs();
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Logs</span>
          </button>
          <button
            onClick={() => setDispatchModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Notification</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Delivery Timeline & Logs</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
            {logs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Standard Business Templates</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
            {templates.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Delivery Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Filter Dispatches:</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="all">All Delivery Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="all">All Notification Categories</option>
                <option value="welcome">Membership Welcome</option>
                <option value="payment_receipt">Payment Receipt</option>
                <option value="renewal_reminder">Renewal Reminder</option>
                <option value="attendance">Attendance Notification</option>
                <option value="trial_booking">Trial Booking</option>
                <option value="lead_followup">Lead Follow-up</option>
                <option value="payment_due">Payment Due Reminder</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Fetching automated message stream...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 text-slate-600" />
                <span className="font-semibold text-slate-200 text-sm">No dispatches found</span>
                <span className="text-slate-500">Automated WhatsApp messages dispatched by the system will appear here.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Message Snippet</th>
                      <th className="py-3 px-4">Delivery Status</th>
                      <th className="py-3 px-4">Provider Ref</th>
                      <th className="py-3 px-4 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{log.recipient_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{log.recipient_phone}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px] capitalize">
                            {log.category.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-sm">
                          <p className="text-slate-300 truncate text-[11px] font-sans">{log.message_body}</p>
                          {log.error_message && (
                            <span className="text-[10px] text-rose-400 block mt-0.5 font-medium">
                              Error: {log.error_message}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">{getStatusBadge(log.status)}</td>

                        <td className="py-3.5 px-4">
                          <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[120px]">
                            {log.provider_message_id || 'LOCAL-SYNC'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-[11px]">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                          {new Date(log.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Standard Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Template Language Selector Pills */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400">भाषा / Language:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'en', label: 'English' },
              { id: 'mr', label: 'मराठी' },
              { id: 'hi', label: 'हिन्दी' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTemplateLangFilter(btn.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  templateLangFilter === btn.id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates
              .filter(
                (tpl) =>
                  templateLangFilter === 'all' || (tpl.language || 'en') === templateLangFilter
              )
              .map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{tpl.template_name || tpl.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                            {tpl.category}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-semibold uppercase">
                            {tpl.language === 'mr' ? 'मराठी' : tpl.language === 'hi' ? 'हिन्दी' : 'English'}
                          </span>
                        </h3>
                      </div>

                      <button
                        onClick={() => {
                          setEditingTemplate(tpl);
                          setEditBodyText(tpl.body_text);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="mt-3 bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-slate-200 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                      {tpl.body_text}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
                      Available Dynamic Placeholders:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(tpl.variables || []).map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 rounded bg-slate-800/80 text-emerald-400 text-[10px] font-mono border border-slate-700/60"
                        >
                          {'{' + v + '}'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Edit Template: {editingTemplate.name}</span>
              </h3>
              <button
                onClick={() => setEditingTemplate(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Template Body Text (Supports dynamic tags)
                </label>
                <textarea
                  rows={6}
                  value={editBodyText}
                  onChange={(e) => setEditBodyText(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block mb-1 font-semibold">
                  Allowed Placeholders for this template:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(editingTemplate.variables || []).map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setEditBodyText((prev) => prev + ` {${v}}`)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10px] font-mono border border-slate-700 cursor-pointer"
                    >
                      +{'{' + v + '}'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Send WhatsApp Notification</span>
              </h3>
              <button
                onClick={() => setDispatchModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Select Notification Type</label>
                <select
                  value={dispatchCategory}
                  onChange={(e) => setDispatchCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="welcome">Membership Welcome</option>
                  <option value="payment_receipt">Payment Receipt</option>
                  <option value="renewal_reminder">Renewal Reminder</option>
                  <option value="attendance">Attendance Notification</option>
                  <option value="trial_booking">Trial Booking Confirmation</option>
                  <option value="lead_followup">Lead Follow-up</option>
                  <option value="payment_due">Payment Due Notice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Language / भाषा</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'mr', label: 'मराठी' },
                    { id: 'hi', label: 'हिन्दी' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setDispatchLanguage(l.id as any)}
                      className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                        dispatchLanguage === l.id
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Recipient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohan Mehra"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    setVariableInputs((prev) => ({ ...prev, member_name: e.target.value }));
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Recipient Mobile (+91 / 10 digits)</label>
                <input
                  type="text"
                  required
                  placeholder="9899001122"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              {/* Dynamic Variables Override */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Template Variables</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Plan Name</label>
                    <input
                      type="text"
                      value={variableInputs.plan_name || ''}
                      onChange={(e) => setVariableInputs((prev) => ({ ...prev, plan_name: e.target.value }))}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Amount (INR)</label>
                    <input
                      type="text"
                      value={variableInputs.amount || ''}
                      onChange={(e) => setVariableInputs((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending || !recipientPhone || !recipientName}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSending ? 'Sending...' : 'Dispatch WhatsApp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
