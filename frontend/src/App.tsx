import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import ActionCenter from './pages/ActionCenter';
import AiAdvisor from './pages/AiAdvisor';
import Attendance from './pages/Attendance';
import Billing from './pages/Billing';
import Branches from './pages/Branches';
import CashClosing from './pages/CashClosing';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Inventory from './pages/Inventory';
import Leads from './pages/Leads';
import Login from './pages/Login';
import MemberPortal from './pages/MemberPortal';
import Members from './pages/Members';
import MembershipPlans from './pages/MembershipPlans';
import Payments from './pages/Payments';
import PlanExpired from './pages/PlanExpired';
import Pos from './pages/Pos';
import Profitability from './pages/Profitability';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import SupportTickets from './pages/SupportTickets';
import TrainerPortal from './pages/TrainerPortal';
import Trainers from './pages/Trainers';
import WhatsAppAutomation from './pages/WhatsAppAutomation';
import SelfCheckIn from './pages/SelfCheckIn';
import AdminDashboard from './pages/admin/AdminDashboard';

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public QR Self-Attendance Endpoints (Camera Scan / PWA) */}
      <Route path="/check-in/:token" element={<SelfCheckIn />} />
      <Route path="/self-check-in/:token" element={<SelfCheckIn />} />

      {!user ? (
        <Route path="*" element={<Login />} />
      ) : user.role === 'super_admin' ? (
        <>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </>
      ) : user.gym?.expired ? (
        <Route element={<Layout />}>
          <Route path="/billing" element={<Billing />} />
          <Route path="*" element={<PlanExpired />} />
        </Route>
      ) : user.role === 'member' ? (
        <Route element={<Layout />}>
          <Route path="/portal" element={<MemberPortal />} />
          <Route path="/support" element={<SupportTickets />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Route>
      ) : user.role === 'trainer' ? (
        <Route element={<Layout />}>
          <Route path="/trainer-portal" element={<TrainerPortal />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/members" element={<Members />} />
          <Route path="/support" element={<SupportTickets />} />
          <Route path="*" element={<Navigate to="/trainer-portal" replace />} />
        </Route>
      ) : (
        /* Regular Staff & Owner Dashboard Routes */
        <Route element={<Layout />}>
          {/* Core BI & Action Center */}
          <Route index element={<Dashboard />} />
          <Route path="/action-center" element={<ActionCenter />} />
          <Route path="/ai-advisor" element={<AiAdvisor />} />
          <Route path="/whatsapp" element={<WhatsAppAutomation />} />
          <Route path="/support" element={<SupportTickets />} />

          {/* Portals (cross-accessible to owners & managers for testing/preview) */}
          <Route path="/portal" element={<MemberPortal />} />
          <Route path="/trainer-portal" element={<TrainerPortal />} />

          {/* Operational Modules */}
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/members" element={<Members />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/profitability" element={<Profitability />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/cash-closing" element={<CashClosing />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/plans" element={<MembershipPlans />} />
          <Route path="/trainers" element={<Trainers />} />
          <Route path="/reports" element={<Reports />} />

          {/* Branch & Staff Admin */}
          {(user.role === 'gym_owner' || user.role === 'branch_manager') && (
            <>
              <Route path="/branches" element={<Branches />} />
              <Route path="/staff" element={<Staff />} />
            </>
          )}

          {/* Tenant Settings & Plan */}
          {user.role === 'gym_owner' && (
            <>
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
