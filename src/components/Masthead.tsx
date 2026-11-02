import React from 'react';

export const Masthead: React.FC = () => {
  return (
    <header className="masthead">
      <span className="sun-mark" aria-hidden="true" />
      <div>
        <h1>Helios Probe</h1>
        <p>Volumetric solar observatory / 01</p>
      </div>
    </header>
  );
};
