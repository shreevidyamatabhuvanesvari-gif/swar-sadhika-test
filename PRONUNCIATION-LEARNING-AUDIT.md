
# Swar-Sadhika — implementation and verification report

## Scope

Changes were made only in this extracted `swar-sadhika-test` working copy. The separate `anujadha` app was not accessed or modified. No GitHub push or GitHub Pages deployment was performed from this workspace.

## Implemented

- Added `pronunciation-learning.js` as a native ES module.
- Integrated a new **स्थानीय उच्चारण-अध्ययन / संदर्भ-संग्रह** section into the AI testing panel via `app.js`.
- Explicit user-selected audio/video input; no automatic gallery scanning.
- Requires user-supplied matching Sanskrit text.
- Audio: local Web Audio decode; descriptors include duration, sample rate, channel count, peak amplitude, mean RMS, quiet-frame ratio, and a rough sampled autocorrelation pitch estimate (only sampled frames from first 20 seconds; up to 180 seconds of signal for basic measurements).
- Video: local playback through Web Audio analyser, sampling RMS/quiet frames for up to 20 seconds; no pitch or phoneme analysis in this path.
- IndexedDB storage of text and derived measurements; original media is not persisted by this module.
- List, individual delete, clear-all with confirmation, and JSON export controls.
- Explicit status/limitations: no model weights are trained, and stored descriptors are not yet fed into the singing engine.

## Validation performed

- `node --check app.js` — PASS.
- `node --check index.js` — PASS.
- `node --check vagdhenu-onnx.js` — PASS.
- `node --check vagdhenu-text.js` — PASS.
- `node --check pronunciation-learning.js` — PASS.
- `vagdhenu-text.js` exported self-test suite — 14 passed, 0 failed.
- ZIP archive integrity — to be checked after packaging.

## Important known limitations / unresolved blockers

1. **Not AI training:** this is a local acoustic descriptor notebook, not neural fine-tuning, not weight adaptation, and not a demonstrated improvement to generated Sanskrit singing.
2. **No engine integration of stored features yet:** the current adapter's synthesis contract does not define an input for these records. We must first verify a supported conditioning/control path or select a model that can consume aligned reference audio/features.
3. **Video support is limited:** only a short RMS/quiet-frame sample is taken; it does not identify words, phonemes, Sanskrit pronunciation errors, or Vedic accents.
4. **Audio pitch estimate is heuristic:** it is not validated against reference pitch labels and is not a singing-quality score.
5. **Browser codecs vary:** unsupported files fail explicitly. Audio decoding requires Web Audio API; video sampling needs media playback and Web Audio support.
6. **IndexedDB is not permanent storage guaranteed by the browser:** quota, eviction, private browsing, or clearing site data can remove records.
7. **Offline AI inference remains unverified:** `vagdhenu-onnx.js` imports the upstream engine from external URLs. The full engine source, model weights, and runtime assets are not proven to be bundled/cached locally.
8. **No real Android device test or live GitHub Pages test was completed.** A headless Chromium smoke test was attempted in this environment but timed out before producing a DOM result. No success claim is made for that test.
9. **No GitHub repository changes were pushed.** The attached ZIP is a revised local working copy for review and manual upload/commit to the test repository.

## Next required steps

1. Test the UI and IndexedDB controls on the actual GitHub Pages HTTPS origin and an Android browser.
2. Confirm actual model import/session initialization and audio generation from the existing engine; audit network requests to identify every runtime/model asset.
3. Decide the conditioning interface only after examining the upstream engine/model capabilities. Until that is proven, do not describe the reference notebook as improving AI singing.
4. Test offline after a successful first download, including browser restart and cache-cleared behavior.
