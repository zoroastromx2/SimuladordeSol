export type ProbeStatus = 'Standby' | 'Descending' | 'Melt threshold';

export interface TelemetryData {
  temperature: number;
  distanceKm: number;
  heatPercentage: number;
  status: ProbeStatus;
  isDropping: boolean;
  isStopped: boolean;
}

export interface ProbeThermalAppearance {
  baseColor: [number, number, number];
  emissiveColor: [number, number, number];
  emissiveIntensity: number;
}
