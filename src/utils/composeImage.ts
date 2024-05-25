export interface ImageProps {
  src: string;

  position?: [number, number] | Position;
  stretch?: number | [number, number] | Scale;
  crop?: [number, number, number, number] | (Position & Size);
  rotate?: number | [number, number, number] | (Position & Angle);
  scale?: number | [number, number, number, number] | (Position & Scale);

  opacity?: number;
  smoothing?: boolean | "disabled" | ImageSmoothingQuality;
  /// See examples https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
  composition?: GlobalCompositeOperation;
  /// See examples https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
  filter?: string | string[];
}

export interface ImageOptions {
  sources?: (ImageProps | string)[];
  format?: string;
  quality?: number;

  width?: number;
  height?: number;
  style?: Record<string, string>;
  className?: string | string[];
}

export class ImageLoadingError extends Error {}
export class ImageRenderingError extends Error {}

export class ComposedImage {
  readonly canvas: HTMLCanvasElement;
  readonly options: ImageOptions;
  constructor(canvas: HTMLCanvasElement, options: ImageOptions) {
    this.canvas = canvas;
    this.options = options;
  }

  get dataURL(): string {
    return this.canvas.toDataURL(this.options.format, this.options.quality);
  }

  get blob(): Promise<Blob> {
    return new Promise((resolve, reject) =>
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new ImageRenderingError())),
        this.options.format,
        this.options.quality,
      ),
    );
  }

  getColorHistogram(
    area?: [number, number, number, number] | (Position & Size),
    mask = 0xff,
  ): { [color: string]: number } {
    let data: ImageData | undefined = undefined;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const sx = getNum(area, 0, "x", { min: 0, max: w - 1, def: 0 })!;
    const sy = getNum(area, 1, "y", { min: 0, max: h - 1, def: 0 })!;
    const sw = getNum(area, 2, "w", { min: 1, max: w - sx, def: w })!;
    const sh = getNum(area, 3, "h", { min: 1, max: h - sy, def: h })!;

    try {
      const context = this.canvas.getContext("2d", { alpha: false })!;
      data = context.getImageData(sx, sy, sw, sh);
    } catch {
      data = undefined;
    }

    if (!data) {
      throw new ImageRenderingError();
    }

    const hist: { [color: string]: number } = {};
    const len = data.data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data.data[i] & mask;
      const g = data.data[i + 1] & mask;
      const b = data.data[i + 2] & mask;
      const a = data.data[i + 3] & mask;
      const color = hex[r] + hex[g] + hex[b];

      if (a > 0) {
        hist[color] = (hist[color] || 0) + 1;
      }
    }

    return hist;
  }

  getColorBuckets(
    rgbBuckets: (string | number)[],
    tolerance = 0,
    area?: [number, number, number, number] | (Position & Size),
  ): { [color: string]: number } {
    let data: ImageData | undefined = undefined;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const sx = getNum(area, 0, "x", { min: 0, max: w - 1, def: 0 })!;
    const sy = getNum(area, 1, "y", { min: 0, max: h - 1, def: 0 })!;
    const sw = getNum(area, 2, "w", { min: 1, max: w - sx, def: w })!;
    const sh = getNum(area, 3, "h", { min: 1, max: h - sy, def: h })!;

    try {
      const context = this.canvas.getContext("2d", { alpha: false })!;
      data = context.getImageData(sx, sy, sw, sh);
    } catch {
      data = undefined;
    }

    if (!data) {
      throw new ImageRenderingError();
    }

    const colors = rgbBuckets.map((color) => {
      const code = typeof color === "string" ? parseInt(color, 16) : ~~color;
      const r = (code >> 16) & 0xff;
      const g = (code >> 8) & 0xff;
      const b = code & 0xff;
      return { r, g, b, bucket: color };
    });
    const hist: { [color: string]: number } = Object.fromEntries(
      rgbBuckets.map((color) => [color, 0]),
    );

    const len = data.data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      const a = data.data[i + 3];

      if (a > 0) {
        for (const color of colors) {
          if (
            Math.abs(r - color.r) +
              Math.abs(g - color.g) +
              Math.abs(b - color.b) <=
            tolerance
          ) {
            hist[color.bucket]++;
            break;
          }
        }
      }
    }

    return hist;
  }

  getDominantColor(): { r: number; g: number; b: number } {
    let data: ImageData | undefined = undefined;
    try {
      const context = this.canvas.getContext("2d")!;
      data = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } catch {
      data = undefined;
    }

    if (!data) {
      throw new ImageRenderingError();
    }

    let denom = 0;
    const rgb = { r: 0, g: 0, b: 0 };
    const len = data.data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      const a = data.data[i + 3];

      denom += a;
      rgb.r += r * a;
      rgb.g += g * a;
      rgb.b += b * a;
    }

    rgb.r = ~~(rgb.r / denom);
    rgb.g = ~~(rgb.g / denom);
    rgb.b = ~~(rgb.b / denom);
    return rgb;
  }
}

export default async function composeImage(
  sources?: (ImageProps | string)[],
  options?: ImageOptions,
): Promise<ComposedImage> {
  const opts = Object.assign({}, defaultOptions, options);
  const srcs = [...(sources || []), ...(opts?.sources || [])];
  const imgs = await Promise.all(srcs.map((src) => loadImage(src, opts)));

  // Figure out the dimensions of the canvas
  const canvas = window.document.createElement("canvas");
  canvas.width = opts.width || Math.max(...imgs.map(([img]) => img.width));
  canvas.height = opts.height || Math.max(...imgs.map(([img]) => img.height));
  canvas.className = [
    ...(Array.isArray(opts.className) ? opts.className : [opts.className]),
    "composed-image",
  ].join(" ");
  if (opts.style) {
    Object.assign(canvas.style, opts.style);
  }

  const context = canvas.getContext("2d")!;

  for (const [img, props] of imgs) {
    context.save();

    // Rect in source image
    const sx = getNum(props.crop, 0, "x") || 0;
    const sy = getNum(props.crop, 1, "y") || 0;
    const sw = getNum(props.crop, 2, "w") || img.width;
    const sh = getNum(props.crop, 3, "h") || img.height;

    // Rect in target image
    const dx = getNum(props.position, 0, "x") || 0;
    const dy = getNum(props.position, 1, "y") || 0;
    const dw = (getNum(props.stretch, 0, "sx") || 1) * sw;
    const dh = (getNum(props.stretch, 1, "sy") || 1) * sh;

    // Rotation center and degrees
    const r = (getNum(props.rotate, 2, "a") || 0) * (Math.PI / 180);
    const rc = typeof props.rotate === "number" ? undefined : props.rotate;
    const cx = (getNum(rc, 0, "x") ?? 0.5) * dw + dx;
    const cy = (getNum(rc, 1, "y") ?? 0.5) * dh + dy;

    // Scaling center and factors
    const kw = getNum(props.scale, 2, "sx") ?? 1;
    const kh = getNum(props.scale, 3, "sy") ?? 1;
    const kc = typeof props.scale === "number" ? undefined : props.scale;
    const kx = (getNum(kc, 0, "x") ?? 0.5) * dw + dx;
    const ky = (getNum(kc, 1, "y") ?? 0.5) * dh + dy;

    // Composition style and alpha
    context.globalAlpha = props.opacity ?? 1;
    context.globalCompositeOperation = props.composition ?? "source-over";

    // How to smooth images if being resized
    context.imageSmoothingEnabled =
      props.smoothing !== false && props.smoothing !== "disabled";
    context.imageSmoothingQuality =
      props.smoothing === "medium" || props.smoothing === "high"
        ? props.smoothing
        : "low";

    // CSS filters
    if (Array.isArray(props.filter)) {
      context.filter = props.filter.join(" ");
    } else if (props.filter) {
      context.filter = props.filter;
    }
    context.filter ||= "none";

    // Transformations matrix
    context.resetTransform();
    if (r !== 0) {
      context.translate(cx, cy);
      context.rotate(r);
      context.translate(-cx, -cy);
    }
    if (kw !== 1 || kh !== 1) {
      context.translate(kx, ky);
      context.scale(kw, kh);
      context.translate(-kx, -ky);
    }

    // The stretching factors
    context.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

    context.restore();
  }

  return new ComposedImage(canvas, opts);
}

export function loadImage(
  src: ImageProps | string,
  opts?: Partial<ImageOptions>,
) {
  return new Promise<ResolvedImage>((resolve, reject) => {
    const props = typeof src === "string" ? { src } : src;
    props.src = (props.src || "").trim();
    if (!props.src || props.src === "transparent") {
      props.src = transparentGif;
    } else if (props.src.startsWith("plain:")) {
      props.src = plainSvgTemplate
        .replace("{color}", encodeURIComponent(props.src.slice(6).trim()))
        .replace("{width}", opts?.width?.toString() || "100%")
        .replace("{height}", opts?.height?.toString() || "100%");
    } else if (props.src.startsWith("<svg")) {
      if (!props.src.includes("xmlns=")) {
        props.src = props.src.replace(
          "<svg",
          '<svg xmlns="http://www.w3.org/2000/svg"',
        );
      }
      props.src =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          props.src
            .replace("{width}", opts?.width?.toString() || "100%")
            .replace("{height}", opts?.height?.toString() || "100%"),
        );
    }

    const img = new Image();
    img.onerror = () => reject(new ImageLoadingError());
    img.onload = () => resolve([img, props]);
    img.crossOrigin = "anonymous";
    img.src = props.src;
  });
}

type ResolvedImage = [HTMLImageElement, ImageProps];

interface Position {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

interface Scale {
  sx: number;
  sy: number;
}

interface Angle {
  a: number;
}

interface Bounds {
  min?: number;
  max?: number;
  def?: number;
}

const defaultOptions: ImageOptions = {
  format: "image/png",
  quality: 0.92,
};

const hex = Array.from(Array(0xff).keys()).map((n) =>
  n.toString(16).padStart(2, "0"),
);

const transparentGif =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const plainSvgTemplate =
  "data:image/svg+xml;utf8," +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"' +
  '     width="{width}" height="{height}">' +
  '  <rect x="0" y="0" width="1" height="1" fill="{color}" />' +
  "</svg>";

function getNum(
  v: any,
  ...idxs: (number | string | Bounds)[]
): number | undefined {
  let ret: number | undefined = undefined;
  if (!v || typeof v === "number") {
    ret = v ?? undefined;
  } else if (Array.isArray(v)) {
    for (let idx of idxs) {
      if (typeof idx === "string") {
        idx = parseInt(idx);
      }
      if (typeof idx === "number" && isFinite(idx)) {
        const r = v[idx];
        if (r !== null && r !== undefined && typeof r === "number") {
          ret = r;
          break;
        }
      }
    }
  } else if (typeof v === "object") {
    for (let idx of idxs) {
      if (typeof idx === "string" || typeof idx === "number") {
        const r = v[idx];
        if (r !== null && r !== undefined && typeof r === "number") {
          ret = r;
          break;
        }
      }
    }
  }

  for (let opt of idxs) {
    if (opt && typeof opt === "object") {
      if (opt.def != undefined && ret == undefined) {
        ret = opt.def;
      }
      if (opt.min != undefined && ret != undefined) {
        ret = Math.max(ret, opt.min);
      }
      if (opt.max != undefined && ret != undefined) {
        ret = Math.min(ret, opt.max);
      }
    }
  }

  return ret;
}
