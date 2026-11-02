import React, { useState, useRef, useCallback } from 'react';
import { Masthead } from './components/Masthead';
import { TelemetryPanel } from './components/TelemetryPanel';
import { Annotation } from './components/Annotation';
import { Scale } from './components/Scale';
import { SolarCanvas } from './components/SolarCanvas';
import type { SunSimulator } from './core/SunSimulator';
import type { TelemetryData } from './types';

const INITIAL_TELEMETRY: TelemetryData = {
  temperature: 0,
  distanceKm: 0,
  heatPercentage: 3,
  status: 'Standby',
  isDropping: false,
  isStopped: false,
};

export const App: React.FC = () => {
  const [telemetry, setTelemetryState] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const simulatorRef = useRef<SunSimulator | null>(null);

  const handleTelemetryChange = useCallback((data: TelemetryData) => {
    setTelemetryState(data);
  }, []);

  const handleAction = useCallback(() => {
    if (!simulatorRef.current) return;
    if (telemetry.isStopped) {
      simulatorRef.current.resetProbe();
    } else if (!telemetry.isDropping) {
      simulatorRef.current.releaseProbe();
    }
  }, [telemetry.isStopped, telemetry.isDropping]);

  return (
    <>
      <SolarCanvas
        onTelemetryChange={handleTelemetryChange}
        simulatorRef={simulatorRef}
      />
      <div className="hud">
        <Masthead />
        <TelemetryPanel
          telemetry={telemetry}
          onAction={handleAction}
        />
        <Annotation />
        <Scale />
      </div>
    </>
  );
};

export default App;
