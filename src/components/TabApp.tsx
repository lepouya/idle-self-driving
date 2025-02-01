import { ReactNode, useEffect, useState } from "react";
import { Redirect, Route } from "react-router-dom";

import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonLabel,
  IonPage,
  IonPopover,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";

import Settings from "../model/Settings";
import HelpPage from "../pages/HelpPage";
import genRegistry from "../utils/registry";
import Icon from "./Icon";

type TabProps = {
  path: string;
  content: ReactNode;

  icon?: string;
  label?: string;
  title?: string;

  from?: string;
};

export default function TabApp() {
  const tabs = TabApp.useTabs();
  const settings = Settings.singleton;
  const [showHelp, setShowHelp] = useState(!settings.helpDismissed);
  const urlQuery = window.location.search || "";

  useEffect(() => {
    settings.set({ helpDismissed: !showHelp });
  }, [showHelp, setShowHelp]);

  return (
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          {tabs.map((tab) => (
            <Route exact path={`/${tab.path}`} key={`tab-${tab.path}`}>
              <IonPage>
                <IonHeader>
                  <IonToolbar>
                    <IonTitle slot="start">{tab.title || tab.path}</IonTitle>
                    <IonChip slot="end" color="success">
                      &#169; 2025 &nbsp;
                      <a
                        href="https://github.com/lepouya"
                        target="_blank"
                        style={{ textDecoration: "none" }}
                      >
                        @lepouya
                      </a>
                    </IonChip>
                    <IonChip slot="end" color="light">
                      <a
                        href="https://github.com/lepouya/idle-self-driving"
                        target="_blank"
                        style={{ textDecoration: "none" }}
                      >
                        <small>view source</small>
                      </a>
                    </IonChip>
                  </IonToolbar>
                </IonHeader>
                <IonContent id="tab-page">{tab.content}</IonContent>
                <IonPopover
                  trigger={showHelp ? "tab-page" : undefined}
                  isOpen={showHelp}
                  showBackdrop={true}
                  side="start"
                  alignment="start"
                  onDidDismiss={() => setShowHelp(false)}
                >
                  <IonContent class="ion-padding">
                    <HelpPage />
                    <IonButton onClick={() => setShowHelp(false)}>
                      Close
                    </IonButton>
                  </IonContent>
                </IonPopover>
              </IonPage>
            </Route>
          ))}
          {tabs
            .filter((tab) => !!tab.from)
            .map((tab) => (
              <Route exact path={tab.from} key={`default-tab-${tab.path}`}>
                <Redirect to={`/${tab.path}${urlQuery}`} />
              </Route>
            ))}
        </IonRouterOutlet>
        <IonTabBar slot="bottom">
          {tabs.map(
            (tab) =>
              (tab.icon || tab.label) && (
                <IonTabButton
                  tab={tab.path}
                  href={`/${tab.path}${urlQuery}`}
                  key={`tab-button-${tab.path}`}
                >
                  {tab.icon && <Icon aria-hidden="true" icon={tab.icon} />}
                  {tab.label && <IonLabel>{tab.label}</IonLabel>}
                </IonTabButton>
              ),
          )}
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  );
}

const registry = genRegistry<Record<string, TabProps>>({});

TabApp.register = function (tab: TabProps) {
  registry.get()[tab.path] = tab;
  registry.signal();
};

TabApp.unregister = function (tab: TabProps | string) {
  delete registry.get()[typeof tab === "string" ? tab : tab.path];
  registry.signal();
};

TabApp.useTabs = function () {
  const tabs = registry.useHook();
  return Object.values(tabs);
};
