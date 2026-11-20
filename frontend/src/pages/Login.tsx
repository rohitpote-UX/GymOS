import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Dumbbell, Lock, Mail, Phone, ShieldCheck, Sparkles, User, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errorMessage, takeLogoutReason } from '../api/client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeSwitcher } from '../components/ThemeSwitcher';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { login, registerGym } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginId, setLoginId] = useState('owner@ironcore.in');
  const [password, setPassword] = useState('password123');
  const [remember, setRemember] = useState(true);

  // Register form state
  const [gymName, setGymName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [branchName, setBranchName] = useState('Main Branch');
  const [city, setCity] = useState('Mumbai');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => takeLogoutReason());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginId, password, remember);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await registerGym({
        gym_name: gymName,
        owner_name: ownerName,
        email,
        phone,
        password: regPassword,
        password_confirmation: regPasswordConfirm,
        branch_name: branchName,
        city,
      });
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (id: string, pass: string) => {
    setLoginId(id);
    setPassword(pass);
    setTab('login');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gym-main flex items-center justify-center p-4 md:p-8 transition-colors duration-200">
      <div className="w-full max-w-md bg-gym-card border border-gym rounded-2xl shadow-2xl p-6 md:p-8 backdrop-blur-xl">
        {/* Top Controls Bar: Language + Theme Toggle */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gym">
          <LanguageSwitcher variant="pill" />
          <ThemeSwitcher variant="pill" />
        </div>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#D92332] to-[#B91C2B] dark:from-[#F02D3A] dark:to-[#FF4652] text-white mb-3 shadow-lg shadow-red-600/30">
            <Dumbbell className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-gym-primary tracking-tight">
            {t('common.app_title', 'Gym Business OS')}
          </h1>
          <p className="text-xs text-gym-secondary mt-1">
            {t('auth.login_subtitle', 'Multi-tenant Gym Management & Growth Engine')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gym-main p-1 rounded-xl mb-6 border border-gym">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-gym-red text-white shadow-sm'
                : 'text-gym-secondary hover:text-gym-primary'
            }`}
          >
            {t('auth.sign_in', 'Sign In')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-gym-red text-white shadow-sm'
                : 'text-gym-secondary hover:text-gym-primary'
            }`}
          >
            {t('auth.register_gym', 'Register Gym')}
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gym-secondary mb-1">
                {t('auth.login_label', 'Email or 10-Digit Mobile Number')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gym-secondary absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder={t('auth.login_placeholder', 'owner@olympia.fit or 9820098200')}
                  className="w-full bg-gym-input border border-gym rounded-xl pl-9 pr-3 py-2.5 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gym-secondary mb-1">
                {t('auth.password', 'Password')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gym-secondary absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password_placeholder', '••••••••')}
                  className="w-full bg-gym-input border border-gym rounded-xl pl-9 pr-3 py-2.5 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-gym-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gym bg-gym-input accent-[#D92332] dark:accent-[#F02D3A]"
                />
                {t('auth.remember_me', 'Remember this device')}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gym-red hover:bg-[#B91C2B] dark:hover:bg-[#FF4652] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-red-600/25"
            >
              {loading ? t('common.loading', 'Signing in...') : t('auth.sign_in', 'Sign In')}
            </button>

            {/* Quick Demo Credentials */}
            <div className="pt-4 border-t border-gym mt-6">
              <p className="text-[11px] font-semibold text-gym-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3 text-gym-red" /> Demo Quick Login:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => fillDemo('owner@ironcore.in', 'password123')}
                  className="p-2 rounded-lg bg-gym-main hover:bg-gym-card text-gym-primary text-left border border-gym transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gym-red block">Gym Owner</span>
                  <span className="text-[10px] text-gym-secondary">owner@ironcore.in</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('manager@ironcore.in', 'password123')}
                  className="p-2 rounded-lg bg-gym-main hover:bg-gym-card text-gym-primary text-left border border-gym transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gym-red block">Branch Manager</span>
                  <span className="text-[10px] text-gym-secondary">manager@ironcore.in</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('reception@ironcore.in', 'password123')}
                  className="p-2 rounded-lg bg-gym-main hover:bg-gym-card text-gym-primary text-left border border-gym transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-sky-500 block">Front Desk</span>
                  <span className="text-[10px] text-gym-secondary">reception@ironcore.in</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('admin@gymbusinessos.com', 'password123')}
                  className="p-2 rounded-lg bg-gym-main hover:bg-gym-card text-gym-primary text-left border border-gym transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-purple-500 block">Super Admin</span>
                  <span className="text-[10px] text-gym-secondary">admin@gymbusinessos.com</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-gym-secondary mb-1">
                {t('auth.gym_name', 'Gym / Brand Name')}
              </label>
              <div className="relative">
                <Dumbbell className="w-4 h-4 text-gym-secondary absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={gymName}
                  onChange={(e) => setGymName(e.target.value)}
                  placeholder="e.g. Spartan Strength Club"
                  className="w-full bg-gym-input border border-gym rounded-xl pl-9 pr-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gym-secondary mb-1">
                {t('auth.owner_name', 'Owner Full Name')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gym-secondary absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full bg-gym-input border border-gym rounded-xl pl-9 pr-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gym-secondary mb-1">
                  {t('auth.email', 'Email Address')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@gym.in"
                  className="w-full bg-gym-input border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gym-secondary mb-1">
                  {t('auth.phone', 'Mobile Number')}
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9820011223"
                  className="w-full bg-gym-input border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gym-secondary mb-1">
                  {t('members.assigned_branch', 'First Branch Name')}
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Main Branch"
                  className="w-full bg-gym-input border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gym-secondary mb-1">
                  {t('auth.city', 'City')}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai"
                  className="w-full bg-gym-input border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gym-secondary mb-1">
                  {t('auth.password', 'Password')}
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gym-input border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gym-secondary mb-1">
                  {t('auth.password', 'Confirm Password')}
                </label>
                <input
                  type="password"
                  required
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gym-input border border-gym rounded-xl px-3 py-2 text-xs text-gym-primary placeholder:text-gym-secondary focus:outline-none focus:border-gym-red"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gym-red hover:bg-[#B91C2B] dark:hover:bg-[#FF4652] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4 shadow-lg shadow-red-600/25"
            >
              {loading ? t('common.loading', 'Creating Gym OS...') : t('auth.create_account', 'Start 14-Day Free Trial')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
