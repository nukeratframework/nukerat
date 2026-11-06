#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os

if __name__ == "__main__":
    # Initializes the launcher, not the server.
    try:
        from launcher.menu import main_menu
        main_menu()
    except KeyboardInterrupt:
        os._exit(0)
