import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Dumbbell,
  Edit2,
  Eye,
  Filter,
  Flame,
  History,
  Layers,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/formatters';

interface ExerciseItem {
  exercise_id?: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
  target_muscle?: string;
  sets: number;
  reps: string;
  target_weight_kg?: number;
  rest_seconds?: number;
  notes?: string;
}

interface DaySchedule {
  day_name: string;
  is_rest_day: boolean;
  exercises: ExerciseItem[];
}

interface WorkoutPlan {
  id: number;
  member_id: number;
  trainer_id: number;
  title: string;
  goal: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  days_per_week: number;
  version: number;
  parent_plan_id?: number;
  start_date: string;
  end_date: string;
  notes?: string;
  schedule: Record<string, DaySchedule>;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    member_code: string;
    avatar_url?: string;
  };
  trainer?: {
    id: number;
    name: string;
    specialization?: string;
  };
  created_at: string;
}

interface ExerciseLibraryItem {
  id: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
  target_muscle: string;
  equipment: string;
  difficulty: string;
  instructions?: string;
  common_mistakes?: string;
  safety_notes?: string;
}

interface WorkoutTemplateItem {
  id: number;
  title: string;
  title_mr?: string;
  title_hi?: string;
  description: string;
  goal: string;
  difficulty: string;
  days_per_week: number;
  schedule: Record<string, DaySchedule>;
}

interface MemberOption {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  member_code: string;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function WorkoutPlans() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplateItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  // Modals
  const [builderOpen, setBuilderOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewPlan, setViewPlan] = useState<WorkoutPlan | null>(null);

  // Builder State
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [planTitle, setPlanTitle] = useState('');
  const [planGoal, setPlanGoal] = useState('muscle_hypertrophy');
  const [planDifficulty, setPlanDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [planDaysPerWeek, setPlanDaysPerWeek] = useState(4);
  const [planNotes, setPlanNotes] = useState('');
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [planEndDate, setPlanEndDate] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [planSchedule, setPlanSchedule] = useState<Record<string, DaySchedule>>({
    monday: { day_name: 'Monday - Push (Chest & Triceps)', is_rest_day: false, exercises: [] },
    tuesday: { day_name: 'Tuesday - Pull (Back & Biceps)', is_rest_day: false, exercises: [] },
    wednesday: { day_name: 'Wednesday - Active Recovery', is_rest_day: true, exercises: [] },
    thursday: { day_name: 'Thursday - Legs & Core', is_rest_day: false, exercises: [] },
    friday: { day_name: 'Friday - Shoulders & Arms', is_rest_day: false, exercises: [] },
    saturday: { day_name: 'Saturday - Conditioning / HIIT', is_rest_day: false, exercises: [] },
    sunday: { day_name: 'Sunday - Full Rest', is_rest_day: true, exercises: [] },
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Library Modal State
  const [libMuscleFilter, setLibMuscleFilter] = useState('all');
  const [libEquipmentFilter, setLibEquipmentFilter] = useState('all');
  const [libSearchQuery, setLibSearchQuery] = useState('');

  // Custom Exercise Creation State
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');
  const [newExInstructions, setNewExInstructions] = useState('');
  const [creatingExercise, setCreatingExercise] = useState(false);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansRes, exRes, tmplRes, memRes] = await Promise.all([
        api.get('/workout-plans'),
        api.get('/exercises'),
        api.get('/workout-templates'),
        api.get('/members?per_page=100').catch(() => ({ data: { data: [] } })),
      ]);

      setPlans(Array.isArray(plansRes.data?.data) ? plansRes.data.data : Array.isArray(plansRes.data) ? plansRes.data : []);
      setExercises(Array.isArray(exRes.data?.exercises) ? exRes.data.exercises : Array.isArray(exRes.data?.data) ? exRes.data.data : Array.isArray(exRes.data) ? exRes.data : []);
      setTemplates(Array.isArray(tmplRes.data?.templates) ? tmplRes.data.templates : Array.isArray(tmplRes.data?.data) ? tmplRes.data.data : Array.isArray(tmplRes.data) ? tmplRes.data : []);
      setMembers(Array.isArray(memRes.data?.data) ? memRes.data.data : Array.isArray(memRes.data) ? memRes.data : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Fast Builder fresh or pre-filled
  const openNewPlanBuilder = (template?: WorkoutTemplateItem) => {
    setEditingPlanId(null);
    setSelectedMemberId('');
    if (template) {
      setPlanTitle(template.title);
      setPlanGoal(template.goal);
      setPlanDifficulty(template.difficulty as any);
      setPlanDaysPerWeek(template.days_per_week);
      setPlanSchedule(template.schedule || {});
    } else {
      setPlanTitle('Custom 4-Day Training Routine');
      setPlanGoal('muscle_hypertrophy');
      setPlanDifficulty('intermediate');
      setPlanDaysPerWeek(4);
      setPlanSchedule({
        monday: { day_name: 'Monday - Push (Chest & Shoulders)', is_rest_day: false, exercises: [] },
        tuesday: { day_name: 'Tuesday - Pull (Back & Biceps)', is_rest_day: false, exercises: [] },
        wednesday: { day_name: 'Wednesday - Rest Day', is_rest_day: true, exercises: [] },
        thursday: { day_name: 'Thursday - Lower Body / Legs', is_rest_day: false, exercises: [] },
        friday: { day_name: 'Friday - Upper Body & Arms', is_rest_day: false, exercises: [] },
        saturday: { day_name: 'Saturday - Functional Cardio', is_rest_day: false, exercises: [] },
        sunday: { day_name: 'Sunday - Rest & Recovery', is_rest_day: true, exercises: [] },
      });
    }
    setPlanNotes('');
    setBuilderOpen(true);
  };

  const openEditPlan = (plan: WorkoutPlan) => {
    setEditingPlanId(plan.id);
    setSelectedMemberId(plan.member_id);
    setPlanTitle(plan.title);
    setPlanGoal(plan.goal);
    setPlanDifficulty(plan.difficulty);
    setPlanDaysPerWeek(plan.days_per_week);
    setPlanNotes(plan.notes || '');
    setPlanStartDate(plan.start_date || new Date().toISOString().split('T')[0]);
    setPlanEndDate(plan.end_date || '');
    setPlanSchedule(plan.schedule || {});
    setBuilderOpen(true);
  };

  const handleDuplicatePlan = async (id: number) => {
    try {
      const res = await api.post(`/workout-plans/${id}/duplicate`);
      notify(res.data.message || 'Plan duplicated as draft');
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleToggleStatus = async (plan: WorkoutPlan, newStatus: string) => {
    try {
      await api.patch(`/workout-plans/${plan.id}/status`, { status: newStatus });
      notify(`Plan marked as ${newStatus}`);
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Add exercise to day schedule
  const addExerciseToDay = (dayKey: string, exercise?: ExerciseLibraryItem) => {
    const day = planSchedule[dayKey] || { day_name: `${dayKey} Routine`, is_rest_day: false, exercises: [] };
    const newItem: ExerciseItem = {
      exercise_id: exercise?.id,
      name: exercise ? exercise.name : 'Barbell Bench Press',
      sets: 4,
      reps: '8-12',
      target_weight_kg: 50,
      rest_seconds: 90,
      notes: exercise?.instructions ? exercise.instructions.slice(0, 80) : '',
    };
    setPlanSchedule({
      ...planSchedule,
      [dayKey]: {
        ...day,
        is_rest_day: false,
        exercises: [...(day.exercises || []), newItem],
      },
    });
  };

  const removeExerciseFromDay = (dayKey: string, index: number) => {
    const day = planSchedule[dayKey];
    if (!day) return;
    const updated = [...day.exercises];
    updated.splice(index, 1);
    setPlanSchedule({
      ...planSchedule,
      [dayKey]: {
        ...day,
        exercises: updated,
      },
    });
  };

  const updateExerciseItem = (dayKey: string, index: number, field: keyof ExerciseItem, value: any) => {
    const day = planSchedule[dayKey];
    if (!day) return;
    const updated = [...day.exercises];
    updated[index] = { ...updated[index], [field]: value };
    setPlanSchedule({
      ...planSchedule,
      [dayKey]: {
        ...day,
        exercises: updated,
      },
    });
  };

  const handleSavePlan = async (asDraft = false) => {
    if (!selectedMemberId) {
      alert('Please select a member for this workout plan.');
      return;
    }
    if (!planTitle.trim()) {
      alert('Please provide a routine title.');
      return;
    }

    try {
      setSavingPlan(true);
      const payload = {
        member_id: Number(selectedMemberId),
        title: planTitle,
        goal: planGoal,
        difficulty: planDifficulty,
        days_per_week: Number(planDaysPerWeek),
        schedule: planSchedule,
        notes: planNotes,
        start_date: planStartDate,
        end_date: planEndDate,
        status: asDraft ? 'draft' : 'active',
      };

      if (editingPlanId) {
        await api.put(`/workout-plans/${editingPlanId}`, payload);
        notify('Workout routine updated! (New revision preserved in version history)');
      } else {
        await api.post('/workout-plans', payload);
        notify('Workout plan successfully assigned to member!');
      }

      setBuilderOpen(false);
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreateCustomExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;
    try {
      setCreatingExercise(true);
      const res = await api.post('/exercises', {
        name: newExName,
        target_muscle: newExMuscle,
        equipment: newExEquipment,
        difficulty: 'intermediate',
        instructions: newExInstructions,
      });
      notify(`Custom exercise '${newExName}' added to gym library!`);
      setNewExName('');
      setNewExInstructions('');
      setExercises((prev) => [res.data.exercise, ...prev]);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setCreatingExercise(false);
    }
  };

  // Filter plans
  const filteredPlans = plans.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.member?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.member?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.member?.member_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesDiff = difficultyFilter === 'all' || p.difficulty === difficultyFilter;
    return matchesSearch && matchesStatus && matchesDiff;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-semibold animate-in slide-in-from-bottom">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#303030]">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-[#D92332] dark:text-[#F02D3A]">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Workout Routines & Exercises
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                Personalized training programs, reusable exercise database and ready-made workout templates
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setLibraryOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-300 dark:border-[#303030] cursor-pointer transition-all"
          >
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>Exercise Library ({exercises.length})</span>
          </button>

          <button
            onClick={() => setTemplatesOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-300 dark:border-[#303030] cursor-pointer transition-all"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Templates ({(Array.isArray(templates) ? templates : []).length})</span>
          </button>

          <button
            onClick={() => openNewPlanBuilder()}
            className="px-5 py-2.5 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] dark:bg-[#F02D3A] dark:hover:bg-[#FF4652] text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Workout Plan</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Active Routines
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {plans.filter((p) => p.status === 'active').length}
            </span>
            <Flame className="w-5 h-5 text-[#D92332] dark:text-[#F02D3A]" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Drafts & Revisions
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {plans.filter((p) => p.status === 'draft' || p.status === 'paused').length}
            </span>
            <History className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Exercise Database
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{exercises.length}</span>
            <Dumbbell className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Ready Templates
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{(Array.isArray(templates) ? templates : []).length}</span>
            <Sparkles className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member, routine title, member code..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs focus:outline-hidden focus:border-[#D92332] dark:focus:border-[#F02D3A]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Plans</option>
            <option value="draft">Drafts</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived / Past</option>
          </select>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-medium cursor-pointer"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#D92332] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading workout routines...</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3">
          <Dumbbell className="w-10 h-10 text-slate-400 mx-auto opacity-40" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Workout Plans Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create a custom routine for any gym member or start from our ready-made templates in 1 click.
          </p>
          <button
            onClick={() => openNewPlanBuilder()}
            className="px-4 py-2 rounded-xl bg-[#D92332] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Plan</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlans.map((plan) => {
            const daysCount = Object.keys(plan.schedule || {}).length;
            const exercisesCount = Object.values(plan.schedule || {}).reduce(
              (acc, d) => acc + (d.exercises ? d.exercises.length : 0),
              0
            );

            return (
              <div
                key={plan.id}
                className="rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] p-5 shadow-sm hover:border-[#D92332]/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            plan.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : plan.status === 'draft'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {plan.status}
                        </span>

                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          v{plan.version}
                        </span>

                        <span className="text-[10px] font-bold capitalize px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {plan.difficulty}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 dark:text-white mt-2 leading-snug">
                        {plan.title}
                      </h3>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-[#A3A3A3] capitalize">
                        Goal: {plan.goal.replace('_', ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicatePlan(plan.id)}
                        title="Duplicate as draft"
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditPlan(plan)}
                        title="Edit Plan"
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#252525] text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Member Badge */}
                  <div className="p-3 rounded-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                        {plan.member?.first_name?.charAt(0) || 'M'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {plan.member?.first_name} {plan.member?.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {plan.member?.member_code} • {plan.member?.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Snapshot */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Weekly Frequency</span>
                      <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                        {plan.days_per_week} Days / Week
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Exercises</span>
                      <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                        {exercisesCount} Prescribed
                      </span>
                    </div>
                  </div>

                  {/* Days pills preview */}
                  <div className="flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map((d) => {
                      const dayData = plan.schedule?.[d];
                      const isRest = dayData?.is_rest_day ?? true;
                      const hasItems = (dayData?.exercises?.length || 0) > 0;
                      return (
                        <span
                          key={d}
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                            !isRest && hasItems
                              ? 'bg-red-500/15 text-[#D92332] dark:text-[#F02D3A]'
                              : 'bg-slate-200 dark:bg-[#252525] text-slate-400'
                          }`}
                        >
                          {d.slice(0, 3)}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Actions bottom */}
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#303030] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewPlan(plan)}
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#D92332] dark:hover:text-[#F02D3A] flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Schedule</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {plan.status === 'active' ? (
                      <button
                        onClick={() => handleToggleStatus(plan, 'paused')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PauseCircle className="w-3 h-3" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(plan, 'active')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PlayCircle className="w-3 h-3" />
                        <span>Activate</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PLAN BUILDER MODAL */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/10 text-[#D92332] dark:text-[#F02D3A]">
                  <Dumbbell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {editingPlanId ? 'Edit Workout Routine' : 'Build Personalized Workout Plan'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {editingPlanId
                      ? 'Saving an active plan will automatically archive the previous version for audit history.'
                      : 'Choose member, set goals, and build weekly Mon-Sun routines with sets & reps.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBuilderOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Quick-Select Button */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Save time: Start from ready-made starting routines (PPL, Beginner, HIIT)</span>
              </div>
              <button
                onClick={() => setTemplatesOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer shrink-0"
              >
                Load From Template
              </button>
            </div>

            {/* Basic Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Assigned Member *
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!!editingPlanId}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-[#D92332]"
                >
                  <option value="">Select Member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.member_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Routine Title *
                </label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="e.g. 4-Day Hypertrophy Routine"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-[#D92332]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Primary Goal *
                </label>
                <select
                  value={planGoal}
                  onChange={(e) => setPlanGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-[#D92332]"
                >
                  <option value="muscle_hypertrophy">Muscle Hypertrophy (Muscle Gain)</option>
                  <option value="fat_loss">Fat Loss & Conditioning</option>
                  <option value="strength_conditioning">Raw Strength (Powerlifting)</option>
                  <option value="general_fitness">General Fitness & Mobility</option>
                  <option value="rehab">Post-Injury Rehab</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Difficulty Level
                </label>
                <select
                  value={planDifficulty}
                  onChange={(e) => setPlanDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-[#D92332]"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Days Per Week
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={planDaysPerWeek}
                  onChange={(e) => setPlanDaysPerWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-[#D92332]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Plan Duration (Start - End)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium"
                  />
                  <input
                    type="date"
                    value={planEndDate}
                    onChange={(e) => setPlanEndDate(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            {/* 7-DAY WEEKLY SCHEDULE BUILDER */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#303030]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#D92332]" />
                    <span>Weekly Schedule (Monday to Sunday)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure exercises, sets, reps and target weights for each day.</p>
                </div>
              </div>

              <div className="space-y-3">
                {DAYS_OF_WEEK.map((dayKey) => {
                  const day = planSchedule[dayKey] || { day_name: `${dayKey} Routine`, is_rest_day: false, exercises: [] };

                  return (
                    <div
                      key={dayKey}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 w-24">
                            {dayKey}
                          </span>
                          <input
                            type="text"
                            value={day.day_name}
                            onChange={(e) =>
                              setPlanSchedule({
                                ...planSchedule,
                                [dayKey]: { ...day, day_name: e.target.value },
                              })
                            }
                            placeholder="e.g. Chest & Triceps"
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#303030] text-xs font-semibold flex-1 max-w-sm"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.is_rest_day}
                              onChange={(e) =>
                                setPlanSchedule({
                                  ...planSchedule,
                                  [dayKey]: { ...day, is_rest_day: e.target.checked },
                                })
                              }
                              className="rounded text-[#D92332]"
                            />
                            <span>Rest Day</span>
                          </label>

                          {!day.is_rest_day && (
                            <button
                              type="button"
                              onClick={() => addExerciseToDay(dayKey)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Exercise</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Exercises in day */}
                      {!day.is_rest_day && (
                        <div className="space-y-2 pt-2">
                          {(!day.exercises || day.exercises.length === 0) ? (
                            <p className="text-[11px] text-slate-400 italic">No exercises added yet. Tap "Add Exercise".</p>
                          ) : (
                            day.exercises.map((item, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                              >
                                <div className="sm:col-span-4">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateExerciseItem(dayKey, idx, 'name', e.target.value)}
                                    placeholder="Exercise name"
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 uppercase">Sets</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      value={item.sets}
                                      onChange={(e) => updateExerciseItem(dayKey, idx, 'sets', Number(e.target.value))}
                                      className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-center"
                                    />
                                  </div>
                                </div>

                                <div className="sm:col-span-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 uppercase">Reps</span>
                                    <input
                                      type="text"
                                      value={item.reps}
                                      onChange={(e) => updateExerciseItem(dayKey, idx, 'reps', e.target.value)}
                                      placeholder="8-12"
                                      className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-center"
                                    />
                                  </div>
                                </div>

                                <div className="sm:col-span-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 uppercase">Kg</span>
                                    <input
                                      type="number"
                                      value={item.target_weight_kg || 0}
                                      onChange={(e) => updateExerciseItem(dayKey, idx, 'target_weight_kg', Number(e.target.value))}
                                      placeholder="kg"
                                      className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-center"
                                    />
                                  </div>
                                </div>

                                <div className="sm:col-span-1">
                                  <input
                                    type="number"
                                    value={item.rest_seconds || 60}
                                    onChange={(e) => updateExerciseItem(dayKey, idx, 'rest_seconds', Number(e.target.value))}
                                    title="Rest seconds"
                                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-[11px] font-bold text-center"
                                  />
                                </div>

                                <div className="sm:col-span-1 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeExerciseFromDay(dayKey, idx)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coach Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Trainer Instructions & Safety Notes for Member
              </label>
              <textarea
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Warm up 5 mins before lifting. Focus on slow eccentric on bench press. Drink at least 3L water."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-[#D92332]"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#303030]">
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSavePlan(true)}
                disabled={savingPlan}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-slate-300 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                onClick={() => handleSavePlan(false)}
                disabled={savingPlan}
                className="px-6 py-2.5 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-black shadow-lg shadow-red-500/20 cursor-pointer flex items-center gap-2"
              >
                {savingPlan ? 'Saving...' : 'Publish Active Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXERCISE LIBRARY MODAL */}
      {libraryOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Centralized Exercise Library</h2>
                  <p className="text-xs text-slate-400">
                    Comprehensive muscle-grouped library with instructions, equipment tags, and safety cues
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLibraryOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Custom Exercise Toggle / Form */}
            <form
              onSubmit={handleCreateCustomExercise}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#D92332]" />
                <span>Add Custom Exercise to Gym Library</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  placeholder="Exercise name (e.g. Landmine Press)"
                  required
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-semibold"
                />
                <select
                  value={newExMuscle}
                  onChange={(e) => setNewExMuscle(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-medium"
                >
                  <option value="Chest">Chest</option>
                  <option value="Back">Back</option>
                  <option value="Shoulders">Shoulders</option>
                  <option value="Biceps">Biceps</option>
                  <option value="Triceps">Triceps</option>
                  <option value="Legs">Legs / Quads</option>
                  <option value="Hamstrings">Hamstrings & Glutes</option>
                  <option value="Core">Core / Abs</option>
                  <option value="Cardio">Cardio / Conditioning</option>
                </select>
                <select
                  value={newExEquipment}
                  onChange={(e) => setNewExEquipment(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-medium"
                >
                  <option value="Barbell">Barbell</option>
                  <option value="Dumbbell">Dumbbell</option>
                  <option value="Machine">Machine</option>
                  <option value="Cable">Cable</option>
                  <option value="Bodyweight">Bodyweight</option>
                  <option value="Kettlebell">Kettlebell</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingExercise}
                  className="px-4 py-2 rounded-xl bg-[#D92332] text-white text-xs font-bold hover:bg-[#B91C2B] cursor-pointer"
                >
                  {creatingExercise ? 'Adding...' : '+ Add Exercise'}
                </button>
              </div>
            </form>

            {/* Search & Filter Exercises */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={libSearchQuery}
                  onChange={(e) => setLibSearchQuery(e.target.value)}
                  placeholder="Filter exercises by name..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs"
                />
              </div>

              <select
                value={libMuscleFilter}
                onChange={(e) => setLibMuscleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-medium"
              >
                <option value="all">All Muscles</option>
                <option value="Chest">Chest</option>
                <option value="Back">Back</option>
                <option value="Shoulders">Shoulders</option>
                <option value="Biceps">Biceps</option>
                <option value="Triceps">Triceps</option>
                <option value="Legs">Legs</option>
                <option value="Core">Core</option>
                <option value="Cardio">Cardio</option>
              </select>
            </div>

            {/* Exercises Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {exercises
                .filter((ex) => {
                  const matchesSearch =
                    ex.name.toLowerCase().includes(libSearchQuery.toLowerCase()) ||
                    (ex.name_mr && ex.name_mr.includes(libSearchQuery)) ||
                    (ex.name_hi && ex.name_hi.includes(libSearchQuery));
                  const matchesMuscle = libMuscleFilter === 'all' || ex.target_muscle === libMuscleFilter;
                  return matchesSearch && matchesMuscle;
                })
                .map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-2 hover:border-[#D92332]/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                          {ex.name}
                        </h4>
                        {(ex.name_mr || ex.name_hi) && (
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                            {ex.name_mr || ex.name_hi}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                        {ex.target_muscle}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#A3A3A3]">
                      <span>{ex.equipment}</span>
                      <span>•</span>
                      <span className="capitalize">{ex.difficulty}</span>
                    </div>

                    {ex.instructions && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                        "{ex.instructions}"
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATES MODAL */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Ready-Made Workout Templates</h2>
                  <p className="text-xs text-slate-400">
                    Scientifically structured routine templates. Click "Use Template" to auto-populate the plan builder.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTemplatesOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {(Array.isArray(templates) ? templates : []).map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{tmpl.title}</h4>
                      <span className="text-[10px] font-bold capitalize px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                        {tmpl.difficulty}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {tmpl.days_per_week} Days/Week
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tmpl.description}</p>
                  </div>

                  <button
                    onClick={() => {
                      setTemplatesOpen(false);
                      openNewPlanBuilder(tmpl);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Use Template</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW SCHEDULE MODAL */}
      {viewPlan && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                    {viewPlan.status} • v{viewPlan.version}
                  </span>
                  <span className="text-xs text-slate-400">
                    For {viewPlan.member?.first_name} {viewPlan.member?.last_name}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">{viewPlan.title}</h2>
              </div>
              <button
                onClick={() => setViewPlan(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Days Breakdown */}
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((d) => {
                const day = viewPlan.schedule?.[d];
                if (!day) return null;

                return (
                  <div
                    key={d}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                        {d} — {day.day_name}
                      </span>
                      {day.is_rest_day && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-[#252525] text-slate-500">
                          Rest Day
                        </span>
                      )}
                    </div>

                    {!day.is_rest_day && day.exercises && (
                      <div className="space-y-1.5 pt-1">
                        {day.exercises.map((item, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                              {item.notes && <span className="text-[10px] text-slate-400 italic">"{item.notes}"</span>}
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-[#D92332] dark:text-[#F02D3A]">
                                {item.sets} Sets × {item.reps} Reps
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
                    )}
                  </div>
                );
              })}
            </div>

            {viewPlan.notes && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                <strong>Trainer Notes:</strong> {viewPlan.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
