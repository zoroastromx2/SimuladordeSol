precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tHistory;
uniform vec2 uResolution;
uniform float uHistoryWeight;
uniform float uHasHistory;

varying vec2 vUv;

float taaLuma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 texel = 1.0 / uResolution;
  vec3 current = texture2D(tCurrent, vUv).rgb;

  vec3 minimum = current;
  vec3 maximum = current;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec3 sampleColor = texture2D(
        tCurrent,
        vUv + vec2(float(x), float(y)) * texel
      ).rgb;
      minimum = min(minimum, sampleColor);
      maximum = max(maximum, sampleColor);
    }
  }

  vec3 history = texture2D(tHistory, vUv).rgb;
  history = clamp(history, minimum, maximum);

  float currentLuma = taaLuma(current);
  float historyLuma = taaLuma(history);
  float contrast = abs(currentLuma - historyLuma) /
    max(currentLuma, historyLuma) ;
  float rejection = smoothstep(0.3, 1.25, contrast) * 0.55;
  float blend = uHistoryWeight * uHasHistory * (1.0 - rejection);

  vec3 result = mix(current, history, clamp(blend, 0.0, 0.96));
  gl_FragColor = vec4(max(result, vec3(0.0)), 1.0);
}
