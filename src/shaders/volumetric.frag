precision highp float;

uniform sampler2D uBlueNoise;
uniform mat4 uInverseProjection;
uniform mat4 uCameraWorld;
uniform vec3 uCameraPosition;
uniform vec2 uCameraJitter;
uniform vec2 uFrameOffset;
uniform float uTime;
uniform float uNoiseSize;

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
  vec3 tint = mix(
    vec3(1.0, 0.1, 0.006),
    vec3(1.0, 0.56, 0.15),
    pow(mu, 0.55)
  );

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
    int octaves = altitude < 0.28 ? 5 : (altitude < 0.9 ? 3 : 2);
    float turbulence = 0.5 + 0.5 * fbm(position * 2.15 + flow, octaves);
    float outerFade = 1.0 - smoothstep(
      CORONA_RADIUS - 1.15,
      CORONA_RADIUS,
      radius
    );
    float envelope = exp(-altitude * 2.9) * outerFade;
    float filaments = smoothstep(0.4, 0.78, turbulence);
    float density = envelope * (
      0.022 + 0.32 * filaments * filaments
    );
    float flare = 0.0;

    if (altitude < 0.72) {
      vec3 flarePoint = position * vec3(2.4, 3.1, 2.4) + vec3(
        uTime * 0.03,
        -uTime * 0.07,
        uTime * 0.045
      );
      float edge = 1.0 - smoothstep(0.008, 0.075, voronoiEdge(flarePoint));
      float arc = smoothstep(
        0.3,
        0.82,
        0.5 + 0.5 * fbm(flarePoint * 1.4 + flow * 1.8, 3)
      );
      float breakup = smoothstep(
        -0.15,
        0.35,
        fbm(position * 4.6 + flow * 0.7, 2)
      );
      float activeRegion = smoothstep(0.38, 0.72, turbulence);
      flare = edge * arc * breakup * activeRegion * exp(-altitude * 5.4);
      density += flare * 0.55;
    }

    vec3 plasma = mix(
      vec3(1.0, 0.2, 0.018),
      vec3(1.0, 0.55, 0.11),
      smoothstep(0.05, 1.1, altitude)
    );
    plasma = mix(plasma, vec3(1.0, 0.82, 0.45), flare);
    float emission = density * 5.1 + flare * 9.0;

    scattered += transmittance * plasma * emission * stepSize;
    transmittance *= exp(
      -(density * 1.7 + flare * 2.2) * stepSize
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
