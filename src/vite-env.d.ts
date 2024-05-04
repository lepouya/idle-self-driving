/// <reference types="vite/client" />

import { CSSProperties } from "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | boolean | undefined | null;
  }
}

declare module "*.svg" {
  const content: string;
  export default content;
}
