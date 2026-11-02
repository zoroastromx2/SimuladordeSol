import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  PointLight,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';

const PARTICLE_COUNT = 450;

const explosionVertexShader = `
  attribute float aSize;
  attribute float aAge;
  attribute float aMaxLife;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vLifeProgress;

  void main() {
    vColor = aColor;
    vLifeProgress = clamp(aAge / aMaxLife, 0.0, 1.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Expand and then shrink as particle burns out
    float scale = (1.0 - vLifeProgress * vLifeProgress);
    gl_PointSize = max(1.0, aSize * scale * (180.0 / -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const explosionFragmentShader = `
  precision highp float;
  varying vec3 vColor;
  varying float vLifeProgress;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord) * 2.0;
    if (dist > 1.0) {
      discard;
    }

    // Soft gaussian-like circular glow
    float alpha = exp(-dist * dist * 3.5) * (1.0 - vLifeProgress);

    // Color gradient from white-hot core to orange-red ember
    vec3 hotColor = mix(vec3(1.0, 0.98, 0.88), vColor, clamp(vLifeProgress * 1.5, 0.0, 1.0));
    gl_FragColor = vec4(hotColor, alpha);
  }
`;

export class ProbeExplosion {
  public scene: Scene;
  public points: Points;
  public geometry: BufferGeometry;
  public material: ShaderMaterial;
  public flashLight: PointLight;

  private positions: Float32Array;
  private velocities: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private ages: Float32Array;
  private maxLifetimes: Float32Array;

  public active: boolean = false;
  public elapsed: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;

    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);
    this.colors = new Float32Array(PARTICLE_COUNT * 3);
    this.sizes = new Float32Array(PARTICLE_COUNT);
    this.ages = new Float32Array(PARTICLE_COUNT);
    this.maxLifetimes = new Float32Array(PARTICLE_COUNT);

    this.geometry = new BufferGeometry();
    const positionAttr = new BufferAttribute(this.positions, 3);
    positionAttr.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('position', positionAttr);

    const colorAttr = new BufferAttribute(this.colors, 3);
    colorAttr.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('aColor', colorAttr);

    const sizeAttr = new BufferAttribute(this.sizes, 1);
    sizeAttr.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('aSize', sizeAttr);

    const ageAttr = new BufferAttribute(this.ages, 1);
    ageAttr.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('aAge', ageAttr);

    const maxLifeAttr = new BufferAttribute(this.maxLifetimes, 1);
    this.geometry.setAttribute('aMaxLife', maxLifeAttr);

    this.material = new ShaderMaterial({
      vertexShader: explosionVertexShader,
      fragmentShader: explosionFragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.scene.add(this.points);

    this.flashLight = new PointLight(0xff7722, 0, 10, 2);
    this.scene.add(this.flashLight);
  }

  trigger(origin: Vector3): void {
    this.active = true;
    this.elapsed = 0;
    this.points.visible = true;

    this.flashLight.position.copy(origin);
    this.flashLight.intensity = 22.0;
    this.flashLight.color.setHex(0xffaa44);

    const tempColor = new Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Small jitter around probe origin
      this.positions[i3] = origin.x + (Math.random() - 0.5) * 0.15;
      this.positions[i3 + 1] = origin.y + (Math.random() - 0.5) * 0.15;
      this.positions[i3 + 2] = origin.z + (Math.random() - 0.5) * 0.15;

      // Spherical explosive ejection with random speed
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.0 + Math.random() * 3.8;

      this.velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.velocities[i3 + 2] = Math.cos(phi) * speed;

      // Particle color: embers ranging from incandescent gold to fiery orange-red
      const hue = 0.05 + Math.random() * 0.08;
      const lightness = 0.5 + Math.random() * 0.45;
      tempColor.setHSL(hue, 1.0, lightness);
      this.colors[i3] = tempColor.r;
      this.colors[i3 + 1] = tempColor.g;
      this.colors[i3 + 2] = tempColor.b;

      this.sizes[i] = 16.0 + Math.random() * 32.0;
      this.ages[i] = 0;
      this.maxLifetimes[i] = 1.2 + Math.random() * 1.4;
    }

    (this.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aColor as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aSize as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAge as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aMaxLife as BufferAttribute).needsUpdate = true;
  }

  update(deltaTime: number): boolean {
    if (!this.active) return false;

    this.elapsed += deltaTime;

    // Flash light rapid decay
    this.flashLight.intensity = Math.max(0, 22.0 * Math.exp(-this.elapsed * 4.5));

    let stillAlive = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      this.ages[i] += deltaTime;

      if (this.ages[i] < this.maxLifetimes[i]) {
        stillAlive = true;

        // Apply drag/air resistance
        const drag = Math.exp(-1.4 * deltaTime);
        this.velocities[i3] *= drag;
        this.velocities[i3 + 1] *= drag;
        this.velocities[i3 + 2] *= drag;

        // Radial solar thermal repulsion outward from origin (0,0,0)
        const posX = this.positions[i3];
        const posY = this.positions[i3 + 1];
        const posZ = this.positions[i3 + 2];
        const dist = Math.hypot(posX, posY, posZ);
        if (dist > 0.01) {
          const repel = (0.28 * deltaTime) / dist;
          this.velocities[i3] += posX * repel;
          this.velocities[i3 + 1] += posY * repel;
          this.velocities[i3 + 2] += posZ * repel;
        }

        this.positions[i3] += this.velocities[i3] * deltaTime;
        this.positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime;
        this.positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime;
      }
    }

    (this.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.aAge as BufferAttribute).needsUpdate = true;

    if (!stillAlive) {
      this.active = false;
      this.points.visible = false;
      this.flashLight.intensity = 0;
    }

    return stillAlive;
  }

  reset(): void {
    this.active = false;
    this.points.visible = false;
    this.flashLight.intensity = 0;
    this.elapsed = 0;
  }

  dispose(): void {
    this.reset();
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.points);
    this.scene.remove(this.flashLight);
  }
}
