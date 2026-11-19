import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building,
  Check,
  CheckCircle2,
  Globe,
  Image,
  Layers,
  Lock,
  Palette,
  Save,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

export const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, refreshMe, setLanguage } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Settings State
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [taxRate, setTaxRate] = useState('18');
  const [tagline, setTagline] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [accentColor, setAccentColor] = useState('#10b981');

  // Module Configuration State
  const [modulesLoading, setModulesLoading] = useState(false);
  const [allModules, setAllModules] = useState<
    Record<string, { key: string; name: string; description: string; is_core: boolean; dependencies: string[] }>
  >({});
  const [entitledModules, setEntitledModules] = useState<string[]>([]);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [modulesSaving, setModulesSaving] = useState(false);

  const fetchModules = async () => {
    try {
      setModulesLoading(true);
      const res = await api.get('/settings/modules');
      setAllModules(res.data.all_modules || {});
      setEntitledModules(res.data.entitled_modules || []);
      setActiveModules(res.data.active_modules || []);
    } catch {
      // ignore
    } finally {
      setModulesLoading(false);
    }
  };

  const handleToggleModule = (key: string) => {
    if (activeModules.includes(key)) {
      setActiveModules(activeModules.filter((m) => m !== key));
    } else {
      setActiveModules([...activeModules, key]);
    }
  };

  const handleSaveModules = async () => {
    try {
      setModulesSaving(true);
      setToast(null);
      const res = await api.put('/settings/modules', { modules: activeModules });
      setToast(res.data.message || 'Feature modules updated successfully.');
      setActiveModules(res.data.active_modules);
      refreshMe();
    } catch (err) {
      setToast(errorMessage(err));
    } finally {
      setModulesSaving(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        gym: {
          name: string;
          legal_name?: string;
          email?: string;
          phone?: string;
          currency: string;
        };
        settings: Record<string, unknown>;
        branding: Record<string, unknown>;
      }>('/settings');

      const { gym, settings, branding } = res.data;
      setName(gym.name || '');
      setLegalName(gym.legal_name || '');
      setEmail(gym.email || '');
      setPhone(gym.phone || '');
      setCurrency(gym.currency || 'INR');
      setInvoicePrefix((settings?.invoice_prefix as string) || 'INV-');
      setTaxRate(settings?.tax_rate ? String(settings.tax_rate) : '18');
      setTagline((branding?.tagline as string) || '');
      setPrimaryColor((branding?.primary_color as string) || '#0f172a');
      setAccentColor((branding?.accent_color as string) || '#10b981');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (user?.role === 'gym_owner') {
      fetchModules();
    }
  }, [user?.role]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      await api.put('/settings', {
        name,
        legal_name: legalName,
        email,
        phone,
        currency,
        settings: {
          invoice_prefix: invoicePrefix,
          tax_rate: parseFloat(taxRate || '0'),
        },
        branding: {
          tagline,
          primary_color: primaryColor,
          accent_color: accentColor,
        },
      });
      setToast('Gym settings and branding saved successfully.');
      refreshMe();
    } catch (err) {
      setToast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        await api.post('/settings/logo', { image: base64 });
        setToast('Logo uploaded and PWA manifest refreshed!');
        refreshMe();
      } catch (err) {
        setToast(errorMessage(err));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="pb-2 border-b border-slate-800">
        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-400" />
          <span>{t('settings.title', 'Gym Settings & Localization')}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {t('settings.subtitle', 'Gym branding, operating currency, tax/GST and user language preferences')}
        </p>
      </div>

      {toast && (
        <div className="p-3 bg-slate-800 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Language Preference Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>{t('settings.language_preference', 'Language Preference')}</span>
          </h3>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {SUPPORTED_LANGUAGES.find((l) => l.code === (user?.language || i18n.language?.slice(0, 2)))?.nativeName}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {t('settings.language_help', 'Select your preferred display language. Each staff member can have an independent preference.')}
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = (user?.language || i18n.language?.slice(0, 2)) === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code as SupportedLanguage)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-950/30'
                    : 'bg-[#131b2e] text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span>{lang.nativeName}</span>
                <span className={`text-[10px] ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                  ({lang.label})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Identity */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-400" />
            <span>Business Entity & Contacts</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Brand Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Legal Registered Entity Name</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Official Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* GST & Invoicing */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-purple-400" />
            <span>Taxation & Invoicing (GST)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Invoice Prefix</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV-"
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">GST Tax Rate (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="18"
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Branding & Theme */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-400" />
            <span>Independent Branding & PWA App Skin</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Brand Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Transform Your Strength"
                className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-300 mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400">{accentColor}</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-300 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400">{primaryColor}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-white mb-0.5">Gym Logo & App Icon</label>
              <p className="text-[11px] text-slate-400">
                Uploaded image is stored in database and served dynamically in the PWA manifest
              </p>
            </div>
            <label className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upload New Logo</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Module Configuration (Only for Gym Owner) */}
        {user?.role === 'gym_owner' && (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Gym Feature Modules & Navigation Customization
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Activate or deactivate modules to streamline staff navigation. Historical data is always preserved.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveModules}
                disabled={modulesSaving}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/30 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{modulesSaving ? 'Saving...' : 'Apply Module Changes'}</span>
              </button>
            </div>

            {modulesLoading ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading module status...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {Object.values(allModules).map((mod) => {
                  const isCore = mod.is_core;
                  const isEntitled = entitledModules.includes(mod.key);
                  const isActive = activeModules.includes(mod.key);

                  return (
                    <div
                      key={mod.key}
                      className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                        isActive
                          ? 'bg-slate-900/60 border-slate-700/80 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-80'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{mod.name}</span>
                          {isCore ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Core
                            </span>
                          ) : !isEntitled ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Upgrade
                            </span>
                          ) : isActive ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {mod.description}
                        </p>
                        {!isEntitled && (
                          <Link
                            to="/billing"
                            className="inline-block text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline mt-1"
                          >
                            Upgrade subscription to unlock →
                          </Link>
                        )}
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {isCore ? (
                          <div
                            className="w-9 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-end px-1 cursor-not-allowed"
                            title="Core module cannot be deactivated"
                          >
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                          </div>
                        ) : !isEntitled ? (
                          <div
                            className="w-9 h-5 rounded-full bg-slate-950 border border-slate-800 flex items-center px-1 opacity-50 cursor-not-allowed"
                            title="Upgrade plan to activate"
                          >
                            <div className="w-3.5 h-3.5 rounded-full bg-slate-600" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleModule(mod.key)}
                            className={`w-9 h-5 rounded-full transition-colors flex items-center px-1 cursor-pointer ${
                              isActive ? 'bg-emerald-500 justify-end' : 'bg-slate-800 justify-start'
                            }`}
                          >
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950/40"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
