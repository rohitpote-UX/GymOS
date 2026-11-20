import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  LineChart,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters';

interface TrainerMetrics {
  assigned_members_count: number;
  completed_sessions_this_month: number;
  scheduled_sessions_today: number;
  total_pt_earnings: number;
}

interface AssignedMember {
  id: number;
  member_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  joined_date: string;
  primary_branch?: {
    id: number;
    name: string;
  };
  active_membership?: {
    id: number;
    end_date: string;
    plan?: {
      name: string;
    };
  };
}

interface PtSessionItem {
  id: number;
  member_id: number;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    member_code: string;
    phone: string;
  };
}

export default function TrainerPortal() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<TrainerMetrics | null>(null);
  const [members, setMembers] = useState<AssignedMember[]>([]);
  const [sessions, setSessions] = useState<PtSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Complete Session Modal
  const [completeModalSession, setCompleteModalSession] = useState<PtSessionItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Assign Workout Modal
  const [workoutModalMember, setWorkoutModalMember] = useState<AssignedMember | null>(null);
  const [workoutTitle, setWorkoutTitle] = useState('Hypertrophy 4-Day Split');
  const [workoutGoal, setWorkoutGoal] = useState('muscle_hypertrophy');
  const [workoutDifficulty, setWorkoutDifficulty] = useState('intermediate');
  const [daysCount, setDaysCount] = useState(4);
  const [coachNotes, setCoachNotes] = useState('');
  const [isAssigningWorkout, setIsAssigningWorkout] = useState(false);

  // Log Progress Modal
  const [progressModalMember, setProgressModalMember] = useState<AssignedMember | null>(null);
  const [weightKg, setWeightKg] = useState<string>('75.0');
  const [bodyFat, setBodyFat] = useState<string>('15.0');
  const [chestCm, setChestCm] = useState<string>('102');
  const [waistCm, setWaistCm] = useState<string>('82');
  const [armsCm, setArmsCm] = useState<string>('38');
  const [progressNotes, setProgressNotes] = useState('');
  const [isLoggingProgress, setIsLoggingProgress] = useState(false);

  // Assign Diet Modal
  const [dietModalMember, setDietModalMember] = useState<AssignedMember | null>(null);
  const [dietTitle, setDietTitle] = useState('High-Protein Balanced Nutrition');
  const [dietGoal, setDietGoal] = useState('muscle_gain');
  const [dietaryPref, setDietaryPref] = useState('vegetarian');
  const [dietCals, setDietCals] = useState<number>(2200);
  const [dietProtein, setDietProtein] = useState<number>(130);
  const [dietCarbs, setDietCarbs] = useState<number>(220);
  const [dietFat, setDietFat] = useState<number>(65);
  const [dietNotes, setDietNotes] = useState('');
  const [isAssigningDiet, setIsAssigningDiet] = useState(false);

  // Fitness Overview Data
  const [fitnessMetrics, setFitnessMetrics] = useState<{
    active_workout_plans_count?: number;
    active_diet_plans_count?: number;
    today_workout_completions?: number;
    expiring_plans_count?: number;
  } | null>(null);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchTrainerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashRes, memRes, sessRes, fitRes] = await Promise.all([
        api.get('/trainer-portal/dashboard'),
        api.get('/trainer-portal/members').catch(() => ({ data: { members: [] } })),
        api.get('/trainer-portal/sessions').catch(() => ({ data: { sessions: [] } })),
        api.get('/trainer-portal/fitness-overview').catch(() => ({ data: { metrics: null } })),
      ]);

      setMetrics(dashRes.data.metrics || null);
      setMembers(memRes.data.members || memRes.data.data || []);
      setSessions(sessRes.data.sessions || sessRes.data.data || []);
      setFitnessMetrics(fitRes.data.metrics || null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainerData();
  }, []);

  const handleCompleteSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalSession) return;

    try {
      setCompleting(true);
      await api.post(`/trainer-portal/sessions/${completeModalSession.id}/complete`, {
        notes: completionNotes,
      });
      setCompleteModalSession(null);
      setCompletionNotes('');
      setSuccessToast('PT Session logged and marked completed!');
      setTimeout(() => setSuccessToast(null), 4000);
      fetchTrainerData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setCompleting(false);
    }
  };

  const handleAssignWorkoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutModalMember) return;

    try {
      setIsAssigningWorkout(true);
      await api.post('/trainer-portal/assign-workout', {
        member_id: workoutModalMember.id,
        title: workoutTitle,
        goal: workoutGoal,
        difficulty: workoutDifficulty,
        days_per_week: Number(daysCount),
        coach_notes: coachNotes,
        exercises: [
          {
            day: 'Day 1: Chest & Triceps',
            items: [
              { name: 'Barbell Incline Press', sets: 4, reps: '8-10' },
              { name: 'Dumbbell Flat Bench', sets: 3, reps: '10-12' },
              { name: 'Cable Tricep Pushdown', sets: 3, reps: '12-15' },
            ],
          },
          {
            day: 'Day 2: Back & Biceps',
            items: [
              { name: 'Lat Pulldowns', sets: 4, reps: '10' },
              { name: 'Barbell Rows', sets: 3, reps: '8-10' },
              { name: 'Hammer Curls', sets: 3, reps: '12' },
            ],
          },
        ],
      });

      setWorkoutModalMember(null);
      setSuccessToast(`Workout plan assigned to ${workoutModalMember.first_name}!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsAssigningWorkout(false);
    }
  };

  const handleLogProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalMember) return;

    try {
      setIsLoggingProgress(true);
      await api.post('/trainer-portal/log-progress', {
        member_id: progressModalMember.id,
        weight_kg: Number(weightKg),
        body_fat_percent: Number(bodyFat),
        chest_cm: Number(chestCm),
        waist_cm: Number(waistCm),
        arms_cm: Number(armsCm),
        notes: progressNotes,
      });

      setProgressModalMember(null);
      setSuccessToast(`Physical progress recorded for ${progressModalMember.first_name}!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsLoggingProgress(false);
    }
  };

  const handleAssignDietSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dietModalMember) return;

    try {
      setIsAssigningDiet(true);
      await api.post('/trainer-portal/assign-diet', {
        member_id: dietModalMember.id,
        title: dietTitle,
        goal: dietGoal,
        dietary_preference: dietaryPref,
        target_calories: Number(dietCals),
        target_protein_g: Number(dietProtein),
        target_carbs_g: Number(dietCarbs),
        target_fat_g: Number(dietFat),
        notes: dietNotes,
        meals: [
          {
            slot_name: 'Breakfast',
            time_hint: '08:30 AM',
            items: [
              { food_name: 'Rolled Oats with Milk', quantity: '80g oats + 250ml milk', calories: 380, protein: 16, carbs: 60, fat: 7 },
            ],
          },
          {
            slot_name: 'Lunch',
            time_hint: '01:30 PM',
            items: [
              { food_name: 'Brown Rice + Paneer / Chicken', quantity: '150g rice + 150g protein', calories: 550, protein: 35, carbs: 55, fat: 18 },
            ],
          },
          {
            slot_name: 'Evening Snack',
            time_hint: '05:30 PM',
            items: [
              { food_name: 'Boiled Sprouts or Whey Shake', quantity: '1 serving', calories: 220, protein: 24, carbs: 20, fat: 3 },
            ],
          },
          {
            slot_name: 'Dinner',
            time_hint: '08:30 PM',
            items: [
              { food_name: 'Roti with Dal Tadka & Salad', quantity: '2 rotis + 1 bowl dal', calories: 420, protein: 18, carbs: 65, fat: 8 },
            ],
          },
        ],
      });

      setDietModalMember(null);
      setSuccessToast(`Diet & Nutrition plan assigned to ${dietModalMember.first_name}!`);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchTrainerData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsAssigningDiet(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Dumbbell className="w-6 h-6 text-red-500" />
              <span>{t('trainer.title', 'Trainer & Coach Portal')}</span>
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/20">
              Coach: {user?.name}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('trainer.subtitle', 'Assigned member roster, PT session logs and performance tracking')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <Link
            to="/workouts"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <Dumbbell className="w-3.5 h-3.5 text-red-400" />
            <span>Workout Plans</span>
          </Link>

          <Link
            to="/diets"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <Utensils className="w-3.5 h-3.5 text-emerald-400" />
            <span>Diet Plans</span>
          </Link>

          <LanguageSwitcher variant="dropdown" />
          <button
            onClick={fetchTrainerData}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Trainer Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Assigned Members</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {metrics?.assigned_members_count || members.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Active athletes</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">PT Conducted (Mo)</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {metrics?.completed_sessions_this_month || 0}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Sessions signed off</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Today's Sessions</span>
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {metrics?.scheduled_sessions_today || sessions.filter((s) => s.status === 'scheduled').length}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">On schedule</span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-[10px] uppercase font-bold tracking-wider">Estimated PT Earnings</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            ₹{(metrics?.total_pt_earnings || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Commission & payouts</span>
        </div>
      </div>

      {/* PT Sessions Today / Scheduled */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Personal Training Schedule</span>
            </h3>
            <p className="text-[11px] text-slate-400">Log workout execution and client feedback</p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No scheduled PT sessions for today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Scheduled Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">
                        {sess.member ? `${sess.member.first_name} ${sess.member.last_name || ''}` : 'Member'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sess.member?.member_code} • {sess.member?.phone}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {new Date(sess.scheduled_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          sess.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {sess.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-400 text-[11px] max-w-xs truncate">
                      {sess.notes || '—'}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {sess.status !== 'completed' ? (
                        <button
                          onClick={() => {
                            setCompleteModalSession(sess);
                            setCompletionNotes('');
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Mark Complete
                        </button>
                      ) : (
                        <span className="text-emerald-400 text-[11px] font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assigned Members List */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Assigned Athletes & Members</span>
            </h3>
            <p className="text-[11px] text-slate-400">Directly assign workouts & log biometric progress</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No members currently assigned to you.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <div
                key={m.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">{m.member_code}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {m.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-white mt-1.5">
                    {m.first_name} {m.last_name}
                  </h4>
                  <p className="text-xs text-slate-400">{m.phone}</p>

                  <div className="mt-2.5 text-[11px] text-slate-300">
                    <span className="text-slate-500">Plan:</span>{' '}
                    <strong>{m.active_membership?.plan?.name || 'Standard Package'}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setWorkoutModalMember(m);
                      setWorkoutTitle('Hypertrophy 4-Day Split');
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
                  >
                    <Dumbbell className="w-3.5 h-3.5 text-red-400" />
                    <span>Workout</span>
                  </button>

                  <button
                    onClick={() => {
                      setDietModalMember(m);
                      setDietTitle('Personalized Nutrition Routine');
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Diet</span>
                  </button>

                  <button
                    onClick={() => {
                      setProgressModalMember(m);
                      setProgressNotes('');
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5 text-sky-400" />
                    <span>Metrics</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Session Modal */}
      {completeModalSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Complete PT Session</h3>
              <button
                onClick={() => setCompleteModalSession(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Sign off workout session for:{' '}
              <span className="font-bold text-white">
                {completeModalSession.member?.first_name} ({completeModalSession.member?.member_code})
              </span>
            </p>

            <form onSubmit={handleCompleteSession} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Session Notes & Client Performance
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Completed heavy squats and leg presses. Great form, increase weight next time."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompleteModalSession(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {completing ? 'Signing off...' : 'Confirm Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Workout Plan Modal */}
      {workoutModalMember && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                Assign Routine: {workoutModalMember.first_name} {workoutModalMember.last_name}
              </h3>
              <button
                onClick={() => setWorkoutModalMember(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignWorkoutSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Routine Title</label>
                <input
                  type="text"
                  required
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Training Goal</label>
                  <select
                    value={workoutGoal}
                    onChange={(e) => setWorkoutGoal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="muscle_hypertrophy">Muscle Hypertrophy</option>
                    <option value="fat_loss">Fat Loss / Conditioning</option>
                    <option value="strength">Raw Power & Strength</option>
                    <option value="endurance">Endurance & Mobility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
                  <select
                    value={workoutDifficulty}
                    onChange={(e) => setWorkoutDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced / Pro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Days Per Week</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={daysCount}
                  onChange={(e) => setDaysCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Coach Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Focus on mind-muscle connection and progressive overload..."
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWorkoutModalMember(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigningWorkout}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isAssigningWorkout ? 'Assigning...' : 'Save & Publish Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Progress Modal */}
      {progressModalMember && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                Log Biometrics: {progressModalMember.first_name} {progressModalMember.last_name}
              </h3>
              <button
                onClick={() => setProgressModalMember(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogProgressSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Body Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Body Fat (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Chest (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={chestCm}
                    onChange={(e) => setChestCm(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Arms (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={armsCm}
                    onChange={(e) => setArmsCm(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Coach Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Body fat dropped by 1.2%, visible vascularity improvement."
                  value={progressNotes}
                  onChange={(e) => setProgressNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProgressModalMember(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingProgress}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingProgress ? 'Saving...' : 'Save Measurements'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Diet Plan Modal */}
      {dietModalMember && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-400" />
                <span>Assign Diet Plan — {dietModalMember.first_name}</span>
              </h3>
              <button
                onClick={() => setDietModalMember(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignDietSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Diet Title *</label>
                <input
                  type="text"
                  required
                  value={dietTitle}
                  onChange={(e) => setDietTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Goal</label>
                  <select
                    value={dietGoal}
                    onChange={(e) => setDietGoal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="muscle_gain">Muscle Gain</option>
                    <option value="fat_loss">Fat Loss</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Dietary Preference</label>
                  <select
                    value={dietaryPref}
                    onChange={(e) => setDietaryPref(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non_vegetarian">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggetarian">Eggetarian</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Target Calories (kcal)</label>
                  <input
                    type="number"
                    value={dietCals}
                    onChange={(e) => setDietCals(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={dietProtein}
                    onChange={(e) => setDietProtein(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Coach Nutrition Guidelines</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Drink 3.5L water daily. Have post-workout shake within 30 mins."
                  value={dietNotes}
                  onChange={(e) => setDietNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDietModalMember(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigningDiet}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isAssigningDiet ? 'Assigning...' : 'Assign Diet Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
