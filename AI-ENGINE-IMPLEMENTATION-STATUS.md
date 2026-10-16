# Swar-Sadhika — AI Engine Implementation Status

**Project:** Swar-Sadhika  
**Repository:** https://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test  
**GitHub Pages:** https://shreevidyamatabhuvanesvari-gif.github.io/swar-sadhika-test/  
**Status date:** 2026-10-17  
**Status:** INCOMPLETE — REAL INFERENCE AND OFFLINE OPERATION NOT VERIFIED

---

## 1. Primary Objective

Swar-Sadhika is intended to be an Android-friendly, browser-based Sanskrit
singing application.

Its primary objective is to produce clear, melodious, feminine-friendly
singing of Sanskrit and Devanagari texts, including:

- Shlokas
- Mantras
- Stotras
- Vedic hymns and Rgvedic verses
- Other Sanskrit devotional and traditional texts

The intended experience is a usable personal virtual singing voice, not merely
text analysis, ordinary speech synthesis, a demonstration page, or an external
studio link.

The implementation must prioritize the actual generation and playback of
audio from the user's supplied text.

## 2. Non-Negotiable Project Constraints

1. Work only in the testing repository identified above.
2. Do not modify the separate main application named `anujadha`.
3. Do not introduce a paid AI API, paid subscription, mandatory API key,
   cloud inference service, or separately operated inference server.
4. Target browser-local inference on Android-compatible browsers.
5. An initial internet connection may be needed to download permitted model
   files and runtime assets.
6. After all required assets have been downloaded and cached successfully,
   offline operation must be tested rather than assumed.
7. Do not replace real AI singing with ordinary TTS, prerecorded audio,
   generated placeholder audio, or a simulated success message.
8. Do not describe a feature as implemented or verified without evidence.
9. Preserve the user's original Sanskrit text unless a clearly identified,
   optional transformation is explicitly requested.
10. Do not silently remove existing functionality or overwrite unrelated files.
11. Do not use MIT as the project's chosen license.
12. Respect the actual licenses and permissions of all third-party source code,
    libraries, model files, model weights, and runtime assets.

## 3. Current Implementation Findings

The following findings are based on the project files and workflow information
available for review. They are not a substitute for a fresh test of the
published GitHub Pages application.

### 3.1 Browser engine adapter

The project contains a file named `vagdhenu-onnx.js`.

The reviewed adapter attempts to import an upstream browser engine from
external static URLs. It contains multiple candidate source URLs.

Consequences:

- The adapter is not, by itself, a complete copy of the upstream engine.
- The adapter does not establish that the complete runtime is included locally.
- The adapter does not establish that all model weights are included locally.
- An external module import may fail because of network availability, CORS,
  browser restrictions, missing exports, or unavailable upstream resources.
- An external import is incompatible with a claim of fully self-contained
  offline inference until all required dependencies are available locally.

**Current result:** A complete, self-contained, locally vendored engine has
not been established by the available evidence.

### 3.2 Sanskrit text utilities

The project contains `vagdhenu-text.js`.

This file provides Sanskrit/Devanagari text-processing utilities and analysis.

Text analysis is not equivalent to AI singing. Its presence does not prove
that a neural model has executed or that audio has been generated.

Any meter identification, pronunciation assessment, or Vedic-mark analysis
must retain its documented limitations unless separately validated.

### 3.3 Model files and browser cache

The project contains `model-cache.js`, which provides functionality intended
to download and cache model assets.

The project has referenced these model repositories:

- https://huggingface.co/gnumanth/sanskrit-tts-onnx
- https://huggingface.co/gnumanth/sanskrit-tts-wasm

The existence of a download button or cache implementation does not prove:

- That every required file downloaded successfully.
- That the files are complete and compatible with the runtime.
- That the model can initialize on the target Android browser.
- That inference can execute without a network connection.
- That audio generation and playback work offline.

The actual asset inventory, file integrity, total download size, and runtime
compatibility must be measured during testing. Do not treat an estimated
download size as a verified size.

### 3.4 Main engine integration

The project has an `index.js` file that references local engine and text
modules and attempts to initialize an engine and synthesize audio.

The available implementation information also indicates that inference
verification is not independently established.

A successful JavaScript import, successful model download, initialized
runtime, or returned object is not sufficient evidence of successful singing.

The application must verify actual generated audio and make it possible for
the user to hear the result.

### 3.5 Service worker

The project contains `service-worker.js`.

The presence of a service worker does not prove complete offline functionality.
All required application files, JavaScript dependencies, model weights, and
runtime assets must be available offline and must be tested after the browser
is disconnected from the internet.

## 4. Upstream Source Licensing Blocker

A GitHub Actions workflow intended to fetch and vendor the upstream browser
engine failed at the step:

`Fetch verified upstream browser engine`

The reported error was:

`ERROR: No top-level upstream license file was found. Do not vendor the source until its license or written permission is verified.`

The failure must remain visible in the project history and status records.

Required actions:

1. Identify the exact upstream source revision intended for use.
2. Locate an applicable license or obtain explicit written permission from
   the appropriate rights holder.
3. Verify that the permission covers copying, modification, redistribution,
   and the intended browser-local use.
4. Record the source URL, revision or commit, license, and verification evidence.
5. Only then update the vendor workflow to fetch the approved source.

Do not remove or bypass the workflow's license safeguard merely to obtain
a successful build.

A missing license file must not be interpreted as permission to copy code.

## 5. Third-Party Model Licensing

The referenced model repositories have been identified as potential sources
of model assets. Their licensing must be checked at the exact revision used.

Permission to use model weights does not automatically grant permission to
copy or redistribute a separate upstream JavaScript engine.

Before packaging model assets, record:

- Exact model repository and revision.
- Model files required by the application.
- Applicable license and its conditions.
- File sizes and cryptographic hashes where practical.
- Any attribution, notice, or redistribution requirements.
- Evidence that the chosen runtime can use those assets.

Do not claim that all project dependencies are legally cleared until every
required component has been reviewed.

## 6. Required Functional Verification

The application must not be marked complete until the following tests have
been executed against the testing repository and its published GitHub Pages
application.

### Test A — Application loading

- Open the published application on an Android device.
- Confirm that the page loads without fatal JavaScript errors.
- Confirm that the main interface and required controls are present.
- Record the browser version, device, date, and observed result.

### Test B — Engine and model initialization

- Initialize the intended local engine.
- Confirm that every required runtime component loads.
- Confirm that the model files are present and compatible.
- Record the actual selected backend and initialization errors, if any.
- Do not infer success from a button changing state.

### Test C — Actual audio generation

- Enter a known Sanskrit verse.
- Run the real model inference.
- Confirm that the inference operation completes.
- Verify that a non-empty, valid audio result is produced.
- Record the result type, duration, and any available technical metadata.
- Do not use placeholder audio or ordinary speech synthesis as evidence of
  neural singing.

### Test D — Audio playback

- Play the generated audio through the application's audio player.
- Confirm that audible output is produced on the target Android device.
- Check for silence, truncated output, playback errors, and invalid audio.
- Preserve the test input and output details without exposing private data.

### Test E — Sanskrit text preservation

- Test Devanagari text, conjuncts, punctuation, and applicable Vedic marks.
- Confirm that the application does not silently delete or corrupt text.
- Distinguish text preservation from verified pronunciation accuracy.

### Test F — Offline operation

Perform this test only after the application and all required assets have
been downloaded successfully.

1. Open the published application while online.
2. Complete any permitted first-time asset downloads.
3. Confirm that the cache contains all required assets.
4. Close or reload the application as appropriate.
5. Disconnect the device from the internet.
6. Reopen the application.
7. Initialize the engine without network access.
8. Generate a new audio result from a test verse.
9. Play the newly generated audio.
10. Record every failure and the evidence for the final result.

A cached application shell alone does not pass this test.

### Test G — Failure handling

- Test a missing or unavailable model asset.
- Test engine initialization failure.
- Test inference failure.
- Test invalid or empty audio output.
- Confirm that errors are reported clearly.
- Confirm that the interface never reports successful inference when it failed.

## 7. Evidence and Reporting Requirements

Maintain a clear distinction between these states:

- `NOT TESTED` — the test has not been executed.
- `PASS` — the test was executed and its required outcome was observed.
- `FAIL` — the test was executed and its required outcome did not occur.
- `BLOCKED` — the test cannot proceed because a dependency, permission,
  or prerequisite is missing.
- `PARTIAL` — only some required outcomes were verified.

For each test, record:

- Test identifier.
- Date and time.
- Tested Git commit.
- Published URL or tested file.
- Device and browser where applicable.
- Exact test input, where safe to record.
- Observed result.
- Console or runtime error, if any.
- Evidence location.
- Final status.

Do not fabricate test logs, audio outputs, screenshots, or evidence.

Do not claim zero defects, 100% test success, verified offline operation,
or production readiness without supporting test evidence.

## 8. Current Status Summary

| Capability | Current status |
|---|---|
| Sanskrit text utilities present | PRESENT; scope is text analysis |
| Browser engine adapter present | PRESENT; external upstream import attempted |
| Complete local engine bundled | NOT VERIFIED |
| Required model assets fully available locally | NOT VERIFIED |
| Upstream JavaScript engine license cleared | BLOCKED / NOT VERIFIED |
| Real neural inference independently verified | NOT VERIFIED |
| Actual generated audio playback verified | NOT VERIFIED |
| Android compatibility verified | NOT VERIFIED |
| Fully offline inference verified | NOT VERIFIED |
| Paid API or separate inference server required | NOT AN ACCEPTED PROJECT REQUIREMENT |
| Production readiness | NOT ESTABLISHED |

These statuses must be changed only when new, reproducible evidence supports
the change.

## 9. Definition of Completion

The AI singing feature may be declared complete only when all of the following
are true:

1. The actual engine and all required dependencies are available under
   verified licenses or permissions.
2. The application initializes the intended model successfully.
3. The model performs real inference on the target device.
4. The application produces valid, non-empty audio from supplied Sanskrit text.
5. The user can play and hear the generated result.
6. The intended feminine-friendly singing quality is evaluated through actual
   audio, not inferred from code or marketing descriptions.
7. Android behavior has been tested on a real target device.
8. Offline operation has passed the complete offline test if it is claimed.
9. Errors are reported honestly and do not produce false success states.
10. The evidence and exact tested revision are documented.

Passing text analysis, downloading a model, loading a page, or opening an
external studio does not satisfy this definition.

## 10. Next Engineering Priority

The immediate priority is to resolve the upstream engine licensing blocker
without bypassing the safeguard.

After permission is verified, vendor or otherwise lawfully obtain the complete
required runtime, inspect its dependency paths, identify the exact model assets,
and integrate them into the testing application.

Then execute the real inference, audio playback, Android, and offline tests.

Do not modify the separate `anujadha` application.

Do not add paid services or change the project's intended operating model
without the project owner's explicit approval.

---

**Final declaration:** Swar-Sadhika's goal remains a usable personal virtual
singing voice for Sanskrit texts. The available implementation evidence does
not yet establish that real neural singing works fully offline. That outcome
must be achieved and demonstrated through actual tests, not claimed in advance.
