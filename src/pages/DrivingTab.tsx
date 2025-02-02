import * as Icons from "ionicons/icons";
import { useEffect, useRef } from "react";

import {
  IonButton,
  IonCol,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from "@ionic/react";

import TabApp from "../components/TabApp";
import Car from "../model/Car";
import Settings from "../model/Settings";
import Track from "../model/Track";
import Format from "../utils/format";

export default function DrivingTab() {
  const settings = Settings.useHook();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = Track.useHook();
  const cars = Car.useHook();

  const track = tracks[settings.currentTrack];

  useEffect(() => {
    Car.nextGeneration(track, false);
  }, [track]);

  useEffect(() => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext("2d", { alpha: false })!;
      if (settings.renderSensors) {
        cars[0]?.renderSensors().then((mask) => {
          context.clearRect(0, 0, settings.trackWidth, settings.trackHeight);
          context.resetTransform();
          context.drawImage(mask.canvas!, 0, 0);
        });
      } else {
        track.render(context);
        Car.renderAll(context);
      }
    }
  }, [settings.currentTrack, canvasRef.current, settings.lastRender]);

  const highScore = Math.max(...cars.map((car) => car.score.score)) || 0;
  const activeCars = cars.filter((car) => !car.collided).length;

  return (
    <IonGrid>
      <IonRow>
        <IonCol size="8">
          <canvas
            ref={canvasRef}
            width={`${settings.trackWidth}px`}
            height={`${settings.trackHeight}px`}
          ></canvas>
        </IonCol>
        <IonCol size="4">
          <IonItem>
            <IonLabel>Iteration {settings.numIterations}</IonLabel>
            <IonButton
              slot="end"
              expand="block"
              title="Skip to next iteration"
              onClick={() => Car.nextGeneration(track, true)}
            >
              <IonIcon icon={Icons.playSkipForwardOutline} />
            </IonButton>
            <IonButton
              slot="end"
              expand="block"
              color={settings.autoAdvance ? "primary" : "medium"}
              title="Toggle auto-advance at the end of each iteration"
              onClick={() =>
                settings.set({ autoAdvance: !settings.autoAdvance })
              }
            >
              <IonIcon icon={Icons.repeatOutline} />
            </IonButton>
            <IonButton
              slot="end"
              expand="block"
              color={settings.globalPaused ? "medium" : "primary"}
              title={settings.globalPaused ? "Resume" : "Pause"}
              onClick={() =>
                settings.set({ globalPaused: !settings.globalPaused })
              }
            >
              <IonIcon
                icon={settings.globalPaused ? Icons.play : Icons.pause}
              />
            </IonButton>
          </IonItem>
          <IonItem>
            <IonLabel>Leader Score</IonLabel>
            <IonLabel slot="end">{Format(highScore, { prec: 2 })}</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Active Cars</IonLabel>
            <IonLabel slot="end">
              {activeCars}/{cars.length}
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>&nbsp;</IonLabel>
          </IonItem>
          <IonItem>
            <IonSelect
              label="Track Selection"
              interface="alert"
              value={settings.currentTrack}
              onIonChange={(e) => {
                settings.set({ currentTrack: e.detail.value });
              }}
            >
              {Object.keys(tracks).map((name) => (
                <IonSelectOption value={name} key={name}>
                  {name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonLabel>Best Score on {settings.currentTrack} Track</IonLabel>
            <IonLabel slot="end">
              {Format(
                Math.max(
                  highScore,
                  settings.sotaScore[settings.currentTrack]?.score || 0,
                ),
                { prec: 2 },
              )}
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>&nbsp;</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Simulation Speed</IonLabel>
            <IonLabel slot="end">
              {Format(settings.execution["tick"]?.tps || 0)} tps
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Rendering Speed</IonLabel>
            <IonLabel slot="end">
              {Format(settings.execution["tick"]?.fps || 0)} fps
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonToggle
              checked={settings.manualControl}
              onIonChange={(e) => {
                settings.set({ manualControl: e.detail.checked });
                Car.nextGeneration(track, false);
              }}
            >
              Manually Controlled Car
            </IonToggle>
          </IonItem>
          <IonItem>
            <IonToggle
              checked={!settings.helpDismissed}
              onIonChange={(e) => {
                settings.set({ helpDismissed: !e.detail.checked });
              }}
            >
              Show Help/About Page
            </IonToggle>
          </IonItem>
        </IonCol>
      </IonRow>
      <IonRow>
        <IonCol size="12">
          <IonTextarea
            label="Driving events"
            labelPlacement="floating"
            fill="outline"
            placeholder="Car Events are logged here"
            rows={10}
            value={Car.events.join("\n")}
            readonly={true}
          ></IonTextarea>
        </IonCol>
      </IonRow>
    </IonGrid>
  );
}

DrivingTab.init = () => {
  TabApp.register({
    path: "driving",
    content: <DrivingTab />,
    icon: "speedometerOutline",
    label: "Driving",
    title: "Idle Self Driving",
    from: "/",
  });
};
