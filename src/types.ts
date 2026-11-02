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
