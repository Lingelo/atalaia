export type IncidentStatus = 'Em Resolução' | 'Em Curso' | 'Vigilância' | 'Conclusão';

export interface TimelineEvent {
  status: IncidentStatus | string;
  time: string;
  isCurrent?: boolean;
}

export interface BurnedBreakdown {
  forestPct: number;
  matoPct: number;
  agricolaPct: number;
}

export interface Incident {
  id: string;
  title: string;
  locationName: string;
  district: string;
  municipality: string;
  status: IncidentStatus;
  timeAgo: string;
  operacionais: number;
  veiculos: number;
  meiosAereos: number;
  lat: number;
  lng: number;
  burnedAreaHa: number;
  burnedBreakdown: BurnedBreakdown;
  nature: string;
  altitude: number;
  alertSource: string;
  startTime: string;
  history: TimelineEvent[];
  polygonCoords?: Array<[number, number]>;
  isFollowing?: boolean;
}

export interface WatchZone {
  id: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  radiusKm: number;
  condition: 'all' | 'major';
  active: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface MonthlyStat {
  month: string;
  count2024: number;
  countAvg: number;
  burnedHa: number;
}

export interface TopMunicipality {
  name: string;
  ha: number;
  percentage: number;
}

export interface NotableRecord {
  id: string;
  name: string;
  location: string;
  year: number;
  ha: number;
  statusColor: 'primary' | 'outline' | 'tertiary';
}

export interface DistrictIntensity {
  district: string;
  riskLevel: number; // 1 to 4
  incidentsCount: number;
  burnedHa: number;
}

export type ViewTab = 'dashboard' | 'analytics' | 'watch-zones';
export type MapTileLayer = 'dark' | 'satellite' | 'terrain';
