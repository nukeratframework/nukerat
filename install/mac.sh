#!/usr/bin/env bash

# Copyright (C) 2026 Gustavo Henrique T.
# SPDX-License-Identifier: GPL-3.0-or-later
# See LICENSE in the repository root.

set -euo pipefail

# ======================================================================================
# VARIABLES
# ======================================================================================

help_message="Usage: bash mac.sh <mode>

MODES:
  server    Install server
  client    Install client
  all       Install server and client

EXAMPLES:
  bash mac.sh server
  bash mac.sh client
  bash mac.sh all
"

main_dir="$(cd "$(dirname "$0")/.." && pwd)"

# ======================================================================================
# UTILS
# ======================================================================================

check_user() {
  if [[ "$EUID" -eq 0 ]]; then
    echo "Do not run as root. Homebrew refuses to install packages with sudo." >&2
    exit 1
  fi
}

load_brew() {
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

# ======================================================================================
# CLIENT INSTALLATION
# ======================================================================================

install_client() {

  # NodeJS install. The Homebrew node formula includes npm.

  local gui_dir="${main_dir}/client/gui"

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    load_brew
    if ! command -v brew >/dev/null 2>&1; then
      echo "Homebrew not found. Install Node.js and npm manually." >&2
      exit 1
    fi
    brew update
    brew install node
  fi

  # npm packages install

  cd "$gui_dir"
  npm install --silent
  npm run dist
}

# ======================================================================================
# MAIN ENTRYPOINT
# ======================================================================================

if [ "${1:-}" = "server" ]; then
  echo "Server installation is not supported on macOS." >&2
  exit 1
elif [ "${1:-}" = "client" ]; then
  check_user
  install_client
elif [ "${1:-}" = "all" ]; then
  echo "Server installation is not supported on macOS. Only the client will be installed." >&2
  check_user
  install_client
else
  echo "$help_message" >&2
  exit 1
fi
