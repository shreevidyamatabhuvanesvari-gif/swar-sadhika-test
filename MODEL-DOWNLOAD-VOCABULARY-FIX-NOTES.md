# Model download and vocabulary compatibility patch

Scope: `swar-sadhika-test` only. Do not copy these changes to `anujadha`.

## Changes

1. `model-cache.js`: JSON assets served as `text/plain` are no longer rejected solely because of MIME type. Existing immutable-revision integrity verification remains in place; the runtime still JSON-parses the bank before use. `text/html` is still rejected.

2. `vendor/vagdhenu-upstream/vagdhenu-onnx.js`: vocabulary discovery now considers additional vocabulary naming conventions and unlabelled token lists/maps, while enforcing IDs within the model's declared 1,039-token range and unique IDs for fallback token-to-ID maps. It still fails closed if no plausible vocabulary is found; it does not invent token IDs.

## Local checks performed

- JavaScript module syntax check: `model-cache.js` — PASS.
- JavaScript module syntax check: `vendor/vagdhenu-upstream/vagdhenu-onnx.js` — PASS.
- Temporary synthetic vocabulary fixtures: 4/4 PASS (ordered token list, named token-to-ID map, alternate map key, numeric-ID-to-token map); verified 1,039 entries and a known token-ID mapping.

## Not verified

The actual `baked_bank.json` downloaded from Hugging Face was not available inside the supplied ZIP, and this session could not retrieve it from the network. Therefore its exact schema and the live-page download behavior remain unverified. This patch is a defensive compatibility correction, not proof of successful model initialization, inference, audio output, or Android playback.
