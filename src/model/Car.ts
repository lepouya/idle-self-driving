import clamp from "../utils/clamp";
import composeImage, { ComposedImage } from "../utils/composeImage";
import { stringify } from "../utils/encoding";
import genRegistry from "../utils/registry";
import shortcut from "../utils/shortcut";
import Network from "./Network";
import Sensor from "./Sensor";
import Settings from "./Settings";
import Track from "./Track";

export default class Car {
  static registry = genRegistry<Record<string, Car>>({});
  static events: string[] = [];

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
  private crossingDistance = 0;
  private totalTicks = 0;
  public startTime = 0;
  public endTime = 0;
  public collided = false;
  private pastTracking: { x: number; y: number }[] = [];

  // Sensors
  private sensorsReady = true;
  public sensorReadingTime = 0;
  public sensorReadings: number[] = [];
  public visualizeSensors = false;

  // Network evaluation
  public net: Network | null = null;

  constructor(
    public readonly name: string,
    public color = "",
    public fudgeFactor = 0.5, // 0-1
    autoRegister = true,
  ) {
    if (!color) {
      const rgb = [32, 64, 128].map((c) =>
        clamp(~~(Math.random() * c * 2), 0, 255),
      );
      this.color =
        "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
    }

    if (name && autoRegister) {
      Car.registry.get()[name] = this;
    }
  }

  static useHook() {
    const cars = Car.registry.useHook();
    return Object.values(cars);
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

  get score(): Score {
    const now = Date.now();
    const distance = this.odometer / Math.max(this.width, this.height);
    const time = ((this.endTime || now) - (this.startTime || now)) / 1000;
    return {
      distance,
      time,
      laps: this.laps,
      success: !this.collided && this.laps >= 3 && this.startTime > 0,
      score:
        this.startTime > 0
          ? Math.max(0, distance - time) + (this.laps + 1) ** 2 * 10
          : 0,
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
    this.crossingDistance = 0;
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
    const settings = Settings.singleton;

    this.endTime = Date.now();
    if (!this.startTime) {
      this.startTime = this.endTime;
    }
    this.inCrossing = false;
    this.crossingDistance = 0;
    this.collided = collided;
    this.fetchImageData();

    if (!this.track || !this.net || this.score.score <= 0) {
      return;
    }

    // New SOTA!
    const highScore = Math.max(
      ...Object.values(settings.sotaScore).map((s) => (s ? s.score : 0)),
    );
    if (this.score.score > (highScore ?? 0)) {
      settings.sotaNet = this.net.config;
      settings.sotaScore[this.track.name] = this.score;
      Car.log(this.name, "all-time highscore");
    } else if (
      this.score.score > (settings.sotaScore[this.track.name]?.score ?? 0)
    ) {
      Car.log(this.name, "highscore on track");
      settings.sotaScore[this.track.name] = this.score;
    }
  }

  render(
    context: CanvasRenderingContext2D,
    highlight = false,
    visualizeSensors?: boolean,
  ) {
    if (!this.canvas) {
      return;
    }

    context.save();

    context.translate(~~this.position.x, ~~this.position.y);
    context.rotate(this.angle);

    if (visualizeSensors || this.visualizeSensors || this.name === "Manual") {
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

  isClickedOn(x: number, y: number) {
    const radius = Math.sqrt(this.width ** 2 + this.height ** 2) / 2;
    return (
      x > this.position.x - radius &&
      x < this.position.x + radius &&
      y > this.position.y - radius &&
      y < this.position.y + radius
    );
  }

  tick(dt: number) {
    // Don't move if collided
    if (this.collided || !this.track) {
      return;
    }

    if (this.name === "Manual") {
      this.manualControl();
    } else {
      const score = this.score;
      // Lost cause
      if (score.score < -10 || (this.totalTicks > 3 && score.score <= 0)) {
        Car.log(this.name, "not going anywhere");
        return this.endRun();
      } else if (this.totalTicks > 3 && score.score <= score.time / 2) {
        Car.log(this.name, "going too slow");
        return this.endRun();
      }
      // Successful run
      if (score.laps >= 3) {
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
      Car.log(this.name, "out of bounds");
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
      Car.log(this.name, "went back on track");
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
    return composeImage([], {
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
    if (
      lapping &&
      !this.inCrossing &&
      (this.crossingDistance == 0 || this.odometer >= this.crossingDistance + 1)
    ) {
      this.inCrossing = true;
      this.crossingDistance = this.odometer;

      // Crossing in the wrong direction!
      if (crossAngle > Math.PI / 2) {
        Car.log(this.name, "crossed the wrong way");
        return true;
      }

      // First crossing starts the timer instead of counting as a lap
      if (!this.startTime) {
        this.startTime = Date.now();
      } else {
        if (
          this.odometer <
          this.width + this.height + this.track!.roadThickness
        ) {
          Car.log(this.name, "incomplete lap");
          return true;
        }
        this.laps++;
        Car.log(this.name, "lap", this.laps, "score", ~~this.score.score);
      }
    } else if (
      !lapping &&
      this.inCrossing &&
      this.odometer >= this.crossingDistance + 1
    ) {
      this.inCrossing = false;
      this.crossingDistance = this.odometer;

      // Turned around on the lap line and went the wrong way
      if (crossAngle > Math.PI / 2) {
        Car.log(this.name, "turned around");
        return true;
      }
    }

    // Went outside the track
    if (offTrack) {
      Car.log(this.name, "went off track");
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

  /////////////

  static renderAll(context: CanvasRenderingContext2D) {
    // Render cars in order of score from lowest. That way the best car appears on top
    const cars = Object.values(Car.registry.get()).sort(
      (a, b) => a.score.score - b.score.score,
    );
    cars.forEach((car, idx) => car.render(context, idx === cars.length - 1));
  }

  static tickAll(dt: number) {
    const cars = Object.values(Car.registry.get());
    cars.forEach((car) => car.tick(dt));

    if (Settings.singleton.autoAdvance && cars[0]?.track) {
      const resetAfter = Date.now() - 1000;
      if (cars.every((car) => car.collided && car.endTime < resetAfter)) {
        Car.nextGeneration(cars[0].track, true);
      }
    }
  }

  static async nextGeneration(track: Track, force = false) {
    const settings = Settings.singleton;
    const cars = Car.registry.get();

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

    // Get the  nets to use for next generation
    const sotaNet = new Network(settings.sotaNet);
    const sotaScore = settings.sotaScore[track.name];
    const trackNet = aiCars[0]?.net ?? sotaNet;
    const trackScore = aiCars[0]?.score ?? sotaScore;
    const randomIdx = Math.floor(Math.random() * aiCars.length);
    const randomNet = aiCars[randomIdx]?.net ?? trackNet;
    const randomScore = aiCars[randomIdx]?.score ?? trackScore;

    // Create new cars with mutated nets
    for (let i = 0; i < settings.numSimulations.globalBest; i++) {
      const car = new Car(`AI.globalBest.${i}`);
      car.net = sotaNet.randomStep(i === 0 ? 0 : calcStdDev(sotaScore));
    }
    for (let i = 0; i < settings.numSimulations.trackBest; i++) {
      const car = new Car(`AI.trackBest.${i}`);
      car.net = trackNet.randomStep(
        i === 0 && trackScore?.score !== sotaScore?.score
          ? 0
          : calcStdDev(trackScore),
      );
    }
    for (let i = 0; i < settings.numSimulations.trackRandom; i++) {
      const car = new Car(`AI.trackRandom.${i}`);
      car.net = randomNet.randomStep(calcStdDev(randomScore));
    }

    // Place all the cars on the track and signal update
    settings.numIterations++;
    Car.log("Starting iteration", settings.numIterations);
    Object.values(cars).forEach((car) => {
      if (!car.track) {
        car.placeOnTrack(track);
      }
    });
    await Promise.all(Object.values(cars).map((car) => car.fetchImageData()));
    Settings.save();
    Car.registry.signal();
  }

  static log(...args: any[]) {
    const res = args
      .map((arg) => {
        if (!arg) {
          return null;
        } else if (typeof arg === "string") {
          return arg;
        } else if (typeof arg === "number") {
          return String(~~arg);
        } else {
          return stringify(arg);
        }
      })
      .filter((arg) => !!arg)
      .join(" ");
    console.log(res);
    Car.events.push(res);
    while (Car.events.length > 15) {
      Car.events.shift();
    }
  }
}

export interface Score {
  distance: number;
  time: number;
  laps: number;
  success: boolean;
  score: number;
}

function calcStdDev(score?: Score): number {
  if (!score || !score.score || !score.distance || !score.time) {
    return 1;
  }
  return clamp(Math.sqrt(10 / score.score), 0.1, 1);
}
