import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SDOArchiveFrame, SDOMode } from '../types';
import { SDO_MODES, SDOFetcher } from '../core/SDOFetcher';
import { FlareTicker } from './FlareTicker';

interface SDOSelectorProps {
  currentMode: SDOMode;
  dynamicCoronaEnabled: boolean;
  onSelectMode: (mode: SDOMode) => void;
  onSelectFrame: (frame: SDOArchiveFrame) => void;
  onToggleDynamicCorona: () => void;
  sdoFetcher?: SDOFetcher;
}

export const SDOSelector: React.FC<SDOSelectorProps> = ({
  currentMode,
  dynamicCoronaEnabled,
  onSelectMode,
  onSelectFrame,
  onToggleDynamicCorona,
  sdoFetcher,
}) => {
  const fetcherRef = useRef<SDOFetcher | null>(null);
  if (!fetcherRef.current) {
    fetcherRef.current = sdoFetcher ?? new SDOFetcher();
  }

  const [frames, setFrames] = useState<SDOArchiveFrame[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  const activeInfo =
    SDO_MODES.find((m) => m.id === currentMode) ?? SDO_MODES[0];

  // Fetch timeline frames when mode changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    fetcherRef.current!
      .fetchTimelineFrames(currentMode)
      .then((loadedFrames) => {
        if (isCancelled || loadedFrames.length === 0) return;
        setFrames(loadedFrames);
        // Default to latest / live frame at end of timeline
        const latestIdx = loadedFrames.length - 1;
        setCurrentIndex(latestIdx);
        onSelectFrame(loadedFrames[latestIdx]);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentMode, onSelectFrame]);

  // Handle scrubber change
  const handleScrubberChange = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= frames.length) return;
      setCurrentIndex(newIndex);
      const frame = frames[newIndex];
      if (frame) {
        onSelectFrame(frame);
      }
    },
    [frames, onSelectFrame],
  );

  // Play / Pause Timelapse
  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % frames.length;
          const frame = frames[next];
          if (frame) {
            onSelectFrame(frame);
          }
          return next;
        });
      }, 650);
    } else {
      if (playTimerRef.current !== null) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current !== null) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, frames, onSelectFrame]);

  const activeFrame = frames[currentIndex];

  return (
    <aside className="sdo-panel" aria-label="SDO Solar Observatory Mode and Timeline">
      <div className="sdo-header">
        <span>Solar Observatory Stream</span>
        <span className="sdo-live-indicator">
          <i
            className="sdo-live-dot"
            style={{
              background:
                currentMode === 'procedural'
                  ? 'var(--amber)'
                  : activeFrame?.isLive
                    ? '#39e58c'
                    : '#ffb15c',
              boxShadow:
                currentMode === 'procedural'
                  ? '0 0 6px var(--amber)'
                  : activeFrame?.isLive
                    ? '0 0 6px #39e58c'
                    : '0 0 6px #ffb15c',
            }}
          />
          {currentMode === 'procedural'
            ? 'PROCEDURAL'
            : activeFrame?.isLive
              ? 'LIVE SDO FEED'
              : 'ARCHIVE PLAYBACK'}
        </span>
      </div>

      {/* Wavelength Channel Tabs */}
      <div className="sdo-tabs" role="tablist" aria-label="Wavelength Selector">
        {SDO_MODES.map((mode) => {
          const isActive = mode.id === currentMode;
          let tabLabel = mode.label;
          if (mode.id === 'aia171') tabLabel = '171 Å';
          if (mode.id === 'aia304') tabLabel = '304 Å';
          if (mode.id === 'aia193') tabLabel = '193 Å';
          if (mode.id === 'hmib') tabLabel = 'HMI MAG';
          if (mode.id === 'procedural') tabLabel = 'PROC';

          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`sdo-tab ${isActive ? 'active' : ''}`}
              onClick={() => {
                setIsPlaying(false);
                onSelectMode(mode.id);
              }}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* Dynamic Corona & Magnetic Loops / Flares Toggle */}
      <div className="sdo-corona-toggle">
        <button
          type="button"
          className={`sdo-corona-btn ${dynamicCoronaEnabled ? 'active' : 'inactive'}`}
          onClick={onToggleDynamicCorona}
          title={
            dynamicCoronaEnabled
              ? 'Desactivar corona dinámica (bucles y flares)'
              : 'Activar corona dinámica (bucles y flares)'
          }
          aria-pressed={dynamicCoronaEnabled}
        >
          <div className="sdo-corona-left">
            <i
              className="sdo-corona-dot"
              style={{
                background: dynamicCoronaEnabled ? 'var(--amber)' : '#5a6270',
                boxShadow: dynamicCoronaEnabled
                  ? '0 0 8px var(--amber)'
                  : 'none',
              }}
            />
            <div className="sdo-corona-text">
              <span className="sdo-corona-label">
                CORONA DINÁMICA &amp; BUCLES
              </span>
              <span className="sdo-corona-state">
                {dynamicCoronaEnabled
                  ? 'BUCLES MAGNÉTICOS & FLARES ACTIVADOS'
                  : 'MODO REPOSO (QUIET SUN) SIN BUCLES'}
              </span>
            </div>
          </div>
          <span className="sdo-corona-pill">
            {dynamicCoronaEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Timeline Scrubber Section */}
      <div className="sdo-timeline-section" aria-label="SDO Image Archive Timeline">
        <div className="sdo-timeline-header">
          <span className="sdo-timeline-tag">
            {activeFrame?.isLive ? 'LIVE' : activeFrame?.relativeLabel || 'ARCHIVE'}
          </span>
          <span className="sdo-timeline-timestamp">
            {activeFrame?.timestamp || 'SYNCING...'}
          </span>
          <button
            type="button"
            className={`sdo-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause timelapse' : 'Play historical timelapse'}
            aria-label={isPlaying ? 'Pause timelapse' : 'Play historical timelapse'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
        </div>

        {/* Range Scrubber Slider */}
        <div className="sdo-slider-wrapper">
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={currentIndex}
            disabled={frames.length <= 1 || isLoading}
            className="sdo-range-input"
            onChange={(e) => {
              setIsPlaying(false);
              handleScrubberChange(parseInt(e.target.value, 10));
            }}
            aria-label="Timeline scrubber slider"
          />
          <div className="sdo-timeline-ticks">
            <span>-24h</span>
            <span>-18h</span>
            <span>-12h</span>
            <span>-6h</span>
            <span className="tick-live">LIVE</span>
          </div>
        </div>

        {/* Quick-Jump Timeline Presets */}
        <div className="sdo-presets">
          <button
            type="button"
            className="sdo-preset-btn"
            onClick={() => {
              setIsPlaying(false);
              handleScrubberChange(0);
            }}
          >
            -24H
          </button>
          <button
            type="button"
            className="sdo-preset-btn"
            onClick={() => {
              setIsPlaying(false);
              handleScrubberChange(Math.floor(frames.length * 0.5));
            }}
          >
            -12H
          </button>
          <button
            type="button"
            className="sdo-preset-btn"
            onClick={() => {
              setIsPlaying(false);
              handleScrubberChange(Math.floor(frames.length * 0.75));
            }}
          >
            -6H
          </button>
          <button
            type="button"
            className={`sdo-preset-btn ${activeFrame?.isLive ? 'active-preset' : ''}`}
            onClick={() => {
              setIsPlaying(false);
              handleScrubberChange(frames.length - 1);
            }}
          >
            LIVE
          </button>
        </div>
      </div>

      {/* Channel metadata */}
      <div className="sdo-details">
        <div className="sdo-title-row">
          <strong>{activeInfo.label}</strong>
          <span>{activeInfo.wavelength}</span>
        </div>
        <div className="sdo-desc">{activeInfo.description}</div>
      </div>

      {/* Real-time Solar Flare Ticker & Class X Warning */}
      <FlareTicker />
    </aside>
  );
};
