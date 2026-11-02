import React, { useState, useRef, useCallback } from 'react';
import { Masthead } from './components/Masthead';
import { TelemetryPanel } from './components/TelemetryPanel';
import { SDOSelector } from './components/SDOSelector';
import { Annotation } from './components/Annotation';
import { Scale } from './components/Scale';
import { SolarCanvas } from './components/SolarCanvas';
import type { SunSimulator } from './core/SunSimulator';
import type { SDOArchiveFrame, SDOMode, TelemetryData } from './types';

const INITIAL_TELEMETRY: TelemetryData = {
  temperature: 0,
  distanceKm: 0,
  heatPercentage: 3,
  status: 'Standby',
  isDropping: false,
  isStopped: false,
  sdoMode: 'procedural',
  isAudioMuted: true,
  timelineLabel: 'LIVE',
  dynamicCoronaEnabled: true,
};

export const App: React.FC = () => {
  const [telemetry, setTelemetryState] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [sdoMode, setSdoMode] = useState<SDOMode>('procedural');
  const [dynamicCoronaEnabled, setDynamicCoronaEnabled] = useState<boolean>(true);
  const simulatorRef = useRef<SunSimulator | null>(null);

  const handleTelemetryChange = useCallback((data: TelemetryData) => {
    setTelemetryState(data);
    if (data.sdoMode) {
      setSdoMode(data.sdoMode);
    }
    if (typeof data.dynamicCoronaEnabled === 'boolean') {
      setDynamicCoronaEnabled(data.dynamicCoronaEnabled);
    }
  }, []);

  const handleSelectSDOMode = useCallback((mode: SDOMode) => {
    setSdoMode(mode);
    if (simulatorRef.current) {
      simulatorRef.current.setSDOMode(mode);
    }
  }, []);

  const handleSelectFrame = useCallback((frame: SDOArchiveFrame) => {
    if (simulatorRef.current) {
      simulatorRef.current.setSDOArchiveFrame(frame);
    }
  }, []);

  const handleToggleDynamicCorona = useCallback(() => {
    if (simulatorRef.current) {
      const newState = simulatorRef.current.toggleDynamicCorona();
      setDynamicCoronaEnabled(newState);
    }
  }, []);

  const handleToggleAudio = useCallback(() => {
    if (simulatorRef.current) {
      simulatorRef.current.toggleAudio();
    }
  }, []);

  const handleAction = useCallback(() => {
    if (!simulatorRef.current) return;
    if (
      telemetry.status === 'Destroyed' ||
      telemetry.status === 'Melt threshold' ||
      telemetry.isStopped
    ) {
      simulatorRef.current.resetProbe();
    } else if (!telemetry.isDropping && telemetry.status !== 'Disintegrating') {
      simulatorRef.current.releaseProbe();
    }
  }, [telemetry.status, telemetry.isStopped, telemetry.isDropping]);

  return (
    <>
      <SolarCanvas
        onTelemetryChange={handleTelemetryChange}
        simulatorRef={simulatorRef}
      />
      <div className="hud">
        <Masthead />
        <SDOSelector
          currentMode={sdoMode}
          dynamicCoronaEnabled={dynamicCoronaEnabled}
          onSelectMode={handleSelectSDOMode}
          onSelectFrame={handleSelectFrame}
          onToggleDynamicCorona={handleToggleDynamicCorona}
          sdoFetcher={simulatorRef.current?.sdoFetcher}
        />
        <TelemetryPanel
          telemetry={telemetry}
          onAction={handleAction}
          onToggleAudio={handleToggleAudio}
        />
        <Annotation />
        <Scale />
      </div>
    </>
  );
};

export default App;
