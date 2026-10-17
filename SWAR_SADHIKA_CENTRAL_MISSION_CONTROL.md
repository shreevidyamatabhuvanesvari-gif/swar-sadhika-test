# SWAR-SADHIKA — CENTRAL MISSION & CAPABILITY CONTROL

**File:** `SWAR_SADHIKA_CENTRAL_MISSION_CONTROL.md`  
**Document version:** 1.4  
**Document status:** Audit-reviewed control draft with user-approved operating rules; this revision is a local document draft only. Automated enforcement and end-to-end/runtime certification are NOT complete.  
**Prepared:** 2026-10-18; time-responsive rule-change principle added in revision 1.4  
**Scope:** Swar-Sadhika test repository only  
**Protected main application:** `anujadha` — do not modify  
**Repository:** https://github.com/shreevidyamatabhuvanesvari-gif/swar-sadhika-test  
**GitHub Pages:** https://shreevidyamatabhuvanesvari-gif.github.io/swar-sadhika-test/

---

## 1. इस फ़ाइल का उद्देश्य और अधिकार-सीमा

यह फ़ाइल स्वर-साधिका के मिशन, क्षमताओं के मानचित्र, अखंडता, प्रमाण, ज्ञात दोषों और परिवर्तन-नियंत्रण का केंद्रीय अभिलेख है। इसका उद्देश्य 19 निर्धारित फ़ाइलों में मौजूद संबंधित क्षमताओं को एक-दूसरे से जुड़ी व्यवस्था के रूप में समझना और समन्वित रखना है, न कि उन्हें अलग-अलग असंबद्ध फ़ाइलें मानना।

यह नियंत्रण-दस्तावेज़ है, चलने वाला अनुप्रयोग-कोड नहीं। यह अपने-आप मॉड्यूलों को नहीं जोड़ता, क्षमताएँ सक्रिय नहीं करता, GitHub की अनुमतियाँ लागू नहीं करता, कानूनी अधिकार प्रमाणित नहीं करता और न ही यह सिद्ध करता है कि मॉडल-आधारित निष्पादन या ऑफ़लाइन उपयोग वास्तव में काम करता है।

परियोजना-मालिक ने अनुभाग 17 में दर्ज संचालन सिद्धांत स्वीकार किए हैं। इनमें नई फ़ाइलों की पहचान और रजिस्टर में प्रविष्टि, प्रमाण-आधारित सत्यापन, नियमों में समयानुकूल बदलाव तथा हिंदी में नियम लिखना शामिल है। इन सिद्धांतों को तकनीकी रूप से लागू करने के लिए अलग डिज़ाइन, समीक्षा और आवश्यक स्पष्ट अनुमति अभी भी आवश्यक है।

### प्राथमिकता और अधिकार-नियम

1. परियोजना पर उपयोगकर्ता द्वारा स्पष्ट रूप से निर्धारित मिशन और सीमाएँ लागू होंगी।
2. समीक्षा किए गए मूल स्रोत-स्नैपशॉट की पहचान के लिए अपरिवर्तित baseline ZIP और `SWAR_SADHIKA_BASELINE_MANIFEST.json` को आधार माना जाएगा।
3. वास्तविक स्रोत-कोड और दोहराकर चलाए जा सकने वाले परीक्षण-प्रमाण, फ़ाइल-नाम, टिप्पणियों, प्रचारात्मक विवरण या धारणाओं से अधिक विश्वसनीय होंगे।
4. स्रोत-कोड और परियोजना-दस्तावेज़ में विरोध मिलने पर उस विरोध को दर्ज करके जाँचा जाएगा; किसी एक पक्ष को चुपचाप सही नहीं मान लिया जाएगा।
5. स्रोत-कोड में किसी सुविधा का मौजूद दिखना इस बात का स्वतः प्रमाण नहीं है कि वह रनटाइम पर काम करती है।
6. यह नियंत्रण-दस्तावेज़ अपने-आप किसी कोड-परिवर्तन की अनुमति नहीं देता। वास्तविक कार्यान्वयन-परिवर्तन के लिए उपयोगकर्ता का अलग और स्पष्ट निर्देश आवश्यक है।

## 2. Mission

The sole guiding purpose is to help the user develop a genuinely useful means of personal vocal expression through Swar-Sadhika. It is a personal accessibility and self-expression goal, not a commercial objective.

The intended result is clear, sweet, feminine-friendly Sanskrit vocal or singing output for shlokas, mantras, stotras, richas, Vedic passages, and related Sanskrit texts, with due attention to:

- Devanagari and Sanskrit text integrity;
- consonants, vowels, matras, conjuncts, anusvara, visarga, and Vedic marks;
- intelligibility and pronunciation;
- prosody, pitch, rhythm, tempo, and continuity;
- vocal timbre, including the user's feminine-friendly target;
- actual audio generation and playback on a mobile browser;
- local execution and offline use where technically feasible.

The stated output quality is the **goal**, not an already demonstrated result. No source-code shape, model download, successful module import, device API, or control-panel message is a substitute for listening to and evaluating real generated audio.

## 3. अनिवार्य सीमाएँ

1. अनुप्रयोग के सभी कार्यान्वयन-परिवर्तन केवल `swar-sadhika-test` रिपॉज़िटरी में किए जाएँगे।
2. अलग मुख्य अनुप्रयोग `anujadha` में कोई बदलाव नहीं किया जाएगा।
3. मूल baseline फ़ाइलों को बिना अनुमति अधिलेखित, हटाया, नामांतरित, दोबारा बनाया, सामान्यीकृत या चुपचाप प्रतिस्थापित नहीं किया जाएगा।
4. उपयोगकर्ता द्वारा दिया गया मूल पाठ अपरिवर्तित संदर्भ के रूप में सुरक्षित रखा जाएगा। सामान्यीकरण, लिप्यंतरण, टोकन-विभाजन, खंडन या मॉडल-विशिष्ट प्रस्तुति अलग व्युत्पन्न मान के रूप में बनाई जाएगी; मूल पाठ को चुपचाप बदला नहीं जाएगा।
5. संस्कृत वर्णों, मात्राओं, संयुक्ताक्षरों, दण्ड-चिह्नों, अनुस्वार, चन्द्रबिन्दु, विसर्ग, वैदिक स्वर-चिह्नों या अन्य संयोजक चिह्नों को चुपचाप हटाया या बदला नहीं जाएगा।
6. वास्तविक AI-गायन के लक्ष्य के स्थान पर browser speech synthesis, पहले से रिकॉर्ड किया हुआ ऑडियो, placeholder या दिखावटी सफलता-संदेश नहीं रखा जाएगा।
7. उपयोगकर्ता की स्पष्ट स्वीकृति के बिना सशुल्क AI API, अनिवार्य API key, cloud inference सेवा या अलग से चलाए जाने वाले inference server को नहीं जोड़ा जाएगा। जहाँ तकनीकी रूप से संभव हो, ब्राउज़र में स्थानीय निष्पादन को प्राथमिकता दी जाएगी।
8. पहली बार runtime assets और model files डाउनलोड करने के लिए इंटरनेट आवश्यक हो सकता है। आवश्यक फ़ाइलों की पहचान जाँचकर cache में सुरक्षित किए जाने के बाद ऑफ़लाइन संचालन का वास्तविक परीक्षण करना होगा; इसे अनुमान से सही नहीं माना जाएगा।
9. इंजन-स्रोत, ONNX Runtime, model weights, model-bank फ़ाइलों और अन्य तृतीय-पक्ष निर्भरताओं के लाइसेंस तथा स्रोत-इतिहास की अलग जाँच होगी। मॉडल के उपयोग की अनुमति होने से JavaScript engine को पुनर्वितरित करने की अनुमति अपने-आप नहीं मिलती।
10. यह दावा नहीं किया जाएगा कि किसी प्राकृतिक जैविक आवाज़ को चिकित्सकीय रूप से पुनर्स्थापित कर दिया गया है। अलग प्रमाण उपलब्ध न होने तक लक्ष्य को ऐप के माध्यम से तकनीकी स्वर/ऑडियो अभिव्यक्ति के रूप में बताया जाएगा।
11. पुनरुत्पादित प्रमाण के बिना शून्य दोष, 100% परीक्षण सफलता, सार्वभौमिक अनुकूलता, पूर्ण ऑफ़लाइन संचालन या production readiness का दावा नहीं किया जाएगा।
12. उपयोगकर्ता द्वारा बताई गई समस्या को पुनः परीक्षण करके उसके ठीक होने का प्रमाण मिलने तक रिपोर्ट किया गया खुला दोष माना जाएगा। केवल प्रस्तावित कोड-पथ देखने के आधार पर उसे ठीक घोषित नहीं किया जाएगा।
13. परीक्षण रिपॉज़िटरी में जोड़ी गई, बदली गई या हटाई गई फ़ाइलों की स्वतः पहचान और केंद्रीय फ़ाइल-रजिस्टर बनाए रखने का लक्ष्य उपयोगकर्ता द्वारा स्वीकृत है। लेकिन इसका तकनीकी डिज़ाइन, बदली जाने वाली सटीक फ़ाइलें/workflows और वास्तविक कार्यान्वयन अलग स्पष्ट अनुमति मिलने तक लंबित रहेंगे। यह दस्तावेज़ सहायक को अपनी ओर से वह व्यवस्था चुनकर लागू करने की अनुमति नहीं देता।

## 4. Baseline identity and scope

The reviewed archive is `swar-sadhika-test-main (11).zip`.

- ZIP size: `186,952` bytes.
- ZIP SHA-256: `d60911f5e4ccfc6e5ae8b661e13dcd2fcf8451fd6538f8f00cdc5a226828d7fb`.
- Baseline manifest: `SWAR_SADHIKA_BASELINE_MANIFEST.json`.
- Baseline lock: `SWAR_SADHIKA_BASELINE_LOCK.md`.
- Mission note: `SWAR_SADHIKA_VOICE_MISSION_MASTER.txt`.
- Archive inventory: 25 tracked non-directory files.
- Designated capability set in this document: 19 files.

All 19 designated file hashes were checked against the existing baseline entries during this review and matched. The original baseline ZIP and baseline manifest remain unchanged. This check ties the capability review to the supplied snapshot; it does **not** prove that the currently published GitHub Pages deployment has the same contents.

### 4.1 The 19 designated capability files

1. `app.js`
2. `index.html`
3. `index.js`
4. `model-audit.html`
5. `model-cache.js`
6. `module-audit-anjali.html`
7. `neural-studio.html`
8. `pronunciation-learning.js`
9. `scripts/fetch-vagdhenu-engine.sh`
10. `service-worker.js`
11. `singing-engine-prototype.html`
12. `soulx-mobile-audit.html`
13. `vagdhenu-inference-audit-cdn.html`
14. `vagdhenu-inference-audit.html`
15. `vagdhenu-onnx.js`
16. `vagdhenu-runtime-audit.html`
17. `vagdhenu-source-audit.html`
18. `vagdhenu-text.js`
19. `vendor/vagdhenu-upstream/vagdhenu-onnx.js`

### 4.2 Other baseline files are still in scope as supporting records

The following six archive files are not in the 19-file capability set, but remain relevant supporting material and must not be ignored or removed:

- `.github/workflows/vendor-vagdhenu-engine.yml` — automated vendor-fetch workflow and its safeguards;
- `AI-ENGINE-IMPLEMENTATION-STATUS.md` — implementation-status and acceptance-test record;
- `LICENSE` — project-level license record;
- `MODIFICATION-REPORT.md` — change history/reporting requirements;
- `PRONUNCIATION-LEARNING-AUDIT.md` — scope and limitations of pronunciation-reference measurements;
- `README.md` — project-facing description and instructions.

The existing baseline manifest remains the authoritative per-file hash inventory. This central file does not replace it or duplicate all 25 hashes.

## 5. The 19-file capability register

The descriptions below are based on the code and markup present in the reviewed archive. “Present in source” does not mean the feature has passed a real-device or end-to-end test.

### FILE-01 — `app.js`

**Role:** Main application-side coordinator for the AI control surface. It dynamically imports `index.js`, builds or binds AI controls, initializes the selected engine, forwards text and synthesis options, reports status/progress/errors, handles stop/cancel state, displays generated audio, and supports audio download. It also loads `pronunciation-learning.js` for the reference-analysis workflow, loads `model-cache.js` for model-cache actions/status, and registers `service-worker.js` when available.

**Relationships:** `index.html` is the visible page; `index.js` is the engine facade; `model-cache.js` handles model assets; `pronunciation-learning.js` handles reference measurements; `service-worker.js` handles browser caches.

**Limits:** UI state, successful imports, progress messages, or an audio element alone do not prove that genuine neural inference produced the audio. The source does not by itself establish female timbre, correct Vedic pronunciation, melodic quality, or offline execution.

### FILE-02 — `index.html`

**Role:** Main browser interface with Sanskrit text input and queue/draft-preview controls, a 9:16-style media stage, text styling/position controls, photo and video selection, audio-track controls, fullscreen behavior, browser-native voice selection/testing through `SpeechSynthesis`, and recording/playback controls. It links to the AI prototype and audit pages and loads `app.js` as a module.

**Critical distinction:** The native browser `SpeechSynthesis` feature is ordinary browser TTS. Its existence is not proof of the neural singing engine and must not be used as a substitute acceptance test for AI singing.

**Limits:** Source presence alone does not establish that generated neural audio is automatically synchronized with the media stage, that final audio/video muxing is correct, or that the export is suitable for publication. Browser voices vary by device, installed voices, language support, and browser implementation.

### FILE-03 — `index.js`

**Role:** Engine facade and safety/compatibility layer. It validates input/options and backend values, checks required local dependencies, inspects the local vendored engine source for expected API markers, applies source-provenance checks, initializes the adapter and text module, calls synthesis, validates returned audio/WAV data, exposes runtime/result metadata, and provides public functions such as `sanskritTts()`, `createSwarSadhikaEngine()`, and module-reload/dependency-check operations.

**Relationships:** Expects `vagdhenu-onnx.js`, `vagdhenu-text.js`, and the approved same-origin vendor entry at `vendor/vagdhenu-upstream/vagdhenu-onnx.js`.

**Limits:** Provenance checks can help determine which file was imported, but a valid source marker, initialized session, or valid WAV container does not independently prove that intended model inference completed or that the pronunciation and singing are correct.

### FILE-04 — `model-audit.html`

**Role:** A diagnostic interface for inspecting model/source information, device/browser capabilities, available model assets and sizes, and reported constraints. It can produce a report for later review.

**Limits:** A repository listing, metadata response, or estimated model size does not prove every artifact is complete, compatible, cached, loadable, or usable in inference. Run it on the target deployment/device before treating its live results as evidence.

### FILE-05 — `model-cache.js`

**Role:** Model asset download and cache manager. The required set is five assets: `vagdhenu_cond_q8.onnx`, `vagdhenu_dit_step_q8.onnx`, `vagdhenu_vocos_q8.onnx`, `baked_bank.bin`, and `baked_bank.json`. It obtains repository metadata, pins each download run to a reported revision, verifies file identity using SHA-256 for LFS/Xet assets or Git-blob SHA-1 for small Git-stored files, records verification/revision metadata, reports cache status, and supports clearing its model and metadata caches.

**Relationships:** Works with the Hugging Face `gnumanth/sanskrit-tts-wasm` and `gnumanth/sanskrit-tts-onnx` model repositories and is coordinated with the service-worker cache names/URLs.

**Limits:** Cache presence and hash validation establish asset identity/completeness only to the implementation's stated checks. They do not prove model initialization, successful inference, intelligible audio, or offline singing.

### FILE-06 — `module-audit-anjali.html`

**Role:** Browser-side module/API compatibility audit. It attempts to import the designated text and engine modules and checks for required exports/functions.

**Limits:** Export presence or import success is a module-shape test, not a complete runtime, model, audio, pronunciation, or voice-quality test. The page itself must be run to obtain fresh results; source code of the audit is not a PASS result.

### FILE-07 — `neural-studio.html`

**Role:** Bridge to the official external Vāgdhenu browser studio through a direct link and iframe.

**Critical distinction:** It opens a separate external studio. The page itself does not vendor the external engine into the test repository and explicitly does not automatically connect the studio's output with the app's 9:16 editor.

**Limits:** Depends on the external site's availability, framing/security policy, Internet access, and the external runtime. It is not proof of local-source integration or fully offline use. Do not use its success alone to declare the repository implementation complete.

### FILE-08 — `pronunciation-learning.js`

**Role:** Local, user-selected reference-media measurement and storage functions. Its API includes analysis of selected media, save/list/delete/clear operations for reference records, and JSON export. The associated workflow examines limited acoustic descriptors such as duration, sample rate, channel count, peak/RMS levels, quiet-frame ratio and a rough pitch estimate where supported.

**Relationship:** Loaded and called by `app.js` from explicit user actions.

**Limits:** These measurements are not validated Sanskrit pronunciation scoring, phoneme alignment, Vedic accent detection, neural training, model fine-tuning, voice cloning, or verified engine conditioning. A reference record does not prove that generated singing improves. Browser support, storage quotas, and media codec constraints apply. Do not describe this feature as automatic learning or automatic correction.

### FILE-09 — `scripts/fetch-vagdhenu-engine.sh`

**Role:** Guarded vendor-acquisition script. It resolves or accepts a pinned upstream commit, clones/checks out that exact commit, attempts to identify the intended engine entry, checks required exports/APIs and JavaScript module syntax, detects problematic bare imports and remote executable-runtime dependencies, checks for an applicable upstream license or exact written-permission evidence, stages the source, and includes rollback safeguards for its vendor update.

**Limits:** The script's presence does not mean the vendor operation has succeeded. A license/permission failure is a genuine blocker and must not be bypassed merely to make a workflow green. An upstream engine with remote JavaScript/WASM dependencies is not a complete offline bundle just because its main file is copied locally.

### FILE-10 — `service-worker.js`

**Role:** Test-repository service worker. It caches the same-origin app shell and local modules, recognizes the five approved model assets, handles the pinned ONNX Runtime Web CDN asset pattern, aligns cache names with `model-cache.js`, and includes checks intended to prevent unverified model/runtime responses or legacy remote engine-source fallbacks from being accepted as trusted local assets.

**Limits:** Browser cache APIs, service-worker lifecycle, storage limits, origin changes, network redirects, and cache state can affect behavior. Shell availability is not equivalent to complete offline inference. Offline status passes only after a fresh generation and playback have been performed with the device disconnected.

### FILE-11 — `singing-engine-prototype.html`

**Role:** Separate browser test panel for engine settings, dependency checks, backend selection, synthesis attempts, progress/errors, and generated WAV playback/download. It is useful for isolating engine behavior from the main editor.

**Limits:** It is a prototype/test harness, not proof that the feature is fully integrated into the main application. Its status only counts when the test is actually executed and results are recorded. A browser API check is not the same as a model-inference pass.

### FILE-12 — `soulx-mobile-audit.html`

**Role:** Mobile/browser capability diagnostic for APIs including WebGPU, WebAssembly, shared WASM memory where available, device/memory indicators, storage and audio-related APIs. It can create a machine-readable report locally.

**Critical distinction:** The page explicitly does not download or run the SoulX-Singer checkpoint. It tests platform capabilities, not a SoulX model, ONNX export compatibility, Sanskrit pronunciation, or singing quality.

**Limits:** API availability is only a prerequisite indicator. Model loading, provider/operator compatibility, actual inference, decoding, playback, and voice quality require separate tests on the target Android device.

### FILE-13 — `vagdhenu-inference-audit-cdn.html`

**Role:** An alternate diagnostic that loads an upstream/browser engine by CDN and attempts to inspect its API and run synthesis, with playback/download/report controls.

**Limits:** It depends on the current external upstream and CDN/network behavior and is not identical to testing the locally integrated adapter. The upstream revision may differ over time. Treat it as a comparison/diagnostic pathway, not the authoritative proof that the repository's pinned local path works. Source licensing must be reviewed separately from model-weight licensing.

### FILE-14 — `vagdhenu-inference-audit.html`

**Role:** Local-path integration test page. It imports the repository's `vagdhenu-onnx.js` adapter, attempts engine/model initialization, enables synthesis after successful initialization, and exposes the resulting audio and diagnostics. It is designed to distinguish module loading from a real synthesis attempt.

**Limits:** The page must be run on the target deployment. A declared PASS is valid only when its required operation really happened and observable audio output can be played. It does not by itself establish Vedic accent accuracy or fully offline behavior.

### FILE-15 — `vagdhenu-onnx.js`

**Role:** Public compatibility adapter that exposes `VagdhenuWebEngine`, maps public backend labels (`wasm` / `onnx`) to internal names, points to one same-origin vendor-path module, checks for the expected engine constructor/methods at runtime, forwards initialization/synthesis calls, manages runtime metadata, handles audio results, and can package PCM data into a WAV Blob.

**Confirmed comment/code contradiction:** The adapter header claims the vendor-path file contains plain-text instructions and that the adapter deliberately fails closed. In this snapshot, the code configures a same-origin URL for `vendor/vagdhenu-upstream/vagdhenu-onnx.js` and dynamically imports it; the referenced file is JavaScript. This is a confirmed documentation inconsistency, not a runtime PASS. The adapter's own metadata explicitly leaves local inference unverified. Reconcile the header and status docs only through an authorized, reviewed change.

### FILE-16 — `vagdhenu-runtime-audit.html`

**Role:** Runtime/device audit aimed at Android Chrome and the ONNX/WASM execution environment. It checks secure context, WASM/WebGPU availability, device concurrency and model-session/runtime conditions.

**Limits:** A successful API/session test is narrower than a successful complete synthesis pipeline. It does not by itself prove that real audio was generated, played, pronounced accurately, produced with the desired timbre, or generated offline.

### FILE-17 — `vagdhenu-source-audit.html`

**Role:** Internet-dependent audit of upstream repository metadata, file listings, source content/API indicators and license-related metadata. It does not itself run a model or generate audio.

**Limits:** It describes the external source/repository response at the moment it is run. It cannot alone establish redistribution permission for every source file/model, and a successful GitHub API request is not an inference test.

### FILE-18 — `vagdhenu-text.js`

**Role:** Sanskrit/Devanagari text utility module. The exports include input validation, Unicode normalization, non-mutating TTS preparation, Vedic-mark detection, character recognition, line splitting, segmentation/tokenization, syllable counting, verse/prosody analysis, term lookup, text-preservation comparison, Devanagari/SLP1 conversion, akshara/pada handling, meter-key handling, and model-input piece preparation. It also contains utility self-tests.

**Limits:** Meter/prosody and syllabification functions are algorithmic heuristics unless a given rule set has been independently validated. Character recognition or preservation checks do not prove that a neural model will pronounce the same text correctly. A passing utility self-test covers only its specified cases, not every Sanskrit or Vedic form.

### FILE-19 — `vendor/vagdhenu-upstream/vagdhenu-onnx.js`

**Role:** The 83,383-byte / 2,943-line JavaScript file's own header describes it as an **original local Vāgdhenu ONNX runtime bridge**, not copied upstream browser-engine source. It imports `../../vagdhenu-text.js`, exports `VagdhenuWebEngine`, declares the 24 kHz output rate and five expected assets (three ONNX model files plus `baked_bank.json` and `baked_bank.bin`), and implements the conditioner/DiT/Vocos inference path.

**Provenance/architecture caveat:** Its repository path and the upstream-vendoring workflow imply a vendored upstream source role, while the file header describes a project-authored bridge. Static inspection cannot independently verify authorship/provenance. The guarded fetch workflow may replace this path with pinned upstream content, so it must not be run until the role and API compatibility are explicitly reviewed.

**Dependencies/limits:** Source references ONNX Runtime Web version `1.23.2` from jsDelivr and model assets from Hugging Face repositories. File presence and valid syntax do not prove lawful redistribution, model availability, initialization, inference, audio quality or offline operation. Source provenance, the exact upstream commit (if any), license/permission, dependencies, initialization, inference, audio playback, device performance and output quality must be independently verified. Do not state that this engine is license-cleared without the relevant evidence.

## 6. Cross-file relationship map

The following describes observed relationships in the reviewed source, not a newly mandated final operating architecture. The goal of automatic file discovery and central-registry maintenance is approved in Section 17; the concrete technical architecture and implementation remain pending separate explicit authorization.

1. `index.html` provides the UI/media stage and loads `app.js`.
2. `app.js` creates/binds the AI controls and imports `index.js`; it separately loads `pronunciation-learning.js` and `model-cache.js`, and registers `service-worker.js` when the browser supports it.
3. `index.js` checks the local modules and vendor-entry markers, then imports `vagdhenu-onnx.js` and `vagdhenu-text.js` and coordinates the engine facade.
4. `vagdhenu-onnx.js` dynamically imports the same-origin `vendor/vagdhenu-upstream/vagdhenu-onnx.js` path and adapts the public API.
5. The vendor engine uses `vagdhenu-text.js` for text preparation and loads ONNX Runtime Web/model assets as configured in its source.
6. `model-cache.js` downloads and verifies the five required model assets and saves cache/revision metadata. `service-worker.js` handles recognized app-shell, runtime and model requests. These components cooperate on caching but do not by themselves prove offline inference.
7. `pronunciation-learning.js` measures and stores selected reference-media descriptors. A verified conditioning/training path from those descriptors into the singing model is **not established** by that workflow.
8. `singing-engine-prototype.html`, `vagdhenu-inference-audit.html`, `vagdhenu-inference-audit-cdn.html`, `vagdhenu-runtime-audit.html`, `model-audit.html`, `module-audit-anjali.html`, `soulx-mobile-audit.html`, and `vagdhenu-source-audit.html` are separate diagnostic/prototype pages. Their individual results must not automatically be reported as a pass for the main app.
9. `neural-studio.html` opens an external studio; it is not an integration layer that automatically returns audio to the main media editor.
10. `scripts/fetch-vagdhenu-engine.sh` is an acquisition/validation tool. The separate GitHub workflow invokes the vendor process, but the existence of the script/workflow does not mean the licensing or source update has passed.

## 7. Capability register — 28 cross-file capability areas

These IDs are the central file's indexing system, not claims that the repository has exactly 28 separately released product features. Status describes evidence in the reviewed archive unless stated otherwise.

| ID | Capability area | Principal files | Evidence status / boundary |
|---|---|---|---|
| CAP-01 | Main Sanskrit input and editor interface | `index.html` | UI code present; deployed behavior not freshly verified |
| CAP-02 | Text queue, draft preview and source-text display | `index.html` | Code present; complete preservation testing required |
| CAP-03 | Browser-native voice list and TTS test | `index.html` | Separate from AI singing; voice depends on browser/device |
| CAP-04 | 9:16-style media stage, photo/video/audio selection and recording controls | `index.html` | Code present; completed export/sync behavior not established |
| CAP-05 | AI control-panel integration | `app.js`, `index.html` | Code present; actual inference outcome not implied |
| CAP-06 | Dynamic engine/text module loading and dependency diagnostics | `app.js`, `index.js` | Code present; source review identifies documentation mismatch |
| CAP-07 | Backend selection and adapter alias handling | `app.js`, `index.js`, `vagdhenu-onnx.js`, vendor engine | Options/code present; each backend needs runtime test |
| CAP-08 | Engine initialization, progress/error reporting and stop/cancel handling | `app.js`, `index.js`, adapter/vendor engine | Code present; device behavior not freshly tested |
| CAP-09 | Synthesis request and engine output handling | `app.js`, `index.js`, adapter/vendor engine | Code present; real end-to-end output not verified in this review |
| CAP-10 | Result validation, WAV packaging, playback and download | `app.js`, `index.js`, `vagdhenu-onnx.js`, vendor engine | Validation/export code present; audible output not freshly tested |
| CAP-11 | Input limits, validation and derived-text preparation | `app.js`, `index.js`, `vagdhenu-text.js` | Code present; preservation must be tested on edge cases |
| CAP-12 | Unicode/Devanagari validation and Vedic-mark detection | `vagdhenu-text.js` | Utility tests pass 14/14; limited to listed cases |
| CAP-13 | Lines, segments, tokens and character-level processing | `vagdhenu-text.js` | Code present; heuristic/edge-case validation remains |
| CAP-14 | SLP1 mapping, akshara/pada/halant utilities | `vagdhenu-text.js`, vendor engine | Code present; no claim of universal Sanskrit correctness |
| CAP-15 | Syllable, verse and meter/prosody analysis | `vagdhenu-text.js`, vendor engine | Analysis helpers present; rule accuracy requires specialized tests |
| CAP-16 | Original/candidate text preservation comparison | `vagdhenu-text.js`, `index.js` | Comparator and test coverage present; not exhaustive |
| CAP-17 | Required model asset inventory and repository metadata lookup | `model-cache.js`, vendor engine | Code present; live asset availability not freshly tested |
| CAP-18 | Pinned-revision download and file-integrity verification | `model-cache.js` | Verification logic present; no implication all current assets downloaded |
| CAP-19 | Model-cache status, metadata and clear-cache path | `model-cache.js` | Code present; actual browser cache state not examined |
| CAP-20 | App-shell, runtime and verified-model service-worker policy | `service-worker.js`, `model-cache.js` | Code present; complete offline generation/playback not tested |
| CAP-21 | User-selected audio-reference measurement | `pronunciation-learning.js`, `app.js` | Limited acoustic measurements; not pronunciation scoring |
| CAP-22 | Video-reference sampling, local records and JSON export | `pronunciation-learning.js`, `app.js` | Limited path and storage code present; no neural learning claim |
| CAP-23 | Android/browser WebGPU/WASM, memory/storage/API audit | `soulx-mobile-audit.html` | Diagnostic code present; does not run a singing checkpoint |
| CAP-24 | Model/device/asset information report | `model-audit.html` | Diagnostic code present; current device results not refreshed |
| CAP-25 | Engine/text export compatibility and module audit | `module-audit-anjali.html` | Test harness present; must be run for a current PASS |
| CAP-26 | Same-origin engine initialization and actual synthesis test harness | `vagdhenu-inference-audit.html`, `singing-engine-prototype.html` | Tests available; not run end-to-end in this central-file review |
| CAP-27 | Runtime-session audit and external/CDN inference comparison | `vagdhenu-runtime-audit.html`, `vagdhenu-inference-audit-cdn.html` | Diagnostic paths present; external result is not local-integration proof |
| CAP-28 | Source/license audit, external studio route and guarded vendor acquisition | `vagdhenu-source-audit.html`, `neural-studio.html`, `scripts/fetch-vagdhenu-engine.sh` | Useful diagnostic/acquisition paths present; source license/permission remains unverified in reviewed records |

## 8. Material inconsistencies and blockers (updated by audit revision 1.1)

### 8.1 Adapter/vendor-file description mismatch

`vagdhenu-onnx.js` comments say `vendor/vagdhenu-upstream/vagdhenu-onnx.js` contains plain-text instructions, but the reviewed file is a 2,943-line JavaScript bridge whose own header describes it as an original local implementation rather than copied upstream engine source. The comment is inconsistent with the actual file. Authorship/provenance has not been independently verified, and the file must not be called the verified upstream engine.

**Required disposition:** Keep the inconsistency recorded until a separate approved documentation/code review reconciles the comment, actual source, source revision and test evidence. Do not delete the vendor file, silently rewrite the comment, or assume runtime success as part of this central-file task.

### 8.2 Implementation-status narrative may be stale relative to the reviewed source

`README.md` and `AI-ENGINE-IMPLEMENTATION-STATUS.md` describe an external upstream import / missing vendor implementation, while the reviewed adapter code points to the same-origin vendor path and the file there is a JavaScript bridge. The documentation is stale relative to the snapshot and the intended architecture is not yet resolved.

**Required disposition:** Treat this as a documentation-versus-source conflict. The status record should be refreshed only through an explicitly authorized change after checking the current commit and workflow evidence. This task has not edited that document.

### 8.3 Upstream source licensing/provenance

The vendor acquisition script contains a deliberate legal gate requiring a recognized top-level source license or exact written-permission evidence. The project implementation-status document reports a prior workflow failure because upstream source licensing/permission was not established. No claim of license clearance is made by this file.

**Required disposition:** Verify the exact upstream repository, exact commit SHA, grantor, permission/license, and rights covering modification, redistribution, the intended browser-local use, and offline caching. Verify model-weight licenses separately. Do not bypass the guard.

### 8.4 External runtime dependency / offline status

The vendor source references ONNX Runtime Web `1.23.2` from jsDelivr and model assets from Hugging Face. The local model-cache and service worker contain caching/integrity logic, but the reviewed source alone does not prove every runtime asset has been cached or that an offline engine can initialize and generate audio.

**Required disposition:** Measure actual asset downloads, revision/hashes, cache completeness and total bytes; then perform full offline initialization, synthesis and playback on the target Android browser.

### 8.5 Model quality and reference-conditioning status

The code includes model inference components and reference-media analysis. Neither source presence nor acoustic descriptors establish feminine-friendly timbre, trained personalization, pronunciation correction, Vedic accent accuracy, or a working audio-conditioning path from user references into the engine.

**Required disposition:** Evaluate real output with controlled, repeatable listening and signal tests, and separately inspect whether any supported conditioning input is actually consumed by the model.

## 9. Known user-reported defects — open until reproduced and verified fixed

These defects were reported by the user in prior project work. They are retained as real test reports; this review did not independently reproduce them against the live deployment.

| ID | User-reported result | Status | Required evidence for closure |
|---|---|---|---|
| DEF-01 | Male TTS/voice heard where the target is feminine-friendly singing | OPEN — reported; exact pathway not isolated here | Record browser/device, selected voice/backend, input and actual audio; separate native browser TTS from neural output; test the generated audio's timbre |
| DEF-02 | A word containing the relevant Vedic `अ` character/mark is omitted from output | OPEN — reported; cause not established | Preserve a minimal input reproducer; compare original text, derived model input, token IDs/segments if available, engine output metadata and generated audio; test positive and negative controls |
| DEF-03 | A word ending in anusvara/bindi is omitted; example reported: `बयां` | OPEN — reported; cause not established | Record exact text/code points and whether the tested character was `ं` or `ँ`; compare original/derived text, segmentation/tokenization and audio; ensure the whole word is not silently dropped |

Do not mark a defect closed merely because a utility returns an expected value. Closure requires a repeatable test of the reported failing case and nearby edge cases on the actual processing path, followed by recorded evidence from the intended deployment.

## 10. Verification ledger for the 2026-10-18 static audit

### Checks run on the supplied baseline snapshot

- Confirmed the archive SHA-256 matches the existing baseline lock: **PASS**.
- Compared the 19 designated file hashes against the existing baseline entries: **19/19 MATCH**.
- Ran JavaScript syntax checks on the eight standalone JS modules/files: **PASS 8/8** for `app.js`, `index.js`, `model-cache.js`, `pronunciation-learning.js`, `service-worker.js`, `vagdhenu-onnx.js`, `vagdhenu-text.js`, and `vendor/vagdhenu-upstream/vagdhenu-onnx.js`.
- Extracted and syntax-checked inline JavaScript in nine HTML pages: **PASS 9/9** (syntax only; not browser execution).
- Ran `bash -n` against `scripts/fetch-vagdhenu-engine.sh`: **PASS**; the script was not run and no vendor files were changed.
- Ran `vagdhenu-text.js` self-tests: **14 PASS / 0 FAIL**.
- Recomputed the supplied ZIP SHA-256 and compared all 25 extracted files against `manifest.tracked_files`: **25/25 match**.
- Tried to access GitHub Pages and GitHub metadata, but this environment could not retrieve the live site; the live test is **BLOCKED**, not PASS.

### What these checks do not prove

- They do not prove the live GitHub Pages deployment has the same commit/content.
- They do not prove all inline scripts on all HTML diagnostic pages execute in the target browser.
- They do not prove model downloads, license clearance, ONNX session initialization, model inference, non-empty usable audio, audible playback, pronunciation accuracy, Vedic accent accuracy or the desired vocal timbre.
- They do not prove Android performance, long-input behavior, complete offline operation, audio/video synchronization or recording/export reliability.
- The 14 utility tests are limited unit tests; they are not a complete corpus test for Sanskrit/Vedic text. The adapter header, README and implementation-status document conflict with the actual local vendor-path source and must be reconciled. The vendor-path file identifies itself as an original local bridge; its provenance has not been independently verified.

**Current evidence classification:** static source review and limited utility/syntax checks completed; deployed end-to-end singing and offline operation remain **NOT VERIFIED**.

## 11. आवश्यक स्वीकृति-जाँच प्रक्रिया

भविष्य के इंजीनियरिंग कार्यों में नीचे दिया गया क्रम अपनाएँ। प्रत्येक जाँच का वास्तविक परिणाम दर्ज करें; अनुमान या धारणा के आधार पर किसी जाँच को बाद में `PASS` न लिखें।

### A. मूल स्थिति और परिवर्तन की अखंडता

1. लक्षित Git commit और deployment URL दर्ज करें।
2. प्रभावित सभी फ़ाइलों की तुलना अपरिवर्तित baseline अथवा स्वीकृत परिवर्तन-अवस्था के manifest से करें।
3. जोड़ी गई, बदली गई और हटाई गई प्रत्येक फ़ाइल का सटीक पथ तथा SHA-256 hash दर्ज करें।
4. मूल baseline manifest अपरिवर्तित रखें; किसी स्वीकृत संशोधन के लिए अलग परिवर्तन-अवस्था अभिलेख बनाएँ।

### B. पाठ की अखंडता

1. परीक्षण के लिए मूल इनपुट को ठीक उसी रूप में सुरक्षित रखें जिसमें वह दर्ज किया गया था।
2. देवनागरी स्वर, मात्राएँ, संयुक्ताक्षर, विराम-चिह्न, दण्ड, अनुस्वार `ं`, चन्द्रबिन्दु `ँ`, विसर्ग `ः`, संयोजक चिह्न और लागू वैदिक चिह्न शामिल करके जाँचें।
3. हर text transform से पहले और बाद में Unicode code points तथा दिखाई देने वाले पाठ की तुलना करें।
4. पुष्टि करें कि सामान्यीकृत या मॉडल-विशिष्ट पाठ के कारण मूल इनपुट अधिलेखित नहीं हुआ।
5. DEF-02 और DEF-03 के लिए लक्षित regression tests चलाएँ, जिनमें `बयां` तथा दर्ज संबंधित उदाहरण शामिल हों।
6. वास्तविक उत्पन्न ऑडियो सुनकर जाँचें; केवल पाठ सुरक्षित रहने से सही उच्चारण का निष्कर्ष न निकालें।

### C. मॉड्यूल, मॉडल और लाइसेंस की अखंडता

1. पुष्टि करें कि imports अपेक्षित और उसी origin के स्रोत-पथ पर resolve होते हैं।
2. जाँचें कि vendor source का revision और अपेक्षित API markers सही हैं।
3. इंजन-स्रोत के सटीक revision के लिए पर्याप्त वैध लाइसेंस/अनुमति सत्यापित करें; मॉडल के लाइसेंस अलग जाँचें।
4. हर आवश्यक model/runtime asset का स्रोत URL, revision, byte size, अपेक्षित digest और सत्यापित digest दर्ज करें।
5. आवश्यक asset या अनुमति अनुपस्थित होने पर प्रक्रिया को सुरक्षित रूप से रोकें; सुरक्षा-जाँच को दरकिनार न करें।

### D. वास्तविक inference और ऑडियो

1. लक्षित Android browser पर इंजन initialize करें।
2. backend, device, browser/version, initialization diagnostics और लगा समय दर्ज करें।
3. ज्ञात छोटे संस्कृत श्लोक और नियंत्रित edge-case पाठ से ऑडियो उत्पन्न करें।
4. पुष्टि करें कि inference वास्तव में पूरा हुआ तथा ऑडियो डेटा खाली नहीं और वैध है।
5. डिवाइस पर ऑडियो चलाकर मौन, कटाव, शब्द छूटने, गलत शब्द-सीमा और playback त्रुटियों की जाँच करें।
6. बोधगम्यता, संस्कृत उच्चारण, लय/छंद, pitch स्थिरता और स्त्री-सुलभ timbre का अलग-अलग मूल्यांकन करें; ये अलग स्वीकृति-मापदंड हैं।
7. Browser-native TTS और neural-engine के परिणामों की तुलना केवल अलग-अलग निष्पादन-पथों के रूप में करें।

### E. ऑफ़लाइन संचालन

यह परीक्षण आवश्यक फ़ाइलों के डाउनलोड और उनकी पहचान के सत्यापन के बाद ही करें।

1. परीक्षण ऐप को ऑनलाइन खोलें।
2. अनुमत पहली बार के डाउनलोड पूरे करें और पुष्टि करें कि सभी आवश्यक model/runtime assets अपने अपेक्षित cache में मौजूद हैं।
3. cache metadata, hashes, revision और storage usage दर्ज करें।
4. ऐप को आवश्यकतानुसार बंद/पुनः लोड करें और नेटवर्क की सभी पहुँच बंद करें।
5. प्रकाशित परीक्षण ऐप को फिर खोलें, इंजन initialize करें, नया ऑडियो परिणाम उत्पन्न करें और नेटवर्क बंद रहते हुए उसे चलाएँ।
6. हर network request, cache miss, विफलता या अधूरे परिणाम का अभिलेख रखें।

केवल HTML shell का cache होना या model-cache का सफल संदेश इस परीक्षण को पास नहीं करता।

### F. अंतिम रिपोर्ट

प्रत्येक परीक्षण के लिए test ID, दिनांक/समय, Git commit, deployment URL, device/browser, input, वास्तविक output, diagnostics, प्रमाण का स्थान और निम्न में से एक स्थिति दर्ज करें:

- `PASS` — अपेक्षित परिणाम वास्तव में देखा गया।
- `FAIL` — अपेक्षित परिणाम प्राप्त नहीं हुआ।
- `PARTIAL` — परीक्षण का केवल कुछ भाग सफल हुआ।
- `BLOCKED` — किसी पूर्व-आवश्यकता, अनुमति या निर्भरता के अभाव ने परीक्षण रोका।
- `NOT TESTED` — परीक्षण अभी चलाया नहीं गया।

काल्पनिक screenshots, logs, output audio, hashes या परीक्षण-परिणाम न बनाएँ।

## 12. परिवर्तन-नियंत्रण प्रक्रिया

1. किसी भी कार्यान्वयन से पहले बदली जाने वाली सटीक फ़ाइलों, repository-relative paths और अपेक्षित व्यवहार का उल्लेख करें।
2. imports, module contracts, model URLs, caches, service worker, build/workflow, text transformation और licenses पर संभावित प्रभाव पहचानें।
3. उस विशिष्ट कार्यान्वयन-चरण के लिए उपयोगकर्ता की स्पष्ट अनुमति मिलने तक बदलाव न करें।
4. सबसे छोटा संगत बदलाव करें; असंबंधित व्यवहार और मूल इनपुट पाठ सुरक्षित रखें।
5. `anujadha` में बदलाव न करें।
6. मूल baseline ZIP या manifest को न बदलें और न प्रतिस्थापित करें। किसी अनुमत नए स्रोत-अवस्था का अलग अभिलेख रखें।
7. बदलाव के बाद परियोजना की delivery requirements के अनुसार पूर्ण फ़ाइल-सामग्री/पथ, hashes, चलाए गए और न चलाए गए परीक्षण, वास्तविक परिणाम, जोखिम और rollback point रिपोर्ट करें।
8. source revision, license evidence और तृतीय-पक्ष assets में बदलाव का जाँच-योग्य रिकॉर्ड रखें।
9. इस केंद्रीय नियंत्रण फ़ाइल को बनाने या बदलने को application code बदलने की अनुमति न मानें।

## 13. परियोजना के लक्ष्य की सफलता के मानदंड

ऐप को वास्तविक end-to-end AI गायन क्षमता वाला तभी बताया जा सकेगा जब निम्न सभी प्रासंगिक बिंदुओं के समर्थन में प्रमाण उपलब्ध हों:

1. इंजन-स्रोत और निर्भरताओं की सही पहचान हुई हो और उनका वैध उपयोग संभव हो।
2. लक्षित browser, अपेक्षित स्थानीय engine path तथा model assets को load करता हो।
3. लक्षित डिवाइस पर वास्तविक inference पूरा होता हो।
4. उपयोगकर्ता के दिए संस्कृत पाठ से खाली न होने वाला वैध ऑडियो उत्पन्न होता हो।
5. ऑडियो अनपेक्षित शब्द-छूट या कटाव के बिना चल सके।
6. मूल उपयोगकर्ता-पाठ सुरक्षित हो तथा मॉडल-इनपुट में हर परिवर्तन का पता लगाया जा सके और वह मूल पाठ को नष्ट न करे।
7. बोधगम्यता, उच्चारण, लय/छंद, pitch स्थिरता और स्त्री-सुलभ timbre जैसे गुणवत्ता-मापदंडों का वास्तविक ऑडियो से मूल्यांकन हुआ हो।
8. Android compatibility का दावा लक्षित Android/browser संयोजन पर परीक्षण करके प्रमाणित हो।
9. ऑफ़लाइन संचालन का दावा तभी हो जब पूर्ण ऑफ़लाइन generation और playback परीक्षण सफल हुआ हो।
10. ज्ञात विफलताओं, अपरीक्षित क्षेत्रों, तृतीय-पक्ष अधिकारों और शेष जोखिमों की स्पष्ट रिपोर्ट उपलब्ध हो।

लक्ष्य हर diagnostic page पर सफलता दिखाना नहीं है; लक्ष्य उपयोगकर्ता को संस्कृत में अपनी स्वर/ऑडियो अभिव्यक्ति के लिए एक विश्वसनीय साधन देना है।

## 14. Current central status

| Area | Status as of this document |
|---|---|
| Baseline identity and 19-file mapping | VERIFIED against supplied archive hashes |
| Standalone JS syntax and shell syntax | PASS for checks listed in Section 10 |
| `vagdhenu-text.js` built-in utility tests | 14 PASS / 0 FAIL; coverage limited |
| Central file's map of the 19 files | PROVISIONAL; the 19-file roles are mapped, but the CAP-01–CAP-28 area register is not yet proven to be the canonical original requirements list |
| Central operating principles | USER-APPROVED in Section 17; implementation and automated enforcement NOT YET IMPLEMENTED |
| Vendor adapter / vendor-path / README status mismatch | CONFIRMED OPEN — comments and docs contradict the actual snapshot; correction documented, implementation edit not authorized |
| Upstream engine source licensing/permission | BLOCKED / NOT VERIFIED in the reviewed records |
| Live GitHub Pages revision and real inference/audible output | BLOCKED / NOT VERIFIED; live fetch unavailable in this audit environment |
| Desired feminine-friendly singing quality | NOT VERIFIED by this review |
| Reported vowel/anusvara omissions | OPEN — user-reported; fresh reproduction needed |
| Full offline initialization, generation and playback | NOT VERIFIED |
| `anujadha` compatibility | URL supplied in Section 4.2; read-only source/revision/interface audit still pending |
| Production readiness | NOT ESTABLISHED; final audit is blocked by live/device/rights/compatibility evidence |

## 15. अंतिम संचालन सिद्धांत

19 फ़ाइलों को एक समन्वित क्षमता-समूह के रूप में देखें, लेकिन केवल फ़ाइलों के मौजूद होने से यह न मानें कि वे पहले से मिलकर सही काम करती हैं। वास्तविक interfaces और dependency paths पढ़ें, मूल स्रोत-पाठ सुरक्षित रखें, diagnostic pages को केवल उन्हीं सीमित जाँचों के प्रमाण के रूप में उपयोग करें जिन्हें वे वास्तव में जाँचते हैं, और “स्रोत मौजूद है” से “रनटाइम पर परीक्षण हुआ है” तथा फिर “end-to-end परिणाम सत्यापित है” तक पहुँचने के लिए आवश्यक प्रमाण दर्ज करें।

अनुभाग 17 में दर्ज संचालन सिद्धांत उपयोगकर्ता द्वारा स्वीकृत हैं, लेकिन उनका तकनीकी कार्यान्वयन अभी लंबित है। यह संस्करण ऑडिट-समीक्षित नियंत्रण-मसौदा है, अंतिम उत्पाद-प्रमाणपत्र नहीं। 19-फ़ाइल मानचित्र मूल canonical feature requirements के संबंध में अभी provisional है; CAP-01–CAP-28 सूची को उपयोगकर्ता की मूल requirements सूची के रूप में अभी सत्यापित नहीं किया गया है। दिए गए स्रोत-स्नैपशॉट ने सूचीबद्ध static checks पास किए, लेकिन live GitHub Pages, लक्षित Android inference/audio, ऑफ़लाइन generation/playback, स्रोत-इतिहास/लाइसेंस और `anujadha` compatibility अभी खुले सत्यापन-बिंदु हैं। यह दस्तावेज़ अपने-आप ऐप में बदलाव नहीं करता और न ही अपरीक्षित व्यवहार को प्रमाणित करता है।

## 16. ऐतिहासिक ऑडिट-लॉक टिप्पणी — संशोधन 1.2

यह टिप्पणी मूल ऑडिट संशोधन 1.2 के लॉक-संदर्भ को सुरक्षित रखने के लिए रखी गई है। `SWAR_SADHIKA_SOURCE_AUDIT_LOCK.md` और `SWAR_SADHIKA_CENTRAL_CONTROL_AUDIT_LOCK.md` के SHA-256 मान `SWAR_SADHIKA_AUDIT_LOCK_SHA256SUMS.txt` में दर्ज किए गए थे। वे पुराने ऑडिट स्नैपशॉट की अखंडता की जाँच में सहायक हैं; वे इस संशोधित 1.4 फ़ाइल के हैश की पुष्टि नहीं करते, GitHub शाखा को लॉक नहीं करते और न ही अपरीक्षित रनटाइम व्यवहार को प्रमाणित करते हैं। यदि संशोधन 1.4 के लिए हैश-लॉक चाहिए, तो अंतिम फ़ाइल तय होने के बाद नया हैश और नया/अपडेट किया गया manifest बनाकर सत्यापित करना होगा। इस स्थानीय दस्तावेज़ को तैयार करने से GitHub रिपॉज़िटरी, ऐप स्रोत, मूल baseline ZIP या मूल baseline manifest में कोई परिवर्तन नहीं किया गया है।

## 17. उपयोगकर्ता द्वारा स्वीकृत केंद्रीय संचालन नियम — संशोधन 1.4

इस अनुभाग में वे संचालन नियम दर्ज हैं जिन्हें उपयोगकर्ता ने संवाद में स्पष्ट रूप से स्वीकार किया है। इस संशोधन में नियमों की भाषा, नई फ़ाइलों की पहचान, केंद्रीय रजिस्टर, प्रमाण-आधारित सत्यापन, `anujadha` की सुरक्षा तथा नियमों के समयानुकूल पुनर्मूल्यांकन को एक साथ दर्ज किया गया है। “लॉक” का अर्थ है कि वर्तमान स्वीकृत नियम लागू रहने तक उनका पालन अनिवार्य है; इसका अर्थ यह नहीं है कि कोई नियम सदा के लिए अपरिवर्तनीय है। नियमों में बदलाव संभव है, और आवश्यक होने पर बदलाव की प्रक्रिया स्वयं भी समीक्षा और संशोधन के अधीन होगी।

### 17.1 नियमों की भाषा

1. केंद्रीय मिशन कंट्रोल में सभी नियम, निर्देश, नीतियाँ, कार्यप्रणालियाँ, स्वीकृति-मापदंड, जाँच-प्रक्रियाएँ और संशोधन-संबंधी प्रावधान हिंदी भाषा में लिखे जाएँगे।
2. फ़ाइल-पथ, फ़ाइल-नाम, प्रोग्रामिंग भाषा के नाम, कोड, आदेश, API नाम, तकनीकी पहचानकर्ता, हैश और आधिकारिक परियोजना नाम आवश्यकतानुसार अपने मूल तकनीकी स्वरूप में रखे जा सकते हैं। उनका अर्थ और उपयोग हिंदी में समझाया जाएगा।
3. यदि किसी तकनीकी नाम का अनुवाद करने से पहचान या सटीकता प्रभावित हो सकती है, तो मूल नाम सुरक्षित रखा जाएगा और उसका विवरण हिंदी में दिया जाएगा।

### 17.2 नियमों का लॉक, परिवर्तन और नियंत्रित संशोधन

1. उपयोगकर्ता द्वारा स्पष्ट रूप से स्वीकृत और वर्तमान में लागू नियमों का पालन अनिवार्य होगा। कोई नियम केवल सुझाव, अनुमान या सहायक के एकतरफ़ा निर्णय से नहीं बदला जाएगा।
2. **कोई भी नियम केवल इसलिए स्थायी या अपरिवर्तनीय नहीं होगा कि उसे पहले स्वीकृति मिली थी।** समय, अनुभव, नई जानकारी, तकनीकी प्रगति, परीक्षण-परिणाम या परियोजना की बदलती आवश्यकताओं के आधार पर हर नियम का पुनर्मूल्यांकन किया जा सकता है।
3. समीक्षा के बाद किसी नियम को यथावत रखा जा सकता है, संशोधित किया जा सकता है, किसी बेहतर नियम से प्रतिस्थापित किया जा सकता है या पूरी तरह निरस्त किया जा सकता है। पुराने नियम को केवल पुराना होने के बावजूद बनाए रखना लक्ष्य नहीं है; लक्ष्य परियोजना के लिए सर्वोत्तम उपलब्ध और प्रमाण-समर्थित समाधान अपनाना है।
4. महत्त्वपूर्ण संशोधन के अभिलेख में कम-से-कम ये बातें लिखी जाएँगी: (क) पुराना नियम, (ख) प्रस्तावित नया नियम या उसे हटाने का प्रस्ताव, (ग) बदलाव का कारण, (घ) प्रभावित फ़ाइलें/निर्भरताएँ/कार्यप्रवाह, (ङ) संभावित लाभ और जोखिम, (च) उपयोगकर्ता की स्वीकृति की स्थिति, (छ) किए गए परीक्षण और उनके वास्तविक परिणाम, तथा (ज) लागू की गई संशोधन-संख्या/तिथि।
5. प्रस्ताव या सुझाव अपने-आप स्वीकृत नियम नहीं बनेगा। उपयोगकर्ता की आवश्यक स्पष्ट स्वीकृति और उसका अभिलेख उपलब्ध होने तक किसी स्वीकृत नियम में बदलाव को लागू घोषित नहीं किया जाएगा।
6. जब तक संशोधन स्वीकृत और लागू रूप में दर्ज न हो, वर्तमान स्वीकृत नियम प्रभावी रहेगा। यदि दो दर्ज नियमों में टकराव मिले, तो टकराव को स्पष्ट रूप से दर्ज करके उपयोगकर्ता से निर्णय लिया जाएगा; सहायक अपनी ओर से चुपचाप किसी एक को हटाकर लागू नहीं करेगा।
7. यह संशोधन-प्रक्रिया भी कोई अपरिवर्तनीय नियम नहीं है। यदि भविष्य में प्रक्रिया स्वयं अनुपयुक्त सिद्ध हो, तो उसे भी कारण, प्रभाव-जाँच, स्वीकृति और सत्यापन के साथ बदला जा सकता है।
8. नियमों का संवाद में “लॉक” होना अपने-आप GitHub शाखा-सुरक्षा, फ़ाइल-अपरिवर्तनीयता, स्वचालित रोक या किसी बाहरी प्रणाली का तकनीकी लॉक नहीं बनाता। ऐसे नियंत्रण अलग से लागू और सत्यापित करने होंगे।

### 17.3 नई फ़ाइलों की स्वतः पहचान और केंद्रीय रजिस्टर

1. प्रस्तावित केंद्रीय व्यवस्था का लक्ष्य यह होगा कि परीक्षण रिपॉज़िटरी में जोड़ी गई, बदली गई या हटाई गई प्रत्येक फ़ाइल का पता स्वचालित रूप से लगाया जाए।
2. नई फ़ाइल का पता लगने पर उसके पथ, प्रकार, हैश, भूमिका, निर्भरताओं, संबंधित फ़ाइलों, संभावित प्रभाव और जाँच-स्थिति का रिकॉर्ड केंद्रीय फ़ाइल रजिस्टर में बनाया या अद्यतन किया जाए।
3. कोई नई फ़ाइल केंद्रीय रजिस्टर से छूटनी नहीं चाहिए। इसके लिए स्वचालित सूची-मिलान या समकक्ष जाँच रखी जाए; जाँच विफल होने पर प्रक्रिया स्पष्ट विफलता दिखाए, न कि सफलता का दावा करे।
4. फ़ाइल का रजिस्टर में दर्ज होना उसकी शुद्धता, सुरक्षा, वैधता या कार्यशीलता का प्रमाण नहीं है।
5. किसी फ़ाइल को सत्यापित ज्ञान का दर्जा तभी दिया जाए जब उसके वास्तविक स्रोत, भूमिका, निर्भरताओं और लागू परीक्षणों की जाँच हो तथा संबंधित प्रमाण दर्ज हों। जाँच अधूरी होने पर उसकी स्थिति “लंबित”, “आंशिक रूप से सत्यापित” या “असत्यापित” के रूप में स्पष्ट रखी जाए।
6. नई फ़ाइलों की स्वतः पहचान, रजिस्टर अद्यतन और संबंध-विश्लेषण को लागू करने के लिए GitHub Actions या अन्य उपयुक्त स्वचालित साधन प्रस्तावित किए जा सकते हैं; परंतु उन्हें लागू हुआ तभी माना जाएगा जब कार्यप्रवाह वास्तव में बनाया, चलाया और प्रमाण सहित जाँचा गया हो।
7. यह नियंत्रण दस्तावेज़ स्वयं निष्पादन योग्य नहीं है। केवल इस अनुभाग में नियम लिख देने से स्वतः पहचान या रजिस्टर अद्यतन सक्रिय नहीं हो जाता।

### 17.4 केंद्रीय ज्ञान और प्रमाण का अनुशासन

1. फ़ाइलों को अलग-अलग वस्तुओं के रूप में नहीं, बल्कि उनके वास्तविक कार्य, निर्भरताओं, अनुबंधों और प्रभावों सहित परस्पर संबंधित तंत्र के रूप में समझा जाएगा।
2. वास्तविक स्रोत और पुनरुत्पादित परीक्षण-प्रमाण, फ़ाइल-नाम या टिप्पणी से अधिक विश्वसनीय माने जाएँगे। विरोध मिलने पर उसे दर्ज कर जाँचा जाएगा; चुपचाप किसी एक पक्ष को सही नहीं माना जाएगा।
3. किसी अप्रमाणित जानकारी को सत्यापित तथ्य के रूप में प्रस्तुत नहीं किया जाएगा। परीक्षण न होने पर “परीक्षण नहीं किया गया”; बाधा होने पर “अवरुद्ध”; और आंशिक सफलता पर “आंशिक” स्थिति दर्ज की जाएगी।
4. केंद्रीय रजिस्टर और संबंधित ज्ञान को फ़ाइल जोड़ने, बदलने या हटाने के बाद अद्यतन किया जाए और पुराने प्रमाण को वर्तमान स्थिति का प्रमाण न माना जाए, यदि स्रोत बदल चुका हो।

### 17.5 `anujadha` की सुरक्षा

1. `anujadha` मुख्य अनुप्रयोग संरक्षित रहेगा और सामान्य स्वर-साधिका विकास, स्वचालित खोज, रजिस्टर अद्यतन या परीक्षण के दौरान उसमें कोई बदलाव नहीं किया जाएगा।
2. किसी भावी बदलाव के लिए उपयोगकर्ता की स्पष्ट, विशिष्ट अनुमति आवश्यक होगी। इस नियम में संशोधन भी नियंत्रित प्रक्रिया, स्पष्ट अनुमति और दर्ज प्रमाण के बिना नहीं होगा।
3. स्वर-साधिका के परीक्षण, स्वचालन और फ़ाइल रजिस्टर का कार्य केवल स्वीकृत `swar-sadhika-test` रिपॉज़िटरी के दायरे में रखा जाएगा।

### 17.6 लागू होने की स्थिति

1. इस अनुभाग में दर्ज संचालन सिद्धांत उपयोगकर्ता द्वारा संवाद में स्वीकृत किए गए हैं और इस संशोधित स्थानीय मसौदे में लिखे गए हैं।
2. इस दस्तावेज़ में लिखे होने से अपने-आप कोड, GitHub Actions, शाखा-नियमों या रिमोट रिपॉज़िटरी में कोई परिवर्तन लागू नहीं होता। इस संशोधन को GitHub पर प्रकाशित या मूल कार्यशील फ़ाइल में प्रतिस्थापित किया गया है—ऐसा दावा तब तक नहीं किया जाएगा जब तक वह कार्य वास्तव में करके सत्यापित न हो।
3. तकनीकी कार्यान्वयन शुरू करने से पहले संबंधित फ़ाइलों, बदलावों, निर्भरताओं और परीक्षणों की योजना बनाई जाएगी तथा जहाँ आवश्यक हो, उपयोगकर्ता की स्पष्ट अनुमति ली जाएगी।
4. कार्यान्वयन पूरा होने का दावा तभी किया जाएगा जब वास्तविक बदलाव, चलाए गए परीक्षण और उनके परिणाम उपलब्ध प्रमाण से पुष्ट हों।

### 17.7 नियमों के समयानुकूल पुनर्मूल्यांकन का मूल सिद्धांत

नियम परियोजना की सहायता के लिए हैं; परियोजना को पुराने नियमों का बंदी बनाने के लिए नहीं। समय परिवर्तनशील है, इसलिए आज उपयोगी या आदर्श माना गया नियम भविष्य में कम उपयोगी, अप्रासंगिक या तकनीकी रूप से अनुपयुक्त हो सकता है। ऐसी स्थिति में पुराने नियम को केवल उसकी पूर्व स्वीकृति के कारण बचाए रखना आवश्यक नहीं होगा।

1. प्रत्येक नियम को आवश्यकता पड़ने पर नए प्रमाण, अनुभव, तकनीकी प्रगति और परियोजना के वर्तमान लक्ष्य के अनुसार फिर से परखा जा सकेगा।
2. समीक्षा का परिणाम चार में से कोई हो सकता है: नियम को बनाए रखना, उसमें संशोधन करना, उसे बेहतर नियम से बदलना, या उसे निरस्त करना।
3. नया नियम केवल नया होने से बेहतर नहीं माना जाएगा; उसका मूल्य उसकी उपयोगिता, तर्क, अनुकूलता और सत्यापन से आँका जाएगा।
4. पुराने नियम को केवल पुराना होने के कारण सही नहीं माना जाएगा; उसी प्रकार उसे केवल पुराना होने के कारण हटाया भी नहीं जाएगा। निर्णय वर्तमान आवश्यकता और उपलब्ध प्रमाण पर आधारित होगा।
5. आवश्यक बदलाव का उद्देश्य सर्वोत्तम उपलब्ध समाधान अपनाना है—न तो हर कीमत पर पुरानी व्यवस्था की रक्षा करना, न ही बिना कारण लगातार बदलाव करना।
6. इस सिद्धांत सहित कोई भी नीति भविष्य में संशोधित, प्रतिस्थापित या निरस्त की जा सकती है; इस धारा को स्वयं कोई शाश्वत अथवा बदलाव से मुक्त नियम नहीं माना जाएगा।
