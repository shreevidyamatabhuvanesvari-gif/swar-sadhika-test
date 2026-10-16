# Swar-Sadhika test

Testing-only copy of Swar-Sadhika. Do not copy these changes to the separate `anujadha` main app without an independent review.

## Local pronunciation reference panel

The AI परीक्षण panel now includes a local pronunciation-reference workflow:

1. The user explicitly selects an audio or video file from the device.
2. The user enters/validates the corresponding Sanskrit text.
3. Audio files are decoded locally (up to 180 seconds); rough RMS, quiet-frame ratio, peak amplitude and sampled autocorrelation pitch estimate are calculated. Pitch estimation samples only the first 20 seconds.
4. Video files are sampled locally for up to 20 seconds for RMS/quiet-frame descriptors only.
5. Text and derived descriptors (not the original media file) are stored in IndexedDB. Records can be listed, individually deleted, all deleted, or exported as JSON.

This is **local analysis and reference memory, not AI training**. The collected records are not yet consumed by `VagdhenuWebEngine`, so no improvement in generated singing is claimed. Audio decoding depends on the browser's supported codecs. Storage remains subject to browser quota/eviction.

## Run

Serve the folder over HTTPS or localhost (native ES modules and IndexedDB need a suitable origin), for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Current engine caveat

`vagdhenu-onnx.js` attempts to import the upstream engine from external static URLs. This repository does not vendor all upstream engine code/model weights/runtime assets. Therefore, offline-first model inference has **not** been established. The AI panel must not be considered passing until real inference and audio playback are tested.
