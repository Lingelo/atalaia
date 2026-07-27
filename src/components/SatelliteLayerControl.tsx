import React from 'react';

import { useI18n } from '../i18n/context';

interface SatelliteLayerControlProps {
  isOn: boolean;
  onToggle: () => void;
  isLoading: boolean;
  detectionCount: number;
}

/**
 * Interrupteur et légende de la couche satellite.
 *
 * Ce composant existe pour une raison éditoriale autant que technique : c'est lui
 * qui porte l'avertissement. Les détections FIRMS sont des anomalies thermiques
 * vues de l'orbite, non confirmées au sol, et fréquemment causées par du brûlage
 * agricole. Le compteur est délibérément tenu À L'ÉCART des totaux nationaux
 * (« ocorrências ativas », « operacionais ») : additionner les deux reviendrait à
 * comparer des effectifs de pompiers avec des points chauds satellite.
 */
export const SatelliteLayerControl: React.FC<SatelliteLayerControlProps> = ({
  isOn,
  onToggle,
  isLoading,
  detectionCount,
}) => {
  const { t, n } = useI18n();

  return (
    <div className="absolute top-4 left-4 z-[400] w-[248px] max-w-[calc(100%-2rem)] rounded border border-[#2D3034] bg-[#16191C]/95 backdrop-blur-md shadow-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isOn}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#1e2021] transition-colors"
      >
        {/* L'anneau creux de la légende reproduit exactement le marqueur tracé sur
            la carte : plein = ocorrência de terrain, creux = détection satellite. */}
        <span
          className="shrink-0 w-4 h-4 rounded-full border-2"
          style={{ borderColor: isOn ? '#8b5cf6' : '#5a5d5f' }}
        />
        <span className="flex-1 min-w-0">
          <span className="block font-['Inter'] text-[13px] font-semibold text-[#e2e2e3]">
            {t('satellite.title')}
          </span>
          <span className="block font-['Inter'] text-[11px] text-[#e5bdb9] tabular-nums">
            {/* « e vizinhança » n'est pas une approximation paresseuse : l'emprise
                est un rectangle, qui déborde sur le Maghreb et l'Italie du Nord.
                Annoncer « PT, ES, FR » serait faux au premier coup d'œil sur la carte. */}
            {isOn
              ? isLoading
                ? t('satellite.loading')
                : t('satellite.count', { count: n(detectionCount) })
              : t('satellite.off')}
          </span>
        </span>
        <span
          className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${
            isOn ? 'bg-[#8b5cf6]' : 'bg-[#3a3d3f]'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              isOn ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>

      {isOn && (
        <div className="px-3 pb-2.5 pt-0 space-y-1.5">
          <p className="font-['Inter'] text-[11px] leading-snug text-[#e5bdb9]/80">
            {t('satellite.disclaimer')}
          </p>
          {/* Sans cette phrase, la bascule densité → foyers reste invisible :
              l'utilisateur n'a aucune raison de deviner qu'il faut zoomer. */}
          <p className="font-['Inter'] text-[11px] leading-snug text-[#8b5cf6]">
            {t('satellite.zoomHint')}
          </p>
        </div>
      )}
    </div>
  );
};
