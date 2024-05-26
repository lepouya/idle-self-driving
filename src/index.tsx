/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";
/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";
import "@ionic/react/css/palettes/dark.system.css";
/* Theme variables */
import "./theme.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { IonApp, setupIonicReact } from "@ionic/react";

import AppEvents from "./model/AppEvents";
import Sensor from "./model/Sensor";
import Settings from "./model/Settings";
import Track from "./model/Track";
import DrivingTab from "./pages/DrivingTab";
import SettingsTab from "./pages/SettingsTab";
import TabApp from "./pages/TabApp";
import database from "./utils/database";

setupIonicReact();

const div = document.createElement("div");
div.id = "root";
document.body.appendChild(div);
const root = createRoot(div);

window.addEventListener(
  "load",
  async () => {
    await database.initialize();
    DrivingTab.init();
    SettingsTab.init();
    await Settings.load();
    await Promise.all([Track.loadAll(), Sensor.loadAll()]);

    root.render(
      <StrictMode>
        <IonApp>
          <AppEvents />
          <TabApp />
        </IonApp>
      </StrictMode>,
    );
  },
  false,
);
