import React from 'react';
import type { TelemetryData } from '../types';

interface TelemetryPanelProps {
  telemetry: TelemetryData;
  onAction: () => void;
  onToggleAudio: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  telemetry,
  onAction,
  onToggleAudio,
}) => {
  let buttonText = 'Release probe';
  let buttonDisabled = false;

  if (telemetry.status === 'Descending' || telemetry.isDropping) {
    buttonText = 'Descent in progress';
    buttonDisabled = true;
  } else if (telemetry.status === 'Disintegrating') {
    buttonText = 'Critical failure';
    buttonDisabled = true;
  } else if (telemetry.status === 'Destroyed') {
    buttonText = 'Deploy new probe';
    buttonDisabled = false;
  } else if (telemetry.status === 'Melt threshold' || telemetry.isStopped) {
    buttonText = 'Retrieve probe';
    buttonDisabled = false;
  }

  const isCritical =
    telemetry.status === 'Destroyed' || telemetry.status === 'Disintegrating';

  return (
    <section className="telemetry" aria-label="Probe telemetry">
      <div className="panel-label">
        <span>Probe telemetry</span>
        <span
          className="status-row"
          style={isCritical ? { color: 'var(--hot)' } : undefined}
        >
          <i
            className="status-dot"
            aria-hidden="true"
            style={
              isCritical
                ? {
                    background: 'var(--hot)',
                    boxShadow: '0 0 8px var(--hot)',
                  }
                : undefined
            }
          />
          <span id="probe-status">{telemetry.status}</span>
        </span>
      </div>
      <dl>
        <div className="reading">
          <dt>Temperature</dt>
          <dd>
            <span id="probe-temperature">
              {telemetry.status === 'Destroyed'
                ? 'LOST'
                : telemetry.temperature > 0
                  ? telemetry.temperature.toLocaleString('en-US')
                  : '—'}
            </span>{' '}
            <small>K</small>
          </dd>
        </div>
        <div className="reading">
          <dt>Distance</dt>
          <dd>
            <span id="probe-distance">
              {telemetry.status === 'Destroyed'
                ? 'N/A'
                : telemetry.temperature > 0
                  ? telemetry.distanceKm.toLocaleString('en-US')
                  : '—'}
            </span>{' '}
            <small>km</small>
          </dd>
        </div>
      </dl>
      <div className="heat-track" aria-hidden="true">
        <div
          className="heat-fill"
          id="heat-fill"
          style={{
            width: `${Math.max(0, Math.min(100, telemetry.heatPercentage)).toFixed(1)}%`,
            background: isCritical
              ? 'linear-gradient(90deg, #ff5a27, #ff2200, #ffffff)'
              : undefined,
          }}
        />
      </div>
      <button
        className="probe-button"
        id="drop-probe"
        type="button"
        disabled={buttonDisabled}
        onClick={onAction}
      >
        {buttonText}
      </button>

      <div className="audio-control-row">
        <button
          type="button"
          className={`audio-toggle-btn ${telemetry.isAudioMuted === false ? 'active' : ''}`}
          onClick={onToggleAudio}
          aria-label="Toggle Solar Audio Synthesis"
        >
          <span className="audio-wave-icon" aria-hidden="true">
            {telemetry.isAudioMuted === false ? '● AUDIO LIVE' : '○ AUDIO MUTED'}
          </span>
          <span className="audio-mode-label">
            {telemetry.isAudioMuted === false ? 'HUM & CRACKLE ON' : 'ENABLE SYNTH'}
          </span>
        </button>
      </div>
    </section>
  );
};
