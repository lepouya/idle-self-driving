import { defineConfig } from "vitest/config";

import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";

import pkg from "./package.json";

const externals = {
  capacitor: /node_modules\/@capacitor/,
  ionic: /node_modules\/@ionic/,
  ionicons: /node_modules\/ionicons/,
  react: /node_modules\/(react|scheduler)/,
};

export default defineConfig({
  plugins: [react(), legacy()],
  define: {
    ...Object.fromEntries(
      Object.entries(pkg)
        .filter(([, s]) => typeof s === "string")
        .map(([k, v]) => [
          `import.meta.env.${k.toUpperCase()}`,
          JSON.stringify(v),
        ]),
    ),
  },
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks: function (id) {
          for (let [name, regex] of Object.entries(externals)) {
            if (regex.test(id)) {
              return name;
            }
          }
        },
      },
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
  },
});
