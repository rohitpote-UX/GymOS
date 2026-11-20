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
      color: 'red',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1C1C1C] border border-[#E8E8E8] dark:border-[#303030] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E8E8E8] dark:border-[#303030] flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#D92332]/10 dark:bg-[#F02D3A]/15 border border-[#D92332]/20 dark:border-[#F02D3A]/20 rounded-xl">
              <Zap className="w-4 h-4 text-[#D92332] dark:text-[#F02D3A]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#171717] dark:text-white">
                {t('quickActions.title', 'Quick Actions')}
              </h2>
              <p className="text-[11px] text-[#707070] dark:text-[#A3A3A3]">
                {t('quickActions.subtitle', 'Instant shortcuts for everyday reception and gym workflows')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#707070] dark:text-[#A3A3A3] hover:text-[#171717] dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
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
                className="w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 border border-[#E8E8E8] dark:border-[#303030] hover:border-[#D92332]/30 dark:hover:border-[#F02D3A]/30 transition-all flex items-center gap-3.5 text-left group cursor-pointer"
              >
                <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 group-hover:bg-[#D92332]/10 dark:group-hover:bg-[#F02D3A]/15 border border-[#E8E8E8] dark:border-[#303030] group-hover:border-[#D92332]/30 dark:group-hover:border-[#F02D3A]/30 transition-colors shrink-0">
                  <Icon className="w-5 h-5 text-[#D92332] dark:text-[#F02D3A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#171717] dark:text-white group-hover:text-[#D92332] dark:group-hover:text-[#F02D3A] transition-colors">
                    {act.title}
                  </div>
                  <div className="text-[11px] text-[#707070] dark:text-[#A3A3A3] truncate mt-0.5">
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
