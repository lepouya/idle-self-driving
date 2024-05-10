import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";
import App from "./App";
import { clamp } from "./Settings";
import Track from "./Track";

class Car {
  private _imageData: ComposedImage | null = null;

  // Position and Motion
  public position = { x: 0, y: 0 };
  public angle = 0; // radians. 0 = right, pi/2 = down
  public speed = 0; // px/s
  public steering = 0; // -1 to +1
  public acceleration = 0; // -1 to +1

  // Sensors
  private track: Track | null = null;
  private sensorsReady = true;
  public _collided = false;

  // Network evaluation

  constructor(
    public readonly name: string,
    public color = "blue",
    public fudgeFactor = 0, // 0-1
  ) {}

  get mask(): string {
    return [
      `<svg
        width="${Car.width}px"
        height="${Car.height}px"
        viewBox="0 0 ${Car.width} ${Car.height}"
      >`,
      `<rect
        width="${Car.width}"
        height="${Car.height}"
        rx="${Car.width / 4}"
        ry="${Car.height / 4}"
        fill="#d0d0d0"
        shape-rendering="crispEdges"
      />`,
      `</svg>`,
    ].join("");
  }

  get image(): string {
    return [
      // Viewbox
      `<svg
        width="${Car.width}px"
        height="${Car.height}px"
        viewBox="0 0 ${Car.width} ${Car.height}"
      >`,
      // Car body
      `<rect
        width="${Car.width}"
        height="${Car.height}"
        rx="${Car.width / 4}"
        ry="${Car.height / 4}"
        fill="${this.collided ? "red" : this.color}"
      />`,
      // Wheels
      [
        [0, 0],
        [(Car.width * 3) / 4, 0],
        [(Car.width * 3) / 4, (Car.height * 3) / 4],
        [0, (Car.height * 3) / 4],
      ].map(
        ([x, y]) =>
          `<rect
            x="${x}"
            y="${y}"
            width="${Car.width / 4}"
            height="${Car.height / 4}"
            rx="${Car.width / 8}"
            ry="${Car.height / 8}"
            fill="black"
          />`,
      ),
      // Closing
      `</svg>`,
    ].join("");
  }

  get canvas(): HTMLCanvasElement | undefined {
    return this._imageData?.canvas;
  }

  async fetchImageData() {
    this._imageData = await composeImage([this.image], {
      width: Car.width,
      height: Car.height,
    });
    return this._imageData;
  }

  get collided() {
    return this._collided;
  }

  set collided(value: boolean) {
    if (this._collided !== value) {
      this._collided = value;
      this.fetchImageData();
    }
  }

  placeOnTrack(track: Track) {
    this.track = track;

    // Reset position and angle to start of track
    this.position.x = track.startingPoint[0];
    this.position.y = track.startingPoint[1];
    this.angle = Math.atan2(
      track.startingDirection[1],
      track.startingDirection[0],
    );
    this.speed = 0;
    this.steering = 0;
    this.acceleration = 0;

    // Move behind the starting line
    this.position.x -= (track.startingDirection[0] * Car.width) / 2;
    this.position.y -= (track.startingDirection[1] * Car.height) / 2;

    // Start on slightly different spots on the starting line
    const fudge = Math.random() * this.fudgeFactor;
    this.position.x += fudge * track.startingDirection[1];
    this.position.y -= fudge * track.startingDirection[0];

    // Reset collision status
    this.collided = false;
    this.sensorsReady = true;
  }

  render(context: CanvasRenderingContext2D) {
    if (!this.canvas) {
      return;
    }

    context.save();
    context.resetTransform();

    // Move the center of the car to the position
    context.translate(-Car.width / 2, -Car.height / 2);
    context.translate(this.position.x, this.position.y);

    // Rotate the car to the direction it's heading
    context.translate(Car.width / 2, Car.height / 2);
    context.rotate(this.angle);
    context.translate(-Car.width / 2, -Car.height / 2);

    context.drawImage(this.canvas, 0, 0);
    context.restore();
  }

  tick(dt: number) {
    // Don't move if collided
    if (this.collided) {
      return;
    }

    // Manual controls
    if (this.name === "Manual") {
      this.manualControl();
    }

    // Steering
    this.steering = clamp(this.steering, -1, 1);
    if (Math.abs(this.steering) >= 0.01 && this.speed >= 0.01) {
      this.angle += Car.maxSteering * this.steering * dt;
      this.steering -= Car.friction * Math.sign(this.steering) * dt;
      this.speed -= Car.friction * this.speed * dt;
    }
    if (this.angle > Math.PI) {
      this.angle -= Math.PI * 2;
    } else if (this.angle < -Math.PI) {
      this.angle += Math.PI * 2;
    }

    // Acceleration and breaking
    this.acceleration = clamp(this.acceleration, -1, 1);
    if (Math.abs(this.acceleration) >= 0.01) {
      this.speed += Car.maxAcceleration * this.acceleration * dt;
      this.acceleration -= Car.friction * Math.sign(this.acceleration) * dt;
    } else {
      this.speed -= Car.friction * this.speed * dt;
    }
    if (this.speed < 0) {
      this.speed = 0;
    } else if (this.speed > Car.maxSpeed) {
      this.speed = Car.maxSpeed;
    }

    // Movement
    this.position.x += Math.cos(this.angle) * this.speed * dt;
    this.position.y += Math.sin(this.angle) * this.speed * dt;
    if (this.position.x < 0) {
      this.position.x = 0;
      this.speed = 0;
      this.collided = true;
    } else if (this.position.x > Track.width) {
      this.position.x = Track.width;
      this.speed = 0;
      this.collided = true;
    }
    if (this.position.y < 0) {
      this.position.y = 0;
      this.speed = 0;
      this.collided = true;
    } else if (this.position.y > Track.height) {
      this.position.y = Track.height;
      this.speed = 0;
      this.collided = true;
    }

    // Collision
    if (this.track && this.sensorsReady) {
      this.checkSensors();
    }
  }

  checkSensors() {
    this.sensorsReady = false;

    composeImage([], {
      width: Track.width,
      height: Track.height,
      sources: [
        {
          src: this.track?.mask || "transparent",
          smoothing: false,
        },
        {
          src: this.mask,
          position: {
            x: this.position.x - Car.width / 2,
            y: this.position.y - Car.height / 2,
          },
          rotate: this.angle * (180 / Math.PI),
          composition: "lighter",
          smoothing: false,
        },
      ],
    })
      .then((image) => image.getColorBuckets([0xd0d0d0, 0xe0e0e0], 0x0f))
      .then((hist) => {
        this.collided = hist[0xe0e0e0] > 1;
      })
      .finally(() => {
        this.sensorsReady = true;
      });
  }

  manualControl() {
    if (App.isKeyDown("ArrowDown", "S")) {
      this.acceleration = clamp(this.acceleration - 0.1, -1, -0.1);
    } else if (App.isKeyDown("ArrowUp", "W")) {
      this.acceleration = clamp(this.acceleration + 0.1, 0.1, 1);
    } else {
      this.acceleration = 0;
    }

    if (App.isKeyDown("ArrowLeft", "A")) {
      this.steering = clamp(this.steering - 0.1, -1, -0.1);
    } else if (App.isKeyDown("ArrowRight", "D")) {
      this.steering = clamp(this.steering + 0.1, 0.1, 1);
    } else {
      this.steering = 0;
    }
  }
}

module Car {
  export const width = 20; // px
  export const height = 15; // px
  // TODO: Move these to settings
  export const maxSpeed = 100; // px/s
  export const maxAcceleration = 25; // px/s^2
  export const maxSteering = Math.PI / 2; // rad/s
  export const friction = 0.1; // %/s

  const carsRegistry = genRegistry<Record<string, Car>>({});

  export const useHook = carsRegistry.useHook;
  export const signalUpdate = carsRegistry.signal;

  export function register(car: Car) {
    carsRegistry.get()[car.name] = car;
    carsRegistry.signal();
  }

  export function unregister(car: Car | string) {
    delete carsRegistry.get()[typeof car === "string" ? car : car.name];
    carsRegistry.signal();
  }

  export async function loadAll() {
    const cars = [new Car("Manual")];
    cars.forEach((cars) => register(cars));
    await Promise.all(cars.map((cars) => cars.fetchImageData()));
    signalUpdate();
  }

  export function renderAll(context: CanvasRenderingContext2D) {
    Object.values(carsRegistry.get()).forEach((car) => car.render(context));
  }

  export function tickAll(dt: number) {
    Object.values(carsRegistry.get()).forEach((car) => car.tick(dt));
  }
}

export function useCars() {
  const cars = Car.useHook();
  return Object.values(cars);
}

export default Car;
