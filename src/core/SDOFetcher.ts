import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  RepeatWrapping,
  Texture,
  TextureLoader,
} from 'three';
import type { SDOArchiveFrame, SDOMode } from '../types';

export interface SDOModeInfo {
  id: SDOMode;
  label: string;
  sublabel: string;
  description: string;
  wavelength: string;
}

export const SDO_MODES: SDOModeInfo[] = [
  {
    id: 'procedural',
    label: 'Procedural',
    sublabel: 'Mathematical FBM',
    description: 'Pure procedural mathematical solar simulation',
    wavelength: 'Simulated',
  },
  {
    id: 'aia171',
    label: 'AIA 171 Å',
    sublabel: 'Fe IX • 1.0 MK',
    description: 'Coronal magnetic loops and quiescent corona in extreme UV',
    wavelength: '17.1 nm',
  },
  {
    id: 'aia304',
    label: 'AIA 304 Å',
    sublabel: 'He II • 0.05 MK',
    description: 'Chromosphere, transition region filaments and prominences',
    wavelength: '30.4 nm',
  },
  {
    id: 'aia193',
    label: 'AIA 193 Å',
    sublabel: 'Fe XII • 1.2 MK',
    description: 'Corona and flare active regions with coronal holes',
    wavelength: '19.3 nm',
  },
  {
    id: 'hmib',
    label: 'HMI Magnetogram',
    sublabel: 'Photospheric B-Field',
    description: 'Bipolar active region magnetic field intensity map',
    wavelength: '617.3 nm',
  },
];

const SDO_FILE_MAP: Record<Exclude<SDOMode, 'procedural'>, string> = {
  aia171: 'latest_256_0171.jpg',
  aia304: 'latest_256_0304.jpg',
  aia193: 'latest_256_0193.jpg',
  hmib: 'latest_256_HMIB.jpg',
};

const SDO_ARCHIVE_SUFFIX: Record<Exclude<SDOMode, 'procedural'>, string> = {
  aia171: '_512_0171.jpg',
  aia304: '_512_0304.jpg',
  aia193: '_512_0193.jpg',
  hmib: '_512_HMIB.jpg',
};

function createAnalyticalFallbackTexture(mode: SDOMode): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const data = new Uint8Array([128, 128, 128, 255]);
    return new DataTexture(data, 1, 1, RGBAFormat);
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  if (mode === 'hmib') {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#808080';
    ctx.fill();

    const drawBipole = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x - 8, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 8, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    };

    drawBipole(cx + 40, cy - 25);
    drawBipole(cx - 50, cy + 30);
    drawBipole(cx + 60, cy + 45);
  } else {
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    if (mode === 'aia171') {
      grad.addColorStop(0, '#ffd060');
      grad.addColorStop(0.8, '#ff9010');
      grad.addColorStop(1, '#803000');
    } else if (mode === 'aia304') {
      grad.addColorStop(0, '#ff4422');
      grad.addColorStop(0.8, '#c01808');
      grad.addColorStop(1, '#500000');
    } else {
      grad.addColorStop(0, '#d89040');
      grad.addColorStop(0.8, '#884410');
      grad.addColorStop(1, '#301500');
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class SDOFetcher {
  private cache: Map<string, Texture> = new Map();
  private timelineCache: Map<SDOMode, SDOArchiveFrame[]> = new Map();
  private loader: TextureLoader;
  private defaultTexture: Texture;

  constructor() {
    this.loader = new TextureLoader();
    this.loader.setCrossOrigin('anonymous');

    const neutralData = new Uint8Array([128, 128, 128, 255]);
    this.defaultTexture = new DataTexture(neutralData, 1, 1, RGBAFormat);
    this.defaultTexture.needsUpdate = true;
    this.cache.set('procedural', this.defaultTexture);
  }

  public getModes(): SDOModeInfo[] {
    return SDO_MODES;
  }

  public getDefaultTexture(): Texture {
    return this.defaultTexture;
  }

  public async fetchTexture(mode: SDOMode): Promise<Texture> {
    if (mode === 'procedural') {
      return this.defaultTexture;
    }

    const cached = this.cache.get(mode);
    if (cached) {
      return cached;
    }

    const fileName = SDO_FILE_MAP[mode];
    const urls = [
      `/api/sdo/${fileName}`,
      `https://sol24.net/data/${fileName}`,
    ];

    for (const url of urls) {
      try {
        const texture = await this.loadSingleTexture(url);
        texture.wrapS = RepeatWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.minFilter = LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        this.cache.set(mode, texture);
        return texture;
      } catch {
        // Continue
      }
    }

    const fallback = createAnalyticalFallbackTexture(mode);
    this.cache.set(mode, fallback);
    return fallback;
  }

  public async fetchTextureByUrl(url: string, cacheKey: string): Promise<Texture> {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const texture = await this.loadSingleTexture(url);
      texture.wrapS = RepeatWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.minFilter = LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      this.cache.set(cacheKey, texture);
      return texture;
    } catch {
      return this.defaultTexture;
    }
  }

  /**
   * Fetches historical archive timeline frames from the SDO data feed
   */
  public async fetchTimelineFrames(mode: SDOMode): Promise<SDOArchiveFrame[]> {
    if (this.timelineCache.has(mode)) {
      return this.timelineCache.get(mode)!;
    }

    const now = new Date();
    const liveFrame: SDOArchiveFrame = {
      id: 'live',
      timestamp: `${now.toISOString().replace('T', ' ').substring(0, 16)} UTC`,
      relativeLabel: 'LIVE',
      url:
        mode === 'procedural'
          ? ''
          : `/api/sdo/${SDO_FILE_MAP[mode as Exclude<SDOMode, 'procedural'>]}`,
      isLive: true,
    };

    if (mode === 'procedural') {
      // Procedural synthetic timeline steps spanning 24h
      const proceduralFrames: SDOArchiveFrame[] = [];
      for (let i = 24; i >= 0; i -= 2) {
        const d = new Date(now.getTime() - i * 3600 * 1000);
        proceduralFrames.push({
          id: `proc_${i}`,
          timestamp: `${d.toISOString().replace('T', ' ').substring(0, 16)} UTC`,
          relativeLabel: i === 0 ? 'LIVE' : `-${i}h 00m`,
          url: '',
          isLive: i === 0,
        });
      }
      this.timelineCache.set(mode, proceduralFrames);
      return proceduralFrames;
    }

    try {
      const suffix = SDO_ARCHIVE_SUFFIX[mode as Exclude<SDOMode, 'procedural'>];
      const todayStr = now.toISOString().substring(0, 10).replace(/-/g, '/');
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      const yesterdayStr = yesterday.toISOString().substring(0, 10).replace(/-/g, '/');

      // Fetch today and yesterday browse directories
      const [todayRes, yestRes] = await Promise.allSettled([
        fetch(`/api/nasa-sdo/assets/img/browse/${todayStr}/`).then((r) => r.text()),
        fetch(`/api/nasa-sdo/assets/img/browse/${yesterdayStr}/`).then((r) => r.text()),
      ]);

      const foundFiles: Array<{ id: string; datePath: string; fullFilename: string }> = [];

      const parseHtml = (html: string, datePath: string) => {
        const re = new RegExp(`href="([0-9]{8}_[0-9]{6}${suffix})"`, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(html)) !== null) {
          const fullFilename = match[1];
          const id = fullFilename.replace(suffix, '');
          foundFiles.push({ id, datePath, fullFilename });
        }
      };

      if (yestRes.status === 'fulfilled') {
        parseHtml(yestRes.value, yesterdayStr);
      }
      if (todayRes.status === 'fulfilled') {
        parseHtml(todayRes.value, todayStr);
      }

      if (foundFiles.length > 0) {
        // Sort chronologically
        foundFiles.sort((a, b) => a.id.localeCompare(b.id));

        // Sample up to 18 evenly spaced historical frames
        const total = foundFiles.length;
        const targetCount = Math.min(18, total);
        const step = (total - 1) / (targetCount - 1);
        const frames: SDOArchiveFrame[] = [];

        for (let i = 0; i < targetCount; i++) {
          const index = Math.round(i * step);
          const item = foundFiles[index];
          const isLatest = i === targetCount - 1;

          // Parse timestamp YYYYMMDD_HHMMSS
          const y = item.id.substring(0, 4);
          const m = item.id.substring(4, 6);
          const d = item.id.substring(6, 8);
          const hh = item.id.substring(9, 11);
          const mm = item.id.substring(11, 13);
          const itemDate = new Date(`${y}-${m}-${d}T${hh}:${mm}:00Z`);

          const diffMinutes = Math.max(
            0,
            Math.round((now.getTime() - itemDate.getTime()) / (60 * 1000)),
          );
          const diffHours = Math.floor(diffMinutes / 60);
          const remMin = diffMinutes % 60;
          const relativeLabel =
            diffMinutes < 15
              ? 'LIVE'
              : `-${diffHours}h ${remMin < 10 ? '0' : ''}${remMin}m`;

          frames.push({
            id: item.id,
            timestamp: `${y}-${m}-${d} ${hh}:${mm} UTC`,
            relativeLabel,
            url: `/api/nasa-sdo/assets/img/browse/${item.datePath}/${item.fullFilename}`,
            isLive: isLatest,
          });
        }

        // Ensure the last item points to the live feed
        if (frames.length > 0) {
          frames[frames.length - 1] = liveFrame;
        }

        this.timelineCache.set(mode, frames);
        return frames;
      }
    } catch {
      // Fallback below
    }

    // Fallback: Generate 12 past timestamped frames
    const fallbackFrames: SDOArchiveFrame[] = [];
    for (let i = 24; i >= 0; i -= 2) {
      const d = new Date(now.getTime() - i * 3600 * 1000);
      const isLatest = i === 0;
      fallbackFrames.push(
        isLatest
          ? liveFrame
          : {
              id: `hist_${i}h`,
              timestamp: `${d.toISOString().replace('T', ' ').substring(0, 16)} UTC`,
              relativeLabel: `-${i}h 00m`,
              url: `/api/sdo/${SDO_FILE_MAP[mode as Exclude<SDOMode, 'procedural'>]}`,
              isLive: false,
            },
      );
    }

    this.timelineCache.set(mode, fallbackFrames);
    return fallbackFrames;
  }

  private loadSingleTexture(url: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error),
      );
    });
  }

  public dispose(): void {
    for (const texture of this.cache.values()) {
      texture.dispose();
    }
    this.cache.clear();
    this.timelineCache.clear();
  }
}
