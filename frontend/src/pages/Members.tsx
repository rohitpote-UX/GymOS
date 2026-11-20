import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  BookUser,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Dumbbell,
  ExternalLink,
  Filter,
  MessageCircle,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  QrCode,
  Receipt,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { openWhatsApp, WhatsAppTemplates } from '../lib/whatsapp';
import { formatCurrency, formatDate, formatNumber, normalizePhoneNumber, parseContactName } from '../lib/formatters';

interface MembershipPlan {
  id: number;
  name: string;
  duration_days: number;
  price: number;
}

interface Member {
  id: number;
  member_code: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone: string;
  gender?: string;
  status: 'active' | 'inactive' | 'expired' | 'frozen';
  joined_date?: string;
  photo_data?: string;
  total_fees_billed?: number | string;
  total_fees_paid?: number | string;
  outstanding_balance?: number | string;
  assigned_trainer_id?: number;
  trainer?: { id: number; name: string; specialization?: string; phone?: string };
  primary_branch?: {
    id: number;
    name: string;
  };
  active_membership?: {
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    category?: string;
    freeze_days_used?: number;
    plan: {
      id: number;
      name: string;
      max_freeze_days?: number;
    };
  };
}

interface MemberDetail extends Member {
  memberships?: Array<{
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    total_price: number;
    final_price: number;
    price_paid: number;
    balance_due: number;
    plan?: { name: string; max_freeze_days?: number };
    freezes?: Array<{ id: number; freeze_date: string; unfreeze_date?: string; days: number; reason: string }>;
  }>;
  payments?: Array<{
    id: number;
    receipt_number: string;
    amount: number;
    type: string;
    payment_method: string;
    payment_date: string;
  }>;
  attendance?: Array<{
    id: number;
    check_in_at: string;
    check_out_at?: string;
    method: string;
  }>;
  ledger?: Array<{
    id: number;
    transaction_date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    running_balance: number;
  }>;
  pos_orders?: Array<{
    id: number;
    order_number: string;
    order_date: string;
    total_amount: number | string;
    paid_amount: number | string;
    balance_due: number | string;
    payment_method: string;
    status: string;
    items?: Array<{
      id: number;
      product: { name: string; brand?: string };
      quantity: number;
      unit_price: number | string;
      total_amount: number | string;
    }>;
  }>;
}

export default function Members() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user, activeBranch, activeBranchId } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [hasDueFilter, setHasDueFilter] = useState(searchParams.get('has_due') === '1');

  // Detail Drawer State
  const [selectedMember, setSelectedMember] = useState<MemberDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'memberships' | 'ledger' | 'attendance' | 'store' | 'qr'>('profile');

  // Member Action Modals
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeDays, setFreezeDays] = useState(14);
  const [freezeReason, setFreezeReason] = useState('Medical leave / Traveling');

  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [extendReason, setExtendReason] = useState('Goodwill promotion');

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Relocation');
  const [refundAmount, setRefundAmount] = useState('0');
  const [refundMode, setRefundMode] = useState('cash');

  // Register Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Renew Membership Modal State (Phase 3D)
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewPlanId, setRenewPlanId] = useState('');
  const [renewPaidAmount, setRenewPaidAmount] = useState('');
  const [renewDiscountAmount, setRenewDiscountAmount] = useState('0');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('upi');
  const [renewNotes, setRenewNotes] = useState('Membership renewal');

  // Register Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('male');
  const [assignedTrainerId, setAssignedTrainerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Contact Picker & Duplicate / Lead Matching State
  const [contactPickerNotice, setContactPickerNotice] = useState<string | null>(null);
  const [duplicateMember, setDuplicateMember] = useState<Member | null>(null);
  const [matchedLead, setMatchedLead] = useState<any | null>(null);
  const [multiPhoneModal, setMultiPhoneModal] = useState<{
    name: string;
    numbers: string[];
  } | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (hasDueFilter) params.append('has_due', '1');
      if (activeBranchId) params.append('branch_id', activeBranchId.toString());

      const res = await api.get<{ data: Member[] }>(`/members?${params.toString()}`);
      setMembers(res.data.data);
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  };

  const fetchPlansAndTrainers = async () => {
    try {
      const [resPlans, resTrainers] = await Promise.all([
        api.get<MembershipPlan[]>('/membership-plans?active=1'),
        api.get<any[]>('/trainers'),
      ]);
      setPlans(resPlans.data);
      setTrainers(resTrainers.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchMembers();
    fetchPlansAndTrainers();
  }, [activeBranchId, statusFilter, hasDueFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembers();
  };

  const openMemberDetail = async (memberId: number) => {
    try {
      setDrawerLoading(true);
      setSelectedMember(null);
      setDrawerTab('profile');
      const res = await api.get(`/members/${memberId}`);
      setSelectedMember(res.data);
    } catch (err: any) {
      alert('Failed to load member detail: ' + errorMessage(err));
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (duplicateMember) {
      setError(
        t('members.duplicate_member_warning', {
          name: `${duplicateMember.first_name} ${duplicateMember.last_name || ''}`.trim(),
          code: duplicateMember.member_code,
          defaultValue: `A member with this mobile number already exists: ${duplicateMember.first_name} ${duplicateMember.last_name || ''} (${duplicateMember.member_code})`,
        })
      );
      return;
    }

    setSaving(true);
    try {
      const cleanPhone = normalizePhoneNumber(phone) || phone.trim();
      const payload: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName || null,
        phone: cleanPhone,
        email: email || null,
        gender,
        assigned_trainer_id: assignedTrainerId ? parseInt(assignedTrainerId, 10) : null,
        primary_branch_id: activeBranchId,
      };

      if (planId) {
        payload.membership_plan_id = parseInt(planId, 10);
        payload.paid_amount = parseFloat(paidAmount || '0');
        payload.discount_amount = parseFloat(discountAmount || '0');
        payload.payment_method = paymentMethod;
      }

      await api.post('/members', payload);
      setModalOpen(false);
      resetForm();
      fetchMembers();
      setSuccess('Member registered successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleFreezeMembership = async (membershipId: number) => {
    setSaving(true);
    try {
      await api.post(`/member-memberships/${membershipId}/freeze`, {
        freeze_days: freezeDays,
        reason: freezeReason,
      });
      setFreezeModalOpen(false);
      if (selectedMember) openMemberDetail(selectedMember.id);
      fetchMembers();
      setSuccess('Membership frozen successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUnfreezeMembership = async (membershipId: number) => {
    if (!confirm('Unfreeze membership now? Expiry date will be extended by frozen duration.')) return;
    try {
      await api.post(`/member-memberships/${membershipId}/unfreeze`);
      if (selectedMember) openMemberDetail(selectedMember.id);
      fetchMembers();
      setSuccess('Membership unfreezed successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      alert(errorMessage(err));
    }
  };

  const handleExtendMembership = async (membershipId: number) => {
    setSaving(true);
    try {
      await api.post(`/member-memberships/${membershipId}/extend`, {
        days: extendDays,
        reason: extendReason,
      });
      setExtendModalOpen(false);
      if (selectedMember) openMemberDetail(selectedMember.id);
      fetchMembers();
      setSuccess(`Membership extended by ${extendDays} days.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelMembership = async (membershipId: number) => {
    setSaving(true);
    try {
      await api.post(`/member-memberships/${membershipId}/cancel`, {
        reason: cancelReason,
        refund_amount: parseFloat(refundAmount) || 0,
        refund_payment_method: refundMode,
      });
      setCancelModalOpen(false);
      if (selectedMember) openMemberDetail(selectedMember.id);
      fetchMembers();
      setSuccess('Membership cancelled successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openRenewModal = () => {
    if (!selectedMember) return;
    const currentPlanId = selectedMember.active_membership?.plan?.id || plans[0]?.id;
    const plan = plans.find((p) => p.id === currentPlanId) || plans[0];
    setRenewPlanId(plan ? plan.id.toString() : '');
    setRenewPaidAmount(plan ? plan.price.toString() : '');
    setRenewDiscountAmount('0');
    setRenewPaymentMethod('upi');
    setRenewNotes('Membership renewal');
    setRenewModalOpen(true);
  };

  const handleRenewMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !renewPlanId) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/member-memberships/renew', {
        member_id: selectedMember.id,
        membership_plan_id: parseInt(renewPlanId, 10),
        paid_amount: parseFloat(renewPaidAmount || '0'),
        discount_amount: parseFloat(renewDiscountAmount || '0'),
        payment_method: renewPaymentMethod,
        notes: renewNotes,
      });
      setRenewModalOpen(false);
      openMemberDetail(selectedMember.id);
      fetchMembers();
      setSuccess('Membership renewed successfully! Financial ledger and expiry updated.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isContactPickerSupported = (): boolean => {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      'ContactsManager' in window &&
      typeof (navigator as any).contacts?.select === 'function'
    );
  };

  const handleChooseContact = async () => {
    setContactPickerNotice(null);

    if (!isContactPickerSupported()) {
      setContactPickerNotice(
        t('members.contact_unsupported', "Contact selection isn't supported on this device. Please enter the details manually.")
      );
      return;
    }

    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], {
        multiple: false,
      });

      if (!contacts || contacts.length === 0) {
        return; // User cancelled
      }

      const picked = contacts[0];
      const rawName = picked.name && picked.name[0] ? picked.name[0].trim() : '';
      const rawTels: string[] = (picked.tel || []).map((t: string) => t.trim()).filter(Boolean);

      if (rawTels.length === 0) {
        setContactPickerNotice(
          t('members.contact_no_phone', 'The selected contact does not have a phone number. Please enter mobile manually.')
        );
        if (rawName) {
          const { firstName: fName, lastName: lName } = parseContactName(rawName);
          if (fName && !firstName) setFirstName(fName);
          if (lName && !lastName) setLastName(lName);
        }
        return;
      }

      if (rawTels.length > 1) {
        setMultiPhoneModal({
          name: rawName,
          numbers: rawTels,
        });
      } else {
        await applyContactDetails(rawName, rawTels[0]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'SecurityError') {
        return;
      }
      setContactPickerNotice(
        t('members.contact_unsupported', "Contact selection isn't supported on this device. Please enter the details manually.")
      );
    }
  };

  const applyContactDetails = async (rawName: string, rawTel: string) => {
    const cleanTel = normalizePhoneNumber(rawTel);

    // Prompt before overwriting existing entered data if different
    if (
      (phone && normalizePhoneNumber(phone) !== cleanTel) ||
      (firstName && rawName && !rawName.toLowerCase().includes(firstName.toLowerCase()))
    ) {
      const confirmMsg = t('members.overwrite_confirm', {
        name: rawName || cleanTel,
        defaultValue: `Form already has member data. Replace with details from ${rawName || cleanTel}?`,
      });
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    // Populate name
    if (rawName) {
      const { firstName: fName, lastName: lName } = parseContactName(rawName);
      setFirstName(fName);
      setLastName(lName);
    }

    setPhone(cleanTel);
    setDuplicateMember(null);
    setMatchedLead(null);

    // 1. Check if member already exists
    try {
      const memberRes = await api.get<{ data: Member[] }>(`/members?search=${encodeURIComponent(cleanTel)}`);
      const existing = memberRes.data?.data?.find(
        (m) => normalizePhoneNumber(m.phone) === cleanTel || m.phone === cleanTel
      );
      if (existing) {
        setDuplicateMember(existing);
        setMatchedLead(null);
        return;
      }
    } catch {
      // ignore
    }

    // 2. Check if matches enquiry lead
    try {
      const leadRes = await api.get<{ data: any[] }>(`/leads?search=${encodeURIComponent(cleanTel)}`);
      if (leadRes.data?.data && leadRes.data.data.length > 0) {
        const lead = leadRes.data.data[0];
        setMatchedLead(lead);
        if (!rawName && lead.name) {
          const { firstName: lf, lastName: ll } = parseContactName(lead.name);
          setFirstName(lf);
          if (ll) setLastName(ll);
        }
        if (lead.email && !email) setEmail(lead.email);
        if (lead.gender && (!gender || gender === 'male')) setGender(lead.gender);
      }
    } catch {
      // ignore
    }
  };

  const handlePhoneBlur = async () => {
    const cleanTel = normalizePhoneNumber(phone);
    if (cleanTel.length >= 10) {
      // Duplicate member lookup
      try {
        const memberRes = await api.get<{ data: Member[] }>(`/members?search=${encodeURIComponent(cleanTel)}`);
        const existing = memberRes.data?.data?.find(
          (m) => normalizePhoneNumber(m.phone) === cleanTel || m.phone === cleanTel
        );
        if (existing) {
          setDuplicateMember(existing);
          setMatchedLead(null);
          return;
        } else {
          setDuplicateMember(null);
        }
      } catch {
        // ignore
      }

      // Lead auto-population
      if (!firstName) {
        try {
          const res = await api.get<{ data: any[] }>(`/leads?search=${encodeURIComponent(cleanTel)}`);
          if (res.data?.data && res.data.data.length > 0) {
            const lead = res.data.data[0];
            setMatchedLead(lead);
            const { firstName: lf, lastName: ll } = parseContactName(lead.name || '');
            setFirstName(lf);
            if (ll) setLastName(ll);
            if (lead.email) setEmail(lead.email);
            if (lead.gender) setGender(lead.gender);
          }
        } catch {
          // ignore lookup failure
        }
      }
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setGender('male');
    setAssignedTrainerId('');
    setPlanId('');
    setPaidAmount('');
    setDiscountAmount('0');
    setPaymentMethod('cash');
    setContactPickerNotice(null);
    setDuplicateMember(null);
    setMatchedLead(null);
    setMultiPhoneModal(null);
  };

  const sendWelcome = (m: Member) => {
    const text = WhatsAppTemplates.welcomeMember({
      gymName: user?.gym?.name || 'Our Gym',
      memberName: `${m.first_name} ${m.last_name || ''}`.trim(),
      memberCode: m.member_code,
      branchName: m.primary_branch?.name || activeBranch?.name || 'Main Branch',
    });
    openWhatsApp(m.phone, text);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>{t('members.title', 'Gym Members Directory')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('members.subtitle', 'Profiles, assigned trainers, outstanding dues, subscription freezing/extension & ledger audit')}
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
          <span>{t('members.add_member', 'Register Member')}</span>
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-[#0f172a] border border-slate-800 p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('members.search_placeholder', 'Search by name, phone, or MEM-xxxx...')}
            className="w-full bg-[#131b2e] border border-slate-700 text-xs rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#131b2e] border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">{t('common.all', 'All Statuses')}</option>
            <option value="active">{t('common.active', 'Active Members')}</option>
            <option value="frozen">{t('common.frozen', 'Frozen Subscriptions')}</option>
            <option value="expired">{t('common.expired', 'Expired Plans')}</option>
            <option value="inactive">{t('common.inactive', 'Inactive')}</option>
          </select>

          <button
            onClick={() => setHasDueFilter(!hasDueFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              hasDueFilter
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : 'bg-[#131b2e] text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>{t('action_center.tab_dues', 'Pending Dues Only')}</span>
          </button>
        </div>
      </div>

      {/* Members Table (Desktop) / Cards (Mobile) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden">
        {members.length > 0 ? (
          <>
            {/* Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-slate-800/70">
              {members.map((m) => {
                const hasActivePlan = Boolean(m.active_membership);
                const isFrozen = m.active_membership?.status === 'frozen';
                const due = Number(m.outstanding_balance || 0);

                return (
                  <div
                    key={m.id}
                    onClick={() => openMemberDetail(m.id)}
                    className="p-4 hover:bg-slate-800/40 transition-colors cursor-pointer space-y-3"
                  >
                    {/* Top Row: Avatar, Name, Member Code, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400 overflow-hidden shrink-0">
                          {m.photo_data ? (
                            <img src={m.photo_data} alt="" className="w-full h-full object-cover" />
                          ) : (
                            `${m.first_name[0]}${m.last_name?.[0] || ''}`
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-white truncate">
                            {m.first_name} {m.last_name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">{m.member_code}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          isFrozen
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : m.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isFrozen ? 'FROZEN' : m.status}
                      </span>
                    </div>

                    {/* Middle Row: Plan details, Phone & Trainer */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Plan</span>
                        <span className="text-white font-medium truncate block">
                          {hasActivePlan ? m.active_membership?.plan.name : '—'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Exp: {m.active_membership?.end_date ? formatDate(m.active_membership.end_date, i18n.language) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact / Trainer</span>
                        <a
                          href={`tel:${m.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 font-mono text-xs flex items-center gap-1 hover:underline truncate"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          {m.phone}
                        </a>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {m.trainer?.name ? `Coach: ${m.trainer.name}` : 'No trainer'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Due Status & Action Buttons */}
                    <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                      <div>
                        {due > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono inline-block">
                            {t('dashboard.outstanding_dues', 'Due')}: {formatCurrency(due, i18n.language)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs font-medium">Fees Cleared</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => sendWelcome(m)}
                          title="WhatsApp"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 text-xs cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => openMemberDetail(m.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer min-h-[38px] flex items-center justify-center"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">{t('members.full_name', 'Member')}</th>
                    <th className="py-3.5 px-4">{t('auth.phone', 'Contact')}</th>
                    <th className="py-3.5 px-4">{t('members.assigned_trainer', 'Trainer')}</th>
                    <th className="py-3.5 px-4">{t('members.plan', 'Active Plan')}</th>
                    <th className="py-3.5 px-4">{t('members.expires_on', 'Expiry Date')}</th>
                    <th className="py-3.5 px-4">{t('members.balance', 'Outstanding Due')}</th>
                    <th className="py-3.5 px-4">{t('common.status', 'Status')}</th>
                    <th className="py-3.5 px-4 text-right">{t('common.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {members.map((m) => {
                    const hasActivePlan = Boolean(m.active_membership);
                    const isFrozen = m.active_membership?.status === 'frozen';
                    const due = Number(m.outstanding_balance || 0);

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => openMemberDetail(m.id)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400 overflow-hidden shrink-0">
                              {m.photo_data ? (
                                <img src={m.photo_data} alt="" className="w-full h-full object-cover" />
                              ) : (
                                `${m.first_name[0]}${m.last_name?.[0] || ''}`
                              )}
                            </div>
                            <div>
                              <span className="font-semibold text-white block hover:text-emerald-400 transition-colors">
                                {m.first_name} {m.last_name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">{m.member_code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono">{m.phone}</td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {m.trainer?.name ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Dumbbell className="w-3 h-3" />
                              {m.trainer.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasActivePlan ? (
                            <span className="font-medium text-emerald-400">
                              {m.active_membership?.plan.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-mono">
                          {m.active_membership?.end_date ? formatDate(m.active_membership.end_date, i18n.language) : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {due > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono">
                              {t('dashboard.outstanding_dues', 'Due')}: {formatCurrency(due, i18n.language)}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px] font-medium">Cleared</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              isFrozen
                                ? 'bg-blue-500/15 text-blue-400'
                                : m.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {isFrozen ? 'FROZEN' : m.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => sendWelcome(m)}
                              title="Send WhatsApp Welcome"
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                            <button
                              onClick={() => openMemberDetail(m.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-white">
                {t('members.empty_title', 'No members added yet')}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {t('members.empty_desc', 'Start by registering your first gym member with their mobile number and plan.')}
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('members.add_member', 'Add First Member')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Member Detail Drawer / Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#0f172a] border-l border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-white text-base overflow-hidden">
                  {selectedMember.photo_data ? (
                    <img src={selectedMember.photo_data} alt="" className="w-full h-full object-cover" />
                  ) : (
                    `${selectedMember.first_name[0]}${selectedMember.last_name?.[0] || ''}`
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-emerald-400">{selectedMember.member_code}</span>
                    <span>•</span>
                    <span>{selectedMember.phone}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openRenewModal}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950/30 cursor-pointer"
                  title={t('members.renew_membership', 'Renew Membership')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('members.renew_membership', 'Renew')}</span>
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Financial Overview Banner */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-[#131b2e] border-b border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Billed</span>
                <span className="font-mono font-bold text-white text-sm">
                  ₹{Number(selectedMember.total_fees_billed || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Paid</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ₹{Number(selectedMember.total_fees_paid || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Outstanding Due</span>
                <span className={`font-mono font-bold text-sm ${Number(selectedMember.outstanding_balance) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  ₹{Number(selectedMember.outstanding_balance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-800 px-5 gap-5 text-xs font-semibold bg-slate-900/30 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setDrawerTab('profile')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  drawerTab === 'profile' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t('members.tab_profile', 'Profile & Trainer')}
              </button>
              <button
                onClick={() => setDrawerTab('memberships')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  drawerTab === 'memberships' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t('members.tab_memberships', 'Memberships Lifecycle')}
              </button>
              <button
                onClick={() => setDrawerTab('ledger')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  drawerTab === 'ledger' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t('members.tab_ledger', 'Financial Ledger')}
              </button>
              <button
                onClick={() => setDrawerTab('attendance')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  drawerTab === 'attendance' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t('members.tab_attendance', 'Attendance Log')}
              </button>
              <button
                onClick={() => setDrawerTab('store')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
                  drawerTab === 'store' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t('members.tab_store', 'Store Purchases')}
              </button>
              <button
                onClick={() => setDrawerTab('qr')}
                className={`py-3 border-b-2 transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                  drawerTab === 'qr' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                {t('members.tab_qr', 'QR Pass')}
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {drawerTab === 'profile' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Contact & Personal Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block">Email</span>
                        <span className="text-white font-medium">{selectedMember.email || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Phone</span>
                        <span className="text-white font-mono">{selectedMember.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Gender</span>
                        <span className="text-white capitalize">{selectedMember.gender || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Joined Date</span>
                        <span className="text-white font-mono">{selectedMember.joined_date || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Assigned Personal Trainer</h4>
                    {selectedMember.trainer ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                          <Dumbbell className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{selectedMember.trainer.name}</div>
                          <div className="text-[11px] text-emerald-400">{selectedMember.trainer.specialization || 'Fitness Coach'}</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No trainer assigned.</p>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'memberships' && (
                <div className="space-y-4">
                  {selectedMember.memberships?.map((sub) => {
                    const isActive = sub.status === 'active';
                    const isFrozen = sub.status === 'frozen';
                    return (
                      <div key={sub.id} className="bg-[#131b2e] border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-white text-sm">{sub.plan?.name || 'Membership'}</h4>
                            <p className="text-slate-400 font-mono mt-0.5">
                              {sub.start_date} to {sub.end_date}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isFrozen
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {sub.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 font-mono text-[11px]">
                          <div>Price: <strong className="text-white">₹{sub.final_price}</strong></div>
                          <div>Paid: <strong className="text-emerald-400">₹{sub.price_paid}</strong></div>
                          <div>Due: <strong className={sub.balance_due > 0 ? 'text-rose-400' : 'text-slate-400'}>₹{sub.balance_due}</strong></div>
                        </div>

                        {/* Lifecycle Actions */}
                        {(isActive || isFrozen) && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {isActive && (
                              <button
                                onClick={() => setFreezeModalOpen(true)}
                                className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                Freeze
                              </button>
                            )}
                            {isFrozen && (
                              <button
                                onClick={() => handleUnfreezeMembership(sub.id)}
                                className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Unfreeze & Resume
                              </button>
                            )}
                            <button
                              onClick={() => setExtendModalOpen(true)}
                              className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Extend Days
                            </button>
                            <button
                              onClick={() => setCancelModalOpen(true)}
                              className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Cancel & Refund
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {drawerTab === 'ledger' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Member Financial Ledger & Transaction Audit
                  </h4>
                  <div className="bg-[#131b2e] border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">{t('members.col_date', 'Date')}</th>
                          <th className="py-2.5 px-3">{t('members.col_description', 'Description')}</th>
                          <th className="py-2.5 px-3">{t('members.col_debit', 'Debit')}</th>
                          <th className="py-2.5 px-3">{t('members.col_credit', 'Credit')}</th>
                          <th className="py-2.5 px-3 text-right">{t('members.col_balance', 'Balance')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedMember.ledger?.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-slate-400">{tx.transaction_date}</td>
                            <td className="py-2 px-3 text-white font-sans">{tx.description}</td>
                            <td className="py-2 px-3 text-rose-400">
                              {tx.debit > 0 ? `₹${tx.debit}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-emerald-400">
                              {tx.credit > 0 ? `₹${tx.credit}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-white">
                              ₹{tx.running_balance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {drawerTab === 'attendance' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Recent Check-in Records
                  </h4>
                  <div className="bg-[#131b2e] border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">{t('members.col_check_in', 'Check-in Time')}</th>
                          <th className="py-2.5 px-3">{t('members.col_method', 'Method')}</th>
                          <th className="py-2.5 px-3 text-right">{t('members.col_check_out', 'Check-out Time')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedMember.attendance?.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-emerald-400">{att.check_in_at}</td>
                            <td className="py-2 px-3 capitalize font-sans text-slate-300">{att.method.replace('_', ' ')}</td>
                            <td className="py-2 px-3 text-right text-slate-400">{att.check_out_at || 'Inside'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {drawerTab === 'store' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                      Supplement & Store POS Orders
                    </h4>
                    <span className="text-xs text-emerald-400 font-bold">
                      {selectedMember.pos_orders?.length || 0} Orders
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(!selectedMember.pos_orders || selectedMember.pos_orders.length === 0) ? (
                      <div className="text-center py-8 text-slate-500 text-xs bg-[#131b2e] border border-slate-800 rounded-xl">
                        No supplement or gear purchases recorded for this member.
                      </div>
                    ) : (
                      selectedMember.pos_orders.map((ord) => (
                        <div key={ord.id} className="p-3 bg-[#131b2e] border border-slate-800 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-emerald-400">{ord.order_number}</span>
                            <span className="text-slate-500 text-[10px]">{ord.order_date}</span>
                          </div>

                          <div className="space-y-1">
                            {ord.items?.map((item) => (
                              <div key={item.id} className="flex justify-between text-slate-300 text-[11px]">
                                <span>{item.quantity}x {item.product?.name}</span>
                                <span className="font-medium text-white">₹{item.total_amount}</span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Total: <strong className="text-white">₹{ord.total_amount}</strong> ({ord.payment_method.toUpperCase()})</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${parseFloat(ord.balance_due as any) > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                              {parseFloat(ord.balance_due as any) > 0 ? `Due: ₹${ord.balance_due}` : 'Paid'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'qr' && (
                <div className="flex flex-col items-center justify-center p-8 bg-[#131b2e] border border-slate-800 rounded-2xl space-y-4 text-center">
                  <div className="w-48 h-48 bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center">
                    <div className="border-4 border-slate-950 p-3 rounded-lg text-slate-950 font-mono text-center">
                      <QrCode className="w-28 h-28 mx-auto" />
                      <div className="text-[10px] font-bold mt-1 tracking-widest">{selectedMember.member_code}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {selectedMember.first_name} {selectedMember.last_name}
                    </h4>
                    <p className="text-xs text-emerald-400 font-mono">{selectedMember.member_code}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Scan this digital pass at the front desk for instant automated check-in.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Freeze Membership Modal */}
      {freezeModalOpen && selectedMember?.active_membership && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-blue-400" />
              Freeze Membership: {selectedMember.first_name}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Freeze Duration (Days) *</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={freezeDays}
                  onChange={(e) => setFreezeDays(parseInt(e.target.value, 10))}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Reason for Freezing *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vacation, injury recovery..."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => setFreezeModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                <button
                  onClick={() => handleFreezeMembership(selectedMember.active_membership!.id)}
                  disabled={saving}
                  className="bg-blue-500 hover:bg-blue-600 font-bold px-4 py-2 rounded-xl text-white cursor-pointer"
                >
                  Confirm Freeze
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Membership Modal */}
      {extendModalOpen && selectedMember?.active_membership && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Extend Membership Expiry: {selectedMember.first_name}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Number of Days to Add *</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value, 10))}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Reason / Goodwill Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Festival complimentary extension"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => setExtendModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                <button
                  onClick={() => handleExtendMembership(selectedMember.active_membership!.id)}
                  disabled={saving}
                  className="bg-amber-500 hover:bg-amber-600 font-bold px-4 py-2 rounded-xl text-slate-950 cursor-pointer"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Membership Modal */}
      {cancelModalOpen && selectedMember?.active_membership && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              Cancel Membership: {selectedMember.first_name}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Cancellation Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Relocating, medical issue..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Refund Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Refund Mode</label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => setCancelModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer">Back</button>
                <button
                  onClick={() => handleCancelMembership(selectedMember.active_membership!.id)}
                  disabled={saving}
                  className="bg-rose-500 hover:bg-rose-600 font-bold px-4 py-2 rounded-xl text-white cursor-pointer"
                >
                  Cancel & Process Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Membership Modal (Phase 3D: Fast Renew Workflow) */}
      {renewModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                <span>{t('members.renew_membership', 'Renew Membership')}</span>
              </h3>
              <button onClick={() => setRenewModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-1">
              <span className="text-slate-400 block">{t('common.member', 'Member')}:</span>
              <span className="text-white font-bold text-sm">
                {selectedMember.first_name} {selectedMember.last_name} ({selectedMember.member_code})
              </span>
              <span className="text-emerald-400 font-mono text-[11px] block">
                {t('common.phone', 'Phone')}: {selectedMember.phone}
              </span>
            </div>

            <form onSubmit={handleRenewMembership} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('memberships.plan_name', 'Select Renewal Plan')} *
                </label>
                <select
                  required
                  value={renewPlanId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRenewPlanId(id);
                    const p = plans.find((x) => x.id === parseInt(id, 10));
                    if (p) setRenewPaidAmount(p.price.toString());
                  }}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select Plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.price).toLocaleString('en-IN')} ({p.duration_days} {t('common.days', 'Days')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {t('payments.amount_to_collect', 'Paid Amount (₹)')} *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={renewPaidAmount}
                    onChange={(e) => setRenewPaidAmount(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {t('payments.discount', 'Discount (₹)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={renewDiscountAmount}
                    onChange={(e) => setRenewDiscountAmount(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('common.payment_mode', 'Payment Method')} *
                </label>
                <select
                  value={renewPaymentMethod}
                  onChange={(e) => setRenewPaymentMethod(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="cash">Cash (रोख)</option>
                  <option value="card">Card / POS</option>
                  <option value="bank_transfer">Net Banking / NEFT</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRenewModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('common.close', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-400 font-bold px-4 py-2 rounded-xl text-slate-950 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {saving ? t('common.saving', 'Saving...') : t('members.renew_membership', 'Confirm Renewal & Collect')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal (Phase 3A: Fast Registration Experience) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>{t('members.add_member', 'Register New Member')}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {error}
              </div>
            )}

            {contactPickerNotice && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{contactPickerNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setContactPickerNotice(null)}
                  className="text-amber-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {duplicateMember && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">
                      {t('members.duplicate_member_warning', {
                        name: `${duplicateMember.first_name} ${duplicateMember.last_name || ''}`.trim(),
                        code: duplicateMember.member_code,
                        defaultValue: `A member with this mobile number already exists: ${duplicateMember.first_name} ${duplicateMember.last_name || ''} (${duplicateMember.member_code})`,
                      })}
                    </span>
                    <span className="text-[11px] text-rose-300">
                      Avoid creating duplicate profiles for the same member.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    openMemberDetail(duplicateMember.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('members.view_existing_member', 'View Member Profile')}</span>
                </button>
              </div>
            )}

            {matchedLead && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {t('members.lead_matched', {
                      name: matchedLead.name,
                      defaultValue: `Found matching enquiry lead: ${matchedLead.name}. Lead information applied!`,
                    })}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-200 font-semibold uppercase">
                  Lead Match
                </span>
              </div>
            )}

            <form onSubmit={handleCreateMember} className="space-y-3.5 text-xs">
              {/* Step 1: Mobile Number with Contact Picker & Auto-Lookup */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-medium">
                    {t('auth.phone', 'Mobile Number')} *
                  </label>
                  <button
                    type="button"
                    onClick={handleChooseContact}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                    title={t('members.choose_contact_desc', 'Pick directly from mobile phonebook')}
                  >
                    <BookUser className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('members.choose_contact', 'Choose Contact')}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setDuplicateMember(null);
                      setMatchedLead(null);
                    }}
                    onBlur={handlePhoneBlur}
                    placeholder="98200XXXXX (10 digits)"
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Mobile-friendly full width Choose Contact button (< sm) */}
                <div className="sm:hidden mt-2">
                  <button
                    type="button"
                    onClick={handleChooseContact}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <BookUser className="w-4 h-4 text-emerald-400" />
                    <span>{t('members.choose_contact', 'Choose from Contacts')}</span>
                  </button>
                </div>

                <span className="text-[10px] text-slate-500 mt-1 block">
                  Tip: Choose from phonebook or enter number (auto-detects leads)
                </span>
              </div>

              {/* Step 2: Member Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {t('members.first_name', 'First Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Aarav"
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {t('members.last_name', 'Last Name')}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Step 3: Membership Plan Selection */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {t('memberships.plan_name', 'Membership Plan')} (Optional)
                </label>
                <select
                  value={planId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPlanId(id);
                    const p = plans.find((x) => x.id === parseInt(id, 10));
                    if (p) {
                      setPaidAmount(p.price.toString());
                    }
                  }}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">No Plan (Add Plan Later)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.price).toLocaleString('en-IN')} ({p.duration_days} {t('common.days', 'Days')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Payment Details (Only when plan selected) */}
              {planId && (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        {t('payments.amount_to_collect', 'Paid Amount (₹)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        {t('payments.discount', 'Discount (₹)')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      {t('common.payment_mode', 'Payment Method')}
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="cash">Cash (रोख)</option>
                      <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="card">Card / POS</option>
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Optional Collapsible Details */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="text-xs text-slate-400 hover:text-emerald-400 flex items-center justify-between w-full py-1 cursor-pointer font-semibold"
                >
                  <span>{showMoreOptions ? '− Less Options' : '+ More Options (Email, Gender, Trainer)'}</span>
                </button>

                {showMoreOptions && (
                  <div className="space-y-3 mt-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-slate-400 mb-1">{t('common.email', 'Email Address')}</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="aarav@gmail.com"
                        className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">{t('members.gender', 'Gender')}</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">{t('members.assigned_trainer', 'Assign Trainer')}</label>
                        <select
                          value={assignedTrainerId}
                          onChange={(e) => setAssignedTrainerId(e.target.value)}
                          className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">None (General)</option>
                          {trainers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('common.close', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {saving ? t('common.saving', 'Saving...') : t('members.add_member', 'Save Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Multiple Phone Numbers Selection Modal */}
      {multiPhoneModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-white text-sm">
                  {t('members.select_phone_number', 'Select Phone Number')}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setMultiPhoneModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-200 font-bold">
                {multiPhoneModal.name || 'Selected Contact'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('members.select_phone_desc', 'This contact has multiple phone numbers. Choose which one to use:')}
              </p>
            </div>

            <div className="space-y-2">
              {multiPhoneModal.numbers.map((num, idx) => {
                const clean = normalizePhoneNumber(num);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      applyContactDetails(multiPhoneModal.name, num);
                      setMultiPhoneModal(null);
                    }}
                    className="w-full p-3 rounded-xl bg-slate-900 hover:bg-emerald-500/20 border border-slate-800 hover:border-emerald-500/40 text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-white group-hover:text-emerald-400 block">
                        {num}
                      </span>
                      {clean !== num && (
                        <span className="font-mono text-[10px] text-slate-500 block">
                          Cleaned: {clean}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 opacity-0 group-hover:opacity-100 transition">
                      Select →
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setMultiPhoneModal(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              {t('common.close', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
