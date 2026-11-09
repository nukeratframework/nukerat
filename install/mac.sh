#!/usr/bin/env bash

# Copyright (C) 2026 Gustavo Henrique T.
# SPDX-License-Identifier: GPL-3.0-or-later
# See LICENSE in the repository root.

set -euo pipefail

# ======================================================================================
# VARIABLES
# ======================================================================================

help_message="Usage: bash mac.sh client
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

electron_files_setup() {
  local gui_dir="${main_dir}/client/gui"
  local master="${gui_dir}/public/icon_256x256.png"
  local app_src=""
  local candidate
  local found=()

  shopt -s nullglob
  found=("${gui_dir}/dist/"mac*/nukerat.app)
  shopt -u nullglob
  for candidate in "${found[@]}"; do
    if [[ -d "${candidate}" ]]; then
      app_src="${candidate}"
      break
    fi
  done
  if [[ -z "${app_src}" ]]; then
    echo "No .app in ${gui_dir}/dist/." >&2
    exit 1
  fi

  local dest_dir="${HOME}/Applications"
  local dest="${dest_dir}/nukerat.app"
  mkdir -p "${dest_dir}"
  rm -rf "${dest}"
  ln -sfn "${app_src}" "${dest}"

  local resources="${app_src}/Contents/Resources"
  if [[ -f "${master}" && -d "${resources}" ]] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
    local work iconset size
    work="$(mktemp -d)"
    iconset="${work}/icon.iconset"
    mkdir -p "${iconset}"
    for size in 16 32 128 256 512; do
      sips -z "${size}" "${size}" "${master}" --out "${iconset}/icon_${size}x${size}.png" >/dev/null
      sips -z "$((size * 2))" "$((size * 2))" "${master}" --out "${iconset}/icon_${size}x${size}@2x.png" >/dev/null
    done
    mkdir -p "${resources}"
    iconutil -c icns "${iconset}" -o "${resources}/icon.icns"
    rm -rf "${work}"
  fi

  local lsregister="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  if [[ -x "${lsregister}" ]]; then
    "${lsregister}" -f "${dest}" >/dev/null 2>&1 || true
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
  npm install --no-audit
  npm run dist
  electron_files_setup
}

# ======================================================================================
# MAIN ENTRYPOINT
# ======================================================================================

if [ "${1:-}" = "client" ]; then
  check_user
  install_client
else
  echo "$help_message" >&2
  exit 1
fi
