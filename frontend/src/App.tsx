import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import Attendance from './pages/Attendance';
import Billing from './pages/Billing';
import Branches from './pages/Branches';
import CashClosing from './pages/CashClosing';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Leads from './pages/Leads';
import Login from './pages/Login';
import Members from './pages/Members';
import MembershipPlans from './pages/MembershipPlans';
import Payments from './pages/Payments';
import PlanExpired from './pages/PlanExpired';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Staff from './pages/Staff';
import Trainers from './pages/Trainers';
import AdminDashboard from './pages/admin/AdminDashboard';

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Super Admin Platform Plane
  if (user.role === 'super_admin') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // Expired Gym Lockdown (billing screen remains accessible so owners can pay and renew)
  if (user.gym?.expired) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/billing" element={<Billing />} />
          <Route path="*" element={<PlanExpired />} />
        </Route>
      </Routes>
    );
  }

  const isOwner = user.role === 'gym_owner';
  const isManager = user.role === 'branch_manager';
  const canManageBranches = isOwner || isManager;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/members" element={<Members />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/cash-closing" element={<CashClosing />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/plans" element={<MembershipPlans />} />
        <Route path="/trainers" element={<Trainers />} />
        <Route path="/reports" element={<Reports />} />
        {canManageBranches && <Route path="/branches" element={<Branches />} />}
        {canManageBranches && <Route path="/staff" element={<Staff />} />}
        {isOwner && <Route path="/billing" element={<Billing />} />}
        {isOwner && <Route path="/settings" element={<Settings />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
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
