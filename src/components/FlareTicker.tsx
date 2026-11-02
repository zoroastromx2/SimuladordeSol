import React, { useState, useEffect, useRef } from 'react';
import {
  SolarFlareMonitor,
  type SolarFlareData,
} from '../core/SolarFlareMonitor';
import type { FlareEvent } from '../types';

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

  useEffect(() => {
    const mon = monitorRef.current!;
    mon.start(45000);

    const unsubscribeFlare = mon.subscribe((data) => {
      setFlareData(data);
      if (data.isClassX && onClassXDetected) {
        onClassXDetected(data);
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
  };

  const handleAddManualM = (e: React.MouseEvent) => {
    e.stopPropagation();
    monitorRef.current?.addManualEvent('M');
  };

  const handleAddManualX = (e: React.MouseEvent) => {
    e.stopPropagation();
    monitorRef.current?.addManualEvent('X');
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
      aria-label="Solar Flare Ticker"
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

      {/* Main marquee / ticker notification message */}
      <div className="flare-ticker-content">
        {isClassX ? (
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
        ) : (
          <div className="flare-normal-ticker">
            <span className="flare-pulse-dot" />
            <span className="flare-ticker-text">
              GOES-18: {flareData.currentClass} (Pico: {flareData.maxClass}) • Flujo:{' '}
              {flareData.flux.toExponential(1)} W/m² • Actividad:{' '}
              {flareData.severity === 'M' ? 'Moderada' : 'Normal / Reposo'}
            </span>
          </div>
        )}
      </div>

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
                      <span>Flujo X-ray: {ev.flux.toExponential(1)} W/m²</span>
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
    </div>
  );
};
