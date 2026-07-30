import React from 'react';

import { useI18n } from '../i18n/context';
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
 * Laisser « 15 ocorrências ativas » surplomber une carte de plusieurs pays
 * laisserait croire que ce chiffre les décrit tous. Le sélecteur rend le
 * périmètre visible et choisi, au lieu d'être subi.
 *
 * Trois périmètres opérationnels et un satellite. La séparation ne vient plus
 * d'une absence de données espagnoles — Andalousie, Catalogne et
 * Castille-et-León en publient — mais de la différence de NATURE entre un
 * sinistre confirmé au sol et une anomalie thermique vue de l'orbite.
 *
 * ⚠️ Le mode Espagne ne couvre que trois communautés autonomes : il n'existe pas
 * de flux national. L'infobulle le dit, et le bandeau des sources le détaille.
 */
export const ScopeSwitcher: React.FC<ScopeSwitcherProps> = ({ scope, onChangeScope }) => {
  const { t } = useI18n();

  const options: Array<{ value: ViewScope; label: string; hint: string }> = [
    { value: 'iberia', label: t('scope.iberia'), hint: t('scope.iberia.hint') },
    { value: 'portugal', label: t('scope.portugal'), hint: t('scope.portugal.hint') },
    { value: 'spain', label: t('scope.spain'), hint: t('scope.spain.hint') },
    { value: 'world', label: t('scope.world'), hint: t('scope.world.hint') },
  ];

  return (
    <div className="flex items-center shrink-0">
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

    </div>
  );
};
