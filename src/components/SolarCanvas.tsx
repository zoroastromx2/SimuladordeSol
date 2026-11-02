import React, { useEffect, useRef } from 'react';
import { SunSimulator } from '../core/SunSimulator';
import type { TelemetryData } from '../types';

interface SolarCanvasProps {
  onTelemetryChange: (telemetry: TelemetryData) => void;
  simulatorRef: React.MutableRefObject<SunSimulator | null>;
}

export const SolarCanvas: React.FC<SolarCanvasProps> = ({
  onTelemetryChange,
  simulatorRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const simulator = new SunSimulator({
      mount: containerRef.current,
      onTelemetryChange,
    });
    simulatorRef.current = simulator;
    simulator.start();

    return () => {
      simulator.dispose();
      simulatorRef.current = null;
    };
  }, [onTelemetryChange, simulatorRef]);

  return (
    <main
      id="app"
      className="canvas-container"
      ref={containerRef}
      aria-label="Real-time volumetric sun"
    />
  );
};
