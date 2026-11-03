import { describe, expect, it } from 'vitest';

describe('Space Weather Scales & Severity mapping', () => {
  it('correctly categorizes status levels based on NOAA R, S, G scales', () => {
    const computeStatus = (r, s, g) => {
      const max = Math.max(r, s, g);
      if (max >= 4) return 'EXTREME';
      if (max >= 2) return 'WARNING';
      if (max >= 1) return 'ACTIVE';
      return 'QUIET';
    };

    expect(computeStatus(0, 0, 0)).toBe('QUIET');
    expect(computeStatus(1, 0, 0)).toBe('ACTIVE');
    expect(computeStatus(0, 0, 2)).toBe('WARNING');
    expect(computeStatus(0, 3, 1)).toBe('WARNING');
    expect(computeStatus(4, 0, 1)).toBe('EXTREME');
    expect(computeStatus(0, 0, 5)).toBe('EXTREME');
  });

  it('correctly identifies alert headline prefixes', () => {
    const parseHeadline = (msg) => {
      const lines = msg.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('ALERT:') || line.startsWith('CONTINUED ALERT:')) {
          return { headline: line, severity: 'alert' };
        }
        if (line.startsWith('WARNING:') || line.startsWith('EXTENDED WARNING:')) {
          return { headline: line, severity: 'warning' };
        }
        if (line.startsWith('WATCH:')) {
          return { headline: line, severity: 'watch' };
        }
      }
      return { headline: 'Notice', severity: 'normal' };
    };

    const alertMsg = 'Space Weather Message Code: ALTEF3\nIssue Time: 2026 Nov 02\nALERT: Electron 2MeV Integral Flux Exceeded';
    expect(parseHeadline(alertMsg)).toEqual({
      headline: 'ALERT: Electron 2MeV Integral Flux Exceeded',
      severity: 'alert',
    });

    const warnMsg = 'Space Weather Message Code: WARK04\nWARNING: Geomagnetic K-index of 5 expected';
    expect(parseHeadline(warnMsg)).toEqual({
      headline: 'WARNING: Geomagnetic K-index of 5 expected',
      severity: 'warning',
    });
  });
});
