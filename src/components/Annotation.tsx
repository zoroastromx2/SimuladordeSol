import React from 'react';
import { PROBE_MELT_TEMPERATURE_K } from '../math/SolarPhysics';

export const Annotation: React.FC = () => {
  return (
    <div className="annotation">
      <strong>Drag</strong> to orbit / scroll to range
      <br />
      Thermal limit <span id="melt-limit">{PROBE_MELT_TEMPERATURE_K.toLocaleString('en-US')} K</span>
    </div>
  );
};
