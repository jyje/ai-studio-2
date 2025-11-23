'use client';

import { useContext } from 'react';
import { I18nContext } from '../context/I18nContext';
import { translations } from '../locales';
import { Locale } from '../config';

// Helper function to get nested value from object by path string
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return path;
  }
  return value;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }

  const { locale } = context;
  const t = translations[locale];

  const translate = (path: string): any => {
    return getNestedValue(t, path);
  };

  return {
    t: translate,
    locale,
    setLocale: context.setLocale,
  };
}

