import { Locale } from '../config';
import { en } from './en';
import { ko } from './ko';

export const translations = {
  en,
  ko,
} as const;

export type TranslationKey = keyof typeof en;
export type Translations = typeof translations;

// Helper type for nested translation keys
export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationPath = NestedKeyOf<typeof en>;

