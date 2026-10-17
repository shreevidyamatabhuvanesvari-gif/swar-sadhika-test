#!/usr/bin/env bash
# Swar-Sadhika TEST repository only.
# Fetches a pinned upstream browser-engine source tree and validates it before
# replacing the existing vendor directory. This script does NOT download model
# weights, bundle all runtime dependencies, or prove real inference/offline use.

set -Eeuo pipefail
IFS=$'\n\t'
umask 022

log() { printf '[fetch-vagdhenu] %s\n' "$*"; }
fail() { local code="$1"; shift; printf '[fetch-vagdhenu] ERROR: %s\n' "$*" >&2; exit "$code"; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
VENDOR_ROOT="$ROOT/vendor"
DEST="$VENDOR_ROOT/vagdhenu-upstream"

# Safety guard: this script may modify only the Swar-Sadhika TEST repository.
ORIGIN="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"

if [[ -n "$ORIGIN" ]]; then
  ORIGIN="${ORIGIN%/}"
  ORIGIN="${ORIGIN%.git}"

  case "$ORIGIN" in
    git@github.com:shreevidyamatabhuvanesvari-gif/swar-sadhika-test|https://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test|http://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test)
      ;;
    *)
      fail 2 "Safety stop: only the swar-sadhika-test repository may be modified. Found origin: $ORIGIN"
      ;;
  esac
else
  case "$(basename "$ROOT")" in
    *swar-sadhika-test*) ;;
    *)
      fail 2 "Safety stop: cannot identify the test repository. No files changed."
      ;;
  esac
fi

[[ "$(basename "$ROOT")" != "anujadha" ]] ||
  fail 2 "Safety stop: the main app anujadha must never be modified."

[[ ! -L "$VENDOR_ROOT" ]] ||
  fail 2 "Safety stop: vendor/ is a symbolic link."

[[ ! -L "$DEST" ]] ||
  fail 2 "Safety stop: vendor/vagdhenu-upstream is a symbolic link."

# These values must be verified from the actual upstream source.
# Never guess a commit or claim an unverified file is the engine.
UPSTREAM_REPO="${VAGDHENU_UPSTREAM_REPO:-https://github.com/hemanth/sanskrit-tts-web.git}"
UPSTREAM_COMMIT="${VAGDHENU_UPSTREAM_COMMIT:-}"
UPSTREAM_ENTRY="${VAGDHENU_UPSTREAM_ENTRY:-}"
LICENSE_REVIEWED="${VAGDHENU_LICENSE_REVIEWED:-NO}"
PERMISSION_EVIDENCE_REL="${VAGDHENU_PERMISSION_EVIDENCE_FILE:-}"

[[ "$UPSTREAM_REPO" == https://github.com/* ]] ||
  fail 2 "VAGDHENU_UPSTREAM_REPO must be an HTTPS GitHub URL."

[[ "$UPSTREAM_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] ||
  fail 2 "Set VAGDHENU_UPSTREAM_COMMIT to a verified 40-character commit SHA. No files changed."

[[ -n "$UPSTREAM_ENTRY" ]] ||
  fail 2 "Set VAGDHENU_UPSTREAM_ENTRY to the verified browser JavaScript entry path. No files changed."

[[ "$LICENSE_REVIEWED" == "YES" ]] ||
  fail 2 "Set VAGDHENU_LICENSE_REVIEWED=YES only after reviewing the source and dependency licenses."

# Entry must be a repository-relative JavaScript module path.
case "$UPSTREAM_ENTRY" in
  /*|..|../*|*/../*|*/..)
    fail 2 "VAGDHENU_UPSTREAM_ENTRY must be a safe relative path."
    ;;
esac

case "$UPSTREAM_ENTRY" in
  *.js|*.mjs|*.cjs) ;;
  *)
    fail 2 "VAGDHENU_UPSTREAM_ENTRY must end in .js, .mjs, or .cjs."
    ;;
esac

command -v git >/dev/null 2>&1 ||
  fail 2 "git is required."

command -v tar >/dev/null 2>&1 ||
  fail 2 "tar is required."

command -v node >/dev/null 2>&1 ||
  fail 2 "Node.js is required for entry-point syntax validation."

command -v find >/dev/null 2>&1 ||
  fail 2 "find is required."

command -v grep >/dev/null 2>&1 ||
  fail 2 "grep is required."

command -v sha256sum >/dev/null 2>&1 ||
  fail 2 "sha256sum is required."

WORK="$(mktemp -d "${TMPDIR:-/tmp}/swar-vagdhenu-fetch.XXXXXX")"
STAGED=""
BACKUP="$VENDOR_ROOT/.vagdhenu-upstream-backup.$$"
SWAP_IN_PROGRESS=0
HAD_OLD_DEST=0

cleanup() {
  local rc=$?

  # Roll back the replacement if a later operation fails.
  if [[ "$SWAP_IN_PROGRESS" == "1" ]]; then
    if [[ -e "$DEST" ]]; then
      rm -rf -- "$DEST" || true
    fi

    if [[ "$HAD_OLD_DEST" == "1" && -e "$BACKUP" ]]; then
      mv -- "$BACKUP" "$DEST" ||
        printf '[fetch-vagdhenu] CRITICAL: unable to restore previous vendor directory: %s\n' "$BACKUP" >&2
    fi
  fi

  if [[ -n "$STAGED" && -d "$STAGED" ]]; then
    rm -rf -- "$STAGED"
  fi

  if [[ -d "$WORK" ]]; then
    rm -rf -- "$WORK"
  fi

  exit "$rc"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p -- "$VENDOR_ROOT"

[[ ! -e "$BACKUP" ]] ||
  fail 2 "Unexpected backup path already exists: $BACKUP"

log "Upstream repository: $UPSTREAM_REPO"
log "Pinned commit: $UPSTREAM_COMMIT"
log "Engine entry: $UPSTREAM_ENTRY"
log "Fetching into a temporary workspace; existing vendor files remain untouched."

if ! git clone --no-checkout "$UPSTREAM_REPO" "$WORK/upstream"; then
  fail 3 "Unable to clone upstream repository. Check the URL and network access."
fi

if ! git -C "$WORK/upstream" cat-file -e "${UPSTREAM_COMMIT}^{commit}" 2>/dev/null; then
  if ! git -C "$WORK/upstream" fetch --no-tags origin "$UPSTREAM_COMMIT"; then
    fail 3 "The requested commit is unavailable from upstream: $UPSTREAM_COMMIT"
  fi
fi

if ! git -C "$WORK/upstream" checkout --detach "$UPSTREAM_COMMIT"; then
  fail 3 "Unable to check out the requested commit. Existing vendor files were preserved."
fi

ACTUAL_COMMIT="$(git -C "$WORK/upstream" rev-parse HEAD)"

[[ "${ACTUAL_COMMIT,,}" == "${UPSTREAM_COMMIT,,}" ]] ||
  fail 3 "Checked-out commit does not match the requested SHA."

SOURCE_ENTRY="$WORK/upstream/$UPSTREAM_ENTRY"

[[ -f "$SOURCE_ENTRY" && -s "$SOURCE_ENTRY" ]] ||
  fail 4 "The configured engine entry is missing or empty: $UPSTREAM_ENTRY"

# A source license or written-permission evidence is mandatory.
LICENSE_FILE="$(
  find "$WORK/upstream" -maxdepth 1 -type f \( \
    -iname 'LICENSE' -o \
    -iname 'LICENSE.*' -o \
    -iname 'LICENCE' -o \
    -iname 'LICENCE.*' -o \
    -iname 'COPYING' -o \
    -iname 'COPYING.*' \
  \) -print -quit
)"

PERMISSION_EVIDENCE=""

if [[ -n "$PERMISSION_EVIDENCE_REL" ]]; then
  case "$PERMISSION_EVIDENCE_REL" in
    /*|..|../*|*/../*|*/..)
      fail 2 "VAGDHENU_PERMISSION_EVIDENCE_FILE must be a safe relative path."
      ;;
  esac

  PERMISSION_EVIDENCE="$ROOT/$PERMISSION_EVIDENCE_REL"

  [[ -f "$PERMISSION_EVIDENCE" && -s "$PERMISSION_EVIDENCE" ]] ||
    fail 5 "Written-permission evidence is missing or empty: $PERMISSION_EVIDENCE_REL"
fi

if [[ -z "$LICENSE_FILE" && -z "$PERMISSION_EVIDENCE" ]]; then
  fail 5 "No upstream LICENSE/LICENCE/COPYING file or written-permission evidence was found. Existing vendor files were preserved."
fi

# Syntax validation rejects malformed JS and many placeholder text files.
# This does NOT prove that the module will run or generate audio.
if ! node --input-type=module --check < "$SOURCE_ENTRY"; then
  fail 6 "The upstream JavaScript entry failed syntax validation. Existing vendor files were preserved."
fi

# Stage beside DEST so the final directory rename uses the same filesystem.
STAGED="$(mktemp -d "$VENDOR_ROOT/.vagdhenu-stage.XXXXXX")"

if ! (
  cd "$WORK/upstream"
  tar --exclude='.git' -cf - .
) | (
  cd "$STAGED"
  tar -xf -
); then
  fail 7 "Unable to stage upstream files. Existing vendor files were preserved."
fi

[[ -s "$STAGED/$UPSTREAM_ENTRY" ]] ||
  fail 7 "The staged JavaScript entry file is missing."

if ! node --input-type=module --check < "$STAGED/$UPSTREAM_ENTRY"; then
  fail 7 "The staged entry failed syntax validation. Existing vendor files were preserved."
fi

if [[ -n "$PERMISSION_EVIDENCE" ]]; then
  cp -- "$PERMISSION_EVIDENCE" "$STAGED/UPSTREAM_PERMISSION_EVIDENCE.md"
fi

# Generate a report to locate external imports, runtime files, and model URLs.
# Finding these URLs does not mean their dependencies are bundled locally.
{
  printf '# Upstream URL and runtime dependency review\n\n'
  printf -- '- Source repository: %s\n' "$UPSTREAM_REPO"
  printf -- '- Pinned commit: %s\n' "$ACTUAL_COMMIT"
  printf -- '- Entry module: %s\n\n' "$UPSTREAM_ENTRY"
  printf 'Review external JavaScript imports, WASM/runtime paths, and model URLs. This report is not a compatibility proof.\n\n'

  grep -RInI -E 'https?://|onnxruntime-web|\.wasm|\.onnx|baked_bank' "$STAGED" \
    --include='*.js' \
    --include='*.mjs' \
    --include='*.cjs' \
    --include='*.html' \
    --include='*.json' \
    --include='*.md' || true
} > "$STAGED/UPSTREAM_RUNTIME_IMPORT_AUDIT.md"

# Generate SHA-256 checksums for the vendored upstream files.
(
  cd "$STAGED"

  find . -type f \
    ! -name 'VAGDHENU_VENDOR_STATUS.md' \
    ! -name 'VAGDHENU_FILE_SHA256SUMS.txt' \
    -print0 |
    sort -z |
    xargs -0 -r sha256sum
) > "$STAGED/VAGDHENU_FILE_SHA256SUMS.txt"

cat > "$STAGED/VAGDHENU_VENDOR_STATUS.md" <<STATUS
# Vāgdhenu browser source — Swar-Sadhika test repository

- Upstream repository: $UPSTREAM_REPO
- Pinned commit: $ACTUAL_COMMIT
- Entry module: $UPSTREAM_ENTRY
- Source license file present: $([[ -n "$LICENSE_FILE" ]] && printf 'yes (%s)' "$(basename "$LICENSE_FILE")" || printf 'no; written-permission evidence supplied')
- License reviewed by maintainer: YES (human attestation; not an automated legal opinion)
- Entry module syntax check: PASS
- SHA-256 manifest: VAGDHENU_FILE_SHA256SUMS.txt
- Runtime dependency audit: UPSTREAM_RUNTIME_IMPORT_AUDIT.md

## Not proven by this fetch script

- Compatibility with the Swar-Sadhika application adapter
- Availability of all transitive JavaScript dependencies
- Successful loading of ONNX Runtime JS/WASM assets
- Completeness and compatibility of all model/tokenizer/reference-bank assets
- Successful model initialization on Android
- Generation and playback of new Sanskrit audio
- Fresh synthesis with the network disabled
- The required melodic or female-friendly voice quality

This script validates source provenance and entry syntax only. Do not label the app AI-ready or offline-ready until the app-level and device-level tests pass.
STATUS

# Keep root-level metadata compatible with the current test workflow.
printf '%s\n' "$ACTUAL_COMMIT" > "$WORK/VAGDHENU_UPSTREAM_COMMIT.txt"
cp -- "$STAGED/VAGDHENU_VENDOR_STATUS.md" "$WORK/VAGDHENU_VENDOR_STATUS.md"
cp -- "$STAGED/UPSTREAM_RUNTIME_IMPORT_AUDIT.md" "$WORK/UPSTREAM_RUNTIME_IMPORT_AUDIT.md"

# Atomic replacement with rollback; the old vendor directory is not deleted first.
if [[ -e "$DEST" ]]; then
  mv -- "$DEST" "$BACKUP"
  HAD_OLD_DEST=1
fi

SWAP_IN_PROGRESS=1

if ! mv -- "$STAGED" "$DEST"; then
  if [[ -e "$BACKUP" ]]; then
    mv -- "$BACKUP" "$DEST"
  fi

  SWAP_IN_PROGRESS=0
  HAD_OLD_DEST=0
  fail 8 "Could not activate staged source; restoration was attempted."
fi

STAGED=""

# Update workflow metadata only after the source has been activated.
for metadata in \
  VAGDHENU_UPSTREAM_COMMIT.txt \
  VAGDHENU_VENDOR_STATUS.md \
  UPSTREAM_RUNTIME_IMPORT_AUDIT.md
do
  mv -- "$WORK/$metadata" "$VENDOR_ROOT/.$metadata.tmp.$$"
  mv -- "$VENDOR_ROOT/.$metadata.tmp.$$" "$VENDOR_ROOT/$metadata"
done

if [[ -e "$BACKUP" ]]; then
  rm -rf -- "$BACKUP"
fi

SWAP_IN_PROGRESS=0
HAD_OLD_DEST=0

log "PASS: pinned source copied and entry module syntax-checked."
log "Destination: $DEST"
log "Commit: $ACTUAL_COMMIT"
log "IMPORTANT: this is NOT an inference or offline PASS. Review the dependency audit and run actual Android synthesis tests."
