import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  Dumbbell,
  Phone,
  ShieldCheck,
  UserCheck,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Languages,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/formatters';

interface QrInfo {
  valid: boolean;
  gym: {
    name: string;
    logo_url?: string;
    phone?: string;
  };
  branch: {
    name: string;
    address?: string;
    city?: string;
    phone?: string;
  };
  qr_code: string;
  require_location: boolean;
  radius_meters: number;
}

interface VerifiedMember {
  id: number;
  name: string;
  member_code: string;
  phone: string;
  plan_name: string;
  end_date: string;
  days_remaining: number;
  outstanding_balance: number;
}

export default function SelfCheckIn() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [qrInfo, setQrInfo] = useState<QrInfo | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Phone input & Verification
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedMember, setVerifiedMember] = useState<VerifiedMember | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [alreadyCheckedInMessage, setAlreadyCheckedInMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Check-in action state
  const [confirming, setConfirming] = useState(false);
  const [checkedInSuccess, setCheckedInSuccess] = useState<{
    check_in_time: string;
    check_in_date: string;
    branch_name: string;
    member_name: string;
    plan_name: string;
  } | null>(null);

  // Fetch QR Info on load
  useEffect(() => {
    if (!token) {
      setErrorStatus('No QR code token provided.');
      setLoading(false);
      return;
    }

    const fetchInfo = async () => {
      try {
        setLoading(true);
        setErrorStatus(null);
        const res = await api.get<QrInfo>(`/self-check-in/info/${token}`);
        setQrInfo(res.data);

        // If user is already logged in as member in this gym, auto-trigger verify
        if (user && user.role === 'member' && user.phone) {
          setPhone(user.phone);
          autoVerify(user.phone);
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Unable to recognize this QR code. Please ask the front desk.';
        setErrorStatus(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [token]);

  const autoVerify = async (phoneNum: string) => {
    if (!token) return;
    try {
      setVerifying(true);
      setVerifyError(null);
      const res = await api.post<any>('/self-check-in/verify-member', {
        token,
        phone: phoneNum,
      });

      if (res.data.already_checked_in) {
        setAlreadyCheckedInMessage(res.data.message);
      } else {
        setVerifiedMember(res.data.member);
        setConfirmationToken(res.data.confirmation_token);
      }
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !token) return;
    setVerifyError(null);
    setAlreadyCheckedInMessage(null);
    setVerifiedMember(null);

    try {
      setVerifying(true);
      const res = await api.post<any>('/self-check-in/verify-member', {
        token,
        phone: phone.trim(),
      });

      if (res.data.already_checked_in) {
        setAlreadyCheckedInMessage(res.data.message);
      } else {
        setVerifiedMember(res.data.member);
        setConfirmationToken(res.data.confirmation_token);
      }
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || 'Could not verify member profile. Please contact front desk.');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!token || !confirmationToken) return;

    setConfirming(true);
    setVerifyError(null);

    const performConfirm = async (lat?: number, lon?: number) => {
      try {
        const res = await api.post<any>('/self-check-in/confirm', {
          token,
          confirmation_token: confirmationToken,
          latitude: lat,
          longitude: lon,
        });

        if (res.data.already_checked_in) {
          setAlreadyCheckedInMessage(res.data.message);
        } else {
          setCheckedInSuccess({
            check_in_time: res.data.check_in_time,
            check_in_date: res.data.check_in_date,
            branch_name: res.data.branch_name,
            member_name: res.data.member_name,
            plan_name: res.data.plan_name,
          });
        }
      } catch (err: any) {
        setVerifyError(err.response?.data?.message || 'Failed to record attendance. Please try again or talk to the receptionist.');
      } finally {
        setConfirming(false);
      }
    };

    // If gym requires GPS location, request browser coordinates
    if (qrInfo?.require_location && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          performConfirm(position.coords.latitude, position.coords.longitude);
        },
        (geoErr) => {
          setConfirming(false);
          setVerifyError(
            i18n.language === 'mr'
              ? 'जिमच्या नियमांनुसार उपस्थिती नोंदवण्यासाठी GPS लोकेशन आवश्यक आहे. कृपया लोकेशन परवानगी द्या.'
              : i18n.language === 'hi'
              ? 'जिम के नियमों के अनुसार उपस्थिति दर्ज करने के लिए GPS लोकेशन अनिवार्य है। कृपया लोकेशन अनुमति दें।'
              : 'Gym policy requires GPS location verification. Please allow location access to check in.'
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      performConfirm();
    }
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#101010] text-[#171717] dark:text-slate-100 flex flex-col justify-between selection:bg-[#D92332] selection:text-white">
      {/* Top Header / Brand Bar */}
      <header className="border-b border-[#E8E8E8] dark:border-[#303030] bg-[#F7F7F7]/90 dark:bg-[#1C1C1C]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D92332] to-[#B91C2B] dark:from-[#F02D3A] dark:to-[#B91C2B] flex items-center justify-center font-black text-white text-base shadow-md shadow-red-600/30">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-[#171717] dark:text-white text-sm leading-tight">
                {qrInfo?.gym?.name || 'GymOS'}
              </h1>
              <p className="text-[11px] text-[#D92332] dark:text-[#F02D3A] font-medium">
                {i18n.language === 'mr' ? 'सदस्य सेल्फ हजेरी' : i18n.language === 'hi' ? 'सदस्य सेल्फ अटेंडेंस' : 'Member Self Check-In'}
              </p>
            </div>
          </div>

          {/* Quick Language Switcher */}
          <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 rounded-lg p-0.5 border border-[#E8E8E8] dark:border-[#303030] text-xs">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-2 py-1 rounded font-medium transition ${
                i18n.language === 'en' ? 'bg-[#D92332] dark:bg-[#F02D3A] text-white font-bold' : 'text-[#707070] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage('mr')}
              className={`px-2 py-1 rounded font-medium transition ${
                i18n.language === 'mr' ? 'bg-[#D92332] dark:bg-[#F02D3A] text-white font-bold' : 'text-[#707070] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              मराठी
            </button>
            <button
              onClick={() => changeLanguage('hi')}
              className={`px-2 py-1 rounded font-medium transition ${
                i18n.language === 'hi' ? 'bg-[#D92332] dark:bg-[#F02D3A] text-white font-bold' : 'text-[#707070] dark:text-slate-400 hover:text-[#171717] dark:hover:text-white'
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Card */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-center">
        {loading ? (
          <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800/80 p-8 shadow-2xl">
            <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
            <h2 className="text-base font-semibold text-slate-200">
              {i18n.language === 'mr' ? 'जिम तपशील तपासत आहे...' : i18n.language === 'hi' ? 'जिम विवरण सत्यापित हो रहा है...' : 'Verifying Gym QR Code...'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {i18n.language === 'mr' ? 'कृपया एक क्षण थांबा' : i18n.language === 'hi' ? 'कृपया प्रतीक्षा करें' : 'Please wait a moment'}
            </p>
          </div>
        ) : errorStatus ? (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-3xl p-6 text-center shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {i18n.language === 'mr' ? 'क्यूआर कोड अवैध किंवा बंद आहे' : i18n.language === 'hi' ? 'क्यूआर कोड अमान्य या निष्क्रिय है' : 'QR Code Inactive or Invalid'}
            </h2>
            <p className="text-sm text-rose-200/90 mb-6 leading-relaxed">
              {errorStatus}
            </p>
            <p className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              {i18n.language === 'mr'
                ? 'कृपया जिम स्वागत कक्षाशी (रिसेप्शन) संपर्क साधा किंवा नव्याने स्कॅन करा.'
                : i18n.language === 'hi'
                ? 'कृपया फ्रंट डेस्क से संपर्क करें या दोबारा स्कैन करें।'
                : 'Please ask the gym front desk receptionist for assistance or scan the updated poster.'}
            </p>
          </div>
        ) : checkedInSuccess ? (
          /* Checked In Success Celebration Screen */
          <div className="bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              {i18n.language === 'mr' ? 'उपस्थिती यशस्वी!' : i18n.language === 'hi' ? 'उपस्थिति दर्ज हो गई!' : 'Check-In Successful!'}
            </div>

            <h2 className="text-2xl font-black text-white mb-1">
              {checkedInSuccess.member_name}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {checkedInSuccess.plan_name}
            </p>

            <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 mb-6 text-left space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {i18n.language === 'mr' ? 'हजेरी वेळ' : i18n.language === 'hi' ? 'समय' : 'Time'}
                </span>
                <span className="font-bold text-white text-sm">
                  {checkedInSuccess.check_in_time}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {i18n.language === 'mr' ? 'तारीख' : i18n.language === 'hi' ? 'दिनांक' : 'Date'}
                </span>
                <span className="font-medium text-slate-200">
                  {formatDate(checkedInSuccess.check_in_date)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {i18n.language === 'mr' ? 'शाखा' : i18n.language === 'hi' ? 'शाखा' : 'Branch'}
                </span>
                <span className="font-semibold text-emerald-400">
                  {checkedInSuccess.branch_name}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-6">
              💪 {i18n.language === 'mr' ? 'आजचा व्यायाम जोरदार करा!' : i18n.language === 'hi' ? 'आज का वर्कआउट शानदार बनाएं!' : 'Crush your workout today!'}
            </div>

            <Link
              to="/portal"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition border border-slate-700"
            >
              {i18n.language === 'mr' ? 'माझे सदस्य खाते पहा' : i18n.language === 'hi' ? 'मेरा सदस्य खाता देखें' : 'View Member Portal'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : alreadyCheckedInMessage ? (
          /* Already checked in today */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <UserCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {i18n.language === 'mr' ? 'आज हजेरी आधीच नोंदवली आहे' : i18n.language === 'hi' ? 'आज की उपस्थिति पहले से दर्ज है' : 'Already Checked In Today'}
            </h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {alreadyCheckedInMessage}
            </p>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-6 text-xs text-slate-400">
              {i18n.language === 'mr'
                ? 'तुमची उपस्थिती आधीच वैध नोंदली गेली आहे. पुन्हा स्कॅन करण्याची आवश्यकता नाही.'
                : i18n.language === 'hi'
                ? 'आपकी उपस्थिति पहले ही सफलतापूर्वक दर्ज हो चुकी है।'
                : 'Your attendance is already actively recorded for today. No further action needed.'}
            </div>
            <button
              onClick={() => {
                setAlreadyCheckedInMessage(null);
                setVerifiedMember(null);
                setPhone('');
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              {i18n.language === 'mr' ? 'दुसऱ्या सदस्यासाठी तपासा' : i18n.language === 'hi' ? 'अन्य सदस्य के लिए जांचें' : 'Check for another member'}
            </button>
          </div>
        ) : (
          /* Verification & Confirmation Workflow */
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl backdrop-blur">
            {/* Gym & Branch Context Card */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    {qrInfo?.branch?.name}
                  </span>
                  <h3 className="font-extrabold text-white text-base mt-1.5 leading-tight">
                    {qrInfo?.gym?.name}
                  </h3>
                  {qrInfo?.branch?.address && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {qrInfo.branch.address}, {qrInfo.branch.city}
                    </p>
                  )}
                </div>
                {qrInfo?.gym?.logo_url ? (
                  <img
                    src={qrInfo.gym.logo_url}
                    alt={qrInfo.gym.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-900"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400 text-sm">
                    {qrInfo?.gym?.name?.substring(0, 2).toUpperCase() || 'GY'}
                  </div>
                )}
              </div>

              {qrInfo?.require_location && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-amber-300">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {i18n.language === 'mr'
                      ? 'GPS स्थान पडताळणी आवश्यक आहे'
                      : i18n.language === 'hi'
                      ? 'GPS स्थान सत्यापन आवश्यक है'
                      : 'GPS location verification required at entrance'}
                  </span>
                </div>
              )}
            </div>

            {/* Step 1: Member Phone Verification */}
            {!verifiedMember ? (
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {i18n.language === 'mr'
                      ? 'तुमचा नोंदणीकृत मोबाईल नंबर टाका'
                      : i18n.language === 'hi'
                      ? 'अपना पंजीकृत मोबाइल नंबर दर्ज करें'
                      : 'Enter your registered mobile number'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={i18n.language === 'mr' ? 'उदा. 98220 12345' : 'e.g. 98220 12345'}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {i18n.language === 'mr'
                      ? 'जिममध्ये नोंदणी केलेला 10-अंकी नंबर किंवा सदस्य आयडी'
                      : i18n.language === 'hi'
                      ? 'जिम में पंजीकृत 10 अंकों का नंबर या सदस्य आईडी'
                      : '10-digit mobile number or Member ID registered with the gym'}
                  </p>
                </div>

                {verifyError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying || !phone.trim()}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {i18n.language === 'mr' ? 'तपासत आहे...' : i18n.language === 'hi' ? 'सत्यापित कर रहे हैं...' : 'Verifying profile...'}
                    </>
                  ) : (
                    <>
                      {i18n.language === 'mr' ? 'सदस्यत्व तपासा' : i18n.language === 'hi' ? 'सदस्यता जांचें' : 'Verify Membership'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2: Member Verified — Confirm Check-In */
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      {i18n.language === 'mr' ? 'सदस्य ओळख पटली' : i18n.language === 'hi' ? 'पहचान सत्यापित' : 'Member Verified'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {verifiedMember.member_code}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    {verifiedMember.name}
                  </h3>
                  <p className="text-xs text-emerald-300 font-medium mt-0.5">
                    {verifiedMember.plan_name}
                  </p>

                  <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {i18n.language === 'mr' ? 'मुदत संपण्याची तारीख' : i18n.language === 'hi' ? 'समाप्ति तिथि' : 'Valid Until'}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {formatDate(verifiedMember.end_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {i18n.language === 'mr' ? 'शिल्लक दिवस' : i18n.language === 'hi' ? 'शेष दिन' : 'Days Remaining'}
                      </span>
                      <span className="font-bold text-emerald-400">
                        {verifiedMember.days_remaining} {i18n.language === 'mr' ? 'दिवस' : i18n.language === 'hi' ? 'दिन' : 'days'}
                      </span>
                    </div>
                  </div>

                  {verifiedMember.outstanding_balance > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        {i18n.language === 'mr' ? 'शिल्लक फी बाकी:' : i18n.language === 'hi' ? 'बकाया शुल्क:' : 'Fee Balance Due:'}
                      </span>
                      <span className="font-bold">₹{verifiedMember.outstanding_balance.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                {verifyError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedMember(null);
                      setConfirmationToken(null);
                    }}
                    className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                  >
                    {i18n.language === 'mr' ? 'मागे जा' : i18n.language === 'hi' ? 'पीछे' : 'Back'}
                  </button>

                  <button
                    type="button"
                    disabled={confirming}
                    onClick={handleConfirmCheckIn}
                    className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {confirming ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {i18n.language === 'mr' ? 'हजेरी नोंदवत आहे...' : i18n.language === 'hi' ? 'उपस्थिति दर्ज हो रही है...' : 'Marking Attendance...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {i18n.language === 'mr' ? 'हजेरी निश्चित करा' : i18n.language === 'hi' ? 'उपस्थिति दर्ज करें' : 'Confirm Check-In'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        <p>
          Powered by <strong className="text-slate-400">GymOS</strong> • Intelligent Gym Infrastructure
        </p>
      </footer>
    </div>
  );
}
