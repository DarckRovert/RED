import { es } from './es';
import { en } from './en';
import { zh } from './zh';
import { pt } from './pt';
import { fr } from './fr';
import { de } from './de';
import { ru } from './ru';
import { ja } from './ja';
import { ar } from './ar';
import { it } from './it';
import { ko } from './ko';
import { qu } from './qu';
import type { I18nSchema } from './es';

export type SupportedLanguage = 
    | 'zh' 
    | 'en' 
    | 'es' 
    | 'pt' 
    | 'fr' 
    | 'de' 
    | 'ru' 
    | 'ja' 
    | 'ar' 
    | 'it' 
    | 'ko' 
    | 'qu';

export interface LanguageInfo {
    id: SupportedLanguage;
    name: string;
    nativeName: string;
    flag: string;
    dir?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES_INFO: LanguageInfo[] = [
    { id: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳' },
    { id: 'en', name: 'English', nativeName: 'English (US)', flag: '🇺🇸' },
    { id: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { id: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
    { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { id: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { id: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { id: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { id: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
    { id: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { id: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    { id: 'qu', name: 'Quechua', nativeName: 'Runasimi', flag: '🇵🇪' },
];

export const DICTIONARIES: Record<SupportedLanguage, I18nSchema> = {
    es,
    en,
    zh,
    pt,
    fr,
    de,
    ru,
    ja,
    ar,
    it,
    ko,
    qu,
};

export type { I18nSchema };
