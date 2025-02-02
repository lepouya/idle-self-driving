import { ComponentType, Fragment, ReactNode } from "react";
import { Redirect, Route } from "react-router-dom";

import {
  IonChip,
  IonContent,
  IonHeader,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton as IonTabButton_FIXME,
  IonTabs as IonTabs_FIXME,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { IonReactHashRouter } from "@ionic/react-router";

import genRegistry from "../utils/registry";
import Icon from "./Icon";

const IonTabs = IonTabs_FIXME as ComponentType<any>;
const IonTabButton = IonTabButton_FIXME as ComponentType<any>;

type TabProps = {
  path: string;
  content: ReactNode;
  alwaysMounted?: boolean;

  icon?: string;
  label?: string;
  title?: string;

  from?: string;
};

export default function TabApp() {
  const tabs = TabApp.useTabs();
  const urlQuery = window.location.search || "";

  return (
    <IonReactHashRouter>
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
                <IonContent id="tab-contents">{tab.content}</IonContent>
                {tabs
                  .filter((t) => t.alwaysMounted && t !== tab)
                  .map((t) => (
                    <Fragment key={`page-${t.path}`}>{t.content}</Fragment>
                  ))}
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
    </IonReactHashRouter>
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
