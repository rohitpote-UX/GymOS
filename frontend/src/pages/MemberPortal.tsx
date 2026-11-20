import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  Apple,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Dumbbell,
  Flame,
  PlayCircle,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Salad,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  User,
  Utensils,
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

interface TodayWorkoutData {
  plan_id: number;
  plan_title: string;
  goal: string;
  difficulty: string;
  day_name: string;
  is_rest_day: boolean;
  exercises: Array<{
    exercise_id?: number;
    name: string;
    sets: number;
    reps: string;
    target_weight_kg?: number;
    rest_seconds?: number;
    notes?: string;
  }>;
  coach_notes?: string;
  status: string;
  session?: {
    id: number;
    status: string;
    duration_minutes?: number;
    rating?: number;
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
  const { t } = useTranslation();
  const { user } = useAuth();

  // Active Top Tab
  const [activeTab, setActiveTab] = useState<'pass' | 'fitness_today' | 'progress' | 'payments'>('pass');

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkoutData | null>(null);
  const [todayDiet, setTodayDiet] = useState<TodayDietData | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Workout Session Modal
  const [workoutTrackerOpen, setWorkoutTrackerOpen] = useState(false);
  const [loggingSet, setLoggingSet] = useState(false);
  const [completingWorkout, setCompletingWorkout] = useState(false);
  const [sessionRating, setSessionRating] = useState<number>(5);
  const [sessionDuration, setSessionDuration] = useState<number>(45);
  const [sessionFeedback, setSessionFeedback] = useState('');

  // Set logger state
  const [activeExerciseName, setActiveExerciseName] = useState('');
  const [activeSetNum, setActiveSetNum] = useState(1);
  const [actualReps, setActualReps] = useState(10);
  const [actualWeight, setActualWeight] = useState(50);

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
  const [renewalSuccess, setRenewalSuccess] = useState<string | null>(null);

  // Enlarged QR Pass Modal
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, attRes, payRes, fitnessRes, progRes] = await Promise.all([
        api.get('/member-portal/profile'),
        api.get('/member-portal/attendance').catch(() => ({ data: { streak_days: 0, total_visits_this_month: 0, recent_logs: [] } })),
        api.get('/member-portal/payments').catch(() => ({ data: { payments: [] } })),
        api.get('/member-portal/fitness-today').catch(() => ({ data: { today_workout: null, today_diet: null } })),
        api.get('/member-portal/my-progress').catch(() => ({ data: { progress_logs: [] } })),
      ]);

      setProfile(profileRes.data.member || profileRes.data);
      setAttendance(attRes.data);
      setPayments(payRes.data.payments || []);
      setTodayWorkout(fitnessRes.data.today_workout || null);
      setTodayDiet(fitnessRes.data.today_diet || null);
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
        exercise_name: activeExerciseName || todayWorkout.exercises[0]?.name || 'Exercise',
        set_number: activeSetNum,
        reps: Number(actualReps),
        weight_kg: Number(actualWeight),
      });

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
      setRenewalSuccess('Awesome work! Workout marked as completed for today! 💪🔥');
      setTimeout(() => setRenewalSuccess(null), 5000);
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
      setRenewalSuccess('Measurements saved! Your progress graph has been updated.');
      setTimeout(() => setRenewalSuccess(null), 5000);
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
      setRenewalSuccess('Renewal request submitted! Reception desk has been notified.');
      setTimeout(() => setRenewalSuccess(null), 5000);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmittingRenewal(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading member portal...</p>
        </div>
      </div>
    );
  }

  const isExpired = profile?.active_membership
    ? new Date(profile.active_membership.end_date) < new Date()
    : true;

  const latestLog = progressLogs[0];
  const initialLog = progressLogs[progressLogs.length - 1];
  const weightChange =
    latestLog && initialLog && latestLog.weight_kg && initialLog.weight_kg
      ? (latestLog.weight_kg - initialLog.weight_kg).toFixed(1)
      : null;

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#303030]">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{t('portal.title', 'Member Digital Portal')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            {t('portal.subtitle', 'Daily fitness plans, digital pass, and body progress tracking')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="dropdown" />
          <button
            onClick={fetchPortalData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 border border-slate-300 dark:border-[#303030] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {renewalSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{renewalSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* MOBILE-FIRST TAB NAVIGATION */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-[#303030] no-scrollbar">
        <button
          onClick={() => setActiveTab('fitness_today')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
            activeTab === 'fitness_today'
              ? 'bg-[#D92332] text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-[#1C1C1C] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Today's Workout & Diet</span>
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
          <span>My Progress & Logs</span>
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
          <span>Gym Pass & ID</span>
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
          <span>Invoices & Dues</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: TODAY'S WORKOUT & DIET (DAILY ACTION CENTER)           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'fitness_today' && (
        <div className="space-y-6">
          {/* Greeting & Consistency Strip */}
          <div className="p-5 rounded-3xl bg-linear-to-r from-red-600 via-rose-600 to-orange-500 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                Daily Fitness Radar
              </span>
              <h2 className="text-xl md:text-2xl font-black mt-1">
                Ready for today, {profile?.first_name}?
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                Check in your workout sets and mark meals completed as you go.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-center">
                <span className="text-[10px] font-bold uppercase text-white/70 block">Streak</span>
                <span className="text-xl font-black flex items-center justify-center gap-1">
                  <Flame className="w-5 h-5 text-amber-300" />
                  <span>{attendance?.streak_days || 1} Days</span>
                </span>
              </div>
            </div>
          </div>

          {/* TODAY'S WORKOUT CARD */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-500/10 text-[#D92332] dark:text-[#F02D3A]">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Today's Training Program
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {todayWorkout?.day_name || 'Rest & Recovery Day'}
                  </h3>
                  <span className="text-xs text-slate-500 capitalize">
                    {todayWorkout?.plan_title || 'General Fitness'} • {todayWorkout?.difficulty || 'Intermediate'}
                  </span>
                </div>
              </div>

              {todayWorkout?.is_rest_day ? (
                <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-[#252525] text-slate-600 dark:text-slate-300 text-xs font-bold">
                  Rest Day 💤
                </span>
              ) : todayWorkout?.session?.status === 'completed' ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed Today! ★ {todayWorkout.session.rating || 5}/5</span>
                </span>
              ) : (
                <button
                  onClick={() => {
                    if (todayWorkout?.exercises && todayWorkout.exercises.length > 0) {
                      setActiveExerciseName(todayWorkout.exercises[0].name);
                      setActualReps(10);
                      setActualWeight(todayWorkout.exercises[0].target_weight_kg || 40);
                    }
                    setWorkoutTrackerOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-lg shadow-red-500/25 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Start Workout</span>
                </button>
              )}
            </div>

            {/* Exercise List for Today */}
            {!todayWorkout?.is_rest_day && todayWorkout?.exercises && (
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Today's Prescribed Exercises ({todayWorkout.exercises.length})
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {todayWorkout.exercises.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {idx + 1}. {item.name}
                        </span>
                        {item.notes && <span className="text-[10px] text-slate-400 italic">"{item.notes}"</span>}
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-[#D92332] dark:text-[#F02D3A] block">
                          {item.sets} Sets × {item.reps}
                        </span>
                        {item.target_weight_kg && item.target_weight_kg > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Target: {item.target_weight_kg} kg
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TODAY'S DIET & NUTRITION CARD */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Today's Nutrition Plan
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {todayDiet?.title || 'Balanced Daily Diet'}
                  </h3>
                  <span className="text-xs text-slate-500 capitalize">
                    {todayDiet?.dietary_preference?.replace('_', ' ') || 'Nutritious'} • Goal:{' '}
                    {todayDiet?.goal?.replace('_', ' ') || 'Fitness'}
                  </span>
                </div>
              </div>

              {todayDiet && (
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                    {todayDiet.completed_meals_count} of {todayDiet.total_meals_count} Meals Done
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {todayDiet.completion_percent}% Complete Today
                  </span>
                </div>
              )}
            </div>

            {/* Macro Summary Strip */}
            {todayDiet && (
              <div className="grid grid-cols-4 gap-2 text-center pt-1">
                <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Calories</span>
                  <span className="text-xs font-black text-amber-500 font-mono mt-0.5 block">
                    {todayDiet.target_calories} kcal
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Protein</span>
                  <span className="text-xs font-black text-emerald-500 font-mono mt-0.5 block">
                    {todayDiet.target_protein_g}g
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Carbs</span>
                  <span className="text-xs font-black text-blue-500 font-mono mt-0.5 block">
                    {todayDiet.target_carbs_g}g
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Fats</span>
                  <span className="text-xs font-black text-rose-500 font-mono mt-0.5 block">
                    {todayDiet.target_fat_g}g
                  </span>
                </div>
              </div>
            )}

            {/* Interactive Meal Slots Checklist */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Today's Meal Checklist (Tap to mark eaten)
              </span>

              {(!todayDiet?.meals || todayDiet.meals.length === 0) ? (
                <p className="text-xs text-slate-400 italic">No structured meal slots assigned for today.</p>
              ) : (
                todayDiet.meals.map((slot, sIdx) => (
                  <div
                    key={sIdx}
                    onClick={() => handleToggleMeal(slot.slot, slot.is_completed)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      slot.is_completed
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-900 dark:text-white'
                        : 'bg-white dark:bg-[#101010] border-slate-200 dark:border-[#303030] hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          slot.is_completed
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'border-2 border-slate-400 text-transparent'
                        }`}
                      >
                        ✓
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-xs font-black ${
                              slot.is_completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {slot.slot_title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">({slot.time})</span>
                        </div>

                        {/* Food items preview */}
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {slot.items.map((it, i) => (
                            <span
                              key={i}
                              className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1C1C1C] px-2 py-0.5 rounded-md font-medium"
                            >
                              {it.food_name} • {it.quantity} ({it.calories} cals)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          slot.is_completed
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-200 dark:bg-[#252525] text-slate-500'
                        }`}
                      >
                        {slot.is_completed ? 'Eaten' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MY PROGRESS & MEASUREMENTS TRACKER                     */}
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
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Weight</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block font-mono">
                {latestLog?.weight_kg || '—'}{' '}
                <span className="text-xs font-normal text-slate-400">kg</span>
              </span>
              {weightChange && (
                <span className="text-[10px] font-bold text-emerald-500 block mt-0.5">
                  {Number(weightChange) > 0 ? `+${weightChange} kg gained` : `${weightChange} kg lost`}
                </span>
              )}
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Body Fat %</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block font-mono">
                {latestLog?.body_fat_percent || '—'}{' '}
                <span className="text-xs font-normal text-slate-400">%</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Calibrated scan</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Chest & Waist</span>
              <span className="text-base font-black text-slate-900 dark:text-white mt-2 block font-mono">
                {latestLog?.chest_cm ? `${latestLog.chest_cm}cm` : '—'} /{' '}
                {latestLog?.waist_cm ? `${latestLog.waist_cm}cm` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Circumference</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Arms (Biceps)</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block font-mono">
                {latestLog?.arms_cm ? `${latestLog.arms_cm} cm` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Flexed</span>
            </div>
          </div>

          {/* Progress Logs Table */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-4">
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
                  <tbody className="divide-y divide-slate-200 dark:divide-[#303030]">
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
      {/* TAB 3: DIGITAL MEMBERSHIP PASS & ATTENDANCE                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'pass' && (
        <div className="space-y-6">
          {/* Digital Membership Pass Card (Front) */}
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-red-950 border border-slate-700/80 p-6 md:p-8 shadow-2xl text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    {user?.gym?.name || 'GYM BUSINESS OS'}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      !isExpired ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
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
                      {profile?.active_membership?.end_date || 'N/A'}
                    </span>
                  </div>
                </div>

                {profile?.assigned_trainer && (
                  <div className="text-xs text-slate-300 flex items-center gap-1.5 pt-1">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Coach: <strong>{profile.assigned_trainer.name}</strong></span>
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
                    value={profile?.member_code || 'GYM-MEMBER'}
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

          {/* Attendance & Streak Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Workout Streak</span>
                <Flame className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {attendance?.streak_days || 0} <span className="text-xs text-slate-400 font-normal">Days</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Consistency score</span>
            </div>

            <div className="bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Month Check-ins</span>
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {attendance?.total_visits_this_month || 0} <span className="text-xs text-slate-400 font-normal">Visits</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">This calendar month</span>
            </div>

            <div className="bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-sky-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Assigned Coach</span>
                <Dumbbell className="w-4 h-4" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-2 truncate">
                {profile?.assigned_trainer?.name || 'Floor Trainer'}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {profile?.assigned_trainer?.specialization || 'Personal Trainer'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-indigo-500">
                <span className="text-[10px] uppercase font-bold tracking-wider">Last Check-in</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-2 truncate">
                {attendance?.last_check_in || 'No check-in yet'}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Turnstile verified</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: INVOICES & PAYMENTS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'payments' && (
        <div className="bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#303030]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <span>Payment History & Invoices</span>
              </h3>
              <p className="text-[11px] text-slate-400">All registered membership and supplement transactions</p>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">No payment records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-[#303030]">
                  <tr>
                    <th className="py-2.5 px-3">Receipt No</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#303030] text-slate-700 dark:text-slate-300">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-100/50 dark:hover:bg-[#252525]/50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                        {p.receipt_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{p.payment_date}</td>
                      <td className="py-2.5 px-3 uppercase text-slate-400 font-mono text-[11px]">
                        {p.payment_method}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        ₹{Number(p.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 capitalize">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* INTERACTIVE WORKOUT SESSION TRACKER MODAL                     */}
      {/* ------------------------------------------------------------- */}
      {workoutTrackerOpen && todayWorkout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-red-500 tracking-wider">
                  Live Workout Tracker
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

            {/* Fast Set Logger Widget */}
            <form onSubmit={handleLogSet} className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
              <span className="text-xs font-black uppercase text-[#D92332] dark:text-[#F02D3A] tracking-wider block">
                Quick Log Current Set
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Exercise
                  </label>
                  <select
                    value={activeExerciseName}
                    onChange={(e) => setActiveExerciseName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold"
                  >
                    {todayWorkout.exercises.map((item, i) => (
                      <option key={i} value={item.name}>
                        {item.name} ({item.sets} sets)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Set #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={activeSetNum}
                    onChange={(e) => setActiveSetNum(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Reps Done
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={actualReps}
                    onChange={(e) => setActualReps(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-center"
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
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-center"
                  />
                </div>

                <div className="col-span-2 sm:col-span-3 flex items-end">
                  <button
                    type="submit"
                    disabled={loggingSet}
                    className="w-full py-2 rounded-lg bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-md cursor-pointer"
                  >
                    {loggingSet ? 'Saving...' : '✓ Record Set'}
                  </button>
                </div>
              </div>
            </form>

            {/* Prescribed Exercises Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Prescribed Routine
              </h4>
              <div className="space-y-2">
                {todayWorkout.exercises.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] flex items-center justify-between text-xs"
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
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3 pt-4">
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#303030] text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Session Rating (1 to 5 Stars)</label>
                  <div className="flex items-center gap-1 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSessionRating(star)}
                        className={`p-1.5 rounded-lg cursor-pointer ${
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
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#303030] text-xs"
                />
              </div>

              <button
                type="button"
                onClick={handleCompleteWorkout}
                disabled={completingWorkout}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{completingWorkout ? 'Completing...' : 'Mark Workout Complete Today!'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SELF-RECORD PROGRESS MODAL                                    */}
      {/* ------------------------------------------------------------- */}
      {recordProgressOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#303030]">
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-bold font-mono"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-bold font-mono"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-bold font-mono"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-bold font-mono"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-bold font-mono"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-bold font-mono"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs"
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
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  {savingProgress ? 'Saving...' : 'Save Progress Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enlarged QR Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
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
                value={profile?.member_code || 'GYM-MEMBER'}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="font-mono text-sm text-red-500 font-bold">{profile?.member_code}</p>
            <p className="text-xs text-slate-400">Hold near the turnstile scanner for automatic entry log.</p>
          </div>
        </div>
      )}

      {/* Renewal Request Modal */}
      {renewalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#303030]">
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] rounded-xl text-xs"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] rounded-xl text-xs"
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
    </div>
  );
}
