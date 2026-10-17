#!/usr/bin/env bash
# Swar-Sadhika TEST repository only.
# Fetches a real, pinned Vāgdhenu browser source revision, validates its expected
# API and deployment blockers, and swaps it into vendor/ only after all gates pass.
# It does NOT prove real inference or offline audio generation; these need browser tests.
set -Eeuo pipefail
IFS=$'\n\t'
umask 022

readonly SCRIPT_VERSION='2.0.0'
readonly UPSTREAM_REPO='https://github.com/hemanth/sanskrit-tts-web.git'
readonly TEST_REPO_HTTPS='https://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test'
readonly TEST_REPO_SSH='git@github.com:shreevidyamatabhuvanesvari-gif/swar-sadhika-test'
readonly EXPECTED_ENGINE_EXPORT='VagdhenuWebEngine'

log()  { printf '[fetch-vagdhenu %s] %s\n' "$SCRIPT_VERSION" "$*"; }
warn() { printf '[fetch-vagdhenu %s] WARNING: %s\n' "$SCRIPT_VERSION" "$*" >&2; }
fail() { local code="$1"; shift; printf '[fetch-vagdhenu %s] ERROR: %s\n' "$SCRIPT_VERSION" "$*" >&2; exit "$code"; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
VENDOR_ROOT="$ROOT/vendor"
DEST="$VENDOR_ROOT/vagdhenu-upstream"

# Hard safety boundary: this script may only mutate the explicitly named TEST repo.
[[ "$(basename -- "$ROOT")" != 'anujadha' ]] || fail 2 'Safety stop: the main app anujadha must never be modified.'
[[ -d "$ROOT/.git" || -f "$ROOT/.git" ]] || fail 2 'No Git work tree found; run this script from scripts/ inside a checked-out test repository.'
ORIGIN="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
ORIGIN="${ORIGIN%/}"
ORIGIN="${ORIGIN%.git}"
case "$ORIGIN" in
  "$TEST_REPO_HTTPS"|"$TEST_REPO_SSH"|"https://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test"|"git@github.com:shreevidyamatabhuvanesvari-gif/swar-sadhika-test") ;;
  *) fail 2 "Safety stop: expected origin $TEST_REPO_HTTPS but found '${ORIGIN:-<none>}' . No files changed." ;;
esac
[[ ! -L "$VENDOR_ROOT" ]] || fail 2 'Safety stop: vendor/ is a symlink.'
[[ ! -L "$DEST" ]] || fail 2 'Safety stop: vendor/vagdhenu-upstream is a symlink.'

for cmd in git node tar find grep sort xargs sha256sum awk mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || fail 2 "Required command is missing: $cmd"
done

# Explicit SHA = reproducible; unset SHA = resolve upstream HEAD once and record it.
REQUESTED_COMMIT="${VAGDHENU_UPSTREAM_COMMIT:-}"
if [[ -n "$REQUESTED_COMMIT" ]]; then
  [[ "$REQUESTED_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail 2 'VAGDHENU_UPSTREAM_COMMIT must be a full 40-character Git commit SHA.'
  REQUESTED_COMMIT="${REQUESTED_COMMIT,,}"
else
  log 'No commit supplied: resolving upstream HEAD now; the resolved full SHA will be recorded.'
fi

# Do not accept arbitrary repositories via environment variables.
if [[ -n "${VAGDHENU_UPSTREAM_REPO:-}" && "${VAGDHENU_UPSTREAM_REPO%/}" != "$UPSTREAM_REPO" ]]; then
  fail 2 "Only the reviewed upstream is permitted: $UPSTREAM_REPO"
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/swar-vagdhenu-fetch.XXXXXX")"
STAGED=''
BACKUP="$VENDOR_ROOT/.vagdhenu-upstream-backup.$$"
SWAP_IN_PROGRESS=0
HAD_OLD_DEST=0
META_FILES=(VAGDHENU_UPSTREAM_COMMIT.txt VAGDHENU_VENDOR_STATUS.md UPSTREAM_RUNTIME_IMPORT_AUDIT.md)

cleanup() {
  local rc=$?
  if [[ "$SWAP_IN_PROGRESS" == '1' ]]; then
    # Roll back the vendor directory.
    if [[ -e "$DEST" ]]; then rm -rf -- "$DEST" || true; fi
    if [[ "$HAD_OLD_DEST" == '1' && -e "$BACKUP" ]]; then
      mv -- "$BACKUP" "$DEST" || printf '[fetch-vagdhenu] CRITICAL: vendor rollback failed: %s\n' "$BACKUP" >&2
    fi
    # Restore metadata too, including restoring nonexistence for files that did not exist.
    for name in "${META_FILES[@]}"; do
      if [[ -f "$WORK/meta-backups/$name" ]]; then
        cp -- "$WORK/meta-backups/$name" "$VENDOR_ROOT/$name" || true
      else
        rm -f -- "$VENDOR_ROOT/$name" || true
      fi
    done
  fi
  [[ -z "$STAGED" || ! -d "$STAGED" ]] || rm -rf -- "$STAGED"
  [[ ! -d "$WORK" ]] || rm -rf -- "$WORK"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p -- "$VENDOR_ROOT" "$WORK/meta-backups"
[[ ! -e "$BACKUP" ]] || fail 2 "Unexpected backup already exists: $BACKUP"
# Snapshot preexisting metadata so a later failure does not leave mixed provenance records.
for name in "${META_FILES[@]}"; do
  [[ ! -f "$VENDOR_ROOT/$name" ]] || cp -- "$VENDOR_ROOT/$name" "$WORK/meta-backups/$name"
done

log "Upstream: $UPSTREAM_REPO"
if [[ -z "$REQUESTED_COMMIT" ]]; then
  REMOTE_HEAD="$(git ls-remote "$UPSTREAM_REPO" HEAD 2>/dev/null | awk 'NR==1 {print $1}')" || fail 3 'Cannot reach upstream to resolve HEAD. Check GitHub/network access.'
  [[ "$REMOTE_HEAD" =~ ^[0-9a-fA-F]{40}$ ]] || fail 3 'Upstream did not return a valid full commit SHA.'
  REQUESTED_COMMIT="${REMOTE_HEAD,,}"
fi
log "Pinned upstream commit: $REQUESTED_COMMIT"

if ! git clone --no-checkout "$UPSTREAM_REPO" "$WORK/upstream"; then
  fail 3 'Could not clone the upstream repository. Existing vendor files were not changed.'
fi
if ! git -C "$WORK/upstream" cat-file -e "${REQUESTED_COMMIT}^{commit}" 2>/dev/null; then
  git -C "$WORK/upstream" fetch --no-tags origin "$REQUESTED_COMMIT" >/dev/null 2>&1 || fail 3 "Pinned commit is unavailable upstream: $REQUESTED_COMMIT"
fi
git -C "$WORK/upstream" checkout --detach "$REQUESTED_COMMIT" >/dev/null 2>&1 || fail 3 'Could not check out the pinned commit.'
ACTUAL_COMMIT="$(git -C "$WORK/upstream" rev-parse HEAD)"
[[ "${ACTUAL_COMMIT,,}" == "${REQUESTED_COMMIT,,}" ]] || fail 3 'Checked-out SHA differs from the requested SHA.'

# Identify the REAL module, not a guessed filename or prose placeholder.
ENTRY_REL="${VAGDHENU_ENGINE_ENTRY:-}"
if [[ -n "$ENTRY_REL" ]]; then
  case "$ENTRY_REL" in
    /*|..|../*|*/../*|*/..) fail 5 'VAGDHENU_ENGINE_ENTRY must be a safe path relative to the upstream repository root.' ;;
  esac
  [[ -f "$WORK/upstream/$ENTRY_REL" ]] || fail 5 "Configured engine entry not found: $ENTRY_REL"
else
  mapfile -t ENTRIES < <(
    find "$WORK/upstream" -type d \( -name .git -o -name node_modules -o -name .next -o -name .cache \) -prune -o \
      -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0 |
      xargs -0 -r grep -IlE 'export[[:space:]]+(default[[:space:]]+)?class[[:space:]]+VagdhenuWebEngine|export[[:space:]]*\{[^}]*VagdhenuWebEngine' 2>/dev/null || true
  )
  if [[ "${#ENTRIES[@]}" -ne 1 ]]; then
    fail 5 "Expected exactly one engine module exporting $EXPECTED_ENGINE_EXPORT; found ${#ENTRIES[@]}. Set VAGDHENU_ENGINE_ENTRY only after inspecting the pinned source. No existing engine files changed."
  fi
  ENTRY_REL="${ENTRIES[0]#"$WORK/upstream"/}"
fi

SOURCE_ENTRY="$WORK/upstream/$ENTRY_REL"
[[ -s "$SOURCE_ENTRY" ]] || fail 5 "Engine entry is empty or missing: $ENTRY_REL"
[[ "$ENTRY_REL" =~ ^[A-Za-z0-9._/-]+$ ]] || fail 5 'Engine entry path contains unsupported characters.'
grep -Eq 'export[[:space:]]+(default[[:space:]]+)?class[[:space:]]+VagdhenuWebEngine|export[[:space:]]*\{[^}]*VagdhenuWebEngine' "$SOURCE_ENTRY" || fail 5 'Selected file does not explicitly export the expected VagdhenuWebEngine class/function.'
grep -Eq 'synthesizeInBrowser' "$SOURCE_ENTRY" || fail 5 'The selected module does not expose the expected synthesizeInBrowser API.'
grep -Eq 'initOnnxSessions' "$SOURCE_ENTRY" || fail 5 'The selected module does not expose the expected initOnnxSessions API.'
if ! node --input-type=module --check < "$SOURCE_ENTRY"; then
  fail 6 "Upstream engine entry is not valid JavaScript module syntax: $ENTRY_REL"
fi

# A static GitHub Pages site cannot resolve bare npm specifiers without a build step.
BARE_IMPORTS="$(grep -RInE --include='*.js' --include='*.mjs' --include='*.cjs' \
  "(from[[:space:]]*[\"'][^./][^\"']*[\"']|import[[:space:]]*\\([[:space:]]*[\"'][^./][^\"']*[\"']\\))" \
  "$WORK/upstream" --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null | grep -vE 'https?://' || true)"
if [[ -n "$BARE_IMPORTS" ]]; then
  printf '%s\n' "$BARE_IMPORTS" > "$WORK/BARE_IMPORTS.txt"
  printf '%s\n' "$BARE_IMPORTS" >&2
  fail 7 'Upstream has bare npm imports that GitHub Pages cannot resolve as-is. Bundle/rewrite those dependencies before activation.'
fi

# Remote executable code or WASM means the source is not a complete offline bundle.
# Remote Hugging Face model artifacts are allowed: model-cache.js downloads/verifies those.
REMOTE_RUNTIME="$(grep -RInE --include='*.js' --include='*.mjs' --include='*.cjs' \
  "(import[[:space:]]*\\([[:space:]]*[\"']https?://|from[[:space:]]*[\"']https?://|import[[:space:]]*[\"']https?://|script\\.src[[:space:]]*=.*https?://|https?://[^\"'[:space:]]+\\.(mjs|js|wasm)([?#\"'[:space:]]|\$)|onnxruntime-web@[^\"'[:space:]]*/dist/)" \
  "$WORK/upstream" --exclude-dir=.git --exclude-dir=node_modules 2>/dev/null | grep -vi 'huggingface.co/.*/resolve/.*/.*\.onnx' || true)"
if [[ -n "$REMOTE_RUNTIME" ]]; then
  printf '%s\n' "$REMOTE_RUNTIME" > "$WORK/REMOTE_RUNTIME_IMPORTS.txt"
  printf '%s\n' "$REMOTE_RUNTIME" >&2
  fail 7 'Upstream still references remote executable JS/WASM/runtime assets. Vendor and pin those assets locally before activation; this script will not label an incomplete bundle offline-ready.'
fi

# Legal gate: ONNX model weights are separately licensed; their MIT label is NOT
# treated as permission to redistribute the browser-engine source code.
LICENSE_FILE="$(find "$WORK/upstream" -maxdepth 1 -type f \( -iname LICENSE -o -iname 'LICENSE.*' -o -iname LICENCE -o -iname 'LICENCE.*' -o -iname COPYING -o -iname 'COPYING.*' \) -print -quit)"
PERMISSION_REL="${VAGDHENU_PERMISSION_EVIDENCE_FILE:-docs/VAGDHENU-UPSTREAM-PERMISSION.md}"
PERMISSION_FILE=''
if [[ -n "$LICENSE_FILE" ]]; then
  if ! grep -Eqi 'MIT License|Apache License|BSD [123]-Clause|ISC License|Mozilla Public License' "$LICENSE_FILE"; then
    warn "Found a top-level license file but could not identify a reviewed permissive license: $(basename -- "$LICENSE_FILE")"
    LICENSE_FILE=''
  fi
fi
if [[ -z "$LICENSE_FILE" ]]; then
  case "$PERMISSION_REL" in
    /*|..|../*|*/../*|*/..) fail 4 'Permission evidence path must be repository-relative.' ;;
  esac
  PERMISSION_FILE="$ROOT/$PERMISSION_REL"
  [[ -s "$PERMISSION_FILE" ]] || fail 4 "BLOCKED: upstream browser-source license/permission is not established. Add verified written permission at $PERMISSION_REL for this exact commit, or obtain a clear upstream source license. The model-weights license is not enough."
  grep -Fq "Repository: $UPSTREAM_REPO" "$PERMISSION_FILE" || fail 4 'Permission evidence does not identify the exact upstream repository.'
  grep -Fq "Commit: $ACTUAL_COMMIT" "$PERMISSION_FILE" || fail 4 'Permission evidence must name the exact pinned commit SHA.'
  grep -Eqi '^Grantor:[[:space:]]*[^[:space:]].*' "$PERMISSION_FILE" || fail 4 'Permission evidence must identify the grantor.'
  grep -Eqi '^Permission date:[[:space:]]*[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]*$' "$PERMISSION_FILE" || fail 4 'Permission evidence must include Permission date: YYYY-MM-DD.'
  grep -Eqi '^Written permission:[[:space:]]*GRANTED[[:space:]]*$' "$PERMISSION_FILE" || fail 4 'Permission evidence must explicitly record Written permission: GRANTED.'
  grep -Eqi 'redistribut(e|ion)' "$PERMISSION_FILE" || fail 4 'Permission evidence must cover redistribution.'
  grep -Eqi 'modify|modification' "$PERMISSION_FILE" || fail 4 'Permission evidence must cover modification.'
  grep -Eqi 'offline.*(cache|cach(e|ing))|(cache|cach(e|ing)).*offline' "$PERMISSION_FILE" || fail 4 'Permission evidence must cover offline browser caching.'
  grep -Eqi 'swar-sadhika-test' "$PERMISSION_FILE" || fail 4 'Permission evidence must name swar-sadhika-test as the destination.'
fi


# Stage the exact source tree while preserving all relative imports. The public
# adapter always loads vendor/vagdhenu-upstream/vagdhenu-onnx.js, so create a tiny
# named-export bridge to the discovered module instead of guessing its path.
STAGED="$(mktemp -d "$VENDOR_ROOT/.vagdhenu-stage.XXXXXX")"
mkdir -p "$STAGED/source"
if ! (cd "$WORK/upstream" && tar --exclude='.git' --exclude='node_modules' --exclude='.DS_Store' -cf - .) | (cd "$STAGED/source" && tar -xf -); then
  fail 8 'Could not stage upstream source. Existing vendor files remain intact.'
fi
[[ -s "$STAGED/source/$ENTRY_REL" ]] || fail 8 'Staged engine entry is missing.'
if ! node --input-type=module --check < "$STAGED/source/$ENTRY_REL"; then
  fail 8 'Staged engine entry failed syntax validation.'
fi

# Bridge import path uses the original directory layout under source/.
cat > "$STAGED/vagdhenu-onnx.js" <<BRIDGE
// Generated by scripts/fetch-vagdhenu-engine.sh; do not hand-edit.
// Upstream repository: $UPSTREAM_REPO
// Upstream commit: $ACTUAL_COMMIT
export { VagdhenuWebEngine } from './source/$ENTRY_REL';
BRIDGE
node --input-type=module --check < "$STAGED/vagdhenu-onnx.js" || fail 8 'Generated engine bridge failed syntax validation.'

if [[ -n "$LICENSE_FILE" ]]; then
  cp -- "$LICENSE_FILE" "$STAGED/UPSTREAM_SOURCE_LICENSE.txt"
else
  cp -- "$PERMISSION_FILE" "$STAGED/UPSTREAM_PERMISSION_EVIDENCE.md"
fi

# Audit runtime/model URLs and all fetched-file hashes. These are provenance records,
# not a substitute for browser inference or an offline device test.
{
  printf '# Vāgdhenu source/runtime audit\n\n'
  printf -- '- Upstream repository: %s\n' "$UPSTREAM_REPO"
  printf -- '- Pinned commit: %s\n' "$ACTUAL_COMMIT"
  printf -- '- Detected engine module: %s\n' "$ENTRY_REL"
  printf -- '- Bridge: vendor/vagdhenu-upstream/vagdhenu-onnx.js\n'
  printf -- '- Source license/permission gate: PASS (human/legal review remains the maintainer’s responsibility)\n'
  printf -- '- JavaScript entry syntax: PASS\n'
  printf -- '- Expected API symbol check: PASS (name presence is not inference proof)\n'
  printf -- '- Remote executable JS/WASM references: none found by this static scan\n'
  printf '\n## Model/runtime policy\n\n'
  printf 'The three ONNX files and baked prosody bank are intentionally not committed to GitHub Pages. They should be fetched at first run by the app model-cache implementation from a pinned Hugging Face revision with digest and byte-size verification.\n'
  printf 'This script does not certify model compatibility, ONNX session creation, audio output, Android playback, or offline inference.\n\n'
  grep -RInI -E 'https?://|\.onnx|\.wasm|baked_bank|onnxruntime-web' "$STAGED/source" \
    --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.html' --include='*.json' --include='*.md' || true
} > "$STAGED/UPSTREAM_RUNTIME_IMPORT_AUDIT.md"
(
  cd "$STAGED"
  find . -type f ! -name 'VAGDHENU_FILE_SHA256SUMS.txt' -print0 | sort -z | xargs -0 -r sha256sum
) > "$STAGED/VAGDHENU_FILE_SHA256SUMS.txt"

cat > "$STAGED/VAGDHENU_VENDOR_STATUS.md" <<STATUS
# Vāgdhenu browser source — Swar-Sadhika test repository

- Script version: $SCRIPT_VERSION
- Upstream repository: $UPSTREAM_REPO
- Pinned source commit: $ACTUAL_COMMIT
- Detected upstream entry: $ENTRY_REL
- Canonical module loaded by the app: vendor/vagdhenu-upstream/vagdhenu-onnx.js
- Source/permission gate: PASS (human review evidence recorded)
- Entry syntax check: PASS
- Expected API symbol check: PASS; this is not an inference test
- Remote executable JS/WASM static scan: PASS (no matched external runtime references)
- SHA-256 file manifest: VAGDHENU_FILE_SHA256SUMS.txt
- Runtime/model audit: UPSTREAM_RUNTIME_IMPORT_AUDIT.md

## Not certified by this script

- All relative imports resolve in Android Chrome/GitHub Pages
- All dependencies have compatible licenses and are locally complete
- ONNX Runtime sessions initialize on the target phone
- Model files match the source revision and engine
- A fresh, non-empty Sanskrit audio output is generated and plays correctly
- Fresh synthesis succeeds after the network is disabled
- The result meets the target feminine-friendly melodic quality

Do not mark AI inference or offline readiness PASS until these are tested in the deployed Android app.
STATUS

# Prepare root-level metadata for existing test-repo workflows.
printf '%s\n' "$ACTUAL_COMMIT" > "$WORK/VAGDHENU_UPSTREAM_COMMIT.txt"
cp -- "$STAGED/VAGDHENU_VENDOR_STATUS.md" "$WORK/VAGDHENU_VENDOR_STATUS.md"
cp -- "$STAGED/UPSTREAM_RUNTIME_IMPORT_AUDIT.md" "$WORK/UPSTREAM_RUNTIME_IMPORT_AUDIT.md"

# Swap only this vendor subtree; preserve the previous directory until final commit.
if [[ -e "$DEST" ]]; then
  mv -- "$DEST" "$BACKUP"
  HAD_OLD_DEST=1
fi
SWAP_IN_PROGRESS=1
if ! mv -- "$STAGED" "$DEST"; then
  fail 9 'Could not activate staged source; rollback will restore the previous vendor directory.'
fi
STAGED=''

for name in "${META_FILES[@]}"; do
  mv -- "$WORK/$name" "$VENDOR_ROOT/.$name.tmp.$$"
  mv -- "$VENDOR_ROOT/.$name.tmp.$$" "$VENDOR_ROOT/$name"
done

# Successful transaction. Remove backup only after all metadata has been written.
[[ "$HAD_OLD_DEST" != '1' || ! -e "$BACKUP" ]] || rm -rf -- "$BACKUP"
SWAP_IN_PROGRESS=0
HAD_OLD_DEST=0

log 'PASS: source was fetched from an exact recorded commit, the license/permission gate passed, the expected API symbols were checked, and no matched remote executable runtime references remained.'
log "Installed source: $DEST"
log "Pinned commit: $ACTUAL_COMMIT"
log 'NOT CERTIFIED: actual model inference, generated audio, Android playback, and network-off synthesis have not been tested by this shell script.'
