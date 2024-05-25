import Car from "./Car";
import Network from "./Network";
import Sensor from "./Sensor";

export class Settings {
  static singleton = new Settings();
  private constructor(..._: any[]) {}

  /// Simulation parameters

  ticksPerSecond: number = 100;
  rendersPerSecond: number = 30;
  saveFrequencySecs: number = 60;

  minUpdateSecs = 0.01;
  maxUpdateSecs = 60;
  maxTickSecs = 1;

  globalTimeDilation = 1.0;
  globalPaused = false;

  /// Execution information

  lastReset: number = Date.now();
  lastSaved: number = 0;
  lastLoaded: number = Date.now();
  lastRender: number = 0;
  lastTick?: number;

  onTickComplete?: (dt: number, source: string) => any;

  execution: Record<
    string,
    {
      lastTick: number;
      lastDelta: number;
      lastResult: any[];
      tps: number;
      fps: number;
    }
  > = {};

  /// Track configuration

  trackWidth = 800; // px
  trackHeight = 600; // px

  currentTrack = "Basic";

  /// Car configuration

  carWidth = 20; // px
  carHeight = 15; // px

  friction = 0.1; // %/s
  maxSpeed = 100; // px/s
  maxAcceleration = 25; // px/s^2
  maxSteering = Math.PI / 2; // rad/s

  manualControl = false;

  /// Sensors configuration

  sensors: Sensor.Configuration[] = [
    { index: 0, angle: 0, range: 100, width: 4 },
    { index: 1, angle: Math.PI / 6, range: 100, width: 2 },
    { index: 2, angle: -Math.PI / 6, range: 100, width: 2 },
    { index: 3, angle: Math.PI / 3, range: 100, width: 2 },
    { index: 4, angle: -Math.PI / 3, range: 100, width: 2 },
  ];

  /// Neural network configuration

  stepStdDev = 0.5;
  numIterations = 0;

  numSimulations = {
    globalBest: 4,
    trackBest: 4,
    trackRandom: 2,
  };

  sotaScore: Record<string, number> = {}; // Track name => score
  sotaNet: Network.Configuration = Network.init(
    this.sensors.length + 4, // in: sensors + [accel, steer, speed, angle]
    2, // out: [accel, steer]
    [], // init with no hidden layers
  ).config;

  /////////////

  static reset(settings?: Partial<Settings>) {
    const ss = new Settings();
    ss.load(settings);
    Settings.singleton = ss;
    return ss;
  }

  static load(settings?: Partial<Settings> | string) {
    return Settings.singleton.load(settings);
  }

  static save() {
    return Settings.singleton.save();
  }

  static tick(
    now?: number,
    source?: string,
    onSave?: () => void,
    onRender?: () => void,
  ) {
    return Settings.singleton.tick(now, source, onSave, onRender);
  }

  load(settings?: Partial<Settings> | string): this {
    if (!settings) {
      return this;
    }

    if (typeof settings === "string") {
      return this.load(JSON.parse(settings));
    }

    let k: keyof Settings;
    for (k in settings) {
      if (settings[k] == undefined || settings[k] == null) {
        continue;
      } else if (
        typeof this[k] === "object" &&
        typeof settings[k] === "object"
      ) {
        Object.assign((this as any)[k], settings[k]);
      } else {
        (this as any)[k] = settings[k];
      }
    }

    this.lastLoaded = Date.now();
    return this;
  }

  save(): Partial<Settings> {
    this.lastSaved = Date.now();
    return this;
  }

  tick(
    now: number = Date.now(),
    source: string = "unknown",
    onSave?: (settings?: this) => void,
    onRender?: (settings?: this) => void,
  ): any[] {
    // Figure out how long it's been since last tick
    const lastTick = this.lastTick ?? now;
    let dt = clamp((now - lastTick) / 1000, 0, this.maxUpdateSecs);
    if (dt < this.minUpdateSecs && this.lastTick != undefined) {
      return [];
    }

    this.lastTick = now;
    const epoch = now - dt * 1000;

    // tick all sources
    const results: Record<string, any[]> = {};
    const tickScale = 1 / 1000 / this.globalTimeDilation;
    const tps = [dt, 0];
    while (dt > 0) {
      dt -= clamp(dt, this.minUpdateSecs, this.maxTickSecs);
      tps[1]++;
      const slice = now - dt * 1000;
      const tick = (slice - lastTick!) * tickScale;

      // Delta: tick
      // Update time: slice
      if (source === "tick") {
        Car.tickAll(this.globalPaused ? 0 : tick);
      }
    }

    // Update execution status
    this.execution[source] = {
      lastTick: now,
      lastDelta: (now - epoch) / 1000,
      lastResult: Object.values(results)
        .flat()
        .filter((value, index, self) => self.indexOf(value) === index),
      tps: (this.execution[source]?.tps || 0) * 0.9 + (tps[1] / tps[0]) * 0.1,
      fps: this.execution[source]?.fps || 0,
    };

    // Call the onUpdateComplete callback
    if (this.onTickComplete) {
      this.onTickComplete((now - epoch) / 1000, source);
    }

    // Callbacks for save and render in main loop
    if (
      onSave &&
      this.lastTick - this.lastSaved >= this.saveFrequencySecs * 1000 &&
      this.lastTick - this.lastLoaded >= this.saveFrequencySecs * 1000
    ) {
      this.lastSaved = this.lastTick;
      onSave(this);
    }

    if (
      onRender &&
      this.lastTick - this.lastRender >= 1000.0 / this.rendersPerSecond
    ) {
      this.execution[source].fps =
        (this.execution[source].fps || 0) * 0.9 +
        (1000.0 / (this.lastTick - this.lastRender)) * 0.1;
      this.lastRender = this.lastTick;
      onRender(this);
    }

    return this.execution[source].lastResult;
  }
}

export function clamp(n = 0, min = 0, max = 1): number {
  if (isNaN(n)) {
    return min;
  } else if (n < min) {
    return min;
  } else if (n > max) {
    return max;
  } else {
    return n;
  }
}
