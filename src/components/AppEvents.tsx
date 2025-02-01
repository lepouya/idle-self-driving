import { useEffect } from "react";

import Sensor from "../model/Sensor";
import Settings from "../model/Settings";
import Track from "../model/Track";
import DrivingTab from "../pages/DrivingTab";
import HelpPage from "../pages/HelpPage";
import SettingsTab from "../pages/SettingsTab";
import database from "../utils/database";
import shortcut from "../utils/shortcut";

export default function AppEvents() {
  const settings = Settings.useHook();

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
  await Settings.load();
  await Promise.all([DrivingTab.init(), SettingsTab.init(), HelpPage.init()]);
  await Promise.all([Track.loadAll(), Sensor.loadAll()]);
};
