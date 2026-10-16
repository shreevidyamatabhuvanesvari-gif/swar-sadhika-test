
# स्वर-साधिका (Swar-Sadhika) — Test Repository

This repository is the testing environment for Swar-Sadhika, a browser-based
application intended to help generate clear, melodious Sanskrit vocal output.

**This is a test repository.** Do not copy its changes into the separate
`anujadha` main application without an independent review.

## 1. Project objective

The long-term objective is to support clear pronunciation and melodious,
rhythmic vocal rendering of Sanskrit shlokas, mantras, stotras, Vedic passages,
and other Sanskrit texts.

The intended experience includes:

- Sanskrit text input and playback controls.
- Better handling of Devanagari characters and conjunct consonants.
- Browser-based execution suitable for Android devices.
- Real audio generation and playback when a compatible engine is available.
- Local model/runtime use where technically and legally feasible.
- Offline operation only after complete end-to-end verification.

Ordinary text-to-speech, rhythmic recitation, and independent melodic singing
are different capabilities. The application must not claim that an engine
supports melodic singing unless actual output demonstrates that capability.

## 2. Current AI engine status

**Status: NOT VERIFIED — successful real synthesis has not been established.**

The application contains an engine adapter and model-cache logic. However,
the presence of these modules does not establish that all required upstream
engine code, runtime assets, model weights, and dependencies are available.

The adapter in `vagdhenu-onnx.js` attempts to load the upstream browser engine.
External imports may still be required.

The supplied ZIP did not contain a complete, verified local engine/runtime/model
package. The repository must not be described as fully self-contained or
offline-ready on this evidence.

A successful page load, module import, HTTP response, model download, cache
entry, or initialization message is not proof of successful inference.

The AI panel must not be considered passing until all of the following have
been tested:

1. Required engine modules and runtime assets load.
2. A compatible backend initializes successfully.
3. Real Sanskrit input is accepted by the engine.
4. Actual inference completes without an error.
5. Non-empty, valid audio data is returned.
6. The generated audio can be played and heard.
7. The target Android browser is tested.
8. Offline synthesis is repeated successfully with the network disconnected,
   if offline operation is claimed.

See `AI-ENGINE-IMPLEMENTATION-STATUS.md` for the detailed verification
checklist. That file must be kept consistent with actual repository and test
evidence.

## 3. Backend contract

The reviewed application interface uses the public backend names:

- `wasm`
- `onnx`

The adapter contains a mapping from the public `onnx` value to an upstream
`webgpu` label. This mapping must be verified against the actual upstream
engine and execution provider.

Do not assume that a backend works because its name appears in the UI or
because an adapter accepts the value.

Record initialization failures and unsupported-backend errors accurately.
Never return fabricated success or fabricated audio after a failure.

## 4. Local pronunciation-reference panel

The AI testing panel includes a local pronunciation-reference workflow.

The documented workflow is:

1. The user explicitly selects an audio or video file from the device.
2. The user enters or validates the corresponding Sanskrit text.
3. Audio files can be analyzed locally, subject to browser decoding support.
   The implemented analysis includes approximate RMS, quiet-frame ratio,
   peak amplitude, and a sampled autocorrelation-based pitch estimate.
4. Video files are sampled locally for limited audio descriptors.
5. Text and derived descriptors can be stored in IndexedDB.
6. Stored records can be listed, deleted individually, cleared, or exported
   as JSON where those controls are available.

This workflow is local analysis and reference storage, **not AI training**.

The collected records must not be described as improving generated singing
unless an actual learning or conditioning mechanism consumes them and the
improvement is evaluated.

Browser codec support, storage quota, and browser eviction can affect this
feature. Verify actual behavior on the target Android browser.

## 5. Model download and caching

The application includes model-cache functionality intended to download
selected model artifacts and store them in browser Cache Storage.

Downloading or caching a model is not proof that:

- The downloaded file is the correct model.
- Its integrity has been verified.
- The runtime can load it.
- The selected backend is compatible.
- Inference succeeds.
- Audio playback works.
- All required files are available offline.

Model size, content type, HTTP status, redirects, cross-origin restrictions,
browser storage limits, and cache eviction must be checked against actual
downloads and runtime behavior.

Do not claim verified model integrity unless a trusted expected digest or
equivalent integrity check has actually been applied.

## 6. Service worker and offline behavior

`service-worker.js` is responsible for caching selected application resources
and, where configured, selected runtime or model requests.

The actual committed service-worker code must be inspected before describing
its cache strategy or claiming that an update is deployed.

The following are separate verification states:

- Application shell cached.
- JavaScript modules cached.
- Runtime and WASM assets cached.
- Model weights cached.
- All required dependencies available.
- Real inference successful.
- Audio playback successful.
- Full synthesis workflow successful without a network connection.

Service-worker registration and cache inspection alone do not establish
offline inference.

When testing an updated deployment, record the actual commit, browser,
cache state, network conditions, and observed result. A stale cached file can
make an older application version appear to remain active.

## 7. Local development

Serve the repository over HTTPS or localhost so native ES modules and
IndexedDB can operate in a suitable browser origin.

For example:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

This command only serves the local files. It does not install the upstream
engine, download model weights, or prove successful audio generation.

## 8. Upstream engine and dependency requirements

Before packaging upstream source code or runtime assets:

1. Verify the upstream repository and exact revision.
2. Review its license and applicable redistribution requirements.
3. Inspect every nested JavaScript import.
4. Identify the actual runtime JavaScript and WASM files.
5. Identify the required model weights and their source.
6. Verify paths and MIME types on GitHub Pages.
7. Check for external network dependencies.
8. Test the complete engine in the intended browser.

The archive contains a vendor-fetch script and a GitHub Actions workflow, but
their presence does not prove that the workflow ran successfully or that the
upstream engine has been included in the deployed repository.

Do not execute an unverified vendor workflow or overwrite repository files
without checking the target repository and intended changes.

All testing and changes described here must remain confined to
`swar-sadhika-test`. Do not modify `anujadha`.

## 9. Required test evidence

Maintain a record of:

- Exact Git commit tested.
- Browser and device.
- Network availability.
- Console and network errors.
- Runtime and backend initialization results.
- Actual Sanskrit input used.
- Whether inference completed.
- Audio format, non-zero size, and duration.
- Whether the generated audio was actually heard.
- Pronunciation and singing-quality observations.
- Offline test procedure and outcome, if applicable.
- Remaining failures and limitations.

Mark a test PASS only when the required evidence exists. Tests that have not
been executed must remain NOT VERIFIED.

## 10. Release policy

The following claims are not established merely by the current code or UI:

- Successful real AI inference.
- Correct Sanskrit pronunciation across all supported texts.
- Independent melodic singing.
- Reliable Android audio playback.
- Complete offline operation.
- Zero known defects.
- Production readiness.

The objective is a genuinely useful voice-generation application. Prefer
small, reviewed changes and preserve existing functionality. Never replace
working modules merely to make the repository appear complete.

**Current release decision: NOT VERIFIED.**
