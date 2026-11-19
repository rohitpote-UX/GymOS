import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Calendar,
  Clock,
  Dumbbell,
  Loader2,
  Package,
  Receipt,
  Search,
  Target,
  User,
  Users,
  X,
} from 'lucide-react';
import api from '../api/client';
import { formatCurrency } from '../lib/formatters';

interface SearchResultItem {
  id: number;
  title: string;
  subtitle: string;
  status?: string;
  type: 'member' | 'plan' | 'payment' | 'product' | 'lead';
  url: string;
  metadata?: Record<string, any>;
}

interface SearchResponse {
  query: string;
  results: {
    members: SearchResultItem[];
    plans: SearchResultItem[];
    payments: SearchResultItem[];
    products: SearchResultItem[];
    leads: SearchResultItem[];
  };
  total_matches: number;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse['results']>({
    members: [],
    plans: [],
    payments: [],
    products: [],
    leads: [],
  });
  const [totalMatches, setTotalMatches] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'member' | 'payment' | 'product' | 'lead'>('all');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ members: [], plans: [], payments: [], products: [], leads: [] });
      setTotalMatches(0);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults({ members: [], plans: [], payments: [], products: [], leads: [] });
      setTotalMatches(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await api.get<SearchResponse>('/search', { params: { q: query.trim() } });
        setResults(res.data.results);
        setTotalMatches(res.data.total_matches);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  // Keyboard navigation & escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (url: string) => {
    navigate(url);
    onClose();
  };

  const getFilteredItems = (): SearchResultItem[] => {
    const all = [
      ...results.members,
      ...results.plans,
      ...results.payments,
      ...results.products,
      ...results.leads,
    ];
    if (activeFilter === 'all') return all;
    return all.filter((item) => item.type === activeFilter);
  };

  const items = getFilteredItems();

  const getIconForType = (type: string) => {
    switch (type) {
      case 'member':
        return <Users className="w-4 h-4 text-emerald-400" />;
      case 'plan':
        return <Dumbbell className="w-4 h-4 text-amber-400" />;
      case 'payment':
        return <Receipt className="w-4 h-4 text-blue-400" />;
      case 'product':
        return <Package className="w-4 h-4 text-purple-400" />;
      case 'lead':
        return <Target className="w-4 h-4 text-rose-400" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl shadow-emerald-950/30 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/60">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search_placeholder', 'Search members, phone numbers, receipts, products, leads...')}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Filter Category Pills */}
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/30 flex items-center gap-2 overflow-x-auto text-xs">
          {[
            { key: 'all', label: t('common.all', 'All') },
            { key: 'member', label: t('nav.members', 'Members') },
            { key: 'payment', label: t('nav.payments', 'Payments') },
            { key: 'product', label: t('nav.pos', 'Products') },
            { key: 'lead', label: t('nav.leads', 'Leads') },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFilter === tab.key
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {totalMatches > 0 && (
            <span className="ml-auto text-[11px] text-slate-500">
              {totalMatches} matches
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-800/50">
          {query.trim().length < 2 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p>Type at least 2 characters to search across all gym records.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-400">
                <span className="px-2 py-1 bg-slate-800/60 rounded border border-slate-800">Phone numbers</span>
                <span className="px-2 py-1 bg-slate-800/60 rounded border border-slate-800">Member ID</span>
                <span className="px-2 py-1 bg-slate-800/60 rounded border border-slate-800">Receipt No</span>
                <span className="px-2 py-1 bg-slate-800/60 rounded border border-slate-800">Product SKU</span>
              </div>
            </div>
          ) : items.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <p>No results found for "{query}".</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelect(item.url)}
                className="w-full text-left p-3 rounded-xl hover:bg-slate-800/60 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                    {getIconForType(item.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {item.type}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate to records instantly</span>
          <div className="flex items-center gap-2">
            <span>Close</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px]">ESC</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
