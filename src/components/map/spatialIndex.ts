/**
 * Index spatial en grille, pour ne parcourir que ce qui est à l'écran.
 *
 * POURQUOI il a fallu l'ajouter : la couche satellite est passée de ~1 100
 * foyers (Europe) à ~86 000 (monde). Les deux rendus la parcouraient
 * intégralement à chaque déplacement de carte — une projection par point pour la
 * nappe de densité, un test d'emprise par point pour les anneaux. À l'échelle
 * européenne c'était invisible ; à l'échelle mondiale, cela ajoute des dizaines
 * de millisecondes à chaque `moveend`, et l'utilisateur zoomé sur une vallée
 * paie le prix des 86 000 foyers pour n'en afficher que trois.
 *
 * La grille ramène ce coût à ce qui est réellement visible.
 */

interface Located {
  lat: number;
  lng: number;
}

/**
 * Côté d'une cellule, en degrés.
 *
 * 5° donne ~2 600 cellules peuplées sur un jeu mondial : assez fin pour qu'un
 * zoom sur une vallée n'ouvre qu'une cellule, assez grossier pour que la vue
 * mondiale n'en énumère pas des dizaines de milliers.
 */
const CELL_DEG = 5;

const cellKey = (lat: number, lng: number): number =>
  Math.floor((lat + 90) / CELL_DEG) * 1000 + Math.floor((lng + 180) / CELL_DEG);

export class SpatialIndex<T extends Located> {
  private readonly cells = new Map<number, T[]>();

  constructor(readonly items: T[]) {
    for (const item of items) {
      const key = cellKey(item.lat, item.lng);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(item);
      else this.cells.set(key, [item]);
    }
  }

  /**
   * Les éléments dont la cellule recoupe l'emprise donnée.
   *
   * ⚠️ Résultat SUR-INCLUSIF : une cellule de 5° déborde largement de l'emprise
   * demandée. C'est voulu — l'appelant refiltre au point près, et un index qui
   * se tromperait dans l'autre sens ferait disparaître des foyers de la carte.
   */
  within(minLat: number, minLng: number, maxLat: number, maxLng: number): T[] {
    // Au-delà d'un quart du globe, énumérer les cellules coûte plus cher que de
    // parcourir la liste : la vue mondiale dézoomée est justement le cas où
    // presque tout est visible.
    if (maxLat - minLat > 90 || maxLng - minLng > 180) return this.items;

    const found: T[] = [];
    for (let lat = minLat; lat <= maxLat + CELL_DEG; lat += CELL_DEG) {
      for (let lng = minLng; lng <= maxLng + CELL_DEG; lng += CELL_DEG) {
        const bucket = this.cells.get(cellKey(Math.min(lat, maxLat), Math.min(lng, maxLng)));
        if (bucket) found.push(...bucket);
      }
    }

    // Une même cellule peut être atteinte deux fois par le balayage ci-dessus
    // (bornes rabotées par `Math.min`) : on dédoublonne pour ne pas dessiner
    // deux fois les mêmes foyers, ce qui doublerait leur densité apparente.
    return found.length > this.items.length ? this.items : [...new Set(found)];
  }
}
