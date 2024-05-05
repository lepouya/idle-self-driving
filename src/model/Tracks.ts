import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";

abstract class Track {
  private _imageData: ComposedImage | null = null;

  constructor(public readonly name: string) {}

  abstract get path(): string[];
  abstract get roadThickness(): number;
  abstract get laneMarkingThickness(): number;
  abstract get startingPoint(): [number, number];
  abstract get startingDirection(): [number, number];

  get mask(): string {
    const svg = `<svg width="${Track.width}px" height="${Track.height}px" viewBox="0 0 ${Track.width} ${Track.height}">`;
    const bg = `<rect width="${Track.width}" height="${Track.height}" fill="#222222" />`;
    const paths = this.path.map(
      (path) =>
        `<path d="${path}" stroke="#000000" strokeWidth="${this.roadThickness}px" strokeLinecap="round" strokeLinejoin="round" />`,
    );
    return `${svg}${bg}${paths.join("")}</svg>`;
  }

  get image(): string {
    return [
      // Viewbox
      `<svg
        width="${Track.width}px"
        height="${Track.height}px"
        viewBox="0 0 ${Track.width} ${Track.height}"
      >`,
      // Background
      `<rect
        width="${Track.width}"
        height="${Track.height}"
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
            stroke-dasharray="${this.laneMarkingThickness * 3},${
            this.laneMarkingThickness * 5
          }"
            stroke-dashoffset="${this.laneMarkingThickness}"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />`,
      ),
      // Starting line
      `<path
        d="M ${this.startingPoint[0]} ${this.startingPoint[1]} l ${
        Math.sign(this.startingDirection[0]) * this.laneMarkingThickness
      } ${Math.sign(this.startingDirection[1]) * this.laneMarkingThickness}"
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
      width: Track.width,
      height: Track.height,
    });
    return this._imageData;
  }
}

module Track {
  export const width = 800;
  export const height = 600;

  const tracksRegistry = genRegistry<Record<string, Track>>({});

  export const useHook = tracksRegistry.useHook;
  export const signalUpdate = tracksRegistry.signal;

  export function register(track: Track) {
    tracksRegistry.get()[track.name] = track;
    tracksRegistry.signal();
  }

  export function unregister(track: Track | string) {
    delete tracksRegistry.get()[typeof track === "string" ? track : track.name];
    tracksRegistry.signal();
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
  get roadThickness(): number {
    return 80;
  }
  get laneMarkingThickness(): number {
    return 3;
  }
  get startingPoint(): [number, number] {
    return [150, 530];
  }
  get startingDirection(): [number, number] {
    return [1, 0];
  }
}

class AdvancedTrack extends Track {
  get path(): string[] {
    return [
      "M 750 50 h -300 l -200 100 l -100 -70 h -100 v 450 h 300 v -50 h 100 v -300 h 70 v 380 h 150 Z",
      "M 250 225 q -100 0 -100 100 t 100 100 t 100 -100 t -100 -100 Z",
    ];
  }
  get roadThickness(): number {
    return 60;
  }
  get laneMarkingThickness(): number {
    return 3;
  }
  get startingPoint(): [number, number] {
    return [600, 50];
  }
  get startingDirection(): [number, number] {
    return [1, 0];
  }
}

class OvalTrack extends Track {
  get path(): string[] {
    return ["M 400 100 Q 100 100 100 300 T 400 500 T 700 300 T 400 100 Z"];
  }
  get roadThickness(): number {
    return 100;
  }
  get laneMarkingThickness(): number {
    return 3;
  }
  get startingPoint(): [number, number] {
    return [400, 100];
  }
  get startingDirection(): [number, number] {
    return [-1, 0];
  }
}

class CurvyTrack extends Track {
  get path(): string[] {
    return [
      "M 100 300 c 0 100 50 200 150 200 s 50 -150 150 -150 s 50 150 150 150 s 150 -100 150 -200 " +
        "s 0 -100 -100 -100 s -100 0 -100 -100 s 0 0 -100 0 s 0 0 -100 0 s 0 -50 -100 -50 s -100 150 -100 250 Z",
    ];
  }
  get roadThickness(): number {
    return 70;
  }
  get laneMarkingThickness(): number {
    return 3;
  }
  get startingPoint(): [number, number] {
    return [400, 100];
  }
  get startingDirection(): [number, number] {
    return [-1, 0];
  }
}
