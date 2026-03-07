// i18n configuration
export type Locale = 'en' | 'ko';

export const defaultLocale: Locale = 'en';
export const supportedLocales: Locale[] = ['en', 'ko'];

// Language names for display
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
};

