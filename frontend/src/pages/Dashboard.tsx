import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Dumbbell,
  MessageCircle,
  Plus,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { openWhatsApp, WhatsAppTemplates } from '../lib/whatsapp';

interface DashboardData {
  metrics: {
    total_members: number;
    active_members: number;
    today_check_ins: number;
    currently_inside: number;
    today_revenue: number;
    monthly_revenue: number;
  };
  expiring_soon: Array<{
    id: number;
    end_date: string;
    member: {
      id: number;
      first_name: string;
      last_name: string;
      phone: string;
      member_code: string;
    };
    plan: {
      id: number;
      name: string;
    };
  }>;
  recent_payments: Array<{
    id: number;
    receipt_number: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    member: {
      id: number;
      first_name: string;
      last_name: string;
      member_code: string;
    };
    branch: {
      id: number;
      name: string;
    };
  }>;
  branches: Array<{
    id: number;
    name: string;
    code?: string;
    members_count: number;
    staff_count: number;
  }>;
}

export const Dashboard: React.FC = () => {
  const { user, activeBranch, activeBranchId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get<DashboardData>('/dashboard');
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeBranchId]);

  const sendWhatsAppReminder = (item: DashboardData['expiring_soon'][0]) => {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(item.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    );

    const message = WhatsAppTemplates.membershipExpiring({
      gymName: user?.gym?.name || 'Our Gym',
      memberName: `${item.member.first_name} ${item.member.last_name || ''}`.trim(),
      planName: item.plan?.name || 'Standard Package',
      expiryDate: item.end_date,
      daysLeft,
    });

    openWhatsApp(item.member.phone, message);
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Executive Dashboard</span>
            {activeBranch && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-semibold">
                {activeBranch.name}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-tenant operations, member check-ins & fee collections
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/attendance"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Check-in Member</span>
          </Link>
          <Link
            to="/members"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>New Member</span>
          </Link>
          <Link
            to="/payments"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Collect Fee</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Active Members */}
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Members</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-white">
              {data?.metrics.active_members || 0}
            </span>
            <span className="text-xs text-slate-400">/ {data?.metrics.total_members || 0} enrolled</span>
          </div>
          <div className="mt-2 flex items-center text-[11px] text-emerald-400 gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>Healthy retention</span>
          </div>
        </div>

        {/* Live Attendance */}
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Floor Occupancy</span>
            <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black text-white">
              {data?.metrics.currently_inside || 0}
            </span>
            <span className="text-xs text-slate-400">inside right now</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {data?.metrics.today_check_ins || 0} total workouts today
          </div>
        </div>

        {/* Today's Collection */}
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Today's Revenue</span>
            <CreditCard className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-slate-400 font-semibold">₹</span>
            <span className="text-2xl md:text-3xl font-black text-white">
              {data?.metrics.today_revenue?.toLocaleString('en-IN') || 0}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 font-medium">
            Cash & UPI settlements
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-[#0f172a] border border-slate-800 p-4 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Month to Date</span>
            <Receipt className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-slate-400 font-semibold">₹</span>
            <span className="text-2xl md:text-3xl font-black text-white">
              {data?.metrics.monthly_revenue?.toLocaleString('en-IN') || 0}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Current billing cycle
          </div>
        </div>
      </div>

      {/* Lower Section: Expiring Memberships & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expiring Memberships (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Expiring Memberships (Next 7 Days)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Trigger 1-click WhatsApp renewal alerts to secure member continuity
              </p>
            </div>
            <Link to="/members" className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {data?.expiring_soon && data.expiring_soon.length > 0 ? (
            <div className="divide-y divide-slate-800/80">
              {data.expiring_soon.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                      {item.member.first_name[0]}
                      {item.member.last_name?.[0] || ''}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {item.member.first_name} {item.member.last_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          {item.member.member_code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.plan?.name} • Expires {item.end_date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sendWhatsAppReminder(item)}
                      title="Send WhatsApp Renewal Alert"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                    <Link
                      to="/payments"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium"
                    >
                      Renew
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
              <p>No memberships expiring in the next 7 days.</p>
            </div>
          )}
        </div>

        {/* Recent Payments Ledger (1 Col) */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                <span>Recent Payments</span>
              </h3>
              <p className="text-[11px] text-slate-400">Latest transactions</p>
            </div>
            <Link to="/payments" className="text-xs font-semibold text-emerald-400 hover:underline">
              Ledger
            </Link>
          </div>

          {data?.recent_payments && data.recent_payments.length > 0 ? (
            <div className="space-y-3">
              {data.recent_payments.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">
                      {p.member.first_name} {p.member.last_name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {p.receipt_number} • <span className="uppercase text-slate-300">{p.payment_method}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">₹{p.amount?.toLocaleString('en-IN')}</span>
                    <p className="text-[10px] text-slate-500">{p.payment_date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-500 text-xs">
              <Receipt className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p>No payment records yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
