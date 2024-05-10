import { ReactNode, useCallback, useEffect, useState } from "react";

import { Storage } from "@ionic/storage";

import { decode, encode } from "../utils/encoding";
import genRegistry from "../utils/registry";
import { Settings as S } from "./Settings";

function App() {
  const [, setTimerId] = useState<NodeJS.Timeout | undefined>();
  const settings = App.useSettings();

  useEffect(() => {
    document.addEventListener("keydown", App.ShortCut.keyDown);
    App.ShortCut.resetKeys();
    return () => {
      document.removeEventListener("keydown", App.ShortCut.keyDown);
      App.ShortCut.resetKeys();
    };
  }, []);

  useEffect(() => {
    document.addEventListener("keyup", App.ShortCut.keyUp);
    App.ShortCut.resetKeys();
    return () => {
      document.removeEventListener("keyup", App.ShortCut.keyUp);
      App.ShortCut.resetKeys();
    };
  }, []);

  useEffect(() => {
    App.Database.initialize();
  }, []);

  const clearTimers = useCallback(
    (...timers: (NodeJS.Timeout | undefined)[]) => {
      timers.forEach((t) => clearInterval(t));
      setTimerId((timerId) => {
        clearInterval(timerId);
        return undefined;
      });
    },
    [setTimerId],
  );

  useEffect(
    function () {
      clearTimers();
      const newTimerId = setInterval(function () {
        S.tick(undefined, "tick", App.Settings.save, App.Settings.signalUpdate);
      }, 1000.0 / settings.ticksPerSecond);
      setTimerId(newTimerId);

      return () => {
        clearTimers(newTimerId);
      };
    },
    [settings.ticksPerSecond, clearTimers, setTimerId],
  );

  return null;
}

module App {
  export module ShortCut {
    const BLOCKED_DOM_ELEMS = ["TEXTAREA", "INPUT"];
    type ShortcutCallback = (event: KeyboardEvent) => boolean;
    const shortcuts: Record<string, ShortcutCallback[]> = {};
    const keyMap: Record<string, boolean> = {};

    function registerShortcut(key: string, callback: ShortcutCallback) {
      key = key.toLowerCase().replace(/\W/g, "");
      shortcuts[key] ??= [];
      if (!shortcuts[key].includes(callback)) {
        shortcuts[key].push(callback);
      }
    }

    function isElemBlocked(target: EventTarget | null) {
      try {
        return (
          target &&
          BLOCKED_DOM_ELEMS.includes(
            (target as HTMLElement).tagName.toUpperCase(),
          )
        );
      } catch (_) {
        return false;
      }
    }

    export function keyDown(event: KeyboardEvent) {
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

    export function keyUp(event: KeyboardEvent) {
      if (isElemBlocked(event.target)) {
        return;
      }

      const key = event.key.toLowerCase().replace(/\W/g, "");
      keyMap[key] = false;
    }

    export function testKey(key: string): boolean {
      return keyMap[key.toLowerCase().replace(/\W/g, "")] ?? false;
    }

    export function resetKeys() {
      Object.keys(keyMap).forEach((key) => (keyMap[key] = false));
    }

    export function register(key: string, callback: ShortcutCallback) {
      registerShortcut(key, callback);
    }
  }

  export module Tab {
    type TabProps = {
      path: string;
      content: ReactNode;

      icon?: string;
      label?: string;
      title?: string;

      from?: string;
    };
    const tabRegistry = genRegistry<Record<string, TabProps>>({});

    export const useTabs = tabRegistry.useHook;

    export function register(tab: TabProps) {
      tabRegistry.get()[tab.path] = tab;
      tabRegistry.signal();
    }

    export function unregister(tab: TabProps | string) {
      delete tabRegistry.get()[typeof tab === "string" ? tab : tab.path];
      tabRegistry.signal();
    }
  }

  export module Database {
    const storage = { db: undefined as Storage | undefined };

    export async function initialize() {
      if (!storage.db) {
        storage.db = new Storage();
        storage.db = await storage.db.create();
      }
      return storage.db;
    }

    export function getStorage() {
      initialize();
      return storage.db;
    }

    export async function write<T>(key: string, value: T, pretty = false) {
      let data = encode(value, pretty);
      await initialize();
      return await storage.db?.set(key, data);
    }

    export async function read<T>(key: string): Promise<T | undefined> {
      await initialize();
      const data = await storage.db?.get(key);
      return decode(data);
    }

    export async function clear() {
      await initialize();
      await storage.db?.clear();
    }
  }

  export module Settings {
    const settingsRegistry = genRegistry(() => S.singleton);

    export const useHook = settingsRegistry.useHook;
    export const signalUpdate = settingsRegistry.signal;

    export async function save(debug = false) {
      const settings = settingsRegistry.get();
      settings.tick(undefined, "save");
      return await Database.write("Settings", settings.save(), debug);
    }

    export async function load() {
      const settings = settingsRegistry.get();
      settings.load(await Database.read("Settings"));
      settings.tick(undefined, "load");
      settingsRegistry.signal();
      return settings;
    }
  }

  export function useTabs() {
    const tabs = Tab.useTabs();
    return Object.values(tabs);
  }

  export function useDatabase() {
    return Database.getStorage();
  }

  export function useSettings() {
    return Settings.useHook();
  }

  export function isKeyDown(...keys: string[]): boolean {
    return keys.some(ShortCut.testKey);
  }

  export function areAllKeysDown(...keys: string[]): boolean {
    return keys.every(ShortCut.testKey);
  }
}

export default App;
