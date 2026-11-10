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

restore_sudo_user_ownership() {
  if [[ -n "${SUDO_USER:-}" ]]; then
    chown -R "${SUDO_USER}:$(id -gn "${SUDO_USER}")" "$@"
  fi
}

install_node() {
  if [[ -x "${HOME}/.local/bin/node" ]]; then
    export PATH="${HOME}/.local/bin:${PATH}"
  fi
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return
  fi

  echo "Installing Node.js..."
  local ver="26.13.0"
  local arch="x64"
  local sha="525c9b29bb0263d687de60a4cec0e2a6db876a8eb032369e5795eca71e7c358e"
  if [[ "$(uname -m)" == "arm64" ]]; then
    arch="arm64"
    sha="d38bd5e5a2ddce6bbb5ce45e46e208337da4d51fffe611e567fd32073d6439f6"
  fi
  local name="node-v${ver}-darwin-${arch}.tar.gz"
  local url="https://nodejs.org/dist/v${ver}/${name}"
  local tmp="${TMPDIR:-/tmp}/nukerat-node"
  rm -rf "${tmp}"
  mkdir -p "${tmp}" "${HOME}/.local"
  curl -fL -o "${tmp}/${name}" "${url}"
  echo "${sha}  ${tmp}/${name}" | shasum -a 256 -c -
  tar -xzf "${tmp}/${name}" -C "${tmp}"
  cp -R "${tmp}/node-v${ver}-darwin-${arch}/." "${HOME}/.local/"
  rm -rf "${tmp}"
  export PATH="${HOME}/.local/bin:${PATH}"
}

python313_ready() {
  local py="/Library/Frameworks/Python.framework/Versions/3.13/bin/python3"
  [[ -x "${py}" ]] || return 1
  "${py}" -c "import sys; raise SystemExit(0 if sys.version.split()[0]=='3.13.5' else 1)"
}

install_python() {
  local py_bin="/Library/Frameworks/Python.framework/Versions/3.13/bin"
  if [[ -d "${py_bin}" ]]; then
    export PATH="${py_bin}:${PATH}"
  fi
  echo "Checking Python 3.13.5..."
  if python313_ready; then
    echo "Python 3.13.5 found."
    return
  fi

  local ver="3.13.5"
  local name="python-${ver}-macos11.pkg"
  local url="https://www.python.org/ftp/python/${ver}/${name}"
  local sha="e754d6cae3f2810dd1818c1395a7ff50ce79ade3ec4887f7ce23ad581cc12e3a"
  local tmp="${TMPDIR:-/tmp}/nukerat-python"
  rm -rf "${tmp}"
  mkdir -p "${tmp}"
  echo "Downloading Python ${ver}..."
  curl -fL -o "${tmp}/${name}" "${url}"
  echo "Verifying Python installer..."
  echo "${sha}  ${tmp}/${name}" | shasum -a 256 -c -
  echo "Installing Python ${ver}..."
  sudo installer -pkg "${tmp}/${name}" -target /
  rm -rf "${tmp}"
  export PATH="${py_bin}:${PATH}"
  if python313_ready; then
    echo "Python ${ver} installed."
    return
  fi
  echo "Python 3.13 was installed but is not on PATH." >&2
  exit 1
}

electron_files_setup() {
  local gui_dir="${main_dir}/client/gui"
  local master="${gui_dir}/public/icon_256x256.png"
  local app_src=""
  local candidate
  local found=()
  local home_dir="${HOME}"
  local owner=""

  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    home_dir="$(dscl . -read "/Users/${SUDO_USER}" NFSHomeDirectory | awk '{print $2}')"
    owner="${SUDO_USER}:$(id -gn "${SUDO_USER}")"
  fi
  if [[ -z "${home_dir}" || ! -d "${home_dir}" ]]; then
    echo "Could not resolve the user home for the app shortcut." >&2
    exit 1
  fi

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

  local dest_dir="${home_dir}/Applications"
  local dest="${dest_dir}/nukerat.app"
  mkdir -p "${dest_dir}"
  rm -rf "${dest}"
  ln -sfn "${app_src}" "${dest}"
  if [[ -n "${owner}" ]]; then
    chown "${owner}" "${dest_dir}"
    chown -h "${owner}" "${dest}"
  fi

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

  # Node.js install. The official tarball includes npm.

  local gui_dir="${main_dir}/client/gui"

  install_node
  install_python

  # npm packages install

  cd "$gui_dir"
  npm install --no-audit
  npm run dist
  electron_files_setup

  restore_sudo_user_ownership "${main_dir}/client"
}

# ======================================================================================
# MAIN ENTRYPOINT
# ======================================================================================

if [ "${1:-}" = "client" ]; then
  install_client
else
  echo "$help_message" >&2
  exit 1
fi
