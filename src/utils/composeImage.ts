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

  get colorHistogram(): Promise<{ [color: string]: number }> {
    return new Promise((resolve, reject) => {
      let data: ImageData | undefined = undefined;
      try {
        const context = this.canvas.getContext("2d")!;
        data = context.getImageData(
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        );
      } catch {
        data = undefined;
      }

      if (!data) {
        reject(new ImageRenderingError());
        return;
      }

      const hist: { [color: string]: number } = {};
      const len = data.data.length;
      for (let i = 0; i < len; i += 4) {
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        const a = data.data[i + 3];
        const color = [r, g, b]
          .map((c) => (c & 0xff).toString(16).padStart(2, "0"))
          .join("");

        if (a > 0) {
          hist[color] = (hist[color] || 0) + 1;
        }
      }

      resolve(hist);
    });
  }

  get dominantColor(): Promise<{ r: number; g: number; b: number }> {
    return new Promise((resolve, reject) => {
      let data: ImageData | undefined = undefined;
      try {
        const context = this.canvas.getContext("2d")!;
        data = context.getImageData(
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        );
      } catch {
        data = undefined;
      }

      if (!data) {
        reject(new ImageRenderingError());
        return;
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
      resolve(rgb);
    });
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
    const kw = getNum(props.scale, 2, "sx") || 1;
    const kh = getNum(props.scale, 3, "sy") || 1;
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

const defaultOptions: ImageOptions = {
  format: "image/png",
  quality: 0.92,
};

const transparentGif =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const plainSvgTemplate =
  "data:image/svg+xml;utf8," +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"' +
  '     width="{width}" height="{height}">' +
  '  <rect x="0" y="0" width="1" height="1" fill="{color}" />' +
  "</svg>";

function getNum(v: any, ...idxs: (number | string)[]): number | undefined {
  if (!v || typeof v === "number") {
    return v ?? undefined;
  } else if (Array.isArray(v)) {
    for (let idx of idxs) {
      if (typeof idx !== "number") {
        idx = parseInt(idx);
      }
      if (typeof idx === "number" && isFinite(idx)) {
        const ret = v[idx];
        if (ret !== null && ret !== undefined && typeof ret === "number") {
          return ret;
        }
      }
    }
  } else if (typeof v === "object") {
    for (let idx of idxs) {
      const ret = v[idx];
      if (ret !== null && ret !== undefined && typeof ret === "number") {
        return ret;
      }
    }
  }

  return undefined;
}
