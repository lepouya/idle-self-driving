export type ShortcutCallback = (event: KeyboardEvent) => boolean;

export default function shortcut(key: string, callback: ShortcutCallback) {
  shortcut.register(key, callback);
}

shortcut.register = function (key: string, callback: ShortcutCallback) {
  key = key.toLowerCase().replace(/\W/g, "");
  shortcuts[key] ??= [];
  if (!shortcuts[key].includes(callback)) {
    shortcuts[key].push(callback);
  }
};

shortcut.addEventListeners = function () {
  document.addEventListener("keydown", keyDown);
  document.addEventListener("keyup", keyUp);
  resetKeys();
};

shortcut.removeEventListeners = function () {
  document.removeEventListener("keydown", keyDown);
  document.removeEventListener("keyup", keyUp);
  resetKeys();
};

shortcut.test = function (key: string): boolean {
  return keyMap[key.toLowerCase().replace(/\W/g, "")] ?? false;
};

shortcut.some = function (...keys: string[]): boolean {
  return keys.some(shortcut.test);
};

shortcut.all = function (...keys: string[]): boolean {
  return keys.every(shortcut.test);
};

const BLOCKED_DOM_ELEMS = ["TEXTAREA", "INPUT"];
const shortcuts: Record<string, ShortcutCallback[]> = {};
const keyMap: Record<string, boolean> = {};

function keyDown(event: KeyboardEvent) {
  if (isElemBlocked(event.target)) {
    return;
  }

  const key = event.key.toLowerCase().replace(/\W/g, "");
  keyMap[key] = true;

  const callbacks = shortcuts[key];
  if (callbacks && callbacks.length > 0) {
    callbacks.forEach((cb) => {
      if (cb(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }
}

function keyUp(event: KeyboardEvent) {
  if (isElemBlocked(event.target)) {
    return;
  }

  const key = event.key.toLowerCase().replace(/\W/g, "");
  keyMap[key] = false;
}

function resetKeys() {
  Object.keys(keyMap).forEach((key) => (keyMap[key] = false));
}

function isElemBlocked(target: EventTarget | null) {
  try {
    return (
      target &&
      BLOCKED_DOM_ELEMS.includes((target as HTMLElement).tagName.toUpperCase())
    );
  } catch (_) {
    return false;
  }
}
