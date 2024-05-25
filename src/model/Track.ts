import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";
import Sensor from "./Sensor";
import { Settings } from "./Settings";

abstract class Track {
  private _imageData: ComposedImage | null = null;

  readonly width = Settings.singleton.trackWidth;
  readonly height = Settings.singleton.trackHeight;

  constructor(public readonly name: string) {}

  abstract get path(): string[];
  abstract get roadThickness(): number;
  abstract get laneMarkingThickness(): number;
  abstract get startingPoint(): { x: number; y: number };
  abstract get startingDirection(): { x: number; y: number };

  get startingAngle(): number {
    return Math.atan2(this.startingDirection.y, this.startingDirection.x);
  }

  get mask(): string {
    return [
      // Viewbox
      `<svg
        width="${this.width}px"
        height="${this.height}px"
        viewBox="0 0 ${this.width} ${this.height}"
      >`,
      // Off-course
      `<rect
        width="${this.width}"
        height="${this.height}"
        fill="${Sensor.color.offTrack}"
        shape-rendering="crispEdges"
      />`,
      // Road mask
      this.path.map(
        (path) =>
          `<path
            d="${path}"
            stroke="${Sensor.color.available}"
            stroke-width="${this.roadThickness}px"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
            shape-rendering="crispEdges"
          />`,
      ),
      // Starting line
      `<path
        d="M ${this.startingPoint.x} ${this.startingPoint.y} l ${
        Math.sign(this.startingDirection.x) * this.laneMarkingThickness
      } ${Math.sign(this.startingDirection.y) * this.laneMarkingThickness}"
        stroke="${Sensor.color.lapLine}"
        stroke-width="${this.roadThickness}px"
        stroke-linecap="butt"
        fill="none"
      />`,
      // Closing
      `</svg>`,
    ].join("");
  }

  get image(): string {
    return [
      // Viewbox
      `<svg
        width="${this.width}px"
        height="${this.height}px"
        viewBox="0 0 ${this.width} ${this.height}"
      >`,
      // Background
      `<rect
        width="${this.width}"
        height="${this.height}"
        fill="lightgreen"
      />`,
      // Outside lane marking
      this.path.map(
        (path) =>
          `<path
            d="${path}"
            stroke="salmon"
            stroke-width="${
              this.roadThickness + this.laneMarkingThickness * 2
            }px"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />`,
      ),
      // Road
      this.path.map(
        (path) =>
          `<path
            d="${path}"
            stroke="lightgray"
            stroke-width="${this.roadThickness}px"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />`,
      ),
      // Inside lane marking
      this.path.map(
        (path) =>
          `<path
            d="${path}"
            stroke="yellow"
            stroke-width="${this.laneMarkingThickness}px"
            stroke-dasharray="
              ${this.laneMarkingThickness * 3},
              ${this.laneMarkingThickness * 5}"
            stroke-dashoffset="${this.laneMarkingThickness}"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />`,
      ),
      // Starting line
      `<path
        d="M ${this.startingPoint.x} ${this.startingPoint.y} l ${
        Math.sign(this.startingDirection.x) * this.laneMarkingThickness
      } ${Math.sign(this.startingDirection.y) * this.laneMarkingThickness}"
        stroke="white"
        stroke-width="${this.roadThickness}px"
        stroke-linecap="butt"
        fill="none"
      />`,
      // Closing
      `</svg>`,
    ].join("");
  }

  get canvas(): HTMLCanvasElement | undefined {
    return this._imageData?.canvas;
  }

  async fetchImageData() {
    this._imageData = await composeImage([this.image], {
      width: this.width,
      height: this.height,
    });
    return this._imageData;
  }

  render(context: CanvasRenderingContext2D) {
    if (!this.canvas) {
      return;
    }

    context.drawImage(this.canvas, 0, 0);
  }
}

module Track {
  const registry = genRegistry<Record<string, Track>>({});

  export const useHook = registry.useHook;
  export const signalUpdate = registry.signal;

  export function register(track: Track) {
    registry.get()[track.name] = track;
    registry.signal();
  }

  export function unregister(track: Track | string) {
    delete registry.get()[typeof track === "string" ? track : track.name];
    registry.signal();
  }

  export async function loadAll() {
    const tracks = [
      new BasicTrack("Basic"),
      new AdvancedTrack("Advanced"),
      new OvalTrack("Oval"),
      new CurvyTrack("Curvy"),
    ];
    tracks.forEach((track) => register(track));
    await Promise.all(tracks.map((track) => track.fetchImageData()));
    signalUpdate();
  }
}

export function useTracks() {
  return Track.useHook();
}

export default Track;

class BasicTrack extends Track {
  get path(): string[] {
    return ["M 730 70 h -360 v 200 h -300 v 260 h 400 l 260 -260 v -160 Z"];
  }
  get roadThickness() {
    return 80;
  }
  get laneMarkingThickness() {
    return 3;
  }
  get startingPoint() {
    return { x: 150, y: 530 };
  }
  get startingDirection() {
    return { x: 1, y: 0 };
  }
}

class AdvancedTrack extends Track {
  get path(): string[] {
    return [
      "M 750 50 h -300 l -200 100 l -100 -70 h -100 v 450 h 300 v -50 h 100 v -300 h 70 v 380 h 150 Z",
      "M 250 225 q -100 0 -100 100 t 100 100 t 100 -100 t -100 -100 Z",
    ];
  }
  get roadThickness() {
    return 60;
  }
  get laneMarkingThickness() {
    return 3;
  }
  get startingPoint() {
    return { x: 600, y: 50 };
  }
  get startingDirection() {
    return { x: 1, y: 0 };
  }
}

class OvalTrack extends Track {
  get path(): string[] {
    return ["M 400 100 Q 100 100 100 300 T 400 500 T 700 300 T 400 100 Z"];
  }
  get roadThickness() {
    return 100;
  }
  get laneMarkingThickness() {
    return 3;
  }
  get startingPoint() {
    return { x: 400, y: 100 };
  }
  get startingDirection() {
    return { x: -1, y: 0 };
  }
}

class CurvyTrack extends Track {
  get path(): string[] {
    return [
      "M 100 300 c 0 100 50 200 150 200 s 50 -150 150 -150 s 50 150 150 150 s 150 -100 150 -200 " +
        "s 0 -100 -100 -100 s -100 0 -100 -100 s 0 0 -100 0 s 0 0 -100 0 s 0 -50 -100 -50 s -100 150 -100 250 Z",
    ];
  }
  get roadThickness() {
    return 70;
  }
  get laneMarkingThickness() {
    return 3;
  }
  get startingPoint() {
    return { x: 400, y: 100 };
  }
  get startingDirection() {
    return { x: -1, y: 0 };
  }
}
