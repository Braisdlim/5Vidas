// ============================================================
// Cinco Vidas — useTranslation Hook
// ============================================================

import { useCallback } from 'react';
import { useLangStore } from './langStore';
import { t, type TranslationKey } from './translations';

export function useTranslation() {
    const lang = useLangStore((s) => s.lang);
    const toggle = useLangStore((s) => s.toggle);

    const tr = useCallback(
        (key: TranslationKey, params?: Record<string, string | number>) => t(key, lang, params),
        [lang]
    );

    return { t: tr, lang, toggleLang: toggle } as const;
}
