import * as IonicIcons from "ionicons/icons";

import { IonIcon } from "@ionic/react";

const Icons: Record<string, string> = IonicIcons;

export default function Icon({
  icon,
  src,
  ...props
}: {
  icon?: string;
  src?: string;
  [key: string]: any;
}) {
  const parsedIcon = icon || src || "";

  if (parsedIcon.startsWith("data:")) {
    return <IonIcon icon={parsedIcon} {...props} />;
  } else if (parsedIcon.includes("/") || parsedIcon.includes(".")) {
    return <IonIcon src={parsedIcon} {...props} />;
  } else if (Icons[parsedIcon]) {
    return <IonIcon icon={Icons[parsedIcon]} {...props} />;
  } else {
    return <IonIcon icon={IonicIcons.bugOutline} {...props} />;
  }
}
