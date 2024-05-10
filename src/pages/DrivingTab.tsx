import { useEffect, useRef, useState } from "react";

import {
  IonCol,
  IonGrid,
  IonRow,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";

import App from "../model/App";
import { useCars } from "../model/Car";
import Track, { useTracks } from "../model/Track";

export default function DrivingTab() {
  const settings = App.useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = useTracks();
  const cars = useCars();
  // TODO: Move this to settings
  const [track, _setTrack] = useState("Basic");

  useEffect(() => {
    cars.forEach((car) => car.placeAtStart(tracks[track]));
  }, [track]);

  useEffect(() => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext("2d")!;
      tracks[track].render(context);
      cars.forEach((car) => car.render(context));
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
          <IonSelect
            label="Track Selection"
            labelPlacement="stacked"
            interface="popover"
            value={track}
            onIonChange={(e) => _setTrack(e.detail.value)}
          >
            {Object.keys(tracks).map((name) => (
              <IonSelectOption value={name} key={name}>
                {name}
              </IonSelectOption>
            ))}
          </IonSelect>
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
