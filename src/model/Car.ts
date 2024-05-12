import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";
import App from "./App";
import { clamp, Settings } from "./Settings";
import Track from "./Track";

class Car {
  private _imageData: ComposedImage | null = null;

  readonly width = Settings.singleton.carWidth;
  readonly height = Settings.singleton.carHeight;

  // Position and Motion
  private track: Track | null = null;
  public position = { x: 0, y: 0 };
  public angle = 0; // radians. 0 = right, pi/2 = down
  public speed = 0; // px/s
  public steering = 0; // -1 to +1
  public acceleration = 0; // -1 to +1

  // State and scoring
  public odometer = 0;
  public laps = 0;
  private inCrossing = false;
  public startTime = 0;
  public endTime = 0;
  public collided = false;
  private pastTracking: { x: number; y: number }[] = [];

  // Sensors
  private sensorsReady = true;

  // Network evaluation

  constructor(
    public readonly name: string,
    public color = "blue",
    public fudgeFactor = 0, // 0-1
  ) {}

  get mask(): string {
    return [
      `<svg
        width="${this.width}px"
        height="${this.height}px"
        viewBox="0 0 ${this.width} ${this.height}"
      >`,
      `<rect
        width="${this.width}"
        height="${this.height}"
        rx="${this.width / 4}"
        ry="${this.height / 4}"
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
        width="${this.width}px"
        height="${this.height}px"
        viewBox="0 0 ${this.width} ${this.height}"
      >`,
      // Car body
      `<rect
        width="${this.width}"
        height="${this.height}"
        rx="${this.width / 4}"
        ry="${this.height / 4}"
        fill="${this.collided ? "red" : this.color}"
      />`,
      // Wheels
      [
        [0, 0],
        [(this.width * 3) / 4, 0],
        [(this.width * 3) / 4, (this.height * 3) / 4],
        [0, (this.height * 3) / 4],
      ].map(
        ([x, y]) =>
          `<rect
            x="${x}"
            y="${y}"
            width="${this.width / 4}"
            height="${this.height / 4}"
            rx="${this.width / 8}"
            ry="${this.height / 8}"
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

  get score() {
    const now = Date.now();
    const distance = this.odometer / Math.max(this.width, this.height);
    const time = ((this.endTime || now) - (this.startTime || now)) / 1000;
    return {
      distance,
      time,
      laps: this.laps,
      success: !this.collided && this.laps >= 3 && this.startTime > 0,
      score:
        distance - time + (this.laps + Math.sign(this.startTime)) ** 2 * 10,
    };
  }

  async fetchImageData() {
    this._imageData = await composeImage([this.image], {
      width: this.width,
      height: this.height,
    });
    return this._imageData;
  }

  placeOnTrack(track: Track) {
    this.track = track;

    // Reset position and angle to start of track
    this.position.x = track.startingPoint.x;
    this.position.y = track.startingPoint.y;
    this.angle = track.startingAngle;
    this.speed = 0;
    this.steering = 0;
    this.acceleration = 0;

    // Move behind the starting line
    this.position.x -= (track.startingDirection.x * this.width) / 2;
    this.position.y -= (track.startingDirection.y * this.height) / 2;

    // Start on slightly different spots on the starting line
    const fudge = Math.random() * this.fudgeFactor;
    this.position.x += fudge * track.startingDirection.y;
    this.position.y -= fudge * track.startingDirection.x;

    // Reset scoring state
    this.odometer = 0;
    this.laps = 0;
    this.inCrossing = false;
    this.startTime = 0;
    this.endTime = 0;
    this.collided = false;
    this.fetchImageData();
    this.pastTracking = [];

    // Reset collision status
    this.sensorsReady = true;
  }

  endRun(collided = true) {
    this.endTime = Date.now();
    if (!this.startTime) {
      this.startTime = this.endTime;
    }
    this.inCrossing = false;
    this.collided = collided;
    this.fetchImageData();
  }

  render(context: CanvasRenderingContext2D) {
    if (!this.canvas) {
      return;
    }

    context.save();
    context.resetTransform();

    // Move the center of the car to the position
    context.translate(-this.width / 2, -this.height / 2);
    context.translate(this.position.x, this.position.y);

    // Rotate the car to the direction it's heading
    context.translate(this.width / 2, this.height / 2);
    context.rotate(this.angle);
    context.translate(-this.width / 2, -this.height / 2);

    context.drawImage(this.canvas, 0, 0);
    context.restore();

    // composeImage([], {
    //   width: Track.width / 2,
    //   height: Track.height / 2,
    //   sources: [
    //     {
    //       src: this.track?.mask || "transparent",
    //       stretch: 0.5,
    //       smoothing: false,
    //     },
    //     {
    //       src: this.mask,
    //       position: {
    //         x: (this.position.x - this.width / 2) / 2,
    //         y: (this.position.y - this.height / 2) / 2,
    //       },
    //       rotate: this.angle * (180 / Math.PI),
    //       stretch: 0.5,
    //       composition: "lighter",
    //       smoothing: false,
    //     },
    //   ],
    // }).then((image) => {
    //   context.resetTransform();
    //   context.clearRect(0, 0, image.canvas.width, image.canvas.height);
    //   context.drawImage(image.canvas, 0, 0);
    // });
  }

  tick(dt: number) {
    // Don't move if collided
    if (this.collided || !this.track) {
      return;
    }

    // Manual controls
    if (this.name === "Manual") {
      this.manualControl();
    }

    const settings = Settings.singleton;

    // Steering
    this.steering = clamp(this.steering, -1, 1);
    if (Math.abs(this.steering) >= 0.01 && this.speed >= 0.01) {
      this.angle += settings.maxSteering * this.steering * dt;
      this.steering -= settings.trackFriction * Math.sign(this.steering) * dt;
      this.speed -= settings.trackFriction * this.speed * dt;
    }
    if (this.angle > Math.PI) {
      this.angle -= Math.PI * 2;
    } else if (this.angle < -Math.PI) {
      this.angle += Math.PI * 2;
    }

    // Acceleration and breaking
    this.acceleration = clamp(this.acceleration, -1, 1);
    if (Math.abs(this.acceleration) >= 0.01) {
      this.speed += settings.maxAcceleration * this.acceleration * dt;
      this.acceleration -=
        settings.trackFriction * Math.sign(this.acceleration) * dt;
    } else {
      this.speed -= settings.trackFriction * this.speed * dt;
    }
    this.speed = clamp(this.speed, 0, settings.maxSpeed);

    // Movement
    this.position.x += Math.cos(this.angle) * this.speed * dt;
    this.position.y += Math.sin(this.angle) * this.speed * dt;
    this.odometer += this.speed * dt;
    if (
      this.position.x <= 0 ||
      this.position.x >= this.track.width ||
      this.position.y <= 0 ||
      this.position.y >= this.track.height
    ) {
      return this.endRun();
    }

    // Tracking
    const trackingRadius = Math.max(
      this.width,
      this.height,
      this.track.roadThickness,
    );
    const dists = this.pastTracking.map((p) =>
      Math.hypot(p.x - this.position.x, p.y - this.position.y),
    );
    if (dists.length === 0 || dists.every((d) => d > trackingRadius)) {
      // Record a new position on tracking
      this.pastTracking.unshift({ x: this.position.x, y: this.position.y });
      if (this.pastTracking.length > 3) {
        this.pastTracking.pop();
      }
    } else if (
      dists.length > 1 &&
      dists.slice(1).some((d) => d < trackingRadius)
    ) {
      // Went back on the track
      return this.endRun();
    }

    // Collision
    this.checkSensors();
  }

  checkSensors() {
    if (!this.track || !this.sensorsReady || this.collided) {
      return;
    }

    this.sensorsReady = false;
    const sensorRadius = Math.max(this.width / 2, this.height / 2) + 1;

    composeImage([], {
      width: this.track.width,
      height: this.track.height,
      sources: [
        {
          src: this.track.mask,
          smoothing: false,
        },
        {
          src: this.mask,
          position: {
            x: this.position.x - this.width / 2,
            y: this.position.y - this.height / 2,
          },
          rotate: this.angle * (180 / Math.PI),
          composition: "lighter",
          smoothing: false,
        },
      ],
    })
      .then((image) =>
        image.getColorBuckets([0xd0d0d0, 0xe0d0d0, 0xe0e0e0], 0x0f, {
          x: this.position.x - sensorRadius,
          y: this.position.y - sensorRadius,
          w: sensorRadius * 2,
          h: sensorRadius * 2,
        }),
      )
      .then((hist) => {
        // Crossing the start/finish line
        if (hist[0xe0d0d0] > 0 && !this.inCrossing) {
          this.inCrossing = true;

          // Crossing in the wrong direction!
          if (Math.abs(this.angle - this.track!.startingAngle) > Math.PI / 2) {
            return this.endRun();
          }

          // First crossing starts the timer instead of counting as a lap
          if (!this.startTime) {
            this.startTime = Date.now();
          } else {
            this.laps++;
          }
        } else if (hist[0xe0d0d0] < 1 && this.inCrossing) {
          this.inCrossing = false;
        }

        // Went outside the track
        if (hist[0xe0e0e0] > 1) {
          return this.endRun();
        }
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
