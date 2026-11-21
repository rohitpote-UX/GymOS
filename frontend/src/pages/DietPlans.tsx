import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Apple,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Copy,
  Edit2,
  Eye,
  Filter,
  Flame,
  Layers,
  PauseCircle,
  PieChart,
  PlayCircle,
  Plus,
  RefreshCw,
  Salad,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/formatters';

interface FoodItem {
  id?: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
  serving_size?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  dietary_preference?: string;
}

interface MealSlotItem {
  food_name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealSlot {
  slot_name: string;
  time_hint: string;
  items: MealSlotItem[];
}

interface DietPlan {
  id: number;
  member_id: number;
  trainer_id: number;
  title: string;
  goal: string;
  dietary_preference: 'vegetarian' | 'non_vegetarian' | 'vegan' | 'eggetarian';
  food_allergies?: string;
  food_preferences?: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  meals: MealSlot[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  version: number;
  parent_plan_id?: number;
  start_date: string;
  end_date: string;
  notes?: string;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    member_code: string;
  };
  trainer?: {
    id: number;
    name: string;
  };
}

interface DietTemplateItem {
  id: number;
  title: string;
  title_mr?: string;
  title_hi?: string;
  description: string;
  goal: string;
  dietary_preference: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  meals: MealSlot[];
}

interface MemberOption {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  member_code: string;
}

const DEFAULT_SLOTS: MealSlot[] = [
  { slot_name: 'Breakfast', time_hint: '08:30 AM', items: [] },
  { slot_name: 'Mid-Morning Snack', time_hint: '11:00 AM', items: [] },
  { slot_name: 'Lunch', time_hint: '01:30 PM', items: [] },
  { slot_name: 'Evening Snack', time_hint: '05:00 PM', items: [] },
  { slot_name: 'Dinner', time_hint: '08:30 PM', items: [] },
];

export default function DietPlans() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [templates, setTemplates] = useState<DietTemplateItem[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [preferenceFilter, setPreferenceFilter] = useState('all');

  // Modals
  const [builderOpen, setBuilderOpen] = useState(false);
  const [foodDbOpen, setFoodDbOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewPlan, setViewPlan] = useState<DietPlan | null>(null);

  // Builder State
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [planTitle, setPlanTitle] = useState('');
  const [planGoal, setPlanGoal] = useState('muscle_gain');
  const [planDietaryPref, setPlanDietaryPref] = useState<'vegetarian' | 'non_vegetarian' | 'vegan' | 'eggetarian'>('vegetarian');
  const [planAllergies, setPlanAllergies] = useState('');
  const [planPreferences, setPlanPreferences] = useState('');
  const [targetCalories, setTargetCalories] = useState<number | ''>('');
  const [targetProtein, setTargetProtein] = useState<number | ''>('');
  const [targetCarbs, setTargetCarbs] = useState<number | ''>('');
  const [targetFat, setTargetFat] = useState<number | ''>('');
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [planEndDate, setPlanEndDate] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [planNotes, setPlanNotes] = useState('');
  const [mealSlots, setMealSlots] = useState<MealSlot[]>(DEFAULT_SLOTS);
  const [savingPlan, setSavingPlan] = useState(false);

  // Food Library Search State
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodDietaryFilter, setFoodDietaryFilter] = useState('all');

  // Custom Food Creation
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodServing, setNewFoodServing] = useState('100g');
  const [newFoodCalories, setNewFoodCalories] = useState<number>(150);
  const [newFoodProtein, setNewFoodProtein] = useState<number>(10);
  const [newFoodCarbs, setNewFoodCarbs] = useState<number>(15);
  const [newFoodFat, setNewFoodFat] = useState<number>(5);
  const [newFoodPref, setNewFoodPref] = useState('vegetarian');
  const [creatingFood, setCreatingFood] = useState(false);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansRes, foodsRes, tmplRes, memRes] = await Promise.all([
        api.get('/diet-plans'),
        api.get('/foods'),
        api.get('/diet-templates'),
        api.get('/members?per_page=100').catch(() => ({ data: { data: [] } })),
      ]);

      setPlans(Array.isArray(plansRes.data?.data) ? plansRes.data.data : Array.isArray(plansRes.data) ? plansRes.data : []);
      setFoods(Array.isArray(foodsRes.data?.foods) ? foodsRes.data.foods : Array.isArray(foodsRes.data?.data) ? foodsRes.data.data : Array.isArray(foodsRes.data) ? foodsRes.data : []);
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

  // Recalculate macro sums from meal items
  const macroTotals = React.useMemo(() => {
    let totalCals = 0;
    let totalP = 0;
    let totalC = 0;
    let totalF = 0;

    mealSlots.forEach((slot) => {
      (slot.items || []).forEach((it) => {
        totalCals += Number(it.calories) || 0;
        totalP += Number(it.protein) || 0;
        totalC += Number(it.carbs) || 0;
        totalF += Number(it.fat) || 0;
      });
    });

    return {
      calories: Math.round(totalCals),
      protein: Math.round(totalP),
      carbs: Math.round(totalC),
      fat: Math.round(totalF),
    };
  }, [mealSlots]);

  const openNewPlanBuilder = (template?: DietTemplateItem) => {
    setEditingPlanId(null);
    setSelectedMemberId('');
    if (template) {
      setPlanTitle(template.title);
      setPlanGoal(template.goal);
      setPlanDietaryPref(template.dietary_preference as any);
      setTargetCalories(template.target_calories);
      setTargetProtein(template.target_protein_g);
      setTargetCarbs(template.target_carbs_g);
      setTargetFat(template.target_fat_g);
      setMealSlots(template.meals || DEFAULT_SLOTS);
    } else {
      setPlanTitle('Custom Balanced Nutrition Plan');
      setPlanGoal('muscle_gain');
      setPlanDietaryPref('vegetarian');
      setTargetCalories('');
      setTargetProtein('');
      setTargetCarbs('');
      setTargetFat('');
      setMealSlots(DEFAULT_SLOTS);
    }
    setPlanAllergies('');
    setPlanPreferences('');
    setPlanNotes('');
    setBuilderOpen(true);
  };

  const openEditPlan = (plan: DietPlan) => {
    setEditingPlanId(plan.id);
    setSelectedMemberId(plan.member_id);
    setPlanTitle(plan.title);
    setPlanGoal(plan.goal);
    setPlanDietaryPref(plan.dietary_preference);
    setPlanAllergies(plan.food_allergies || '');
    setPlanPreferences(plan.food_preferences || '');
    setTargetCalories(plan.target_calories);
    setTargetProtein(plan.target_protein_g);
    setTargetCarbs(plan.target_carbs_g);
    setTargetFat(plan.target_fat_g);
    setMealSlots(plan.meals || DEFAULT_SLOTS);
    setPlanStartDate(plan.start_date || new Date().toISOString().split('T')[0]);
    setPlanEndDate(plan.end_date || '');
    setPlanNotes(plan.notes || '');
    setBuilderOpen(true);
  };

  const handleDuplicatePlan = async (id: number) => {
    try {
      const res = await api.post(`/diet-plans/${id}/duplicate`);
      notify(res.data.message || 'Diet plan duplicated as draft');
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleToggleStatus = async (plan: DietPlan, newStatus: string) => {
    try {
      await api.patch(`/diet-plans/${plan.id}/status`, { status: newStatus });
      notify(`Diet plan marked as ${newStatus}`);
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Meal Slots Manipulation
  const addMealSlot = () => {
    setMealSlots([...mealSlots, { slot_name: 'Post-Workout Snack', time_hint: '07:30 PM', items: [] }]);
  };

  const removeMealSlot = (slotIdx: number) => {
    const updated = [...mealSlots];
    updated.splice(slotIdx, 1);
    setMealSlots(updated);
  };

  const addItemToSlot = (slotIdx: number, food?: FoodItem) => {
    const updated = [...mealSlots];
    const newItem: MealSlotItem = {
      food_name: food ? food.name : 'Brown Rice + Dal',
      quantity: food ? food.serving_size || '1 serving' : '150g',
      calories: food ? food.calories : 250,
      protein: food ? food.protein_g : 10,
      carbs: food ? food.carbs_g : 45,
      fat: food ? food.fat_g : 4,
    };
    updated[slotIdx].items.push(newItem);
    setMealSlots(updated);
  };

  const removeItemFromSlot = (slotIdx: number, itemIdx: number) => {
    const updated = [...mealSlots];
    updated[slotIdx].items.splice(itemIdx, 1);
    setMealSlots(updated);
  };

  const updateMealItem = (slotIdx: number, itemIdx: number, field: keyof MealSlotItem, value: any) => {
    const updated = [...mealSlots];
    updated[slotIdx].items[itemIdx] = {
      ...updated[slotIdx].items[itemIdx],
      [field]: value,
    };
    setMealSlots(updated);
  };

  const handleSavePlan = async (asDraft = false) => {
    if (!selectedMemberId) {
      alert('Please select a member for this diet plan.');
      return;
    }
    if (!planTitle.trim()) {
      alert('Please provide a diet plan title.');
      return;
    }

    try {
      setSavingPlan(true);
      const payload = {
        member_id: Number(selectedMemberId),
        title: planTitle,
        goal: planGoal,
        dietary_preference: planDietaryPref,
        food_allergies: planAllergies,
        food_preferences: planPreferences,
        target_calories: targetCalories ? Number(targetCalories) : macroTotals.calories,
        target_protein_g: targetProtein ? Number(targetProtein) : macroTotals.protein,
        target_carbs_g: targetCarbs ? Number(targetCarbs) : macroTotals.carbs,
        target_fat_g: targetFat ? Number(targetFat) : macroTotals.fat,
        meals: mealSlots,
        start_date: planStartDate,
        end_date: planEndDate,
        notes: planNotes,
        status: asDraft ? 'draft' : 'active',
      };

      if (editingPlanId) {
        await api.put(`/diet-plans/${editingPlanId}`, payload);
        notify('Diet plan updated! (New revision preserved in version history)');
      } else {
        await api.post('/diet-plans', payload);
        notify('Diet plan successfully assigned to member!');
      }

      setBuilderOpen(false);
      fetchData();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleCreateCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName.trim()) return;

    try {
      setCreatingFood(true);
      const res = await api.post('/foods', {
        name: newFoodName,
        serving_size: newFoodServing,
        calories: Number(newFoodCalories),
        protein_g: Number(newFoodProtein),
        carbs_g: Number(newFoodCarbs),
        fat_g: Number(newFoodFat),
        dietary_preference: newFoodPref,
      });

      notify(`Food '${newFoodName}' added to database!`);
      setNewFoodName('');
      setFoods((prev) => [res.data.food, ...prev]);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setCreatingFood(false);
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
    const matchesPref = preferenceFilter === 'all' || p.dietary_preference === preferenceFilter;
    return matchesSearch && matchesStatus && matchesPref;
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
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Diet & Nutrition Plans
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                Personalized dietary programming, Indian food macro library, and meal slot trackers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFoodDbOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1C1C1C] dark:hover:bg-[#252525] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-300 dark:border-[#303030] cursor-pointer transition-all"
          >
            <Salad className="w-4 h-4 text-emerald-500" />
            <span>Food Database ({foods.length})</span>
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
            <span>+ Create Diet Plan</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Active Diet Plans
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {plans.filter((p) => p.status === 'active').length}
            </span>
            <Utensils className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Avg Daily Calories
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {plans.length > 0
                ? Math.round(plans.reduce((acc, p) => acc + (p.target_calories || 0), 0) / plans.length)
                : 2100}{' '}
              <span className="text-xs font-normal text-slate-400">kcal</span>
            </span>
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Indian Foods Library
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{foods.length}</span>
            <Apple className="w-5 h-5 text-rose-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
          <span className="text-[11px] font-bold text-slate-500 dark:text-[#A3A3A3] uppercase tracking-wider block">
            Dietary Split
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {plans.filter((p) => p.dietary_preference === 'vegetarian').length} Veg •{' '}
              {plans.filter((p) => p.dietary_preference === 'non_vegetarian').length} Non-Veg
            </span>
            <PieChart className="w-5 h-5 text-blue-500" />
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
            placeholder="Search member, diet plan title..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs focus:outline-hidden focus:border-[#D92332]"
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
            <option value="archived">Archived</option>
          </select>

          <select
            value={preferenceFilter}
            onChange={(e) => setPreferenceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-medium cursor-pointer"
          >
            <option value="all">All Food Types</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="non_vegetarian">Non-Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="eggetarian">Eggetarian</option>
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
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading diet & nutrition plans...</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3">
          <Utensils className="w-10 h-10 text-slate-400 mx-auto opacity-40" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Diet Plans Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Design personalized nutrition routines for your members or start from our ready-made diet templates.
          </p>
          <button
            onClick={() => openNewPlanBuilder()}
            className="px-4 py-2 rounded-xl bg-[#D92332] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Diet Plan</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlans.map((plan) => {
            const mealsCount = plan.meals ? plan.meals.length : 0;
            const itemsCount = (plan.meals || []).reduce((acc, m) => acc + (m.items ? m.items.length : 0), 0);

            return (
              <div
                key={plan.id}
                className="rounded-3xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] p-5 shadow-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            plan.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {plan.status}
                        </span>

                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          v{plan.version}
                        </span>

                        <span
                          className={`text-[10px] font-bold capitalize px-2 py-0.5 rounded-full ${
                            plan.dietary_preference === 'vegetarian'
                              ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                              : plan.dietary_preference === 'non_vegetarian'
                              ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}
                        >
                          {plan.dietary_preference.replace('_', ' ')}
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
                        title="Duplicate plan"
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
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                        {plan.member?.first_name?.charAt(0) || 'M'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {plan.member?.first_name} {plan.member?.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{plan.member?.member_code}</span>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {mealsCount} Meals / Day
                    </span>
                  </div>

                  {/* Macros Target Cards */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                      <span className="text-[9px] uppercase text-slate-400 block font-semibold">Calories</span>
                      <span className="text-xs font-black text-amber-500 mt-0.5 block font-mono">
                        {plan.target_calories}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                      <span className="text-[9px] uppercase text-slate-400 block font-semibold">Protein</span>
                      <span className="text-xs font-black text-emerald-500 mt-0.5 block font-mono">
                        {plan.target_protein_g}g
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                      <span className="text-[9px] uppercase text-slate-400 block font-semibold">Carbs</span>
                      <span className="text-xs font-black text-blue-500 mt-0.5 block font-mono">
                        {plan.target_carbs_g}g
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030]">
                      <span className="text-[9px] uppercase text-slate-400 block font-semibold">Fats</span>
                      <span className="text-xs font-black text-rose-500 mt-0.5 block font-mono">
                        {plan.target_fat_g}g
                      </span>
                    </div>
                  </div>

                  {/* Allergies / Notes preview */}
                  {plan.food_allergies && (
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg">
                      <strong>Allergies:</strong> {plan.food_allergies}
                    </div>
                  )}
                </div>

                {/* Actions bottom */}
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#303030] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewPlan(plan)}
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-500 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Meals & Foods</span>
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

      {/* FAST DIET PLAN BUILDER MODAL */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {editingPlanId ? 'Edit Diet & Nutrition Plan' : 'Build Personalized Diet Plan'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Assign meal slots, select Indian food items, and let the system auto-calculate calories & macros.
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

            {/* Template Quick Load */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Save time: Load starting template (High-Protein Gain, Veg Fat Loss)</span>
              </div>
              <button
                onClick={() => setTemplatesOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer shrink-0"
              >
                Load From Template
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Assigned Member *
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!!editingPlanId}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-emerald-500"
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
                  Plan Title *
                </label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="e.g. 2,200 Calorie Lean Muscle Diet"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Dietary Preference *
                </label>
                <select
                  value={planDietaryPref}
                  onChange={(e) => setPlanDietaryPref(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-emerald-500"
                >
                  <option value="vegetarian">Vegetarian</option>
                  <option value="non_vegetarian">Non-Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="eggetarian">Eggetarian</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Food Allergies
                </label>
                <input
                  type="text"
                  value={planAllergies}
                  onChange={(e) => setPlanAllergies(e.target.value)}
                  placeholder="e.g. Lactose intolerant, peanut allergy"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Food Preferences / Dislikes
                </label>
                <input
                  type="text"
                  value={planPreferences}
                  onChange={(e) => setPlanPreferences(e.target.value)}
                  placeholder="e.g. Prefers roti over rice, no mushrooms"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Primary Goal
                </label>
                <select
                  value={planGoal}
                  onChange={(e) => setPlanGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium"
                >
                  <option value="muscle_gain">Muscle Gain (Hypertrophy)</option>
                  <option value="fat_loss">Fat Loss / Calorie Deficit</option>
                  <option value="body_recomposition">Body Recomposition</option>
                  <option value="maintenance">Maintenance & Health</option>
                </select>
              </div>
            </div>

            {/* LIVE AUTO-CALCULATED MACRO METERS */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                  Calculated Daily Totals From Foods Below
                </span>
                <span className="text-xs text-slate-500 font-medium">Auto-sums as you add foods</span>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#101010]">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold">Calories</span>
                  <span className="text-sm font-black text-amber-500 font-mono">{macroTotals.calories} kcal</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#101010]">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold">Protein</span>
                  <span className="text-sm font-black text-emerald-500 font-mono">{macroTotals.protein} g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#101010]">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold">Carbs</span>
                  <span className="text-sm font-black text-blue-500 font-mono">{macroTotals.carbs} g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#101010]">
                  <span className="text-[10px] uppercase text-slate-400 block font-bold">Fats</span>
                  <span className="text-sm font-black text-rose-500 font-mono">{macroTotals.fat} g</span>
                </div>
              </div>
            </div>

            {/* MEAL SLOTS BUILDER */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-[#303030]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-500" />
                    <span>Daily Meal Slots & Portions</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure meals across the day.</p>
                </div>

                <button
                  type="button"
                  onClick={addMealSlot}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#252525] hover:bg-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Meal Slot</span>
                </button>
              </div>

              <div className="space-y-4">
                {mealSlots.map((slot, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={slot.slot_name}
                          onChange={(e) => {
                            const updated = [...mealSlots];
                            updated[sIdx].slot_name = e.target.value;
                            setMealSlots(updated);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#303030] text-xs font-bold max-w-xs"
                        />
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={slot.time_hint}
                            onChange={(e) => {
                              const updated = [...mealSlots];
                              updated[sIdx].time_hint = e.target.value;
                              setMealSlots(updated);
                            }}
                            placeholder="08:30 AM"
                            className="px-2 py-1 rounded-lg bg-white dark:bg-[#101010] border border-slate-300 dark:border-[#303030] text-xs font-mono w-24 text-center"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addItemToSlot(sIdx)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Food</span>
                        </button>

                        {mealSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMealSlot(sIdx)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Food Items in this Slot */}
                    <div className="space-y-2 pt-1">
                      {(!slot.items || slot.items.length === 0) ? (
                        <p className="text-[11px] text-slate-400 italic">No food items added yet to {slot.slot_name}.</p>
                      ) : (
                        slot.items.map((it, iIdx) => (
                          <div
                            key={iIdx}
                            className="p-3.5 rounded-2xl bg-white dark:bg-[#141414] border border-slate-200/90 dark:border-[#282828] shadow-xs hover:border-slate-300 dark:hover:border-[#383838] transition-all space-y-2.5"
                          >
                            {/* Row 1: Food Name + Quantity / Portion + Delete Button */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={it.food_name}
                                  onChange={(e) => updateMealItem(sIdx, iIdx, 'food_name', e.target.value)}
                                  placeholder="Food item (e.g. 2 Boiled Eggs, Oats & Almonds)"
                                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="flex items-center gap-1.5 flex-1 sm:w-44 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030]">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Qty:</span>
                                  <input
                                    type="text"
                                    value={it.quantity}
                                    onChange={(e) => updateMealItem(sIdx, iIdx, 'quantity', e.target.value)}
                                    placeholder="e.g. 100g / 2 pcs"
                                    className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItemFromSlot(sIdx, iIdx)}
                                  className="p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 cursor-pointer shrink-0 transition-colors"
                                  title="Remove food item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Macros & Calories Grid with Vertical Stacking for Zero Clipping */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                              {/* Calories Card */}
                              <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200/80 dark:border-[#2D2D2D]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                                    <span>🔥</span>
                                    <span>Calories</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">kcal</span>
                                </div>
                                <input
                                  type="number"
                                  value={it.calories || ''}
                                  onChange={(e) => updateMealItem(sIdx, iIdx, 'calories', Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#363636] text-xs font-black text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Protein Card */}
                              <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200/80 dark:border-[#2D2D2D]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                    <span>Protein</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">g</span>
                                </div>
                                <input
                                  type="number"
                                  value={it.protein || ''}
                                  onChange={(e) => updateMealItem(sIdx, iIdx, 'protein', Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#363636] text-xs font-black text-emerald-600 dark:text-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-emerald-500"
                                />
                              </div>

                              {/* Carbs Card */}
                              <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200/80 dark:border-[#2D2D2D]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-sky-500 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block"></span>
                                    <span>Carbs</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">g</span>
                                </div>
                                <input
                                  type="number"
                                  value={it.carbs || ''}
                                  onChange={(e) => updateMealItem(sIdx, iIdx, 'carbs', Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#363636] text-xs font-black text-sky-600 dark:text-sky-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-sky-500"
                                />
                              </div>

                              {/* Fats Card */}
                              <div className="flex flex-col gap-1 p-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200/80 dark:border-[#2D2D2D]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                                    <span>Fats</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">g</span>
                                </div>
                                <input
                                  type="number"
                                  value={it.fat || ''}
                                  onChange={(e) => updateMealItem(sIdx, iIdx, 'fat', Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full px-2 py-1 rounded-lg bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#363636] text-xs font-black text-rose-600 dark:text-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-rose-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nutritionist Guidelines & Hydration Target
              </label>
              <textarea
                value={planNotes}
                onChange={(e) => setPlanNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Drink 3.5 liters of water daily. Avoid deep-fried items. Have post-workout meal within 45 mins of training."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-300 dark:border-[#303030] text-xs font-medium focus:border-emerald-500"
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
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
              >
                {savingPlan ? 'Publishing...' : 'Publish Active Diet Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INDIAN FOOD DATABASE MODAL */}
      {foodDbOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Salad className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Indian Food & Nutrition Database</h2>
                  <p className="text-xs text-slate-400">
                    Pre-calibrated calories, protein, carbs and fats for Indian diet staples
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFoodDbOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202020] text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Add Custom Food */}
            <form
              onSubmit={handleCreateCustomFood}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                <span>Add Custom Food to Database</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                <input
                  type="text"
                  value={newFoodName}
                  onChange={(e) => setNewFoodName(e.target.value)}
                  placeholder="Food name"
                  required
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs font-semibold"
                />
                <input
                  type="text"
                  value={newFoodServing}
                  onChange={(e) => setNewFoodServing(e.target.value)}
                  placeholder="Serving size"
                  className="px-2 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs text-center"
                />
                <input
                  type="number"
                  value={newFoodCalories}
                  onChange={(e) => setNewFoodCalories(Number(e.target.value))}
                  placeholder="Cals"
                  className="px-2 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs text-center"
                />
                <input
                  type="number"
                  value={newFoodProtein}
                  onChange={(e) => setNewFoodProtein(Number(e.target.value))}
                  placeholder="Protein"
                  className="px-2 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs text-center"
                />
                <select
                  value={newFoodPref}
                  onChange={(e) => setNewFoodPref(e.target.value)}
                  className="px-2 py-2 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] text-xs"
                >
                  <option value="vegetarian">Veg</option>
                  <option value="non_vegetarian">Non-Veg</option>
                  <option value="vegan">Vegan</option>
                  <option value="eggetarian">Egg</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingFood}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  {creatingFood ? 'Adding...' : '+ Add'}
                </button>
              </div>
            </form>

            {/* Filter Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={foodSearchQuery}
                  onChange={(e) => setFoodSearchQuery(e.target.value)}
                  placeholder="Search Indian foods (Paneer, Roti, Chicken, Dal, Oats)..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs"
                />
              </div>

              <select
                value={foodDietaryFilter}
                onChange={(e) => setFoodDietaryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] text-xs font-medium"
              >
                <option value="all">All Diets</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="non_vegetarian">Non-Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="eggetarian">Eggetarian</option>
              </select>
            </div>

            {/* Foods Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {foods
                .filter((f) => {
                  const matchesSearch =
                    f.name.toLowerCase().includes(foodSearchQuery.toLowerCase()) ||
                    (f.name_mr && f.name_mr.includes(foodSearchQuery)) ||
                    (f.name_hi && f.name_hi.includes(foodSearchQuery));
                  const matchesDiet = foodDietaryFilter === 'all' || f.dietary_preference === foodDietaryFilter;
                  return matchesSearch && matchesDiet;
                })
                .map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-1.5 hover:border-emerald-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">{f.name}</h4>
                        {(f.name_mr || f.name_hi) && (
                          <span className="text-[10px] text-slate-400 block">{f.name_mr || f.name_hi}</span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                        {f.serving_size || '100g'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-[#303030]">
                      <span className="font-bold text-amber-500">{f.calories} cals</span>
                      <span className="text-slate-500 text-[10px]">
                        P: <strong className="text-emerald-500">{f.protein_g}g</strong> • C:{' '}
                        <strong className="text-blue-500">{f.carbs_g}g</strong> • F:{' '}
                        <strong className="text-rose-500">{f.fat_g}g</strong>
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* DIET TEMPLATES MODAL */}
      {templatesOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#303030] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Ready-Made Diet Templates</h2>
                  <p className="text-xs text-slate-400">
                    Scientifically calculated calorie & macro routines for Indian gym members
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
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{tmpl.title}</h4>
                      <span className="text-[10px] font-bold capitalize px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                        {tmpl.dietary_preference}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{tmpl.description}</p>
                    <div className="flex items-center gap-3 text-xs font-mono pt-1 text-slate-600 dark:text-slate-300">
                      <span>{tmpl.target_calories} kcal</span>
                      <span>•</span>
                      <span>Protein: {tmpl.target_protein_g}g</span>
                      <span>•</span>
                      <span>Carbs: {tmpl.target_carbs_g}g</span>
                      <span>•</span>
                      <span>Fat: {tmpl.target_fat_g}g</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTemplatesOpen(false);
                      openNewPlanBuilder(tmpl);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
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

      {/* VIEW PLAN MEALS BREAKDOWN MODAL */}
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

            {/* Daily Macro Targets */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] font-bold uppercase text-amber-600 block">Daily Energy</span>
                <span className="text-lg font-black text-amber-600 font-mono">{viewPlan.target_calories} kcal</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-bold uppercase text-emerald-600 block">Protein</span>
                <span className="text-lg font-black text-emerald-600 font-mono">{viewPlan.target_protein_g}g</span>
              </div>
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] font-bold uppercase text-blue-600 block">Carbs</span>
                <span className="text-lg font-black text-blue-600 font-mono">{viewPlan.target_carbs_g}g</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] font-bold uppercase text-rose-600 block">Fats</span>
                <span className="text-lg font-black text-rose-600 font-mono">{viewPlan.target_fat_g}g</span>
              </div>
            </div>

            {/* Meal Slots List */}
            <div className="space-y-4">
              {(viewPlan.meals || []).map((slot, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#303030] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                      {slot.slot_name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{slot.time_hint}</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {(slot.items || []).map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-[#303030] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{it.food_name}</span>
                          <span className="text-[10px] text-slate-400">Portion: {it.quantity}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-amber-500 block">{it.calories} cals</span>
                          <span className="text-[10px] text-slate-400">
                            P:{it.protein}g • C:{it.carbs}g • F:{it.fat}g
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {viewPlan.notes && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                <strong>Dietary Notes:</strong> {viewPlan.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
