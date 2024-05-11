import { useEffect, useRef, useState } from "react";

import {
  IonCol,
  IonGrid,
  IonItem,
  IonLabel,
  IonRow,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";

import App from "../model/App";
import Car, { useCars } from "../model/Car";
import Track, { useTracks } from "../model/Track";
import Format from "../utils/format";

export default function DrivingTab() {
  const settings = App.useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = useTracks();
  const cars = useCars();
  // TODO: Move this to settings
  const [track, setTrack] = useState("Basic");

  useEffect(() => {
    cars.forEach((car) => car.placeOnTrack(tracks[track]));
  }, [track]);

  useEffect(() => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext("2d", { alpha: false })!;
      tracks[track].render(context);
      Car.renderAll(context);
    }
  }, [track, tracks, canvasRef.current, settings.lastRender]);

  return (
    <IonGrid>
      <IonRow>
        <IonCol size="8">
          <canvas
            ref={canvasRef}
            width={`${Track.width}px`}
            height={`${Track.height}px`}
          ></canvas>
        </IonCol>
        <IonCol size="4">
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
            <IonSelect
              label="Track Selection"
              labelPlacement="stacked"
              interface="popover"
              value={track}
              onIonChange={(e) => setTrack(e.detail.value)}
            >
              {Object.keys(tracks).map((name) => (
                <IonSelectOption value={name} key={name}>
                  {name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonLabel>Best Score</IonLabel>
            <IonLabel slot="end">
              {Format(Math.max(...cars.map((car) => car.score.score)) || 0, {
                prec: 2,
              })}
            </IonLabel>
          </IonItem>
        </IonCol>
      </IonRow>
    </IonGrid>
  );
}

DrivingTab.init = () => {
  App.Tab.register({
    path: "driving",
    content: <DrivingTab />,
    icon: "speedometerOutline",
    label: "Driving",
    title: "Idle Self Driving",
    from: "/",
  });
};
