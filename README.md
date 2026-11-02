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
- Select **Release probe** to drop the probe toward the photosphere.
- At the thermal limit the descent stops. Select **Retrieve probe** to reset it to the safe spawn coordinate.

The HUD reports the probe temperature and its physical distance from the photosphere in kilometres. The scene maps one world unit to one solar radius, or 696,340 km.

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
    Masthead.tsx
    Scale.tsx
    SolarCanvas.tsx
    TelemetryPanel.tsx
  /core
    SunSimulator.ts
    TAACompositor.ts
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
