import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Apple,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  CreditCard,
  DollarSign,
  Droplets,
  Dumbbell,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  Heart,
  Info,
  MessageCircle,
  Moon,
  Pause,
  Phone,
  Play,
  PlayCircle,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  RotateCcw,
  Salad,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Utensils,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters';

interface MemberProfile {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  status: string;
  photo_url?: string;
  outstanding_balance: number;
  branch?: {
    id: number;
    name: string;
  };
  assigned_trainer?: {
    id: number;
    name: string;
    specialization?: string;
    phone?: string;
    avatar_url?: string;
  };
  active_membership?: {
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    plan?: {
      id: number;
      name: string;
      duration_days: number;
    };
  };
}

interface AttendanceStats {
  streak_days: number;
  total_visits_this_month: number;
  last_check_in?: string;
  visited_dates?: string[];
  recent_logs: Array<{
    id: number;
    check_in_at: string;
    check_out_at?: string;
    branch_name: string;
  }>;
}

interface PaymentRecord {
  id: number;
  receipt_number: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
}

interface MemberInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  discount_amount: number;
  tax_amount: number;
  final_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  effective_status?: string;
  notes?: string;
  branch?: { id: number; name: string };
  membership?: { plan?: { id: number; name: string } };
  allocations?: Array<{
    id: number;
    amount: number;
    payment?: { receipt_number: string; payment_date: string; payment_method: string };
  }>;
}

interface TodayWorkoutData {
  plan_id: number;
  plan_title: string;
  goal: string;
  difficulty: string;
  day_name: string;
  duration_minutes?: number;
  is_rest_day: boolean;
  exercises: Array<{
    exercise_id?: number;
    name: string;
    sets: number;
    reps: string;
    target_weight_kg?: number;
    rest_seconds?: number;
    notes?: string;
    video_url?: string;
    has_playable_video?: boolean;
    video_source?: string;
    video_source_label?: string;
    video_thumbnail?: string;
    video_info?: any;
  }>;
  coach_notes?: string;
  status: string;
  session?: {
    id: number;
    status: string;
    duration_minutes?: number;
    rating?: number;
    notes?: string;
    set_logs?: Array<{
      exercise_name: string;
      set_number: number;
      reps: number;
      weight_kg: number;
      completed: boolean;
    }>;
  };
}

interface TodayDietData {
  plan_id: number;
  title: string;
  goal: string;
  dietary_preference: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  completed_meals_count: number;
  total_meals_count: number;
  completion_percent: number;
  meals: Array<{
    slot: string;
    slot_title: string;
    time: string;
    is_completed: boolean;
    completed_at?: string;
    items: Array<{
      food_name: string;
      quantity: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
  }>;
}

interface WaterTrackingData {
  target_ml: number;
  consumed_ml: number;
  percent: number;
}

interface FitnessGoalData {
  id?: number;
  title: string;
  category: string;
  start_value?: number;
  current_value?: number;
  target_value?: number;
  unit: string;
  progress_percent?: number;
  notes?: string;
}

interface ProgressOverviewData {
  goal?: FitnessGoalData | null;
  starting_weight?: number | null;
  current_weight?: number | null;
  target_weight?: number | null;
  weight_change?: number | null;
  total_logs_count?: number;
}

interface AssignedTrainerData {
  id: number;
  name: string;
  phone: string;
  specialization?: string;
  avatar_url?: string;
  whatsapp_url?: string;
  call_url?: string;
}

interface ProgressLogItem {
  id: number;
  log_date: string;
  weight_kg?: number;
  body_fat_percent?: number;
  chest_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  arms_cm?: number;
  thighs_cm?: number;
  calves_cm?: number;
  notes?: string;
}

export default function MemberPortal() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // Active Tab Navigation - Default to 'today' (Personal Fitness Companion)
  const [activeTab, setActiveTab] = useState<'today' | 'diet' | 'progress' | 'attendance' | 'pass' | 'payments'>('today');

  // Core Data States
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<MemberInvoice[]>([]);
  const [portalBalance, setPortalBalance] = useState<number>(0);
  const [payOnlineLoading, setPayOnlineLoading] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<number | null>(null);
  const [onlinePaySuccess, setOnlinePaySuccess] = useState<string | null>(null);
  const [receiptModalInvoice, setReceiptModalInvoice] = useState<MemberInvoice | null>(null);

  // Fitness Today Data
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkoutData | null>(null);
  const [todayDiet, setTodayDiet] = useState<TodayDietData | null>(null);
  const [waterData, setWaterData] = useState<WaterTrackingData>({ target_ml: 2500, consumed_ml: 0, percent: 0 });
  const [progressOverview, setProgressOverview] = useState<ProgressOverviewData | null>(null);
  const [assignedTrainer, setAssignedTrainer] = useState<AssignedTrainerData | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Live Workout Session Modal
  const [workoutTrackerOpen, setWorkoutTrackerOpen] = useState(false);
  const [activeExerciseVideo, setActiveExerciseVideo] = useState<{
    name: string;
    video_url?: string;
    has_playable_video?: boolean;
    video_source?: string;
    video_source_label?: string;
    instructions?: string;
    safety_notes?: string;
  } | null>(null);
  const [loggingSet, setLoggingSet] = useState(false);
  const [completingWorkout, setCompletingWorkout] = useState(false);
  const [sessionRating, setSessionRating] = useState<number>(5);
  const [sessionDuration, setSessionDuration] = useState<number>(45);
  const [sessionFeedback, setSessionFeedback] = useState('');

  // Set logger state
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [activeExerciseName, setActiveExerciseName] = useState('');
  const [activeSetNum, setActiveSetNum] = useState(1);
  const [actualReps, setActualReps] = useState(10);
  const [actualWeight, setActualWeight] = useState(50);

  // Workout Rest Timer State
  const [restTimerSeconds, setRestTimerSeconds] = useState(60);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimerInitial, setRestTimerInitial] = useState(60);

  // Self Record Progress Modal
  const [recordProgressOpen, setRecordProgressOpen] = useState(false);
  const [progWeight, setProgWeight] = useState('75.0');
  const [progFat, setProgFat] = useState('15.0');
  const [progChest, setProgChest] = useState('');
  const [progWaist, setProgWaist] = useState('');
  const [progHips, setProgHips] = useState('');
  const [progArms, setProgArms] = useState('');
  const [progThighs, setProgThighs] = useState('');
  const [progNotes, setProgNotes] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  // Renewal Modal
  const [renewalModalOpen, setRenewalModalOpen] = useState(false);
  const [renewalPlanId, setRenewalPlanId] = useState('');
  const [renewalNotes, setRenewalNotes] = useState('');
  const [plans, setPlans] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [submittingRenewal, setSubmittingRenewal] = useState(false);

  // Enlarged QR Pass Modal
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Rest Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (restTimerActive && restTimerSeconds > 0) {
      interval = setInterval(() => {
        setRestTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (restTimerSeconds === 0 && restTimerActive) {
      setRestTimerActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [restTimerActive, restTimerSeconds]);

  // Fetch all Portal Data
  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, attRes, payRes, fitnessRes, progRes] = await Promise.all([
        api.get('/member-portal/profile'),
        api.get('/member-portal/attendance').catch(() => ({ data: { streak_days: 0, total_visits_this_month: 0, recent_logs: [], visited_dates: [] } })),
        api.get('/member-portal/payments').catch(() => ({ data: { payments: [], invoices: [], outstanding_balance: 0 } })),
        api.get('/member-portal/fitness-today').catch(() => ({ data: { today_workout: null, today_diet: null, water: { target_ml: 2500, consumed_ml: 0, percent: 0 } } })),
        api.get('/member-portal/my-progress').catch(() => ({ data: { progress_logs: [] } })),
      ]);

      const mem = profileRes.data.member || profileRes.data;
      setProfile(mem);
      setAttendance(attRes.data);
      setPayments(payRes.data.membership_payments || payRes.data.payments || []);
      setInvoices(payRes.data.invoices || []);
      setPortalBalance(payRes.data.outstanding_balance ?? mem?.outstanding_balance ?? 0);

      // Fitness today data
      const fitData = fitnessRes.data;
      setTodayWorkout(fitData.today_workout || null);
      setTodayDiet(fitData.today_diet || null);
      if (fitData.water) {
        setWaterData(fitData.water);
      }
      if (fitData.progress_overview) {
        setProgressOverview(fitData.progress_overview);
      }
      if (fitData.trainer) {
        setAssignedTrainer(fitData.trainer);
      } else if (mem?.assigned_trainer) {
        setAssignedTrainer({
          id: mem.assigned_trainer.id,
          name: mem.assigned_trainer.name,
          phone: mem.assigned_trainer.phone || '',
          specialization: mem.assigned_trainer.specialization || 'Personal Fitness Coach',
          whatsapp_url: mem.assigned_trainer.phone ? `https://wa.me/91${mem.assigned_trainer.phone.replace(/[^0-9]/g, '')}` : undefined,
          call_url: mem.assigned_trainer.phone ? `tel:${mem.assigned_trainer.phone}` : undefined,
        });
      }

      setProgressLogs(progRes.data.progress_logs || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get('/membership-plans');
      setPlans(res.data.plans || res.data.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPortalData();
    fetchPlans();
  }, []);

  // Quick One-Tap Water Increment
  const handleIncrementWater = async (amountMl: number, action: 'add' | 'subtract' = 'add') => {
    try {
      const res = await api.post('/member-portal/water-log', {
        amount_ml: amountMl,
        action,
      });
      if (res.data?.water) {
        setWaterData(res.data.water);
        setActionNotice(
          action === 'add'
            ? `💧 Logged +${amountMl} ml! Great job staying hydrated.`
            : `💧 Adjusted water intake (-${amountMl} ml)`
        );
        setTimeout(() => setActionNotice(null), 3500);
      }
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Handle toggling meal slot eaten
  const handleToggleMeal = async (slotKey: string, currentStatus: boolean) => {
    if (!todayDiet) return;
    try {
      await api.post('/member-portal/meal-log/toggle', {
        diet_plan_id: todayDiet.plan_id,
        meal_slot: slotKey,
        is_completed: !currentStatus,
      });

      // Update locally immediately for instantaneous UI feedback
      setTodayDiet((prev) => {
        if (!prev) return prev;
        const updatedMeals = prev.meals.map((m) =>
          m.slot === slotKey ? { ...m, is_completed: !currentStatus } : m
        );
        const completedCount = updatedMeals.filter((m) => m.is_completed).length;
        return {
          ...prev,
          meals: updatedMeals,
          completed_meals_count: completedCount,
          completion_percent: Math.round((completedCount / updatedMeals.length) * 100),
        };
      });

      setActionNotice(!currentStatus ? '🥗 Meal logged as completed!' : 'Meal marked as pending.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Log a set during workout
  const handleLogSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todayWorkout) return;

    try {
      setLoggingSet(true);
      await api.post('/member-portal/workout-session/log-set', {
        workout_plan_id: todayWorkout.plan_id,
        day_name: todayWorkout.day_name,
        exercise_name: activeExerciseName || todayWorkout.exercises[activeExerciseIndex]?.name || 'Exercise',
        set_number: activeSetNum,
        reps: Number(actualReps),
        weight_kg: Number(actualWeight),
      });

      // Automatically restart rest timer
      const targetRest = todayWorkout.exercises[activeExerciseIndex]?.rest_seconds || 60;
      setRestTimerInitial(targetRest);
      setRestTimerSeconds(targetRest);
      setRestTimerActive(true);

      // Increment set number for fast consecutive entry
      setActiveSetNum((prev) => prev + 1);
      fetchPortalData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setLoggingSet(false);
    }
  };

  // Complete workout session
  const handleCompleteWorkout = async () => {
    if (!todayWorkout) return;
    try {
      setCompletingWorkout(true);
      await api.post('/member-portal/workout-session/complete', {
        workout_plan_id: todayWorkout.plan_id,
        day_name: todayWorkout.day_name,
        duration_minutes: Number(sessionDuration),
        rating: Number(sessionRating),
        notes: sessionFeedback,
      });

      setWorkoutTrackerOpen(false);
      setActionNotice('Awesome work! Workout marked as completed for today! 💪🔥');
      setTimeout(() => setActionNotice(null), 5000);
      fetchPortalData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setCompletingWorkout(false);
    }
  };

  // Submit self-measurements
  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProgress(true);
      await api.post('/member-portal/record-progress', {
        weight_kg: progWeight ? Number(progWeight) : null,
        body_fat_percent: progFat ? Number(progFat) : null,
        chest_cm: progChest ? Number(progChest) : null,
        waist_cm: progWaist ? Number(progWaist) : null,
        hips_cm: progHips ? Number(progHips) : null,
        arms_cm: progArms ? Number(progArms) : null,
        thighs_cm: progThighs ? Number(progThighs) : null,
        notes: progNotes,
      });

      setRecordProgressOpen(false);
      setActionNotice('Measurements saved! Your progress graph has been updated.');
      setTimeout(() => setActionNotice(null), 5000);
      fetchPortalData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingProgress(false);
    }
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingRenewal(true);
      await api.post('/member-portal/renew-request', {
        plan_id: renewalPlanId ? Number(renewalPlanId) : null,
        notes: renewalNotes,
      });
      setRenewalModalOpen(false);
      setRenewalNotes('');
      setActionNotice('Renewal request submitted! Reception desk has been notified.');
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmittingRenewal(false);
    }
  };

  const handlePayInvoiceOnline = async (invoice: MemberInvoice) => {
    try {
      setPayingInvoiceId(invoice.id);
      setPayOnlineLoading(true);
      setError(null);
      const orderRes = await api.post(`/member-portal/invoices/${invoice.id}/create-order`);
      const orderData = orderRes.data;

      if (typeof (window as any).Razorpay !== 'undefined') {
        const rzpOptions = {
          key: orderData.razorpay_key_id,
          amount: orderData.amount_paise,
          currency: 'INR',
          name: profile?.branch?.name || 'IronCore Fitness',
          description: `Clear Balance for ${invoice.invoice_number}`,
          order_id: orderData.razorpay_order_id,
          prefill: {
            name: `${profile?.first_name} ${profile?.last_name || ''}`.trim(),
            contact: profile?.phone || '',
            email: profile?.email || '',
          },
          theme: {
            color: '#D92332',
          },
          handler: async (resp: any) => {
            await api.post(`/member-portal/invoices/${invoice.id}/verify-payment`, {
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setOnlinePaySuccess(`Payment of ₹${Number(invoice.balance_due).toLocaleString('en-IN')} received successfully!`);
            fetchPortalData();
          },
          modal: {
            ondismiss: () => {
              setPayOnlineLoading(false);
              setPayingInvoiceId(null);
            },
          },
        };
        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.open();
      } else {
        // Direct simulation in test/sandbox environments
        await api.post(`/member-portal/invoices/${invoice.id}/verify-payment`, {
          razorpay_payment_id: 'pay_sim_' + Date.now(),
          razorpay_order_id: orderData.razorpay_order_id,
          razorpay_signature: 'sig_mock_verified',
        });
        setOnlinePaySuccess(`Payment of ₹${Number(invoice.balance_due).toLocaleString('en-IN')} verified successfully!`);
        fetchPortalData();
      }
    } catch (err: any) {
      alert(errorMessage(err));
    } finally {
      setPayOnlineLoading(false);
      setPayingInvoiceId(null);
    }
  };

  // Helper: Personalized Greeting
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return t('fitness_dashboard.greeting_morning', 'Good morning');
    if (hr < 17) return t('fitness_dashboard.greeting_afternoon', 'Good afternoon');
    return t('fitness_dashboard.greeting_evening', 'Good evening');
  };

  // Helper: Month Attendance Calendar Matrix
  const renderAttendanceCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const visitedSet = new Set(attendance?.visited_dates || []);

    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const cells = [];

    // Empty lead cells
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`pad-${i}`} className="h-9 rounded-xl bg-transparent" />);
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isAttended = visitedSet.has(dateString);
      const isToday = d === now.getDate();
      const isPast = d < now.getDate();

      cells.push(
        <div
          key={`day-${d}`}
          className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative ${
            isAttended
              ? 'bg-[#D92332] text-white shadow-md shadow-red-500/25 ring-2 ring-red-400/50'
              : isToday
              ? 'bg-red-500/10 text-[#D92332] dark:text-[#F02D3A] border border-[#D92332]'
              : isPast
              ? 'bg-slate-100 dark:bg-[#1E1E1E] text-slate-400 dark:text-slate-500'
              : 'bg-slate-50 dark:bg-[#161616] text-slate-300 dark:text-slate-600'
          }`}
          title={`${dateString}: ${isAttended ? 'Attended' : isToday ? 'Today' : 'No check-in'}`}
        >
          <span>{d}</span>
          {isAttended && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] flex items-center justify-center font-black">
              ✓
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-slate-400">
          {dayLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">{cells}</div>
      </div>
    );
  };

  if (loading && !profile) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#D92332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading your personal fitness companion...</p>
        </div>
      </div>
    );
  }

  const isExpired = profile?.active_membership
    ? new Date(profile.active_membership.end_date) < new Date()
    : true;

  const memberPassQrData = profile
    ? JSON.stringify({
        type: 'member_pass',
        code: profile.member_code,
        id: profile.id,
        gym_id: user?.gym?.id,
        name: `${profile.first_name} ${profile.last_name}`,
        phone: profile.phone,
      })
    : 'GYM-MEMBER';

  const latestLog = progressLogs[0];
  const initialLog = progressLogs[progressLogs.length - 1];
  const weightChange =
    progressOverview?.weight_change !== undefined && progressOverview?.weight_change !== null
      ? progressOverview.weight_change
      : latestLog && initialLog && latestLog.weight_kg && initialLog.weight_kg
      ? Number((latestLog.weight_kg - initialLog.weight_kg).toFixed(1))
      : null;

  const currentWeightDisplay =
    progressOverview?.current_weight || latestLog?.weight_kg || '—';
  const startWeightDisplay =
    progressOverview?.starting_weight || initialLog?.weight_kg || '—';
  const targetWeightDisplay =
    progressOverview?.target_weight || progressOverview?.goal?.target_value || '—';
  const goalProgressPercent =
    progressOverview?.goal?.progress_percent !== undefined
      ? progressOverview.goal.progress_percent
      : 50;

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. PERSONALIZED HERO GREETING & STATUS BANNER                 */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 md:p-8 rounded-3xl bg-linear-to-r from-red-600 via-rose-600 to-orange-500 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.first_name}
                className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/30 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md ring-4 ring-white/30 flex items-center justify-center text-white text-2xl font-black shrink-0">
                {profile?.first_name?.charAt(0) || 'U'}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/25 px-2.5 py-0.5 rounded-full inline-block">
                  {profile?.branch?.name || 'Main Flagship Branch'}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    !isExpired ? 'bg-emerald-400 text-slate-950' : 'bg-white text-red-600'
                  }`}
                >
                  {!isExpired
                    ? t('fitness_dashboard.active_member', 'Active Member')
                    : t('fitness_dashboard.expired_member', 'Membership Expired')}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                {getGreeting()}, {profile?.first_name}!
              </h1>

              <p className="text-xs text-white/90 font-medium">
                {t('fitness_dashboard.greeting_tagline', "Let's make today count.")} •{' '}
                <span className="font-semibold">
                  {new Date().toLocaleDateString(
                    i18n.language === 'mr' ? 'mr-IN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US',
                    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Header Controls */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <LanguageSwitcher variant="dropdown" />
            <button
              onClick={fetchPortalData}
              className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              onClick={() => setActiveTab('pass')}
              className="px-4 py-2 rounded-xl bg-white text-red-600 hover:bg-red-50 text-xs font-black shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Gym Pass</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Notifications */}
      {actionNotice && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. REFINED ATHLETIC TAB NAVIGATION (MOBILE FIRST)             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-[#2C2C2C] no-scrollbar">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'today'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>{t('fitness_dashboard.tab_today', "Today's Focus")}</span>
        </button>

        <button
          onClick={() => setActiveTab('diet')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'diet'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>{t('fitness_dashboard.tab_diet', 'Weekly Diet')}</span>
        </button>

        <button
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{t('fitness_dashboard.tab_progress', 'Progress & Logs')}</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('fitness_dashboard.tab_attendance', 'Attendance')}</span>
        </button>

        <button
          onClick={() => setActiveTab('pass')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'pass'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>{t('fitness_dashboard.tab_pass', 'Gym Pass')}</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{t('fitness_dashboard.tab_invoices', 'Invoices & Udhar')}</span>
          {portalBalance > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DASHBOARD VIEW (TAB: TODAY'S FOCUS)                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* SECTION A: TODAY'S WORKOUT CARD */}
          <div className="p-6 md:p-7 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 rounded-2xl bg-red-500/10 text-[#D92332] dark:text-[#F02D3A]">
                  <Dumbbell className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {t('fitness_dashboard.todays_workout', "Today's Workout")}
                    </span>
                    {todayWorkout?.session?.status === 'completed' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        {t('fitness_dashboard.workout_completed', 'Completed Today')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                    {todayWorkout?.day_name || (todayWorkout?.is_rest_day ? 'Rest & Recovery Day' : 'Workout Routine')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {todayWorkout?.plan_title || 'General Fitness'} •{' '}
                    <span className="capitalize">{todayWorkout?.difficulty || 'Intermediate'}</span> •{' '}
                    <span>{todayWorkout?.duration_minutes || 50} min</span>
                  </p>
                </div>
              </div>

              {/* Action Button */}
              {todayWorkout?.is_rest_day ? (
                <span className="px-4 py-2 rounded-2xl bg-slate-200 dark:bg-[#252525] text-slate-600 dark:text-slate-300 text-xs font-bold">
                  Rest & Grow 💤
                </span>
              ) : todayWorkout?.session?.status === 'completed' ? (
                <div className="flex items-center gap-2">
                  <span className="px-4 py-2 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Rating: ★ {todayWorkout.session.rating || 5}/5</span>
                  </span>
                  <button
                    onClick={() => {
                      if (todayWorkout?.exercises && todayWorkout.exercises.length > 0) {
                        setActiveExerciseIndex(0);
                        setActiveExerciseName(todayWorkout.exercises[0].name);
                      }
                      setWorkoutTrackerOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-2xl bg-slate-200 dark:bg-[#222] text-xs font-bold hover:text-white cursor-pointer"
                  >
                    View Logs
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (todayWorkout?.exercises && todayWorkout.exercises.length > 0) {
                      setActiveExerciseIndex(0);
                      setActiveExerciseName(todayWorkout.exercises[0].name);
                      setActualReps(10);
                      setActualWeight(todayWorkout.exercises[0].target_weight_kg || 40);
                    }
                    setWorkoutTrackerOpen(true);
                  }}
                  className="px-6 py-3 rounded-2xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-lg shadow-red-500/30 flex items-center gap-2 cursor-pointer transition-all transform active:scale-95"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>
                    {todayWorkout?.session?.status === 'in_progress'
                      ? t('fitness_dashboard.resume_workout', 'Resume Workout')
                      : t('fitness_dashboard.start_workout', 'Start Workout')}
                  </span>
                </button>
              )}
            </div>

            {/* Empty State / Rest Day */}
            {todayWorkout?.is_rest_day ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2C2C2C] text-center space-y-2">
                <Moon className="w-8 h-8 text-indigo-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t('fitness_dashboard.rest_day', 'Rest & Recovery Day')}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {t('fitness_dashboard.rest_day_desc', 'No workout scheduled for today. Focus on light stretching, optimal hydration, and quality sleep to allow muscle fibers to repair.')}
                </p>
              </div>
            ) : !todayWorkout || !todayWorkout.exercises || todayWorkout.exercises.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2C2C2C] text-center space-y-2">
                <Dumbbell className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Specific Routine Scheduled For Today
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Your trainer hasn't scheduled exercises for today. Check with your coach or tap below to browse video tutorials.
                </p>
              </div>
            ) : (
              /* Exercise Cards Preview */
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Prescribed Exercises ({todayWorkout.exercises.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Tap video icon for demonstration
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {todayWorkout.exercises.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C] flex items-center justify-between gap-3 hover:border-red-500/30 transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate block">
                          {idx + 1}. {item.name}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-slate-400 italic truncate block">
                            "{item.notes}"
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setActiveExerciseVideo({
                              name: item.name,
                              video_url: item.video_url || item.video_info?.embed_url,
                              has_playable_video: item.has_playable_video,
                              video_source: item.video_source,
                              video_source_label: item.video_source_label,
                              instructions: item.video_info?.instructions,
                              safety_notes: item.video_info?.safety_notes,
                            })
                          }
                          className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#1C1C1C] hover:bg-red-500/10 hover:text-[#D92332] text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current text-[#D92332]" />
                          <span>{item.has_playable_video ? 'Watch Tutorial' : 'Form Guide'}</span>
                          {item.video_source === 'gym_custom' && (
                            <span className="text-[8px] px-1 py-0.2 rounded-full bg-[#D92332] text-white font-black">
                              Gym Video
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-[#D92332] dark:text-[#F02D3A] block">
                          {item.sets} Sets × {item.reps}
                        </span>
                        {item.target_weight_kg && item.target_weight_kg > 0 ? (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Target: {item.target_weight_kg} kg
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION B: TODAY'S DIET & WATER INTAKE TRACKER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Diet Checklist (2 cols) */}
            <div className="md:col-span-2 p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Utensils className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      {t('fitness_dashboard.todays_diet', "Today's Nutrition")}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {todayDiet?.title || 'Nutrient Balanced Plan'}
                    </h3>
                    <span className="text-xs text-slate-500 capitalize">
                      {todayDiet?.dietary_preference?.replace('_', ' ') || 'High Protein'} • Goal:{' '}
                      {todayDiet?.goal?.replace('_', ' ') || 'Fitness'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('diet')}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-[#D92332] hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  View Full Weekly Diet →
                </button>
              </div>

              {/* Macro Pills */}
              {todayDiet && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Calories</span>
                    <span className="text-xs font-black text-amber-500 font-mono mt-0.5 block">
                      {todayDiet.target_calories} kcal
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Protein</span>
                    <span className="text-xs font-black text-emerald-500 font-mono mt-0.5 block">
                      {todayDiet.target_protein_g}g
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Carbs</span>
                    <span className="text-xs font-black text-blue-500 font-mono mt-0.5 block">
                      {todayDiet.target_carbs_g}g
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Fats</span>
                    <span className="text-xs font-black text-rose-500 font-mono mt-0.5 block">
                      {todayDiet.target_fat_g}g
                    </span>
                  </div>
                </div>
              )}

              {/* Meal Slots Checklist */}
              <div className="space-y-2.5 pt-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Today's Meal Checklist (Tap to mark eaten)
                </span>

                {(!todayDiet?.meals || todayDiet.meals.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No individual meal slots scheduled for today.
                  </p>
                ) : (
                  todayDiet.meals.map((slot, sIdx) => (
                    <div
                      key={sIdx}
                      onClick={() => handleToggleMeal(slot.slot, slot.is_completed)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        slot.is_completed
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-[#101010] border-slate-200 dark:border-[#2C2C2C] hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            slot.is_completed
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'border-2 border-slate-400 text-transparent'
                          }`}
                        >
                          ✓
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`text-xs font-black truncate ${
                                slot.is_completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {slot.slot_title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              ({slot.time})
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 mt-1">
                            {slot.items.map((it, i) => (
                              <span
                                key={i}
                                className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1C1C1C] px-2 py-0.5 rounded-md font-medium"
                              >
                                {it.food_name} • {it.quantity} ({it.calories} kcal)
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                          slot.is_completed
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-200 dark:bg-[#252525] text-slate-500'
                        }`}
                      >
                        {slot.is_completed ? 'Eaten' : 'Pending'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Interactive Water Tracker Widget (1 col) */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-500">
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        {t('fitness_dashboard.water_tracker', 'Water Tracker')}
                      </span>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">Hydration Level</h4>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-cyan-500">
                    {waterData.percent}%
                  </span>
                </div>

                <div className="text-center my-6 space-y-1">
                  <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                    {waterData.consumed_ml.toLocaleString('en-IN')}{' '}
                    <span className="text-xs font-normal text-slate-400">/ {waterData.target_ml} ml</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    Daily hydration target
                  </span>
                </div>

                {/* Animated Water Bar */}
                <div className="w-full bg-slate-200 dark:bg-[#252525] h-3.5 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-linear-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500 shadow-sm shadow-cyan-500/50"
                    style={{ width: `${Math.min(100, waterData.percent)}%` }}
                  />
                </div>
              </div>

              {/* Water Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleIncrementWater(250, 'add')}
                  className="w-full py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-black shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('fitness_dashboard.add_water_250', '+250 ml (One Tap)')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIncrementWater(500, 'add')}
                    className="flex-1 py-1.5 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-slate-300 dark:hover:bg-[#303030] text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    +500 ml
                  </button>
                  <button
                    onClick={() => handleIncrementWater(250, 'subtract')}
                    className="py-1.5 px-3 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-rose-500/20 hover:text-rose-500 text-[11px] font-bold text-slate-500 cursor-pointer"
                    title="Undo 250ml"
                  >
                    -250 ml
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION C & SECTION D: PROGRESS & ATTENDANCE ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SECTION C: GOAL & PROGRESS OVERVIEW */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        {t('fitness_dashboard.your_progress', 'Your Progress')}
                      </span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {progressOverview?.goal?.title || 'Target Fitness Goal'}
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={() => setRecordProgressOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('fitness_dashboard.record_measurements', '+ Record')}</span>
                  </button>
                </div>

                {/* Weight Numbers Strip */}
                <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C] text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {t('fitness_dashboard.starting_weight', 'Starting')}
                    </span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                      {startWeightDisplay} kg
                    </span>
                  </div>

                  <div className="border-x border-slate-200 dark:border-[#2C2C2C]">
                    <span className="text-[10px] uppercase font-bold text-[#D92332] dark:text-[#F02D3A] block">
                      {t('fitness_dashboard.current_weight', 'Current')}
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                      {currentWeightDisplay} kg
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-500 block">
                      {t('fitness_dashboard.target_weight', 'Target Goal')}
                    </span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5 block">
                      {targetWeightDisplay} kg
                    </span>
                  </div>
                </div>

                {/* Progress bar towards goal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Goal Completion</span>
                    <span className="font-mono font-bold text-emerald-500">{goalProgressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-[#252525] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, goalProgressPercent))}%` }}
                    />
                  </div>
                </div>

                {weightChange !== null && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#1C1C1C] flex items-center justify-between text-xs">
                    <span className="text-slate-500">Weight Delta since inception:</span>
                    <span
                      className={`font-black font-mono ${
                        weightChange < 0 ? 'text-emerald-500' : 'text-blue-500'
                      }`}
                    >
                      {weightChange < 0 ? `${weightChange} kg (Lost)` : `+${weightChange} kg`}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setActiveTab('progress')}
                className="w-full py-2 rounded-xl bg-slate-200 dark:bg-[#222] hover:bg-slate-300 dark:hover:bg-[#2C2C2C] text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-center"
              >
                View Full Measurement History →
              </button>
            </div>

            {/* SECTION D: ATTENDANCE & CONSISTENCY */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        {t('fitness_dashboard.monthly_attendance', 'Monthly Attendance')}
                      </span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Consistency Calendar</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-500 font-black text-xs flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{attendance?.streak_days || 0}d Streak</span>
                    </div>
                  </div>
                </div>

                {/* Monthly Consistency Calendar Grid */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C]">
                  {renderAttendanceCalendar()}
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1C1C1C]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">
                      {t('fitness_dashboard.visits_month', 'Visits This Month')}
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                      {attendance?.total_visits_this_month || 0} Visits
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1C1C1C]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">
                      {t('fitness_dashboard.last_checkin', 'Last Check-in')}
                    </span>
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                      {attendance?.last_check_in || 'No Check-in Yet'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('attendance')}
                className="w-full py-2 rounded-xl bg-slate-200 dark:bg-[#222] hover:bg-slate-300 dark:hover:bg-[#2C2C2C] text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-center"
              >
                View Full Attendance Log →
              </button>
            </div>
          </div>

          {/* SECTION E: MY PERSONAL TRAINER CARD */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {assignedTrainer?.avatar_url ? (
                <img
                  src={assignedTrainer.avatar_url}
                  alt={assignedTrainer.name}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-red-500 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-[#D92332] dark:text-[#F02D3A] flex items-center justify-center text-xl font-black shrink-0">
                  <User className="w-7 h-7" />
                </div>
              )}

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {t('fitness_dashboard.my_trainer', 'My Personal Trainer')}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {assignedTrainer?.name || 'Assigned Floor Coach'}
                </h3>
                <p className="text-xs text-slate-500">
                  {assignedTrainer?.specialization || 'Strength & Conditioning Specialist'} • Managing your routines
                </p>
              </div>
            </div>

            {/* Direct Trainer Communication Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {assignedTrainer?.whatsapp_url ? (
                <a
                  href={assignedTrainer.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t('fitness_dashboard.chat_whatsapp', 'WhatsApp Chat')}</span>
                </a>
              ) : null}

              {assignedTrainer?.call_url ? (
                <a
                  href={assignedTrainer.call_url}
                  className="px-4 py-2.5 rounded-2xl bg-slate-200 dark:bg-[#252525] hover:bg-[#D92332] hover:text-white text-slate-800 dark:text-slate-200 text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4" />
                  <span>{t('fitness_dashboard.call_trainer', 'Call Trainer')}</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">Contact via Gym Desk</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: WEEKLY DIET & NUTRITION FULL VIEW                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'diet' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Assigned Nutrition & Meal Plan
              </h2>
              <p className="text-xs text-slate-400">
                Crafted by your certified trainer to match your fitness goals
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
              {todayDiet?.dietary_preference?.replace('_', ' ') || 'High Protein'}
            </span>
          </div>

          {/* Full Macros strip */}
          {todayDiet && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Daily Energy</span>
                <span className="text-2xl font-black text-amber-500 font-mono mt-1 block">
                  {todayDiet.target_calories}{' '}
                  <span className="text-xs font-normal text-slate-400">kcal</span>
                </span>
              </div>
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Protein Target</span>
                <span className="text-2xl font-black text-emerald-500 font-mono mt-1 block">
                  {todayDiet.target_protein_g}{' '}
                  <span className="text-xs font-normal text-slate-400">g</span>
                </span>
              </div>
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Carbohydrates</span>
                <span className="text-2xl font-black text-blue-500 font-mono mt-1 block">
                  {todayDiet.target_carbs_g}{' '}
                  <span className="text-xs font-normal text-slate-400">g</span>
                </span>
              </div>
              <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Healthy Fats</span>
                <span className="text-2xl font-black text-rose-500 font-mono mt-1 block">
                  {todayDiet.target_fat_g}{' '}
                  <span className="text-xs font-normal text-slate-400">g</span>
                </span>
              </div>
            </div>
          )}

          {/* Structured Meal Slots */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Assigned Daily Meal Schedule
            </h3>

            {(!todayDiet?.meals || todayDiet.meals.length === 0) ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                No active diet plan assigned yet. Ask your trainer to generate a meal routine for your goal.
              </p>
            ) : (
              <div className="space-y-4">
                {todayDiet.meals.map((slot, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C] space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#222] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 font-black text-xs">
                          {sIdx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {slot.slot_title}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Scheduled at: {slot.time}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleMeal(slot.slot, slot.is_completed)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          slot.is_completed
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-100 dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                        }`}
                      >
                        {slot.is_completed ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{slot.is_completed ? 'Marked Eaten' : 'Tap to Mark Eaten'}</span>
                      </button>
                    </div>

                    {/* Meal items breakdown */}
                    <div className="space-y-2">
                      {slot.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-[#181818]"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{item.food_name}</span>
                            <span className="text-slate-400 ml-2">({item.quantity})</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-amber-500 font-bold">{item.calories} kcal</span>
                            <span className="text-emerald-500">P: {item.protein}g</span>
                            <span className="text-blue-500">C: {item.carbs}g</span>
                            <span className="text-rose-500">F: {item.fat}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: DETAILED PROGRESS & MEASUREMENTS HISTORY            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Body Progress & Measurements</h2>
              <p className="text-xs text-slate-400">Track weight trends, body fat %, and tape measurements over time</p>
            </div>

            <button
              onClick={() => setRecordProgressOpen(true)}
              className="px-4 py-2 rounded-2xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-red-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record New Measurements</span>
            </button>
          </div>

          {/* Highlights Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Weight</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block font-mono">
                {latestLog?.weight_kg || currentWeightDisplay || '—'}{' '}
                <span className="text-xs font-normal text-slate-400">kg</span>
              </span>
              {weightChange && (
                <span
                  className={`text-[10px] font-bold block mt-0.5 ${
                    weightChange < 0 ? 'text-emerald-500' : 'text-blue-500'
                  }`}
                >
                  {weightChange < 0 ? `${weightChange} kg lost` : `+${weightChange} kg gained`}
                </span>
              )}
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Body Fat %</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block font-mono">
                {latestLog?.body_fat_percent || '—'}{' '}
                <span className="text-xs font-normal text-slate-400">%</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Calibrated scan</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Chest & Waist</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-2 block font-mono">
                {latestLog?.chest_cm ? `${latestLog.chest_cm}cm` : '—'} /{' '}
                {latestLog?.waist_cm ? `${latestLog.waist_cm}cm` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Circumference</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Arms (Biceps)</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block font-mono">
                {latestLog?.arms_cm ? `${latestLog.arms_cm} cm` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Flexed</span>
            </div>
          </div>

          {/* Progress Logs Table */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Historical Check-In Records ({progressLogs.length})
            </h3>

            {progressLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No measurements logged yet. Tap "+ Record New Measurements" above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Weight</th>
                      <th className="py-2.5 px-3">Body Fat</th>
                      <th className="py-2.5 px-3">Chest</th>
                      <th className="py-2.5 px-3">Waist</th>
                      <th className="py-2.5 px-3">Arms</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2C2C2C]">
                    {progressLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-100/50 dark:hover:bg-[#252525]/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{log.log_date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {log.weight_kg ? `${log.weight_kg} kg` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{log.body_fat_percent ? `${log.body_fat_percent}%` : '—'}</td>
                        <td className="py-2.5 px-3 font-mono">{log.chest_cm ? `${log.chest_cm} cm` : '—'}</td>
                        <td className="py-2.5 px-3 font-mono">{log.waist_cm ? `${log.waist_cm} cm` : '—'}</td>
                        <td className="py-2.5 px-3 font-mono">{log.arms_cm ? `${log.arms_cm} cm` : '—'}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-xs">{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB 4: ATTENDANCE HISTORY & CONSISTENCY                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Attendance Log & Consistency</h2>
              <p className="text-xs text-slate-400">Turnstile scans and check-in timeline records</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>{attendance?.streak_days || 0} Days Consecutive</span>
              </span>
            </div>
          </div>

          {/* Calendar Display */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Monthly Consistency Calendar
            </h3>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C]">
              {renderAttendanceCalendar()}
            </div>
          </div>

          {/* Recent Logs Table */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Recent Check-Ins ({attendance?.recent_logs?.length || 0})
            </h3>

            {(!attendance?.recent_logs || attendance.recent_logs.length === 0) ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No attendance check-in records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Facility Branch</th>
                      <th className="py-2.5 px-3">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2C2C2C]">
                    {attendance.recent_logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-100/50 dark:hover:bg-[#252525]/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {log.check_in_at}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {log.branch_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Verified Entry
                          </span>
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

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB 5: DIGITAL GYM PASS & ID                               */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'pass' && (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-red-950 border border-slate-700/80 p-6 md:p-8 shadow-2xl text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {user?.gym?.name || 'IRONCORE FITNESS'}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      !isExpired ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {!isExpired ? 'Active Member' : 'Expired'}
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                    {profile?.first_name} {profile?.last_name}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: {profile?.member_code} • Branch: {profile?.branch?.name || 'Main Club'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Active Plan</span>
                    <span className="font-bold text-white text-sm">
                      {profile?.active_membership?.plan?.name || 'No Active Plan'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Valid Until</span>
                    <span className="font-bold text-emerald-400 text-sm font-mono">
                      {profile?.active_membership?.end_date
                        ? formatDate(profile.active_membership.end_date, i18n.language)
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {assignedTrainer && (
                  <div className="text-xs text-slate-300 flex items-center gap-1.5 pt-1">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Coach: <strong>{assignedTrainer.name}</strong></span>
                  </div>
                )}
              </div>

              {/* QR Code Pass for Turnstile */}
              <div className="flex flex-col items-center gap-2 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 self-start md:self-auto">
                <div
                  onClick={() => setQrModalOpen(true)}
                  className="bg-white p-2.5 rounded-xl cursor-pointer hover:scale-105 transition-transform"
                >
                  <QRCodeSVG
                    value={memberPassQrData}
                    size={110}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">TAP TO ENLARGE PASS</span>
              </div>
            </div>

            {/* Action Button inside Card */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-slate-400">
                {profile?.outstanding_balance && profile.outstanding_balance > 0 ? (
                  <span className="text-rose-400 font-semibold">
                    Outstanding Balance: ₹{profile.outstanding_balance}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dues Cleared
                  </span>
                )}
              </div>

              <button
                onClick={() => setRenewalModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-950/40 cursor-pointer"
              >
                Request Membership Renewal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. TAB 6: INVOICES, BILLING & UDHAR                           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {onlinePaySuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold">{onlinePaySuccess}</span>
              </div>
              <button onClick={() => setOnlinePaySuccess(null)} className="text-emerald-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Outstanding Balance Hero Card */}
          {portalBalance > 0 ? (
            <div className="p-6 rounded-3xl bg-linear-to-r from-red-600 via-rose-600 to-orange-600 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs">
                    Pending Balance / बाकी रक्कम
                  </span>
                  <span className="text-xs text-red-100 font-medium">Action Required</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                  ₹{Number(portalBalance).toLocaleString('en-IN')}
                </h2>
                <p className="text-xs text-red-100 max-w-md">
                  You have an outstanding membership balance. Clear your dues easily online via UPI, Credit/Debit Cards, or NetBanking.
                </p>
              </div>

              {invoices.find((inv) => Number(inv.balance_due) > 0) && (
                <button
                  onClick={() => {
                    const firstDue = invoices.find((inv) => Number(inv.balance_due) > 0);
                    if (firstDue) handlePayInvoiceOnline(firstDue);
                  }}
                  disabled={payOnlineLoading}
                  className="px-6 py-3.5 bg-white text-red-600 hover:bg-red-50 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shrink-0"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{payOnlineLoading ? 'Opening Payment Gateway...' : `Pay Dues (₹${Number(portalBalance).toLocaleString('en-IN')})`}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">All Dues Cleared (सर्व बाकी पूर्ण भरलेली आहे)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Your membership fee is completely up to date. Thank you for your commitment!</p>
                </div>
              </div>
              <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                ₹0.00 Outstanding
              </span>
            </div>
          )}

          {/* Invoices List */}
          <div className="bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2C2C2C]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span>Membership Invoices & Bills</span>
                </h3>
                <p className="text-[11px] text-slate-400">Itemized billing statements, discounts and remaining balances</p>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No formal invoices generated yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#2C2C2C]">
                    <tr>
                      <th className="py-2.5 px-3">Invoice No</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Plan / Description</th>
                      <th className="py-2.5 px-3">Total Amount</th>
                      <th className="py-2.5 px-3">Paid Amount</th>
                      <th className="py-2.5 px-3">Balance Due</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#2C2C2C] text-slate-700 dark:text-slate-300">
                    {invoices.map((inv) => {
                      const st = inv.effective_status || inv.status;
                      const hasDue = Number(inv.balance_due) > 0;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-100/50 dark:hover:bg-[#252525]/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{inv.invoice_date}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {inv.membership?.plan?.name || 'Gym Membership'}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            ₹{Number(inv.final_amount).toLocaleString('en-IN')}
                            {Number(inv.discount_amount) > 0 && (
                              <span className="block text-[10px] text-emerald-500">
                                -₹{Number(inv.discount_amount).toLocaleString('en-IN')} off
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            ₹{Number(inv.paid_amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={hasDue ? 'text-red-500 font-bold' : 'text-slate-400'}>
                              ₹{Number(inv.balance_due).toLocaleString('en-IN')}
                            </span>
                            {hasDue && inv.due_date && (
                              <span className="block text-[10px] text-slate-400">Due: {inv.due_date}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                st === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : st === 'overdue'
                                  ? 'bg-red-500/15 text-red-500 border-red-500/30'
                                  : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                              }`}
                            >
                              {st === 'overdue' ? 'Overdue (थकीत)' : st === 'partially_paid' ? 'Partial (अंशतः बाकी)' : 'Paid (पूर्ण)'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                            {hasDue && (
                              <button
                                onClick={() => handlePayInvoiceOnline(inv)}
                                disabled={payOnlineLoading && payingInvoiceId === inv.id}
                                className="px-2.5 py-1 rounded-lg bg-[#D92332] hover:bg-[#B91C2B] text-white font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                {payOnlineLoading && payingInvoiceId === inv.id ? 'Loading...' : `Pay ₹${Number(inv.balance_due).toLocaleString('en-IN')}`}
                              </button>
                            )}
                            <button
                              onClick={() => setReceiptModalInvoice(inv)}
                              className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              View Bill
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: WORKOUT EXECUTION STEPPER WITH REST TIMER            */}
      {/* ------------------------------------------------------------- */}
      {workoutTrackerOpen && todayWorkout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2C2C2C] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2C2C2C] pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-[#D92332] tracking-wider">
                  Live Workout Execution
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {todayWorkout.day_name}
                </h3>
              </div>
              <button
                onClick={() => setWorkoutTrackerOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rest Countdown Timer Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#2C2C2C] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    restTimerActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-[#252525] text-slate-400'
                  }`}
                >
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Rest Countdown</span>
                  <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    {Math.floor(restTimerSeconds / 60)}:
                    {String(restTimerSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRestTimerActive(!restTimerActive)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-slate-300 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {restTimerActive ? 'Pause' : 'Start Timer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRestTimerSeconds(restTimerInitial);
                    setRestTimerActive(false);
                  }}
                  className="p-1.5 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-slate-300 text-slate-500 cursor-pointer"
                  title="Reset 60s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Set Recording Form */}
            <form onSubmit={handleLogSet} className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#D92332] dark:text-[#F02D3A] tracking-wider block">
                  Log Active Set Performance
                </span>
                <span className="text-[10px] text-slate-400">Pre-filled with trainer targets</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Select Exercise
                  </label>
                  <select
                    value={activeExerciseName}
                    onChange={(e) => {
                      setActiveExerciseName(e.target.value);
                      const idx = todayWorkout.exercises.findIndex((x) => x.name === e.target.value);
                      if (idx >= 0) {
                        setActiveExerciseIndex(idx);
                        setActualWeight(todayWorkout.exercises[idx].target_weight_kg || 40);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#2C2C2C] text-xs font-bold"
                  >
                    {todayWorkout.exercises.map((item, i) => (
                      <option key={i} value={item.name}>
                        {i + 1}. {item.name} ({item.sets} sets)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Set Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={activeSetNum}
                    onChange={(e) => setActiveSetNum(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#2C2C2C] text-xs font-bold text-center font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Reps Logged
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={actualReps}
                    onChange={(e) => setActualReps(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#2C2C2C] text-xs font-bold text-center font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#2C2C2C] text-xs font-bold text-center font-mono"
                  />
                </div>

                <div className="col-span-2 sm:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={loggingSet}
                    className="w-full py-2.5 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loggingSet ? 'Saving Set...' : '✓ Record Set (Rest Timer Starts)'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Prescribed Exercises Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Full Prescribed Routine
              </h4>
              <div className="space-y-2">
                {todayWorkout.exercises.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                      item.name === activeExerciseName
                        ? 'bg-red-500/5 border-red-500/40 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-[#181818] border-slate-200 dark:border-[#2C2C2C]'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                      {item.notes && <span className="text-[10px] text-slate-400 italic">"{item.notes}"</span>}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#D92332] dark:text-[#F02D3A]">
                        {item.sets} Sets × {item.reps}
                      </span>
                      {item.target_weight_kg && item.target_weight_kg > 0 && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {item.target_weight_kg} kg • Rest {item.rest_seconds || 60}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Finish Workout Section */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#2C2C2C] space-y-4">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 block">
                Finish & Rate Today's Session
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Session Rating (1 to 5 Stars)</label>
                  <div className="flex items-center gap-1.5 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSessionRating(star)}
                        className={`p-1.5 rounded-xl cursor-pointer ${
                          sessionRating >= star ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        <Star className="w-5 h-5 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={sessionFeedback}
                  onChange={(e) => setSessionFeedback(e.target.value)}
                  placeholder="Notes for coach (e.g. Felt great on bench, shouldered slightly tight)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#2C2C2C] text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleCompleteWorkout}
                disabled={completingWorkout}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 cursor-pointer flex items-center justify-center gap-2 transition-all transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{completingWorkout ? 'Completing...' : 'Mark Workout Complete Today!'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: SELF RECORD MEASUREMENTS MODAL                       */}
      {/* ------------------------------------------------------------- */}
      {recordProgressOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#2C2C2C] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2C2C2C]">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Record Body Measurements</h3>
              </div>
              <button
                onClick={() => setRecordProgressOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProgress} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={progWeight}
                    onChange={(e) => setProgWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 15.5"
                    value={progFat}
                    onChange={(e) => setProgFat(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Chest (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 102"
                    value={progChest}
                    onChange={(e) => setProgChest(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 82"
                    value={progWaist}
                    onChange={(e) => setProgWaist(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Hips (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 96"
                    value={progHips}
                    onChange={(e) => setProgHips(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Arms (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 38"
                    value={progArms}
                    onChange={(e) => setProgArms(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Personal Notes</label>
                <textarea
                  rows={2}
                  value={progNotes}
                  onChange={(e) => setProgNotes(e.target.value)}
                  placeholder="e.g. Morning weighed fasted after water."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1A1A] border border-slate-300 dark:border-[#2C2C2C] text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordProgressOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-[#202020] text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProgress}
                  className="px-5 py-2 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {savingProgress ? 'Saving...' : 'Save Progress Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: EXERCISE VIDEO TUTORIAL & FORM GUIDE                 */}
      {/* ------------------------------------------------------------- */}
      {activeExerciseVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#252525] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {activeExerciseVideo.name}
                  </h3>
                  {activeExerciseVideo.video_source === 'gym_custom' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#D92332] text-white">
                      Gym Video
                    </span>
                  ) : activeExerciseVideo.has_playable_video ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-200 border border-slate-700">
                      Platform Tutorial
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      Instructions
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified exercise demonstration & form guidance
                </p>
              </div>
              <button
                onClick={() => setActiveExerciseVideo(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            {activeExerciseVideo.has_playable_video && activeExerciseVideo.video_url ? (
              <div className="relative aspect-video bg-black">
                <iframe
                  src={activeExerciseVideo.video_url}
                  title={activeExerciseVideo.name}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-8 bg-slate-50 dark:bg-[#181818] text-center space-y-2">
                <Dumbbell className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Technique Guidance
                </h4>
                <p className="text-xs text-slate-500">
                  Follow prescribed repetitions with controlled form and full range of motion.
                </p>
              </div>
            )}

            {/* Steps & Safety Notes */}
            <div className="p-5 space-y-3 max-h-60 overflow-y-auto text-xs">
              {activeExerciseVideo.instructions && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] mb-1">
                    Correct Execution Form
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {activeExerciseVideo.instructions}
                  </p>
                </div>
              )}

              {activeExerciseVideo.safety_notes && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Safety Tip</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {activeExerciseVideo.safety_notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#151515] border-t border-slate-200 dark:border-[#252525] flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {activeExerciseVideo.video_source === 'gym_custom'
                  ? 'Exclusively curated by your gym trainers'
                  : 'Platform verified tutorial video'}
              </span>
              <button
                onClick={() => setActiveExerciseVideo(null)}
                className="px-5 py-2 rounded-xl bg-[#D92332] text-white text-xs font-bold hover:bg-[#B91C2B] transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: ENLARGED QR DIGITAL PASS                             */}
      {/* ------------------------------------------------------------- */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C] rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex justify-end">
              <button
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Scan at Gym Entrance</h3>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
              <QRCodeSVG
                value={memberPassQrData}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="font-mono text-sm text-[#D92332] font-bold">{profile?.member_code}</p>
            <p className="text-xs text-slate-400">Hold near the turnstile scanner for automatic entry log.</p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: RENEWAL REQUEST                                      */}
      {/* ------------------------------------------------------------- */}
      {renewalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#2C2C2C] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2C2C2C]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Request Membership Renewal</h3>
              <button
                onClick={() => setRenewalModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Select Preferred Package</label>
                <select
                  value={renewalPlanId}
                  onChange={(e) => setRenewalPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#2C2C2C] rounded-xl text-xs"
                >
                  <option value="">Keep Same Package / Unspecified</option>
                  {plans.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} (₹{pl.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes / Preferences for Reception</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Please send payment link for UPI."
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#2C2C2C] rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-[#202020] text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRenewal}
                  className="px-4 py-2 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submittingRenewal ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: INVOICE & RECEIPT MODAL                              */}
      {/* ------------------------------------------------------------- */}
      {receiptModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#282828] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-[#252525]">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D92332]">Official Receipt</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {receiptModalInvoice.invoice_number}
                </h3>
                <p className="text-xs text-slate-400">Date: {receiptModalInvoice.invoice_date}</p>
              </div>
              <button
                onClick={() => setReceiptModalInvoice(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#202020]">
                <span className="text-slate-400">Membership Item:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {receiptModalInvoice.membership?.plan?.name || 'Gym Membership'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#202020]">
                <span className="text-slate-400">Original Fee:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  ₹{Number(receiptModalInvoice.original_amount).toLocaleString('en-IN')}
                </span>
              </div>
              {Number(receiptModalInvoice.discount_amount) > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#202020] text-emerald-500">
                  <span>Discount Applied:</span>
                  <span className="font-mono font-bold">
                    -₹{Number(receiptModalInvoice.discount_amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#202020] font-bold">
                <span className="text-slate-900 dark:text-white">Final Net Payable:</span>
                <span className="font-mono text-slate-900 dark:text-white text-sm">
                  ₹{Number(receiptModalInvoice.final_amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#202020] text-emerald-600 dark:text-emerald-400">
                <span className="font-bold">Total Paid to Date:</span>
                <span className="font-mono font-bold">
                  ₹{Number(receiptModalInvoice.paid_amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-2 bg-red-500/10 px-3 rounded-xl">
                <span className="font-bold text-[#D92332]">Remaining Balance (Udhar):</span>
                <span className="font-mono font-bold text-[#D92332] text-sm">
                  ₹{Number(receiptModalInvoice.balance_due).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Installments History */}
            {receiptModalInvoice.allocations && receiptModalInvoice.allocations.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payment Installments</span>
                <div className="space-y-1.5">
                  {receiptModalInvoice.allocations.map((alloc) => (
                    <div
                      key={alloc.id}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-[#1a1a1a]"
                    >
                      <div>
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                          {alloc.payment?.receipt_number || 'RECEIPT'}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-2 uppercase">
                          ({alloc.payment?.payment_method || 'Cash'})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-500">
                        ₹{Number(alloc.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={() => setReceiptModalInvoice(null)}
                className="px-5 py-2 rounded-xl bg-[#D92332] text-white text-xs font-bold hover:bg-[#B91C2B] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
