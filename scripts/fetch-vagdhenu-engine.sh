#!/usr/bin/env bash
set -euo pipefail

# Swar-Sadhika test repository only.
# Fetch genuine upstream browser-engine source.
# This script does NOT download neural model weights and does NOT
# claim that local inference or offline synthesis has been verified.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/vendor/vagdhenu-upstream"
TMP="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT

REPO="https://github.com/hemanth/sanskrit-tts-web.git"

command -v git >/dev/null 2>&1 || {
  echo "ERROR: git is required." >&2
  exit 2
}

command -v tar >/dev/null 2>&1 || {
  echo "ERROR: tar is required." >&2
  exit 2
}

echo "Fetching the genuine Vāgdhenu browser-engine source..."
echo "Repository: $REPO"

if ! git clone --depth 1 "$REPO" "$TMP/upstream"; then
  echo "ERROR: Unable to clone the upstream repository." >&2
  exit 3
fi

# Refuse to vendor a guessed or placeholder entry point.
if [[ ! -s "$TMP/upstream/vagdhenu-onnx.js" ]]; then
  echo "ERROR: Expected upstream file was not found:" >&2
  echo "vagdhenu-onnx.js at the repository root." >&2
  echo "Inspect the real upstream repository layout before changing this script." >&2
  exit 4
fi

# Require a license file before copying upstream source.
LICENSE_FILE="$(
  find "$TMP/upstream" \
    -maxdepth 1 \
    -type f \
    \( \
      -iname 'LICENSE' -o \
      -iname 'LICENSE.*' -o \
      -iname 'LICENCE' -o \
      -iname 'LICENCE.*' -o \
      -iname 'COPYING' -o \
      -iname 'COPYING.*' \
    \) \
    -print -quit
)"

if [[ -z "$LICENSE_FILE" ]]; then
  echo "ERROR: No top-level upstream license file was found." >&2
  echo "Do not vendor the source until its license or written permission is verified." >&2
  exit 5
fi

UPSTREAM_COMMIT="$(
  git -C "$TMP/upstream" rev-parse HEAD
)"

if [[ ! "$UPSTREAM_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: Could not determine the upstream commit hash." >&2
  exit 6
fi

# Stage the copy first. Do not destroy the existing vendor directory
# unless the staged source has passed the required checks.
STAGED="$TMP/staged-vendor"
mkdir -p "$STAGED"

(
  cd "$TMP/upstream"
  tar --exclude='.git' -cf - .
) | (
  cd "$STAGED"
  tar -xf -
)

if [[ ! -s "$STAGED/vagdhenu-onnx.js" ]]; then
  echo "ERROR: Staged upstream entry point is missing." >&2
  exit 7
fi

mkdir -p "$ROOT/vendor"

rm -rf "$DEST"
mv "$STAGED" "$DEST"

printf '%s\n' "$UPSTREAM_COMMIT" \
  > "$ROOT/vendor/VAGDHENU_UPSTREAM_COMMIT.txt"

cat > "$ROOT/vendor/VAGDHENU_VENDOR_STATUS.md" <<'STATUS'
# Vāgdhenu upstream source — test repository

This directory was copied from the upstream browser-engine repository by
`scripts/fetch-vagdhenu-engine.sh`.

The exact source revision is recorded in `VAGDHENU_UPSTREAM_COMMIT.txt`.

## Verification status

Copying the source does not prove that:

- all runtime dependencies are local;
- the ONNX model files are present;
- model sessions initialize successfully;
- actual Sanskrit audio can be synthesized;
- synthesis works without an internet connection.

Review external JavaScript imports, ONNX Runtime assets, model URLs, cache
behavior, licensing and the upstream API before making any such claims.
STATUS

echo
echo "Upstream source copied successfully."
echo "Destination: $DEST"
echo "Upstream commit: $UPSTREAM_COMMIT"
echo
echo "NEXT:"
echo "Audit runtime imports and model dependencies."
echo "Do not claim successful inference or offline operation yet."
