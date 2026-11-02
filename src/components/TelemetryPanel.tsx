import React from 'react';
import type { TelemetryData } from '../types';

interface TelemetryPanelProps {
  telemetry: TelemetryData;
  onAction: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  telemetry,
  onAction,
}) => {
  let buttonText = 'Release probe';
  let buttonDisabled = false;

  if (telemetry.status === 'Descending' || telemetry.isDropping) {
    buttonText = 'Descent in progress';
    buttonDisabled = true;
  } else if (telemetry.status === 'Melt threshold' || telemetry.isStopped) {
    buttonText = 'Retrieve probe';
    buttonDisabled = false;
  }

  return (
    <section className="telemetry" aria-label="Probe telemetry">
      <div className="panel-label">
        <span>Probe telemetry</span>
        <span className="status-row">
          <i className="status-dot" aria-hidden="true" />
          <span id="probe-status">{telemetry.status}</span>
        </span>
      </div>
      <dl>
        <div className="reading">
          <dt>Temperature</dt>
          <dd>
            <span id="probe-temperature">
              {telemetry.temperature > 0
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
              {telemetry.temperature > 0
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
          style={{ width: `${Math.max(0, Math.min(100, telemetry.heatPercentage)).toFixed(1)}%` }}
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
    </section>
  );
};
