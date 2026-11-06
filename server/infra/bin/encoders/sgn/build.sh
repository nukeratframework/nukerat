#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v cargo >/dev/null 2>&1; then
	echo "sgn is Rust: install cargo/rustc (bundled toolchain is Go-only)" >&2
	exit 1
fi

cd "${ROOT}"
export CARGO_TARGET_DIR="${ROOT}/target"
cargo build --release

install -m 0755 "${CARGO_TARGET_DIR}/release/sgn" "${ROOT}/sgn"
echo "built ${ROOT}/sgn"
