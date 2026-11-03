export type ProbeStatus =
  | 'Standby'
  | 'Descending'
  | 'Melt threshold'
  | 'Disintegrating'
  | 'Destroyed';

export type SDOMode = 'procedural' | 'aia171' | 'aia304' | 'aia193' | 'hmib';

export interface SDOArchiveFrame {
  id: string;
  timestamp: string;
  relativeLabel: string;
  url: string;
  isLive: boolean;
}

export interface FlareEvent {
  id: string;
  timestamp: string;
  magnitude: string;
  severity: 'A' | 'B' | 'C' | 'M' | 'X';
  flux: number;
  isSimulated?: boolean;
  activeRegion?: string;
  coords?: {
    x: number; // normalized -1 to 1 on sun disc
    y: number; // normalized -1 to 1 on sun disc
    lat: number;
    lon: number;
  };
}

export interface TelemetryData {
  temperature: number;
  distanceKm: number;
  heatPercentage: number;
  status: ProbeStatus;
  isDropping: boolean;
  isStopped: boolean;
  sdoMode?: SDOMode;
  isAudioMuted?: boolean;
  timelineLabel?: string;
  dynamicCoronaEnabled?: boolean;
}

export interface ProbeThermalAppearance {
  baseColor: [number, number, number];
  emissiveColor: [number, number, number];
  emissiveIntensity: number;
}

export interface SpaceWeatherScaleItem {
  scale: number;
  text: string;
  minorProb?: string | null;
  majorProb?: string | null;
  prob?: string | null;
}

export interface SpaceWeatherScales {
  R: SpaceWeatherScaleItem;
  S: SpaceWeatherScaleItem;
  G: SpaceWeatherScaleItem;
  timeStamp: string;
  dateStamp: string;
}

export interface SpaceWeatherAlert {
  id: string;
  productId: string;
  issueTime: string;
  message: string;
  headline: string;
  severity: 'normal' | 'watch' | 'warning' | 'alert';
}

export type SpaceWeatherStatusLevel = 'QUIET' | 'ACTIVE' | 'WARNING' | 'EXTREME';

export interface SpaceWeatherState {
  scales: SpaceWeatherScales;
  alerts: SpaceWeatherAlert[];
  overallStatus: SpaceWeatherStatusLevel;
  activeAlertCount: number;
  lastUpdated: string;
  isLoading: boolean;
  error: string | null;
}
