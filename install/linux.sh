#!/usr/bin/env bash

# Copyright (C) 2026 Gustavo Henrique T.
# SPDX-License-Identifier: GPL-3.0-or-later
# See LICENSE in the repository root.

set -euo pipefail

# ======================================================================================
# VARIABLES
# ======================================================================================

help_message="Usage: bash install.sh <mode>

MODES:
  server    Install server
  client    Install client
  all       Install server and client

EXAMPLES:
  bash install.sh server
  bash install.sh client
  bash install.sh all
"

apt_packages=(
  binutils
  binutils-aarch64-linux-gnu
  binutils-mingw-w64-i686
  binutils-mingw-w64-x86-64
  bubblewrap
  cargo
  g++-aarch64-linux-gnu
  gcc
  gcc-aarch64-linux-gnu
  gcc-mingw-w64-i686
  gcc-mingw-w64-x86-64
  libgtk-3-bin
  mingw-w64-i686-dev
  mingw-w64-x86-64-dev
  openssl
  rustc
  sqlite3
  nim
  golang-go
)

dnf_packages=(
  binutils
  binutils-aarch64-linux-gnu
  mingw32-binutils
  mingw64-binutils
  bubblewrap
  cargo
  gcc
  gcc-aarch64-linux-gnu
  gcc-c++-aarch64-linux-gnu
  mingw32-gcc
  mingw64-gcc
  gtk3
  openssl
  rust
  sqlite
  golang
)

pacman_packages=(
  binutils
  aarch64-linux-gnu-binutils
  mingw-w64-binutils
  bubblewrap
  gcc
  aarch64-linux-gnu-gcc
  mingw-w64-gcc
  gtk3
  openssl
  rust
  sqlite
  nim
  go
)

main_dir="$(cd "$(dirname "$0")/.." && pwd)"

# ======================================================================================
# UTILS
# ======================================================================================

update() {
  if command -v apt >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt update -y -q
  elif command -v dnf >/dev/null 2>&1; then
    dnf makecache -y -q
  elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm
  else
    echo "Unsupported package manager. Install the dependencies manually." >&2
    exit 1
  fi
}

check_os() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
  fi
}

check_sudo() {
  if [[ "$EUID" -ne 0 ]]; then
    echo "Please run as root: sudo $0 ${1:-}" >&2
    exit 1
  fi
}

validations_check() {
  check_sudo
  check_os
}

restore_sudo_user_ownership() {
  if [[ -n "${SUDO_USER:-}" ]]; then
    chown -R "${SUDO_USER}:${SUDO_USER}" "$@"
  fi
}

# ======================================================================================
# CLIENT INSTALLATION
# ======================================================================================

install_client() {

  # NodeJS install

  local gui_dir="${main_dir}/client/gui"
  
  if command -v apt >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt install nodejs npm -y -q
  elif command -v dnf >/dev/null 2>&1; then
    dnf install nodejs nodejs-npm -y -q
  elif command -v pacman >/dev/null 2>&1; then
    pacman -S --needed --noconfirm nodejs npm
  else
    echo "Unsupported package manager. Install Node.js and npm manually." >&2
    exit 1
  fi

  # npm packages install

  cd "$gui_dir"
  npm install --silent
  npm run dist

  restore_sudo_user_ownership "${main_dir}/client"
}

# ======================================================================================
# SERVER INSTALLATION
# ======================================================================================

install_server() {

  # package install

  # apt
  if command -v apt >/dev/null 2>&1; then
    for pkg in "${apt_packages[@]}"; do
      DEBIAN_FRONTEND=noninteractive apt install "$pkg" -y -q
    done
  # dnf
  elif command -v dnf >/dev/null 2>&1; then
    for pkg in "${dnf_packages[@]}"; do
      dnf install "$pkg" -y -q
    done
    if [[ "${ID:-}" == "fedora" ]]; then
      dnf install --nogpgcheck --repofrompath 'terra,https://repos.fyralabs.com/terra$releasever' terra-release -y -q
      dnf install nim -y -q
    else
      echo "Nim is not in the official repositories. Install it manually." >&2
      exit 1
    fi
  # pacman
  elif command -v pacman >/dev/null 2>&1; then
    for pkg in "${pacman_packages[@]}"; do
      pacman -S --needed --noconfirm "$pkg"
    done
  else
    echo "Unsupported package manager. Install the dependencies manually." >&2
    exit 1
  fi

  # pip packages install 

  cd "${main_dir}/server"
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt

  # sgn build (encoder)

  cd "${main_dir}/server/infra/bin/encoders/sgn"
  ./build.sh

  # golang.org/x/sys for the mac implants

  go_bin="$(command -v go)"
  for mod_dir in \
    "${main_dir}/implants/mac/loader" \
    "${main_dir}/implants/mac/stageless"
  do
    if [[ -n "${SUDO_USER:-}" ]]; then
      sudo -u "${SUDO_USER}" -H "${go_bin}" -C "${mod_dir}" mod tidy
    else
      "${go_bin}" -C "${mod_dir}" mod tidy
    fi
  done

  # sqlite database creation

  cd "${main_dir}/server/infra/database"
  sqlite3 database.db < init.sql

  restore_sudo_user_ownership "${main_dir}/server" "${main_dir}/implants"
}

# ======================================================================================
# MAIN ENTRYPOINT
# ======================================================================================

if [[ "${1:-}" = "server" || "${1:-}" = "client" || "${1:-}" = "all" ]]; then
  check_sudo "${1:-}"
  check_os
fi

if [ "${1:-}" = "server" ]; then
  update
  validations_check
  install_server
elif [ "${1:-}" = "client" ]; then
  update
  validations_check
  install_client
elif [ "${1:-}" = "all" ]; then
  update
  validations_check
  install_server
  install_client
else
  echo "$help_message" >&2
  exit 1
fi
