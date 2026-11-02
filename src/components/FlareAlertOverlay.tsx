import React, { useEffect, useState } from 'react';

export interface FlareAlertInfo {
  magnitude: string;
  timestamp: string;
  id?: string;
}

interface FlareAlertOverlayProps {
  alert: FlareAlertInfo | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export const FlareAlertOverlay: React.FC<FlareAlertOverlayProps> = ({
  alert,
  onDismiss,
  autoDismissMs = 8000,
}) => {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, autoDismissMs);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [alert, onDismiss, autoDismissMs]);

  if (!visible || !alert) return null;

  return (
    <>
      {/* Subtle edge-of-screen pulsating vignette & perimeter hazard glow */}
      <div
        className="flare-edge-overlay"
        aria-hidden="true"
      >
        <div className="flare-corner flare-corner-tl" />
        <div className="flare-corner flare-corner-tr" />
        <div className="flare-corner flare-corner-bl" />
        <div className="flare-corner flare-corner-br" />
      </div>

      {/* Non-intrusive top-edge HUD warning notification pill */}
      <aside
        className="flare-edge-banner"
        role="alert"
        aria-live="assertive"
      >
        <div className="flare-edge-banner-glow" />
        <div className="flare-edge-banner-content">
          <span className="flare-edge-hazard-icon" aria-hidden="true">⚠</span>
          <div className="flare-edge-text-group">
            <div className="flare-edge-headline">
              <span className="flare-edge-title">HIGH-MAGNITUDE SOLAR FLARE</span>
              <span className="flare-edge-mag-badge">{alert.magnitude}</span>
            </div>
            <div className="flare-edge-subline">
              <span>GOES-18 SATELLITE ALERT</span>
              <span className="flare-edge-sep">•</span>
              <span>{alert.timestamp}</span>
              <span className="flare-edge-sep">•</span>
              <span className="flare-edge-radiation">IONIZATION WARNING</span>
            </div>
          </div>
          <button
            type="button"
            className="flare-edge-dismiss-btn"
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            title="Dismiss flare notification"
            aria-label="Dismiss flare notification"
          >
            ✕
          </button>
        </div>
      </aside>
    </>
  );
};
