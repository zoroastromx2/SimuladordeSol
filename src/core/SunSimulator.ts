import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  DataTexture,
  DirectionalLight,
  FloatType,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { halton2, halton3 } from '../math/Halton';
import {
  PROBE_MELT_TEMPERATURE_K,
  PROBE_SAFE_SPAWN_POSITION,
  SUN_RADIUS_KM,
  distanceFromPhotosphere,
  probeTemperatureAtPosition,
  probeThermalAppearance,
} from '../math/SolarPhysics';
import type {
  ProbeStatus,
  SDOArchiveFrame,
  SDOMode,
  TelemetryData,
} from '../types';
import volumetricFragmentShader from '../shaders/volumetric.frag';
import volumetricVertexShader from '../shaders/volumetric.vert';
import { TAACompositor } from './TAACompositor';
import { ProbeExplosion } from './ProbeExplosion';
import { SDOFetcher } from './SDOFetcher';
import { SolarAudioEngine } from './SolarAudioEngine';

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value =
      (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const createBlueNoiseTexture = (size = 64): DataTexture => {
  const count = size * size;
  const half = count / 2;
  const sigma = 1.5;
  const kernelRadius = Math.ceil(sigma * 3);
  const kernel: Array<{ dx: number; dy: number; weight: number }> = [];

  for (let dy = -kernelRadius; dy <= kernelRadius; dy += 1) {
    for (let dx = -kernelRadius; dx <= kernelRadius; dx += 1) {
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= kernelRadius * kernelRadius) {
        kernel.push({
          dx,
          dy,
          weight: Math.exp(-distanceSquared / (2 * sigma * sigma)),
        });
      }
    }
  }

  const pattern = new Uint8Array(count);
  const energy = new Float32Array(count);
  const random = mulberry32(0x51a7c0de);
  const indices = new Uint16Array(count);
  for (let index = 0; index < count; index += 1) {
    indices[index] = index;
  }
  for (let index = count - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = indices[index];
    indices[index] = indices[swapIndex];
    indices[swapIndex] = value;
  }

  const stamp = (index: number, sign: number) => {
    const x = index % size;
    const y = Math.floor(index / size);

    for (const { dx, dy, weight } of kernel) {
      let sampleX = x + dx;
      let sampleY = y + dy;
      if (sampleX < 0) sampleX += size;
      if (sampleX >= size) sampleX -= size;
      if (sampleY < 0) sampleY += size;
      if (sampleY >= size) sampleY -= size;
      energy[sampleY * size + sampleX] += weight * sign;
    }
  };

  for (let index = 0; index < half; index += 1) {
    const pixel = indices[index];
    pattern[pixel] = 1;
    stamp(pixel, 1);
  }

  const findCluster = () => {
    let bestIndex = -1;
    let bestEnergy = -Infinity;
    for (let index = 0; index < count; index += 1) {
      if (pattern[index] === 1 && energy[index] > bestEnergy) {
        bestIndex = index;
        bestEnergy = energy[index];
      }
    }
    return bestIndex;
  };

  const findVoid = () => {
    let bestIndex = -1;
    let bestEnergy = Infinity;
    for (let index = 0; index < count; index += 1) {
      if (pattern[index] === 0 && energy[index] < bestEnergy) {
        bestIndex = index;
        bestEnergy = energy[index];
      }
    }
    return bestIndex;
  };

  for (let iteration = 0; iteration < count * 2; iteration += 1) {
    const cluster = findCluster();
    if (cluster < 0) {
      break;
    }

    pattern[cluster] = 0;
    stamp(cluster, -1);
    const voidPixel = findVoid();

    if (voidPixel === cluster) {
      pattern[cluster] = 1;
      stamp(cluster, 1);
      break;
    }

    if (voidPixel < 0) {
      pattern[cluster] = 1;
      stamp(cluster, 1);
      break;
    }

    pattern[voidPixel] = 1;
    stamp(voidPixel, 1);
  }

  const ranks = new Uint16Array(count);
  for (let rank = half - 1; rank >= 0; rank -= 1) {
    const cluster = findCluster();
    if (cluster < 0) {
      break;
    }
    pattern[cluster] = 0;
    stamp(cluster, -1);
    ranks[cluster] = rank;
  }

  for (let rank = half; rank < count; rank += 1) {
    const voidPixel = findVoid();
    if (voidPixel < 0) {
      break;
    }
    pattern[voidPixel] = 1;
    stamp(voidPixel, 1);
    ranks[voidPixel] = rank;
  }

  const data = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    const value = (ranks[index] + 0.5) / count;
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 1;
  }

  const texture = new DataTexture(
    data,
    size,
    size,
    RGBAFormat,
    FloatType,
  );
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

export interface SunSimulatorOptions {
  mount: HTMLElement;
  onTelemetryChange?: (telemetry: TelemetryData) => void;
}

export class SunSimulator {
  public mount: HTMLElement;
  public onTelemetryChange?: (telemetry: TelemetryData) => void;
  public clock: Clock;
  public elapsed: number;
  public probeTemperature: number;
  public probeState: {
    dropping: boolean;
    stopped: boolean;
    speed: number;
    disintegrating: boolean;
    destroyed: boolean;
    disintegrationProgress: number;
  };
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer;
  public controls: OrbitControls;
  public blueNoiseSize: number;
  public blueNoise: DataTexture;
  public volumetricMaterial!: ShaderMaterial;
  public volumetricMesh!: Mesh;
  public probe!: Group;
  public probeMaterial!: MeshStandardMaterial;
  public probeTrimMaterial!: MeshStandardMaterial;
  public probeCore!: Mesh;
  public probeRing!: Mesh;
  public probeGlow!: PointLight;
  public compositor: TAACompositor;
  public explosion: ProbeExplosion;
  public sdoFetcher: SDOFetcher;
  public sdoMode: SDOMode = 'procedural';
  public currentTimelineFrame: SDOArchiveFrame | null = null;
  public dynamicCoronaEnabled: boolean = true;
  public audioEngine: SolarAudioEngine;
  public disintegrationUniforms: {
    uDisintegration: { value: number };
    uTime: { value: number };
  };
  private currentStatus: ProbeStatus = 'Standby';

  constructor({ mount, onTelemetryChange }: SunSimulatorOptions) {
    this.mount = mount;
    this.onTelemetryChange = onTelemetryChange;
    this.clock = new Clock();
    this.elapsed = 0;
    this.probeTemperature = 0;
    this.probeState = {
      dropping: false,
      stopped: false,
      speed: 0,
      disintegrating: false,
      destroyed: false,
      disintegrationProgress: 0,
    };

    this.sdoFetcher = new SDOFetcher();
    this.audioEngine = new SolarAudioEngine();

    this.disintegrationUniforms = {
      uDisintegration: { value: 0.0 },
      uTime: { value: 0.0 },
    };

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      80,
    );
    this.camera.position.set(0, 1.9, 8.6);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x020203, 1);
    this.mount.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.9;
    this.controls.maxDistance = 14;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.7;

    this.setupLighting();
    this.blueNoiseSize = 64;
    this.blueNoise = createBlueNoiseTexture(this.blueNoiseSize);
    this.setupVolumetricSun();
    this.setupProbe();

    this.explosion = new ProbeExplosion(this.scene);

    this.compositor = new TAACompositor(
      this.renderer,
      this.scene,
      this.camera,
      {
        historyWeight: 0.9,
        onJitter: ({ frame, jitter }) => {
          this.volumetricMaterial.uniforms.uCameraJitter.value.copy(jitter);
          this.volumetricMaterial.uniforms.uFrameOffset.value.set(
            halton2(frame + 1),
            halton3(frame + 1),
          );
        },
      },
    );

    this.handleResize = this.handleResize.bind(this);
    this.animate = this.animate.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
    this.resetProbe();
  }

  setupLighting(): void {
    this.scene.add(new AmbientLight(0x5c6a7f, 0.38));
    this.scene.add(new HemisphereLight(0x7798d0, 0x29130b, 0.35));

    const sunLight = new PointLight(0xffb15c, 220, 0, 2);
    const fillLight = new DirectionalLight(0x9ab8dd, 0.7);
    fillLight.position.set(-4, 5, 8);
    this.scene.add(sunLight, fillLight);
  }

  setupVolumetricSun(): void {
    this.volumetricMaterial = new ShaderMaterial({
      uniforms: {
        uBlueNoise: { value: this.blueNoise },
        uInverseProjection: { value: this.camera.projectionMatrixInverse },
        uCameraWorld: { value: this.camera.matrixWorld },
        uCameraPosition: { value: new Vector3() },
        uCameraJitter: { value: new Vector2() },
        uFrameOffset: { value: new Vector2() },
        uTime: { value: 0 },
        uNoiseSize: { value: this.blueNoiseSize },
        uSDOTexture: { value: this.sdoFetcher.getDefaultTexture() },
        uSDOMode: { value: 0 },
        uSDOBlend: { value: 0.0 },
        uEnableDynamicCorona: { value: 1.0 },
      },
      vertexShader: volumetricVertexShader,
      fragmentShader: volumetricFragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.volumetricMesh = new Mesh(
      new PlaneGeometry(2, 2),
      this.volumetricMaterial,
    );
    this.volumetricMesh.frustumCulled = false;
    this.volumetricMesh.renderOrder = -100;
    this.scene.add(this.volumetricMesh);
  }

  injectDisintegrationShader(material: MeshStandardMaterial): void {
    material.customProgramCacheKey = () => 'disintegration';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDisintegration = this.disintegrationUniforms.uDisintegration;
      shader.uniforms.uDisintegrationTime = this.disintegrationUniforms.uTime;

      shader.vertexShader = `
        varying vec3 vModelPosition;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vModelPosition = position;
        `
      );

      shader.fragmentShader = `
        uniform float uDisintegration;
        uniform float uDisintegrationTime;
        varying vec3 vModelPosition;

        float disSampleNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n = i.x + i.y * 57.0 + i.z * 113.0;
          vec4 hash = fract(sin(vec4(n, n + 1.0, n + 57.0, n + 58.0)) * 43758.5453);
          float a = mix(hash.x, hash.y, f.x);
          float b = mix(hash.z, hash.w, f.x);
          return mix(a, b, f.y);
        }

        float disFbm(vec3 p) {
          float v = 0.5 * disSampleNoise(p);
          v += 0.25 * disSampleNoise(p * 2.02);
          v += 0.125 * disSampleNoise(p * 4.05);
          return v;
        }
        ${shader.fragmentShader}
      `.replace(
        '#include <dithering_fragment>',
        `
        #include <dithering_fragment>
        if (uDisintegration > 0.001) {
          vec3 nCoord = vModelPosition * 14.0 + vec3(0.0, uDisintegrationTime * 1.5, 0.0);
          float noise = disFbm(nCoord);
          if (noise < uDisintegration) {
            discard;
          }
          float edge = 0.12;
          if (noise < uDisintegration + edge) {
            float tEdge = 1.0 - (noise - uDisintegration) / edge;
            vec3 emberColor = mix(vec3(1.0, 0.35, 0.02), vec3(1.0, 0.98, 0.85), tEdge);
            gl_FragColor.rgb += emberColor * tEdge * 10.0;
          }
        }
        `
      );
    };
  }

  setupProbe(): void {
    this.probe = new Group();
    this.probeMaterial = new MeshStandardMaterial({
      color: 0x87919e,
      metalness: 0.42,
      roughness: 0.34,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    this.injectDisintegrationShader(this.probeMaterial);

    this.probeCore = new Mesh(
      new IcosahedronGeometry(0.16, 3),
      this.probeMaterial,
    );

    this.probeTrimMaterial = new MeshStandardMaterial({
      color: 0x8b7357,
      metalness: 0.9,
      roughness: 0.26,
    });
    this.injectDisintegrationShader(this.probeTrimMaterial);

    this.probeRing = new Mesh(
      new TorusGeometry(0.29, 0.009, 8, 64),
      this.probeTrimMaterial,
    );
    this.probeRing.rotation.x = Math.PI * 0.5;
    this.probeRing.rotation.y = 0.38;

    this.probeGlow = new PointLight(0xff4218, 0, 1.8, 2);
    this.probe.add(this.probeCore, this.probeRing, this.probeGlow);
    this.probe.visible = false;
  }

  resetProbe(): void {
    this.probe.position.set(
      PROBE_SAFE_SPAWN_POSITION.x,
      PROBE_SAFE_SPAWN_POSITION.y,
      PROBE_SAFE_SPAWN_POSITION.z,
    );
    this.probe.rotation.set(0, 0, 0);
    this.probeRing.rotation.set(Math.PI * 0.5, 0.38, 0);
    this.probe.visible = false;

    this.probeState.dropping = false;
    this.probeState.stopped = false;
    this.probeState.disintegrating = false;
    this.probeState.destroyed = false;
    this.probeState.disintegrationProgress = 0;
    this.probeState.speed = 0;

    this.disintegrationUniforms.uDisintegration.value = 0.0;
    this.explosion.reset();

    this.probeTemperature = probeTemperatureAtPosition(this.probe.position);
    this.updateProbeAppearance(this.probeTemperature);
    this.currentStatus = 'Standby';
    this.notifyTelemetry();
  }

  releaseProbe(): void {
    if (
      this.probeState.dropping ||
      this.probeState.stopped ||
      this.probeState.disintegrating ||
      this.probeState.destroyed
    ) {
      return;
    }
    this.probeState.dropping = true;
    this.probeState.stopped = false;
    this.probeState.speed = 0.3;
    this.currentStatus = 'Descending';
    this.notifyTelemetry();
  }

  triggerDisintegration(): void {
    this.probeState.disintegrating = true;
    this.probeState.disintegrationProgress = 0;
    this.currentStatus = 'Disintegrating';

    // Trigger particle explosion at the probe's position
    this.explosion.trigger(this.probe.position);

    // Trigger acoustic explosion synthesis
    this.audioEngine.triggerExplosionSound();

    // Initial blinding flash of light
    this.probeGlow.intensity = 18.0;
    this.notifyTelemetry();
  }

  toggleAudio(): boolean {
    const isMuted = this.audioEngine.toggleMute();
    this.notifyTelemetry();
    return isMuted;
  }

  updateProbeAppearance(temperature: number): void {
    const appearance = probeThermalAppearance(temperature);
    this.probeMaterial.color.setRGB(...appearance.baseColor);
    this.probeMaterial.emissive.setRGB(...appearance.emissiveColor);
    this.probeMaterial.emissiveIntensity = appearance.emissiveIntensity;
    this.probeGlow.color.setRGB(...appearance.emissiveColor);
    this.probeGlow.intensity = appearance.emissiveIntensity * 0.55;
  }

  async setSDOMode(mode: SDOMode): Promise<void> {
    this.sdoMode = mode;
    this.currentTimelineFrame = null;
    const texture = await this.sdoFetcher.fetchTexture(mode);
    this.volumetricMaterial.uniforms.uSDOTexture.value = texture;

    const modeMap: Record<SDOMode, number> = {
      procedural: 0,
      aia171: 1,
      aia304: 2,
      aia193: 3,
      hmib: 4,
    };
    this.volumetricMaterial.uniforms.uSDOMode.value = modeMap[mode];
    this.volumetricMaterial.uniforms.uSDOBlend.value =
      mode === 'procedural' ? 0.0 : 1.0;
    this.notifyTelemetry();
  }

  async setSDOArchiveFrame(frame: SDOArchiveFrame): Promise<void> {
    this.currentTimelineFrame = frame;

    if (this.sdoMode === 'procedural' || !frame.url) {
      this.volumetricMaterial.uniforms.uSDOMode.value = 0;
      this.volumetricMaterial.uniforms.uSDOBlend.value = 0.0;
      this.notifyTelemetry();
      return;
    }

    const cacheKey = `${this.sdoMode}_${frame.id}`;
    const texture = await this.sdoFetcher.fetchTextureByUrl(frame.url, cacheKey);
    this.volumetricMaterial.uniforms.uSDOTexture.value = texture;

    const modeMap: Record<SDOMode, number> = {
      procedural: 0,
      aia171: 1,
      aia304: 2,
      aia193: 3,
      hmib: 4,
    };
    this.volumetricMaterial.uniforms.uSDOMode.value = modeMap[this.sdoMode];
    this.volumetricMaterial.uniforms.uSDOBlend.value = 1.0;
    this.notifyTelemetry();
  }

  setDynamicCorona(enabled: boolean): void {
    this.dynamicCoronaEnabled = enabled;
    this.volumetricMaterial.uniforms.uEnableDynamicCorona.value = enabled ? 1.0 : 0.0;
    this.notifyTelemetry();
  }

  toggleDynamicCorona(): boolean {
    this.setDynamicCorona(!this.dynamicCoronaEnabled);
    return this.dynamicCoronaEnabled;
  }

  notifyTelemetry(): void {
    if (!this.onTelemetryChange) return;
    const distanceKm =
      distanceFromPhotosphere(this.probe.position) * SUN_RADIUS_KM;
    const temperature = Math.round(this.probeTemperature);
    const heat = Math.min(
      1,
      this.probeTemperature / PROBE_MELT_TEMPERATURE_K,
    );

    this.onTelemetryChange({
      temperature,
      distanceKm: Math.round(distanceKm),
      heatPercentage: this.probeState.destroyed ? 100 : heat * 100,
      status: this.currentStatus,
      isDropping: this.probeState.dropping,
      isStopped: this.probeState.stopped || this.probeState.destroyed,
      sdoMode: this.sdoMode,
      isAudioMuted: this.audioEngine.getIsMuted(),
      timelineLabel: this.currentTimelineFrame
        ? this.currentTimelineFrame.relativeLabel
        : 'LIVE',
      dynamicCoronaEnabled: this.dynamicCoronaEnabled,
    });
  }

  updateProbe(_deltaTime: number): void {
    if (this.probe) {
      this.probe.visible = false;
    }
  }

  handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setSize(width, height);
    const drawingBufferSize = this.renderer.getDrawingBufferSize(
      new Vector2(),
    );
    this.compositor.setSize(
      drawingBufferSize.x,
      drawingBufferSize.y,
    );
  }

  animate(): void {
    const deltaTime = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += deltaTime;
    this.controls.update();
    this.updateProbe(deltaTime);
    this.explosion.update(deltaTime);

    // Dynamic solar humming and spatialized thermal crackling
    const probeDistRadii = this.probe.position.length();
    const heatPercent = Math.min(
      100,
      (this.probeTemperature / PROBE_MELT_TEMPERATURE_K) * 100,
    );
    this.audioEngine.update(
      this.probe.position,
      this.camera.position,
      heatPercent,
      probeDistRadii,
    );

    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    const uniforms = this.volumetricMaterial.uniforms;
    uniforms.uTime.value = this.elapsed;
    uniforms.uCameraWorld.value.copy(this.camera.matrixWorld);
    uniforms.uInverseProjection.value.copy(
      this.camera.projectionMatrixInverse,
    );
    uniforms.uCameraPosition.value.setFromMatrixPosition(
      this.camera.matrixWorld,
    );

    this.compositor.render();
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(this.animate);
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.compositor.dispose();
    this.explosion.dispose();
    this.sdoFetcher.dispose();
    this.audioEngine.dispose();
    this.volumetricMaterial.dispose();
    this.volumetricMesh.geometry.dispose();
    this.probeCore.geometry.dispose();
    this.probeRing.geometry.dispose();
    this.probeMaterial.dispose();
    this.probeTrimMaterial.dispose();
    this.blueNoise.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}
