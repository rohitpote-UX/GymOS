import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

interface LanguageSwitcherProps {
  variant?: 'pill' | 'dropdown' | 'compact';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  className = '',
}) => {
  const { i18n } = useTranslation();
  const { user, setLanguage } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLangCode = (i18n.language?.slice(0, 2) as SupportedLanguage) || 'en';
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = async (code: SupportedLanguage) => {
    if (code === currentLangCode) {
      setIsOpen(false);
      return;
    }

    try {
      if (user && setLanguage) {
        await setLanguage(code);
      } else {
        await i18n.changeLanguage(code);
        localStorage.setItem('gym_user_language', code);
      }
    } catch {
      await i18n.changeLanguage(code);
      localStorage.setItem('gym_user_language', code);
    }

    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center rounded-lg bg-slate-900/80 p-1 border border-slate-700/60 shadow-inner ${className}`}
        role="group"
        aria-label="Language Selector"
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = lang.code === currentLangCode;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelectLanguage(lang.code as SupportedLanguage)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {lang.nativeName}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-750 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-medium">{currentLang.nativeName}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-36 rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            भाषा / Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLangCode;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code as SupportedLanguage)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-emerald-950/60 text-emerald-300 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span>{lang.nativeName}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
