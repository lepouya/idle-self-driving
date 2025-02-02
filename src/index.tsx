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

import { ComponentType, StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { IonApp as IonApp_FIXME, setupIonicReact } from "@ionic/react";

import AppEvents from "./components/AppEvents";
import TabApp from "./components/TabApp";

const IonApp = IonApp_FIXME as ComponentType<any>;

setupIonicReact();

window.addEventListener(
  "load",
  async () => {
    const div = document.createElement("div");
    div.id = "root";
    document.body.appendChild(div);
    const root = createRoot(div);

    await AppEvents.initialize();

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
