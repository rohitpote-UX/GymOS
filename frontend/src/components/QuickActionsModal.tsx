import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarCheck,
  PlusCircle,
  Receipt,
  ShoppingCart,
  TrendingDown,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const actions = [
    {
      id: 'add_member',
      title: t('quickActions.add_member', 'Add New Member'),
      description: t('quickActions.add_member_desc', 'Register athlete profile, assign plan and issue ID'),
      icon: UserPlus,
      to: '/members?action=new',
      color: 'emerald',
    },
    {
      id: 'mark_attendance',
      title: t('quickActions.mark_attendance', 'Mark / Scan Attendance'),
      description: t('quickActions.mark_attendance_desc', 'Front desk QR code scanner and quick manual lookup'),
      icon: CalendarCheck,
      to: '/attendance',
      color: 'blue',
    },
    {
      id: 'collect_payment',
      title: t('quickActions.collect_payment', 'Collect Payment / Due'),
      description: t('quickActions.collect_payment_desc', 'Receive cash, UPI, card or adjust outstanding ledger'),
      icon: Receipt,
      to: '/payments?action=new',
      color: 'amber',
    },
    {
      id: 'new_pos_sale',
      title: t('quickActions.new_pos_sale', 'Record Retail POS Sale'),
      description: t('quickActions.new_pos_sale_desc', 'Barcode checkout for protein, shakers and gym gear'),
      icon: ShoppingCart,
      to: '/pos',
      color: 'purple',
    },
    {
      id: 'add_expense',
      title: t('quickActions.add_expense', 'Log Gym Expense'),
      description: t('quickActions.add_expense_desc', 'Record facility overheads, utilities, salaries & maintenance'),
      icon: TrendingDown,
      to: '/expenses',
      color: 'rose',
    },
  ];

  const handleAction = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl shadow-emerald-950/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {t('quickActions.title', 'Quick Actions')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('quickActions.subtitle', 'Instant shortcuts for everyday reception and gym workflows')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Grid */}
        <div className="p-4 space-y-2">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => handleAction(act.to)}
                className="w-full p-3 rounded-xl bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/30 transition-all flex items-center gap-3.5 text-left group cursor-pointer"
              >
                <div className={`p-2.5 rounded-xl bg-slate-800 group-hover:bg-emerald-500/10 border border-slate-700/60 group-hover:border-emerald-500/30 transition-colors shrink-0`}>
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    {act.title}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {act.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
