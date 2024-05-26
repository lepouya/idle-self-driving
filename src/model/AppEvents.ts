import { useEffect } from "react";

import database from "../utils/database";
import shortcut from "../utils/shortcut";
import Settings, { useSettings } from "./Settings";

export default function AppEvents() {
  const settings = useSettings();

  useEffect(() => {
    shortcut.addEventListeners();
    database.initialize();
    return () => shortcut.removeEventListeners();
  }, []);

  useEffect(() => {
    Settings.addTickTimer();
    return () => Settings.removeTickTimer();
  }, [settings.ticksPerSec]);

  return null;
}
