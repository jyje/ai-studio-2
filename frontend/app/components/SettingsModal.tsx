'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/hooks/useTranslation';
import { Locale, supportedLocales, localeNames } from '../i18n/config';
import { useTheme, Theme } from '../theme/context/ThemeContext';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showLanguageDropdown) {
          setShowLanguageDropdown(false);
        } else if (showThemeDropdown) {
          setShowThemeDropdown(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, showLanguageDropdown, showThemeDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setShowThemeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setShowLanguageDropdown(false);
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setShowThemeDropdown(false);
  };

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.themeOptions.light') },
    { value: 'dark', label: t('settings.themeOptions.dark') },
    { value: 'system', label: t('settings.themeOptions.system') },
  ];

  const getThemeLabel = (themeValue: Theme): string => {
    const option = themeOptions.find(o => o.value === themeValue);
    return option?.label || themeValue;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#252526] rounded-2xl shadow-2xl dark:shadow-2xl w-full max-w-sm mx-4 p-6 border border-gray-300 dark:border-[#3e3e42]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#cccccc]">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
            aria-label={t('settings.close')}
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-[#858585]"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#cccccc] mb-2">
              {t('settings.language')}
            </label>
            <div className="relative" ref={languageDropdownRef}>
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-900 dark:text-[#cccccc]">{localeNames[locale]}</span>
                <svg
                  className={`w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200 ${
                    showLanguageDropdown ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showLanguageDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 overflow-hidden">
                  {supportedLocales.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleLocaleChange(loc)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                        locale === loc
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc]'
                      }`}
                    >
                      <span>{localeNames[loc]}</span>
                      {locale === loc && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Theme Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#cccccc] mb-2">
              {t('settings.theme')}
            </label>
            <div className="relative" ref={themeDropdownRef}>
              <button
                type="button"
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-900 dark:text-[#cccccc]">{getThemeLabel(theme)}</span>
                <svg
                  className={`w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200 ${
                    showThemeDropdown ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showThemeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 overflow-hidden">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleThemeChange(option.value)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                        theme === option.value
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc]'
                      }`}
                    >
                      <span>{option.label}</span>
                      {theme === option.value && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
