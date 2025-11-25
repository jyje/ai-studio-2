'use client';

import { useEffect } from 'react';
import { useTranslation } from '../i18n/hooks/useTranslation';
import { Locale, supportedLocales, localeNames } from '../i18n/config';
import { useTheme, Theme } from '../theme/context/ThemeContext';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.themeOptions.light') },
    { value: 'dark', label: t('settings.themeOptions.dark') },
    { value: 'system', label: t('settings.themeOptions.system') },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#252526] rounded-2xl shadow-2xl dark:shadow-2xl w-full max-w-md mx-4 p-6 border dark:border-[#3e3e42]"
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
              className="w-6 h-6 text-gray-500 dark:text-[#858585]"
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

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
              {t('settings.language')}
            </label>
            <div className="space-y-2">
              {supportedLocales.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-[#3e3e42] hover:bg-gray-50 dark:hover:bg-[#2d2d30] cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="locale"
                    value={loc}
                    checked={locale === loc}
                    onChange={() => handleLocaleChange(loc)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700 dark:text-[#cccccc]">{localeNames[loc]}</span>
                  {locale === loc && (
                    <svg
                      className="w-4 h-4 text-blue-600 ml-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
              {t('settings.theme')}
            </label>
            <div className="space-y-2">
              {themeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-[#3e3e42] hover:bg-gray-50 dark:hover:bg-[#2d2d30] cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => handleThemeChange(option.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm text-gray-700 dark:text-[#cccccc]">{option.label}</span>
                  {theme === option.value && (
                    <svg
                      className="w-4 h-4 text-blue-600 ml-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

