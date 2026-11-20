import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Check,
  Dumbbell,
  PauseCircle,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface MembershipPlan {
  id: number;
  name: string;
  code?: string;
  category?: string;
  plan_type?: string;
  duration_days: number;
  price: number;
  admission_fee: number;
  tax_percent: number;
  pt_sessions_count?: number;
  max_freeze_days?: number;
  description?: string;
  is_active: boolean;
  member_memberships_count?: number;
}

export default function MembershipPlans() {
  const { t } = useTranslation();
  const { activeBranchId } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('monthly');
  const [planType, setPlanType] = useState('regular');
  const [durationDays, setDurationDays] = useState('30');
  const [price, setPrice] = useState('');
  const [admissionFee, setAdmissionFee] = useState('0');
  const [ptSessionsCount, setPtSessionsCount] = useState('0');
  const [maxFreezeDays, setMaxFreezeDays] = useState('15');
  const [description, setDescription] = useState('');

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get<MembershipPlan[]>('/membership-plans');
      setPlans(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/membership-plans', {
        name,
        category,
        plan_type: planType,
        duration_days: parseInt(durationDays, 10),
        price: parseFloat(price),
        admission_fee: parseFloat(admissionFee || '0'),
        pt_sessions_count: parseInt(ptSessionsCount, 10) || 0,
        max_freeze_days: parseInt(maxFreezeDays, 10) || 0,
        description,
        branch_id: activeBranchId,
      });
      setModalOpen(false);
      resetForm();
      fetchPlans();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('monthly');
    setPlanType('regular');
    setDurationDays('30');
    setPrice('');
    setAdmissionFee('0');
    setPtSessionsCount('0');
    setMaxFreezeDays('15');
    setDescription('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this package?')) return;
    try {
      await api.delete(`/membership-plans/${id}`);
      fetchPlans();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-emerald-400" />
            <span>{t('memberships.title', 'Membership Packages & Pricing')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('memberships.subtitle', 'Monthly, Quarterly, Annual, PT Packages, Trials, Day Passes, and Freeze policies')}
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
          <span>{t('memberships.add_plan', 'Create Package')}</span>
        </button>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-xl"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <span className="text-[10px] font-semibold tracking-wider text-emerald-400 uppercase mt-0.5 block">
                    {plan.category ? plan.category.replace('_', ' ') : `${plan.duration_days} Days`}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="my-4 pb-4 border-b border-slate-800">
                <span className="text-3xl font-black text-white font-mono">
                  ₹{Number(plan.price).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">/ {plan.duration_days} days</span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Validity: {plan.duration_days} Days</span>
                </div>

                {Number(plan.pt_sessions_count) > 0 && (
                  <div className="flex items-center gap-2 text-purple-400 font-medium">
                    <Zap className="w-4 h-4 shrink-0" />
                    <span>Includes {plan.pt_sessions_count} PT Sessions</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-slate-400">
                  <PauseCircle className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Max Freeze: {plan.max_freeze_days || 0} Days</span>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{plan.member_memberships_count || 0} enrolled members</span>
                </div>
              </div>

              {plan.description && (
                <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-800/80 line-clamp-2">
                  {plan.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Plan Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Create Membership Package</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Package Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3-Month Transformation Beast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const c = e.target.value;
                      setCategory(c);
                      if (c === 'monthly') setDurationDays('30');
                      else if (c === 'quarterly') setDurationDays('90');
                      else if (c === 'half_yearly') setDurationDays('180');
                      else if (c === 'annual') setDurationDays('365');
                      else if (c === 'trial') setDurationDays('7');
                      else if (c === 'day_pass') setDurationDays('1');
                    }}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (3 Mo)</option>
                    <option value="half_yearly">Half-Yearly (6 Mo)</option>
                    <option value="annual">Annual (1 Year)</option>
                    <option value="pt_package">Personal Training Package</option>
                    <option value="trial">Trial Pass</option>
                    <option value="day_pass">Day Pass</option>
                    <option value="corporate">Corporate</option>
                    <option value="family">Family</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="2500"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Max Freeze Days</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="15"
                    value={maxFreezeDays}
                    onChange={(e) => setMaxFreezeDays(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {category === 'pt_package' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Number of PT Sessions Included</label>
                  <input
                    type="number"
                    min="1"
                    value={ptSessionsCount}
                    onChange={(e) => setPtSessionsCount(e.target.value)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description / Perks</label>
                <textarea
                  rows={2}
                  placeholder="Includes locker, steam room access, free diet consultation..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Save Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
