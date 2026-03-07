'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale } from '../config';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({ 
  children, 
  defaultLocale: initialLocale = defaultLocale 
}: I18nProviderProps) {
  // Always start with initialLocale to avoid hydration mismatch
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [isClient, setIsClient] = useState(false);

  // Load locale from localStorage only on client side after hydration
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('locale') as Locale | null;
      if (saved && ['en', 'ko'].includes(saved)) {
        setLocaleState(saved);
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }
  };

  // Update HTML lang attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

