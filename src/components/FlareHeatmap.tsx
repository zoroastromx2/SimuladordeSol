import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { FlareEvent } from '../types';

interface FlareHeatmapProps {
  events: FlareEvent[];
  onAddTestEvent?: (severity: 'M' | 'X') => void;
}

export const FlareHeatmap: React.FC<FlareHeatmapProps> = ({
  events,
  onAddTestEvent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<FlareEvent | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const pendingEventRef = useRef<FlareEvent | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Compute session metrics
  const metrics = useMemo(() => {
    let xCount = 0;
    let mCount = 0;
    let peakFlux = 0;
    let peakMag = 'NONE';
    const regions = new Set<string>();

    for (const ev of events) {
      if (ev.severity === 'X') xCount++;
      if (ev.severity === 'M') mCount++;
      if (ev.flux > peakFlux) {
        peakFlux = ev.flux;
        peakMag = ev.magnitude;
      }
      if (ev.activeRegion) {
        regions.add(ev.activeRegion);
      }
    }

    return {
      total: events.length,
      xCount,
      mCount,
      peakMag,
      peakFlux,
      activeRegionsCount: regions.size,
    };
  }, [events]);

  // Render the Sun and Flare Heatmap overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 110;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const sunRadius = 46;

    ctx.clearRect(0, 0, size, size);

    // 1. Corona outer haze
    const haze = ctx.createRadialGradient(cx, cy, sunRadius * 0.8, cx, cy, sunRadius * 1.25);
    haze.addColorStop(0, 'rgba(255, 140, 20, 0.45)');
    haze.addColorStop(0.5, 'rgba(255, 80, 10, 0.15)');
    haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(cx, cy, sunRadius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // 2. Solar Photosphere Disc with Limb Darkening
    const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius);
    discGrad.addColorStop(0, '#ffd369');
    discGrad.addColorStop(0.65, '#f58800');
    discGrad.addColorStop(0.92, '#b23b00');
    discGrad.addColorStop(1, '#4a1500');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = discGrad;
    ctx.fill();
    ctx.clip(); // Clip everything to sun disc

    // 3. Heliographic Coordinate Grid (Equator & Active Latitude Belts)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([2, 3]);

    // Equator
    ctx.beginPath();
    ctx.moveTo(cx - sunRadius, cy);
    ctx.lineTo(cx + sunRadius, cy);
    ctx.stroke();

    // Central Meridian
    ctx.beginPath();
    ctx.moveTo(cx, cy - sunRadius);
    ctx.lineTo(cx, cy + sunRadius);
    ctx.stroke();

    // Active solar latitude belts (+/- 15° to +/- 25° where sunspots occur)
    const beltY1 = cy - sunRadius * Math.sin((20 * Math.PI) / 180);
    const beltY2 = cy + sunRadius * Math.sin((20 * Math.PI) / 180);

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx - sunRadius, beltY1);
    ctx.lineTo(cx + sunRadius, beltY1);
    ctx.moveTo(cx - sunRadius, beltY2);
    ctx.lineTo(cx + sunRadius, beltY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Heatmap Thermal Gradient Overlay (Cumulative Intensity & Frequency)
    ctx.globalCompositeOperation = 'screen';

    // Draw historical & session flare splats
    for (const ev of events) {
      if (!ev.coords) continue;
      const px = cx + ev.coords.x * (sunRadius * 0.9);
      const py = cy + ev.coords.y * (sunRadius * 0.9);

      let radius = 10;
      let coreColor = 'rgba(255, 215, 0, 0.7)';
      let midColor = 'rgba(255, 120, 0, 0.4)';
      let outerColor = 'rgba(255, 60, 0, 0)';

      if (ev.severity === 'X') {
        radius = 20;
        coreColor = 'rgba(255, 255, 255, 0.95)';
        midColor = 'rgba(255, 0, 90, 0.75)';
        outerColor = 'rgba(255, 30, 0, 0)';
      } else if (ev.severity === 'M') {
        radius = 15;
        coreColor = 'rgba(255, 255, 160, 0.9)';
        midColor = 'rgba(255, 80, 20, 0.65)';
        outerColor = 'rgba(255, 40, 0, 0)';
      }

      const splat = ctx.createRadialGradient(px, py, 0, px, py, radius);
      splat.addColorStop(0, coreColor);
      splat.addColorStop(0.35, midColor);
      splat.addColorStop(1, outerColor);

      ctx.fillStyle = splat;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      // Sharp central active kernel dot
      ctx.fillStyle = ev.severity === 'X' ? '#ffffff' : '#ffe082';
      ctx.beginPath();
      ctx.arc(px, py, ev.severity === 'X' ? 1.8 : 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 5. Subtle limb perimeter ring
    ctx.beginPath();
    ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 179, 79, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

  }, [events]);

  // Handle canvas mouse move to detect hovered flare hotspots with 300ms delay
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = 55;
    const cy = 55;
    const sunRadius = 46;

    let closest: FlareEvent | null = null;
    let minDist = 14; // hover hit radius

    for (const ev of events) {
      if (!ev.coords) continue;
      const px = cx + ev.coords.x * (sunRadius * 0.9);
      const py = cy + ev.coords.y * (sunRadius * 0.9);
      const dist = Math.hypot(x - px, y - py);
      if (dist < minDist) {
        minDist = dist;
        closest = ev;
      }
    }

    // No flare hotspot under cursor
    if (!closest) {
      if (hoverTimeoutRef.current !== null) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      pendingEventRef.current = null;
      setHoveredEvent(null);
      setMousePos(null);
      return;
    }

    // If this hotspot is already displayed, smoothly track cursor without re-delaying
    if (hoveredEvent && hoveredEvent.id === closest.id) {
      setMousePos({ x, y });
      return;
    }

    // If timer is already counting down for this exact event, don't restart timer
    if (pendingEventRef.current && pendingEventRef.current.id === closest.id) {
      return;
    }

    // Reset countdown for newly detected candidate hotspot (300ms delay)
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
    }
    pendingEventRef.current = closest;

    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredEvent(closest);
      setMousePos({ x, y });
      hoverTimeoutRef.current = null;
      pendingEventRef.current = null;
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    pendingEventRef.current = null;
    setHoveredEvent(null);
    setMousePos(null);
  };

  return (
    <div className="flare-heatmap-container" aria-label="Solar Flare Heatmap">
      <div className="flare-heatmap-header">
        <div className="flare-heatmap-title-group">
          <span className="flare-heatmap-title">MAPA TÉRMICO DE FULGURACIONES</span>
          <span className="flare-heatmap-sub">DISTRIBUCIÓN Y FRECUENCIA EN DISCO SOLAR</span>
        </div>
        {onAddTestEvent && (
          <div className="flare-heatmap-quick-actions">
            <button
              type="button"
              className="flare-heatmap-add-btn"
              onClick={() => onAddTestEvent('M')}
              title="Añadir fulguración M de prueba"
            >
              +M
            </button>
            <button
              type="button"
              className="flare-heatmap-add-btn btn-x"
              onClick={() => onAddTestEvent('X')}
              title="Añadir fulguración X de prueba"
            >
              +X
            </button>
          </div>
        )}
      </div>

      <div className="flare-heatmap-body">
        {/* Miniature Sun Disc with Canvas Thermal Gradient */}
        <div className="flare-heatmap-visual">
          <canvas
            ref={canvasRef}
            className="flare-heatmap-canvas"
            style={{ width: '110px', height: '110px', display: 'block', position: 'static' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            title="Disco solar con mapa térmico de fulguraciones"
          />

          {/* Interactive hotspot tooltip */}
          {hoveredEvent && mousePos && (
            <div
              className="flare-heatmap-tooltip"
              style={{
                left: `${Math.min(90, Math.max(10, mousePos.x))}px`,
                top: `${Math.max(4, mousePos.y - 32)}px`,
              }}
            >
              <div className="tooltip-head">
                <span className={`tooltip-badge badge-${hoveredEvent.severity.toLowerCase()}`}>
                  {hoveredEvent.magnitude}
                </span>
                <span>{hoveredEvent.activeRegion || 'ACTIVA'}</span>
              </div>
              <div className="tooltip-sub">
                {hoveredEvent.coords
                  ? `${hoveredEvent.coords.lat > 0 ? 'N' : 'S'}${Math.abs(Math.round(hoveredEvent.coords.lat))}° ${hoveredEvent.coords.lon > 0 ? 'E' : 'W'}${Math.abs(Math.round(hoveredEvent.coords.lon))}°`
                  : hoveredEvent.timestamp}
              </div>
            </div>
          )}
        </div>

        {/* Heatmap Telemetry & Frequency Readout */}
        <div className="flare-heatmap-stats">
          <div className="heatmap-stat-row">
            <span className="stat-label">EVENTOS SESIÓN</span>
            <span className="stat-value">{metrics.total}</span>
          </div>
          <div className="heatmap-stat-row">
            <span className="stat-label">PICO MÁXIMO</span>
            <span
              className={`stat-value ${metrics.xCount > 0 ? 'val-crit' : metrics.mCount > 0 ? 'val-warn' : ''}`}
            >
              {metrics.peakMag}
            </span>
          </div>
          <div className="heatmap-stat-row">
            <span className="stat-label">CLASE X / M</span>
            <span className="stat-value">
              <strong style={{ color: '#ff4444' }}>{metrics.xCount}</strong> /{' '}
              <strong style={{ color: '#ff9933' }}>{metrics.mCount}</strong>
            </span>
          </div>
          <div className="heatmap-stat-row">
            <span className="stat-label">ZONAS ACTIVAS</span>
            <span className="stat-value">{metrics.activeRegionsCount} AR</span>
          </div>

          {/* Color Gradient Scale Bar */}
          <div className="heatmap-gradient-scale">
            <div className="gradient-bar" />
            <div className="gradient-labels">
              <span>REPOSO</span>
              <span>CLASE M</span>
              <span>CLASE X</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
