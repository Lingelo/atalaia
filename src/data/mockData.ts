import { WatchZone, MonthlyStat, TopMunicipality, NotableRecord, DistrictIntensity } from '../types';

// ⚠️ DONNÉES DE MAQUETTE — pas des données réelles.
//
// INITIAL_INCIDENTS a été supprimé : les incidents viennent désormais de
// l'API via `useActiveIncidents`. Ce qui reste ci-dessous alimente encore la vue
// Analytics et les zones de surveillance, faute d'une couche de persistance :
//   - l'historique (151 063 incidents) suppose une ingestion en base locale ;
//   - les zones de surveillance supposent un stockage côté utilisateur.
// Tant que ces deux chantiers ne sont pas faits, ces écrans MENTENT à l'utilisateur.


export const INITIAL_WATCH_ZONES: WatchZone[] = [
  {
    id: 'zone-1',
    name: 'Casa — Marmelete, Monchique',
    locationName: 'Monchique, Faro',
    lat: 37.3167,
    lng: -8.6333,
    radiusKm: 10,
    condition: 'all',
    active: true,
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
  },
  {
    id: 'zone-2',
    name: 'Armazém — Loulé',
    locationName: 'Loulé, Faro',
    lat: 37.1397,
    lng: -8.0214,
    radiusKm: 5,
    condition: 'major',
    active: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00',
  },
];

export const MONTHLY_HISTORICAL_STATS: MonthlyStat[] = [
  { month: 'Jan', count2024: 120, countAvg: 180, burnedHa: 450 },
  { month: 'Fev', count2024: 210, countAvg: 250, burnedHa: 890 },
  { month: 'Mar', count2024: 380, countAvg: 410, burnedHa: 1800 },
  { month: 'Abr', count2024: 520, countAvg: 580, burnedHa: 3200 },
  { month: 'Mai', count2024: 890, countAvg: 920, burnedHa: 7100 },
  { month: 'Jun', count2024: 1840, countAvg: 1650, burnedHa: 19500 },
  { month: 'Jul', count2024: 3950, countAvg: 3100, burnedHa: 68400 },
  { month: 'Ago', count2024: 4820, countAvg: 4200, burnedHa: 112000 },
  { month: 'Set', count2024: 3100, countAvg: 2800, burnedHa: 42000 },
  { month: 'Out', count2024: 1250, countAvg: 1100, burnedHa: 12800 },
  { month: 'Nov', count2024: 420, countAvg: 390, burnedHa: 1900 },
  { month: 'Dez', count2024: 180, countAvg: 210, burnedHa: 620 },
];

export const TOP_MUNICIPALITIES: TopMunicipality[] = [
  { name: 'Covilhã', ha: 32400, percentage: 100 },
  { name: 'Mação', ha: 27500, percentage: 85 },
  { name: 'Monchique', ha: 25300, percentage: 78 },
  { name: 'Vila de Rei', ha: 19400, percentage: 60 },
  { name: 'Proença-a-Nova', ha: 14600, percentage: 45 },
  { name: 'Sertã', ha: 12800, percentage: 39 },
  { name: 'Arganil', ha: 11200, percentage: 34 },
  { name: 'Odemira', ha: 9800, percentage: 30 },
];

export const NOTABLE_HISTORICAL_RECORDS: NotableRecord[] = [
  {
    id: 'rec-1',
    name: 'Serra da Estrela',
    location: 'Covilhã / Guarda',
    year: 2022,
    ha: 28112,
    statusColor: 'primary',
  },
  {
    id: 'rec-2',
    name: 'Monchique',
    location: 'Faro',
    year: 2018,
    ha: 27734,
    statusColor: 'outline',
  },
  {
    id: 'rec-3',
    name: 'Mação / Vila de Rei',
    location: 'Santarém',
    year: 2019,
    ha: 9249,
    statusColor: 'outline',
  },
  {
    id: 'rec-4',
    name: 'Odemira e Monchique',
    location: 'Beja / Faro',
    year: 2023,
    ha: 8400,
    statusColor: 'tertiary',
  },
];

export const DISTRICT_INTENSITY: DistrictIntensity[] = [
  { district: 'Guarda', riskLevel: 4, incidentsCount: 4200, burnedHa: 142000 },
  { district: 'Castelo Branco', riskLevel: 4, incidentsCount: 5100, burnedHa: 185000 },
  { district: 'Faro', riskLevel: 3, incidentsCount: 3800, burnedHa: 98000 },
  { district: 'Coimbra', riskLevel: 3, incidentsCount: 4600, burnedHa: 89000 },
  { district: 'Viseu', riskLevel: 3, incidentsCount: 6200, burnedHa: 112000 },
  { district: 'Vila Real', riskLevel: 2, incidentsCount: 3900, burnedHa: 64000 },
  { district: 'Bragança', riskLevel: 2, incidentsCount: 2800, burnedHa: 45000 },
  { district: 'Santarém', riskLevel: 2, incidentsCount: 3100, burnedHa: 52000 },
  { district: 'Porto', riskLevel: 1, incidentsCount: 2900, burnedHa: 18000 },
  { district: 'Lisboa', riskLevel: 1, incidentsCount: 1500, burnedHa: 4200 },
];
