import type { ProbeThermalAppearance } from '../types';

export const SUN_RADIUS_SCENE = 1;
export const SUN_RADIUS_KM = 696_340;
export const PHOTOSPHERE_TEMPERATURE_K = 5778;
export const PROBE_MELT_TEMPERATURE_K = 1500;
export const SAFE_SPAWN_CLEARANCE_RADII = 1;

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** The scene uses one unit for the solar radius. */
export const PROBE_SAFE_SPAWN_POSITION: Readonly<Vector3Like> = Object.freeze({
  x: -2,
  y: 0.9,
  z: 3.1,
});

/**
 * Eddington's normalized limb-darkening profile:
 * I(mu) / I(1) = 2/5 + 3/5 * mu.
 */
export function eddingtonLimbDarkening(cosTheta: number): number {
  const mu = Math.min(1, Math.max(0, Number.isFinite(cosTheta) ? cosTheta : 0));
  return 0.4 + 0.6 * mu;
}

/**
 * Radiative thermal curve where altitude is measured in solar radii above
 * the photosphere. At the photosphere the temperature is the effective
 * photosphere temperature; every additional radius scales the received
 * radiation by the inverse square of the distance to the solar center.
 */
export function inverseSquareThermalCurve(distanceFromPhotosphereRadii: number): number {
  const altitude = Math.max(
    0,
    Number.isFinite(distanceFromPhotosphereRadii)
      ? distanceFromPhotosphereRadii
      : 0,
  );
  const centerDistance = 1 + altitude;
  return PHOTOSPHERE_TEMPERATURE_K / (centerDistance * centerDistance);
}

export function distanceFromPhotosphere(position: Vector3Like | null | undefined): number {
  const radius = Math.hypot(position?.x ?? 0, position?.y ?? 0, position?.z ?? 0);
  return Math.max(0, radius - SUN_RADIUS_SCENE);
}

export function probeTemperatureAtPosition(position: Vector3Like | null | undefined): number {
  return inverseSquareThermalCurve(distanceFromPhotosphere(position));
}

export function getSafeProbeSpawnPosition(): Vector3Like {
  return { ...PROBE_SAFE_SPAWN_POSITION };
}

export function isSafeProbeSpawnPosition(position: Vector3Like | null | undefined): boolean {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    return false;
  }

  return distanceFromPhotosphere(position) >= SAFE_SPAWN_CLEARANCE_RADII;
}

/**
 * Radial scene coordinate where the inverse-square curve reaches the
 * probe's melt threshold.
 */
export const PROBE_MELT_RADIUS =
  SUN_RADIUS_SCENE *
  Math.sqrt(PHOTOSPHERE_TEMPERATURE_K / PROBE_MELT_TEMPERATURE_K);

export function probeThermalAppearance(temperatureK: number): ProbeThermalAppearance {
  const heat = Math.min(
    1,
    Math.max(
      0,
      (temperatureK - 273) / (PROBE_MELT_TEMPERATURE_K - 273),
    ),
  );
  const glow = heat * heat;

  return {
    baseColor: [
      0.52 - 0.32 * heat,
      0.56 - 0.38 * heat,
      0.62 - 0.48 * heat,
    ],
    emissiveColor: [
      1,
      0.05 + 0.29 * glow * heat,
      0.004 + 0.08 * Math.pow(heat, 6),
    ],
    emissiveIntensity: 2.8 * glow,
  };
}
