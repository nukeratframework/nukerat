/**
 * Global i18next augmentation: makes `t()` accept only keys present in the
 * English catalog. Picked up through `tsconfig.app.json`'s `include: ["src"]`;
 * it is never imported directly.
 */
import "i18next";
import type en from "./locales/en";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    resources: {
      translation: typeof en;
    };
  }
}
