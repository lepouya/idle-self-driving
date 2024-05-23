export function codec(s: string): string {
  if (codec.skipEncoding || !s) {
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

codec.skipEncoding = false;

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
  const data = stringify(value, pretty ? 2 : undefined);
  if (!pretty) {
    return window.btoa(codec(encodeURIComponent(data)));
  }
  return data;
}

export function decode<T>(data: string): T | undefined {
  if (!data || typeof data !== "string") {
    return (data as T) ?? undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(codec(window.atob(data))));
    if (parsed) {
      return parsed;
    }
  } catch {}
  try {
    const parsed = JSON.parse(data);
    if (parsed) {
      return parsed;
    }
  } catch {}

  return data as T;
}
