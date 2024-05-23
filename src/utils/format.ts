export default function Format(
  value?: number | string | Date | undefined | null,
  options?: NumberOptions & TimeOptions & WordOptions,
): string {
  if (value == null || value == undefined || typeof value === "string") {
    return Format.word(value ?? undefined, options);
  } else if (value instanceof Date) {
    return Format.time(value.getTime(), options);
  } else if (typeof value === "number") {
    return Format.number(value, options);
  } else {
    return "";
  }
}

type NumberOptions = {
  prec?: number;
  smallPrec?: number;
  alwaysShowSign?: boolean;
};

Format.number = function (num: number, options?: NumberOptions): string {
  const prec =
    (Math.log10(Math.abs(num)) < 3 ? options?.smallPrec : options?.prec) ??
    options?.prec ??
    0;

  let r = isFinite(num) ? num.toFixed(prec) : num.toString();
  if (r && options?.alwaysShowSign && !"+-".includes(r[0]) && num >= 0) {
    r = "+" + r;
  }

  return r;
};

type TimeOptions = {
  len?: "tiny" | "short" | "long";
  millis?: boolean;
  epoch?: number;
  oxfordComma?: boolean;
  alwaysShowSign?: boolean;

  sep?: string;
  lastSep?: string;
  now?: string;
  never?: string;
  ago?: string;
};

Format.time = function (time: number, options?: TimeOptions): string {
  const len = options?.len ?? "long";
  const sep = options?.sep ?? len === "long" ? ", " : ":";
  const lastSep =
    (options?.oxfordComma ? sep : "") +
    (options?.lastSep ?? len === "long" ? " and " : sep);
  const now = options?.now ?? len === "long" ? "now" : "";
  const never = options?.never ?? len === "long" ? "never" : "";
  const ago = options?.ago ?? len === "long" ? "ago" : "";

  if (
    never &&
    (time < 0 ||
      (options?.epoch != undefined &&
        (options.epoch <= 0 || time - options.epoch < 0)))
  ) {
    return never;
  } else if (
    now &&
    (time === 0 || (options?.epoch != undefined && time === options.epoch))
  ) {
    return now;
  } else if (options?.epoch != undefined) {
    time -= options.epoch;
  }

  let secs = Math.floor(time / 1000);
  let msec = Math.floor(time - secs * 1000);

  let mins = Math.floor(secs / 60);
  secs -= mins * 60;

  let hours = Math.floor(mins / 60);
  mins -= hours * 60;

  let days = Math.floor(hours / 24);
  hours -= days * 24;

  let years = Math.floor(days / 365);
  days -= years * 365;

  if (!options?.millis) {
    msec = 0;
  }

  if (now != undefined && days + hours + mins + secs + msec === 0) {
    return now;
  }

  let parts: string[] = [];
  if (len !== "long") {
    parts = [
      years > 0 ? years.toFixed(0) : "",
      days > 0 ? days.toFixed(0) : "",
      hours > 0 || len === "short" ? hours.toFixed(0) : "",
      mins > 0 || len === "short" ? mins.toFixed(0) : "",
      (secs + msec / 1000).toFixed(
        !options?.millis || (len === "tiny" && msec === 0) ? 0 : 3,
      ),
    ].map((num) =>
      len === "short" && (num.length === 1 || num.indexOf(".") === 1)
        ? "0" + num
        : num,
    );
  } else {
    parts = (
      [
        [years, "year"],
        [days, "day"],
        [hours, "hour"],
        [mins, "minute"],
        [secs, "second", years + days + hours + mins === 0, msec],
      ] as const
    ).map(([num, word, allowZeros = false, fraction = 0]) =>
      num > 0 || fraction > 0 || (allowZeros && num === 0)
        ? num.toString() +
          (fraction > 0 ? "." + fraction.toString() : "") +
          " " +
          word +
          (num === 1 ? "" : "s")
        : "",
    );
  }

  parts = parts.filter((word) => !!word);
  if (parts.length > 2) {
    const pop = parts.pop()!;
    parts = [parts.join(sep), pop];
  }

  let r = parts.join(lastSep) + (ago ? " " + ago : "");
  if (
    r &&
    options?.alwaysShowSign &&
    time >= 0 &&
    len !== "long" &&
    !"+-".includes(r[0])
  ) {
    r = "+" + r;
  }

  return r;
};

type WordOptions = {
  name?: string;
  count?: number;
  singularName?: string;
  pluralName?: string;

  tolerance?: number;
  condition?: boolean;
  allowEmpties?: boolean;
  capitalize?: boolean;
};

Format.word = function (word?: string, options?: WordOptions): string {
  if (!word) {
    word =
      (Math.abs(Math.abs(options?.count ?? 0) - 1) <=
      (options?.tolerance ?? 0.001)
        ? options?.singularName
        : options?.pluralName) ?? options?.name;
  }

  if (!(options?.condition ?? true)) {
    return "";
  } else if (!word && !(options?.allowEmpties ?? false)) {
    return "";
  } else if (!(options?.capitalize ?? true)) {
    return word ?? "";
  } else {
    return (word ?? "")
      .replace(/([a-z])([A-Z]|_\S)/g, (_, c1, c2) => `${c1} ${c2.slice(-1)}`)
      .replace(/(?:^|\s)\w(?=\w)/g, (c) => c.toUpperCase());
  }
};
