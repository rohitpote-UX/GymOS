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
  Ticket,
  User,
  CreditCard,
  QrCode,
  Check,
  Printer,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatCurrency } from '../lib/formatters';

interface QrInfo {
  valid: boolean;
  token?: string;
  qr_code?: string;
  gym: {
    id?: number;
    name: string;
    slug?: string;
    logo_url?: string;
    phone?: string;
  };
  branch: {
    id?: number;
    name: string;
    code?: string;
    address?: string;
    city?: string;
    phone?: string;
  };
  visitor_pass?: {
    enabled: boolean;
    base_price: number;
    gst_rate: number;
    gst_amount: number;
    total_amount: number;
    currency: string;
    access_hours: string;
    valid_for: string;
  };
  settings?: {
    dues_policy?: string;
    require_location?: boolean;
    radius_meters?: number;
    require_staff_confirmation?: boolean;
  };
}

interface VerifiedMember {
  id: number;
  name: string;
  member_code: string;
  phone: string;
  raw_phone?: string;
  plan_name: string;
  end_date: string;
  days_remaining: number;
  outstanding_balance: number;
  dues_warning?: string | null;
}

interface VisitorPassReceipt {
  id: number;
  pass_code: string;
  full_name: string;
  phone: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  valid_on: string;
  check_in_at: string;
  expires_at: string;
  attendance_log_id?: number;
  branch?: {
    name: string;
    address?: string;
    city?: string;
  };
}

export default function SelfCheckIn() {
  const { token, gymSlug, branchCode } = useParams<{ token?: string; gymSlug?: string; branchCode?: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // Selected Tab: 'member' | 'visitor'
  const [activeMode, setActiveMode] = useState<'member' | 'visitor'>('member');

  const [loading, setLoading] = useState(true);
  const [qrInfo, setQrInfo] = useState<QrInfo | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(token || null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Current live time ticker
  const [currentTime, setCurrentTime] = useState(new Date());

  // Existing Member flow state
  const [phone, setPhone] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifiedMember, setVerifiedMember] = useState<VerifiedMember | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [alreadyCheckedInMessage, setAlreadyCheckedInMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [duesBlockedError, setDuesBlockedError] = useState<string | null>(null);

  // Check-in confirmation state
  const [confirming, setConfirming] = useState(false);
  const [checkedInSuccess, setCheckedInSuccess] = useState<{
    check_in_time: string;
    check_in_date: string;
    branch_name: string;
    member_name: string;
    plan_name: string;
  } | null>(null);

  // Visitor Pass flow state
  const [visitorForm, setVisitorForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: 'male',
    emergency_contact: '',
  });
  const [visitorSubmitting, setVisitorSubmitting] = useState(false);
  const [visitorError, setVisitorError] = useState<string | null>(null);
  const [visitorPassReceipt, setVisitorPassReceipt] = useState<VisitorPassReceipt | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);

  // Keep live time updated
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Restore saved language preference
  useEffect(() => {
    const savedLang = localStorage.getItem('gym_checkin_lang');
    if (savedLang && ['en', 'mr', 'hi'].includes(savedLang)) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  // Load facility info by either Token or GymSlug + BranchCode
  useEffect(() => {
    const fetchFacility = async () => {
      try {
        setLoading(true);
        setErrorStatus(null);

        let res;
        if (gymSlug && branchCode) {
          res = await api.get<QrInfo>(`/self-check-in/resolve/${gymSlug}/${branchCode}`);
        } else if (token) {
          res = await api.get<QrInfo>(`/self-check-in/info/${token}`);
        } else {
          setErrorStatus('No gym or branch specified in check-in URL.');
          setLoading(false);
          return;
        }

        setQrInfo(res.data);
        if (res.data.token) {
          setActiveToken(res.data.token);
        }

        // Check if member phone is remembered on this device
        const remembered = localStorage.getItem('gym_remembered_phone');
        if (remembered) {
          setPhone(remembered);
          if (res.data.token) {
            autoVerify(remembered, res.data.token);
          }
        } else if (user && user.role === 'member' && user.phone) {
          setPhone(user.phone);
          if (res.data.token) {
            autoVerify(user.phone, res.data.token);
          }
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Unable to load gym facility information. Please ask the front desk.';
        setErrorStatus(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchFacility();
  }, [token, gymSlug, branchCode]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('gym_checkin_lang', lang);
  };

  const autoVerify = async (phoneNum: string, qrToken: string) => {
    try {
      setVerifying(true);
      setVerifyError(null);
      setDuesBlockedError(null);

      const res = await api.post<any>('/self-check-in/verify-member', {
        token: qrToken,
        phone: phoneNum,
      });

      if (res.data.already_checked_in) {
        setAlreadyCheckedInMessage(res.data.message);
      } else {
        setVerifiedMember(res.data.member);
        setConfirmationToken(res.data.confirmation_token);
      }
    } catch (err: any) {
      if (err.response?.data?.dues_blocked) {
        setDuesBlockedError(err.response.data.message);
      } else {
        // Silently skip auto-verify error so user can input manually
        console.warn('Auto-verify skipped:', err.response?.data?.message);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !activeToken) return;
    setVerifyError(null);
    setDuesBlockedError(null);
    setAlreadyCheckedInMessage(null);
    setVerifiedMember(null);

    try {
      setVerifying(true);
      const res = await api.post<any>('/self-check-in/verify-member', {
        token: activeToken,
        phone: phone.trim(),
      });

      if (rememberDevice) {
        localStorage.setItem('gym_remembered_phone', phone.trim());
      } else {
        localStorage.removeItem('gym_remembered_phone');
      }

      if (res.data.already_checked_in) {
        setAlreadyCheckedInMessage(res.data.message);
      } else {
        setVerifiedMember(res.data.member);
        setConfirmationToken(res.data.confirmation_token);
      }
    } catch (err: any) {
      if (err.response?.data?.dues_blocked) {
        setDuesBlockedError(err.response.data.message);
      } else {
        setVerifyError(err.response?.data?.message || 'Could not verify member profile. Please contact the front desk.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!activeToken || !confirmationToken) return;

    setConfirming(true);
    setVerifyError(null);

    const performConfirm = async (lat?: number, lon?: number) => {
      try {
        const res = await api.post<any>('/self-check-in/confirm', {
          token: activeToken,
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
        setVerifyError(err.response?.data?.message || 'Failed to record attendance. Please try again or speak with the receptionist.');
      } finally {
        setConfirming(false);
      }
    };

    if (qrInfo?.settings?.require_location && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          performConfirm(position.coords.latitude, position.coords.longitude);
        },
        () => {
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

  // -------------------------------------------------------------
  // VISITOR 1-DAY PASS PAYMENT & VERIFICATION
  // -------------------------------------------------------------
  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorForm.full_name.trim() || !visitorForm.phone.trim()) {
      setVisitorError('Please enter your full name and 10-digit mobile number.');
      return;
    }

    setVisitorSubmitting(true);
    setVisitorError(null);

    try {
      // 1. Create order on backend with dynamic pricing & taxes
      const orderRes = await api.post<any>('/self-check-in/visitor-order', {
        token: activeToken,
        gym_slug: gymSlug,
        branch_code: branchCode,
        full_name: visitorForm.full_name.trim(),
        phone: visitorForm.phone.trim(),
        email: visitorForm.email.trim() || undefined,
        gender: visitorForm.gender,
        emergency_contact: visitorForm.emergency_contact.trim() || undefined,
      });

      const orderData = orderRes.data;

      // 2. Launch Razorpay Checkout if window.Razorpay is available
      if (typeof (window as any).Razorpay !== 'undefined') {
        const rzpOptions = {
          key: orderData.razorpay_key_id,
          amount: orderData.amount_paise,
          currency: 'INR',
          name: qrInfo?.gym?.name || 'GymOS Fitness',
          description: `1-Day Visitor Pass (${orderData.pass_code})`,
          image: qrInfo?.gym?.logo_url,
          order_id: orderData.order_id.startsWith('order_') ? orderData.order_id : undefined,
          prefill: {
            name: visitorForm.full_name,
            contact: visitorForm.phone,
            email: visitorForm.email,
          },
          theme: {
            color: '#D92332',
          },
          handler: async (response: any) => {
            await verifyVisitorPayment(
              orderData.pass_code,
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature
            );
          },
          modal: {
            ondismiss: () => {
              setVisitorSubmitting(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.on('payment.failed', (resp: any) => {
          setVisitorError(`Payment failed: ${resp.error?.description || 'Transaction cancelled.'}`);
          setVisitorSubmitting(false);
        });
        rzp.open();
      } else {
        // Fallback test simulator: Automatically prompt test completion
        setSimulatingPayment(true);
        setTimeout(async () => {
          const testPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 12);
          await verifyVisitorPayment(orderData.pass_code, testPaymentId, orderData.order_id, null);
          setSimulatingPayment(false);
        }, 1200);
      }
    } catch (err: any) {
      setVisitorError(err.response?.data?.message || 'Failed to initiate pass order. Please check with reception.');
      setVisitorSubmitting(false);
    }
  };

  const verifyVisitorPayment = async (
    passCode: string,
    paymentId: string,
    orderId?: string,
    signature?: string | null
  ) => {
    try {
      const res = await api.post<any>('/self-check-in/visitor-verify-payment', {
        pass_code: passCode,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        razorpay_signature: signature,
      });

      if (res.data.success) {
        setVisitorPassReceipt(res.data.pass);
      } else {
        setVisitorError(res.data.message || 'Payment verification could not be completed.');
      }
    } catch (err: any) {
      setVisitorError(err.response?.data?.message || 'Payment verification failed.');
    } finally {
      setVisitorSubmitting(false);
    }
  };

  const pricing = qrInfo?.visitor_pass || {
    enabled: true,
    base_price: 200,
    gst_rate: 18,
    gst_amount: 36,
    total_amount: 236,
    currency: 'INR',
    access_hours: '06:00 AM - 10:00 PM',
    valid_for: 'Today until facility closing',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-[#D92332] selection:text-white font-sans">
      {/* Top Header / Facility Brand Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {qrInfo?.gym?.logo_url ? (
              <img
                src={qrInfo.gym.logo_url}
                alt={qrInfo.gym.name}
                className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D92332] to-[#B91C2B] flex items-center justify-center font-black text-white text-base shadow-md shadow-red-600/30">
                <Dumbbell className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-white text-sm leading-tight">
                {qrInfo?.gym?.name || 'Gym Facility'}
              </h1>
              <p className="text-[11px] text-[#D92332] font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{qrInfo?.branch?.name || 'Main Branch'}</span>
              </p>
            </div>
          </div>

          {/* Multilingual Switcher */}
          <div className="flex items-center gap-1 bg-slate-800/80 rounded-xl p-1 border border-slate-700/80 text-xs">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
                i18n.language === 'en'
                  ? 'bg-[#D92332] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage('mr')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
                i18n.language === 'mr'
                  ? 'bg-[#D92332] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              मराठी
            </button>
            <button
              onClick={() => changeLanguage('hi')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
                i18n.language === 'hi'
                  ? 'bg-[#D92332] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col justify-start space-y-4">
        {/* Loading Spinner */}
        {loading ? (
          <div className="text-center py-20 bg-slate-900/60 rounded-3xl border border-slate-800/80 p-8 shadow-2xl my-auto">
            <RefreshCw className="w-10 h-10 text-red-500 animate-spin mx-auto mb-4" />
            <h2 className="text-base font-bold text-slate-200">
              {i18n.language === 'mr'
                ? 'जिम तपशील तपासत आहे...'
                : i18n.language === 'hi'
                ? 'जिम विवरण सत्यापित हो रहा है...'
                : 'Connecting to gym facility...'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {i18n.language === 'mr' ? 'कृपया एक क्षण थांबा' : i18n.language === 'hi' ? 'कृपया प्रतीक्षा करें' : 'Please wait a moment'}
            </p>
          </div>
        ) : errorStatus ? (
          /* Error Screen */
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-3xl p-6 text-center shadow-xl my-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              {i18n.language === 'mr' ? 'क्यूआर कोड अमान्य आहे' : i18n.language === 'hi' ? 'क्यूआर कोड अमान्य है' : 'Check-In Unavailable'}
            </h2>
            <p className="text-sm text-rose-200/90 mb-6 leading-relaxed">
              {errorStatus}
            </p>
            <p className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              {i18n.language === 'mr'
                ? 'कृपया जिम स्वागत कक्षाशी (रिसेप्शन) संपर्क साधा.'
                : i18n.language === 'hi'
                ? 'कृपया जिम स्वागत डेस्क से संपर्क करें।'
                : 'Please ask the gym reception desk for assistance or scan the counter QR.'}
            </p>
          </div>
        ) : visitorPassReceipt ? (
          /* ----------------------------------------------------------- */
          /* VISITOR PASS ISSUED & ATTENDANCE RECORDED CELEBRATION CARD  */
          /* ----------------------------------------------------------- */
          <div className="bg-linear-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                {i18n.language === 'mr' ? 'वन-डे पास सक्रिय व हजेरी नोंदवली!' : i18n.language === 'hi' ? 'वन-डे पास सक्रिय और उपस्थिति दर्ज!' : 'Visitor Pass Active & Attendance Logged!'}
              </span>
              <h2 className="text-2xl font-black text-white mt-2">
                {visitorPassReceipt.full_name}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Pass: {visitorPassReceipt.pass_code}
              </p>
            </div>

            {/* Turnstile / Front Desk Scannable QR Code */}
            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl">
              <QRCodeSVG
                value={`VISITOR:${visitorPassReceipt.pass_code}`}
                size={170}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Validity:</span>
                <span className="font-bold text-emerald-400">Today until facility closing</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Amount Paid:</span>
                <span className="font-bold text-white">₹{visitorPassReceipt.total_amount} (Incl. GST)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Branch:</span>
                <span className="font-semibold text-slate-200">{qrInfo?.branch?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Check-in Time:</span>
                <span className="font-mono text-slate-300">
                  {new Date(visitorPassReceipt.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Show this pass code to the floor trainer or scan at the turnstile gate. Welcome to {qrInfo?.gym?.name}!
            </p>

            <button
              onClick={() => window.print()}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              <Printer className="w-4 h-4" />
              <span>Save / Print Digital Pass</span>
            </button>
          </div>
        ) : checkedInSuccess ? (
          /* ----------------------------------------------------------- */
          /* EXISTING MEMBER CHECK-IN SUCCESS CELEBRATION                */
          /* ----------------------------------------------------------- */
          <div className="bg-linear-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                {i18n.language === 'mr' ? 'उपस्थिती यशस्वी!' : i18n.language === 'hi' ? 'उपस्थिति दर्ज हो गई!' : 'Check-In Successful!'}
              </span>
              <h2 className="text-2xl font-black text-white mt-2">
                {checkedInSuccess.member_name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {checkedInSuccess.plan_name}
              </p>
            </div>

            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {i18n.language === 'mr' ? 'हजेरी वेळ' : i18n.language === 'hi' ? 'समय' : 'Time'}
                </span>
                <span className="font-bold text-white text-sm">
                  {checkedInSuccess.check_in_time}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {i18n.language === 'mr' ? 'तारीख' : i18n.language === 'hi' ? 'दिनांक' : 'Date'}
                </span>
                <span className="font-medium text-slate-200">
                  {formatDate(checkedInSuccess.check_in_date, i18n.language)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {i18n.language === 'mr' ? 'शाखा' : i18n.language === 'hi' ? 'शाखा' : 'Branch'}
                </span>
                <span className="font-bold text-emerald-400">
                  {checkedInSuccess.branch_name}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              💪 {i18n.language === 'mr' ? 'आजचा व्यायाम जोरदार करा!' : i18n.language === 'hi' ? 'आज का वर्कआउट शानदार बनाएं!' : 'Have a powerful workout session today!'}
            </div>

            <Link
              to="/portal"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              {i18n.language === 'mr' ? 'माझे सदस्य पोर्टल पहा' : i18n.language === 'hi' ? 'सदस्य पोर्टल देखें' : 'View Member Portal'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* ----------------------------------------------------------- */
          /* STANDARD CHECK-IN INTERFACE: TWO LARGE PRIMARY OPTIONS      */
          /* ----------------------------------------------------------- */
          <div className="space-y-4">
            {/* Live Facility Context Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {currentTime.toLocaleDateString(i18n.language === 'mr' ? 'mr-IN' : i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-sm font-black text-white font-mono">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                  ● Gym Open
                </span>
                <span className="text-[11px] text-slate-400">
                  {pricing.access_hours}
                </span>
              </div>
            </div>

            {/* TWO LARGE PRIMARY MODE CARDS */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('member');
                  setVerifyError(null);
                  setDuesBlockedError(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  activeMode === 'member'
                    ? 'bg-linear-to-br from-red-600 to-[#D92332] text-white border-red-500 shadow-xl shadow-red-600/25 ring-2 ring-red-400'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <User className="w-6 h-6" />
                  {activeMode === 'member' && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    {i18n.language === 'mr' ? 'विद्यमान सदस्य' : i18n.language === 'hi' ? 'मौजूदा सदस्य' : 'Existing Member'}
                  </h3>
                  <p className="text-[10px] opacity-80 mt-0.5">
                    {i18n.language === 'mr' ? 'सेल्फ हजेरी नोंदवा' : i18n.language === 'hi' ? 'सेल्फ अटेंडेंस' : 'Mark Daily Attendance'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode('visitor');
                  setVisitorError(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  activeMode === 'visitor'
                    ? 'bg-linear-to-br from-red-600 to-[#D92332] text-white border-red-500 shadow-xl shadow-red-600/25 ring-2 ring-red-400'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Ticket className="w-6 h-6" />
                  {activeMode === 'visitor' && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    {i18n.language === 'mr' ? 'वन-डे व्हिजिटर' : i18n.language === 'hi' ? '1-डे विजिटर' : 'Visitor / 1-Day Pass'}
                  </h3>
                  <p className="text-[10px] opacity-80 mt-0.5">
                    ₹{pricing.total_amount} {i18n.language === 'mr' ? 'एक दिवसाचा प्रवेश' : i18n.language === 'hi' ? 'एक दिन प्रवेश' : 'Single Day Pass'}
                  </p>
                </div>
              </button>
            </div>

            {/* ======================================================== */}
            {/* OPTION 1: EXISTING MEMBER WORKFLOW                       */}
            {/* ======================================================== */}
            {activeMode === 'member' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
                {alreadyCheckedInMessage ? (
                  /* Already checked in today */
                  <div className="text-center py-4 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                      <UserCheck className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {i18n.language === 'mr' ? 'आज हजेरी आधीच नोंदवली आहे' : i18n.language === 'hi' ? 'आज की उपस्थिति पहले से दर्ज है' : 'Already Checked In Today'}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {alreadyCheckedInMessage}
                    </p>
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
                ) : duesBlockedError ? (
                  /* Dues Blocked Notice */
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-sm text-white">
                      {i18n.language === 'mr' ? 'प्रवेश थांबवण्यात आला आहे' : i18n.language === 'hi' ? 'प्रवेश रोका गया' : 'Check-In Blocked: Pending Dues'}
                    </h4>
                    <p className="text-xs text-rose-200 leading-relaxed">
                      {duesBlockedError}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Please clear your outstanding membership dues at the reception counter to continue.
                    </p>
                    <button
                      onClick={() => setDuesBlockedError(null)}
                      className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                    >
                      Try Again
                    </button>
                  </div>
                ) : !verifiedMember ? (
                  /* Step 1: Member Phone / Code Input */
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {i18n.language === 'mr'
                          ? 'नोंदणीकृत मोबाईल नंबर किंवा सदस्य आयडी'
                          : i18n.language === 'hi'
                          ? 'पंजीकृत मोबाइल नंबर या सदस्य आईडी'
                          : 'Registered Mobile Number or Member ID'}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. 98220 12345 / ICF-0001"
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D92332] focus:ring-1 focus:ring-[#D92332]"
                          autoFocus
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="w-4 h-4 accent-[#D92332] rounded cursor-pointer"
                      />
                      <span>
                        {i18n.language === 'mr' ? 'हे डिव्हाइस लक्षात ठेवा' : i18n.language === 'hi' ? 'यह डिवाइस याद रखें' : 'Remember this device for faster check-in'}
                      </span>
                    </label>

                    {verifyError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{verifyError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={verifying || !phone.trim()}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-red-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {verifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{i18n.language === 'mr' ? 'पडताळणी करत आहे...' : i18n.language === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying profile...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{i18n.language === 'mr' ? 'सदस्यत्व तपासा' : i18n.language === 'hi' ? 'सदस्यता जांचें' : 'Verify Membership'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Member Verified — Confirm Attendance */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {i18n.language === 'mr' ? 'सदस्य ओळख पटली' : i18n.language === 'hi' ? 'पहचान सत्यापित' : 'Member Verified'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                          {verifiedMember.member_code}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-white">
                        {verifiedMember.name}
                      </h3>
                      <p className="text-xs text-[#D92332] font-semibold mt-0.5">
                        {verifiedMember.plan_name}
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">
                            {i18n.language === 'mr' ? 'मुदत संपण्याची तारीख' : i18n.language === 'hi' ? 'समाप्ति तिथि' : 'Valid Until'}
                          </span>
                          <span className="font-semibold text-slate-200">
                            {formatDate(verifiedMember.end_date, i18n.language)}
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

                      {verifiedMember.dues_warning && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{verifiedMember.dues_warning}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {verifyError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{verifyError}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVerifiedMember(null);
                          setConfirmationToken(null);
                        }}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700"
                      >
                        {i18n.language === 'mr' ? 'मागे जा' : i18n.language === 'hi' ? 'पीछे' : 'Back'}
                      </button>

                      <button
                        type="button"
                        disabled={confirming}
                        onClick={handleConfirmCheckIn}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {confirming ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{i18n.language === 'mr' ? 'हजेरी नोंदवत आहे...' : i18n.language === 'hi' ? 'उपस्थिति दर्ज हो रही है...' : 'Marking Attendance...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            <span>{i18n.language === 'mr' ? 'हजेरी निश्चित करा' : i18n.language === 'hi' ? 'उपस्थिति दर्ज करें' : 'Confirm Check-In'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* OPTION 2: VISITOR / ONE-DAY PASS WORKFLOW                */}
            {/* ======================================================== */}
            {activeMode === 'visitor' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
                {/* Dynamic Price Display Card */}
                <div className="p-4 rounded-2xl bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        One-Day Facility Pass
                      </span>
                      <h4 className="text-base font-black text-white">
                        Full Gym Access Pass
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        ₹{pricing.total_amount}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        (₹{pricing.base_price} + {pricing.gst_rate}% GST)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>🕒 Valid Today: {pricing.access_hours}</span>
                    <span className="text-emerald-400 font-semibold">Instant Entry</span>
                  </div>
                </div>

                <form onSubmit={handleVisitorSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {i18n.language === 'mr' ? 'तुमचे पूर्ण नाव' : i18n.language === 'hi' ? 'आपका पूरा नाम' : 'Full Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={visitorForm.full_name}
                      onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D92332]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {i18n.language === 'mr' ? 'मोबाईल नंबर' : i18n.language === 'hi' ? 'मोबाइल नंबर' : '10-Digit Mobile Number'} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={visitorForm.phone}
                      onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                      placeholder="e.g. 98765 43210"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D92332]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={visitorForm.email}
                        onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })}
                        placeholder="rahul@example.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Gender
                      </label>
                      <select
                        value={visitorForm.gender}
                        onChange={(e) => setVisitorForm({ ...visitorForm, gender: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {visitorError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{visitorError}</span>
                    </div>
                  )}

                  {simulatingPayment && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Simulating secure sandbox payment & issuing pass...</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={visitorSubmitting || simulatingPayment}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#D92332] hover:bg-[#B91C2B] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {visitorSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Order...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pay ₹{pricing.total_amount} & Get 1-Day Pass</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        <p>
          Powered by <strong className="text-slate-400">GymOS</strong> • Smart Facility Infrastructure
        </p>
      </footer>
    </div>
  );
}
