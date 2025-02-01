import { defineConfig } from "vitest/config";

import react from "@vitejs/plugin-react";

import pkg from "./package.json";

const externals: Record<string, RegExp> = {
  react: /react(?!.*css)/,
  capacitor: /@capacitor/,
  ionic: /@ionic/,
  ionicons: /ionicons/,
};

export default defineConfig(({ mode }) => ({
  base: "",
  plugins: [react()],
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
    sourcemap: mode === "development",
    minify: mode === "production",
    cssMinify: mode === "production",
    rollupOptions: {
      output: {
        manualChunks: function (id) {
          if (!id.includes("node_modules")) {
            return;
          }
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
}));
