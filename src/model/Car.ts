import clamp from "../utils/clamp";
import composeImage, { ComposedImage } from "../utils/composeImage";
import genRegistry from "../utils/registry";
import shortcut from "../utils/shortcut";
import Network from "./Network";
import Sensor from "./Sensor";
import Settings from "./Settings";
import Track from "./Track";

class Car {
  private renderImage: ComposedImage | undefined = undefined;
  private sensorImage: ComposedImage | undefined = undefined;

  readonly width = Settings.singleton.carWidth;
  readonly height = Settings.singleton.carHeight;

  // Position and Motion
  public track: Track | null = null;
  public position = { x: 0, y: 0 };
  public angle = 0; // radians. 0 = right, pi/2 = down
  public speed = 0; // px/s
  public steering = 0; // -1 to +1
  public acceleration = 0; // -1 to +1

  // State and scoring
  public odometer = 0;
  public laps = 0;
  private inCrossing = false;
  private totalTicks = 0;
  public startTime = 0;
  public endTime = 0;
  public collided = false;
  private pastTracking: { x: number; y: number }[] = [];

  // Sensors
  private sensorsReady = true;
  private sensorReadingTime = 0;
  private sensorReadings: number[] = [];
  public visualizeSensors = false;

  // Network evaluation
  public net: Network | null = null;

  constructor(
    public readonly name: string,
    public color = "",
    public fudgeFactor = 0.5, // 0-1
  ) {
    if (!color) {
      const rgb = [32, 64, 128].map((c) =>
        clamp(~~(Math.random() * c * 2), 0, 255),
      );
      this.color =
        "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
    }

    if (name) {
      Car.registry.get()[name] = this;
    }
  }

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
        fill="${Sensor.color.vehicle}"
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
        fill="${this.laps >= 3 ? "green" : this.collided ? "red" : this.color}"
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
    return this.renderImage?.canvas;
  }

  async fetchImageData() {
    this.renderImage = await composeImage([], {
      reuse: this.renderImage,
      clear: true,
      sources: [{ src: this.image, opacity: this.net ? 0.666 : 1 }],
      width: this.width,
      height: this.height,
    });
    return this.renderImage;
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
    const fudge = this.net
      ? Math.random() * track.roadThickness - track.roadThickness / 2
      : 0;
    this.position.x += fudge * this.fudgeFactor * track.startingDirection.y;
    this.position.y -= fudge * this.fudgeFactor * track.startingDirection.x;

    // Reset scoring state
    this.odometer = 0;
    this.laps = 0;
    this.inCrossing = false;
    this.startTime = 0;
    this.endTime = 0;
    this.collided = false;
    this.fetchImageData();

    // Prevent from going backwards
    const trackingRadius =
      Math.max(this.width, this.height, this.track.roadThickness) + 1;
    this.pastTracking = [
      {
        x: track.startingPoint.x - track.startingDirection.x * trackingRadius,
        y: track.startingPoint.y - track.startingDirection.y * trackingRadius,
      },
    ];

    // Reset collision status
    this.sensorsReady = true;
    this.sensorReadingTime = Date.now();
  }

  endRun(collided = true) {
    this.endTime = Date.now();
    if (!this.startTime) {
      this.startTime = this.endTime;
    }
    this.inCrossing = false;
    this.collided = collided;
    this.fetchImageData();

    // New SOTA!
    const settings = Settings.singleton;
    if (
      this.track &&
      this.net &&
      this.score.score > (settings.sotaScore[this.track.name] ?? 0)
    ) {
      settings.sotaNet = this.net.config;
      settings.sotaScore = { [this.track.name]: this.score.score };
    }
  }

  render(context: CanvasRenderingContext2D, highlight = false) {
    if (!this.canvas) {
      return;
    }

    context.save();

    context.resetTransform();
    context.translate(~~this.position.x, ~~this.position.y);
    context.rotate(this.angle);

    if (this.visualizeSensors || this.name === "Manual") {
      Sensor.registry
        .get()
        .forEach((sensor, idx) =>
          sensor.render(context, this.sensorReadings[idx]),
        );
    }

    context.drawImage(this.canvas, ~~(-this.width / 2), ~~(-this.height / 2));
    if (highlight) {
      const intensity = Math.abs(Math.sin(Date.now() / 200) + 1);
      context.filter = `blur(${intensity * 5}px) brightness(${
        intensity * 100
      }%)`;
      context.drawImage(this.canvas, ~~(-this.width / 2), ~~(-this.height / 2));
    }

    context.restore();
  }

  tick(dt: number) {
    // Don't move if collided
    if (this.collided || !this.track) {
      return;
    }

    // Manual controls
    if (this.name === "Manual") {
      this.manualControl();
    } else {
      const score = this.score;
      // Lost cause
      if (score.score < -10 || (this.totalTicks > 10 && score.score === 0)) {
        console.log(this.name, "doesn't seem to be going anywhere");
        return this.endRun();
      }
      // Successful run
      if (score.laps >= 3) {
        console.log(this.name, "has beaten the track !!!");
        return this.endRun();
      }
    }

    const settings = Settings.singleton;
    this.totalTicks += dt;

    // Steering
    this.steering = clamp(this.steering, -1, 1);
    this.steering = clamp(this.steering, -this.speed, this.speed);
    if (Math.abs(this.steering) >= 0.01) {
      this.angle += settings.maxSteering * this.steering * dt;
      this.steering -= settings.friction * Math.sign(this.steering) * dt;
      this.speed -= settings.friction * this.speed * dt;
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
        settings.friction * Math.sign(this.acceleration) * dt;
    } else {
      this.speed -= settings.friction * this.speed * dt;
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
      console.log(this.name, "went out of bounds");
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
      console.log(this.name, "went back on the track");
      return this.endRun();
    }

    // Collision
    this.checkSensors();
  }

  async renderSensors() {
    return composeImage([], {
      width: Settings.singleton.trackWidth,
      height: Settings.singleton.trackHeight,
      sources: [
        {
          src: this.track?.mask || "transparent",
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
        ...Sensor.registry.get().map((sensor) => ({
          src: sensor.mask,
          position: {
            x: this.position.x - sensor.range,
            y: this.position.y - sensor.range,
          },
          rotate: this.angle * (180 / Math.PI),
          composition: "lighter" as const,
          smoothing: false,
        })),
      ],
    });
  }

  checkSensors() {
    if (!this.track || this.collided) {
      return;
    }

    // Don't read sensors too often if a previous thread is working
    if (!this.sensorsReady && Date.now() - this.sensorReadingTime < 100) {
      return;
    }

    this.sensorsReady = false;
    composeImage([], {
      width: this.track!.width,
      height: this.track!.height,
      reuse: this.sensorImage,
      clear: true,
      sources: [
        {
          src: this.track!.mask,
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
      .then((image) => {
        // Cache to avoid garbage collector pileup
        this.sensorImage = image;

        const collision = this.checkCollision(image);
        if (collision) {
          return this.endRun();
        }

        this.sensorReadings = Sensor.readAll(
          image,
          this.position.x,
          this.position.y,
          this.angle,
        );

        // Eval net using sensors
        if (this.net) {
          const outputs = this.net.eval([
            ...this.sensorReadings,
            this.acceleration,
            this.steering,
            this.speed / Settings.singleton.maxSpeed,
            this.angle / Math.PI,
          ]);
          this.acceleration = outputs[0];
          this.steering = outputs[1];
        }
      })
      .catch((err) => {
        console.error("Error reading sensors", this.name, err);
      })
      .finally(() => {
        this.sensorsReady = true;
        this.sensorReadingTime = Date.now();
      });
  }

  checkCollision(mask: ComposedImage): boolean {
    // Check if the car is crossing any of the road features
    const radius = ~~Math.max(this.width / 2, this.height / 2) + 1;
    const buffer = mask.getPixels(
      this.position.x - radius,
      this.position.y - radius,
      radius * 2,
      radius * 2,
    ).buffer;
    const lapping = buffer.some((v) =>
      Sensor.check(v, Sensor.vehicle, Sensor.lapLine),
    );
    const offTrack = buffer.some((v) =>
      Sensor.check(v, Sensor.vehicle, Sensor.offTrack),
    );

    // Crossing angle
    const a1 = this.angle;
    const a2 = this.track!.startingAngle;
    let crossAngle = Math.abs(
      (a1 < 0 ? a1 + Math.PI * 2 : a1) - (a2 < 0 ? a2 + Math.PI * 2 : a2),
    );
    if (crossAngle > Math.PI) {
      crossAngle = Math.PI * 2 - crossAngle;
    }

    // Crossing the start/finish line
    if (lapping && !this.inCrossing) {
      this.inCrossing = true;

      // Crossing in the wrong direction!
      if (crossAngle > Math.PI / 2) {
        console.log(this.name, "crossed the lap line the wrong way");
        return true;
      }

      // First crossing starts the timer instead of counting as a lap
      if (!this.startTime) {
        this.startTime = Date.now();
      } else {
        if (this.odometer < this.width + this.height) {
          console.log(this.name, "didn't complete a full lap");
          return true;
        }
        this.laps++;
      }
    } else if (!lapping && this.inCrossing) {
      this.inCrossing = false;

      // Turned around on the lap line and went the wrong way
      if (crossAngle > Math.PI / 2) {
        console.log(this.name, "turned around on the lap line");
        return true;
      }
    }

    // Went outside the track
    if (offTrack) {
      console.log(this.name, "went off track");
      return true;
    }

    return false;
  }

  manualControl() {
    if (shortcut.some("ArrowDown", "S")) {
      this.acceleration = clamp(this.acceleration - 0.1, -1, -0.1);
    } else if (shortcut.some("ArrowUp", "W")) {
      this.acceleration = clamp(this.acceleration + 0.1, 0.1, 1);
    } else {
      this.acceleration = 0;
    }

    if (shortcut.some("ArrowLeft", "A")) {
      this.steering = clamp(this.steering - 0.1, -1, -0.1);
    } else if (shortcut.some("ArrowRight", "D")) {
      this.steering = clamp(this.steering + 0.1, 0.1, 1);
    } else {
      this.steering = 0;
    }
  }
}

module Car {
  export const registry = genRegistry<Record<string, Car>>({});

  export function renderAll(context: CanvasRenderingContext2D) {
    const cars = Object.values(registry.get()).sort(
      (a, b) => b.score.score - a.score.score,
    );

    cars.forEach((car, idx) => car.render(context, idx === 0));
  }

  export function tickAll(dt: number) {
    Object.values(registry.get()).forEach((car) => car.tick(dt));

    if (Settings.singleton.autoAdvance) {
      const cars = Object.values(registry.get());
      if (cars.every((car) => car.collided || car.name === "Manual")) {
        const track = cars[0]?.track;
        if (track) {
          nextGeneration(track, false);
        }
      }
    }
  }

  export async function nextGeneration(track: Track, force = false) {
    const settings = Settings.singleton;
    const cars = registry.get();

    // Replace the manual driver if needed
    if (
      settings.manualControl &&
      (!cars["Manual"] ||
        (cars["Manual"]?.collided ?? true) ||
        (cars["Manual"]?.track?.name ?? "") !== track.name)
    ) {
      const car = new Car("Manual", "#33eeee");
      car.placeOnTrack(track);
    } else if (!settings.manualControl && cars["Manual"]) {
      delete cars["Manual"];
    }

    // Check if the run has ended
    const aiCars = Object.values(cars).filter(
      (car) => car.name !== "Manual" && car.net,
    );
    if (!force && aiCars.some((car) => !car.collided && car.track === track)) {
      return;
    }

    // End all runs
    aiCars.forEach((car) => car.endRun());
    aiCars.sort((a, b) => b.score.score - a.score.score);

    // Get the best nets to use for next generation
    const sotaNet = new Network(settings.sotaNet);
    const trackBest = aiCars[0]?.net ?? sotaNet;

    // Create new cars with mutated nets
    for (let i = 0; i < settings.numSimulations.globalBest; i++) {
      const car = new Car(`AI.globalBest.${i}`);
      car.net = sotaNet.randomStep(i === 0 ? 0 : settings.stepStdDev);
    }
    for (let i = 0; i < settings.numSimulations.trackBest; i++) {
      const car = new Car(`AI.trackBest.${i}`);
      car.net = trackBest.randomStep(settings.stepStdDev);
    }
    for (let i = 0; i < settings.numSimulations.trackRandom; i++) {
      const trackRandom =
        aiCars[Math.floor(Math.random() * aiCars.length)]?.net ?? trackBest;
      const car = new Car(`AI.trackRandom.${i}`);
      car.net = trackRandom.randomStep(settings.stepStdDev);
    }

    // Place all the cars on the track and signal update
    settings.numIterations++;
    Object.values(cars).forEach((car) => {
      if (!car.track) {
        car.placeOnTrack(track);
      }
    });
    await Promise.all(Object.values(cars).map((car) => car.fetchImageData()));
    Settings.save();
    registry.signal();
  }
}

export function useCars() {
  const cars = Car.registry.useHook();
  return Object.values(cars);
}

export default Car;
