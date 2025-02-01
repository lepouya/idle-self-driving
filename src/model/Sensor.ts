import clamp from "../utils/clamp";
import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";
import Settings from "./Settings";

class Sensor {
  private renderImage: ComposedImage | undefined = undefined;

  private path: string;

  constructor(public readonly range: number, public readonly angle: number) {
    const dx = range * Math.cos(angle);
    const dy = range * Math.sin(angle);
    this.path = `M ${~~range} ${~~range} l ${~~dx} ${~~dy}`;
  }

  get maskColor() {
    return Sensor.radar;
  }

  get mask(): string {
    return [
      `<svg
        width="${this.range * 2}px"
        height="${this.range * 2}px"
        viewBox="0 0 ${this.range * 2} ${this.range * 2}"
      >`,
      `<path
        d="${this.path}"
        stroke="${Sensor.color.radar}"
        stroke-width="2px"
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
        width="${this.range * 2}px"
        height="${this.range * 2}px"
        viewBox="0 0 ${this.range * 2} ${this.range * 2}"
      >`,
      `<path
        d="${this.path}"
        stroke="green"
        stroke-width="2px"
        stroke-linecap="round"
        fill="none"
      />`,
      `</svg>`,
    ].join("");
  }

  get canvas(): HTMLCanvasElement | undefined {
    return this.renderImage?.canvas;
  }

  async fetchImageData() {
    this.renderImage = await composeImage([this.image], {
      reuse: this.renderImage,
      clear: true,
      width: this.range * 2,
      height: this.range * 2,
    });
    return this.renderImage;
  }

  render(context: CanvasRenderingContext2D, scale = 1) {
    if (!this.canvas) {
      return;
    }

    const all = ~~this.range;
    const pos = ~~(this.range * scale);
    context.globalCompositeOperation = "lighter";
    context.drawImage(this.canvas, -all, -all, all * 2, all * 2);
    context.globalCompositeOperation = "source-over";
    context.drawImage(this.canvas, -pos, -pos, pos * 2, pos * 2);
  }

  read(
    buffer: Uint32Array,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    heading: number,
  ) {
    const dx = Math.cos(this.angle + heading);
    const dy = Math.sin(this.angle + heading);

    let dist = 0;
    for (let r = 0; r < this.range; r++) {
      const row = clamp(~~(centerY + r * dy), 0, height - 1);
      const col = clamp(~~(centerX + r * dx), 0, width - 1);
      if (Sensor.check(buffer[row * width + col], Sensor.offTrack)) {
        break;
      } else {
        dist = r;
      }
    }

    return clamp(dist / this.range, 0, 1);
  }
}

module Sensor {
  export const available = 0x000000;
  export const offTrack = 0x800000;
  export const lapLine = 0x008000;
  export const vehicle = 0x7f7f7f;
  export const radar = 0x000080;

  export const color = {
    available: toSvgColor(available),
    offTrack: toSvgColor(offTrack),
    lapLine: toSvgColor(lapLine),
    vehicle: toSvgColor(vehicle),
    radar: toSvgColor(radar),
  };

  function toSvgColor(col: number) {
    return "#" + col.toString(16).padStart(6, "0");
  }

  function toCanvasColor(col: number) {
    // HTML colors are RGB, but canvas data is ABGR
    return ((col & 0xff0000) >> 16) | ((col & 0xff) << 16) | (col & 0xff00);
  }

  export function check(argb: number, ...sensorColors: number[]) {
    const color = toCanvasColor(
      sensorColors.reduce((acc, color) => acc | color, 0),
    );
    return (argb & color) === color;
  }

  export const registry = genRegistry<Sensor[]>([]);

  export async function loadAll() {
    const sensors = Settings.singleton.sensors.map(
      ({ range, angle }) => new Sensor(range, angle),
    );

    sensors.forEach((sensor) => registry.get().push(sensor));
    await Promise.all(sensors.map((sensor) => sensor.fetchImageData()));
    registry.signal();
  }

  export function readAll(
    mask: ComposedImage,
    cx: number,
    cy: number,
    ca: number,
  ): number[] {
    // Get the relevant portion of the mask as a buffer
    const radius = ~~Math.max(...registry.get().map((sensor) => sensor.range));
    const { buffer, startX, startY, width, height } = mask.getPixels(
      ~~cx - radius,
      ~~cy - radius,
      radius * 2,
      radius * 2,
    );

    return registry
      .get()
      .map((sensor) =>
        sensor.read(
          buffer,
          width,
          height,
          radius - startX,
          radius - startY,
          ca,
        ),
      );

    // const readings = sensors.map(() => 0);
    // for (let i = 0; i < sensors.length; i++) {
    //   const sensor = sensors[i];
    //   const dx = Math.cos(sensor.angle + ca);
    //   const dy = Math.sin(sensor.angle + ca);

    //   let dist = 0;
    //   for (let r = 0; r < sensor.range; r++) {
    //     const row = clamp(~~(radius + r * dy - startY), 0, height - 1);
    //     const col = clamp(~~(radius + r * dx - startX), 0, width - 1);
    //     if (Sensor.check(buffer[row * width + col], Sensor.offTrack)) {
    //       break;
    //     } else {
    //       dist = r;
    //     }
    //   }

    //   readings[i] = clamp(dist / sensor.range, 0, 1);
    // }

    // return readings;
  }
}

export function useSensors() {
  const sensors = Sensor.registry.useHook();
  return sensors;
}

export default Sensor;
