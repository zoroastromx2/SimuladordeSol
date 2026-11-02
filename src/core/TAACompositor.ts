import {
  Color,
  HalfFloatType,
  FloatType,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { halton2, halton3 } from '../math/Halton';
import taaFragmentShader from '../shaders/taa.frag';
import taaVertexShader from '../shaders/taa.vert';

const FULLSCREEN_GEOMETRY = new PlaneGeometry(2, 2);

export interface TAACompositorOptions {
  historyWeight?: number;
  onJitter?: (data: { frame: number; jitter: Vector2 }) => void;
}

export class TAACompositor {
  public renderer: WebGLRenderer;
  public scene: Scene;
  public camera: PerspectiveCamera;
  public historyWeight: number;
  public onJitter: (data: { frame: number; jitter: Vector2 }) => void;
  public sceneTarget: WebGLRenderTarget;
  public historyTargets: [WebGLRenderTarget, WebGLRenderTarget];
  public size: Vector2;
  public frame: number;
  public readIndex: number;
  public writeIndex: number;
  public hasHistory: boolean;
  public jitterNdc: Vector2;
  public baseProjection: Matrix4;
  public clearColor: Color;
  public taaMaterial: ShaderMaterial;
  public taaScene: Scene;
  public taaCamera: OrthographicCamera;
  public taaQuad: Mesh;
  public copyMaterial: MeshBasicMaterial;
  public copyScene: Scene;
  public copyQuad: Mesh;

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    options: TAACompositorOptions = {},
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.historyWeight = options.historyWeight ?? 0.88;
    this.onJitter = options.onJitter ?? (() => {});

    const supportsFloat = renderer.extensions.has('EXT_color_buffer_float');
    const supportsHalfFloat =
      renderer.extensions.has('EXT_color_buffer_half_float') || supportsFloat;
    const sceneBufferType = supportsFloat
      ? FloatType
      : supportsHalfFloat
        ? HalfFloatType
        : UnsignedByteType;
    const historyBufferType = supportsHalfFloat
      ? HalfFloatType
      : UnsignedByteType;

    const targetOptions = {
      format: RGBAFormat,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      colorSpace: NoColorSpace,
    };

    this.sceneTarget = new WebGLRenderTarget(1, 1, {
      ...targetOptions,
      type: sceneBufferType,
      depthBuffer: true,
    });
    this.historyTargets = [
      new WebGLRenderTarget(1, 1, {
        ...targetOptions,
        type: historyBufferType,
        depthBuffer: false,
      }),
      new WebGLRenderTarget(1, 1, {
        ...targetOptions,
        type: historyBufferType,
        depthBuffer: false,
      }),
    ];

    this.size = new Vector2(1, 1);
    this.frame = 0;
    this.readIndex = 0;
    this.writeIndex = 1;
    this.hasHistory = false;
    this.jitterNdc = new Vector2();
    this.baseProjection = new Matrix4();
    this.clearColor = new Color();

    this.taaMaterial = new ShaderMaterial({
      uniforms: {
        tCurrent: { value: this.sceneTarget.texture },
        tHistory: { value: this.historyTargets[this.readIndex].texture },
        uResolution: { value: this.size },
        uHistoryWeight: { value: this.historyWeight },
        uHasHistory: { value: 0 },
      },
      vertexShader: taaVertexShader,
      fragmentShader: taaFragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    this.taaScene = new Scene();
    this.taaCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.taaQuad = new Mesh(FULLSCREEN_GEOMETRY, this.taaMaterial);
    this.taaQuad.frustumCulled = false;
    this.taaScene.add(this.taaQuad);

    this.copyMaterial = new MeshBasicMaterial({
      map: null,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.copyScene = new Scene();
    this.copyQuad = new Mesh(FULLSCREEN_GEOMETRY, this.copyMaterial);
    this.copyQuad.frustumCulled = false;
    this.copyScene.add(this.copyQuad);
  }

  setSize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.size.set(safeWidth, safeHeight);
    this.sceneTarget.setSize(safeWidth, safeHeight);
    for (const target of this.historyTargets) {
      target.setSize(safeWidth, safeHeight);
    }
    this.resetHistory();
  }

  resetHistory(): void {
    const previousTarget = this.renderer.getRenderTarget();
    const previousColor = this.renderer.getClearColor(this.clearColor);
    const previousAlpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 1);

    for (const target of this.historyTargets) {
      this.renderer.setRenderTarget(target);
      this.renderer.clear(true, false, false);
    }

    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(previousColor, previousAlpha);
    this.frame = 0;
    this.hasHistory = false;
    this.readIndex = 0;
    this.writeIndex = 1;
  }

  render(): void {
    const width = this.size.x;
    const height = this.size.y;
    const pixelJitterX = halton2(this.frame + 1) - 0.5;
    const pixelJitterY = halton3(this.frame + 1) - 0.5;
    const jitterX = (pixelJitterX * 2) / width;
    const jitterY = (pixelJitterY * 2) / height;
    this.jitterNdc.set(jitterX, jitterY);

    this.camera.updateProjectionMatrix();
    this.baseProjection.copy(this.camera.projectionMatrix);
    this.camera.projectionMatrix.elements[8] += jitterX;
    this.camera.projectionMatrix.elements[9] += jitterY;
    this.onJitter({
      frame: this.frame,
      jitter: this.jitterNdc,
    });

    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    this.camera.projectionMatrix.copy(this.baseProjection);

    this.taaMaterial.uniforms.tHistory.value =
      this.historyTargets[this.readIndex].texture;
    this.taaMaterial.uniforms.uHasHistory.value = this.hasHistory ? 1 : 0;
    this.renderer.setRenderTarget(this.historyTargets[this.writeIndex]);
    this.renderer.render(this.taaScene, this.taaCamera);

    this.renderer.setRenderTarget(null);
    this.copyMaterial.map = this.historyTargets[this.writeIndex].texture;
    this.renderer.render(this.copyScene, this.taaCamera);

    [this.readIndex, this.writeIndex] = [this.writeIndex, this.readIndex];
    this.hasHistory = true;
    this.frame += 1;
  }

  dispose(): void {
    this.sceneTarget.dispose();
    for (const target of this.historyTargets) {
      target.dispose();
    }
    this.taaMaterial.dispose();
    this.copyMaterial.dispose();
  }
}
