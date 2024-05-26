import { useEffect, useRef } from "react";

import {
  IonButton,
  IonCol,
  IonGrid,
  IonItem,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from "@ionic/react";

import TabApp from "../components/TabApp";
import Car, { useCars } from "../model/Car";
import { useSettings } from "../model/Settings";
import { useTracks } from "../model/Track";
import Format from "../utils/format";

export default function DrivingTab() {
  const settings = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = useTracks();
  const cars = useCars();

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
              onClick={() => Car.nextGeneration(track, true)}
            >
              Next Generation
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
              labelPlacement="stacked"
              interface="popover"
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
                  settings.sotaScore[settings.currentTrack] || 0,
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
