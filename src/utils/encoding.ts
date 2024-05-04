let skipEncoding = false;
export function codec(s: string): string {
  if (skipEncoding || !s) {
    return s;
  }

  const h = s.startsWith("..");
  const c = (h ? s : Math.random().toString(36)).substring(2, 10);
  return (
    (h ? "" : ".." + c) +
    (h ? s.slice(10) : s)
      .split("")
      .map((s) => s.charCodeAt(0))
      .map((s, i) => String.fromCharCode(s ^ c.charCodeAt(i % 8)))
      .join("")
  );
}

export function stringify<T>(value: T, space?: string | number | undefined) {
  const seen: any[] = [];
  function replacer(k: string, v: any) {
    if (k && k.startsWith("_")) {
      return undefined;
    } else if (!v || typeof v !== "object" || Array.isArray(v)) {
      return v;
    } else if (v instanceof Date) {
      return v.toJSON();
    } else if (Object.keys(v).length === 0) {
      // No need to save empty records
      return undefined;
    } else if (seen.includes(v)) {
      // Circular reference found, discard key
      return undefined;
    } else {
      seen.push(v);
      return v;
    }
  }

  return JSON.stringify(value, replacer, space);
}

export function encode<T>(value: T, pretty = false) {
  let data = stringify(value, pretty ? 2 : undefined);
  if (!pretty) {
    data = encodeURIComponent(data);
    data = codec(data);
    data = window.btoa(data);
  }
  return data;
}

export function decode<T>(data: string): T | undefined {
  if (!data || typeof data !== "string") {
    return (data as T) ?? undefined;
  }

  let parsed: T | undefined = undefined;
  if (!parsed) {
    try {
      parsed = JSON.parse(decodeURIComponent(codec(window.atob(data))));
    } catch {
      parsed = undefined;
    }
  }
  if (!parsed) {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = undefined;
    }
  }
  if (!parsed) {
    parsed = data as T;
  }

  return parsed;
}
