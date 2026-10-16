# Swar-Sadhika — AI Engine Implementation Status

**Project:** Swar-Sadhika (test repository only)  
**Repository:** shreevidyamatabhuvanesvari-gif/swar-sadhika-test  
**Assessment date:** 2026-10-16  
**Status:** NOT VERIFIED — real synthesis and offline operation remain unproven

> This document records implementation evidence and outstanding verification.
> A loaded page, loaded JavaScript module, initialized UI, downloaded model,
> successful HTTP response, or populated cache is not proof of successful
> neural inference or playable Sanskrit audio.

## 1. Scope and repository safety

All changes described here apply exclusively to this test repository.

The separate main application, `anujadha`, must not be modified.

The currently reviewed archive is:

`swar-sadhika-test-patched-2.zip`

SHA-256:

`b21f65e2e3663757cf2075c71e106ce62c74cb1a93bce4d1516b361fd82840a4`

The archive passed its ZIP integrity test and contained 23 files.

This archive identifier does not establish that the archive and the current
GitHub branch contain identical file contents.

## 2. Current engine architecture

The application has a public browser-engine adapter:

- `vagdhenu-onnx.js`
- `index.js`
- `app.js`
- `model-cache.js`
- `service-worker.js`

The adapter is intended to connect the application to the upstream Vāgdhenu
browser implementation.

The adapter must not simulate successful inference or return fabricated
audio after a model-loading or synthesis failure.

The intended architecture performs inference in the user's browser. However,
the presence of an adapter alone does not establish that the upstream engine,
runtime, model weights, and all dependencies are available locally.

## 3. Public backend contract

The reviewed application code uses the public backend names:

- `wasm`
- `onnx`

The adapter contains a mapping from public backend `onnx` to the upstream
backend label `webgpu`.

This is an adapter-level compatibility decision, not proof that the selected
upstream engine supports that backend in the deployed environment.

The following must be verified against the actual upstream implementation:

1. Whether the selected upstream version recognizes the requested backend.
2. Whether the required runtime and execution provider are available.
3. Whether backend initialization completes successfully.
4. Whether actual synthesis succeeds after initialization.
5. Whether errors are reported accurately when a backend is unsupported.

A successful adapter import does not establish backend compatibility.

## 4. Upstream engine and runtime dependencies

The reviewed ZIP contains `vagdhenu-onnx.js`, but does not contain the complete
upstream engine source under:

`vendor/vagdhenu-upstream/`

The archive also does not contain a complete, verified local package of all
required model weights and runtime assets.

The adapter lists external source URLs as fallback locations. Consequently,
an external JavaScript module or runtime may still be required.

The following GitHub Actions and helper files are present in the reviewed
archive:

- `.github/workflows/vendor-vagdhenu-engine.yml`
- `scripts/fetch-vagdhenu-engine.sh`

Their presence does not establish that the workflow has been executed
successfully or that the upstream source has been vendored.

Before distributing upstream code, verify its license or obtain the
appropriate permission.

After the upstream source is available, inspect all nested imports, runtime
URLs, WASM binaries, model URLs, and relative asset paths.

No missing dependency may be replaced with a placeholder that falsely
suggests the engine is operational.

## 5. Model download and cache

The reviewed `model-cache.js` implements model-download and cache-management
logic.

Its intended responsibilities include:

- Selecting the model repository for a backend.
- Downloading required model artifacts.
- Checking HTTP status and expected content types.
- Storing model responses in browser Cache Storage.
- Reporting download and cache progress.

These operations must not be described as successful inference.

Important limitations:

1. A successful HTTP response does not prove that the response contains the
   correct model artifact.
2. A cache entry does not prove that the model is valid or compatible.
3. No verified SHA-256 digest for each model artifact has been established
   by the evidence recorded here.
4. Browser storage quota and eviction may remove cached assets.
5. Cross-origin restrictions, redirects, and large downloads may affect
   model availability.
6. The amount of downloaded data depends on the actual selected model and
   the required runtime assets.

The model cache must be tested against real model files and actual inference.

## 6. Service worker and offline operation

The service worker is intended to cache application files and selected
runtime and model requests.

The reviewed ZIP version uses cache-first behavior for cached application
resources and selected external resources. A separately proposed
network-first revision must be verified against the actual committed source
before its presence is claimed.

The following states are different:

- Application files are cached.
- Runtime JavaScript is cached.
- Model files are cached.
- All required dependencies are present.
- Model initialization succeeds.
- Real synthesis succeeds.
- Generated audio plays.
- The complete workflow succeeds with the network disabled.

Only the last relevant end-to-end test can establish whether offline synthesis
works in the tested environment.

Service Worker registration or cache inspection alone cannot establish
offline readiness.

## 7. Required functional verification

Each test must record its environment, input, observed output, console errors,
and result.

| Test | Required evidence | Current status |
|---|---|---|
| Application page loads | Actual GitHub Pages page opens | Page availability observed; broader testing pending |
| JavaScript modules load | Network and console evidence | Not fully verified |
| Required runtime is available | All required JS/WASM/runtime assets identified | Not verified |
| Model files are valid | Actual downloaded files and integrity checks | Not verified |
| WASM backend initializes | Successful initialization in browser | Not verified |
| ONNX backend initializes | Successful initialization with a compatible provider | Not verified |
| Sanskrit inference succeeds | Real input and successful engine result | Not verified |
| Audio output is non-empty | Valid generated audio data | Not verified |
| Audio plays | Audible playback in the target browser | Not verified |
| Android browser operation | Actual Android device test | Not verified |
| Long Sanskrit text | Tested output, errors, and stability | Not verified |
| Offline synthesis | Real synthesis with network disabled | Not verified |
| Reload after caching | Successful repeat synthesis after restart/reload | Not verified |
| Backend failure handling | Accurate user-facing error and no false success | Not verified |
| GitHub Actions vendor job | Successful run and reviewed commit | Not verified |

A test may be marked PASS only when its required evidence exists.

If a test was not executed, its status must remain NOT VERIFIED.

## 8. Sanskrit pronunciation and singing quality

Technical audio generation is not proof of Sanskrit pronunciation quality.

Quality verification must use carefully selected Sanskrit examples, including:

- Difficult conjunct consonants.
- Long and short vowels.
- Anusvara and visarga.
- Dense consonant combinations.
- Long shlokas and mantras.
- Relevant Vedic accents and marks, where supported by the engine.

Record pronunciation problems, omitted text, unexpected pauses, clipping, timing
problems, and audio artifacts.

The intended goal is melodious, clear, feminine-friendly Sanskrit singing.
Ordinary speech synthesis or rhythmic recitation must not be represented as
independent melodic singing without evidence from actual generated audio.

The target quality scores are design goals, not measured results or guaranteed
engine parameters:

- Timbre: 9.5/10
- Pitch: 8.5/10
- Prosody: 9.5/10
- Pronunciation / Articulation: 9.0/10
- Speaking Rate / Tempo: 8.5/10
- Pitch Variation / Resonance: 9.5/10

No score should be reported as achieved until a defined evaluation has been
performed.

## 9. Required next actions

1. Compare the committed GitHub files with the reviewed ZIP.
2. Verify the exact current contents of the service worker.
3. Inspect backend initialization and synthesis contracts.
4. Verify upstream licensing and source availability before vendoring.
5. Identify and package required runtime and model assets where legally and
   technically possible.
6. Resolve incompatible imports or backend assumptions using actual upstream
   source evidence.
7. Test real Sanskrit inference and non-empty audio on GitHub Pages.
8. Repeat the applicable tests on Android.
9. Test offline synthesis only after all required dependencies have been
   identified and cached.
10. Record the actual test results and any remaining limitations.

Do not replace existing application modules merely to make the repository
appear complete. Preserve working code and make the smallest justified changes.

## 10. Release decision

The following claims are NOT established by this assessment:

- Successful real AI inference.
- Successful generated-audio playback on Android.
- Independent melodic singing capability.
- Complete offline synthesis.
- Zero defects.
- Production readiness.

The release status must remain NOT VERIFIED until the required tests have
been executed and their evidence recorded.

The objective is a genuinely useful Sanskrit voice-generation application,
not a demonstration that merely displays a successful-looking interface.
