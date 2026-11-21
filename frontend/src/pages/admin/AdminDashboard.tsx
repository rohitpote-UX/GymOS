import React, { useEffect, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Crown,
  DollarSign,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Key,
  Layers,
  LayoutGrid,
  LifeBuoy,
  List,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Unlock,
  Upload,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import AdminExerciseLibrary from './AdminExerciseLibrary';
import api, { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

// -------------------------------------------------------------
// Interfaces & Types
// -------------------------------------------------------------
export interface PlatformMetrics {
  total_gyms: number;
  active_gyms: number;
  suspended_gyms: number;
  expired_subscriptions: number;
  pending_gyms: number;
  trial_gyms: number;
  total_members: number;
  total_branches: number;
  mrr: number;
  new_registrations: number;
  saas_revenue: number;
}

export interface RecentGymItem {
  id: number;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  branches_count?: number;
  members_count?: number;
  plan?: {
    id: number;
    name: string;
    price: number;
    interval: string;
  };
  users?: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
  }>;
}

export interface RecentPaymentItem {
  id: number;
  amount: number;
  currency: string;
  payment_method: string;
  period_start?: string;
  period_end?: string;
  created_at: string;
  gym?: {
    id: number;
    name: string;
    slug: string;
  };
  plan?: {
    id: number;
    name: string;
  };
  payload?: {
    reference?: string;
    verified_by_admin?: string;
  };
}

export interface ExpiringSubItem {
  id: number;
  name: string;
  slug: string;
  subscription_expires_at: string;
  plan?: {
    name: string;
  };
  users?: Array<{
    name: string;
    phone?: string;
    email: string;
  }>;
}

export interface SuspendedGymItem {
  id: number;
  name: string;
  slug: string;
  updated_at: string;
  plan?: {
    name: string;
  };
}

export interface AuditRecord {
  id: number;
  event: string;
  ip_address: string;
  created_at: string;
  user?: {
    id?: number;
    name: string;
    email: string;
  };
  gym?: {
    id?: number;
    name: string;
    slug: string;
  };
  payload?: Record<string, any>;
}

export interface GymRecord {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  status: 'active' | 'suspended' | 'trial' | 'expired' | 'pending';
  subscription_expires_at?: string;
  branches_count: number;
  members_count: number;
  saas_plan_id?: number;
  plan?: {
    id: number;
    name: string;
    price: number;
    interval: string;
    branch_limit?: number;
    member_limit?: number;
    modules?: string[];
  };
  users?: Array<{
    id: number;
    name: string;
    email: string;
    phone?: string;
    role: string;
  }>;
  assets?: Array<{
    id: number;
    kind: string;
    path: string;
  }>;
  branches?: Array<{
    id: number;
    name: string;
    code: string;
    phone?: string;
    address?: string;
    is_active: boolean;
  }>;
  module_access?: Record<string, boolean>;
  created_at: string;
}

export interface SaasPlanItem {
  id: number;
  code: string;
  name: string;
  price: number;
  interval: string;
  branch_limit: number;
  member_limit: number;
  features?: string[];
  modules?: string[];
  gyms_count?: number;
  is_active?: boolean;
}

export interface PlatformTicket {
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

export type AdminTabType = 'dashboard' | 'gyms' | 'exercise-library' | 'plans' | 'payments' | 'tickets' | 'audit';

export const AdminDashboard: React.FC<{ initialTab?: AdminTabType }> = ({ initialTab = 'dashboard' }) => {
  const { t, i18n } = useTranslation();
  const { user, impersonate, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Navigation Tabs: 'dashboard' | 'gyms' | 'exercise-library' | 'plans' | 'payments' | 'tickets' | 'audit'
  const [activeTab, setActiveTab] = useState<AdminTabType>(initialTab);

  // Core Data
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [recentGyms, setRecentGyms] = useState<RecentGymItem[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPaymentItem[]>([]);
  const [expiringSubs, setExpiringSubs] = useState<ExpiringSubItem[]>([]);
  const [suspendedAccounts, setSuspendedAccounts] = useState<SuspendedGymItem[]>([]);
  const [recentAdminActions, setRecentAdminActions] = useState<AuditRecord[]>([]);

  // Directory Data
  const [gyms, setGyms] = useState<GymRecord[]>([]);
  const [plans, setPlans] = useState<SaasPlanItem[]>([]);
  const [paymentsList, setPaymentsList] = useState<RecentPaymentItem[]>([]);
  const [tickets, setTickets] = useState<PlatformTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);

  // Filter & Search Controls
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expired' | 'pending' | 'trial'>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'subscription_expires_at' | 'name' | 'members_count'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Loading & Alerts
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedGymForDetails, setSelectedGymForDetails] = useState<GymRecord | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<GymRecord | null>(null);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [extendDaysModal, setExtendDaysModal] = useState<GymRecord | null>(null);
  const [customExtendDays, setCustomExtendDays] = useState(30);

  // Plan Edit/Create Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlanItem | null>(null);
  const [planForm, setPlanForm] = useState({
    code: '',
    name: '',
    price: 999,
    interval: 'month',
    branch_limit: 1,
    member_limit: 250,
  });

  // Ticket Reply State
  const [selectedTicket, setSelectedTicket] = useState<PlatformTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [ticketStatusUpdate, setTicketStatusUpdate] = useState('');

  // -------------------------------------------------------------
  // Form State: 3-Section + New Gym Modal
  // -------------------------------------------------------------
  // Section A: Gym Information
  const [regName, setRegName] = useState('');
  const [regNameMr, setRegNameMr] = useState('');
  const [regNameHi, setRegNameHi] = useState('');
  const [regShortName, setRegShortName] = useState('');
  const [regSlug, setRegSlug] = useState('');
  const [slugManualOverride, setSlugManualOverride] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
  const [regLogoBase64, setRegLogoBase64] = useState<string | null>(null);
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regLanguage, setRegLanguage] = useState<'en' | 'mr' | 'hi'>('en');

  // Section B: Owner Account
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regOwnerMobile, setRegOwnerMobile] = useState('');
  const [regOwnerEmail, setRegOwnerEmail] = useState('');
  const [regOwnerPassword, setRegOwnerPassword] = useState('GymAdmin@2026');
  const [regOwnerConfirmPassword, setRegOwnerConfirmPassword] = useState('GymAdmin@2026');
  const [showPassword, setShowPassword] = useState(false);

  // Section C: Subscription
  const [regPlanId, setRegPlanId] = useState<number | ''>('');
  const [regPaymentOption, setRegPaymentOption] = useState<'pending' | 'paid'>('paid');
  const [regPaymentReference, setRegPaymentReference] = useState('');
  const [regPaymentMethod, setRegPaymentMethod] = useState<'bank_transfer' | 'upi' | 'cash' | 'razorpay'>('upi');
  const [regDurationMonths, setRegDurationMonths] = useState(1);

  // Module Entitlement Toggles for Gym Details Modal
  const [gymModuleToggles, setGymModuleToggles] = useState<Record<string, boolean>>({});
  const [savingModules, setSavingModules] = useState(false);

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // -------------------------------------------------------------
  // Auto-generate Slug & Live Availability Check
  // -------------------------------------------------------------
  const generateSlugFromName = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleGymNameChange = (val: string) => {
    setRegName(val);
    if (!slugManualOverride) {
      const generated = generateSlugFromName(val);
      setRegSlug(generated);
    }
  };

  // Debounced checkSlug
  useEffect(() => {
    if (!regSlug || regSlug.trim().length < 2) {
      setSlugAvailable(null);
      setSlugSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSlugChecking(true);
        const res = await api.get<{ available: boolean; slug: string; suggestion?: string }>('/admin/check-slug', {
          params: { slug: regSlug },
        });
        setSlugAvailable(res.data.available);
        setSlugSuggestion(res.data.suggestion || null);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [regSlug]);

  // Handle Logo Upload to Base64
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo file must be under 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRegLogoBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate secure password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRegOwnerPassword(pwd);
    setRegOwnerConfirmPassword(pwd);
  };

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        metrics: PlatformMetrics;
        recent_activity: {
          recent_gyms: RecentGymItem[];
          recent_payments: RecentPaymentItem[];
          expiring_subscriptions: ExpiringSubItem[];
          suspended_accounts: SuspendedGymItem[];
          recent_admin_actions: AuditRecord[];
        };
      }>('/admin/overview');

      setMetrics(res.data.metrics);
      setRecentGyms(res.data.recent_activity.recent_gyms || []);
      setRecentPayments(res.data.recent_activity.recent_payments || []);
      setExpiringSubs(res.data.recent_activity.expiring_subscriptions || []);
      setSuspendedAccounts(res.data.recent_activity.suspended_accounts || []);
      setRecentAdminActions(res.data.recent_activity.recent_admin_actions || []);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchGyms = async () => {
    try {
      const params: Record<string, any> = {
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.get<{ data: GymRecord[] }>('/admin/gyms', { params });
      setGyms(res.data.data || []);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get<SaasPlanItem[]>('/admin/plans');
      setPlans(res.data || []);
      if (res.data && res.data.length > 0 && !regPlanId) {
        setRegPlanId(res.data[0].id);
      }
    } catch (err) {
      // ignore
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await api.get<{ data: RecentPaymentItem[] }>('/admin/payments');
      setPaymentsList(res.data.data || []);
    } catch (err) {
      // ignore
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await api.get<{ data: PlatformTicket[] }>('/admin/support-tickets');
      setTickets(res.data.data || []);
    } catch (err) {
      // ignore
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get<{ data: AuditRecord[] }>('/admin/audit');
      setAuditLogs(res.data.data || []);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchGyms();
  }, [search, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchOverview();
    if (activeTab === 'gyms') fetchGyms();
    if (activeTab === 'plans') fetchPlans();
    if (activeTab === 'payments') fetchPayments();
    if (activeTab === 'tickets') fetchTickets();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  // When a gym is selected for details, sync its module toggles
  useEffect(() => {
    if (selectedGymForDetails) {
      const defaultModules = {
        module_ai_advisor: true,
        module_whatsapp: true,
        module_inventory_pos: true,
        module_member_portal: true,
        module_trainer_portal: true,
        module_crm_leads: true,
        ...(selectedGymForDetails.module_access || {}),
      };
      setGymModuleToggles(defaultModules);
    }
  }, [selectedGymForDetails]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleImpersonate = async (gym: { id: number; name: string }) => {
    try {
      showToast(`Initiating instant login into tenant '${gym.name}'...`, 'info');
      await impersonate(gym.id);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const handleSuspend = async (gym: { id: number; name: string }) => {
    if (!window.confirm(`Are you sure you want to suspend access for '${gym.name}'?`)) return;
    try {
      await api.post(`/admin/gyms/${gym.id}/suspend`);
      showToast(`Gym '${gym.name}' has been suspended.`, 'info');
      fetchOverview();
      fetchGyms();
      if (selectedGymForDetails?.id === gym.id) {
        setSelectedGymForDetails((prev) => (prev ? { ...prev, status: 'suspended' } : null));
      }
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const handleActivate = async (gym: { id: number; name: string }) => {
    try {
      await api.post(`/admin/gyms/${gym.id}/activate`);
      showToast(`Gym '${gym.name}' has been activated!`, 'success');
      fetchOverview();
      fetchGyms();
      if (selectedGymForDetails?.id === gym.id) {
        setSelectedGymForDetails((prev) => (prev ? { ...prev, status: 'active' } : null));
      }
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const handleExtend = async (gym: { id: number; name: string }, days = 30) => {
    try {
      await api.post(`/admin/gyms/${gym.id}/extend-subscription`, { days });
      showToast(`Subscription for '${gym.name}' extended by +${days} days.`, 'success');
      setExtendDaysModal(null);
      fetchOverview();
      fetchGyms();
      if (selectedGymForDetails?.id === gym.id) {
        const updated = await api.get<{ gym: GymRecord }>(`/admin/gyms/${gym.id}`);
        setSelectedGymForDetails(updated.data.gym);
      }
    } catch (err) {
      showToast(errorMessage(err), 'error');
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
      showToast(`Password successfully reset for ${res.data.owner_email}!`, 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveModules = async () => {
    if (!selectedGymForDetails) return;
    try {
      setSavingModules(true);
      await api.put(`/admin/gyms/${selectedGymForDetails.id}/modules`, {
        modules: gymModuleToggles,
      });
      showToast('Module entitlements successfully updated for this gym!', 'success');
      fetchGyms();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSavingModules(false);
    }
  };

  // Submit New Gym Registration Form (3-Section Workflow)
  const handleRegisterGym = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regName.trim()) {
      showToast('Gym Name (English) is required.', 'error');
      return;
    }

    if (slugAvailable === false) {
      showToast('The requested URL slug is already taken. Please choose another or click the suggestion.', 'error');
      return;
    }

    if (!regPhone.trim()) {
      showToast('Primary contact phone is required.', 'error');
      return;
    }

    if (!regOwnerName.trim() || !regOwnerEmail.trim() || !regOwnerMobile.trim()) {
      showToast('Owner full name, email and mobile number are required.', 'error');
      return;
    }

    if (regOwnerPassword !== regOwnerConfirmPassword) {
      showToast('Passwords do not match. Please verify.', 'error');
      return;
    }

    if (!regPlanId) {
      showToast('Please select a SaaS subscription plan.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Record<string, any> = {
        name: regName.trim(),
        name_mr: regNameMr.trim() || null,
        name_hi: regNameHi.trim() || null,
        short_name: regShortName.trim() || null,
        slug: regSlug.trim(),
        logo_base64: regLogoBase64 || null,
        phone: regPhone.trim(),
        email: regEmail.trim() || null,
        address: regAddress.trim() || null,
        default_language: regLanguage,
        owner_name: regOwnerName.trim(),
        owner_phone: regOwnerMobile.trim(),
        owner_email: regOwnerEmail.trim(),
        owner_password: regOwnerPassword,
        saas_plan_id: regPlanId,
        payment_option: regPaymentOption,
        duration_months: regDurationMonths,
      };

      if (regPaymentOption === 'paid') {
        payload.payment_reference = regPaymentReference.trim() || `MANUAL-${Date.now().toString(36).toUpperCase()}`;
        payload.payment_method = regPaymentMethod;
      }

      const res = await api.post('/admin/gyms', payload);

      showToast(`Gym '${res.data.gym?.name}' successfully registered and activated!`, 'success');
      setRegisterModalOpen(false);

      // Reset form
      setRegName('');
      setRegNameMr('');
      setRegNameHi('');
      setRegShortName('');
      setRegSlug('');
      setSlugManualOverride(false);
      setRegLogoBase64(null);
      setRegPhone('');
      setRegEmail('');
      setRegAddress('');
      setRegOwnerName('');
      setRegOwnerMobile('');
      setRegOwnerEmail('');
      setRegPaymentReference('');

      fetchOverview();
      fetchGyms();
      setActiveTab('gyms');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Plan Management Handlers
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.id}`, planForm);
        showToast(`Plan '${planForm.name}' updated successfully!`, 'success');
      } else {
        await api.post('/admin/plans', planForm);
        showToast(`New plan '${planForm.name}' created!`, 'success');
      }
      setPlanModalOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this subscription plan?')) return;
    try {
      await api.delete(`/admin/plans/${id}`);
      showToast('Plan deleted successfully.', 'info');
      fetchPlans();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  // Ticket Reply Handler
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
      showToast('Official response dispatched to gym owner.', 'success');
      fetchTickets();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Suspended
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Expired
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Pending
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            Trial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  // Helper for Days Remaining calculation
  const getDaysRemaining = (expiryDate?: string) => {
    if (!expiryDate) return { text: 'Lifetime / Uncapped', isExpired: false, days: 999 };
    const diffMs = new Date(expiryDate).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) {
      return { text: `Expired ${Math.abs(days)}d ago`, isExpired: true, days };
    }
    if (days === 0) {
      return { text: 'Expires Today', isExpired: false, days: 0 };
    }
    return { text: `${days} days left`, isExpired: false, days };
  };

  return (
    <div className="min-h-screen bg-gym-main text-gym-primary transition-colors duration-200">
      {/* ----------------------------------------------------------- */}
      {/* 1. TOP HEADER & BRAND BAR                                   */}
      {/* ----------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-gym-card/95 backdrop-blur-md border-b border-gym shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo & Platform Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D92332] to-[#B91C2B] dark:from-[#F02D3A] dark:to-[#B91C2B] flex items-center justify-center font-bold text-white shadow-md shadow-red-950/20">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-gym-primary">
                    GymOS
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gym-red-subtle text-gym-red border border-gym-red">
                    Super Admin
                  </span>
                </div>
                <p className="text-[11px] text-gym-muted hidden sm:block">
                  Multi-Tenant Platform Control Plane & SaaS Billing
                </p>
              </div>
            </div>

            {/* Global Actions */}
            <div className="flex items-center gap-2.5">
              {/* Theme Switcher */}
              <button
                onClick={toggleTheme}
                title="Toggle Theme"
                className="p-2 rounded-xl bg-gym-main border border-gym text-gym-secondary hover:text-gym-primary hover:bg-gym-card transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              {/* Language Switcher */}
              <LanguageSwitcher variant="dropdown" />

              {/* + New Gym Button */}
              <button
                onClick={() => setRegisterModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-gym-red cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">+ New Gym</span>
                <span className="sm:hidden">New Gym</span>
              </button>

              {/* Admin Profile & Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-gym">
                <div className="w-8 h-8 rounded-full bg-gym-red-subtle border border-gym-red flex items-center justify-center text-xs font-bold text-gym-red">
                  SA
                </div>
                <button
                  onClick={() => logout()}
                  title="Sign Out"
                  className="p-2 rounded-xl bg-gym-main border border-gym text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Bar / Tabs */}
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto no-scrollbar border-t border-gym pt-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, count: null },
              { id: 'gyms', label: 'Gyms', icon: Building2, count: metrics?.total_gyms ?? gyms.length },
              { id: 'exercise-library', label: 'Exercise Videos', icon: Video, count: null },
              { id: 'plans', label: 'Subscription Plans', icon: Layers, count: plans.length },
              { id: 'payments', label: 'Payments', icon: CreditCard, count: null },
              { id: 'tickets', label: 'Support Tickets', icon: LifeBuoy, count: tickets.length },
              { id: 'audit', label: 'Activity Logs', icon: ShieldCheck, count: null },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-gym-red text-gym-red bg-gym-red-subtle/50'
                      : 'border-transparent text-gym-secondary hover:text-gym-primary hover:border-gym'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-gym-red' : 'text-gym-muted'}`} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-gym-red text-white'
                          : 'bg-gym-main text-gym-secondary border border-gym'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ----------------------------------------------------------- */}
      {/* TOAST NOTIFICATION                                          */}
      {/* ----------------------------------------------------------- */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 max-w-md animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-3.5 rounded-xl border text-xs shadow-xl flex items-center justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : toast.type === 'info'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : toast.type === 'info' ? (
                <Sparkles className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-gym-muted hover:text-gym-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                           */}
      {/* ----------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: DASHBOARD (OVERVIEW)                               */}
        {/* ========================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Overview KPI Cards (8 Key Metrics) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 1. Total Registered Gyms */}
              <div
                onClick={() => {
                  setStatusFilter('all');
                  setActiveTab('gyms');
                }}
                className="bg-gym-card border border-gym p-4 rounded-2xl hover:border-gym-red transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gym-secondary uppercase tracking-wider">
                    Total Registered Gyms
                  </span>
                  <Building2 className="w-4 h-4 text-gym-muted group-hover:text-gym-red transition-colors" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gym-primary">
                    {metrics?.total_gyms || 0}
                  </span>
                  <span className="text-xs text-gym-muted">tenants</span>
                </div>
                <div className="mt-2 text-[11px] text-gym-secondary flex items-center justify-between">
                  <span>View directory</span>
                  <ArrowRight className="w-3 h-3 text-gym-muted group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 2. Active Gyms */}
              <div
                onClick={() => {
                  setStatusFilter('active');
                  setActiveTab('gyms');
                }}
                className="bg-gym-card border border-gym p-4 rounded-2xl hover:border-emerald-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
                    Active Gyms
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-500">
                    {metrics?.active_gyms || 0}
                  </span>
                  <span className="text-xs text-emerald-500/70">operating</span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-500/80 flex items-center justify-between">
                  <span>Filter active</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 3. Suspended Gyms */}
              <div
                onClick={() => {
                  setStatusFilter('suspended');
                  setActiveTab('gyms');
                }}
                className="bg-gym-card border border-gym p-4 rounded-2xl hover:border-rose-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">
                    Suspended Gyms
                  </span>
                  <PauseCircle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-rose-500">
                    {metrics?.suspended_gyms || 0}
                  </span>
                  <span className="text-xs text-rose-500/70">locked</span>
                </div>
                <div className="mt-2 text-[11px] text-rose-500/80 flex items-center justify-between">
                  <span>Review suspended</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 4. Expired Subscriptions */}
              <div
                onClick={() => {
                  setStatusFilter('expired');
                  setActiveTab('gyms');
                }}
                className="bg-gym-card border border-gym p-4 rounded-2xl hover:border-amber-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                    Expired Subscriptions
                  </span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-500">
                    {metrics?.expired_subscriptions || 0}
                  </span>
                  <span className="text-xs text-amber-500/70">action needed</span>
                </div>
                <div className="mt-2 text-[11px] text-amber-500/80 flex items-center justify-between">
                  <span>Extend / follow up</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* 5. Total Branches */}
              <div className="bg-gym-card border border-gym p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gym-secondary uppercase tracking-wider">
                    Total Branches
                  </span>
                  <Layers className="w-4 h-4 text-gym-muted" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gym-primary">
                    {metrics?.total_branches || 0}
                  </span>
                  <span className="text-xs text-gym-muted">facilities</span>
                </div>
                <p className="mt-2 text-[11px] text-gym-muted">Across all gym networks</p>
              </div>

              {/* 6. Total Members Across All Gyms */}
              <div className="bg-gym-card border border-gym p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gym-secondary uppercase tracking-wider">
                    Total Members
                  </span>
                  <Users className="w-4 h-4 text-gym-muted" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gym-primary">
                    {metrics?.total_members || 0}
                  </span>
                  <span className="text-xs text-gym-muted">enrolled users</span>
                </div>
                <p className="mt-2 text-[11px] text-emerald-500 font-medium">Platform-wide fitness base</p>
              </div>

              {/* 7. Monthly Recurring Revenue (MRR) */}
              <div
                onClick={() => setActiveTab('payments')}
                className="bg-gym-card border border-gym p-4 rounded-2xl hover:border-gym-red transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gym-red uppercase tracking-wider">
                    Monthly Recurring Revenue
                  </span>
                  <TrendingUp className="w-4 h-4 text-gym-red" />
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-sm font-bold text-gym-red">₹</span>
                  <span className="text-3xl font-black text-gym-primary">
                    {Math.round(metrics?.mrr || 0).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-gym-muted">/mo</span>
                </div>
                <p className="mt-2 text-[11px] text-gym-secondary">Live active SaaS subscriptions</p>
              </div>

              {/* 8. New Gym Registrations (30d) */}
              <div className="bg-gym-card border border-gym p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gym-secondary uppercase tracking-wider">
                    New Registrations
                  </span>
                  <Sparkles className="w-4 h-4 text-gym-red" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gym-primary">
                    +{metrics?.new_registrations || 0}
                  </span>
                  <span className="text-xs text-gym-muted">last 30 days</span>
                </div>
                <p className="mt-2 text-[11px] text-gym-muted">Tenant growth velocity</p>
              </div>
            </div>

            {/* Quick Onboarding Banner */}
            <div className="bg-gradient-to-r from-red-600/10 via-gym-card to-gym-card border border-gym-red/30 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gym-red" />
                  <span>Ready to onboard a new gym partner?</span>
                </h3>
                <p className="text-xs text-gym-secondary mt-1">
                  Set up gym details, auto-check unique slug, create owner credentials, and configure instant or pending subscription.
                </p>
              </div>
              <button
                onClick={() => setRegisterModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-gym-red shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Gym Onboarding</span>
              </button>
            </div>

            {/* Recent Activity Feeds Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Feed 1: Recently Registered Gyms */}
              <div className="bg-gym-card border border-gym rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gym pb-3">
                  <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gym-red" />
                    <span>Recently Registered Gyms</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('gyms')}
                    className="text-xs text-gym-red hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {recentGyms.length === 0 ? (
                  <p className="text-xs text-gym-muted py-6 text-center">No recent gyms registered.</p>
                ) : (
                  <div className="space-y-3">
                    {recentGyms.map((g) => (
                      <div
                        key={g.id}
                        onClick={() => {
                          const found = gyms.find((item) => item.id === g.id);
                          if (found) setSelectedGymForDetails(found);
                        }}
                        className="p-3 rounded-xl bg-gym-main border border-gym hover:border-gym-red transition-all cursor-pointer flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gym-card border border-gym flex items-center justify-center font-bold text-xs text-gym-red shrink-0 uppercase">
                            {g.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gym-primary truncate">{g.name}</h4>
                            <p className="text-[11px] text-gym-muted truncate">
                              /gyms/{g.slug} • {g.plan?.name || 'Standard'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {getStatusBadge(g.status)}
                          <span className="text-[10px] text-gym-muted block mt-1 font-mono">
                            {new Date(g.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feed 2: Expiring Subscriptions (Next 14 Days) */}
              <div className="bg-gym-card border border-gym rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gym pb-3">
                  <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Expiring Subscriptions (Next 14 Days)</span>
                  </h3>
                  <span className="text-xs font-bold text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10">
                    {expiringSubs.length} urgent
                  </span>
                </div>

                {expiringSubs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                    <p className="text-xs text-gym-muted">No subscriptions expiring in the next 14 days.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiringSubs.map((item) => {
                      const daysInfo = getDaysRemaining(item.subscription_expires_at);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-gym-main border border-amber-500/30 flex items-center justify-between gap-3"
                        >
                          <div>
                            <h4 className="text-xs font-bold text-gym-primary">{item.name}</h4>
                            <p className="text-[11px] text-gym-muted">
                              Owner: {item.users?.[0]?.name || 'Admin'} ({item.users?.[0]?.phone || '—'})
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-amber-500 px-2.5 py-1 rounded-lg bg-amber-500/15">
                              {daysInfo.text}
                            </span>
                            <button
                              onClick={() => handleExtend(item, 30)}
                              className="px-2.5 py-1 rounded-lg bg-gym-card hover:bg-gym-red hover:text-white border border-gym text-xs font-semibold text-gym-primary transition-colors cursor-pointer"
                            >
                              +30d
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Feed 3: Recent SaaS Payments */}
              <div className="bg-gym-card border border-gym rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gym pb-3">
                  <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span>Recent SaaS Payments</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="text-xs text-gym-red hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ledger</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {recentPayments.length === 0 ? (
                  <p className="text-xs text-gym-muted py-6 text-center">No payment transactions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-gym-main border border-gym flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-gym-primary block truncate">
                            {p.gym?.name || 'Platform Tenant'}
                          </span>
                          <span className="text-[10px] text-gym-muted font-mono">
                            Ref: {p.payload?.reference || 'Direct'} • {p.payment_method?.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-emerald-500 block">
                            ₹{Number(p.amount).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-gym-muted">
                            {new Date(p.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feed 4: Recent Administrative Actions (Audit Trail) */}
              <div className="bg-gym-card border border-gym rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-gym pb-3">
                  <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <span>Recent Administrative Actions</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className="text-xs text-gym-red hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Full Audit</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {recentAdminActions.length === 0 ? (
                  <p className="text-xs text-gym-muted py-6 text-center">No administrative actions logged.</p>
                ) : (
                  <div className="space-y-2.5">
                    {recentAdminActions.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-gym-main border border-gym flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-gym-red font-bold text-[11px] block truncate">
                            {log.event}
                          </span>
                          <span className="text-[10px] text-gym-secondary truncate block">
                            By {log.user?.name || 'Super Admin'} {log.gym ? `on ${log.gym.name}` : ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-gym-muted shrink-0 font-mono">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: GYMS MANAGEMENT (PRIMARY DIRECTORY)                */}
        {/* ========================================================= */}
        {activeTab === 'gyms' && (
          <div className="space-y-5">
            {/* Control Bar: Search, Filters, Sorting & View Toggle */}
            <div className="bg-gym-card border border-gym rounded-2xl p-4 space-y-4 shadow-xs">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gym-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search gyms by name, owner, email, slug..."
                    className="w-full bg-gym-main border border-gym rounded-xl pl-9 pr-4 py-2 text-xs text-gym-primary placeholder:text-gym-muted focus:border-gym-red"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-2.5 text-gym-muted hover:text-gym-primary cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sorting Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gym-muted whitespace-nowrap">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-gym-main border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary font-medium"
                  >
                    <option value="created_at">Newest Registered</option>
                    <option value="subscription_expires_at">Subscription Expiry</option>
                    <option value="name">Gym Name (A-Z)</option>
                    <option value="members_count">Most Members</option>
                  </select>

                  {/* View Mode Toggle */}
                  <div className="flex items-center rounded-xl bg-gym-main border border-gym p-0.5">
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Card Grid View"
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-gym-card text-gym-red font-bold shadow-xs'
                          : 'text-gym-muted hover:text-gym-primary'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      title="Table List View"
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-gym-card text-gym-red font-bold shadow-xs'
                          : 'text-gym-muted hover:text-gym-primary'
                      }`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  {/* + New Gym Button */}
                  <button
                    onClick={() => setRegisterModalOpen(true)}
                    className="px-3 py-2 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 shadow-gym-red cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ New Gym</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-gym">
                {[
                  { id: 'all', label: 'All Gyms', count: metrics?.total_gyms },
                  { id: 'active', label: 'Active', count: metrics?.active_gyms },
                  { id: 'suspended', label: 'Suspended', count: metrics?.suspended_gyms },
                  { id: 'expired', label: 'Expired', count: metrics?.expired_subscriptions },
                  { id: 'pending', label: 'Pending', count: metrics?.pending_gyms },
                  { id: 'trial', label: 'Trial', count: metrics?.trial_gyms },
                ].map((filter) => {
                  const isSelected = statusFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setStatusFilter(filter.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gym-red text-white shadow-xs'
                          : 'bg-gym-main text-gym-secondary hover:text-gym-primary border border-gym'
                      }`}
                    >
                      <span>{filter.label}</span>
                      {filter.count !== undefined && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-gym-card text-gym-muted'
                          }`}
                        >
                          {filter.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gyms Listing */}
            {loading ? (
              <div className="py-20 text-center text-gym-muted text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-gym-red" />
                <span>Loading gym tenants directory...</span>
              </div>
            ) : gyms.length === 0 ? (
              <div className="bg-gym-card border border-gym rounded-2xl p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-gym-muted mx-auto" />
                <h4 className="text-sm font-bold text-gym-primary">No Gyms Found</h4>
                <p className="text-xs text-gym-secondary max-w-sm mx-auto">
                  {search
                    ? `No gym matches "${search}". Try clearing your search query.`
                    : 'No gyms match the selected status filter.'}
                </p>
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-gym-main border border-gym text-xs font-semibold text-gym-primary hover:bg-gym-card cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* CARD GRID VIEW (EasyJar Style) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {gyms.map((gym) => {
                  const owner = gym.users?.find((u) => u.role === 'gym_owner') || gym.users?.[0];
                  const daysInfo = getDaysRemaining(gym.subscription_expires_at);
                  const logoAsset = gym.assets?.find((a) => a.kind === 'logo');

                  return (
                    <div
                      key={gym.id}
                      className="bg-gym-card border border-gym rounded-2xl p-5 hover:border-gym-red/50 hover:shadow-lg transition-all flex flex-col justify-between space-y-4 group"
                    >
                      {/* Card Header: Logo, Name, Slug & Status */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {logoAsset?.path ? (
                              <img
                                src={logoAsset.path}
                                alt={gym.name}
                                className="w-12 h-12 rounded-xl object-cover border border-gym shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gym-red/20 to-gym-red/40 border border-gym-red/30 flex items-center justify-center font-black text-sm text-gym-red shrink-0 uppercase">
                                {gym.name.substring(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-gym-primary truncate group-hover:text-gym-red transition-colors">
                                {gym.name}
                              </h3>
                              <span className="text-[11px] font-mono text-gym-muted block truncate">
                                /gyms/{gym.slug}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">{getStatusBadge(gym.status)}</div>
                        </div>

                        {/* Owner Information */}
                        <div className="mt-4 pt-3 border-t border-gym space-y-1 text-xs">
                          <div className="flex items-center justify-between text-gym-secondary">
                            <span className="text-gym-muted">Owner:</span>
                            <span className="font-semibold text-gym-primary truncate max-w-[180px]">
                              {owner?.name || 'Unassigned'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-gym-secondary">
                            <span className="text-gym-muted">Contact:</span>
                            <span className="font-mono text-gym-secondary">
                              {gym.phone || owner?.phone || '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-gym-secondary">
                            <span className="text-gym-muted">Email:</span>
                            <span className="truncate max-w-[180px] text-gym-secondary">
                              {gym.email || owner?.email || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Plan & Stats */}
                        <div className="mt-3 p-3 rounded-xl bg-gym-main border border-gym space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gym-red">
                              {gym.plan?.name || 'Growth Plan'}
                            </span>
                            <span className="text-[11px] font-bold text-gym-secondary">
                              ₹{gym.plan?.price || 0}/{gym.plan?.interval || 'mo'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gym-muted pt-1 border-t border-gym">
                            <span>Expiry:</span>
                            <span
                              className={`font-semibold ${
                                daysInfo.isExpired
                                  ? 'text-rose-500'
                                  : daysInfo.days <= 14
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                              }`}
                            >
                              {daysInfo.text}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gym text-center">
                            <div>
                              <span className="text-xs font-bold text-gym-primary block">
                                {gym.branches_count || 1}
                              </span>
                              <span className="text-[10px] text-gym-muted">Branches</span>
                            </div>
                            <div>
                              <span className="text-xs font-bold text-gym-primary block">
                                {gym.members_count || 0}
                              </span>
                              <span className="text-[10px] text-gym-muted">Members</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 border-t border-gym flex items-center justify-between gap-1.5">
                        {/* Impersonate */}
                        <button
                          onClick={() => handleImpersonate(gym)}
                          title="Instant Support Login (Impersonate Owner)"
                          className="px-2.5 py-1.5 rounded-lg bg-gym-red-subtle hover:bg-gym-red hover:text-white border border-gym-red text-gym-red text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Login</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Quick Extend +30d */}
                          <button
                            onClick={() => handleExtend(gym, 30)}
                            title="Extend Subscription 30 Days"
                            className="px-2 py-1.5 rounded-lg bg-gym-main border border-gym hover:border-emerald-500 text-gym-secondary hover:text-emerald-500 text-xs font-mono font-semibold transition-colors cursor-pointer"
                          >
                            +30d
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setResetPasswordModal(gym);
                              setCustomPassword('');
                              setTempPasswordResult(null);
                            }}
                            title="Reset Owner Password"
                            className="p-1.5 rounded-lg bg-gym-main border border-gym hover:border-amber-500 text-gym-secondary hover:text-amber-500 transition-colors cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Activate Toggle */}
                          {gym.status === 'active' ? (
                            <button
                              onClick={() => handleSuspend(gym)}
                              title="Suspend Gym Access"
                              className="p-1.5 rounded-lg bg-gym-main border border-gym hover:border-rose-500 text-gym-secondary hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(gym)}
                              title="Activate Gym Access"
                              className="p-1.5 rounded-lg bg-gym-main border border-gym hover:border-emerald-500 text-gym-secondary hover:text-emerald-500 transition-colors cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View Details Modal */}
                          <button
                            onClick={() => setSelectedGymForDetails(gym)}
                            title="View Full Gym Details"
                            className="px-2.5 py-1.5 rounded-lg bg-gym-primary text-gym-main hover:opacity-90 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DENSE TABLE VIEW */
              <div className="bg-gym-card border border-gym rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gym-main border-b border-gym text-gym-muted uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Gym Tenant</th>
                        <th className="py-3 px-4">Slug / Domain</th>
                        <th className="py-3 px-4">Owner Contact</th>
                        <th className="py-3 px-4">Plan & Expiry</th>
                        <th className="py-3 px-4">Branches</th>
                        <th className="py-3 px-4">Members</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gym text-gym-primary">
                      {gyms.map((g) => {
                        const owner = g.users?.find((u) => u.role === 'gym_owner') || g.users?.[0];
                        const daysInfo = getDaysRemaining(g.subscription_expires_at);

                        return (
                          <tr key={g.id} className="hover:bg-gym-main/60 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-gym-primary block">{g.name}</span>
                              <span className="text-[10px] text-gym-muted">{g.email || g.phone}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-gym-red text-[11px]">
                              /gyms/{g.slug}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-medium text-gym-primary block">{owner?.name || '—'}</span>
                              <span className="text-[10px] text-gym-muted">{owner?.phone || owner?.email || '—'}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-gym-primary block">{g.plan?.name || 'Standard'}</span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  daysInfo.isExpired
                                    ? 'text-rose-500'
                                    : daysInfo.days <= 14
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                                }`}
                              >
                                {daysInfo.text}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-gym-secondary font-medium">
                              {g.branches_count || 1}
                            </td>
                            <td className="py-3.5 px-4 text-gym-secondary font-medium">
                              {g.members_count || 0}
                            </td>
                            <td className="py-3.5 px-4">{getStatusBadge(g.status)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleImpersonate(g)}
                                  title="Impersonate Owner"
                                  className="px-2 py-1 rounded bg-gym-red-subtle text-gym-red border border-gym-red text-[11px] font-semibold cursor-pointer"
                                >
                                  Login
                                </button>
                                <button
                                  onClick={() => handleExtend(g, 30)}
                                  title="Extend 30 Days"
                                  className="px-1.5 py-1 rounded bg-gym-main border border-gym text-gym-secondary text-[11px] font-mono cursor-pointer"
                                >
                                  +30d
                                </button>
                                <button
                                  onClick={() => setSelectedGymForDetails(g)}
                                  title="Details"
                                  className="px-2 py-1 rounded bg-gym-primary text-gym-main text-[11px] font-semibold cursor-pointer"
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SUBSCRIPTION PLANS                                 */}
        {/* ========================================================= */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <Layers className="w-5 h-5 text-gym-red" />
                  <span>SaaS Subscription Plans & Licensing</span>
                </h2>
                <p className="text-xs text-gym-secondary">
                  Manage pricing tiers, multi-branch entitlements, and module limits for gym partners.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingPlan(null);
                  setPlanForm({
                    code: 'pro-tier',
                    name: 'Pro Partner',
                    price: 2499,
                    interval: 'month',
                    branch_limit: 3,
                    member_limit: 500,
                  });
                  setPlanModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 shadow-gym-red cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Plan</span>
              </button>
            </div>

            {/* Plans Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="bg-gym-card border border-gym rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-gym-red transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gym-red uppercase tracking-wider font-bold">
                        {p.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gym-main text-gym-secondary border border-gym">
                        {p.gyms_count || 0} gyms subscribed
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-gym-primary">{p.name}</h3>

                    <div className="flex items-baseline gap-1 py-1">
                      <span className="text-sm font-bold text-gym-red">₹</span>
                      <span className="text-3xl font-black text-gym-primary">
                        {Number(p.price).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gym-muted">/{p.interval}</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gym text-xs text-gym-secondary">
                      <div className="flex items-center justify-between">
                        <span>Branch Limit:</span>
                        <span className="font-bold text-gym-primary">{p.branch_limit} Location(s)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Member Limit:</span>
                        <span className="font-bold text-gym-primary">{p.member_limit} Members</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gym flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingPlan(p);
                        setPlanForm({
                          code: p.code,
                          name: p.name,
                          price: p.price,
                          interval: p.interval,
                          branch_limit: p.branch_limit,
                          member_limit: p.member_limit,
                        });
                        setPlanModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gym-main border border-gym hover:border-gym-red text-gym-secondary hover:text-gym-primary text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Plan</span>
                    </button>
                    <button
                      onClick={() => handleDeletePlan(p.id)}
                      className="p-1.5 rounded-lg bg-gym-main border border-gym hover:border-rose-500 text-gym-secondary hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PAYMENTS (SAAS TRANSACTIONS LEDGER)                */}
        {/* ========================================================= */}
        {activeTab === 'payments' && (
          <div className="bg-gym-card border border-gym rounded-2xl overflow-hidden shadow-xs space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gym">
              <div>
                <h3 className="text-base font-bold text-gym-primary flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                  <span>Platform SaaS Subscription Ledger</span>
                </h3>
                <p className="text-xs text-gym-secondary">
                  Complete audit history of Razorpay, manual bank transfers and platform renewals.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-gym-muted block">Total Platform Revenue</span>
                <span className="text-xl font-black text-emerald-500">
                  ₹{Number(metrics?.saas_revenue || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gym-main border-b border-gym text-gym-muted uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Receipt / Order Ref</th>
                    <th className="py-3 px-4">Gym Tenant</th>
                    <th className="py-3 px-4">SaaS Plan</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Subscription Period</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gym text-gym-primary">
                  {paymentsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gym-muted">
                        No subscription payments found in ledger.
                      </td>
                    </tr>
                  ) : (
                    paymentsList.map((p) => (
                      <tr key={p.id} className="hover:bg-gym-main/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-gym-red">
                          {p.payload?.reference || `PAY-${p.id}`}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gym-primary">
                          {p.gym?.name || 'Platform Tenant'}
                        </td>
                        <td className="py-3.5 px-4 text-gym-secondary font-medium">
                          {p.plan?.name || 'Pro Plan'}
                        </td>
                        <td className="py-3.5 px-4 font-black text-emerald-500">
                          ₹{Number(p.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 uppercase text-gym-secondary font-mono text-[11px]">
                          {p.payment_method || 'bank_transfer'}
                        </td>
                        <td className="py-3.5 px-4 text-gym-muted text-[11px] font-mono">
                          {p.period_start ? new Date(p.period_start).toLocaleDateString() : '—'} →{' '}
                          {p.period_end ? new Date(p.period_end).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-gym-muted text-[11px]">
                          {new Date(p.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: SUPPORT TICKETS                                    */}
        {/* ========================================================= */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className={`${
                selectedTicket ? 'lg:col-span-2' : 'lg:col-span-3'
              } bg-gym-card border border-gym rounded-2xl overflow-hidden`}
            >
              <div className="p-4 border-b border-gym">
                <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-gym-red" />
                  <span>Enterprise Support Requests (Owners ↔ Platform)</span>
                </h3>
              </div>

              {tickets.length === 0 ? (
                <div className="p-12 text-center text-gym-muted text-xs">
                  No active enterprise support tickets open.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gym-main text-gym-muted uppercase text-[10px] tracking-wider border-b border-gym">
                      <tr>
                        <th className="py-3 px-3">Ticket ID</th>
                        <th className="py-3 px-3">Gym Tenant</th>
                        <th className="py-3 px-3">Subject</th>
                        <th className="py-3 px-3">Priority</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gym text-gym-primary">
                      {tickets.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTicket(t)}
                          className={`hover:bg-gym-main cursor-pointer transition-colors ${
                            selectedTicket?.id === t.id ? 'bg-gym-red-subtle/50' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-gym-red">{t.ticket_number}</td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-gym-primary block">{t.gym?.name}</span>
                            <span className="text-[10px] text-gym-muted">{t.creator?.email}</span>
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate font-medium text-gym-primary">
                            {t.subject}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gym-main border border-gym text-gym-secondary">
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-gym-red-subtle text-gym-red border border-gym-red">
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

            {/* Selected Ticket Conversation Thread */}
            {selectedTicket && (
              <div className="bg-gym-card border border-gym rounded-2xl flex flex-col h-[520px] overflow-hidden shadow-md">
                <div className="p-3.5 bg-gym-main border-b border-gym flex items-center justify-between">
                  <div>
                    <span className="font-mono text-gym-red font-bold text-xs">{selectedTicket.ticket_number}</span>
                    <h4 className="text-xs font-bold text-gym-primary truncate mt-0.5">{selectedTicket.subject}</h4>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-gym-muted hover:text-gym-primary cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                  <div className="bg-gym-main p-3 rounded-xl border border-gym text-xs text-gym-primary">
                    <span className="text-[10px] text-gym-red font-semibold block mb-1">
                      {selectedTicket.creator?.name} ({selectedTicket.gym?.name}):
                    </span>
                    <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>

                  {(selectedTicket.messages || []).map((m) => (
                    <div
                      key={m.id}
                      className="bg-gym-main/80 p-3 rounded-xl border border-gym text-xs text-gym-primary"
                    >
                      <span className="text-[10px] text-gym-muted block mb-0.5">
                        {m.user?.name} ({m.user?.role}):
                      </span>
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-gym-main border-t border-gym space-y-2">
                  <select
                    value={ticketStatusUpdate}
                    onChange={(e) => setTicketStatusUpdate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gym-card border border-gym rounded-lg text-xs text-gym-primary"
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
                      placeholder="Post official platform reply..."
                      className="flex-1 px-3 py-1.5 bg-gym-card border border-gym rounded-lg text-xs text-gym-primary placeholder:text-gym-muted"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !replyMessage.trim()}
                      className="px-3 py-1.5 bg-gym-red hover:opacity-90 text-white rounded-lg text-xs font-bold cursor-pointer transition-opacity disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: ACTIVITY LOGS (AUDIT TRAIL)                         */}
        {/* ========================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-gym-card border border-gym rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gym">
              <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gym-red" />
                <span>Platform Administrative Audit Trail</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gym-main border-b border-gym text-gym-muted uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Event</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">IP Address</th>
                    <th className="py-2.5 px-4">Payload Snippet</th>
                    <th className="py-2.5 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gym text-gym-primary">
                  {auditLogs.map((a) => (
                    <tr key={a.id} className="hover:bg-gym-main/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-gym-red font-semibold">{a.event}</td>
                      <td className="py-3 px-4 text-gym-primary font-medium">
                        {a.user?.name || 'System / Platform'}
                      </td>
                      <td className="py-3 px-4 font-mono text-gym-muted">{a.ip_address || '—'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gym-muted max-w-xs truncate">
                        {a.payload ? JSON.stringify(a.payload) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gym-muted text-[11px]">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ========================================================= */}
        {/* TAB 7: CENTRALIZED EXERCISE VIDEO LIBRARY                 */}
        {/* ========================================================= */}
        {activeTab === 'exercise-library' && (
          <AdminExerciseLibrary />
        )}
      </main>

      {/* =========================================================== */}
      {/* 2. ADD NEW GYM MODAL (THE 3-SECTION REGISTRATION WORKFLOW)  */}
      {/* =========================================================== */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-gym-card border border-gym rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gym-main border-b border-gym flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gym-red text-white flex items-center justify-center font-bold shadow-gym-red">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gym-primary">
                    Register New Gym Partner
                  </h3>
                  <p className="text-xs text-gym-secondary">
                    Create company profile, owner credentials & configure SaaS licensing
                  </p>
                </div>
              </div>

              <button
                onClick={() => setRegisterModalOpen(false)}
                className="p-2 rounded-xl bg-gym-card border border-gym text-gym-muted hover:text-gym-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRegisterGym} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* --------------------------------------------------- */}
              {/* SECTION A: GYM INFORMATION                          */}
              {/* --------------------------------------------------- */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gym">
                  <div className="w-6 h-6 rounded-full bg-gym-red text-white text-xs font-black flex items-center justify-center">
                    A
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gym-primary">
                    Section A — Gym Information
                  </h4>
                </div>

                {/* Multilingual Names */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Gym Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Iron Forge Fitness"
                      value={regName}
                      onChange={(e) => handleGymNameChange(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-secondary mb-1">
                      Gym Name (Marathi)
                    </label>
                    <input
                      type="text"
                      placeholder="उदा. आयर्न फोर्ज फिटनेस"
                      value={regNameMr}
                      onChange={(e) => setRegNameMr(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-secondary mb-1">
                      Gym Name (Hindi)
                    </label>
                    <input
                      type="text"
                      placeholder="उदा. आयरन फोर्ज फिटनेस"
                      value={regNameHi}
                      onChange={(e) => setRegNameHi(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>
                </div>

                {/* Short Name & URL Slug with Live Check */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gym-secondary mb-1">
                      Short Name / Brand Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. IFF-PUNE"
                      value={regShortName}
                      onChange={(e) => setRegShortName(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary uppercase"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gym-primary">
                        Unique URL Slug *
                      </label>
                      {slugChecking ? (
                        <span className="text-[10px] text-gym-muted flex items-center gap-1 font-mono">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> checking...
                        </span>
                      ) : slugAvailable === true ? (
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                          <Check className="w-3 h-3" /> available
                        </span>
                      ) : slugAvailable === false ? (
                        <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                          <X className="w-3 h-3" /> taken
                        </span>
                      ) : null}
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono text-gym-muted">/gyms/</span>
                      <input
                        type="text"
                        required
                        value={regSlug}
                        onChange={(e) => {
                          setSlugManualOverride(true);
                          setRegSlug(generateSlugFromName(e.target.value));
                        }}
                        placeholder="iron-forge-fitness"
                        className={`w-full pl-16 pr-3 py-2 bg-gym-main border rounded-xl text-xs font-mono text-gym-primary ${
                          slugAvailable === false
                            ? 'border-rose-500'
                            : slugAvailable === true
                            ? 'border-emerald-500'
                            : 'border-gym'
                        }`}
                      />
                    </div>

                    {slugAvailable === false && slugSuggestion && (
                      <div className="mt-1 text-[11px] text-gym-secondary flex items-center gap-1.5">
                        <span>Suggestion:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRegSlug(slugSuggestion);
                            setSlugManualOverride(true);
                          }}
                          className="font-mono text-gym-red font-bold underline hover:opacity-80 cursor-pointer"
                        >
                          {slugSuggestion}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logo Upload, Phone, Email & Language */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Logo Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Gym Logo (Upload)
                    </label>
                    <div className="flex items-center gap-3">
                      {regLogoBase64 ? (
                        <div className="relative w-14 h-14 rounded-xl border border-gym overflow-hidden shrink-0 group">
                          <img
                            src={regLogoBase64}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setRegLogoBase64(null)}
                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gym-main border border-dashed border-gym flex items-center justify-center text-gym-muted shrink-0">
                          <Upload className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          id="logo-upload-input"
                          className="hidden"
                        />
                        <label
                          htmlFor="logo-upload-input"
                          className="inline-block px-3 py-1.5 rounded-lg bg-gym-main border border-gym text-xs font-semibold text-gym-primary hover:bg-gym-card transition-colors cursor-pointer"
                        >
                          {regLogoBase64 ? 'Change Logo' : 'Select Image File'}
                        </label>
                        <p className="text-[10px] text-gym-muted mt-1">PNG, JPG or SVG up to 2MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Primary Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Primary Contact Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="9820011223"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gym-secondary mb-1">
                      Gym Email
                    </label>
                    <input
                      type="email"
                      placeholder="info@ironforge.in"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-secondary mb-1">
                      Gym Address / City
                    </label>
                    <input
                      type="text"
                      placeholder="FC Road, Pune"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Default Language
                    </label>
                    <select
                      value={regLanguage}
                      onChange={(e) => setRegLanguage(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    >
                      <option value="en">English (Default)</option>
                      <option value="mr">मराठी (Marathi)</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------- */}
              {/* SECTION B: OWNER ACCOUNT                            */}
              {/* --------------------------------------------------- */}
              <div className="space-y-4 pt-4 border-t border-gym">
                <div className="flex items-center gap-2 pb-2 border-b border-gym">
                  <div className="w-6 h-6 rounded-full bg-gym-red text-white text-xs font-black flex items-center justify-center">
                    B
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gym-primary">
                    Section B — Owner Account Credentials
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Vikram Rathore"
                      value={regOwnerName}
                      onChange={(e) => setRegOwnerName(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="9820011223"
                      value={regOwnerMobile}
                      onChange={(e) => setRegOwnerMobile(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Login Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="vikram@ironforge.in"
                      value={regOwnerEmail}
                      onChange={(e) => setRegOwnerEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gym-primary">
                        Initial Password *
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-gym-red hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Auto-Generate</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={regOwnerPassword}
                        onChange={(e) => setRegOwnerPassword(e.target.value)}
                        className="w-full pr-9 pl-3 py-2 bg-gym-main border border-gym rounded-xl text-xs font-mono text-gym-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gym-muted hover:text-gym-primary cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-primary mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regOwnerConfirmPassword}
                      onChange={(e) => setRegOwnerConfirmPassword(e.target.value)}
                      className={`w-full px-3 py-2 bg-gym-main border rounded-xl text-xs font-mono text-gym-primary ${
                        regOwnerConfirmPassword && regOwnerConfirmPassword !== regOwnerPassword
                          ? 'border-rose-500'
                          : 'border-gym'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------- */}
              {/* SECTION C: SUBSCRIPTION                             */}
              {/* --------------------------------------------------- */}
              <div className="space-y-4 pt-4 border-t border-gym">
                <div className="flex items-center gap-2 pb-2 border-b border-gym">
                  <div className="w-6 h-6 rounded-full bg-gym-red text-white text-xs font-black flex items-center justify-center">
                    C
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gym-primary">
                    Section C — Subscription & Licensing
                  </h4>
                </div>

                {/* Plan Selection Cards */}
                <div>
                  <label className="block text-xs font-semibold text-gym-primary mb-2">
                    Select Subscription Plan *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {plans.map((p) => {
                      const isSelected = regPlanId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setRegPlanId(p.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-gym-red-subtle/80 border-gym-red shadow-xs'
                              : 'bg-gym-main border-gym hover:border-gym-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-gym-primary">{p.name}</span>
                            <span className="text-[10px] uppercase font-mono font-bold text-gym-red">
                              ₹{p.price}/{p.interval}
                            </span>
                          </div>
                          <p className="text-[11px] text-gym-muted">
                            {p.branch_limit} branch(es) • {p.member_limit} members
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Option Tabs: Pending vs Already Paid */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gym-primary mb-2">
                    Registration & Activation Mode *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegPaymentOption('paid')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        regPaymentOption === 'paid'
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-xs'
                          : 'bg-gym-main border-gym hover:border-gym-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-gym-primary">
                          Option 2: Payment Already Done
                        </span>
                      </div>
                      <p className="text-[11px] text-gym-muted mt-1">
                        Record transaction reference & activate gym tenant immediately with active license.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegPaymentOption('pending')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        regPaymentOption === 'pending'
                          ? 'bg-purple-500/10 border-purple-500 shadow-xs'
                          : 'bg-gym-main border-gym hover:border-gym-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-gym-primary">
                          Option 1: Payment Pending
                        </span>
                      </div>
                      <p className="text-[11px] text-gym-muted mt-1">
                        Create gym in Pending status. Access restricted according to subscription policy.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Paid Details Fields */}
                {regPaymentOption === 'paid' && (
                  <div className="p-3.5 rounded-xl bg-gym-main border border-gym grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gym-primary mb-1">
                        Payment Reference / UTR *
                      </label>
                      <input
                        type="text"
                        placeholder="UPI-2938479238"
                        value={regPaymentReference}
                        onChange={(e) => setRegPaymentReference(e.target.value)}
                        className="w-full px-3 py-2 bg-gym-card border border-gym rounded-lg text-xs font-mono text-gym-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gym-primary mb-1">
                        Payment Method
                      </label>
                      <select
                        value={regPaymentMethod}
                        onChange={(e) => setRegPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-gym-card border border-gym rounded-lg text-xs text-gym-primary"
                      >
                        <option value="upi">UPI / QR Code</option>
                        <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                        <option value="cash">Cash Received</option>
                        <option value="razorpay">Razorpay Gateway</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gym-primary mb-1">
                        Subscription Duration
                      </label>
                      <select
                        value={regDurationMonths}
                        onChange={(e) => setRegDurationMonths(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gym-card border border-gym rounded-lg text-xs text-gym-primary"
                      >
                        <option value={1}>1 Month</option>
                        <option value={3}>3 Months (Quarterly)</option>
                        <option value={6}>6 Months (Half-Yearly)</option>
                        <option value={12}>12 Months (Annual)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-gym flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-gym-main border border-gym hover:bg-gym-card text-gym-secondary text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold transition-all shadow-gym-red disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering Gym...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Register Gym</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================== */}
      {/* 3. GYM DETAILS MODAL / DRAWER                               */}
      {/* =========================================================== */}
      {selectedGymForDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-gym-card border border-gym rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Drawer Header */}
            <div className="p-5 sm:p-6 bg-gym-main border-b border-gym flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gym-red-subtle border border-gym-red flex items-center justify-center font-black text-gym-red text-base uppercase">
                  {selectedGymForDetails.name.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-gym-primary">
                      {selectedGymForDetails.name}
                    </h3>
                    {getStatusBadge(selectedGymForDetails.status)}
                  </div>
                  <p className="text-xs font-mono text-gym-red">
                    /gyms/{selectedGymForDetails.slug}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleImpersonate(selectedGymForDetails)}
                  className="px-3 py-1.5 rounded-xl bg-gym-red text-white text-xs font-bold flex items-center gap-1 shadow-gym-red cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Impersonate Owner</span>
                </button>

                <button
                  onClick={() => setSelectedGymForDetails(null)}
                  className="p-2 rounded-xl bg-gym-card border border-gym text-gym-muted hover:text-gym-primary cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Section 1: Tenant Information & Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gym-main border border-gym space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gym-red flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Gym Information</span>
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gym-muted">Phone:</span>
                      <span className="font-mono text-gym-primary">{selectedGymForDetails.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gym-muted">Email:</span>
                      <span className="text-gym-primary">{selectedGymForDetails.email || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gym-muted">Address:</span>
                      <span className="text-gym-primary">{selectedGymForDetails.address || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gym-muted">Registered On:</span>
                      <span className="font-mono text-gym-primary">
                        {new Date(selectedGymForDetails.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gym-main border border-gym space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gym-red flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Owner Account</span>
                  </h4>
                  {selectedGymForDetails.users?.[0] ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gym-muted">Full Name:</span>
                        <span className="font-bold text-gym-primary">{selectedGymForDetails.users[0].name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gym-muted">Login Email:</span>
                        <span className="font-mono text-gym-primary">{selectedGymForDetails.users[0].email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gym-muted">Phone:</span>
                        <span className="font-mono text-gym-primary">{selectedGymForDetails.users[0].phone || '—'}</span>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setResetPasswordModal(selectedGymForDetails);
                            setCustomPassword('');
                            setTempPasswordResult(null);
                          }}
                          className="px-3 py-1 rounded-lg bg-gym-card border border-gym text-xs font-semibold text-amber-500 hover:border-amber-500 flex items-center gap-1 cursor-pointer"
                        >
                          <Key className="w-3 h-3" />
                          <span>Reset Owner Password</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gym-muted">No primary owner account bound.</p>
                  )}
                </div>
              </div>

              {/* Section 2: Subscription & Quick Extension */}
              <div className="p-4 rounded-2xl bg-gym-main border border-gym space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gym-red flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    <span>SaaS Subscription & Expiry</span>
                  </h4>
                  <span className="text-xs font-bold text-gym-primary">
                    Plan: {selectedGymForDetails.plan?.name || 'Growth Plan'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-gym text-xs">
                  <div>
                    <span className="text-gym-muted block">Expires At:</span>
                    <span className="font-mono font-bold text-gym-primary">
                      {selectedGymForDetails.subscription_expires_at
                        ? new Date(selectedGymForDetails.subscription_expires_at).toLocaleString()
                        : 'Lifetime / Uncapped'}
                    </span>
                    <span className="text-[11px] text-gym-muted block mt-0.5">
                      {getDaysRemaining(selectedGymForDetails.subscription_expires_at).text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gym-muted">Quick Extend:</span>
                    <button
                      onClick={() => handleExtend(selectedGymForDetails, 15)}
                      className="px-2.5 py-1 rounded-lg bg-gym-card border border-gym hover:border-emerald-500 text-gym-primary text-xs font-semibold cursor-pointer"
                    >
                      +15d
                    </button>
                    <button
                      onClick={() => handleExtend(selectedGymForDetails, 30)}
                      className="px-2.5 py-1 rounded-lg bg-gym-card border border-gym hover:border-emerald-500 text-gym-primary text-xs font-semibold cursor-pointer"
                    >
                      +30d
                    </button>
                    <button
                      onClick={() => handleExtend(selectedGymForDetails, 90)}
                      className="px-2.5 py-1 rounded-lg bg-gym-card border border-gym hover:border-emerald-500 text-gym-primary text-xs font-semibold cursor-pointer"
                    >
                      +90d
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Platform Module Entitlements (Toggles) */}
              <div className="p-4 rounded-2xl bg-gym-main border border-gym space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gym-red flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Platform Feature Entitlements</span>
                    </h4>
                    <p className="text-[11px] text-gym-muted mt-0.5">
                      Super Admin overrides for enabling/disabling specific OS modules for this tenant.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveModules}
                    disabled={savingModules}
                    className="px-3.5 py-1.5 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    {savingModules ? 'Saving...' : 'Save Toggles'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gym">
                  {[
                    { key: 'module_ai_advisor', label: 'AI Business Advisor' },
                    { key: 'module_whatsapp', label: 'WhatsApp Automation' },
                    { key: 'module_inventory_pos', label: 'Store POS & Inventory' },
                    { key: 'module_crm_leads', label: 'CRM & Lead Followups' },
                    { key: 'module_member_portal', label: 'Member Self-Service Portal' },
                    { key: 'module_trainer_portal', label: 'Trainer & PT Portal' },
                  ].map((mod) => (
                    <label
                      key={mod.key}
                      className="flex items-center justify-between p-3 rounded-xl bg-gym-card border border-gym text-xs cursor-pointer"
                    >
                      <span className="font-semibold text-gym-primary">{mod.label}</span>
                      <input
                        type="checkbox"
                        checked={gymModuleToggles[mod.key] ?? true}
                        onChange={(e) =>
                          setGymModuleToggles({
                            ...gymModuleToggles,
                            [mod.key]: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 4: Security & Tenant Actions */}
              <div className="p-4 rounded-2xl bg-gym-main border border-gym flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gym-primary block">Tenant Status Control</span>
                  <span className="text-[11px] text-gym-muted">
                    Lock or unlock platform operations for this tenant.
                  </span>
                </div>

                <div>
                  {selectedGymForDetails.status === 'active' ? (
                    <button
                      onClick={() => handleSuspend(selectedGymForDetails)}
                      className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Suspend Gym
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(selectedGymForDetails)}
                      className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Activate Gym
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================== */}
      {/* 4. RESET PASSWORD MODAL                                     */}
      {/* =========================================================== */}
      {resetPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-gym-card border border-gym rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gym">
              <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Reset Owner Password</span>
              </h3>
              <button
                onClick={() => setResetPasswordModal(null)}
                className="text-gym-muted hover:text-gym-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gym-secondary">
              Reset password for owner of <span className="font-bold text-gym-primary">"{resetPasswordModal.name}"</span>.
              All active sessions will be revoked immediately for security.
            </p>

            {tempPasswordResult ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <span className="text-xs text-emerald-500 font-bold block">
                  Password Successfully Reset!
                </span>
                <div className="bg-gym-main p-2.5 rounded-lg border border-gym font-mono text-sm text-gym-primary select-all text-center">
                  {tempPasswordResult}
                </div>
                <p className="text-[11px] text-gym-muted">Share this temporary password securely with the gym owner.</p>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gym-muted mb-1">
                    Set Custom Password (or leave empty to auto-generate)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generate secure password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordModal(null)}
                    className="px-4 py-2 rounded-xl bg-gym-main border border-gym hover:bg-gym-card text-gym-secondary text-xs font-semibold cursor-pointer"
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

      {/* =========================================================== */}
      {/* 5. CREATE / EDIT SAAS PLAN MODAL                            */}
      {/* =========================================================== */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-gym-card border border-gym rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gym">
              <h3 className="text-sm font-bold text-gym-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-gym-red" />
                <span>{editingPlan ? 'Edit SaaS Plan' : 'Create New Plan'}</span>
              </h3>
              <button onClick={() => setPlanModalOpen(false)} className="text-gym-muted hover:text-gym-primary cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gym-primary mb-1">Plan Code *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingPlan}
                  value={planForm.code}
                  onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                  placeholder="starter-plan"
                  className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary font-mono disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gym-primary mb-1">Plan Display Name *</label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="Starter Fitness"
                  className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gym-primary mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gym-primary mb-1">Interval *</label>
                  <select
                    value={planForm.interval}
                    onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}
                    className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gym-primary mb-1">Branch Limit *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={planForm.branch_limit}
                    onChange={(e) => setPlanForm({ ...planForm, branch_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gym-primary mb-1">Member Limit *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={planForm.member_limit}
                    onChange={(e) => setPlanForm({ ...planForm, member_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gym-main border border-gym rounded-xl text-xs text-gym-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gym">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gym-main border border-gym hover:bg-gym-card text-gym-secondary text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-gym-red hover:opacity-90 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-gym-red"
                >
                  {isSubmitting ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
