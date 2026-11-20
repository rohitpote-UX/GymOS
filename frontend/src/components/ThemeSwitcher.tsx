import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

interface ThemeSwitcherProps {
  variant?: 'icon' | 'labeled' | 'pill';
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { i18n } = useTranslation();

  const labelText = isDark
    ? i18n.language === 'mr' ? 'लाइट मोड' : i18n.language === 'hi' ? 'लाइट मोड' : 'Light Mode'
    : i18n.language === 'mr' ? 'डार्क मोड' : i18n.language === 'hi' ? 'डार्क मोड' : 'Dark Mode';

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
          isDark
            ? 'bg-[#1C1C1C] border-[#303030] text-[#A3A3A3] hover:text-white hover:border-[#F02D3A]/40'
            : 'bg-[#F7F7F7] border-[#E8E8E8] text-[#707070] hover:text-[#171717] hover:border-[#D92332]/40'
        } ${className}`}
        title={labelText}
        aria-label={labelText}
      >
        {isDark ? (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold">{labelText}</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-slate-700" />
            <span className="text-xs font-semibold">{labelText}</span>
          </>
        )}
      </button>
    );
  }

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer ${
          isDark
            ? 'bg-[#1C1C1C] border-[#303030] text-[#A3A3A3] hover:text-white'
            : 'bg-[#F7F7F7] border-[#E8E8E8] text-[#707070] hover:text-[#171717]'
        } ${className}`}
        title={labelText}
        aria-label={labelText}
      >
        <span className="text-xs font-medium">{labelText}</span>
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
        isDark
          ? 'bg-[#1C1C1C] border-[#303030] text-[#A3A3A3] hover:text-white hover:border-[#F02D3A]/50'
          : 'bg-[#F7F7F7] border-[#E8E8E8] text-[#707070] hover:text-[#171717] hover:border-[#D92332]/50'
      } ${className}`}
      title={labelText}
      aria-label={labelText}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-slate-800 -rotate-12 hover:rotate-0 transition-transform" />
      )}
    </button>
  );
};
