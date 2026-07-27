import React from 'react';

import { useI18n } from '../i18n/context';
import { LOCALES, LOCALE_LABELS, type Locale } from '../i18n/context';
import type { ViewScope } from '../types';

interface ScopeSwitcherProps {
  scope: ViewScope;
  onChangeScope: (scope: ViewScope) => void;
}

/**
 * Sélecteur de périmètre et de langue.
 *
 * POURQUOI le périmètre est explicite :
 *
 * La carte couvre le Portugal, l'Espagne et la France, mais les données
 * OPÉRATIONNELLES (effectifs, statuts, chronologie) n'existent qu'au Portugal —
 * vérifié : la Catalogne ne publie ni coordonnées ni effectifs et accuse six
 * jours de retard, la France ne diffuse que des statistiques annuelles.
 *
 * Laisser « 15 ocorrências ativas » surplomber une carte de trois pays laisserait
 * croire que ce chiffre les décrit tous. Le sélecteur rend le périmètre visible
 * et choisi, au lieu d'être subi.
 */
export const ScopeSwitcher: React.FC<ScopeSwitcherProps> = ({ scope, onChangeScope }) => {
  const { t, locale, setLocale } = useI18n();

  const options: Array<{ value: ViewScope; label: string; hint: string }> = [
    { value: 'portugal', label: t('scope.portugal'), hint: t('scope.portugal.hint') },
    { value: 'europe', label: t('scope.europe'), hint: t('scope.europe.hint') },
  ];

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div
        role="group"
        aria-label={t('scope.label')}
        className="flex rounded border border-[#333536] bg-[#16191C] p-0.5"
      >
        {options.map((option) => {
          const isActive = scope === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChangeScope(option.value)}
              aria-pressed={isActive}
              title={option.hint}
              className={`px-2.5 py-1 rounded text-[12px] font-semibold transition-colors ${
                isActive
                  ? 'bg-[#ffb3ad] text-[#680009]'
                  : 'text-[#e5bdb9] hover:text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

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
    </div>
  );
};
