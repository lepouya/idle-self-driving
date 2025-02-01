import * as Icons from "ionicons/icons";
import { useEffect, useRef, useState } from "react";

import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonPopover,
  IonRow,
} from "@ionic/react";

import TabApp from "../components/TabApp";
import Car from "../model/Car";
import { useSettings } from "../model/Settings";
import Track from "../model/Track";

export default function HelpPage() {
  const settings = useSettings();

  if (settings.helpDismissed) {
    return null;
  }

  return (
    <IonPopover
      trigger={"tab-contents"}
      isOpen={!settings.helpDismissed}
      showBackdrop={true}
      side="start"
      alignment="start"
      onDidDismiss={() => settings.set({ helpDismissed: true })}
    >
      <HelpPopup />
    </IonPopover>
  );
}

function HelpPopup() {
  const settings = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [track, setTrack] = useState<Track | undefined>();
  const [car, setCar] = useState<Car | undefined>();

  useEffect(() => {
    const createCar = async () => {
      const track = new DemoTrack("Demo Track");
      const car = new Car("", "#33eeee", 0, false);
      car.visualizeSensors = true;
      await Promise.all([track.fetchImageData(), car.fetchImageData()]);
      car.placeOnTrack(track);
      car.position = { x: 100, y: 100 };
      car.tick(0);
      await car.renderSensors();
      setTrack(track);
      setCar(car);
    };
    createCar();
  }, [setTrack, setCar]);

  useEffect(() => {
    if (!canvasRef.current || !car || !car.canvas || !track || !track.canvas) {
      return;
    }

    const angle = ((settings.lastRender / 1000) % 8) * 45 * (Math.PI / 180);
    car.position = {
      x: 100 + 50 * Math.cos(angle),
      y: 100 + 40 * Math.sin(angle),
    };
    car.angle = angle + Math.PI / 2;
    car.tick(0);

    const context = canvasRef.current.getContext("2d", { alpha: false })!;
    track.render(context);
    car.render(context);
  }, [settings.lastRender, canvasRef.current, car, track]);

  return (
    <IonContent id="help-page" class="ion-padding">
      <IonGrid fixed={true}>
        <IonRow>
          <IonCol>
            <h1>About: Idle Self Driving</h1>
          </IonCol>
        </IonRow>
        <IonRow>
          <IonCol>
            <p>
              This is a simple demonstration of self-driving cars receiving
              sensory information from their surroundings and controlling their
              acceleration and steering using a simple neural network.
            </p>
          </IonCol>
        </IonRow>
        <IonRow>
          <IonCol size="4">
            <canvas
              ref={canvasRef}
              width={`${track?.width || 1}px`}
              height={`${track?.height || 1}px`}
              style={{ margin: "auto", display: "block" }}
            ></canvas>
          </IonCol>
          <IonCol size="8">
            <p>
              Each car has 5 sensor inputs in front of it. The reading values
              are between 0 and 1 indicating how far the car is from the edges
              of the track
            </p>
            <p>
              The network outputs two values between -1 and 1. One for the
              acceleration of the car (negative means breaking), and the other
              for steering (negative for left, positive for right).
            </p>
            <p>
              A simple simulation calculates the velocity and the angle of the
              car. Some basic friction is also calculated for speed and
              steering, but I didn't bother with drifting or skidding. At least
              not for now.
            </p>
          </IonCol>
        </IonRow>
        <IonRow>
          <IonCol>
            <p>
              The cars can "lose" if they hit the edges of the track. There are
              also some criteria for crossing the finish line in wrong direction
              or backtracking on the track. There is no collision between the
              cars, so you can think of this as being in separate tracks or
              ghosting.
            </p>
            <p>
              A car "wins" if it successfully laps the track 3 times. The
              scoring is based on the distance travelled and the speed of the
              car. The faster a car finishes the laps the better it scores. And
              the further it gets before losing the better it scores.
            </p>
            <p>
              At the beginning of each iteration, 10 new cars are generated
              based on the global best on the track and the winner of the last
              track. Some random choices are also made. The further we are in
              the training, the less random variations there are between cars
            </p>
            <p>
              The <IonIcon icon={Icons.playSkipForwardOutline} /> button will
              start a new iteration, even if there are still cars racing in the
              current track. Use the <IonIcon icon={Icons.repeatOutline} />{" "}
              button to automatically advance to the next iteration after all
              cars have finished.
            </p>
          </IonCol>
        </IonRow>
        <IonRow>
          <IonCol>
            <p>
              You can also change the track the race is taking place on the
              right side panel. I recommend moving on to the "Advanced" track
              once you have trained a car that can lap around the "Basic" track.
              It might take a few more iterations before you have a car that can
              make the tight corners on the "Advanced" track.
            </p>
            <p>
              There is also an "Oval" track that you can use for fine-tuning the
              speed of the track navigation, but be mindful that staying on it
              too long might cause your model to "forget" how to turn left. This
              is not a commentary on NASCAR™. I promise.
            </p>
            <p>
              Finally, you can put all of the learnings to the test on the
              "Curvy" track to test both steering abilities and the speed
              choices of your model.
            </p>
          </IonCol>
        </IonRow>
        <IonRow>
          <IonCol>
            Pro tips:
            <ul>
              <li>
                You can save / load / reset the state on the "Settings" tab
                below. Using import/export features lets you share your models
              </li>
              <li>
                The ability to customize # of sensors, their angles, and ranges
                are there, but I haven't made the UI for it yet. You can still
                do it by mocking around in the saved settings, or just get the
                source code: the link is on top right. Coming later.
              </li>
              <li>
                Ability to change the # of layers and neurons in the net is also
                there, but doesn't have a UI either. You can use the same tricks
                above to play with it. Or to view your current SOTA.
              </li>
              <li>
                If you want your save files in plain text (json) instead of
                base64, add "?debug" to the end of the URL and you get a bunch
                of new feature
              </li>
            </ul>
          </IonCol>
        </IonRow>
      </IonGrid>
      <IonButton onClick={() => settings.set({ helpDismissed: true })}>
        Close
      </IonButton>
    </IonContent>
  );
}

class DemoTrack extends Track {
  width = 200;
  height = 200;

  get path(): string[] {
    return ["M 0 100 h 200"];
  }

  get roadThickness() {
    return 120;
  }
  get laneMarkingThickness() {
    return 3;
  }

  get startingPoint() {
    return { x: 25, y: 100 };
  }
  get startingDirection() {
    return { x: 1, y: 0 };
  }
}

HelpPage.init = () => {
  TabApp.register({
    path: "help",
    content: <HelpPage />,
    alwaysMounted: true,
  });
};
