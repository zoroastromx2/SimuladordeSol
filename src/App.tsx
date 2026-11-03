import React, { useState, useRef, useCallback } from 'react';
import { Masthead } from './components/Masthead';
import { SDOSelector } from './components/SDOSelector';
import { Annotation } from './components/Annotation';
import { Scale } from './components/Scale';
import { SolarCanvas } from './components/SolarCanvas';
import { FlareAlertOverlay, type FlareAlertInfo } from './components/FlareAlertOverlay';
import { SpaceWeatherBadge } from './components/SpaceWeatherBadge';
import { useSpaceWeather } from './hooks/useSpaceWeather';
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
  const [, setTelemetryState] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [sdoMode, setSdoMode] = useState<SDOMode>('procedural');
  const [dynamicCoronaEnabled, setDynamicCoronaEnabled] = useState<boolean>(true);
  const [flareAlert, setFlareAlert] = useState<FlareAlertInfo | null>(null);
  const simulatorRef = useRef<SunSimulator | null>(null);

  // Hook periodically polling NOAA SWPC for current space weather scales & alerts
  const spaceWeather = useSpaceWeather(45000);

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

  const handleClassXDetected = useCallback(
    (data: { magnitude: string; timestamp: string }) => {
      setFlareAlert({
        magnitude: data.magnitude,
        timestamp: data.timestamp,
        id: `alert_${Date.now()}`,
      });
    },
    [],
  );

  const handleDismissAlert = useCallback(() => {
    setFlareAlert(null);
  }, []);

  return (
    <>
      <SolarCanvas
        onTelemetryChange={handleTelemetryChange}
        simulatorRef={simulatorRef}
      />
      <div className="hud">
        <header className="hud-top-row">
          <Masthead />
          <SpaceWeatherBadge weather={spaceWeather} />
        </header>
        <SDOSelector
          currentMode={sdoMode}
          dynamicCoronaEnabled={dynamicCoronaEnabled}
          onSelectMode={handleSelectSDOMode}
          onSelectFrame={handleSelectFrame}
          onToggleDynamicCorona={handleToggleDynamicCorona}
          onClassXDetected={handleClassXDetected}
          sdoFetcher={simulatorRef.current?.sdoFetcher}
        />
        <Annotation />
        <Scale />
      </div>

      {/* Visual flare alert overlay for Class X events */}
      <FlareAlertOverlay
        alert={flareAlert}
        onDismiss={handleDismissAlert}
      />
    </>
  );
};

export default App;
