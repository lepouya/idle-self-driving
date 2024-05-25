import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";
import { clamp, Settings } from "./Settings";

class Sensor {
  private _imageData: ComposedImage | null = null;

  public readonly radius: number;
  public readonly dx: number;
  public readonly dy: number;

  constructor(public readonly config: Sensor.Configuration) {
    this.radius = ~~Math.round(config.range + config.width);
    this.dx = config.range * Math.cos(config.angle);
    this.dy = config.range * Math.sin(config.angle);
  }

  get maskColor() {
    return Sensor.radar[this.config.index];
  }

  get mask(): string {
    return [
      `<svg
        width="${this.radius * 2}px"
        height="${this.radius * 2}px"
        viewBox="0 0 ${this.radius * 2} ${this.radius * 2}"
      >`,
      `<path
        d="M ${this.radius} ${this.radius} l ${this.dx} ${this.dy}"
        stroke="${Sensor.color.radar[this.config.index]}"
        stroke-width="${Math.ceil(
          this.config.width / Settings.singleton.sensorAccuracy,
        )}px"
        stroke-linecap="butt"
        fill="none"
        shape-rendering="crispEdges"
      />`,
      `</svg>`,
    ].join("");
  }

  get image(): string {
    return [
      `<svg
        width="${this.radius * 2}px"
        height="${this.radius * 2}px"
        viewBox="0 0 ${this.radius * 2} ${this.radius * 2}"
      >`,
      `<path
        d="M ${this.radius} ${this.radius} l ${this.dx} ${this.dy}"
        stroke="green"
        stroke-width="${this.config.width}px"
        stroke-linecap="round"
        fill="none"
      />`,
      `</svg>`,
    ].join("");
  }

  get canvas(): HTMLCanvasElement | undefined {
    return this._imageData?.canvas;
  }

  async fetchImageData() {
    this._imageData = await composeImage([this.image], {
      width: this.radius * 2,
      height: this.radius * 2,
    });
    return this._imageData;
  }

  render(context: CanvasRenderingContext2D) {
    if (!this.canvas) {
      return;
    }

    context.drawImage(this.canvas, -this.radius, -this.radius);
  }

  scan(
    composedMask: ComposedImage,
    position: { x: number; y: number },
  ): [number, number] {
    const scale = Settings.singleton.sensorAccuracy;
    const hist = composedMask.getColorBuckets(
      [
        this.maskColor + Sensor.available,
        this.maskColor + Sensor.lapLine,
        this.maskColor + Sensor.offTrack,
      ],
      0x01,
      {
        x: (position.x - this.radius) * scale,
        y: (position.y - this.radius) * scale,
        w: this.radius * 2 * scale,
        h: this.radius * 2 * scale,
      },
    );

    const on =
      hist[this.maskColor + Sensor.available] +
      hist[this.maskColor + Sensor.lapLine];
    const off = hist[this.maskColor + Sensor.offTrack];
    return [on, on + off];
  }

  static readAll(
    sensors: Sensor[],
    mask: ComposedImage,
    cx: number,
    cy: number,
    ca: number,
  ): number[] {
    const readings = sensors.map(() => 0);

    // Get the relevant portion of the mask as a buffer
    const radius = Math.max(...sensors.map((sensor) => sensor.radius));
    const w = mask.canvas.width;
    const h = mask.canvas.height;
    const sx = clamp(cx - radius, 0, w - 1);
    const sy = clamp(cy - radius, 0, h - 1);
    const sw = clamp(radius * 2, 1, w - sx);
    const sh = clamp(radius * 2, 1, h - sy);
    const data = mask.canvas
      ?.getContext("2d", { alpha: false })
      ?.getImageData(sx, sy, sw, sh)?.data;
    if (!data) {
      return readings;
    }

    for (let i = 0; i < sensors.length; i++) {
      const sensor = sensors[i];
      const dx = Math.cos(sensor.config.angle + ca);
      const dy = Math.sin(sensor.config.angle + ca);

      let dist = 0;
      for (let r = 0; r < sensor.radius; r++) {
        const row = clamp(Math.round(radius + r * dy), 0, sh - 1);
        const col = clamp(Math.round(radius + r * dx), 0, sw - 1);
        const offset = 4 * (row * sw + col);
        const v =
          ((data[offset] & 0xff) << 16) |
          ((data[offset + 1] & 0xff) << 8) |
          (data[offset + 2] & 0xff);
        if (v & Sensor.offTrack) {
          break;
        } else {
          dist = r;
        }
      }

      readings[i] = clamp(dist / sensor.config.range, 0, 1);
    }

    return readings;
  }
}

module Sensor {
  export const available = 0x000000;
  export const offTrack = 0x800000;
  export const lapLine = 0x002000;
  export const vehicle = 0x7fdfff;
  export const radar = [
    0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80, 0x90, 0xa0, 0xb0, 0xc0,
    0xd0, 0xe0,
  ];

  export const color = {
    available: toSvgColor(available),
    offTrack: toSvgColor(offTrack),
    lapLine: toSvgColor(lapLine),
    vehicle: toSvgColor(vehicle),
    radar: radar.map(toSvgColor),
  };

  function toSvgColor(color: number) {
    return "#" + color.toString(16).padStart(6, "0");
  }

  export interface Configuration {
    readonly index: number;
    readonly angle: number;
    readonly range: number;
    readonly width: number;
  }

  const registry = genRegistry<Record<number, Sensor>>({});

  export const useHook = registry.useHook;
  export const signalUpdate = registry.signal;

  export function getAll() {
    return Object.values(registry.get());
  }

  export function register(sensor: Sensor) {
    registry.get()[sensor.config.index] = sensor;
    registry.signal();
  }

  export function unregister(sensor: Sensor | number) {
    delete registry.get()[
      typeof sensor === "number" ? sensor : sensor.config.index
    ];
    registry.signal();
  }

  export async function loadAll() {
    const sensors = Settings.singleton.sensors.map(
      (config) => new Sensor(config),
    );

    sensors.forEach((sensor) => register(sensor));
    await Promise.all(sensors.map((sensor) => sensor.fetchImageData()));
    signalUpdate();
  }
}

export function useSensors() {
  const sensors = Sensor.useHook();
  return Object.values(sensors);
}

export default Sensor;
