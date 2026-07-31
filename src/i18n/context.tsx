import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { pt, type Dictionary, type TranslationKey } from './pt';
import { es } from './es';
import { en } from './en';

export const LOCALES = ['pt', 'es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Étiquettes dans leur propre langue : un hispanophone cherche « Español », pas
 * « Espanhol ».
 *
 * ⚠️ Le FRANÇAIS a été retiré. L'application couvre le Portugal et l'Espagne, et
 * rien d'autre : elle n'a pas de public francophone naturel, et maintenir un
 * quatrième dictionnaire pour personne coûtait à chaque libellé ajouté. Un
 * visiteur francophone tombe désormais sur l'anglais, comme tout visiteur dont
 * la langue n'est pas couverte.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  pt: 'Português',
  es: 'Español',
  en: 'English',
};

/** Étiquette BCP-47 passée aux API Intl pour les dates et les nombres. */
const INTL_TAGS: Record<Locale, string> = {
  pt: 'pt-PT',
  es: 'es-ES',
  en: 'en-GB',
};

const DICTIONARIES: Record<Locale, Dictionary> = { pt, es, en };

const STORAGE_KEY = 'fogos.locale';

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Choix initial : préférence explicite mémorisée, sinon langues du navigateur,
 * sinon anglais.
 *
 * Repli sur l'ANGLAIS et non sur le portugais : un visiteur allemand ou italien
 * lit plus probablement l'anglais que le portugais. Le portugais reste la langue
 * de RÉFÉRENCE du dictionnaire, ce qui est une autre question.
 */
export function detectLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;

    for (const tag of window.navigator?.languages ?? []) {
      const base = tag.toLowerCase().split('-')[0];
      if (isLocale(base)) return base;
    }
  }
  return 'en';
}

export type TranslateVars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Traduit une clé, en substituant les marqueurs `{nom}`. */
  t: (key: TranslationKey, vars?: TranslateVars) => string;
  /** Formate un nombre selon la locale courante. */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Étiquette BCP-47, pour les appels Intl faits hors du contexte. */
  intlTag: string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      // Navigation privée ou stockage refusé : la langue vaut pour la session,
      // ce qui n'a rien de bloquant.
    }
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = DICTIONARIES[locale];
    const intlTag = INTL_TAGS[locale];

    return {
      locale,
      setLocale,
      t: (key, vars) => interpolate(dictionary[key], vars),
      n: (num, options) => num.toLocaleString(intlTag, options),
      intlTag,
    };
  }, [locale, setLocale]);

  // Le titre de l'onglet suit la langue : `index.html` ne peut porter qu'une
  // seule valeur statique, forcément fausse pour trois visiteurs sur quatre.
  useEffect(() => {
    document.title = value.t('app.title');
    document.documentElement.lang = locale;
  }, [value, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n doit être utilisé dans un I18nProvider.');
  return value;
}
