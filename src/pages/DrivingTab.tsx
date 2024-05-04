import App from "../model/App";

export default function DrivingTab() {
  return "Vr00m vr00m!!!";
}

DrivingTab.init = () => {
  App.Tab.register({
    path: "driving",
    content: <DrivingTab />,
    icon: "speedometerOutline",
    label: "Driving",
    title: "Driving",
    from: "/",
  });
};
