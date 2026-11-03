import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SpaceWeatherState,
  SpaceWeatherScales,
  SpaceWeatherAlert,
  SpaceWeatherStatusLevel,
} from '../types';

const INITIAL_SCALES: SpaceWeatherScales = {
  R: { scale: 0, text: 'none' },
  S: { scale: 0, text: 'none' },
  G: { scale: 0, text: 'none' },
  dateStamp: new Date().toISOString().slice(0, 10),
  timeStamp: '00:00:00',
};

const DEFAULT_STATE: SpaceWeatherState = {
  scales: INITIAL_SCALES,
  alerts: [],
  overallStatus: 'QUIET',
  activeAlertCount: 0,
  lastUpdated: 'SYNCING...',
  isLoading: true,
  error: null,
};

interface RawScaleItem {
  Scale?: string | number;
  Text?: string;
  MinorProb?: string | null;
  MajorProb?: string | null;
  Prob?: string | null;
}

interface RawScalesResponse {
  [key: string]: {
    DateStamp?: string;
    TimeStamp?: string;
    R?: RawScaleItem;
    S?: RawScaleItem;
    G?: RawScaleItem;
  };
}

interface RawAlertItem {
  product_id?: string;
  issue_datetime?: string;
  message?: string;
}

export function useSpaceWeather(pollIntervalMs: number = 45000) {
  const [state, setState] = useState<SpaceWeatherState>(DEFAULT_STATE);
  const [simulatedStatus, setSimulatedStatus] = useState<SpaceWeatherStatusLevel | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const parseAlertHeadline = (message: string): { headline: string; severity: SpaceWeatherAlert['severity'] } => {
    const lines = message.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let headline = 'Space Weather Notice';
    let severity: SpaceWeatherAlert['severity'] = 'normal';

    for (const line of lines) {
      if (line.startsWith('ALERT:') || line.startsWith('CONTINUED ALERT:')) {
        headline = line;
        severity = 'alert';
        break;
      }
      if (line.startsWith('WARNING:') || line.startsWith('EXTENDED WARNING:')) {
        headline = line;
        severity = 'warning';
        break;
      }
      if (line.startsWith('WATCH:')) {
        headline = line;
        severity = 'watch';
        break;
      }
      if (line.startsWith('SUMMARY:')) {
        headline = line;
        severity = 'normal';
        break;
      }
    }

    if (headline === 'Space Weather Notice' && lines.length > 3) {
      headline = lines[3];
    }

    return { headline, severity };
  };

  const fetchSpaceWeatherData = useCallback(async () => {
    let rawScales: RawScalesResponse | null = null;
    let rawAlerts: RawAlertItem[] = [];
    let fetchError: string | null = null;

    // 1. Fetch NOAA Scales (Current R, S, G)
    const scaleEndpoints = [
      '/api/swpc/products/noaa-scales.json',
      'https://services.swpc.noaa.gov/products/noaa-scales.json',
    ];

    for (const url of scaleEndpoints) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) {
          rawScales = await res.json();
          break;
        }
      } catch {
        // Fallback to next endpoint
      }
    }

    // 2. Fetch NOAA SWPC Alerts
    const alertEndpoints = [
      '/api/swpc/products/alerts.json',
      'https://services.swpc.noaa.gov/products/alerts.json',
    ];

    for (const url of alertEndpoints) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) {
          rawAlerts = await res.json();
          break;
        }
      } catch (err) {
        fetchError = err instanceof Error ? err.message : 'Error fetching alerts';
      }
    }

    // Process Scales
    let scales: SpaceWeatherScales = INITIAL_SCALES;
    if (rawScales && rawScales['0']) {
      const current = rawScales['0'];
      scales = {
        R: {
          scale: Number(current.R?.Scale) || 0,
          text: current.R?.Text || 'none',
          minorProb: current.R?.MinorProb,
          majorProb: current.R?.MajorProb,
        },
        S: {
          scale: Number(current.S?.Scale) || 0,
          text: current.S?.Text || 'none',
          prob: current.S?.Prob,
        },
        G: {
          scale: Number(current.G?.Scale) || 0,
          text: current.G?.Text || 'none',
        },
        dateStamp: current.DateStamp || new Date().toISOString().slice(0, 10),
        timeStamp: current.TimeStamp || '00:00:00',
      };
    }

    // Process Alerts (Take top 15 recent alerts)
    const parsedAlerts: SpaceWeatherAlert[] = [];
    if (Array.isArray(rawAlerts)) {
      for (const item of rawAlerts.slice(0, 15)) {
        const message = item.message || '';
        const { headline, severity } = parseAlertHeadline(message);
        parsedAlerts.push({
          id: `swpc_${item.product_id || 'item'}_${item.issue_datetime || Date.now()}`,
          productId: item.product_id || 'SWPC',
          issueTime: item.issue_datetime || 'N/A',
          message,
          headline,
          severity,
        });
      }
    }

    // Determine Overall Status Level
    const maxScale = Math.max(scales.R.scale, scales.S.scale, scales.G.scale);
    let computedStatus: SpaceWeatherStatusLevel = 'QUIET';

    if (maxScale >= 4) {
      computedStatus = 'EXTREME';
    } else if (maxScale >= 2 || parsedAlerts.some((a) => a.severity === 'warning' && !a.headline.includes('CANCEL'))) {
      computedStatus = 'WARNING';
    } else if (maxScale >= 1 || parsedAlerts.some((a) => a.severity === 'alert' || a.severity === 'watch')) {
      computedStatus = 'ACTIVE';
    }

    const now = new Date();
    const utcTime = now.toTimeString().split(' ')[0] + ' UTC';

    setState({
      scales,
      alerts: parsedAlerts,
      overallStatus: computedStatus,
      activeAlertCount: parsedAlerts.filter((a) => a.severity !== 'normal').length,
      lastUpdated: utcTime,
      isLoading: false,
      error: fetchError,
    });
  }, []);

  useEffect(() => {
    fetchSpaceWeatherData();

    pollTimerRef.current = window.setInterval(() => {
      fetchSpaceWeatherData();
    }, pollIntervalMs);

    return () => {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchSpaceWeatherData, pollIntervalMs]);

  // Handle simulation overlay for testing
  const effectiveStatus: SpaceWeatherStatusLevel =
    simulatedStatus !== null ? simulatedStatus : state.overallStatus;

  const simulateStorm = (level: SpaceWeatherStatusLevel | null) => {
    setSimulatedStatus(level);
  };

  return {
    ...state,
    overallStatus: effectiveStatus,
    isSimulated: simulatedStatus !== null,
    simulateStorm,
    refetch: fetchSpaceWeatherData,
  };
}
