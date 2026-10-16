Swar-Sadhika — Pronunciation Learning Audit

1. Audit purpose

This document defines the implementation scope, known limitations, and evidence required to evaluate the local pronunciation-reference feature in the Swar-Sadhika test repository.

Repository: "shreevidyamatabhuvanesvari-gif/swar-sadhika-test"

GitHub Pages: "https://shreevidyamatabhuvanesvari-gif.github.io/swar-sadhika-test/"

Protected application: "anujadha" — must not be modified.

Current verification status: PARTIALLY DOCUMENTED; live deployment and Android behavior NOT VERIFIED.

This audit describes the behavior documented in the inspected project archive. It does not independently prove that the same code is present in the current GitHub commit or deployed website. Confirm the current source before treating any implementation detail as verified.

2. Feature objective

The local pronunciation-reference feature is intended to let users select their own reference media, associate it with Sanskrit text, inspect limited acoustic measurements, and store the resulting reference record locally.

Its intended purpose is to support later analysis and development of Sanskrit vocal-generation workflows.

The feature must not be represented as an automatic Sanskrit pronunciation evaluator, a neural learning system, or a mechanism that improves generated singing unless those capabilities are implemented and independently tested.

3. Documented workflow

The inspected archive documents the following workflow:

1. The user explicitly selects an audio or video file.
2. The user supplies or verifies the corresponding Sanskrit text.
3. The application attempts to analyse the selected media locally, subject to browser support.
4. The application can store the text and derived measurements in IndexedDB.
5. Saved records can be listed, deleted individually, cleared with confirmation, or exported as JSON where the controls are implemented.

The module is documented as not automatically scanning the device gallery and not persisting the original media file in its reference-record storage.

These details must be checked against the currently committed "pronunciation-learning.js" and its integration in "app.js".

4. Audio analysis

The inspected documentation describes these audio measurements:

- Duration.
- Sample rate.
- Channel count.
- Peak amplitude.
- Mean root-mean-square (RMS) amplitude.
- Quiet-frame ratio.
- A rough pitch estimate based on sampled autocorrelation.

The documented implementation limits some pitch analysis to sampled frames from the first 20 seconds. Basic signal measurements are described as supporting up to 180 seconds of audio.

These are approximate acoustic descriptors, not a validated assessment of Sanskrit pronunciation.

Limitations

- RMS and peak amplitude describe signal level, not linguistic correctness.
- Quiet-frame ratio depends on the chosen thresholds and recording conditions.
- Autocorrelation can return misleading pitch estimates for noisy, polyphonic, breathy, or otherwise complex audio.
- A pitch estimate does not establish that a note was sung correctly.
- No validated reference-pitch comparison is established by these measurements.
- No Sanskrit phoneme alignment, word-level error detection, or Vedic accent validation is established by these measurements.

Do not describe these measurements as a pronunciation score or singing-quality score without a defined and validated evaluation method.

5. Video analysis

The inspected documentation describes a limited video path that samples audio-related measurements through media playback and a Web Audio analyser.

The documented sampling window is up to 20 seconds. The video path is not documented as performing pitch analysis or phoneme analysis.

Video sampling must not be described as recognizing Sanskrit words, detecting pronunciation errors, or identifying Vedic accents unless separate functionality is implemented and tested.

Video decoding and audio access may vary across Android browsers, codecs, file types, and security contexts.

6. Storage and privacy boundaries

The feature is documented as storing Sanskrit text and derived measurements in IndexedDB.

The module is documented as not storing the original selected media in its reference-record database. Verify this claim against the actual implementation before relying on it.

IndexedDB is browser-managed storage. Data can be lost through site-data clearing, private-browsing restrictions, quota limits, storage eviction, or other browser behavior. Permanent retention is not guaranteed.

The application should:

- Explain what information is saved.
- Make record deletion available and verify that deletion works.
- Require clear confirmation before a destructive clear-all action.
- Avoid claiming that exported JSON contains original media when it contains only reference records and descriptors.
- Avoid exposing private user recordings or personal text in public logs, test reports, or repository commits.

A JSON export must be inspected to verify its actual fields and ensure that it does not unintentionally contain original media, credentials, or other sensitive information.

7. Learning versus storage

The following capabilities must be distinguished.

A. Local reference storage

Text and derived acoustic descriptors are stored for later inspection.

This is a reference notebook, not model training.

B. Pronunciation evaluation

The application compares an input against a defined linguistic or acoustic reference and produces a validated assessment.

This capability is NOT VERIFIED.

C. Model conditioning or adaptation

The singing engine consumes reference audio, aligned features, or other supported conditioning data to influence its generated output.

An implemented, supported conditioning path has NOT BEEN ESTABLISHED by the inspected archive.

D. Neural training or fine-tuning

Model parameters are updated through an actual training or fine-tuning process.

This capability is NOT ESTABLISHED by the documented reference-storage workflow.

E. Demonstrated improvement

Generated output is evaluated before and after a defined learning or conditioning procedure using reproducible examples and a suitable evaluation method.

This capability is NOT VERIFIED.

Do not claim that saved recordings teach the engine, modify model weights, improve pronunciation, or improve singing unless the complete data path and resulting effect are demonstrated.

8. Integration requirements

Before connecting stored references to the singing engine:

1. Inspect the actual engine adapter and supported synthesis contract.
2. Identify whether the selected model supports reference-audio input, conditioning, alignment, or adaptation.
3. Verify the exact input format, sampling rate, channel layout, duration limits, and preprocessing requirements.
4. Determine whether processing occurs locally or requires external resources.
5. Define how user-selected references are associated with a generation request.
6. Establish error handling for incompatible, incomplete, or unsupported references.
7. Test the feature using known examples and preserve the results.
8. Compare output with and without conditioning using the same text and test conditions.
9. Avoid training or updating model weights unless a real, supported training mechanism exists.

Do not invent an API, claim an unsupported model capability, or pass stored descriptors to an engine that does not consume them.

9. Browser and Android requirements

Test the actual GitHub Pages HTTPS deployment on the intended Android device and browser.

Record:

- Device and Android version.
- Browser name and version.
- Selected media type, format, and duration.
- Whether the file decoded successfully.
- Whether analysis completed or returned a clear error.
- Whether saved records survived page reload.
- Whether individual deletion and clear-all worked.
- Whether JSON export produced valid, expected content.
- Relevant console and network errors.

Localhost testing and a successful JavaScript syntax check are not substitutes for testing the deployed HTTPS origin.

Browser codec support, media decoding, Web Audio API behavior, IndexedDB availability, storage quota, and download behavior can vary.

10. Required acceptance tests

Do not mark a test PASS without observable evidence.

Test| Acceptance evidence| Status
Module loading| Current committed module loads without an error| NOT VERIFIED
Explicit file selection| User-selected media is handled as intended| NOT VERIFIED
Audio decoding| Supported audio file decodes successfully| NOT VERIFIED
Audio descriptors| Output values are produced and checked for valid ranges| NOT VERIFIED
Video sampling| Supported video is sampled within the documented limit| NOT VERIFIED
Unsupported media| Clear error is shown without fabricated success| NOT VERIFIED
IndexedDB save| Record is stored and can be retrieved| NOT VERIFIED
Reload persistence| Record remains after a page reload under normal storage conditions| NOT VERIFIED
Individual deletion| Selected record is actually deleted| NOT VERIFIED
Clear-all| Confirmation and actual deletion both work| NOT VERIFIED
JSON export| Exported JSON parses and contains only expected fields| NOT VERIFIED
Android deployment| Feature tested on the intended Android browser| NOT VERIFIED
Engine integration| Stored references are consumed through a supported interface| NOT VERIFIED
Demonstrated improvement| Reproducible before-and-after evaluation supports the claim| NOT VERIFIED

11. Evidence and change control

For each completed test, record the exact Git commit SHA, test date, browser/device, input file characteristics, observed output, and relevant errors.

Keep the distinction between:

- Documented implementation.
- Source-code inspection.
- Local test results.
- GitHub Pages deployment results.
- Android device results.
- End-to-end engine integration results.

A result from one category must not be presented as proof of another.

Make changes only in "swar-sadhika-test". Review the target file and its dependencies before editing. Preserve unrelated working behavior and do not modify "anujadha".

12. Final assessment

The documented feature is best treated as a local pronunciation-reference and acoustic-descriptor workflow until stronger evidence establishes additional capabilities.

The inspected documentation does not establish neural training, validated Sanskrit pronunciation scoring, engine conditioning, improved generated singing, or reliable offline synthesis.

Audit decision: PARTIALLY DOCUMENTED; live behavior and learning claims NOT VERIFIED.

The goal is to build a genuinely useful Sanskrit vocal-generation application. Progress must be demonstrated through reproducible tests, actual generated audio, and honest reporting of limitations.
