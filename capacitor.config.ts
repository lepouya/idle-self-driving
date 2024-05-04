import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.lepouya.idleSelfDriving",
  appName: "idle-self-driving",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
