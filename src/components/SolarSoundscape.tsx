import React, { useState, useEffect, useRef } from 'react';
import {
  SolarSoundscapeGenerator,
  type SoundscapeState,
} from '../core/SolarSoundscapeGenerator';
import type { FlareEvent } from '../types';

interface SolarSoundscapeProps {
  soundscapeGenerator?: SolarSoundscapeGenerator;
  currentSeverity?: string;
  currentFlux?: number;
  recentEvents?: FlareEvent[];
}

export const SolarSoundscape: React.FC<SolarSoundscapeProps> = ({
  soundscapeGenerator,
  currentSeverity = 'B',
  currentFlux = 2.5e-7,
  recentEvents = [],
}) => {
  const soundscapeRef = useRef<SolarSoundscapeGenerator | null>(null);
  if (!soundscapeRef.current) {
    soundscapeRef.current = soundscapeGenerator ?? new SolarSoundscapeGenerator();
  }

  const [state, setState] = useState<SoundscapeState>({
    isActive: false,
    frequencyHz: 131,
    flareRate: 1,
    currentSeverity: 'B',
    volume: 0.45,
    peakFlux: 2.5e-7,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync flare activity with synth parameters
  useEffect(() => {
    const generator = soundscapeRef.current!;
    // Calculate flare rate per hour from recent events or minimum baseline
    const pastHourEvents = recentEvents.filter((ev) => {
      const t = new Date(ev.timestamp.replace(' UTC', 'Z').replace(' ', 'T')).getTime();
      return !isNaN(t) && Date.now() - t < 3600000;
    });
    const flareRate = Math.max(1, pastHourEvents.length);

    generator.updateFlareActivity(flareRate, currentSeverity, currentFlux);
    setState(generator.getState());
  }, [currentSeverity, currentFlux, recentEvents]);

  // Real-time Audio Spectrum Visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const renderSpectrum = () => {
      if (!isRunning) return;
      const generator = soundscapeRef.current;
      const data = generator?.getByteFrequencyData();

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (generator?.getState().isActive && data) {
        const barCount = 24;
        const barWidth = (width / barCount) - 1.5;

        for (let i = 0; i < barCount; i++) {
          const val = data[i] || 0;
          const barHeight = Math.max(2, (val / 255) * (height - 4));
          const x = i * (barWidth + 1.5);
          const y = height - barHeight;

          // Color gradient based on frequency and height
          const isHigh = i > 16;
          ctx.fillStyle = isHigh
            ? 'rgba(255, 90, 40, 0.85)'
            : 'rgba(255, 179, 79, 0.75)';

          ctx.fillRect(x, y, barWidth, barHeight);
        }
      } else {
        // Idle ambient line
        ctx.strokeStyle = 'rgba(255, 205, 133, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();

    return () => {
      isRunning = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const handleToggle = () => {
    const generator = soundscapeRef.current!;
    generator.toggle();
    setState(generator.getState());
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const generator = soundscapeRef.current!;
    generator.setVolume(val);
    setState(generator.getState());
  };

  const handleTestChime = (sev: 'B' | 'M' | 'X') => {
    const generator = soundscapeRef.current!;
    if (!state.isActive) {
      generator.toggle();
      setState(generator.getState());
    }
    generator.triggerFlareChime(sev, sev);
  };

  // Determine musical note name
  const getNoteName = (hz: number) => {
    if (hz >= 250) return 'C4 / E4 (Agudo - Ionización)';
    if (hz >= 190) return 'G3 / A3 (Medio - Corona Activa)';
    if (hz >= 140) return 'D3 (Tibio - Transición)';
    return 'C3 (Grave - Reposo Solar)';
  };

  return (
    <div className="solar-soundscape-container" aria-label="Solar Soundscape Audio Generator">
      {/* Soundscape Header */}
      <div className="soundscape-header">
        <div className="soundscape-title-col">
          <span className="soundscape-title">PAISAJE SONORO SOLAR // SOLAR SOUNDSCAPE</span>
          <span className="soundscape-sub">SÍNTESIS ARMÓNICA MAPEO DE FULGURACIONES</span>
        </div>
        <button
          type="button"
          className={`soundscape-toggle-btn ${state.isActive ? 'active' : ''}`}
          onClick={handleToggle}
          title={state.isActive ? 'Desactivar síntesis de audio' : 'Activar paisaje sonoro solar'}
          aria-pressed={state.isActive}
        >
          <span className="soundscape-dot" />
          <span>{state.isActive ? 'AUDIO ON' : 'AUDIO OFF'}</span>
        </button>
      </div>

      {/* Real-time Spectrum Visualizer Canvas */}
      <div className="soundscape-visualizer-box">
        <canvas
          ref={canvasRef}
          width={280}
          height={28}
          className="soundscape-canvas"
          title="Espectro de frecuencias del sintetizador solar"
        />
      </div>

      {/* Acoustic Frequency & Activity Mapping Data */}
      <div className="soundscape-meta-grid">
        <div className="soundscape-meta-item">
          <span className="meta-lbl">FRECUENCIA PORTADORA</span>
          <span className="meta-val">{state.frequencyHz} Hz <small>({getNoteName(state.frequencyHz)})</small></span>
        </div>
        <div className="soundscape-meta-item">
          <span className="meta-lbl">MODULACIÓN POR ACTIVIDAD</span>
          <span className="meta-val">
            {state.flareRate} evento{state.flareRate === 1 ? '' : 's'}/h • Clase {state.currentSeverity}
          </span>
        </div>
      </div>

      {/* Test Chimes & Volume Control */}
      <div className="soundscape-footer">
        <div className="soundscape-audition-group">
          <span className="soundscape-audition-label">AUDICIÓN:</span>
          <button
            type="button"
            className="soundscape-audition-btn"
            onClick={() => handleTestChime('B')}
            title="Escuchar tono de fulguración Clase B"
          >
            TONO B
          </button>
          <button
            type="button"
            className="soundscape-audition-btn btn-m"
            onClick={() => handleTestChime('M')}
            title="Escuchar tono de fulguración Clase M"
          >
            TONO M
          </button>
          <button
            type="button"
            className="soundscape-audition-btn btn-x"
            onClick={() => handleTestChime('X')}
            title="Escuchar tono de fulguración Clase X"
          >
            TONO X
          </button>
        </div>

        <div className="soundscape-vol-group">
          <span className="vol-label">VOL</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.volume}
            onChange={handleVolumeChange}
            className="soundscape-vol-slider"
            title="Volumen del paisaje sonoro"
            aria-label="Volumen del paisaje sonoro"
          />
          <span className="vol-val">{Math.round(state.volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
};
