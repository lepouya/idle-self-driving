import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { useIonViewDidEnter, useIonViewWillLeave } from "@ionic/react";

export default function genRegistry<T>(props: T | (() => T)) {
  const registry: Record<string, Dispatch<SetStateAction<{ ref: T }>>> = {};

  function get(): T {
    if (typeof props === "function") {
      return (props as any)();
    } else {
      return props;
    }
  }

  function getNewId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(1);
  }

  function register(
    fn: Dispatch<SetStateAction<{ ref: T }>>,
    oldId?: string,
  ): string {
    const id = oldId || getNewId();
    registry[id] = fn;
    return id;
  }

  function unregister(id: string) {
    delete registry[id];
  }

  function getRegistry() {
    return registry;
  }

  function signal() {
    const v = { ref: get() };
    Object.values(registry).forEach((fn) => fn(v));
  }

  function useHook() {
    const [id, setId] = useState(getNewId);
    const [ref, setRef] = useState(() => ({ ref: get() }));

    useEffect(() => {
      const handle = register(setRef, id);
      setId(handle);
      return () => {
        unregister(id);
        unregister(handle);
      };
    }, [id]);

    useIonViewDidEnter(() => {
      const handle = register(setRef, id);
      setId(handle);
    }, [id]);

    useIonViewWillLeave(() => {
      unregister(id);
    }, [id]);

    return ref.ref;
  }

  return { useHook, signal, register, unregister, getRegistry, get };
}
