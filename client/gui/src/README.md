# Overview

React source for the Electron GUI. `main.tsx` mounts the app; everything else hangs off the folders below.

## Directories

- `/api`: Typed fetch helpers for team server routes (sessions, listeners, implants, etc.)
- `/i18n`: Interface translations (i18next catalogs per language; see its README)
- `/assets`: Bundled fonts, notification sound, logos, and SVG icon sets
- `/components`: The Canva shell plus shared UI widgets
- `/pages`: Thin page entrypoints wired from `app.tsx`
