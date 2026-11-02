import { describe, expect, it } from 'vitest';
import {
  PHOTOSPHERE_TEMPERATURE_K,
  PROBE_MELT_RADIUS,
  PROBE_MELT_TEMPERATURE_K,
  PROBE_SAFE_SPAWN_POSITION,
  SUN_RADIUS_SCENE,
  distanceFromPhotosphere,
  eddingtonLimbDarkening,
  getSafeProbeSpawnPosition,
  inverseSquareThermalCurve,
  isSafeProbeSpawnPosition,
  probeTemperatureAtPosition,
  probeThermalAppearance,
} from '../src/math/SolarPhysics';

describe('Eddington limb darkening', () => {
  it('matches Eddington I(mu)/I(1) = 2/5 + 3/5 mu within 1%', () => {
    for (let step = 0; step <= 20; step += 1) {
      const mu = step / 20;
      const expected = 0.4 + 0.6 * mu;
      const actual = eddingtonLimbDarkening(mu);

      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
        expected * 0.01,
      );
    }
  });

  it('normalizes the photosphere center to one and limb to 0.4', () => {
    expect(eddingtonLimbDarkening(1)).toBeCloseTo(1, 12);
    expect(eddingtonLimbDarkening(0)).toBeCloseTo(0.4, 12);
  });

  it('clamps cosine outside of the physical domain', () => {
    expect(eddingtonLimbDarkening(-4)).toBeCloseTo(0.4, 12);
    expect(eddingtonLimbDarkening(9)).toBeCloseTo(1, 12);
  });
});

describe('Solar thermal model', () => {
  it('obeys the inverse-square law from the photosphere', () => {
    expect(inverseSquareThermalCurve(0)).toBeCloseTo(
      PHOTOSPHERE_TEMPERATURE_K,
      10,
    );
    expect(inverseSquareThermalCurve(1)).toBeCloseTo(
      PHOTOSPHERE_TEMPERATURE_K / 4,
      10,
    );
    expect(inverseSquareThermalCurve(3)).toBeCloseTo(
      PHOTOSPHERE_TEMPERATURE_K / 16,
      10,
    );
    expect(inverseSquareThermalCurve(2) / inverseSquareThermalCurve(4)).toBeCloseTo(
      25 / 9,
      10,
    );
  });

  it('derives probe temperature from distance to the photosphere', () => {
    const atSurface = { x: SUN_RADIUS_SCENE, y: 0, z: 0 };
    const oneRadiusAway = { x: SUN_RADIUS_SCENE + 1, y: 0, z: 0 };

    expect(distanceFromPhotosphere(atSurface)).toBeCloseTo(0, 12);
    expect(probeTemperatureAtPosition(atSurface)).toBeCloseTo(
      PHOTOSPHERE_TEMPERATURE_K,
      10,
    );
    expect(distanceFromPhotosphere(oneRadiusAway)).toBeCloseTo(1, 12);
    expect(probeTemperatureAtPosition(oneRadiusAway)).toBeCloseTo(
      PHOTOSPHERE_TEMPERATURE_K / 4,
      10,
    );
  });

  it('places the melt stop exactly at the inverse-square threshold', () => {
    const meltPosition = { x: PROBE_MELT_RADIUS, y: 0, z: 0 };

    expect(probeTemperatureAtPosition(meltPosition)).toBeCloseTo(
      PROBE_MELT_TEMPERATURE_K,
      8,
    );
    expect(PROBE_MELT_RADIUS).toBeGreaterThan(SUN_RADIUS_SCENE);
  });
});

describe('Probe spawn safety', () => {
  it('provides safe, finite spawn coordinates outside the photosphere', () => {
    const spawn = getSafeProbeSpawnPosition();
    const radius = Math.hypot(spawn.x, spawn.y, spawn.z);

    expect(spawn).toEqual(PROBE_SAFE_SPAWN_POSITION);
    expect(spawn).not.toBe(PROBE_SAFE_SPAWN_POSITION);
    expect(Number.isFinite(spawn.x)).toBe(true);
    expect(Number.isFinite(spawn.y)).toBe(true);
    expect(Number.isFinite(spawn.z)).toBe(true);
    expect(radius).toBeGreaterThan(SUN_RADIUS_SCENE + 1);
    expect(isSafeProbeSpawnPosition(spawn)).toBe(true);
    expect(probeTemperatureAtPosition(spawn)).toBeLessThan(
      PROBE_MELT_TEMPERATURE_K,
    );
  });

  it('rejects coordinates inside the safe clearance zone', () => {
    expect(isSafeProbeSpawnPosition({ x: 0, y: 0, z: 0 })).toBe(false);
    expect(isSafeProbeSpawnPosition({ x: 1.2, y: 0, z: 0 })).toBe(false);
    expect(isSafeProbeSpawnPosition({ x: NaN, y: 0, z: 0 })).toBe(false);
    expect(isSafeProbeSpawnPosition(null)).toBe(false);
  });
});

describe('Probe thermal appearance', () => {
  it('is emissive when hot and dark when cold', () => {
    const cold = probeThermalAppearance(273);
    const hot = probeThermalAppearance(PROBE_MELT_TEMPERATURE_K);

    expect(cold.emissiveIntensity).toBeCloseTo(0, 12);
    expect(hot.emissiveIntensity).toBeGreaterThan(1);
    expect(hot.baseColor[0]).toBeGreaterThan(hot.baseColor[1]);
    expect(hot.baseColor[1]).toBeGreaterThan(hot.baseColor[2]);
    expect(hot.emissiveColor.every(Number.isFinite)).toBe(true);
  });
});
