'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n/hooks/useTranslation';
import { Locale, supportedLocales, localeNames } from '../i18n/config';
import { useTheme, Theme } from '../theme/context/ThemeContext';
import { useSettings, AgentGraphDisplayMode } from '../settings/context/SettingsContext';
import { getBackendBaseUrl } from '../config';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { settings, setAgentGraphDisplayMode } = useSettings();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showAgentGraphDisplayDropdown, setShowAgentGraphDisplayDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const agentGraphDisplayDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showLanguageDropdown) {
          setShowLanguageDropdown(false);
        } else if (showThemeDropdown) {
          setShowThemeDropdown(false);
        } else if (showAgentGraphDisplayDropdown) {
          setShowAgentGraphDisplayDropdown(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, showLanguageDropdown, showThemeDropdown, showAgentGraphDisplayDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setShowThemeDropdown(false);
      }
      if (agentGraphDisplayDropdownRef.current && !agentGraphDisplayDropdownRef.current.contains(event.target as Node)) {
        setShowAgentGraphDisplayDropdown(false);
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

  const handleAgentGraphDisplayModeChange = (mode: AgentGraphDisplayMode) => {
    setAgentGraphDisplayMode(mode);
    setShowAgentGraphDisplayDropdown(false);
  };

  const handleRefreshConfiguration = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const baseUrl = getBackendBaseUrl();
      const response = await fetch(`${baseUrl}/v2/reload`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reload configuration');
      }

      setRefreshMessage({ type: 'success', text: t('settings.refreshSuccess') || 'Configuration reloaded successfully' });

      // Auto-hide success message after 3 seconds
      setTimeout(() => setRefreshMessage(null), 3000);
    } catch (error) {
      console.error('Error refreshing configuration:', error);
      setRefreshMessage({ type: 'error', text: t('settings.refreshError') || 'Failed to reload configuration' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.themeOptions.light') },
    { value: 'dark', label: t('settings.themeOptions.dark') },
    { value: 'system', label: t('settings.themeOptions.system') },
  ];

  const agentGraphDisplayOptions: { value: AgentGraphDisplayMode; label: string }[] = [
    { value: 'embedded', label: t('settings.agentGraphDisplayOptions.embedded') },
    { value: 'floating', label: t('settings.agentGraphDisplayOptions.floating') },
    { value: 'hidden', label: t('settings.agentGraphDisplayOptions.hidden') },
  ];

  const getThemeLabel = (themeValue: Theme): string => {
    const option = themeOptions.find(o => o.value === themeValue);
    return option?.label || themeValue;
  };

  const getAgentGraphDisplayLabel = (mode: AgentGraphDisplayMode): string => {
    const option = agentGraphDisplayOptions.find(o => o.value === mode);
    return option?.label || mode;
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
                  className={`w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''
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
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer ${locale === loc
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
                  className={`w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200 ${showThemeDropdown ? 'rotate-180' : ''
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
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer ${theme === option.value
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

          {/* Agent Graph Display Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#cccccc] mb-2">
              {t('settings.agentGraphDisplay')}
            </label>
            <div className="relative" ref={agentGraphDisplayDropdownRef}>
              <button
                type="button"
                onClick={() => setShowAgentGraphDisplayDropdown(!showAgentGraphDisplayDropdown)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-[#1e1e1e] hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-900 dark:text-[#cccccc]">
                  {getAgentGraphDisplayLabel(settings.agentGraphDisplayMode)}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200 ${showAgentGraphDisplayDropdown ? 'rotate-180' : ''
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAgentGraphDisplayDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 overflow-hidden">
                  {agentGraphDisplayOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAgentGraphDisplayModeChange(option.value)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer ${settings.agentGraphDisplayMode === option.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc]'
                        }`}
                    >
                      <span>{option.label}</span>
                      {settings.agentGraphDisplayMode === option.value && (
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

        {/* Refresh Configuration Button */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-[#3e3e42]">
          <button
            type="button"
            onClick={handleRefreshConfiguration}
            disabled={isRefreshing}
            className={`w-full flex justify-center py-2.5 px-4 rounded-lg font-medium text-white transition-colors cursor-pointer ${isRefreshing
              ? 'bg-blue-400 dark:bg-blue-600/50 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 dark:bg-[#007acc] dark:hover:bg-[#005999]'
              }`}
          >
            {isRefreshing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('settings.refreshing') || 'Refreshing...'}
              </span>
            ) : (
              t('settings.refreshConfig') || 'Refresh Configuration'
            )}
          </button>

          {refreshMessage && (
            <p className={`mt-2 text-sm text-center ${refreshMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
              {refreshMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
