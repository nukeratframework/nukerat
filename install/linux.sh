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
  python3.13
  python3.13-dev
  python3.13-venv
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
  python3.13
  python3.13-devel
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

install_python() {
  if command -v python3.13 >/dev/null 2>&1; then
    return
  fi

  # Arch has no python3.13 package. python.org publishes the 3.13.5 source, not a Linux binary.
  pacman -S --needed --noconfirm base-devel curl libffi zlib bzip2 xz readline ncurses
  local py_ver="3.13.5"
  local py_sha="93e583f243454e6e9e4588ca2c2662206ad961659863277afcdb96801647d640"
  local py_src
  py_src="$(mktemp -d)"
  curl -fsSL "https://www.python.org/ftp/python/${py_ver}/Python-${py_ver}.tar.xz" -o "${py_src}/Python-${py_ver}.tar.xz"
  echo "${py_sha}  ${py_src}/Python-${py_ver}.tar.xz" | sha256sum -c -
  tar -xJf "${py_src}/Python-${py_ver}.tar.xz" -C "${py_src}"
  (
    cd "${py_src}/Python-${py_ver}"
    ./configure --prefix=/usr/local --with-ensurepip=install
    make -j"$(nproc)"
    make altinstall
  )
  rm -rf "${py_src}"
}

install_nim() {
  if command -v nim >/dev/null 2>&1; then
    return
  fi

  # dnf distros have no Nim package. nim-lang.org publishes the binary.
  local nim_arch
  case "$(uname -m)" in
    x86_64) nim_arch="linux_x64" ;;
    *)
      echo "nim-lang.org has no Nim 2.4.0 build for $(uname -m)." >&2
      exit 1
      ;;
  esac
  dnf install curl xz -y -q
  local nim_ver="2.4.0"
  local nim_sha="23c1c83d9031c498a2b3ad0bce153b8905710d04eb5922cf8ebd8f9d12125743"
  local nim_src
  nim_src="$(mktemp -d)"
  curl -fsSL "https://nim-lang.org/download/nim-${nim_ver}-${nim_arch}.tar.xz" -o "${nim_src}/nim.tar.xz"
  echo "${nim_sha}  ${nim_src}/nim.tar.xz" | sha256sum -c -
  tar -xJf "${nim_src}/nim.tar.xz" -C "${nim_src}"
  rm -rf /opt/nim
  mv "${nim_src}/nim-${nim_ver}" /opt/nim
  mkdir -p /usr/local/bin
  local bin
  for bin in /opt/nim/bin/*; do
    if [[ -f "${bin}" || -L "${bin}" ]]; then
      ln -sfn "${bin}" "/usr/local/bin/$(basename "${bin}")"
    fi
  done
  rm -rf "${nim_src}"
}

electron_files_setup() {
  local app_id="com.nukerat.app"
  local gui_dir="${main_dir}/client/gui"
  local public="${gui_dir}/public"
  local home_dir="${HOME}"
  local owner=""

  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    home_dir="$(getent passwd "${SUDO_USER}" | cut -d: -f6)"
    owner="${SUDO_USER}:${SUDO_USER}"
  fi
  if [[ -z "${home_dir}" || ! -d "${home_dir}" ]]; then
    echo "Could not resolve the user home for the desktop entry." >&2
    exit 1
  fi

  local icon_root="${home_dir}/.local/share/icons/hicolor"
  local desktop_dir="${home_dir}/.local/share/applications"
  local desktop_file="${desktop_dir}/${app_id}.desktop"
  local sizes=(16 24 32 48 64 128 256)
  local master="${public}/icon_256x256.png"
  local size src dest

  for size in "${sizes[@]}"; do
    src="${public}/icon_${size}x${size}.png"
    if [[ ! -f "${src}" && -f "${master}" ]]; then
      if command -v magick >/dev/null 2>&1; then
        magick "${master}" -filter Lanczos -resize "${size}x${size}" "${src}"
      elif command -v convert >/dev/null 2>&1; then
        convert "${master}" -filter Lanczos -resize "${size}x${size}" "${src}"
      fi
    fi
    [[ -f "${src}" ]] || continue
    dest="${icon_root}/${size}x${size}/apps"
    mkdir -p "${dest}"
    cp -f "${src}" "${dest}/${app_id}.png"
    if [[ -n "${owner}" ]]; then
      chown "${owner}" "${dest}/${app_id}.png" "${dest}" "${icon_root}/${size}x${size}"
    fi
  done

  local appimage=""
  local found=()
  shopt -s nullglob
  found=("${gui_dir}/dist/"*.AppImage)
  shopt -u nullglob
  if [[ ${#found[@]} -eq 0 ]]; then
    echo "No AppImage in ${gui_dir}/dist/." >&2
    exit 1
  fi
  appimage="$(readlink -f "${found[0]}")"
  if [[ ! -f "${appimage}" ]]; then
    echo "Not found: ${appimage}" >&2
    exit 1
  fi

  mkdir -p "${desktop_dir}"
  cat > "${desktop_file}" <<EOF
[Desktop Entry]
Type=Application
Name=nukerat
Comment=nukerat
Exec="${appimage}" %U
Path=$(dirname "${appimage}")
Icon=${app_id}
Terminal=false
Categories=Utility;
StartupNotify=true
StartupWMClass=${app_id}
EOF

  if [[ -n "${owner}" ]]; then
    chown "${owner}" \
      "${home_dir}/.local" \
      "${home_dir}/.local/share" \
      "${home_dir}/.local/share/icons" \
      "${icon_root}" \
      "${desktop_dir}" \
      "${desktop_file}"
  fi

  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "${icon_root}" >/dev/null 2>&1 || true
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
  npm install --no-audit
  npm run dist
  electron_files_setup

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
    install_nim
  # pacman
  elif command -v pacman >/dev/null 2>&1; then
    for pkg in "${pacman_packages[@]}"; do
      pacman -S --needed --noconfirm "$pkg"
    done
    install_python
  else
    echo "Unsupported package manager. Install the dependencies manually." >&2
    exit 1
  fi

  # pip packages install 

  cd "${main_dir}/server"
  if ! command -v python3.13 >/dev/null 2>&1; then
    echo "python3.13 is required." >&2
    exit 1
  fi
  python3.13 -m venv venv
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
