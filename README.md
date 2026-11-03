# Helios Probe

A real-time volumetric solar simulator built with React, Three.js, TypeScript, Vite, and GLSL. The scene contains a raymarched photosphere and corona, a temporal anti-aliasing pipeline, and a retrievable thermal probe that descends toward the solar surface until it reaches its melt threshold.

Everything on screen is procedural. There are no image, model, font, or environment assets. The only texture is a 64 × 64 blue-noise field generated mathematically at startup with a deterministic void-and-cluster algorithm.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL on port 3000 (`http://localhost:3000`).

Production and test commands:

```bash
npm test
npm run build
```

## Controls

- Drag to orbit the camera.
- Scroll to change the viewing distance.
- Use the **Solar Observatory Stream** panel to switch real-time SDO satellite wavelengths (**Procedural**, **AIA 171 Å**, **AIA 304 Å**, **AIA 193 Å**, **HMI Magnetogram**).
- Click **[OCULTAR]** on the top-right of the SDO panel header to minimize the panel for an unobstructed view of the Sun; click the minimized **[OBSERVATORIO SDO]** button to restore it anytime.
- Toggle **Corona Dinámica & Bucles [ON / OFF]** to dynamically enable or disable the 3D coronal loop arcades and volumetric eruptive flares, allowing immediate visual comparison between quiet solar emission and active storm states.
- Scrub through historical archive observations across the past 24 hours using the **Timeline Scrubber Slider** or toggle the **Timelapse Play/Pause (▶ / ❚❚)** button to watch dynamic solar rotation and coronal flare evolutions in motion.
- Monitor live solar flare intensity via the **Solar Flare Ticker** at the bottom of the SDO panel (tracking NOAA SWPC GOES-18 satellite X-ray flux). When an extreme **Class X flare** ($\ge 10^{-4}\text{ W/m}^2$) is detected, an emergency hazard warning banner with radiation storm alerts is displayed (includes a **SIMULAR CLASE X** toggle for immediate testing).
- Expand the **Registro de Fulguraciones M & X** collapsible list to inspect logged timestamps, magnitudes, and peak flux values of every Class M and X flare detected during the observation session (with test injection controls and log clearing).
- Experience the edge-of-screen **Visual Flare Alert Overlay**, which triggers a subtle flashing perimeter radiation vignette and top-edge HUD warning pill whenever a high-magnitude solar flare (Class X) is detected in the SDO event stream.
- Switch to the **Flare Heatmap** visualization in the SDO panel to inspect the spatial distribution, frequency, and cumulative thermal bloom of session flare events projected with an additive gradient overlay on a miniature orthographic solar disc (complete with interactive heliographic coordinate tooltips and active region tracking).
- Analyze the 24-hour solar weather history via the **Tendencia 24H** chart powered by `recharts`, visualizing the hourly frequency, severity breakdown (Classes B, C, M, X), and peak flare magnitude for each hour across the past 24 hours.
- Immerse in the **Solar Soundscape** audio generator, which synthesizes ethereal harmonic synth drone tones and celestial chimes directly mapped to real-time flare activity frequency, background X-ray flux, and radiation storm ionization, accompanied by an animated live audio spectrum visualizer.
- Monitor global space weather conditions with the **Space Weather Status** HUD badge (powered by `useSpaceWeather`), which periodically polls NOAA SWPC satellites (GOES and DSCOVR) for active R, S, and G scales and official space weather alerts; clicking the badge opens an interactive telemetry modal with full scale breakdowns, active notices, and geomagnetic storm simulation controls.

## Real-Time SDO Data Integration

`src/core/SDOFetcher.ts` fetches live satellite imagery from `https://sol24.net/sdo-images` via a graceful proxy pipeline:
- **AIA 171 Å (17.1 nm Fe IX, 1.0 MK)**: Extreme ultraviolet coronal loop and quiescent corona emissions.
- **AIA 304 Å (30.4 nm He II, 50,000 K)**: Chromospheric filaments, transition region dynamics, and limb prominences.
- **AIA 193 Å (19.3 nm Fe XII, 1.2 MK)**: Coronal holes, solar wind streams, and flare active regions.
- **HMI Magnetogram (617.3 nm)**: Photospheric magnetic field polarities, driving coronal loop arcade density and flare ignition sites.
- **Procedural Mode**: Mathematical pure-simulation mode driven exclusively by simplex/Voronoi fractal Brownian motion.

In `volumetric.frag`, real SDO pixel luminance and magnetic flux modulate the volumetric corona density, coronal loop placement, and active eruption sites on the fly.

## Approximations, stated plainly

- **Limb Darkening:** Uses Eddington's analytical approximation, `I(mu) / I(1) = 2/5 + 3/5 * mu`. The normalized curve is implemented in `SolarPhysics.ts` and mirrored in the photosphere shader. Vitest checks the analytic profile at 21 points and requires the result to match within 1% tolerance.
- **Fluid Mechanics:** No Navier-Stokes. Solar corona and flares use Fractional Brownian Motion (FBM) via 3D Simplex/Voronoi noise. Simplex FBM shapes the corona, while Voronoi cell boundaries and FBM breakup produce flare filaments. Octave count is culled dynamically: five octaves near the surface, three in the middle corona, and two in the outer corona.
- **Probe Thermodynamics:** Thermal degradation uses the inverse-square law of thermal radiation based on distance to the photosphere. With altitude `h` measured in solar radii, temperature is `T(h) = T_photosphere / (1 + h)^2`. The probe stops at the 1,500 K melt threshold, at a radial scene distance of about `1.963 R_sun`.
- **Light Integration:** Single-scattering raymarcher with early ray termination (alpha > 0.95). Rays are analytically bounded by sphere intersections for both the outer corona and the photosphere, then integrated front-to-back with an emission-absorption model. Integration exits when transmittance falls below 0.05.
- **Noise Masking:** Ray start position is jittered using a Blue Noise texture, masked temporally via Halton sequence (base 2 and 3) frame offsets and ping-pong TAA render targets. The frame offset also shifts the blue-noise lookup, while the TAA compositor uses the same base-2 and base-3 values for subpixel camera jitter.

## Rendering pipeline

1. `SunSimulator` reconstructs a camera ray for every pixel and intersects it analytically with the photosphere and the outer corona.
2. The volumetric shader marches the corona interval with 64 steps. Each step uses blue-noise-offset starting jitter and Halton temporal offsets. Simplex FBM and Voronoi flares contribute emission and extinction.
3. The photosphere is composited with Eddington limb darkening and procedural convection detail.
4. `TAACompositor` renders the scene into a floating-point scene target, then resolves it against the previous history target. Two history targets ping-pong each frame; accumulation clamps history to the current 3 × 3 neighborhood to cap ghosting without motion vectors.
5. The resolved HDR buffer is copied through ACES tone mapping and sRGB output.

The scene target uses `FloatType` when the context exposes `EXT_color_buffer_float`. The history targets use `HalfFloatType` when renderable, with an 8-bit last resort.

## Physics model in code

`src/math/SolarPhysics.ts` is the canonical TypeScript source for:

- Eddington limb darkening.
- The inverse-square thermal curve and photosphere-relative distance.
- Safe probe spawn validation.
- The melt radius.
- The probe's temperature-driven surface and emission colors.

The shader reproduces the Eddington curve for the visible photosphere, while the probe's telemetry and stopping behavior come entirely from the mathematical model.

## Test-driven development

The pure math layer was implemented and validated before any WebGL code was written. The suites are:

- `tests/Halton.test.js` verifies one-based radical inverse values, range and uniqueness, quartile coverage and mean distribution for the first 16 samples in bases 2 and 3, deterministic pairs, and input validation.
- `tests/SolarPhysics.test.js` verifies the Eddington curve against the analytical form within 1%, inverse-square thermal ratios, photosphere-relative temperature, the exact melt-radius threshold, safe spawn coordinates, rejection of unsafe coordinates, and the thermal color ramp.

Run `npm test` to execute all 15 cases.

## Structure

```text
/src
  /components
    Annotation.tsx
    FlareAlertOverlay.tsx
    FlareHeatmap.tsx
    FlareTicker.tsx
    FlareTrendChart.tsx
    Masthead.tsx
    Scale.tsx
    SDOSelector.tsx
    SolarCanvas.tsx
    SolarSoundscape.tsx
    SpaceWeatherBadge.tsx
  /core
    ProbeExplosion.ts
    SDOFetcher.ts
    SolarAudioEngine.ts
    SolarFlareMonitor.ts
    SolarSoundscapeGenerator.ts
    SunSimulator.ts
    TAACompositor.ts
  /hooks
    useSpaceWeather.ts
  /math
    Halton.ts
    SolarPhysics.ts
  /shaders
    volumetric.vert
    volumetric.frag
    taa.vert
    taa.frag
  App.tsx
  index.css
  main.tsx
  types.ts
  vite-env.d.ts
/tests
  Halton.test.js
  SolarPhysics.test.js
metadata.json
README.md
tsconfig.json
vite.config.ts
vitest.config.ts
```

## Limits

This is a visual model, not an MHD simulation. It omits magnetic-field evolution, radiative transfer, plasma dynamics, relativistic effects, and spectral rendering. Temporal accumulation has no motion vectors; the neighborhood clamp is used instead to limit ghosting during movement.
