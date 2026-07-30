import { useEffect, useState } from 'react';

/**
 * Sommes-nous au-dessus du point de rupture `md` de Tailwind (768 px) ?
 *
 * POURQUOI ce détour par JavaScript, alors que la mise en page est déjà
 * responsive en CSS pur :
 *
 * Les deux listes latérales sont des feuilles coulissantes sur mobile et des
 * colonnes fixes sur desktop. Leur attribut `aria-hidden` doit suivre la
 * première logique et pas la seconde — or `aria-hidden` est un attribut du DOM,
 * qu'aucune media query ne peut piloter.
 *
 * Le bogue que cela corrige était réel et invisible à l'œil : sur desktop, la
 * liste des sinistres était pleinement affichée tout en portant
 * `aria-hidden="true"`, parce que la feuille mobile est fermée par défaut. Un
 * lecteur d'écran passait donc entièrement à côté de la liste et de sa
 * navigation, sur la seule plateforme où elle est toujours visible.
 */
const QUERY = '(min-width: 768px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const sync = () => setIsDesktop(media.matches);

    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}
