# Overview

Client-side internationalization. `i18next` + `react-i18next`, locales bundled at build time (no network backend).

## Directories

- `/locales`: One directory per language. `en/` is the source of truth for keys; every other locale is type-checked against it (`Localized<typeof enDict>`), so a missing or misspelled key fails `tsc`.
- `index.ts`: i18next init, language detection/normalization, and the loose `translate()` helper for non-component modules.
- `types.d.ts`: global `i18next` augmentation that ties `t()` keys to the `en` catalog. Not imported anywhere by name; it applies because `tsconfig.app.json` includes `src`.
- `use-locale.ts`: `useLocale()` hook for reading/switching the language (persists to `config.json`).
- `native-dialog.ts`: Pushes translated strings to the Electron main process for native dialogs.
- `locales/localized.ts`: `Localized<T>` — widens `as const` literal values to `string` while keeping the key structure strict.

## Rules

- Resolve text with `t()` inside components, `translate()` (from `index.ts`) in plain modules (`api/*`, toast helpers, menu factories that run at open time).
- Keys are namespaced per area (`shell.*`, `implants.*`, `sessions.*`, `common.*`, …) and mirror the component tree. When adding a key, add it to **both** `locales/en/<area>.ts` and `locales/zh-CN/<area>.ts`.
- Never branch on or compare against display text; use stable ids (see `src/components/canva/panels.ts` for panel ids, `TableColumn.key` for table columns). The only allowed exception is `GENERIC_FETCH_ERRORS` in `src/api/http_status.ts`, which must match browser-native English strings byte-for-byte.
- Do not translate: API paths, protocol/command identifiers, status sentinels (`"success"`, `"Cancelled"`, …), tool names (`NukeRat`, `Ekko`, `sgn`), key tokens (`Ctrl`, `⌘`), size units (`B`/`KB`).
- Language choice is persisted by `saveLanguage()` in `src/api/system/config.tsx`. First run follows the OS locale (`detectLocale()`), collapsing unsupported tags onto a shipped catalog.

## Known limitations

- Server-originated messages (terminal replies, API `message` fields, report HTML) are passed through untranslated; translating them requires stable message codes on the server first.
- Dates stay UTC / `YYYY-MM-DD` — not locale-formatted.
- Electron main-process file-IO errors are English; only the quit-confirmation dialog is localized (via `native-dialog.ts`).
