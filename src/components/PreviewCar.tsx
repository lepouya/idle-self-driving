import { useMemo, useRef } from "react";

import {
  IonChip,
  IonCol,
  IonGrid,
  IonItem,
  IonLabel,
  IonRow,
} from "@ionic/react";

import Car from "../model/Car";
import Sensor from "../model/Sensor";
import Track from "../model/Track";
import clamp from "../utils/clamp";
import Format from "../utils/format";

export default function PreviewCar({ car, track }: { car: Car; track: Track }) {
  const sensors = Sensor.useHook();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas = useMemo(
    () => (
      <canvas
        ref={canvasRef}
        width={`${PREVIEW_SIZE}px`}
        height={`${PREVIEW_SIZE}px`}
      ></canvas>
    ),
    [],
  );

  if (canvasRef.current) {
    const context = canvasRef.current.getContext("2d", { alpha: false })!;
    context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    context.translate(
      -clamp(car.position.x - PREVIEW_SIZE / 2, 0, track.width - PREVIEW_SIZE),
      -clamp(car.position.y - PREVIEW_SIZE / 2, 0, track.height - PREVIEW_SIZE),
    );
    track.render(context);
    car.render(context, false, true);
    context.resetTransform();
  }

  const score = car.score;

  return (
    <IonGrid>
      <IonRow class="ion-align-items-start ion-justify-content-between">
        <IonCol size="12">
          <IonItem>
            <IonLabel>{car.name}</IonLabel>
            <IonChip slot="end">
              {car.laps >= 3 ? "Won" : car.collided ? "Inactive" : "Active"}
            </IonChip>
            <IonChip slot="end">{Format(car.odometer, { prec: 0 })}px</IonChip>
            <IonChip slot="end">{Format(score.time, { prec: 1 })}s</IonChip>
            <IonChip slot="end">{Format(car.laps, { prec: 0 })} laps</IonChip>
          </IonItem>
        </IonCol>
        <IonCol size="4">
          <IonItem>
            <IonLabel>Sensor Readings:</IonLabel>
          </IonItem>
          {car.sensorReadings &&
            car.sensorReadings.length == sensors.length &&
            sensors.map((sensor, i) => (
              <IonItem key={i}>
                <IonChip slot="end">
                  <span>
                    &ang;{Format(sensor.angle * (180 / Math.PI), { prec: 0 })}
                    &deg;
                  </span>
                  &nbsp;
                  <span>&#10217;{Format(sensor.range, { prec: 0 })}px</span>
                  &nbsp;
                  <span>
                    &#8658; {Format(car.sensorReadings[i], { prec: 3 })}
                  </span>
                </IonChip>
              </IonItem>
            ))}
        </IonCol>
        <IonCol size="4">
          <IonItem>
            <IonLabel>Control Outputs:</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Acceleration</IonLabel>
            <IonChip slot="end">
              {Format(car.acceleration, { prec: 3 })}
            </IonChip>
          </IonItem>
          <IonItem>
            <IonLabel>Steering</IonLabel>
            <IonChip slot="end">{Format(car.steering, { prec: 3 })}</IonChip>
          </IonItem>
        </IonCol>
        <IonCol size="4" class="ion-text-end">
          <IonItem>
            Score:
            <IonChip slot="end">{Format(score.score, { prec: 2 })}</IonChip>
          </IonItem>
          {canvas}
        </IonCol>
      </IonRow>
    </IonGrid>
  );
}

const PREVIEW_SIZE = 200;
