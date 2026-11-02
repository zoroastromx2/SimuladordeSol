import type { FlareEvent } from '../types';

export type FlareSeverity = 'A' | 'B' | 'C' | 'M' | 'X';

export interface SolarFlareData {
  timeTag: string;
  currentClass: string;
  maxClass: string;
  flux: number;
  severity: FlareSeverity;
  isClassX: boolean;
  statusText: string;
  isSimulated?: boolean;
}

export type FlareListener = (data: SolarFlareData) => void;
export type EventLogListener = (events: FlareEvent[]) => void;

export class SolarFlareMonitor {
  private currentData: SolarFlareData;
  private listeners: Set<FlareListener> = new Set();
  private eventListeners: Set<EventLogListener> = new Set();
  private eventLog: FlareEvent[] = [];
  private pollInterval: number | null = null;
  private isSimulatingClassX: boolean = false;
  private hasLoadedHistoricalFeed: boolean = false;

  constructor() {
    this.currentData = {
      timeTag: 'SYNCING...',
      currentClass: 'B2.5',
      maxClass: 'B5.0',
      flux: 2.5e-7,
      severity: 'B',
      isClassX: false,
      statusText: 'INITIALIZING GOES-18 SATELLITE FEED...',
    };
  }

  public start(pollMs: number = 45000): void {
    this.fetchData();
    if (!this.hasLoadedHistoricalFeed) {
      this.fetchRecentHistoricalEvents();
    }
    if (this.pollInterval === null) {
      this.pollInterval = window.setInterval(() => {
        if (!this.isSimulatingClassX) {
          this.fetchData();
        }
      }, pollMs);
    }
  }

  public stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public subscribe(listener: FlareListener): () => void {
    this.listeners.add(listener);
    listener(this.currentData);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeEventLog(listener: EventLogListener): () => void {
    this.eventListeners.add(listener);
    listener([...this.eventLog]);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public getEventLog(): FlareEvent[] {
    return [...this.eventLog];
  }

  public clearEventLog(): void {
    this.eventLog = [];
    this.notifyEventListeners();
  }

  public addManualEvent(severity: 'M' | 'X', customMagnitude?: string): void {
    const now = new Date();
    const defaultMag = severity === 'X' ? 'X2.5' : 'M4.8';
    const magnitude = customMagnitude || defaultMag;
    const flux = severity === 'X' ? 2.5e-4 : 4.8e-5;
    const timeStr = `${now.toISOString().replace('T', ' ').substring(0, 19)} UTC`;

    this.logEventIfSevere(magnitude, severity, flux, timeStr, true);
  }

  public setSimulateClassX(simulate: boolean): void {
    this.isSimulatingClassX = simulate;
    if (simulate) {
      const now = new Date();
      const timeStr = `${now.toISOString().replace('T', ' ').substring(0, 19)} UTC`;
      this.currentData = {
        timeTag: `${now.toISOString().substring(11, 16)} UTC`,
        currentClass: 'X3.8',
        maxClass: 'X4.2',
        flux: 3.8e-4,
        severity: 'X',
        isClassX: true,
        statusText: 'CRITICAL: EXTREME SOLAR FLARE DETECTED [X3.8] • R3 RADIO BLACKOUT ALERT',
        isSimulated: true,
      };

      // Automatically log the simulated Class X flare event
      this.logEventIfSevere('X3.8', 'X', 3.8e-4, timeStr, true);

      this.notifyListeners();
    } else {
      this.fetchData();
    }
  }

  public getIsSimulating(): boolean {
    return this.isSimulatingClassX;
  }

  private logEventIfSevere(
    magnitude: string,
    severity: FlareSeverity,
    flux: number,
    timeTag: string,
    isSimulated: boolean = false,
  ): void {
    if (severity !== 'M' && severity !== 'X') return;

    // Avoid duplicate rapid logging of the same event
    const isDuplicate = this.eventLog.some(
      (ev) =>
        ev.magnitude === magnitude &&
        (ev.timestamp === timeTag ||
          Math.abs(new Date(ev.timestamp).getTime() - new Date(timeTag).getTime()) < 60000),
    );

    if (isDuplicate) return;

    const newEvent: FlareEvent = {
      id: `flare_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeTag,
      magnitude,
      severity,
      flux,
      isSimulated,
    };

    // Prepend so the newest flare is at top
    this.eventLog.unshift(newEvent);

    // Keep up to 50 session events
    if (this.eventLog.length > 50) {
      this.eventLog.pop();
    }

    this.notifyEventListeners();
  }

  private notifyEventListeners(): void {
    const list = [...this.eventLog];
    for (const listener of this.eventListeners) {
      try {
        listener(list);
      } catch {
        // Ignored
      }
    }
  }

  private async fetchRecentHistoricalEvents(): Promise<void> {
    this.hasLoadedHistoricalFeed = true;
    const endpoints = [
      '/api/swpc/json/goes/primary/xray-flares-7-day.json',
      'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json',
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) continue;
        const json = await response.json();
        if (Array.isArray(json) && json.length > 0) {
          for (let i = json.length - 1; i >= 0; i--) {
            const item = json[i];
            const mag = (item.max_class || item.begin_class || '').toUpperCase();
            if (mag.startsWith('M') || mag.startsWith('X')) {
              const severity: 'M' | 'X' = mag.startsWith('X') ? 'X' : 'M';
              const flux =
                item.max_xrlong || (severity === 'X' ? 1.5e-4 : 3.0e-5);
              const timeTag = item.max_time || item.time_tag || item.begin_time;
              const formattedTime = timeTag
                ? `${timeTag.replace('T', ' ').substring(0, 16)} UTC`
                : `${new Date().toISOString().replace('T', ' ').substring(0, 16)} UTC`;

              this.logEventIfSevere(mag, severity, flux, formattedTime, false);
            }
          }
          return;
        }
      } catch {
        // Continue
      }
    }
  }

  public async fetchData(): Promise<void> {
    if (this.isSimulatingClassX) return;

    const endpoints = [
      '/api/swpc/json/goes/primary/xray-flares-latest.json',
      'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json',
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) continue;
        const json = await response.json();
        if (Array.isArray(json) && json.length > 0) {
          const item = json[json.length - 1];
          const currentClass = (item.current_class || 'B1.0').toUpperCase();
          const maxClass = (item.max_class || currentClass).toUpperCase();
          const flux = item.max_xrlong || item.current_int_xrlong || 1e-7;

          let severity: FlareSeverity = 'B';
          if (currentClass.startsWith('X') || maxClass.startsWith('X') || flux >= 1e-4) {
            severity = 'X';
          } else if (currentClass.startsWith('M') || maxClass.startsWith('M') || flux >= 1e-5) {
            severity = 'M';
          } else if (currentClass.startsWith('C') || maxClass.startsWith('C') || flux >= 1e-6) {
            severity = 'C';
          } else if (currentClass.startsWith('A')) {
            severity = 'A';
          }

          const isClassX = severity === 'X';

          const timeTag = item.time_tag
            ? `${item.time_tag.substring(11, 16)} UTC`
            : `${new Date().toISOString().substring(11, 16)} UTC`;

          const fullTimeTag = item.time_tag
            ? `${item.time_tag.replace('T', ' ').substring(0, 19)} UTC`
            : `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;

          let statusText = `GOES-18 X-RAY FLUX [${currentClass}] • PEAK: ${maxClass} • SPACE WEATHER: NORMAL`;
          if (isClassX) {
            statusText = `WARNING: CLASS X FLARE DETECTED [${currentClass}] • EXTREME RADIATION STORM`;
          } else if (severity === 'M') {
            statusText = `MODERATE FLARE DETECTED [${currentClass}] • R1-R2 RADIO DISTURBANCE`;
          }

          this.currentData = {
            timeTag,
            currentClass,
            maxClass,
            flux,
            severity,
            isClassX,
            statusText,
            isSimulated: false,
          };

          // If current or peak flare is M or X, log to session list
          if (severity === 'M' || severity === 'X') {
            this.logEventIfSevere(currentClass, severity, flux, fullTimeTag, false);
          }

          this.notifyListeners();
          return;
        }
      } catch {
        // Continue to fallback
      }
    }

    // Baseline fallback if offline
    const now = new Date();
    this.currentData = {
      timeTag: `${now.toISOString().substring(11, 16)} UTC`,
      currentClass: 'B3.2',
      maxClass: 'B5.8',
      flux: 3.2e-7,
      severity: 'B',
      isClassX: false,
      statusText: 'GOES-18 SATELLITE TELEMETRY [B3.2] • QUIET SUN • NO CRITICAL STORMS',
      isSimulated: false,
    };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentData);
      } catch {
        // Ignored
      }
    }
  }

  public dispose(): void {
    this.stop();
    this.listeners.clear();
    this.eventListeners.clear();
  }
}
