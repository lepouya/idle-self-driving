// Inspired by github:antimatter-dimensions/notations

export type Notation = {
  name: string;

  infinite(): string;
  decimal(value: number, prec?: number, expPrec?: number): string;
  small(value: number, prec?: number): string;
  verySmall(value: number, prec?: number): string;
  negativeVerySmall(value: number, prec?: number): string;
  negativeSmall(value: number, prec?: number): string;
  negativeDecimal(value: number, prec?: number, expPrec?: number): string;
  negativeInfinite(): string;

  exponent?: (n: number, prec?: number, expPrec?: number) => string;
};

export default function formatWithNotation(
  value: number,
  notation?: Notation | string,
  basePrec = 0,
  expPrec = basePrec,
  smallPrec = 0,
): string {
  notation =
    (typeof notation === "string" ? notations[notation] : notation) ?? basic;
  if (!isFinite(value)) {
    return Math.sign(value) < 0
      ? notation.negativeInfinite()
      : notation.infinite();
  } else if (Math.log10(value) < -100) {
    return Math.sign(value) < 0
      ? notation.negativeVerySmall(Math.abs(value), smallPrec)
      : notation.verySmall(value, smallPrec);
  } else if (Math.log10(value) < 3) {
    return Math.sign(value) < 0
      ? notation.negativeSmall(Math.abs(value), smallPrec)
      : notation.small(value, smallPrec);
  }
  return Math.sign(value) < 0
    ? notation.negativeDecimal(Math.abs(value), basePrec, expPrec)
    : notation.decimal(value, basePrec, expPrec);
}

const notations: Record<string, Notation> = {};
const settings = { prec: 3, commas: { show: true, min: 1e6, max: 1e9 } };
formatWithNotation.all = notations;
formatWithNotation.exponentSettings = settings;
formatWithNotation.register = (notation: Partial<Notation>) =>
  (notations[notation.name ?? ""] = { ...basic, ...notation });

const basic: Notation = {
  name: "System",
  infinite() {
    return Infinity.toString();
  },
  negativeInfinite() {
    return `-${this.infinite()}`;
  },
  decimal(v, p, e) {
    return v.toFixed(p ?? e ?? 0);
  },
  negativeDecimal(v, p, e) {
    return `-${this.decimal(v, p, e)}`;
  },
  verySmall(v, p) {
    return this.small(v, p);
  },
  negativeVerySmall(v, p) {
    return `-${this.verySmall(v, p)}`;
  },
  small(v, p) {
    return v.toFixed(p);
  },
  negativeSmall(v, p) {
    return `-${this.small(v, p)}`;
  },
};

formatWithNotation.register(basic);
const standard = formatWithNotation.register({
  name: "Standard",
  decimal(v, p, e) {
    this.exponent ??= formatWithExp(standardAbbr, 1, 1000);
    return this.exponent(v, p, e);
  },
});

const registerMixed = (n: Notation, s = standard) =>
  formatWithNotation.register({
    name: `Mixed ${n.name}`,
    decimal: (v, p, e) => (Math.log10(v) < 33 ? s : n).decimal(v, p, e),
  });

registerMixed(
  formatWithNotation.register({
    name: "Scientific",
    decimal(v, p, e) {
      this.exponent ??= formatWithExp(formatWithCommas(this), 1);
      return this.exponent(v, p, e);
    },
  }),
);

registerMixed(
  formatWithNotation.register({
    name: "Engineering",
    decimal(v, p, e) {
      this.exponent ??= formatWithExp(formatWithCommas(this), 3);
      return this.exponent(v, p, e);
    },
  }),
);

registerMixed(
  formatWithNotation.register({
    name: "Logarithmic",
    decimal(v, p, e) {
      this.exponent ??= formatWithCommas(this, (n, p) => n.toFixed(p));
      return `e${this.exponent(Math.log10(v), p, e)}`;
    },
  }),
);

const abbrs = {
  abbreviations: ["K", "M", "B", "T", "Qa", "Qt", "Sx", "Sp", "Oc", "No"],
  prefixes: [
    ["", "U", "D", "T", "Qa", "Qt", "Sx", "Sp", "O", "N"],
    ["", "Dc", "Vg", "Tg", "Qd", "Qi", "Se", "St", "Og", "Nn"],
    ["", "Ce", "Dn", "Tc", "Qe", "Qu", "Sc", "Si", "Oe", "Ne"],
  ],
  prefixes_2: ["", "MI-", "MC-", "NA-", "PC-", "FM-", "AT-", "ZP-"],
};

function standardAbbr(rawExp: number): string {
  const exp = rawExp - 1;
  if (exp === -1) {
    return "";
  } else if (exp > settings.commas.min) {
    return Infinity.toString();
  } else if (exp < abbrs.abbreviations.length) {
    return abbrs.abbreviations[exp];
  }
  const prefix = [];
  for (let e = exp; e > 0; e = Math.floor(e / 10)) {
    prefix.push(abbrs.prefixes[prefix.length % 3][e % 10]);
  }
  while (prefix.length % 3 !== 0) {
    prefix.push("");
  }
  let abbr = "";
  for (let i = prefix.length / 3 - 1; i >= 0; i--) {
    abbr += prefix.slice(i * 3, i * 3 + 3).join("") + abbrs.prefixes_2[i];
  }
  return abbr
    .replace(/-[A-Z]{2}-/g, "-")
    .replace(/U([A-Z]{2}-)/g, "$1")
    .replace(/-$/, "");
}

function formatWithCommas(
  notation: Partial<Notation>,
  formatting: (n: number, p: number) => string = (n) => n.toString(),
): (e: number, prec?: number, expPrec?: number) => string {
  return function (e, prec = settings.prec, expPrec = Math.max(2, prec)) {
    if (e < settings.commas.min) {
      return formatting(e, Math.max(prec, 1));
    } else if (settings.commas.show && e < settings.commas.max) {
      const decimalPointSplit = formatting(e, 0).split(".");
      decimalPointSplit[0] = decimalPointSplit[0].replace(/\w+$/g, (v) =>
        Array.from(Array(Math.ceil(v.length / 3)))
          .map((_, i) => (i ? v.slice(-3 * (i + 1), -3 * i) : v.slice(-3)))
          .reverse()
          .join(","),
      );
      return decimalPointSplit.join(".");
    }
    return notation.decimal!(e, expPrec, expPrec);
  };
}

function formatWithExp(
  expFormat: (e: number, prec: number) => string,
  steps: number,
  base: number = 10,
): (n: number, prec?: number, expPrec?: number) => string {
  return function (n, prec = 0, expPrec = 0) {
    const realBase = base ** steps;
    let exponent = Math.floor(Math.log(n) / Math.log(realBase)) * steps;
    if (base >= 100) {
      exponent = Math.max(exponent, 0);
    }
    let m = (n / base ** exponent).toFixed(prec);
    if (m === realBase.toFixed(prec)) {
      m = (1).toFixed(prec);
      exponent = exponent + steps;
    }
    if (exponent === 0) {
      return m;
    }
    return `${m}${base === 10 ? "e" : " "}${expFormat(exponent, expPrec)}`;
  };
}
