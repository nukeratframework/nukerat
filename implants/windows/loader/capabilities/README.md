# Overview

Loader-only capability hooks before the stageless payload runs. AMSI/ETW and PE header patches live in `patch.nim`; beacon sleep masking variants live under `/sleep`.

## Directories

- `/sleep`: Ekko, Zilean, and basic sleep implementations for the loader
