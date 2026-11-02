precision highp float;

uniform sampler2D uBlueNoise;
uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;
uniform vec3 uCameraPosition;
uniform vec2 uCameraJitter;
uniform vec2 uFrameOffset;
uniform float uTime;
uniform float uNoiseSize;

// Real-time SDO satellite texture uniforms
uniform sampler2D uSDOTexture;
uniform int uSDOMode; // 0 = procedural, 1 = aia171, 2 = aia304, 3 = aia193, 4 = hmib
uniform float uSDOBlend; // 0.0 (procedural) to 1.0 (full SDO telemetry)
uniform float uEnableDynamicCorona; // 1.0 = active dynamic corona, 0.0 = inactive/quiescent

varying vec2 vUv;

const float SUN_RADIUS = 1.0;
const float CORONA_RADIUS = 2.35;
const int MAX_STEPS = 64;
const int MAX_OCTAVES = 5;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(
    permute(
      permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
      i.y + vec4(0.0, i1.y, i2.y, 1.0)
    ) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0)
  );

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(
    vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3))
  );
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(
    0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)),
    0.0
  );
  m *= m;
  return 42.0 * dot(
    m * m,
    vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3))
  );
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float voronoiEdge(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  float nearest = 8.0;
  float second = 8.0;

  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 point = offset + hash33(cell + offset);
        vec3 delta = point - local;
        float distanceSquared = dot(delta, delta);

        if (distanceSquared < nearest) {
          second = nearest;
          nearest = distanceSquared;
        } else if (distanceSquared < second) {
          second = distanceSquared;
        }
      }
    }
  }

  return sqrt(second) - sqrt(nearest);
}

float fbm(vec3 p, int octaves) {
  float amplitude = 0.5;
  float frequency = 1.0;
  float value = 0.0;

  for (int i = 0; i < MAX_OCTAVES; i++) {
    if (i >= octaves) {
      break;
    }
    value += amplitude * snoise(p * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }

  return value;
}

vec2 raySphere(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  float discriminant = b * b - c;

  if (discriminant < 0.0) {
    return vec2(-1.0);
  }

  float root = sqrt(discriminant);
  return vec2(-b - root, -b + root);
}

mat2 rot2D(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Samples real-time SDO analytical data mapped onto the rotating solar sphere
void sampleSDOData(
  vec3 pRot,
  out vec4 sdoColor,
  out float sdoLuma,
  out float magActivity,
  out float coronaMod
) {
  if (uSDOMode == 0) {
    sdoColor = vec4(0.5);
    sdoLuma = 0.5;
    magActivity = 0.5;
    coronaMod = 1.0;
    return;
  }

  // Orthographic disk projection mapped to solar disk coordinates
  vec2 diskUv = vec2(0.5) + (pRot.xy / SUN_RADIUS) * 0.44 * (pRot.z >= 0.0 ? 1.0 : -1.0);
  diskUv = clamp(diskUv, 0.02, 0.98);
  sdoColor = texture2D(uSDOTexture, diskUv);
  sdoLuma = dot(sdoColor.rgb, vec3(0.299, 0.587, 0.114));

  if (uSDOMode == 4) {
    // HMI Magnetogram: quiet sun is ~0.5 grey. Active regions are intense black/white poles.
    float flux = abs(sdoLuma - 0.5) * 2.0;
    magActivity = smoothstep(0.08, 0.55, flux);
    coronaMod = 0.3 + 2.4 * magActivity;
  } else if (uSDOMode == 1) {
    // AIA 171: Extreme UV coronal loop emission
    magActivity = smoothstep(0.12, 0.70, sdoLuma);
    coronaMod = 0.35 + 2.0 * sdoLuma;
  } else if (uSDOMode == 2) {
    // AIA 304: Chromospheric He II prominence / flare ejecta
    magActivity = smoothstep(0.10, 0.65, sdoLuma);
    coronaMod = 0.35 + 2.1 * sdoLuma;
  } else {
    // AIA 193: Coronal holes & flare active regions
    magActivity = smoothstep(0.15, 0.60, sdoLuma);
    coronaMod = 0.30 + 1.8 * sdoLuma;
  }
}

// Evaluates a coronal loop arcade with multiple concentric magnetic ribs
float evaluateCoronalArcade(
  vec3 p,
  vec3 centerDir,
  float arcadeLen,
  float arcadeSpan,
  float apexHeight,
  float timeShift
) {
  vec3 norm = normalize(centerDir);
  vec3 tangent = normalize(
    cross(norm, abs(norm.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))
  );
  vec3 bitangent = cross(norm, tangent);

  vec3 dP = p - norm;
  float z = dot(dP, tangent);    // axis along arcade
  float x = dot(dP, bitangent);  // span across arcade
  float y = dot(dP, norm);       // altitude above photosphere

  if (
    y < 0.005 ||
    y > apexHeight * 1.6 ||
    abs(z) > arcadeLen * 1.3 ||
    abs(x) > arcadeSpan * 1.45
  ) {
    return 0.0;
  }

  float envelopeZ = smoothstep(arcadeLen * 1.25, arcadeLen * 0.35, abs(z));
  float envelopeX = smoothstep(arcadeSpan * 1.4, arcadeSpan * 0.25, abs(x));

  // Regular magnetic flux tube ribs along arcade axis
  float ribSpacing = 0.054;
  float ribCoord = (z + arcadeLen) / ribSpacing;
  float ribIndex = floor(ribCoord);
  float ribFrac = (fract(ribCoord) - 0.5) * ribSpacing;

  // Varied loop heights and spans per rib
  float hVar = apexHeight * (0.8 + 0.34 * sin(ribIndex * 2.3 + timeShift * 0.15));
  float wVar = arcadeSpan * (0.82 + 0.26 * cos(ribIndex * 1.7));

  // Circular arc rooted at (+-wVar, 0) with apex at hVar
  float R = (hVar * hVar + wVar * wVar) / (2.0 * max(hVar, 0.01));
  float y0 = hVar - R;

  float distToCircle = abs(length(vec2(x, y - y0)) - R);
  float dist3D = sqrt(distToCircle * distToCircle + ribFrac * ribFrac);

  float theta = atan(y - y0, x);
  // Plasma velocity along magnetic field lines
  float flow = sin(theta * 13.0 - uTime * 4.6 + ribIndex * 1.7);
  // Striated multi-strand sub-filaments
  float strand = 0.72 + 0.28 * sin(theta * 28.0 + ribFrac * 140.0 + uTime * 2.0);

  float tubeRadius = 0.014 + 0.005 * sin(ribIndex * 4.2);
  float tube = exp(-(dist3D * dist3D) / (2.0 * tubeRadius * tubeRadius));

  // Hot magnetic footpoint brightening
  float footpoint = 1.0 + 1.35 * exp(-y * 15.0);

  return tube * (0.64 + 0.36 * flow) * strand * envelopeZ * envelopeX * footpoint;
}

// Samples multiple dynamic coronal loop systems
void sampleCoronalLoops(
  vec3 pRot,
  float altitude,
  out float density,
  out vec3 emission
) {
  density = 0.0;
  emission = vec3(0.0);

  if (altitude > 0.85 || altitude < 0.0) {
    return;
  }

  // Active Region Arcades
  vec3 N1 = normalize(vec3(0.78, 0.32, 0.54));
  vec3 N2 = normalize(vec3(-0.52, -0.41, 0.75));
  vec3 N3 = normalize(vec3(-0.68, 0.24, -0.69));

  float a1 = evaluateCoronalArcade(pRot, N1, 0.28, 0.22, 0.30, 0.0);
  float a2 = evaluateCoronalArcade(pRot, N2, 0.24, 0.19, 0.24, 1.7);
  float a3 = evaluateCoronalArcade(pRot, N3, 0.32, 0.25, 0.36, 3.4);

  float totalLoops = a1 + a2 + a3;
  if (totalLoops <= 0.0001) {
    return;
  }

  density = totalLoops * 0.44;

  // Multi-million Kelvin magnetic plasma emission
  vec3 coreHot = vec3(1.0, 0.95, 0.80);
  vec3 outerAmber = vec3(1.0, 0.60, 0.14);
  vec3 loopColor = mix(outerAmber, coreHot, clamp(totalLoops * 1.5, 0.0, 1.0));

  emission = loopColor * totalLoops * 18.0;
}

// Samples volumetric solar flares and eruptive prominence/CME blasts
void sampleVolumetricFlares(
  vec3 pRot,
  float altitude,
  out float density,
  out vec3 emission
) {
  density = 0.0;
  emission = vec3(0.0);

  if (altitude > 1.35 || altitude < 0.0) {
    return;
  }

  // 1. Periodic Major Eruptive Blast & CME Plume (9.5-second cycle)
  vec3 flareOrigin = normalize(vec3(0.38, 0.52, -0.76));
  float flareCycle = mod(uTime, 9.5);

  vec3 dF = pRot - flareOrigin;
  float hF = dot(dF, flareOrigin);
  vec3 perpF = dF - flareOrigin * hF;
  float radF = length(perpF);

  float flash = smoothstep(1.8, 2.3, flareCycle) * smoothstep(3.2, 2.5, flareCycle);
  float eruptionProgress = clamp((flareCycle - 2.2) / 4.8, 0.0, 1.0);
  float isErupting = step(2.2, flareCycle) * step(flareCycle, 7.5);

  // Magnetic reconnection kernel at flare footpoint
  float kernelDist = length(dF);
  float kernel = exp(-kernelDist * 20.0) * (0.8 + 4.8 * flash);

  // Volumetric eruptive CME plume
  float plume = 0.0;
  if (isErupting > 0.0 && hF > 0.02) {
    float blastHeight = 0.1 + eruptionProgress * 1.08;
    float blastDistH = abs(hF - blastHeight);
    float coneRadius = 0.05 + 0.44 * hF;

    if (radF < coneRadius * 1.5 && blastHeight > 0.05) {
      vec3 turbPos = pRot * 4.2 + vec3(uTime * 0.12, -uTime * 0.35, uTime * 0.18);
      float turb = 0.5 + 0.5 * fbm(turbPos, 3);
      float coreRope = exp(-pow(radF / (coneRadius * 0.55), 2.0));
      float bubble = exp(-pow(blastDistH / (0.16 + 0.25 * eruptionProgress), 2.0)) *
        smoothstep(coneRadius * 1.3, coneRadius * 0.1, radF);
      float filamentTear = 1.0 - smoothstep(0.01, 0.18, voronoiEdge(turbPos * 2.0));

      plume = (coreRope * 0.7 + bubble * 1.4) * (0.4 + 0.6 * turb + 0.5 * filamentTear);
      plume *= (1.0 - eruptionProgress * 0.45);
    }
  }

  // Expanding shockwave ripple (Moreton wave)
  float shock = 0.0;
  if (flareCycle > 2.0 && flareCycle < 5.5) {
    float shockRadius = (flareCycle - 2.0) * 0.36;
    float distToShock = abs(kernelDist - shockRadius);
    shock = exp(-distToShock * 24.0) * exp(-hF * 4.0) * smoothstep(5.5, 2.5, flareCycle) * 0.7;
  }

  // 2. Continuous Twisted Prominence Eruption (Limb Prominence)
  vec3 promOrigin = normalize(vec3(-0.84, -0.32, 0.43));
  vec3 dP = pRot - promOrigin;
  float hP = dot(dP, promOrigin);
  vec3 perpP = dP - promOrigin * hP;
  float radP = length(perpP);

  float promArch = 0.0;
  if (hP > 0.01 && hP < 0.65 && radP < 0.38) {
    float wave = sin(hP * 12.0 - uTime * 2.4 + pRot.y * 10.0);
    vec3 promTurbPos = pRot * 5.2 + vec3(0.0, uTime * 0.22, uTime * 0.1);
    float promTurb = fbm(promTurbPos, 2);
    float fluxRope = exp(-pow(radP / 0.14, 2.0)) * smoothstep(0.65, 0.15, hP);
    promArch = fluxRope * (0.6 + 0.4 * wave + 0.3 * promTurb);
  }

  float totalFlare = kernel + plume * 1.8 + shock + promArch * 0.9;
  if (totalFlare <= 0.0001) {
    return;
  }

  density = totalFlare * 0.55;

  // Ultra-high temperature flare emission (15 - 30 Million Kelvin)
  vec3 ultraFlash = vec3(1.0, 0.98, 0.92);
  vec3 flareGold = vec3(1.0, 0.78, 0.22);
  vec3 flareOrange = vec3(1.0, 0.42, 0.06);
  vec3 promScarlet = vec3(1.0, 0.18, 0.02);

  vec3 flareCol = mix(flareOrange, flareGold, clamp((kernel + plume) * 1.2, 0.0, 1.0));
  flareCol = mix(flareCol, ultraFlash, clamp(kernel * 0.8 + flash * 1.2, 0.0, 1.0));
  flareCol = mix(flareCol, promScarlet, clamp(promArch * 0.7, 0.0, 1.0));

  emission = flareCol * totalFlare * (24.0 + 36.0 * flash);
}

vec3 photosphere(vec3 hit, vec3 rayDirection) {
  vec3 normal = normalize(hit);
  float mu = clamp(dot(normal, -rayDirection), 0.0, 1.0);
  float limb = 0.4 + 0.6 * mu;
  float convection = 0.5 + 0.5 * fbm(
    normal * 8.0 + vec3(0.0, uTime * 0.018, uTime * 0.009),
    3
  );
  float granulation = snoise(
    normal * 34.0 + vec3(0.0, uTime * 0.035, uTime * 0.015)
  );
  float fineDetail = snoise(
    normal * 91.0 - vec3(uTime * 0.02, 0.0, uTime * 0.012)
  );
  float cells = 1.0 - smoothstep(
    0.0,
    0.2,
    voronoiEdge(normal * 12.0 + vec3(0.0, uTime * 0.02, 0.0))
  );
  float detail = 0.82 +
    granulation * 0.24 +
    fineDetail * 0.07 +
    (cells - 0.5) * 0.22 +
    (convection - 0.5) * 0.28;

  // Active regions, faculae and sunspots at magnetic footpoints
  vec3 pRot = normal;
  pRot.xz = rot2D(uTime * 0.04) * pRot.xz;

  vec3 N1 = normalize(vec3(0.78, 0.32, 0.54));
  vec3 N2 = normalize(vec3(-0.52, -0.41, 0.75));
  vec3 N3 = normalize(vec3(-0.68, 0.24, -0.69));
  vec3 flareOrigin = normalize(vec3(0.38, 0.52, -0.76));

  float d1 = length(pRot - N1);
  float d2 = length(pRot - N2);
  float d3 = length(pRot - N3);
  float dF = length(pRot - flareOrigin);
  float minActiveDist = min(min(d1, d2), min(d3, dF));

  // Magnetic faculae (bright plage around active regions)
  float faculae = smoothstep(0.32, 0.04, minActiveDist) *
    smoothstep(0.15, 0.85, 0.5 + 0.5 * snoise(pRot * 48.0));

  // Sunspots (cool dark umbra and penumbra at loop footpoints)
  float sunspotUmbra = smoothstep(0.045, 0.015, minActiveDist);
  float sunspotPenumbra = smoothstep(0.085, 0.035, minActiveDist) * 0.5;

  detail = (detail * (1.0 - sunspotPenumbra) * (1.0 - sunspotUmbra * 0.75)) + faculae * 0.45;

  vec3 tint = mix(
    vec3(1.0, 0.1, 0.006),
    vec3(1.0, 0.56, 0.15),
    pow(mu, 0.55)
  );

  // Real-time SDO Texture Modulation on Photosphere
  if (uSDOMode > 0) {
    vec4 sdoSurfaceCol;
    float sdoSurfLuma;
    float sdoSurfMag;
    float sdoSurfMod;
    sampleSDOData(pRot, sdoSurfaceCol, sdoSurfLuma, sdoSurfMag, sdoSurfMod);

    if (uSDOMode == 4) {
      // HMI Magnetogram: Show real magnetic field bipolar regions
      vec3 magColor = mix(vec3(0.08, 0.38, 0.95), vec3(0.95, 0.18, 0.05), sdoSurfLuma);
      tint = mix(tint, magColor, uSDOBlend * (0.35 + 0.65 * sdoSurfMag));
      detail = mix(detail, detail * (0.7 + 1.2 * sdoSurfMag), uSDOBlend * 0.6);
    } else {
      // AIA Wavelengths: Blend authentic satellite emission with convection
      tint = mix(tint, sdoSurfaceCol.rgb * 1.55, uSDOBlend * 0.72);
      detail = mix(detail, detail * (0.6 + 1.1 * sdoSurfMod), uSDOBlend * 0.65);
    }
  } else {
    // Faculae glow hot white-gold in procedural mode
    tint = mix(tint, vec3(1.0, 0.88, 0.55), faculae * 0.6);
    // Sunspots are deep umbral brown/black
    tint = mix(tint, vec3(0.22, 0.05, 0.01), sunspotUmbra * 0.85);
  }

  return tint * limb * (1.55 * detail);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0 + uCameraJitter;
  vec4 viewRay = uInverseProjection * vec4(ndc, 1.0, 1.0);
  vec3 rayDirection = normalize(
    mat3(uCameraWorld) * normalize(viewRay.xyz / viewRay.w)
  );
  vec3 rayOrigin = uCameraPosition;

  vec2 coronaHit = raySphere(rayOrigin, rayDirection, CORONA_RADIUS);
  vec2 sunHit = raySphere(rayOrigin, rayDirection, SUN_RADIUS);
  bool hitsPhotosphere = sunHit.x > 0.0;

  if (coronaHit.y < max(coronaHit.x, 0.0)) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float startT = max(coronaHit.x, 0.0);
  float endT = coronaHit.y;
  if (hitsPhotosphere) {
    endT = min(endT, sunHit.x);
  }

  if (endT <= startT) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 noiseUv = (
    gl_FragCoord.xy + uFrameOffset * uNoiseSize
  ) / uNoiseSize;
  float blueNoise = texture2D(uBlueNoise, noiseUv).r;
  float temporalOffset = fract(
    blueNoise +
    uFrameOffset.x * 0.61803398875 +
    uFrameOffset.y * 0.38196601125
  );

  float stepSize = (endT - startT) / float(MAX_STEPS);
  float t = startT + stepSize * temporalOffset;
  float transmittance = 1.0;
  vec3 scattered = vec3(0.0);
  vec3 flow = vec3(0.0, uTime * 0.055, uTime * 0.022);

  for (int stepIndex = 0; stepIndex < MAX_STEPS; stepIndex++) {
    if (t >= endT) {
      break;
    }

    vec3 position = rayOrigin + rayDirection * t;
    float radius = length(position);
    float altitude = max(radius - SUN_RADIUS, 0.0);

    // 1. Ambient corona turbulence & radial streamers
    int octaves = altitude < 0.28 ? 5 : (altitude < 0.9 ? 3 : 2);
    float turbulence = 0.5 + 0.5 * fbm(position * 2.15 + flow, octaves);
    float outerFade = 1.0 - smoothstep(
      CORONA_RADIUS - 1.15,
      CORONA_RADIUS,
      radius
    );
    float envelope = exp(-altitude * 2.8) * outerFade;
    float filaments = smoothstep(0.38, 0.78, turbulence);
    float baseDensity = envelope * (
      0.022 + 0.30 * filaments * filaments
    );

    // Rotating solar frame for magnetic features and real SDO satellite data
    vec3 pRot = position;
    pRot.xz = rot2D(uTime * 0.04) * pRot.xz;

    // Sample real SDO imagery
    vec4 sdoCol;
    float sdoLuma;
    float sdoMag;
    float sdoCoronaMod;
    sampleSDOData(pRot, sdoCol, sdoLuma, sdoMag, sdoCoronaMod);

    // Modulate procedural turbulence with real SDO telemetry
    if (uSDOMode > 0) {
      turbulence = mix(turbulence, turbulence * sdoCoronaMod, uSDOBlend * 0.85);
      filaments = mix(filaments, filaments * (0.35 + 1.7 * sdoMag), uSDOBlend * 0.8);
      baseDensity = mix(baseDensity, baseDensity * sdoCoronaMod, uSDOBlend * 0.75);
    }

    // Scale ambient corona when dynamic corona is disabled
    baseDensity *= mix(0.15, 1.0, uEnableDynamicCorona);

    // 2. Magnetic coronal loops (active only when dynamic corona is enabled)
    float loopDensity = 0.0;
    vec3 loopEmission = vec3(0.0);
    if (uEnableDynamicCorona > 0.001) {
      sampleCoronalLoops(pRot, altitude, loopDensity, loopEmission);
      if (uSDOMode > 0) {
        loopDensity *= mix(1.0, 0.25 + 2.6 * sdoMag, uSDOBlend);
        loopEmission *= mix(1.0, 0.30 + 2.8 * sdoMag, uSDOBlend);
      }
      loopDensity *= uEnableDynamicCorona;
      loopEmission *= uEnableDynamicCorona;
    }

    // 3. Dynamic volumetric flares & eruptions (active only when dynamic corona is enabled)
    float flareDensity = 0.0;
    vec3 flareEmission = vec3(0.0);
    if (uEnableDynamicCorona > 0.001) {
      sampleVolumetricFlares(pRot, altitude, flareDensity, flareEmission);
      if (uSDOMode > 0) {
        flareDensity *= mix(1.0, 0.25 + 3.0 * sdoMag, uSDOBlend);
        flareEmission *= mix(1.0, 0.30 + 2.7 * sdoMag, uSDOBlend);
      }
      flareDensity *= uEnableDynamicCorona;
      flareEmission *= uEnableDynamicCorona;
    }

    float totalDensity = baseDensity + loopDensity + flareDensity;

    vec3 basePlasma = mix(
      vec3(1.0, 0.2, 0.018),
      vec3(1.0, 0.55, 0.11),
      smoothstep(0.05, 1.1, altitude)
    );
    float baseEmission = baseDensity * 5.1;

    vec3 totalEmission = basePlasma * baseEmission + loopEmission + flareEmission;

    scattered += transmittance * totalEmission * stepSize;
    transmittance *= exp(
      -(totalDensity * 1.7 + flareDensity * 2.2 + loopDensity * 1.5) * stepSize
    );

    if (transmittance < 0.05) {
      break;
    }

    t += stepSize;
  }

  vec3 color;
  if (hitsPhotosphere) {
    vec3 surfaceHit = rayOrigin + rayDirection * sunHit.x;
    color = scattered + photosphere(surfaceHit, rayDirection) * transmittance;
  } else {
    color = scattered;
  }

  gl_FragColor = vec4(color, 1.0);
}
