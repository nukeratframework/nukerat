# Overview

Entry routing for the Linux loader after prep. `start` runs preparations and dispatches on the configured channel. The HTTP path pulls and decrypts the next stage then hands it to the shared-library runner; custom is a no-op placeholder for alternate transports.
