import React from 'react';
import { Clock, CreditCard, Dumbbell, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const PlanExpired: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#090d16] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0f172a] border border-amber-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight">Subscription Plan Ended</h1>
          <p className="text-sm text-slate-400 mt-2">
            The subscription license for <strong className="text-white">{user?.gym?.name}</strong> has expired. All gym member records and attendance data are safely preserved.
          </p>
        </div>

        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-300">
          <p>
            Please renew your plan to resume front-desk check-in, fee collections, and WhatsApp messaging.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/billing"
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-950/40"
          >
            <CreditCard className="w-4 h-4" />
            <span>Renew Plan via Razorpay</span>
          </Link>

          <button
            onClick={() => logout()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanExpired;
