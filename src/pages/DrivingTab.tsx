import { useEffect, useRef, useState } from "react";

import {
  IonCol,
  IonGrid,
  IonRow,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";

import App from "../model/App";
import Track, { useTracks } from "../model/Tracks";

export default function DrivingTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [track, _setTrack] = useState("Basic");
  const tracks = useTracks();

  useEffect(() => {
    if (tracks[track || ""]?.canvas && canvasRef.current) {
      const context = canvasRef.current.getContext("2d")!;
      context.drawImage(tracks[track].canvas!, 0, 0);
    }
  }, [track, tracks, canvasRef.current]);

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
