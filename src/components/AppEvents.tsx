import { useEffect } from "react";

import Sensor from "../model/Sensor";
import Settings, { useSettings } from "../model/Settings";
import Track from "../model/Track";
import DrivingTab from "../pages/DrivingTab";
import SettingsTab from "../pages/SettingsTab";
import database from "../utils/database";
import shortcut from "../utils/shortcut";

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

AppEvents.initialize = async function () {
  await database.initialize();
  DrivingTab.init();
  SettingsTab.init();
  await Settings.load();
  await Promise.all([Track.loadAll(), Sensor.loadAll()]);
};
