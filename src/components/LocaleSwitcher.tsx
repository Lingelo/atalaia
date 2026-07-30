import React from 'react';

import { LOCALES, LOCALE_LABELS, useI18n, type Locale } from '../i18n/context';

/**
 * Sélecteur de langue.
 *
 * Extrait de `ScopeSwitcher`, où il n'avait rien à faire : le périmètre décrit
 * CE QU'ON REGARDE, la langue décrit COMMENT on le lit. Les avoir groupés
 * laissait aussi entendre qu'ils allaient de pair — qu'afficher l'Espagne
 * basculerait en espagnol, ce qui n'est pas le cas.
 *
 * Sa place dans la barre est délibérément la DERNIÈRE : c'est un réglage qu'on
 * pose une fois, alors que les chiffres et le bouton d'actualisation se
 * consultent en continu. Sur un écran étroit, la barre défile, et c'est ce
 * sélecteur-là qui doit sortir du champ en premier.
 */
export const LocaleSwitcher: React.FC = () => {
  const { t, locale, setLocale } = useI18n();

  return (
    <>
      <label className="sr-only" htmlFor="locale-select">
        {t('lang.label')}
      </label>
      <select
        id="locale-select"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="bg-[#16191C] border border-[#333536] text-[#e2e2e3] text-[12px] rounded px-2 py-1.5 focus:outline-none focus:border-[#ffb3ad]"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </>
  );
};
