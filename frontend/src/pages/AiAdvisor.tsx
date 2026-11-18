import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Bot,
  BrainCircuit,
  Building,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Dumbbell,
  HelpCircle,
  Package,
  RefreshCw,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '../lib/formatters';

interface AiInsightsData {
  revenue_delta: {
    current_month_collections: number;
    previous_month_collections: number;
    diff: number;
    percent_change: number;
    direction: 'increase' | 'decrease' | 'flat';
  };
  top_plans: Array<{
    name: string;
    subscribers_count: number;
    total_revenue: number;
  }>;
  churn_risks: Array<{
    id: number;
    name: string;
    phone: string;
    reason: string;
    outstanding_balance: number;
  }>;
  top_margin_products: Array<{
    name: string;
    brand: string;
    selling_price: number;
    gross_margin_percent: number;
  }>;
  branch_performance: Array<{
    name: string;
    collections: number;
    operating_profit: number;
  }>;
  expense_anomalies: Array<{
    category: string;
    current_amount: number;
    previous_amount: number;
    growth_percent: number;
  }>;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  underlyingMetrics?: Record<string, any>;
  aiMode?: string;
}

const QUICK_PROMPTS = [
  'Why did revenue change this month?',
  'Which membership plans generate the most revenue?',
  'Which members are at risk of not renewing?',
  'Which products have the highest gross margin?',
  'Which branch is performing best?',
  'What expenses increased this month?',
  'What should I focus on this week?',
];

export default function AiAdvisor() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [insights, setInsights] = useState<AiInsightsData | null>(null);
  const [aiEngineStatus, setAiEngineStatus] = useState<string>('Deterministic BI Engine');
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [expandedMetricsId, setExpandedMetricsId] = useState<string | null>(null);

  const fetchInsights = async () => {
    try {
      setLoadingInsights(true);
      const res = await api.get('/ai-advisor/insights');
      setInsights(res.data.insights || null);
      if (res.data.ai_engine_status) {
        setAiEngineStatus(res.data.ai_engine_status);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    // Default welcome message
    setChatHistory([
      {
        id: 'initial',
        sender: 'ai',
        text: `Welcome, ${user?.name || 'Owner'}. I am your Gym Business AI Advisor. I continuously analyze your active memberships, supplement margins, branch cashflows, and member attendance patterns to provide data-backed recommendations.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  const handleAskQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: questionText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsAsking(true);

    try {
      const res = await api.post('/ai-advisor/ask', { question: questionText });
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.data.answer || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        underlyingMetrics: res.data.underlying_metrics,
        aiMode: res.data.mode,
      };
      setChatHistory((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Could not retrieve data: ${errorMessage(err)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <BrainCircuit className="w-6 h-6 text-emerald-400" />
              <span>{t('ai_advisor.title')}</span>
            </h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{aiEngineStatus}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('ai_advisor.subtitle')}
          </p>
        </div>

        <button
          onClick={fetchInsights}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Recompute Intelligence</span>
        </button>
      </div>

      {/* Intelligence Cards Grid */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue Variance Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Month-over-Month Collections</span>
                {insights.revenue_delta.direction === 'increase' ? (
                  <span className="text-emerald-400 flex items-center gap-0.5 text-xs font-bold">
                    <ArrowUpRight className="w-4 h-4" /> +{insights.revenue_delta.percent_change}%
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5 text-xs font-bold">
                    <ArrowDownRight className="w-4 h-4" /> {insights.revenue_delta.percent_change}%
                  </span>
                )}
              </div>
              <div className="text-2xl font-black text-white mt-2">
                ₹{insights.revenue_delta.current_month_collections.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Compared to ₹{insights.revenue_delta.previous_month_collections.toLocaleString('en-IN')} last month (
                {insights.revenue_delta.diff >= 0 ? '+' : ''}
                ₹{insights.revenue_delta.diff.toLocaleString('en-IN')})
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1 text-[11px] text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Direct member fee receipts verified</span>
            </div>
          </div>

          {/* Churn Risk Radar */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <UserX className="w-4 h-4" /> Churn Risk Radar
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  {insights.churn_risks.length} at risk
                </span>
              </div>
              <div className="text-2xl font-black text-white mt-2">
                {insights.churn_risks.length} Members
              </div>
              <div className="mt-2 space-y-1">
                {insights.churn_risks.slice(0, 2).map((m) => (
                  <div key={m.id} className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span className="truncate">{m.name}</span>
                    <span className="text-amber-400/90 font-mono text-[10px]">{m.reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Automated WhatsApp reminders ready</span>
            </div>
          </div>

          {/* Top Margin Supplements */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <Package className="w-4 h-4" /> Highest Gross Margin
                </span>
                <span className="text-[10px] text-slate-400">Weighted Average Cost</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {insights.top_margin_products.slice(0, 3).map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 truncate">{prod.name}</span>
                    <span className="text-emerald-400 font-mono font-bold text-[11px]">
                      {prod.gross_margin_percent}% margin
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400">
              <span>Recommend for receptionist front-desk cross-sell</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive AI Chat & Advisor Console */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl flex flex-col h-[560px] overflow-hidden shadow-xl">
        {/* Chat Header */}
        <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Advisor Conversation Console</h3>
              <p className="text-[10px] text-slate-400">Ask any question regarding financial metrics or members</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Strict Tenant Boundary</span>
          </div>
        </div>

        {/* Chat History Messages Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                  msg.sender === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-xs shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs shadow-lg'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Underlying Metrics Collapsible (for AI messages) */}
                {msg.underlyingMetrics && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <button
                      onClick={() =>
                        setExpandedMetricsId(expandedMetricsId === msg.id ? null : msg.id)
                      }
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {expandedMetricsId === msg.id ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      <span>View Underlying Audit Metrics ({Object.keys(msg.underlyingMetrics).length} data points)</span>
                    </button>

                    {expandedMetricsId === msg.id && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-48">
                        <pre>{JSON.stringify(msg.underlyingMetrics, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isAsking && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Analyzing gym data and financial registers...</span>
            </div>
          )}
        </div>

        {/* Quick Question Chips */}
        <div className="p-2.5 bg-slate-900/60 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0 px-1">Quick Inquiries:</span>
          {QUICK_PROMPTS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleAskQuestion(q)}
              disabled={isAsking}
              className="text-[11px] whitespace-nowrap px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(inputQuestion);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask the AI Advisor about revenues, member retention, expenses, or staff performance..."
              disabled={isAsking}
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={isAsking || !inputQuestion.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-md shadow-emerald-950/30 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
