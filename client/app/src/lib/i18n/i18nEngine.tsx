"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DICTIONARIES, SUPPORTED_LANGUAGES_INFO, SupportedLanguage, I18nSchema, LanguageInfo } from './locales';

export type LanguageMode = 'auto' | SupportedLanguage;

/**
 * Detects the client / operating system language without user intervention.
 */
export function detectSystemLanguage(): SupportedLanguage {
    if (typeof window === 'undefined') return 'es';

    const savedMode = localStorage.getItem('red_language_mode');
    if (savedMode && savedMode !== 'auto') {
        const found = SUPPORTED_LANGUAGES_INFO.some(l => l.id === savedMode);
        if (found) return savedMode as SupportedLanguage;
    } else {
        const saved = localStorage.getItem('red_language');
        if (saved && saved !== 'auto') {
            const found = SUPPORTED_LANGUAGES_INFO.some(l => l.id === saved);
            if (found) return saved as SupportedLanguage;
        }
    }

    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (!nav) return 'en';

    const browserLangs: string[] = [];
    if (Array.isArray(nav.languages)) {
        browserLangs.push(...nav.languages);
    }
    if (nav.language) {
        browserLangs.push(nav.language);
    }
    if ((nav as any).userLanguage) {
        browserLangs.push((nav as any).userLanguage);
    }
    if ((nav as any).browserLanguage) {
        browserLangs.push((nav as any).browserLanguage);
    }

    for (const raw of browserLangs) {
        if (!raw || typeof raw !== 'string') continue;
        const clean = raw.toLowerCase().trim().replace('_', '-');
        if (clean.startsWith('zh')) return 'zh';
        if (clean.startsWith('en')) return 'en';
        if (clean.startsWith('es')) return 'es';
        if (clean.startsWith('pt')) return 'pt';
        if (clean.startsWith('fr')) return 'fr';
        if (clean.startsWith('de')) return 'de';
        if (clean.startsWith('ru')) return 'ru';
        if (clean.startsWith('ja')) return 'ja';
        if (clean.startsWith('ar')) return 'ar';
        if (clean.startsWith('it')) return 'it';
        if (clean.startsWith('ko')) return 'ko';
        if (clean.startsWith('qu')) return 'qu';
    }

    // Default global fallback
    return 'en';
}

export type NestedKeyOf<ObjectType extends object> = {
    [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
        ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
        : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<I18nSchema>;

export type TranslationFunction = ((key: TranslationKey | string, params?: Record<string, string | number>) => string) & I18nSchema;

interface I18nContextValue {
    lang: SupportedLanguage;
    langMode: LanguageMode;
    setLanguage: (mode: LanguageMode) => void;
    t: TranslationFunction;
    dict: I18nSchema;
    langInfo: LanguageInfo;
    allLanguages: LanguageInfo[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedTranslation(dict: any, keyPath: string): string | undefined {
    const keys = keyPath.split('.');
    let current = dict;
    for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
            current = current[k];
        } else {
            return undefined;
        }
    }
    return typeof current === 'string' ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [langMode, setLangModeState] = useState<LanguageMode>('auto');
    const [activeLang, setActiveLang] = useState<SupportedLanguage>('es');

    useEffect(() => {
        const savedMode = (localStorage.getItem('red_language_mode') || localStorage.getItem('red_language') || 'auto') as LanguageMode;
        setLangModeState(savedMode);

        const detected = savedMode === 'auto' ? detectSystemLanguage() : (savedMode as SupportedLanguage);
        setActiveLang(detected);

        // Set document language and text direction for accessibility & RTL
        try {
            document.documentElement.lang = detected;
            const info = SUPPORTED_LANGUAGES_INFO.find(l => l.id === detected);
            document.documentElement.dir = info?.dir || 'ltr';
        } catch {}
    }, []);

    const setLanguage = useCallback((mode: LanguageMode) => {
        setLangModeState(mode);
        try {
            localStorage.setItem('red_language_mode', mode);
            if (mode === 'auto') {
                localStorage.removeItem('red_language');
                const detected = detectSystemLanguage();
                setActiveLang(detected);
                document.documentElement.lang = detected;
                const info = SUPPORTED_LANGUAGES_INFO.find(l => l.id === detected);
                document.documentElement.dir = info?.dir || 'ltr';
            } else {
                localStorage.setItem('red_language', mode);
                setActiveLang(mode);
                document.documentElement.lang = mode;
                const info = SUPPORTED_LANGUAGES_INFO.find(l => l.id === mode);
                document.documentElement.dir = info?.dir || 'ltr';
            }
        } catch {}
    }, []);

    const t = useMemo(() => {
        const primaryDict = DICTIONARIES[activeLang] || DICTIONARIES.es;
        const fallbackDict = DICTIONARIES.es;

        const fn = (key: TranslationKey | string, params?: Record<string, string | number>): string => {
            let translation = getNestedTranslation(primaryDict, key);
            if (!translation) {
                translation = getNestedTranslation(fallbackDict, key) || key;
            }

            if (params && translation) {
                Object.entries(params).forEach(([paramKey, val]) => {
                    translation = translation!.replace(new RegExp(`{${paramKey}}`, 'g'), String(val));
                });
            }

            return translation || key;
        };

        return new Proxy(fn, {
            get(target, prop, receiver) {
                if (prop in target) {
                    return (target as any)[prop];
                }
                if (typeof prop === 'string' && prop in primaryDict) {
                    return (primaryDict as any)[prop];
                }
                if (typeof prop === 'string' && prop in fallbackDict) {
                    return (fallbackDict as any)[prop];
                }
                return Reflect.get(target, prop, receiver);
            }
        }) as TranslationFunction;
    }, [activeLang]);

    const activeDict = useMemo(() => {
        return DICTIONARIES[activeLang] || DICTIONARIES.es;
    }, [activeLang]);

    const langInfo = useMemo(() => {
        return SUPPORTED_LANGUAGES_INFO.find(l => l.id === activeLang) || SUPPORTED_LANGUAGES_INFO[0];
    }, [activeLang]);

    const value = useMemo(() => ({
        lang: activeLang,
        langMode,
        setLanguage,
        t,
        dict: activeDict,
        langInfo,
        allLanguages: SUPPORTED_LANGUAGES_INFO,
    }), [activeLang, langMode, setLanguage, t, activeDict, langInfo]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

/**
 * Custom React Hook to access translation function and language status.
 */
export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        // Fallback for SSR or non-context components
        const detected = detectSystemLanguage();
        const primaryDict = DICTIONARIES[detected] || DICTIONARIES.es;
        const fallbackDict = DICTIONARIES.es;

        const fn = (key: string, params?: Record<string, string | number>) => {
            let res = getNestedTranslation(primaryDict, key) || getNestedTranslation(fallbackDict, key) || key;
            if (params && res) {
                Object.entries(params).forEach(([pk, v]) => {
                    res = res.replace(new RegExp(`{${pk}}`, 'g'), String(v));
                });
            }
            return res;
        };

        const t = new Proxy(fn, {
            get(target, prop, receiver) {
                if (prop in target) return (target as any)[prop];
                if (typeof prop === 'string' && prop in primaryDict) return (primaryDict as any)[prop];
                if (typeof prop === 'string' && prop in fallbackDict) return (fallbackDict as any)[prop];
                return Reflect.get(target, prop, receiver);
            }
        }) as TranslationFunction;

        return {
            lang: detected,
            langMode: 'auto' as LanguageMode,
            setLanguage: () => {},
            t,
            dict: primaryDict,
            langInfo: SUPPORTED_LANGUAGES_INFO.find(l => l.id === detected) || SUPPORTED_LANGUAGES_INFO[0],
            allLanguages: SUPPORTED_LANGUAGES_INFO,
        };
    }
    return context;
}
