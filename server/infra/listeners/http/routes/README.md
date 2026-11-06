# Overview

Route entrypoints for the HTTP listener. `commands.py` is the GET/POST on the listener path: it pulls the body out of the template, decrypts it, validates the implant payload, and hands it to the raw logic in `/logic`.
