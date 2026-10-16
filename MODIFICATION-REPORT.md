# SWAR-SADHIKA — MODIFICATION REPORT

**Project:** Swar-Sadhika  
**Report date:** 2026-10-17  
**Report version:** 1.0  
**Repository:** https://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test  
**Published application:** https://shreevidyamatabhuvanesvari-gif.github.io/swar-sadhika-test/  
**Overall status:** INCOMPLETE — ENGINE LICENSING AND REAL INFERENCE VERIFICATION PENDING

---

## 1. PURPOSE OF THIS REPORT

This report records the known implementation state, reviewed files,
identified issues, workflow failure, licensing concerns, and required next
steps for Swar-Sadhika.

It is intended to prevent repeated work, undocumented changes, unsupported
claims, and accidental modification of unrelated applications.

This report is based on the project information and files available for
review as of the report date. It is not a verified Git commit history or
a substitute for inspecting the repository's actual Git diff.

A file described as reviewed, proposed, or planned in this report must not be
treated as committed or deployed unless the repository confirms that fact.

## 2. PROJECT OBJECTIVE

Swar-Sadhika is intended to be an Android-friendly, browser-based Sanskrit
AI singing application.

The central objective is to let the project owner use a personal virtual
singing voice to generate clear, melodious, feminine-friendly singing from
Sanskrit and Devanagari texts.

Intended text categories include:

- Sanskrit shlokas.
- Mantras.
- Stotras.
- Rgvedic hymns and other Vedic texts.
- Devotional and traditional Sanskrit compositions.

The goal is actual audio generation from the user's text, followed by
playback in the browser.

Text analysis, an external demonstration, an audio player without newly
generated audio, or ordinary speech synthesis alone does not meet this goal.

## 3. NON-NEGOTIABLE PROJECT RULES

1. All development and testing must take place in the Swar-Sadhika testing
   repository identified in this report.

2. The separate main application named `anujadha` must not be modified.

3. Do not introduce a paid AI API, mandatory API key, subscription, cloud
   inference service, or separate inference server without the project
   owner's explicit approval.

4. The intended architecture is browser-local inference on a compatible
   Android device.

5. An initial internet connection may be necessary to obtain permitted model
   files and runtime dependencies.

6. Subsequent offline inference must be demonstrated through a real offline
   test. It must not be inferred from the existence of a service worker,
   cached page, or model download button.

7. Do not present placeholder audio, prerecorded results, ordinary TTS,
   or fabricated success messages as successful neural singing.

8. Do not remove a license check merely to make a GitHub Actions workflow pass.

9. Do not select MIT as the project's chosen license.

10. Respect the independent licenses and permissions of third-party source
    code, JavaScript libraries, model weights, runtime files, and other assets.

11. Preserve the original Sanskrit text unless the user explicitly requests
    a clearly identified transformation.

12. Do not claim successful inference, correct Vedic pronunciation, offline
    readiness, or production readiness without supporting evidence.

## 4. FILES REVIEWED OR IDENTIFIED

The following file descriptions reflect available source information.
They do not certify that every file is currently committed to GitHub Pages
or that the published application executes it successfully.

### 4.1 `index.js`

**Role:** Main engine integration and inference orchestration.

Available source information indicates that this file references:

- `vagdhenu-onnx.js`
- `vagdhenu-text.js`

It attempts to initialize the selected engine, synthesize text in the
browser, validate audio output, and support playback.

The available implementation also identifies inference as not independently
verified.

**Known limitation:** Presence of integration code does not establish that
the upstream engine, runtime dependencies, or compatible model weights are
fully available locally.

**Required next action:** Verify the current file against the actual adapter
API, run initialization and inference on the published application, and
record the real audio result.

### 4.2 `vagdhenu-onnx.js`

**Role:** Compatibility adapter for the upstream Vāgdhenu browser engine.

The reviewed adapter attempts to import an upstream implementation through
multiple external static-source URLs.

**Known limitations:**

- The adapter does not itself contain the complete upstream engine.
- External imports can fail because of network, CORS, availability, MIME type,
  module-export, or dependency problems.
- The reviewed source does not establish that all runtime assets are bundled
  locally.
- The use of external source URLs does not establish offline availability.
- Upstream source licensing must be resolved before that source is copied
  into the repository.

**Required next action:** Do not vendor upstream source until its license
or sufficient written permission has been verified. Once cleared, use a
specific reviewed source revision and document the required dependencies.

### 4.3 `vagdhenu-text.js`

**Role:** Sanskrit and Devanagari text-processing utilities.

The reviewed source includes text normalization and analysis functionality
and documents limitations around meter and related analysis.

**Important distinction:** This is a text utility module, not an AI singing
model and not proof of neural inference.

**Required next action:** Preserve the documented limits of text analysis.
Test preservation of conjuncts, punctuation, Vedic marks, and original text
with representative input.

### 4.4 `model-cache.js`

**Role:** Browser-side model-download and cache functionality.

Available source information indicates that this file can download and
cache model assets.

**Known limitations:**

- A download control does not prove every asset is downloaded correctly.
- A cache entry does not prove that a model can initialize.
- A successful download does not prove that inference works.
- Cache availability does not prove that the application can run offline.
- The actual model size and required dependency inventory must be measured.

**Required next action:** Verify every required asset, its source, its size,
its integrity, and its compatibility with the chosen runtime. Then run an
actual offline inference test.

### 4.5 `service-worker.js`

**Role:** Intended application resource caching and offline support.

**Known limitation:** The existence of a service worker is not proof that all
required JavaScript modules, model weights, runtime dependencies, and other
assets are available offline.

**Required next action:** Test a fresh reload with the device disconnected
from the internet, including initialization, inference, and playback.

### 4.6 `singing-engine-prototype.html`

**Role:** Engine testing and diagnostic interface.

The available source information identifies this as a test interface for
Vāgdhenu-related browser inference.

**Known limitation:** A successful prototype test would not independently
prove that the main application is integrated correctly or that a separate
AI system capable of freely composing melodies in a feminine voice exists.

**Required next action:** Keep prototype evidence distinct from tests of the
published main application.

### 4.7 Diagnostic HTML files

The project contains diagnostic pages for source loading, runtime behavior,
and inference testing.

These pages are useful for collecting evidence, but their existence alone
does not establish a passing result.

Each diagnostic must report the actual outcome and relevant error details.
A successful page load or module import is not equivalent to successful
audio synthesis.

### 4.8 Other identified project files

The project has also included files such as:

- `index.html`
- `app.js`
- `AI-ENGINE-IMPLEMENTATION-STATUS.md`
- `PRONUNCIATION-LEARNING-AUDIT.md`
- `README.md`
- `MODIFICATION-REPORT.md`
- `model-audit.html`
- `module-audit-anjali.html`
- `neural-studio.html`
- `pronunciation-learning.js`
- `soulx-mobile-audit.html`
- `vagdhenu-inference-audit.html`
- `vagdhenu-inference-audit-cdn.html`
- `vagdhenu-runtime-audit.html`
- `vagdhenu-source-audit.html`

The existence, exact current contents, and deployment status of every item
must be confirmed against the actual repository before making file-by-file
claims about the latest committed build.

An external studio link or diagnostic page must not be described as the
integrated local AI engine.

## 5. GITHUB ACTIONS WORKFLOW FAILURE

The repository contains or has included this workflow:

`.github/workflows/vendor-vagdhenu-engine.yml`

The attempted manual workflow execution used the `main` branch and the
confirmation value `TEST`.

The workflow failed at the step:

`Fetch verified upstream browser engine`

The reported error was:

`ERROR: No top-level upstream license file was found. Do not vendor the source until its license or written permission is verified.`

### Interpretation

The workflow reached the source-fetch stage but refused to copy the upstream
engine because the required licensing evidence was not found.

This is a licensing safeguard, not proof that model inference itself failed
during that workflow run. That workflow run did not establish successful
inference or offline operation.

### Required resolution

1. Identify the precise upstream source repository and intended revision.
2. Verify the applicable source-code license or obtain written permission
   from the appropriate rights holder.
3. Confirm that the permission covers the intended copying, modification,
   packaging, and redistribution.
4. Record the exact source revision and license evidence.
5. Review the workflow and all files it downloads before changing the
   vendor procedure.
6. Run the workflow again only after its legal prerequisites have been met.

Do not delete, bypass, or weaken the licensing safeguard to obtain a green
workflow result.

The previous failure must not be recorded as a successful vendor operation.

## 6. THIRD-PARTY MODEL AND RUNTIME ASSETS

The project has referenced these model repositories:

- https://huggingface.co/gnumanth/sanskrit-tts-onnx
- https://huggingface.co/gnumanth/sanskrit-tts-wasm

The applicable license for the exact revision of each model and the runtime
requirements must be checked before use or redistribution.

A model repository's license does not automatically license a separate
upstream JavaScript engine.

Before bundling third-party assets, document:

- Repository and exact revision.
- File names and required dependencies.
- Applicable license and conditions.
- Required attribution or notices.
- File sizes and integrity hashes where practical.
- Intended runtime and compatible backend.
- Whether redistribution and local browser execution are permitted.

Do not state that all third-party material is cleared until the relevant
evidence has been reviewed.

## 7. PROJECT RIGHTS NOTICE

A rights notice has been drafted for the original work owned by the project
owner.

The proposed file name is:

`RIGHTS-NOTICE.md`

The intended notice reserves rights in the project owner's original work
while expressly distinguishing third-party materials.

**Repository state:** The available conversation establishes that the file
content was proposed. It does not independently prove that the file has
been committed to the repository.

**Important legal distinction:**

- A rights notice is not a substitute for verifying third-party licenses.
- A repository rights notice cannot grant permission to redistribute
  someone else's code or model assets.
- All-rights-reserved wording applies only to material for which the
  project owner holds the relevant rights.
- No external code may be treated as owned by the project owner merely
  because it is present in the repository.

Do not add a license declaration that misrepresents the ownership or
licensing status of third-party components.

## 8. IMPLEMENTATION STATUS

| Item | Current known status |
|---|---|
| Main application interface | File identified; current deployment behavior not independently verified |
| Sanskrit text utility | Source available for review |
| Engine adapter | Source available; external upstream imports attempted |
| Complete local upstream engine | Not established |
| Required model and runtime assets | Complete inventory and compatibility not verified |
| Upstream JavaScript license | Blocked pending verification |
| Model and asset license review | Exact revisions and conditions require verification |
| Real inference | Not independently verified |
| Generated audio playback | Not independently verified on the target Android device |
| Feminine-friendly singing quality | Not evaluated with a verified output recording |
| Offline engine initialization | Not verified |
| Offline audio generation and playback | Not verified |
| Android compatibility | Not verified through documented device testing |
| GitHub Actions vendor workflow | Last reported attempt failed at licensing safeguard |
| Production readiness | Not established |

These statuses must be updated only when supported by new evidence.

## 9. REQUIRED TEST PLAN

### Test 1 — Published application

Open the application from the official testing GitHub Pages URL on a target
Android device.

Record the tested commit, browser, date, console errors, and actual result.

### Test 2 — Runtime initialization

Confirm that all required modules load and that the chosen runtime initializes
without missing exports, dependency failures, or unsupported APIs.

### Test 3 — Model compatibility

Confirm that the selected model files are complete, permitted for use,
compatible with the runtime, and available at the required locations.

### Test 4 — Real audio generation

Enter a Sanskrit verse and execute actual model inference.

Verify that a valid, non-empty audio result is generated. Do not count a
text-analysis result, status-message change, or fabricated audio object as
evidence of successful synthesis.

### Test 5 — Playback

Play the newly generated audio on the target Android device.

Record whether audible output occurs and whether the audio is complete,
non-empty, and free of playback errors.

### Test 6 — Sanskrit text preservation

Test Devanagari characters, conjuncts, punctuation, and applicable Vedic marks.

Confirm that the application does not silently corrupt the supplied text.
Do not equate text preservation with verified pronunciation accuracy.

### Test 7 — Offline operation

After required assets have been downloaded and cached:

1. Disconnect the device from the internet.
2. Reload or reopen the published application.
3. Initialize the engine.
4. Generate a new audio result.
5. Play that result.
6. Record any failed network requests, missing assets, initialization errors,
   inference errors, or playback failures.

A cached page alone does not pass the offline test.

### Test 8 — Failure handling

Test missing assets, initialization errors, inference errors, and invalid
or empty audio responses.

The application must report failures honestly rather than display a success
state when synthesis has failed.

## 10. EVIDENCE REQUIREMENTS

For every test, record:

- Test identifier.
- Date and time.
- Exact commit tested.
- Published page or file tested.
- Device and browser where applicable.
- Test input, where appropriate.
- Observed result.
- Relevant console or runtime error.
- Evidence location.
- Final status.

Use only these result values:

- `NOT TESTED`
- `PASS`
- `FAIL`
- `BLOCKED`
- `PARTIAL`

Do not invent logs, screenshots, audio recordings, test results, or commit IDs.

Do not declare zero defects, 100% test success, or production readiness
without evidence that supports the specific claim.

## 11. CHANGE MANAGEMENT RULES

Before changing an existing file:

1. Inspect its current committed contents.
2. Identify the exact defect or requirement.
3. Preserve unrelated working functionality.
4. Make the smallest justified change.
5. Review the complete resulting file.
6. Run relevant validation and functional tests.
7. Record the actual diff and test results.
8. Commit only the intended files.

After each change, distinguish between:

- Source code edited locally.
- Changes committed to GitHub.
- Changes deployed to GitHub Pages.
- Tests executed successfully.
- Capabilities still unverified.

These states are not interchangeable.

Do not assume that saving a file in an editor automatically updates the
published application.

## 12. IMMEDIATE NEXT ACTIONS

Perform the following work in order:

1. Confirm which proposed documentation files have actually been committed.
2. Inspect the current workflow and retain its upstream license safeguard.
3. Resolve the upstream JavaScript engine licensing blocker.
4. Inventory the complete engine, runtime dependencies, and model assets.
5. Verify the compatibility between the integration code, adapter, model,
   and selected backend.
6. Build the lawful local runtime integration without adding a paid API
   or a separate inference server.
7. Run real inference and audio playback on the published testing application.
8. Test the intended Android browser.
9. Test offline initialization, generation, and playback.
10. Update this report with the exact tested commit and actual evidence.

Do not modify `anujadha`.

Do not mark a step complete simply because its code or documentation has
been written.

## 13. FINAL DECLARATION

The central goal of Swar-Sadhika is a usable personal virtual singing voice
for Sanskrit texts.

The currently available implementation evidence does not establish that a
complete, licensed, local AI singing engine is integrated and operating
offline.

The immediate blocker is the need to verify the upstream engine's rights
before copying it. After that, the required runtime and model assets must be
integrated and actual audio generation, playback, Android behavior, and
offline operation must be tested.

All progress must be reported honestly. The project is not complete until
the intended singing capability has been demonstrated with reproducible
evidence.
