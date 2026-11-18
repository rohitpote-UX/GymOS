import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  LifeBuoy,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface SupportTicket {
  id: number;
  ticket_number: string;
  scope: 'gym_member' | 'saas_platform';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    member_code: string;
    phone: string;
  };
  creator?: {
    id: number;
    name: string;
    role: string;
  };
  assignee?: {
    id: number;
    name: string;
    role: string;
  };
  messages?: Array<{
    id: number;
    message: string;
    created_at: string;
    user?: {
      id: number;
      name: string;
      role: string;
    };
  }>;
}

export default function SupportTickets() {
  const { user } = useAuth();
  const [activeScope, setActiveScope] = useState<'gym_member' | 'saas_platform'>('gym_member');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Ticket for Drawer / Thread
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Create Ticket Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newScope, setNewScope] = useState<'gym_member' | 'saas_platform'>('gym_member');
  const [newCategory, setNewCategory] = useState('equipment');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMemberId, setNewMemberId] = useState<string>('');
  const [membersList, setMembersList] = useState<Array<{ id: number; first_name: string; last_name: string; member_code: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { scope: activeScope };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;

      const res = await api.get('/support-tickets', { params });
      setTickets(res.data.tickets?.data || res.data.tickets || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await api.get('/members', { params: { per_page: 50 } });
      setMembersList(res.data.members?.data || res.data.members || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeScope, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleOpenTicketDetails = async (ticket: SupportTicket) => {
    try {
      const res = await api.get(`/support-tickets/${ticket.id}`);
      setSelectedTicket(res.data.ticket || ticket);
    } catch {
      setSelectedTicket(ticket);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setSendingReply(true);
      const res = await api.post(`/support-tickets/${selectedTicket.id}/messages`, {
        message: replyText,
      });

      // Update active ticket
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              messages: [...(prev.messages || []), res.data.ticket_message || res.data.message],
            }
          : null
      );
      setReplyText('');
      fetchTickets();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
    try {
      await api.put(`/support-tickets/${ticketId}/status`, { status: newStatus });
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus as any } : null));
      }
      fetchTickets();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/support-tickets', {
        scope: newScope,
        category: newCategory,
        priority: newPriority,
        subject: newSubject,
        description: newDescription,
        member_id: newScope === 'gym_member' && newMemberId ? Number(newMemberId) : null,
      });

      setCreateModalOpen(false);
      setNewSubject('');
      setNewDescription('');
      setNewMemberId('');
      fetchTickets();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.ticket_number.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.member?.first_name && t.member.first_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-emerald-400" />
              <span>Support & Helpdesk Management</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Unified ticketing separating member facility requests from SaaS platform enterprise support.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchTickets()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open New Ticket</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Scope Selector Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveScope('gym_member')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeScope === 'gym_member'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Gym Member Requests</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
            {activeScope === 'gym_member' ? tickets.length : ''}
          </span>
        </button>

        <button
          onClick={() => setActiveScope('saas_platform')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeScope === 'saas_platform'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>SaaS Platform Support (Owner ↔ Super Admin)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
            {activeScope === 'saas_platform' ? tickets.length : ''}
          </span>
        </button>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket #, subject or member..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tickets Table & Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className={`${selectedTicket ? 'lg:col-span-2' : 'lg:col-span-3'} bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden`}>
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Loading tickets...</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span className="font-semibold text-slate-200 text-sm">No tickets found</span>
              <span className="text-slate-500">All member and platform inquiries are addressed.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Subject & Context</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredTickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => handleOpenTicketDetails(t)}
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        selectedTicket?.id === t.id ? 'bg-slate-800/60' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-emerald-400 font-bold block">{t.ticket_number}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{t.category}</span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-white truncate">{t.subject}</div>
                        {t.member && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            Member: {t.member.first_name} {t.member.last_name || ''} ({t.member.member_code})
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.priority === 'urgent'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : t.priority === 'high'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            t.status === 'resolved' || t.status === 'closed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Ticket Thread Drawer */}
        {selectedTicket && (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden shadow-xl">
            {/* Thread Header */}
            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 font-bold text-xs">
                    {selectedTicket.ticket_number}
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300 capitalize">
                    {selectedTicket.category}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-white mt-1">{selectedTicket.subject}</h3>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Change Strip */}
            <div className="p-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">Status:</span>
              <select
                value={selectedTicket.status}
                onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
              {/* Original Description */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    Created by: {selectedTicket.creator?.name || 'User'}
                  </span>
                  <span>{new Date(selectedTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Messages Thread */}
              {(selectedTicket.messages || []).map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-900 border border-slate-800/70 rounded-xl p-3 text-xs text-slate-200 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-emerald-400">
                      {msg.user?.name || 'Staff Responder'} ({msg.user?.role || 'Staff'})
                    </span>
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Reply Composer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Post an update or resolution note..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Create Support Ticket</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Ticket Scope</label>
                  <select
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="gym_member">Gym Member Issue</option>
                    <option value="saas_platform">SaaS Platform Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="equipment">Equipment Breakdown / Repair</option>
                  <option value="locker">Locker Assignment / Jam</option>
                  <option value="cleanliness">Cleanliness & Hygiene</option>
                  <option value="billing">Fee Billing & Invoices</option>
                  <option value="trainer">Trainer Feedback</option>
                  <option value="software_bug">Software Bug (SaaS)</option>
                  <option value="feature_request">Feature Request</option>
                </select>
              </div>

              {newScope === 'gym_member' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Associated Member (Optional)
                  </label>
                  <select
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="">No specific member / General gym issue</option>
                    {membersList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.member_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Broken incline bench cable on 2nd floor"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide context, machine number, or steps to reproduce..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newSubject || !newDescription}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
