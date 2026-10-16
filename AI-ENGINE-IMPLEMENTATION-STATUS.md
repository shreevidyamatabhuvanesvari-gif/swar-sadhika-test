Swar-Sadhika — AI Engine Implementation Status

1. Purpose and scope

This document records the known implementation state, dependencies, verification requirements, and release limitations of the AI engine in the Swar-Sadhika test repository.

Repository: "shreevidyamatabhuvanesvari-gif/swar-sadhika-test"

GitHub Pages: https://shreevidyamatabhuvanesvari-gif.github.io/swar-sadhika-test/

Protected application: "anujadha" — do not modify it.

Current overall status: NOT VERIFIED for real synthesis, melodic singing, Android reliability, and offline operation.

This document is an engineering status record, not proof that a feature works. Confirm the current source files, commit, deployment, and runtime behavior before marking any requirement as PASS.

2. Evidence boundary

The inspected source archive was:

- Filename: "swar-sadhika-test-patched-2.zip"
- SHA-256: "b21f65e2e3663757cf2075c71e106ce62c74cb1a93bce4d1516b361fd82840a4"
- Archive root: "swar-sadhika-test-main/"
- File entries: 23

The archive passed a ZIP structural-integrity check. It did not contain a complete, verified local package of all required upstream engine code, runtime assets, and model weights.

These findings apply to that archive. They do not independently prove the current contents of the GitHub repository or the deployed website.

3. Intended engine objective

The long-term goal is to provide a browser-based Sanskrit vocal-generation experience suitable for Android devices.

The intended input includes Sanskrit shlokas, mantras, stotras, Vedic passages, and other Sanskrit texts.

The desired output should provide clear pronunciation and, where the selected engine genuinely supports it, melodious and rhythmically coherent singing.

The following capabilities must be evaluated separately:

1. Sanskrit text handling.
2. Text-to-speech or spoken recitation.
3. Chant-like rhythmic recitation.
4. Independent melodic singing.
5. Actual audio generation and playback.
6. Android browser compatibility.
7. Offline synthesis after required resources have been downloaded.

Success in one category does not establish success in the others.

4. Known implementation areas

The inspected archive includes these implementation areas:

- "app.js" — application integration and user-interface behavior.
- "vagdhenu-onnx.js" — engine adapter.
- "vagdhenu-text.js" — text-related functionality.
- "model-cache.js" — model-download and browser-cache logic.
- "service-worker.js" — application and selected resource caching.
- "index.js" — JavaScript entry point.
- "pronunciation-learning.js" — local pronunciation-reference functionality.

The current GitHub version of each file must be inspected before changing its code. The existence of a file is not proof that its implementation is complete or correct.

5. Engine adapter and backend contract

The inspected project documentation identifies the public backend values as:

- "wasm"
- "onnx"

The adapter is documented as mapping the public "onnx" value to an upstream "webgpu" label.

This mapping requires verification against the exact upstream engine revision and its supported backend configuration.

Required checks:

1. Identify the precise upstream engine and version.
2. Inspect its public API and backend names.
3. Verify that the adapter calls the correct initialization method.
4. Verify that every required import resolves.
5. Confirm that the selected backend is actually available in the target browser.
6. Report unsupported backends and initialization errors accurately.
7. Never fabricate successful initialization or audio output after an error.

A backend name appearing in a menu or being accepted by an adapter is not evidence of successful inference.

6. Upstream runtime and model dependencies

The inspected "vagdhenu-onnx.js" attempts to load upstream engine code from external static URLs.

The inspected archive did not contain a complete, verified local package of all upstream engine code, runtime files, and model weights.

Consequently, a fully self-contained, offline-first engine has not been established.

Before packaging dependencies locally:

1. Identify the authoritative upstream repository.
2. Pin and record an exact revision or release.
3. Review its license and redistribution requirements.
4. Inspect the complete dependency graph, including nested imports.
5. Identify required JavaScript, WASM, runtime, and model files.
6. Confirm paths, file sizes, MIME types, and content types.
7. Check cross-origin restrictions and redirects.
8. Verify model integrity against trusted expected digests where available.
9. Test the packaged engine on the intended Android browser.
10. Confirm that no essential dependency silently falls back to the network.

Do not assume that downloading one JavaScript adapter supplies the full engine.

Do not execute an unverified vendor-fetch workflow or overwrite repository files without reviewing its exact effects.

7. Model caching and integrity

"model-cache.js" is documented as supporting model downloads and browser Cache Storage.

Caching is a storage mechanism, not proof of successful model execution.

The following are separate states:

- Download request initiated.
- HTTP response received.
- Expected file downloaded completely.
- File type and size checked.
- Integrity verified.
- File stored in cache.
- Runtime successfully loads the file.
- Model initializes on the selected backend.
- Real inference completes.
- Valid audio is returned.
- Audio playback succeeds.

A cached response may be incomplete, incorrect, incompatible, stale, or unavailable after browser storage eviction.

Do not report model integrity as verified unless a trusted expected digest or equivalent integrity mechanism is actually checked.

Do not claim a fixed model size without evidence from the exact model artifacts being used.

8. Service-worker and offline requirements

"service-worker.js" must be inspected at the exact tested commit.

Verify:

- The registered service-worker path and scope.
- The active cache names and versioning.
- The application shell resources being cached.
- The external runtime and model URL allowlists.
- Cache-first, network-first, and fallback behavior.
- Handling of failed requests and opaque responses.
- Cache invalidation when the application is updated.
- Whether every required dependency is available after disconnection.

Service-worker registration, a successful fetch, a cache entry, or an offline page load is not proof of offline synthesis.

An offline test passes only when the required resources are available without network access, the actual model initializes, real Sanskrit inference completes, valid audio is produced, and that audio plays successfully while the network remains disconnected.

9. Required inference and playback contract

A successful AI synthesis request must not be declared complete merely because a promise resolves or a status message appears.

The implementation and tests must establish that:

1. The engine receives the intended Sanskrit input.
2. The selected backend initializes successfully.
3. Actual inference executes.
4. The result contains valid, non-empty audio data.
5. The audio data has a supported format or is converted correctly.
6. The audio duration is greater than zero.
7. The browser can play the generated result.
8. Playback is actually audible on the target device.
9. Errors are surfaced without substituting fabricated success.
10. Repeated requests do not create unintended duplicate playback.

Record the actual result and relevant errors for every test.

10. Sanskrit pronunciation and singing quality

The ability to process Devanagari text does not establish accurate Sanskrit pronunciation.

Quality testing should use a defined reference set covering, where relevant:

- Independent vowels and vowel signs.
- Consonants and aspirated consonants.
- Retroflex and dental contrasts.
- Anusvara and visarga.
- Conjunct consonants.
- Difficult Sanskrit compounds.
- Vedic accent marks and other supported Vedic notation.
- Representative shlokas, mantras, stotras, and Vedic passages.

Use qualified human review and reproducible examples to assess pronunciation.

Evaluate melodic singing separately from speech and chant-like recitation. A voice that reads Sanskrit clearly is not automatically a singing engine.

Do not claim universal Sanskrit correctness, correct Vedic accentuation, or independent melodic singing without evidence.

11. Android browser compatibility

The application must be tested on the intended Android device and browser, not only on a desktop development environment.

Record:

- Device and Android version.
- Browser name and version.
- Git commit SHA.
- Deployment URL.
- Network conditions.
- Selected backend.
- Module-loading and initialization results.
- Actual Sanskrit input.
- Inference outcome.
- Audio format, byte size, and duration.
- Whether playback was actually audible.
- Console and network errors.
- Storage and offline test results.

Browser support for WebAssembly, WebGPU, media playback, IndexedDB, Cache Storage, and audio decoding may vary. Verify each required capability rather than assuming availability.

12. Relationship to pronunciation-reference storage

The local pronunciation-reference workflow is documented as storing Sanskrit text and derived acoustic descriptors in IndexedDB.

This is not, by itself, model training or engine conditioning.

The engine must not be described as learning from reference recordings unless an implemented and tested mechanism actually consumes the reference data.

Any claim that reference data improves generated singing requires a reproducible comparison using defined test inputs and evaluation criteria.

13. Acceptance-test register

All statuses below remain NOT VERIFIED until current evidence is collected.

Requirement| Required evidence| Status
Current repository identified| Repository URL and exact commit SHA| NOT VERIFIED
Deployment matches intended commit| Verified deployed files or equivalent evidence| NOT VERIFIED
Required imports load| Browser console and network evidence| NOT VERIFIED
Backend initializes| Actual initialization result| NOT VERIFIED
Real inference completes| Valid result from a real Sanskrit input| NOT VERIFIED
Valid audio is returned| Supported format, non-zero size and duration| NOT VERIFIED
Audio playback works| Audible playback on target device| NOT VERIFIED
Sanskrit pronunciation assessed| Reproducible examples and human review| NOT VERIFIED
Independent melodic singing assessed| Audio evidence and defined evaluation| NOT VERIFIED
Android compatibility assessed| Device/browser test record| NOT VERIFIED
Runtime assets packaged locally| Verified files and dependency paths| NOT VERIFIED
Model integrity checked| Trusted expected digest or equivalent check| NOT VERIFIED
Offline synthesis succeeds| Successful inference and playback without network| NOT VERIFIED
Regression tests pass| Relevant existing behavior tested after changes| NOT VERIFIED

A test may be marked PASS only when the required evidence exists. Use FAIL when an executed test does not meet its acceptance criteria. Keep unexecuted tests as NOT VERIFIED.

14. Required evidence record

For each test, preserve:

- Test date and time.
- Exact commit SHA.
- Device, operating system, and browser version.
- Network state.
- Input text and selected backend.
- Relevant console and network output.
- Runtime initialization result.
- Inference result.
- Audio format, size, and duration.
- Playback outcome.
- Pronunciation and singing-quality observations.
- Offline test steps and outcome, where applicable.
- Known defects and limitations.

Do not include private credentials, access tokens, or unrelated personal data in public logs or repository files.

15. Change-control policy

All work in this phase must remain in "swar-sadhika-test".

Do not modify "anujadha".

Before changing implementation files:

1. Inspect the current committed source.
2. Identify the relevant imports and dependencies.
3. Check for regressions and unintended scope changes.
4. Make the smallest appropriate change.
5. Review the resulting diff.
6. Commit one reviewed file or clearly scoped change at a time.
7. Test the exact committed version.
8. Record the observed result without overstating it.

Documentation must remain consistent with actual code and evidence.

16. Release decision

The inspected archive and documented code structure do not establish successful real AI inference, independent melodic singing, reliable Android playback, or complete offline operation.

Current release status: NOT VERIFIED.

Do not claim production readiness, guaranteed Sanskrit pronunciation, fully offline AI operation, or zero defects without sufficient reproducible evidence.

The objective is to build a genuinely useful Sanskrit vocal-generation application. Prioritize verified dependencies, real inference, audible output, careful Android testing, and honest reporting of remaining limitations.
