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
        className={`inline-flex items-center rounded-xl bg-neutral-100 dark:bg-[#18181B] p-1 border border-[#E9ECEF] dark:border-[#2E2E33] shadow-inner ${className}`}
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
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-[#D92332] dark:bg-[#F02D3A] text-white shadow-sm'
                  : 'text-[#707070] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-[#18181B] hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 border border-[#E9ECEF] dark:border-[#2E2E33] text-xs font-semibold text-[#171717] dark:text-[#EDEDED] transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#D92332] dark:focus:ring-[#F02D3A] min-h-[36px]"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-[#D92332] dark:text-[#F02D3A]" />
        <span>{currentLang.nativeName}</span>
        <ChevronDown className="w-3 h-3 text-[#707070] dark:text-[#A1A1AA]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-white dark:bg-[#18181B] border border-[#E9ECEF] dark:border-[#2E2E33] shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-[#707070] dark:text-[#A1A1AA] uppercase tracking-wider border-b border-[#E9ECEF] dark:border-[#2E2E33]">
            भाषा / Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLangCode;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code as SupportedLanguage)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#D92332]/10 dark:bg-[#F02D3A]/15 text-[#D92332] dark:text-[#F02D3A] font-bold'
                    : 'text-[#171717] dark:text-[#EDEDED] hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <span>{lang.nativeName}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#D92332] dark:text-[#F02D3A] ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
