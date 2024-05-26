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

  getPixels(
    x: number,
    y: number,
    w: number,
    h: number,
  ): {
    buffer: Uint32Array;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sx = clampInt(x, 0, cw - 1);
    const sy = clampInt(y, 0, ch - 1);
    const sw = clampInt(w, 1, cw - sx);
    const sh = clampInt(h, 1, ch - sy);
    const img = this.canvas
      ?.getContext("2d", { alpha: false })
      ?.getImageData(sx, sy, sw, sh);
    if (!img) {
      throw new ImageRenderingError();
    }
    const data = new Uint32Array(img.data.buffer);
    return {
      buffer: data,
      startX: sx - x,
      startY: sy - y,
      width: sw,
      height: sh,
    };
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

  for (let [img, props] of imgs) {
    context.save();

    // Rect in source image
    let sx = getNum(props.crop, 0, "x") || 0;
    let sy = getNum(props.crop, 1, "y") || 0;
    let sw = getNum(props.crop, 2, "w") || img.width;
    let sh = getNum(props.crop, 3, "h") || img.height;

    // Rect in target image
    let dx = getNum(props.position, 0, "x") || 0;
    let dy = getNum(props.position, 1, "y") || 0;
    let dw = (getNum(props.stretch, 0, "sx") || 1) * sw;
    let dh = (getNum(props.stretch, 1, "sy") || 1) * sh;

    // Rotation center and degrees
    let r = (getNum(props.rotate, 2, "a") || 0) * (Math.PI / 180);
    let rc = typeof props.rotate === "number" ? undefined : props.rotate;
    let cx = (getNum(rc, 0, "x") ?? 0.5) * dw + dx;
    let cy = (getNum(rc, 1, "y") ?? 0.5) * dh + dy;

    // Scaling center and factors
    let kw = getNum(props.scale, 2, "sx") ?? 1;
    let kh = getNum(props.scale, 3, "sy") ?? 1;
    let kc = typeof props.scale === "number" ? undefined : props.scale;
    let kx = (getNum(kc, 0, "x") ?? 0.5) * dw + dx;
    let ky = (getNum(kc, 1, "y") ?? 0.5) * dh + dy;

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

    // Disable subpixel rendering (AA) when not smoothing
    if (!context.imageSmoothingEnabled) {
      sx = ~~sx;
      sy = ~~sy;
      sw = ~~sw;
      sh = ~~sh;
      dx = ~~dx;
      dy = ~~dy;
      dw = ~~dw;
      dh = ~~dh;
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

function clampInt(n = 0, min = 0, max = 1): number {
  if (isNaN(n)) {
    return ~~min;
  } else if (n < min) {
    return ~~min;
  } else if (n > max) {
    return ~~max;
  } else {
    return ~~n;
  }
}
