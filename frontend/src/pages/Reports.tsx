import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '../lib/formatters';

export default function Reports() {
  const { t, i18n } = useTranslation();
  const { activeBranchId } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'memberships' | 'attendance' | 'dues' | 'branches' | 'export'>('daily');

  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [membershipData, setMembershipData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [duesData, setDuesData] = useState<any>(null);
  const [branchRevenueData, setBranchRevenueData] = useState<any>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = activeBranchId ? { branch_id: activeBranchId } : {};

      const [resDaily, resMonthly, resMem, resAtt, resDues, resBranch] = await Promise.all([
        api.get('/reports/daily', { params }),
        api.get('/reports/monthly', { params }),
        api.get('/reports/memberships', { params }),
        api.get('/reports/attendance', { params }),
        api.get('/reports/dues', { params }),
        api.get('/reports/branch-revenue'),
      ]);

      setDailyData(resDaily.data);
      setMonthlyData(resMonthly.data);
      setMembershipData(resMem.data);
      setAttendanceData(resAtt.data);
      setDuesData(resDues.data);
      setBranchRevenueData(resBranch.data);
    } catch (err: any) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeBranchId]);

  const handleDownloadCsv = (type: string) => {
    const currentLang = i18n.language || 'en';
    const params = new URLSearchParams();
    if (activeBranchId) params.append('branch_id', activeBranchId.toString());
    params.append('lang', currentLang);
    const queryString = `?${params.toString()}`;

    // Download via direct anchor or blob
    api
      .get(`/reports/export/${type}${queryString}`, { responseType: 'blob' })
      .then((response: any) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `gym_${type}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err: any) => {
        alert('Failed to download CSV export: ' + err.message);
      });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Executive Reports & Analytics Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Server-side audited financial reports, attendance trends, expiry forecasts, and Excel/CSV data exports.
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Reports
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('daily')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'daily'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Daily Business Summary
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'monthly'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Monthly Financial P&L
        </button>
        <button
          onClick={() => setActiveTab('memberships')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'memberships'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Membership Expiry Forecast
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'attendance'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Attendance & Peak Hours
        </button>
        <button
          onClick={() => setActiveTab('dues')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'dues'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Outstanding Dues
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'branches'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Branch Matrix
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'export'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-400" />
          Export CSV / Excel
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center text-xs text-slate-400">Loading audit reports...</div>
      )}

      {/* Tab 1: Daily Business Summary */}
      {!loading && activeTab === 'daily' && dailyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gross Collections Today</span>
              <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
                ₹{Number(dailyData.collections || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Receipts recorded today</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Expenses Paid Today</span>
              <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">
                ₹{Number(dailyData.expenses || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cash & bank vouchers</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Net Cash Flow Today</span>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                ₹{Number(dailyData.net_cash_flow || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Collections minus expenses</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Daily Activity</span>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <div className="text-lg font-bold text-white">{dailyData.total_check_ins || 0}</div>
                  <div className="text-[10px] text-slate-500">Check-ins</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="text-lg font-bold text-emerald-400">{dailyData.new_members || 0}</div>
                  <div className="text-[10px] text-slate-500">New Members</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="text-lg font-bold text-blue-400">{dailyData.new_leads || 0}</div>
                  <div className="text-[10px] text-slate-500">Leads</div>
                </div>
              </div>
            </div>
          </div>

          {/* Collections by Payment Method */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-4">
              Collections by Payment Method (Today)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {['cash', 'upi', 'card', 'bank_transfer', 'cheque'].map((method) => {
                const amt = dailyData.collections_by_method?.[method] || 0;
                return (
                  <div key={method} className="bg-[#131b2e] border border-slate-800 rounded-xl p-3.5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{method.replace('_', ' ')}</span>
                    <span className="text-base font-bold text-white mt-1 block font-mono">
                      ₹{Number(amt).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Monthly Financial P&L */}
      {!loading && activeTab === 'monthly' && monthlyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Month-To-Date Revenue</span>
              <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
                ₹{Number(monthlyData.total_collections || 0).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Month-To-Date Expenses</span>
              <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
                ₹{Number(monthlyData.total_expenses || 0).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Net Operating Profit</span>
              <div className="text-2xl font-black text-white mt-2 font-mono">
                ₹{Number(monthlyData.net_operating_profit || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Daily Trend Table */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                Daily Timeline (Current Month)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Collections</th>
                    <th className="py-2.5 px-4">Expenses</th>
                    <th className="py-2.5 px-4">Net</th>
                    <th className="py-2.5 px-4">Check-ins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {monthlyData.daily_trend?.map((row: any) => {
                    const net = row.collections - row.expenses;
                    return (
                      <tr key={row.date} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-300">{row.day}</td>
                        <td className="py-2.5 px-4 font-mono text-emerald-400">₹{row.collections.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 font-mono text-rose-400">₹{row.expenses.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 px-4 font-mono font-bold ${net >= 0 ? 'text-white' : 'text-rose-400'}`}>
                          ₹{net.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">{row.check_ins} check-ins</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Membership Expiry Forecast */}
      {!loading && activeTab === 'memberships' && membershipData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Active Members</span>
              <div className="text-2xl font-bold text-white mt-1">{membershipData.total_active || 0}</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Expiring in 7 Days</span>
              <div className="text-2xl font-bold text-rose-400 mt-1">{membershipData.expiring_7_days_count || 0}</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Expiring in 15 Days</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">{membershipData.expiring_15_days_count || 0}</div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Frozen Members</span>
              <div className="text-2xl font-bold text-blue-400 mt-1">{membershipData.total_frozen || 0}</div>
            </div>
          </div>

          {/* Members Expiring in 7 Days List */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Urgent Renewal Candidates (Expiring within 7 Days)
              </h3>
            </div>
            {membershipData.expiring_7_days_list?.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No memberships expiring in the next 7 days.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                      <th className="py-2.5 px-4">Member Name</th>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Phone</th>
                      <th className="py-2.5 px-4">Current Package</th>
                      <th className="py-2.5 px-4">Expiry Date</th>
                      <th className="py-2.5 px-4 text-right">Quick Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {membershipData.expiring_7_days_list?.map((row: any) => (
                      <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-white">
                          {row.member?.first_name} {row.member?.last_name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono">{row.member?.member_code}</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">{row.member?.phone}</td>
                        <td className="py-2.5 px-4 text-slate-300">{row.plan?.name}</td>
                        <td className="py-2.5 px-4 text-rose-400 font-mono font-bold">{row.end_date}</td>
                        <td className="py-2.5 px-4 text-right">
                          <a
                            href={`https://wa.me/91${row.member?.phone}?text=Hi%20${row.member?.first_name},%20your%20gym%20membership%20is%20expiring%20on%20${row.end_date}.%20Kindly%20renew%20to%20continue%20your%20workouts!`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                          >
                            WhatsApp Reminder
                          </a>
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

      {/* Tab 4: Attendance Analytics & Peak Hours */}
      {!loading && activeTab === 'attendance' && attendanceData && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-4">
              Gym Floor Hourly Peak Traffic Distribution (Past 30 Days)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {Object.entries(attendanceData.peak_hours || {}).map(([slot, count]: any) => (
                <div key={slot} className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] text-slate-400 font-semibold block">{slot}</span>
                  <span className="text-xl font-bold text-emerald-400 mt-1 block">{count}</span>
                  <span className="text-[9px] text-slate-500">check-ins</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inactive Members List */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Inactive Members (Has active membership, but absent for &gt; 14 Days)
              </h3>
            </div>
            {attendanceData.inactive_members_sample?.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">All active members are consistently checking in!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                      <th className="py-2.5 px-4">Member</th>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Phone</th>
                      <th className="py-2.5 px-4">Package</th>
                      <th className="py-2.5 px-4 text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {attendanceData.inactive_members_sample?.map((m: any) => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-white">{m.first_name} {m.last_name}</td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono">{m.member_code}</td>
                        <td className="py-2.5 px-4 text-slate-300 font-mono">{m.phone}</td>
                        <td className="py-2.5 px-4 text-slate-300">{m.active_membership?.plan?.name || 'Active'}</td>
                        <td className="py-2.5 px-4 text-right">
                          <a
                            href={`https://wa.me/91${m.phone}?text=Hi%20${m.first_name},%20we%20miss%20you%20at%20the%20gym!%20Let%20us%20know%20if%20you%20need%20any%20help%20getting%20back%20on%20track.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                          >
                            Send Motivation
                          </a>
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

      {/* Tab 5: Outstanding Dues Report */}
      {!loading && activeTab === 'dues' && duesData && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm flex justify-between items-center">
            <div>
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
                Total Outstanding Dues Balance
              </span>
              <div className="text-3xl font-black text-rose-400 mt-1 font-mono">
                ₹{Number(duesData.total_dues_amount || 0).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-400 mt-1">Pending payments across all active member accounts</p>
            </div>
            <button
              onClick={() => handleDownloadCsv('dues')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Download Dues CSV
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                    <th className="py-2.5 px-4">Member Name</th>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Phone</th>
                    <th className="py-2.5 px-4">Total Billed</th>
                    <th className="py-2.5 px-4">Total Paid</th>
                    <th className="py-2.5 px-4 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {duesData.members?.data?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-white">{m.first_name} {m.last_name}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono">{m.member_code}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-mono">{m.phone}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-mono">₹{Number(m.total_fees_billed).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 text-emerald-400 font-mono">₹{Number(m.total_fees_paid).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-400">
                        ₹{Number(m.outstanding_balance).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Multi-Branch Revenue Matrix */}
      {!loading && activeTab === 'branches' && branchRevenueData && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">
              Multi-Branch Performance & P&L Matrix (Current Month)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-medium">
                  <th className="py-3 px-4">Branch Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Active Members</th>
                  <th className="py-3 px-4">Gross Collections</th>
                  <th className="py-3 px-4">Overhead Expenses</th>
                  <th className="py-3 px-4 text-right">Net Branch Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {branchRevenueData.matrix?.map((b: any) => (
                  <tr key={b.branch_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{b.name}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{b.code}</td>
                    <td className="py-3 px-4 text-slate-300">{b.city || 'Mumbai'}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{b.active_members} members</td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">₹{Number(b.collections).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-mono text-rose-400 font-semibold">₹{Number(b.expenses).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      ₹{Number(b.net_profit).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Export CSV Center */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Members Database</h3>
                <p className="text-[11px] text-slate-400">All registered gym members with codes & balances</p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadCsv('members')}
              className="w-full bg-[#131b2e] hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/40 text-slate-200 hover:text-emerald-400 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Members CSV
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Payments Ledger</h3>
                <p className="text-[11px] text-slate-400">All payment receipts, refunds, and payment modes</p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadCsv('payments')}
              className="w-full bg-[#131b2e] hover:bg-blue-500/15 border border-slate-700 hover:border-blue-500/40 text-slate-200 hover:text-blue-400 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Payments CSV
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Expenses Log</h3>
                <p className="text-[11px] text-slate-400">Categorized operational overhead vouchers</p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadCsv('expenses')}
              className="w-full bg-[#131b2e] hover:bg-rose-500/15 border border-slate-700 hover:border-rose-500/40 text-slate-200 hover:text-rose-400 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Expenses CSV
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Leads & CRM Enquiries</h3>
                <p className="text-[11px] text-slate-400">Enquiries, follow-ups, trial status, and sources</p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadCsv('leads')}
              className="w-full bg-[#131b2e] hover:bg-purple-500/15 border border-slate-700 hover:border-purple-500/40 text-slate-200 hover:text-purple-400 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Leads CSV
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Overdue Dues Ledger</h3>
                <p className="text-[11px] text-slate-400">Pending collections and debtor member list</p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadCsv('dues')}
              className="w-full bg-[#131b2e] hover:bg-amber-500/15 border border-slate-700 hover:border-amber-500/40 text-slate-200 hover:text-amber-400 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Dues CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
