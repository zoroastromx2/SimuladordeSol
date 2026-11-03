import React, { useState } from 'react';
import type { useSpaceWeather } from '../hooks/useSpaceWeather';
import type { SpaceWeatherStatusLevel } from '../types';

interface SpaceWeatherBadgeProps {
  weather: ReturnType<typeof useSpaceWeather>;
}

export const SpaceWeatherBadge: React.FC<SpaceWeatherBadgeProps> = ({ weather }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const {
    scales,
    alerts,
    overallStatus,
    activeAlertCount,
    lastUpdated,
    isLoading,
    isSimulated,
    simulateStorm,
    refetch,
  } = weather;

  // Status visual attributes
  const statusConfig: Record<
    SpaceWeatherStatusLevel,
    { label: string; color: string; badgeClass: string; desc: string }
  > = {
    QUIET: {
      label: 'TRANQUILO // EN REPOSO',
      color: '#39e58c',
      badgeClass: 'status-quiet',
      desc: 'Condiciones geomagnéticas y de radiación nominales en el entorno orbital terrestre.',
    },
    ACTIVE: {
      label: 'ACTIVIDAD DETECTADA',
      color: '#ffb347',
      badgeClass: 'status-active',
      desc: 'Perturbaciones menores o alertas ionosféricas en curso.',
    },
    WARNING: {
      label: 'ALERTA DE TORMENTA',
      color: '#ff7722',
      badgeClass: 'status-warning',
      desc: 'Tormenta geomagnética o bloqueo de radio HF moderado a fuerte en progreso.',
    },
    EXTREME: {
      label: 'EVENTO SOLAR EXTREMO',
      color: '#ff2222',
      badgeClass: 'status-extreme',
      desc: 'Tormenta geomagnética severa (G4-G5) o tormenta de radiación coronal crítica.',
    },
  };

  const currentCfg = statusConfig[overallStatus] || statusConfig.QUIET;

  const toggleAlertExpand = (id: string) => {
    setExpandedAlertId(expandedAlertId === id ? null : id);
  };

  return (
    <div className="space-weather-wrapper">
      {/* HUD Pill Badge */}
      <button
        type="button"
        className={`space-weather-badge ${currentCfg.badgeClass} ${isOpen ? 'badge-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ver estado de clima espacial de NOAA SWPC"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span
          className="sw-status-dot"
          style={{
            background: currentCfg.color,
            boxShadow: `0 0 7px ${currentCfg.color}`,
          }}
        />
        <div className="sw-badge-text">
          <span className="sw-badge-prefix">CLIMA ESPACIAL</span>
          <span className="sw-badge-status">{currentCfg.label}</span>
        </div>
        <div className="sw-scales-pill">
          <span>R{scales.R.scale}</span>
          <span>S{scales.S.scale}</span>
          <span>G{scales.G.scale}</span>
        </div>
        {activeAlertCount > 0 && (
          <span className="sw-alerts-count" title={`${activeAlertCount} alertas activas de NOAA`}>
            {activeAlertCount}
          </span>
        )}
      </button>

      {/* Expandable Space Weather Telemetry Popover */}
      {isOpen && (
        <div
          className="space-weather-popover"
          role="dialog"
          aria-label="Panel de Clima Espacial NOAA SWPC"
        >
          {/* Header */}
          <div className="sw-popover-header">
            <div className="sw-popover-title-group">
              <span className="sw-popover-title">NOAA SWPC // CLIMA ESPACIAL</span>
              <span className="sw-popover-sub">
                RED DE SATÉLITES GOES &amp; DSCOVR • {lastUpdated}
              </span>
            </div>
            <button
              type="button"
              className="sw-popover-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar panel de clima espacial"
            >
              ✕
            </button>
          </div>

          {/* Current Overall Status Banner */}
          <div
            className="sw-status-banner"
            style={{
              borderColor: currentCfg.color,
              background: `linear-gradient(135deg, ${currentCfg.color}15, rgba(12, 10, 9, 0.9))`,
            }}
          >
            <div className="sw-banner-left">
              <span
                className="sw-banner-dot"
                style={{
                  background: currentCfg.color,
                  boxShadow: `0 0 8px ${currentCfg.color}`,
                }}
              />
              <div>
                <strong style={{ color: currentCfg.color }}>{currentCfg.label}</strong>
                <p>{currentCfg.desc}</p>
              </div>
            </div>
            {isSimulated && <span className="sw-sim-tag">[SIMULADO]</span>}
          </div>

          {/* NOAA 3-Scales Matrix */}
          <div className="sw-scales-matrix">
            {/* R Scale: Radio Blackout */}
            <div className={`sw-scale-card ${scales.R.scale > 0 ? 'scale-active' : ''}`}>
              <div className="scale-card-head">
                <span className="scale-letter">R</span>
                <span className="scale-name">RADIO BLACKOUT</span>
                <span className={`scale-level-badge level-${scales.R.scale}`}>
                  R{scales.R.scale}
                </span>
              </div>
              <div className="scale-card-body">
                <span className="scale-effect-text">
                  {scales.R.scale === 0
                    ? 'Sin interferencias de HF'
                    : scales.R.text}
                </span>
                <span className="scale-metric-sub">Rayos X solares</span>
              </div>
            </div>

            {/* S Scale: Solar Radiation Storm */}
            <div className={`sw-scale-card ${scales.S.scale > 0 ? 'scale-active' : ''}`}>
              <div className="scale-card-head">
                <span className="scale-letter">S</span>
                <span className="scale-name">RADIACIÓN SOLAR</span>
                <span className={`scale-level-badge level-${scales.S.scale}`}>
                  S{scales.S.scale}
                </span>
              </div>
              <div className="scale-card-body">
                <span className="scale-effect-text">
                  {scales.S.scale === 0
                    ? 'Nivel de protones nominal'
                    : scales.S.text}
                </span>
                <span className="scale-metric-sub">Protones &gt; 10 MeV</span>
              </div>
            </div>

            {/* G Scale: Geomagnetic Storm */}
            <div className={`sw-scale-card ${scales.G.scale > 0 ? 'scale-active' : ''}`}>
              <div className="scale-card-head">
                <span className="scale-letter">G</span>
                <span className="scale-name">TORMENTA GEOMAGNÉTICA</span>
                <span className={`scale-level-badge level-${scales.G.scale}`}>
                  G{scales.G.scale}
                </span>
              </div>
              <div className="scale-card-body">
                <span className="scale-effect-text">
                  {scales.G.scale === 0
                    ? 'Campo geomagnético estable'
                    : scales.G.text}
                </span>
                <span className="scale-metric-sub">Índice Kp planetario</span>
              </div>
            </div>
          </div>

          {/* Live NOAA SWPC Alerts Stream */}
          <div className="sw-alerts-section">
            <div className="sw-alerts-title-row">
              <span className="sw-alerts-title">AVISOS Y ALERTAS OFICIALES RECIENTES</span>
              <span className="sw-alerts-badge">{alerts.length} NOTIFICACIONES</span>
            </div>

            {isLoading ? (
              <div className="sw-loading-row">Sincronizando telemetría NOAA SWPC...</div>
            ) : alerts.length === 0 ? (
              <div className="sw-empty-alerts">Sin avisos activos en las últimas 24 horas.</div>
            ) : (
              <div className="sw-alerts-list">
                {alerts.map((alert) => {
                  const isExpanded = expandedAlertId === alert.id;
                  return (
                    <div
                      key={alert.id}
                      className={`sw-alert-item item-${alert.severity}`}
                      onClick={() => toggleAlertExpand(alert.id)}
                    >
                      <div className="sw-alert-item-header">
                        <span className={`sw-alert-tag tag-${alert.severity}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="sw-alert-headline">{alert.headline}</span>
                        <span className="sw-alert-chevron">{isExpanded ? '▴' : '▸'}</span>
                      </div>
                      <div className="sw-alert-time">{alert.issueTime} UTC</div>
                      {isExpanded && (
                        <pre className="sw-alert-full-msg">{alert.message}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Popover Footer & Simulation Controls */}
          <div className="sw-popover-footer">
            <div className="sw-sim-buttons">
              <span className="sw-sim-lbl">SIMULACIÓN:</span>
              <button
                type="button"
                className={`sw-sim-btn ${!isSimulated ? 'active' : ''}`}
                onClick={() => simulateStorm(null)}
              >
                VIVO
              </button>
              <button
                type="button"
                className={`sw-sim-btn ${isSimulated && overallStatus === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => simulateStorm('ACTIVE')}
              >
                G1
              </button>
              <button
                type="button"
                className={`sw-sim-btn btn-warn ${isSimulated && overallStatus === 'WARNING' ? 'active' : ''}`}
                onClick={() => simulateStorm('WARNING')}
              >
                G3
              </button>
              <button
                type="button"
                className={`sw-sim-btn btn-crit ${isSimulated && overallStatus === 'EXTREME' ? 'active' : ''}`}
                onClick={() => simulateStorm('EXTREME')}
              >
                G5
              </button>
            </div>

            <button
              type="button"
              className="sw-refresh-btn"
              onClick={() => refetch()}
              title="Actualizar datos satelitales de NOAA"
            >
              ACTUALIZAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
