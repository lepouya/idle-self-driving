import { CapacitorConfig } from "@capacitor/cli";

import pkg from "./package.json";

const appPkg = pkg.name
  .toLowerCase()
  .replace(/[^a-zA-Z0-9]+(.)/g, (_, ch) => ch.toUpperCase());

const config: CapacitorConfig = {
  appId: `io.github.lepouya.${appPkg}`,
  appName: pkg.name,
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
