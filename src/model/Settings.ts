export class Settings {
  static singleton = new Settings();
  private constructor(..._: any[]) {}

  ticksPerSecond: number = 50;
  rendersPerSecond: number = 10;
  saveFrequencySecs: number = 60;

  lastReset: number = Date.now();
  lastSaved: number = 0;
  lastLoaded: number = Date.now();
  lastRender: number = 0;
  lastTick?: number;

  minUpdateSecs = 0.001;
  maxUpdateSecs = 24 * 60 * 60;
  maxTickSecs = 1;

  globalTimeDilation = 1.0;
  globalNumberFormat?: string;

  onTickComplete?: (dt: number, source: string) => any;

  execution: Record<
    string,
    {
      lastTick: number;
      lastDelta: number;
      lastResult: any[];
    }
  > = {};

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
      } else if (k === "execution") {
        Object.assign(this[k], settings[k]);
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
    let dt = clamp(
      (now - (this.lastTick ?? now)) / 1000,
      0,
      this.maxUpdateSecs,
    );
    if (dt < this.minUpdateSecs && this.lastTick != undefined) {
      return [];
    }

    const lastTick = this.lastTick ?? now;
    this.lastTick = now;
    const epoch = now - dt * 1000;

    // tick all sources
    const results: Record<string, any[]> = {};
    const tickScale = 1 / 1000 / this.globalTimeDilation;
    while (dt > 0) {
      dt -= clamp(dt, this.minUpdateSecs, this.maxTickSecs);
      const slice = now - dt * 1000;
      const tick = (slice - lastTick!) * tickScale;

      // Delta: tick
      // Update time: slice
      results["__Settings_slices"] = [
        ...(results["__Settings_slices"] || []),
        slice,
      ];
      results["__Settings_ticks"] = [
        ...(results["__Settings_ticks"] || []),
        tick,
      ];
    }

    // Update execution status
    this.execution[source] = {
      lastTick: now,
      lastDelta: (now - epoch) / 1000,
      lastResult: Object.values(results)
        .flat()
        .filter((value, index, self) => self.indexOf(value) === index),
    };

    // Call the onUpdateComplete callback
    if (this.onTickComplete) {
      const updateResult = this.onTickComplete((now - epoch) / 1000, source);
      if (updateResult) {
        results["__Settings_onUpdateComplete"] = [updateResult];
      }
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
