import React, { useState, useEffect, useRef } from 'react';
import {
  SolarFlareMonitor,
  type SolarFlareData,
} from '../core/SolarFlareMonitor';
import type { FlareEvent } from '../types';
import { FlareHeatmap } from './FlareHeatmap';
import { FlareTrendChart } from './FlareTrendChart';
import { SolarSoundscape } from './SolarSoundscape';
import { SolarSoundscapeGenerator } from '../core/SolarSoundscapeGenerator';

interface FlareTickerProps {
  monitor?: SolarFlareMonitor;
  onClassXDetected?: (data: SolarFlareData) => void;
}

export const FlareTicker: React.FC<FlareTickerProps> = ({
  monitor,
  onClassXDetected,
}) => {
  const monitorRef = useRef<SolarFlareMonitor | null>(null);
  if (!monitorRef.current) {
    monitorRef.current = monitor ?? new SolarFlareMonitor();
  }

  const soundscapeRef = useRef<SolarSoundscapeGenerator | null>(null);
  if (!soundscapeRef.current) {
    soundscapeRef.current = new SolarSoundscapeGenerator();
  }

  const [flareData, setFlareData] = useState<SolarFlareData>({
    timeTag: 'SYNCING...',
    currentClass: 'B2.5',
    maxClass: 'B5.0',
    flux: 2.5e-7,
    severity: 'B',
    isClassX: false,
    statusText: 'CONNECTING TO GOES-18 REAL-TIME X-RAY TELEMETRY...',
  });

  const [events, setEvents] = useState<FlareEvent[]>([]);
  const [isLogExpanded, setIsLogExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ticker' | 'heatmap' | 'trend' | 'soundscape'>('ticker');

  useEffect(() => {
    const mon = monitorRef.current!;
    mon.start(45000);

    const unsubscribeFlare = mon.subscribe((data) => {
      setFlareData(data);
      if (data.isClassX) {
        if (onClassXDetected) onClassXDetected(data);
        soundscapeRef.current?.triggerFlareChime(data.currentClass, 'X');
      }
    });

    const unsubscribeLog = mon.subscribeEventLog((updatedEvents) => {
      setEvents(updatedEvents);
    });

    return () => {
      unsubscribeFlare();
      unsubscribeLog();
    };
  }, [onClassXDetected]);

  const handleToggleSimulate = () => {
    const mon = monitorRef.current!;
    const isSim = mon.getIsSimulating();
    mon.setSimulateClassX(!isSim);
    if (!isSim) {
      soundscapeRef.current?.triggerFlareChime('X3.8', 'X');
    }
  };

  const handleAddManualM = (e: React.MouseEvent) => {
    e.stopPropagation();
    monitorRef.current?.addManualEvent('M');
    soundscapeRef.current?.triggerFlareChime('M4.8', 'M');
  };

  const handleAddManualX = (e: React.MouseEvent) => {
    e.stopPropagation();
    monitorRef.current?.addManualEvent('X');
    soundscapeRef.current?.triggerFlareChime('X2.5', 'X');
  };

  const handleClearLog = (e: React.MouseEvent) => {
    e.stopPropagation();
    monitorRef.current?.clearEventLog();
  };

  const isClassX = flareData.isClassX;

  return (
    <div
      className={`flare-ticker-container ${isClassX ? 'flare-alert-x' : ''}`}
      role="region"
      aria-label="Solar Flare Ticker, Heatmap, Activity Trend and Soundscape"
    >
      {/* Top status bar */}
      <div className="flare-ticker-top">
        <div className="flare-ticker-badge-row">
          <span className={`flare-class-badge badge-${flareData.severity.toLowerCase()}`}>
            {isClassX ? '⚠ CLASS X ALERT' : `FLARE CLASS: ${flareData.currentClass}`}
          </span>
          <span className="flare-time-tag">{flareData.timeTag}</span>
        </div>
        <button
          type="button"
          className={`flare-sim-btn ${flareData.isSimulated ? 'sim-active' : ''}`}
          onClick={handleToggleSimulate}
          title={
            flareData.isSimulated
              ? 'Volver a datos en vivo de GOES-18'
              : 'Simular detección de erupción Clase X'
          }
          aria-label="Simular erupción Clase X"
        >
          {flareData.isSimulated ? 'VOLVER A VIVO' : 'SIMULAR CLASE X'}
        </button>
      </div>

      {/* View navigation switcher */}
      <div className="flare-nav-tabs" role="tablist" aria-label="Flare Panel View">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ticker'}
          className={`flare-nav-tab ${activeTab === 'ticker' ? 'active' : ''}`}
          onClick={() => setActiveTab('ticker')}
        >
          TELEMETRÍA
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'heatmap'}
          className={`flare-nav-tab ${activeTab === 'heatmap' ? 'active' : ''}`}
          onClick={() => setActiveTab('heatmap')}
        >
          MAPA TÉRMICO
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'trend'}
          className={`flare-nav-tab ${activeTab === 'trend' ? 'active' : ''}`}
          onClick={() => setActiveTab('trend')}
        >
          TENDENCIA 24H
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'soundscape'}
          className={`flare-nav-tab ${activeTab === 'soundscape' ? 'active' : ''}`}
          onClick={() => setActiveTab('soundscape')}
        >
          SONIDO
        </button>
      </div>

      {/* Critical Class X Emergency Warning (Always visible if active) */}
      {isClassX && (
        <div className="flare-warning-banner">
          <span className="flare-warning-icon">⚠</span>
          <div className="flare-warning-message">
            <strong>ADVERTENCIA: FULGURACIÓN SOLAR CLASE {flareData.currentClass} DETECTADA</strong>
            <p>
              Flujo extremo de rayos X ({flareData.flux.toExponential(1)} W/m²). Alerta de
              bloqueo de radio HF (R3) y tormenta de radiación coronal.
            </p>
          </div>
        </div>
      )}

      {/* Tab 1: Live Ticker Feed & Collapsible Log */}
      {activeTab === 'ticker' && (
        <>
          {!isClassX && (
            <div className="flare-ticker-content">
              <div className="flare-normal-ticker">
                <span className="flare-pulse-dot" />
                <span className="flare-ticker-text">
                  GOES-18: {flareData.currentClass} (Pico: {flareData.maxClass}) • Flujo:{' '}
                  {flareData.flux.toExponential(1)} W/m² • Actividad:{' '}
                  {flareData.severity === 'M' ? 'Moderada' : 'Normal / Reposo'}
                </span>
              </div>
            </div>
          )}

          {/* Collapsible Class M & X Flare Event Log */}
          <div className="flare-log-section">
            <button
              type="button"
              className="flare-log-toggle-btn"
              onClick={() => setIsLogExpanded(!isLogExpanded)}
              aria-expanded={isLogExpanded}
              aria-controls="flare-events-log-panel"
            >
              <div className="flare-log-toggle-left">
                <span className="flare-log-chevron">{isLogExpanded ? '▾' : '▸'}</span>
                <span className="flare-log-title">REGISTRO DE FULGURACIONES M &amp; X</span>
                <span className={`flare-log-count ${events.length > 0 ? 'has-events' : ''}`}>
                  {events.length}
                </span>
              </div>
              <span className="flare-log-toggle-hint">
                {isLogExpanded ? 'OCULTAR' : 'VER LOG'}
              </span>
            </button>

            {isLogExpanded && (
              <div id="flare-events-log-panel" className="flare-log-body">
                <div className="flare-log-toolbar">
                  <span className="flare-log-caption">
                    {events.length} EVENTO{events.length === 1 ? '' : 'S'} EN SESIÓN
                  </span>
                  <div className="flare-log-actions">
                    <button
                      type="button"
                      className="flare-log-mini-btn"
                      onClick={handleAddManualM}
                      title="Registrar fulguración de prueba Clase M"
                    >
                      + TEST M
                    </button>
                    <button
                      type="button"
                      className="flare-log-mini-btn btn-x"
                      onClick={handleAddManualX}
                      title="Registrar fulguración de prueba Clase X"
                    >
                      + TEST X
                    </button>
                    {events.length > 0 && (
                      <button
                        type="button"
                        className="flare-log-mini-btn btn-clear"
                        onClick={handleClearLog}
                        title="Limpiar registro de la sesión"
                      >
                        LIMPIAR
                      </button>
                    )}
                  </div>
                </div>

                {events.length === 0 ? (
                  <div className="flare-log-empty">
                    Sin fulguraciones Clase M o X detectadas en esta sesión.
                  </div>
                ) : (
                  <ul className="flare-log-list">
                    {events.map((ev) => (
                      <li
                        key={ev.id}
                        className={`flare-log-item item-${ev.severity.toLowerCase()}`}
                      >
                        <div className="flare-log-item-header">
                          <span className={`flare-item-badge badge-${ev.severity.toLowerCase()}`}>
                            {ev.magnitude}
                          </span>
                          <span className="flare-item-time">{ev.timestamp}</span>
                        </div>
                        <div className="flare-log-item-details">
                          <span>
                            {ev.activeRegion ? `${ev.activeRegion} • ` : ''}Flujo:{' '}
                            {ev.flux.toExponential(1)} W/m²
                          </span>
                          {ev.isSimulated && (
                            <span className="flare-item-sim-tag">[SIMULADO]</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Flare Heatmap on Miniature Sun Representation */}
      {activeTab === 'heatmap' && (
        <FlareHeatmap
          events={events}
          onAddTestEvent={(sev) => {
            monitorRef.current?.addManualEvent(sev);
            soundscapeRef.current?.triggerFlareChime(sev === 'X' ? 'X2.5' : 'M4.8', sev);
          }}
        />
      )}

      {/* Tab 3: 24-Hour Flare Activity Trend Recharts Visualization */}
      {activeTab === 'trend' && (
        <FlareTrendChart
          sessionEvents={events}
          onAddTestEvent={(sev) => {
            monitorRef.current?.addManualEvent(sev);
            soundscapeRef.current?.triggerFlareChime(sev === 'X' ? 'X2.5' : 'M4.8', sev);
          }}
        />
      )}

      {/* Tab 4: Solar Soundscape Audio Generator */}
      {activeTab === 'soundscape' && (
        <SolarSoundscape
          soundscapeGenerator={soundscapeRef.current}
          currentSeverity={flareData.severity}
          currentFlux={flareData.flux}
          recentEvents={events}
        />
      )}
    </div>
  );
};
