// ============================================================
// Cinco Vidas — Language Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type { Lang } from './translations';

interface LangState {
    lang: Lang;
    setLang: (lang: Lang) => void;
    toggle: () => void;
}

const STORAGE_KEY = 'cinco-vidas-lang';

function getInitialLang(): Lang {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'es') return stored;
    } catch { /* ignore */ }
    // Default based on browser language
    const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'es';
    return browserLang.startsWith('en') ? 'en' : 'es';
}

export const useLangStore = create<LangState>((set) => ({
    lang: getInitialLang(),
    setLang: (lang: Lang) => {
        localStorage.setItem(STORAGE_KEY, lang);
        set({ lang });
    },
    toggle: () => set((state) => {
        const next: Lang = state.lang === 'es' ? 'en' : 'es';
        localStorage.setItem(STORAGE_KEY, next);
        return { lang: next };
    }),
}));
