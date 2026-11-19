import React from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  Coins,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  Users,
} from 'lucide-react';
import { UserInfo } from '../context/AuthContext';

export interface NavSubItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string | null;
  roles?: string[];
}

export interface NavDestination {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  module?: string | null;
  roles?: string[];
  subItems?: NavSubItem[];
}

export const NAVIGATION_DESTINATIONS: NavDestination[] = [
  // 1. Overview
  {
    id: 'overview',
    labelKey: 'nav.group_overview',
    defaultLabel: 'Overview',
    icon: LayoutDashboard,
    to: '/',
    module: 'overview',
    roles: ['super_admin', 'gym_owner', 'branch_manager'],
    subItems: [
      {
        id: 'overview_dashboard',
        labelKey: 'nav.dashboard',
        defaultLabel: 'Executive Dashboard',
        to: '/',
        icon: LayoutDashboard,
      },
      {
        id: 'overview_action_center',
        labelKey: 'nav.action_center',
        defaultLabel: 'Action Center',
        to: '/action-center',
        icon: ShieldAlert,
      },
    ],
  },

  // 2. Members
  {
    id: 'members',
    labelKey: 'nav.group_members',
    defaultLabel: 'Members',
    icon: Users,
    to: '/members',
    module: 'members',
    roles: ['super_admin', 'gym_owner', 'branch_manager', 'receptionist', 'front_desk', 'trainer'],
    subItems: [
      {
        id: 'members_directory',
        labelKey: 'nav.members',
        defaultLabel: 'Member Directory',
        to: '/members',
        icon: Users,
      },
      {
        id: 'members_plans',
        labelKey: 'common.memberships',
        defaultLabel: 'Membership Plans',
        to: '/plans',
        icon: Dumbbell,
        roles: ['super_admin', 'gym_owner', 'branch_manager'],
      },
      {
        id: 'members_pass',
        labelKey: 'nav.member_portal',
        defaultLabel: 'Digital Pass Portal',
        to: '/portal',
        icon: User,
        roles: ['super_admin', 'gym_owner', 'member'],
      },
    ],
  },

  // 3. Attendance
  {
    id: 'attendance',
    labelKey: 'nav.group_attendance',
    defaultLabel: 'Attendance',
    icon: CalendarCheck,
    to: '/attendance',
    module: 'attendance',
    roles: ['super_admin', 'gym_owner', 'branch_manager', 'receptionist', 'front_desk', 'trainer'],
    subItems: [
      {
        id: 'attendance_checkin',
        labelKey: 'attendance.check_in',
        defaultLabel: 'Check-in Desk & QR',
        to: '/attendance',
        icon: CalendarCheck,
      },
    ],
  },

  // 4. Finance
  {
    id: 'finance',
    labelKey: 'nav.group_finance',
    defaultLabel: 'Finance',
    icon: Coins,
    to: '/payments',
    module: 'finance',
    roles: ['super_admin', 'gym_owner', 'branch_manager', 'accountant', 'receptionist', 'front_desk'],
    subItems: [
      {
        id: 'finance_payments',
        labelKey: 'nav.payments',
        defaultLabel: 'Fee Collections & Dues',
        to: '/payments',
        icon: Receipt,
      },
      {
        id: 'finance_cash_closing',
        labelKey: 'nav.cash_closing',
        defaultLabel: 'Daily Cash Closing',
        to: '/cash-closing',
        icon: Coins,
      },
      {
        id: 'finance_expenses',
        labelKey: 'nav.expenses',
        defaultLabel: 'Expenses Management',
        to: '/expenses',
        icon: TrendingDown,
        roles: ['super_admin', 'gym_owner', 'branch_manager', 'accountant'],
      },
      {
        id: 'finance_reports',
        labelKey: 'nav.reports',
        defaultLabel: 'Financial Reports',
        to: '/reports',
        icon: BarChart3,
        roles: ['super_admin', 'gym_owner', 'branch_manager', 'accountant'],
      },
    ],
  },

  // 5. Sales & Inventory
  {
    id: 'pos_inventory',
    labelKey: 'nav.group_pos_inventory',
    defaultLabel: 'Sales & Inventory',
    icon: Package,
    to: '/pos',
    module: 'pos_inventory',
    roles: ['super_admin', 'gym_owner', 'branch_manager', 'inventory_manager', 'receptionist', 'front_desk', 'accountant'],
    subItems: [
      {
        id: 'sales_pos',
        labelKey: 'nav.pos',
        defaultLabel: 'Supplement POS',
        to: '/pos',
        icon: ShoppingCart,
      },
      {
        id: 'inventory_master',
        labelKey: 'nav.inventory',
        defaultLabel: 'Products & Stock',
        to: '/inventory',
        icon: Package,
        roles: ['super_admin', 'gym_owner', 'branch_manager', 'inventory_manager'],
      },
      {
        id: 'inventory_purchases',
        labelKey: 'common.suppliers',
        defaultLabel: 'Purchases & Suppliers',
        to: '/purchases',
        icon: Truck,
        roles: ['super_admin', 'gym_owner', 'branch_manager', 'inventory_manager', 'accountant'],
      },
      {
        id: 'inventory_profitability',
        labelKey: 'common.finance',
        defaultLabel: 'Profitability & COGS',
        to: '/profitability',
        icon: TrendingUp,
        roles: ['super_admin', 'gym_owner', 'branch_manager', 'inventory_manager', 'accountant'],
      },
    ],
  },

  // 6. Growth & Leads
  {
    id: 'growth_leads',
    labelKey: 'nav.group_growth_leads',
    defaultLabel: 'Growth & Leads',
    icon: Target,
    to: '/leads',
    module: 'leads_crm',
    roles: ['super_admin', 'gym_owner', 'branch_manager', 'receptionist', 'front_desk'],
    subItems: [
      {
        id: 'leads_crm_pipeline',
        labelKey: 'nav.leads',
        defaultLabel: 'Leads CRM',
        to: '/leads',
        icon: Target,
      },
      {
        id: 'growth_whatsapp',
        labelKey: 'nav.whatsapp',
        defaultLabel: 'WhatsApp Automation',
        to: '/whatsapp',
        icon: MessageCircle,
        module: 'whatsapp',
      },
    ],
  },

  // 7. AI Advisor
  {
    id: 'ai_advisor',
    labelKey: 'nav.group_ai_advisor',
    defaultLabel: 'AI Business Advisor',
    icon: Sparkles,
    to: '/ai-advisor',
    module: 'ai_advisor',
    roles: ['super_admin', 'gym_owner', 'branch_manager'],
    subItems: [],
  },

  // 8. More & Settings
  {
    id: 'more_settings',
    labelKey: 'nav.group_more_settings',
    defaultLabel: 'More & Settings',
    icon: SlidersHorizontal,
    to: '/settings',
    roles: ['super_admin', 'gym_owner', 'branch_manager', 'trainer'],
    subItems: [
      {
        id: 'more_staff',
        labelKey: 'common.staff',
        defaultLabel: 'Staff & Roles',
        to: '/staff',
        icon: ShieldCheck,
        roles: ['super_admin', 'gym_owner', 'branch_manager'],
      },
      {
        id: 'more_trainers',
        labelKey: 'trainers.title',
        defaultLabel: 'Trainers & PT',
        to: '/trainers',
        icon: Dumbbell,
        module: 'pt_trainers',
        roles: ['super_admin', 'gym_owner', 'branch_manager'],
      },
      {
        id: 'more_trainer_workspace',
        labelKey: 'nav.trainer_portal',
        defaultLabel: 'Trainer Workspace',
        to: '/trainer-portal',
        icon: Activity,
        module: 'pt_trainers',
        roles: ['super_admin', 'gym_owner', 'trainer'],
      },
      {
        id: 'more_branches',
        labelKey: 'common.branches',
        defaultLabel: 'Branch Management',
        to: '/branches',
        icon: Building2,
        roles: ['super_admin', 'gym_owner', 'branch_manager'],
      },
      {
        id: 'more_support',
        labelKey: 'nav.support',
        defaultLabel: 'Support Desk',
        to: '/support',
        icon: LifeBuoy,
      },
      {
        id: 'more_billing',
        labelKey: 'auth.plan',
        defaultLabel: 'Plan & Billing',
        to: '/billing',
        icon: CreditCard,
        roles: ['super_admin', 'gym_owner'],
      },
      {
        id: 'more_settings_page',
        labelKey: 'nav.settings',
        defaultLabel: 'Gym Settings',
        to: '/settings',
        icon: Settings,
        roles: ['super_admin', 'gym_owner'],
      },
    ],
  },
];

/**
 * Filter destinations based on user role and active gym modules.
 */
export function getFilteredNavigation(user: UserInfo | null): NavDestination[] {
  if (!user) return [];

  // Dedicated member role view
  if (user.role === 'member') {
    return [
      {
        id: 'member_pass',
        labelKey: 'nav.member_portal',
        defaultLabel: 'Digital Pass',
        icon: User,
        to: '/portal',
        subItems: [],
      },
      {
        id: 'member_support',
        labelKey: 'nav.support',
        defaultLabel: 'Support Tickets',
        icon: LifeBuoy,
        to: '/support',
        subItems: [],
      },
    ];
  }

  // Active modules configured on the gym tenant (if undefined, default to true)
  const gymActiveModules = user.gym?.modules;

  const isModuleActive = (moduleKey?: string | null): boolean => {
    if (!moduleKey || moduleKey === 'overview' || moduleKey === 'members') return true;
    if (!gymActiveModules) return true; // Inherit default if not specifically customized
    return gymActiveModules.includes(moduleKey);
  };

  const isRoleAllowed = (allowedRoles?: string[]): boolean => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(user.role);
  };

  return NAVIGATION_DESTINATIONS.filter((dest) => {
    // Check destination role
    if (!isRoleAllowed(dest.roles)) return false;

    // Check destination module
    if (!isModuleActive(dest.module)) return false;

    return true;
  }).map((dest) => {
    if (!dest.subItems || dest.subItems.length === 0) {
      return dest;
    }

    const filteredSubItems = dest.subItems.filter((sub) => {
      if (!isRoleAllowed(sub.roles)) return false;
      if (!isModuleActive(sub.module)) return false;
      return true;
    });

    return {
      ...dest,
      subItems: filteredSubItems,
    };
  }).filter((dest) => {
    // If a destination was configured with sub-items, but all were filtered out, hide destination
    if (dest.subItems && dest.subItems.length === 0 && dest.id !== 'ai_advisor') {
      return false;
    }
    return true;
  });
}
