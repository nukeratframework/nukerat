# Overview

Login, the stored server list, and the operator key parse. These run before the other team server calls. `auth.tsx` posts to `/auth/login`, `config.tsx` reads and writes the server list through Electron, and `key.tsx` parses the key.
