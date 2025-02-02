import clamp from "../utils/clamp";
import database from "../utils/database";
import genRegistry from "../utils/registry";
import Car, { Score } from "./Car";
import Network from "./Network";

export default class Settings {
  static singleton = new Settings();
  static registry = genRegistry(() => Settings.singleton);

  constructor(settings?: Partial<Settings> | string) {
    Settings.singleton = this;
    this.load(settings);
  }

  /// Simulation parameters

  ticksPerSec = 100;
  rendersPerSec = 30;
  saveFrequencySecs = 10;

  minUpdateSecs = 0.01;
  maxUpdateSecs = 0.25;
  maxTickSecs = 0.1;

  globalTimeDilation = 1.0;
  globalPaused = false;

  /// Execution information

  lastReset = Date.now();
  lastSaved = 0;
  lastLoaded = Date.now();
  lastRender = 0;
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

  helpDismissed?: boolean;

  /// Track configuration

  trackWidth = 800; // px
  trackHeight = 600; // px

  currentTrack = "Basic";

  autoAdvance = false;

  /// Car configuration

  carWidth = 20; // px
  carHeight = 15; // px

  friction = 0.1; // %/s
  maxSpeed = 100; // px/s
  maxAcceleration = 25; // px/s^2
  maxSteering = Math.PI / 2; // rad/s

  manualControl = false;

  /// Sensors configuration

  renderSensors = false;

  sensors = [
    { range: 100, angle: 0 },
    { range: 100, angle: Math.PI / 6 },
    { range: 100, angle: -Math.PI / 6 },
    { range: 100, angle: Math.PI / 3 },
    { range: 100, angle: -Math.PI / 3 },
  ];

  /// Neural network configuration

  numIterations = 0;

  numSimulations = {
    globalBest: 4,
    trackBest: 4,
    trackRandom: 2,
  };

  sotaScore: Record<string, Score> = {}; // Track name => score
  sotaNet = Network.init(
    this.sensors.length + 4, // in: sensors + [accel, steer, speed, angle]
    2, // out: [accel, steer]
    [], // init with no hidden layers
  ).config;

  /////////////

  static isDebug(): boolean {
    return window.location.href.toLowerCase().includes("debug");
  }

  static useHook() {
    return Settings.registry.useHook();
  }

  static set(state: Partial<Settings>) {
    return Settings.singleton.set(state);
  }

  static tick(now?: number, source?: string) {
    return Settings.singleton.tick(
      now,
      source,
      Settings.save,
      Settings.registry.signal,
    );
  }

  static async save() {
    Settings.singleton.tick(undefined, "save");
    const res = await database.write("Settings", Settings.singleton.save());
    Settings.registry.signal();
    return res;
  }

  static async load() {
    Settings.singleton.load(await database.read("Settings"));
    Settings.singleton.tick(undefined, "load");
    Settings.registry.signal();
    return Settings.singleton;
  }

  static reset(settings?: Partial<Settings>) {
    Settings.singleton = new Settings(settings);
    return Settings.singleton;
  }

  /////////////

  private timer: NodeJS.Timeout | null = null;

  static addTickTimer() {
    Settings.removeTickTimer();
    const newTimerId = setInterval(
      () => Settings.tick(undefined, "tick"),
      1000.0 / Settings.singleton.ticksPerSec,
    );
    Settings.singleton.timer = newTimerId;
  }

  static removeTickTimer() {
    if (Settings.singleton.timer) {
      clearInterval(Settings.singleton.timer);
    }
    Settings.singleton.timer = null;
  }

  /////////////

  set(settings: Partial<Settings>): this {
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

    Settings.registry.signal();
    return this;
  }

  load(settings?: Partial<Settings> | string): this {
    if (!settings) {
      return this;
    } else if (typeof settings === "string") {
      return this.load(JSON.parse(settings));
    }

    this.set(settings);
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
    const tickScale = 1 / this.globalTimeDilation;
    const tps = [dt, 1];
    while (dt > 0) {
      const tick = clamp(dt, this.minUpdateSecs, this.maxTickSecs);
      // tps[1]++;
      dt -= tick;
      if (source === "tick") {
        Car.tickAll(this.globalPaused ? 0 : tick * tickScale);
      }
    }

    // Update execution status
    this.execution[source] = {
      lastTick: now,
      lastDelta: (now - epoch) / 1000,
      lastResult: Object.values(results)
        .flat()
        .filter((value, index, self) => self.indexOf(value) === index),
      tps: (this.execution[source]?.tps || 0) * 0.8 + (tps[1] / tps[0]) * 0.2,
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
      this.lastTick - this.lastRender >= 1000.0 / this.rendersPerSec
    ) {
      this.execution[source].fps =
        (this.execution[source].fps || 0) * 0.8 +
        (1000.0 / (this.lastTick - this.lastRender)) * 0.2;
      this.lastRender = this.lastTick;
      onRender(this);
    }

    return this.execution[source].lastResult;
  }
}
