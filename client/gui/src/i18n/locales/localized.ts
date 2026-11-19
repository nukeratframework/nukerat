/**
 * Collection of structural helpers for the locale catalogs.
 *
 * `en` is declared `as const` so `t()` keys are inferred as string literals.
 * That also freezes the *values* as literal types ("Close"), which would make
 * every translation a type error. `Localized<T>` widens values to `string`
 * while preserving the exact key structure, so a locale can only be wrong about
 * missing/extra keys — never about spelling its own text.
 */
export type Localized<T> = {
  [K in keyof T]: T[K] extends (infer U)[]
    ? Localized<U>[]
    : T[K] extends object
      ? Localized<T[K]>
      : string;
};
