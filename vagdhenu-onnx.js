/**
 * Swar-Sadhika — Vāgdhenu browser-runtime adapter (source fallback v1.2)
 *
 * File: vagdhenu-onnx.js
 *
 * This file adapts a candidate Vāgdhenu browser-engine module to the API
 * expected by Swar-Sādhika's index.js.
 *
 * IMPORTANT: This adapter does not contain the neural model or prove that the
 * imported upstream implementation performs inference locally. Candidate
 * sources and their transitive runtime/model requests must be audited separately.
 * The adapter refuses cross-origin AUDIO OUTPUT, but that alone does not prove
 * that the upstream module made no remote inference/API requests. Do not claim
 * local/offline inference until the source is reviewed and real synthesis is
 * tested with the network disabled. If no source loads, it fails explicitly
 * instead of returning fake audio.
 */

const VAGDHENU_SOURCE_CANDIDATES = Object.freeze([
  // Vendored upstream checkout installed by scripts/fetch-vagdhenu-engine.sh.
  new URL('./vendor/vagdhenu-upstream/vagdhenu-onnx.js', import.meta.url).href,

  // Network fallbacks remain available until the upstream source has been vendored.
  'https://hemanth.github.io/sanskrit-tts-web/vagdhenu-onnx.js',
  'https://cdn.jsdelivr.net/gh/hemanth/sanskrit-tts-web@main/vagdhenu-onnx.js',
  'https://fastly.jsdelivr.net/gh/hemanth/sanskrit-tts-web@main/vagdhenu-onnx.js',
  'https://gcore.jsdelivr.net/gh/hemanth/sanskrit-tts-web@main/vagdhenu-onnx.js',
  'https://esm.sh/gh/hemanth/sanskrit-tts-web@main/vagdhenu-onnx.js',
  'https://h3manth.com/ai/sanskrit-tts/vagdhenu-onnx.js',
  'https://raw.githubusercontent.com/hemanth/sanskrit-tts-web/main/vagdhenu-onnx.js'
]);

// Public app/index.js contract is "wasm" or "onnx". The upstream
// browser engine labels its ONNX/WebGPU provider "webgpu". Translate only
// at this adapter boundary so the UI never passes an unsupported value to index.js.
const BACKEND_ALIASES = Object.freeze({
  wasm: 'wasm',
  onnx: 'webgpu',
  webgpu: 'webgpu'
});

const VAGDHENU_BACKENDS = new Set(['wasm', 'onnx', 'webgpu']);

function asErrorMessage(error) {
  if (error instanceof Error) return error.message;

  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

function normalizeBackend(value) {
  const requested = String(value || 'wasm').trim().toLowerCase();
  const backend = BACKEND_ALIASES[requested];

  if (!backend || !VAGDHENU_BACKENDS.has(requested)) {
    throw new TypeError(
      `Unsupported Vāgdhenu backend "${requested}". ` +
      'Use the public backend names "wasm" or "onnx".'
    );
  }

  return backend;
}

function isBlob(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isTypedArray(value) {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

/**
 * Reject remote audio URLs: the app must not mistake fetched audio for
 * locally generated audio. This check does NOT prove the upstream engine
 * used local inference; that must be audited independently.
 */
function normalizeAudioUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('The engine returned an empty audio URL.');
  }

  const candidate = value.trim();

  if (/^blob:/i.test(candidate)) return candidate;
  if (/^data:audio\//i.test(candidate)) return candidate;

  let parsed;

  try {
    parsed = new URL(candidate, import.meta.url);
  } catch (error) {
    throw new Error(
      `The engine returned an invalid audio URL: ${asErrorMessage(error)}`
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported audio URL protocol: ${parsed.protocol}`);
  }

  if (
    typeof location === 'undefined' ||
    parsed.origin !== location.origin
  ) {
    throw new Error(
      'Vāgdhenu returned a cross-origin audio URL. Remote audio is refused; ' +
      'the engine must return locally generated Blob/PCM/data audio or a same-origin URL.'
    );
  }

  if (location.protocol === 'https:' && parsed.protocol === 'http:') {
    throw new Error('Refusing insecure HTTP audio on an HTTPS page.');
  }

  return parsed.href;
}

/**
 * Reject explicit upstream failure signals.
 *
 * A void/undefined return is allowed because some APIs initialize
 * successfully without returning a status object. Therefore, this
 * validates explicit failures but cannot certify success by itself.
 */
function assertInitializationSucceeded(result, stage) {
  if (result === false) {
    throw new Error(
      `Vāgdhenu ${stage} returned false; initialization was not successful.`
    );
  }

  if (!result || typeof result !== 'object') return;

  const status = String(result.status || '').trim().toLowerCase();

  const explicitlyFailed =
    result.ok === false ||
    result.success === false ||
    result.initialized === false ||
    ['error', 'failed', 'failure'].includes(status) ||
    (
      result.error !== undefined &&
      result.error !== null &&
      result.error !== false &&
      result.error !== ''
    );

  if (explicitlyFailed) {
    let detail;

    if (result.error instanceof Error) {
      detail = result.error.message;
    } else if (typeof result.error === 'string') {
      detail = result.error;
    } else {
      try {
        detail = JSON.stringify(result);
      } catch {
        detail = 'The upstream engine reported an unprintable failure.';
      }
    }

    throw new Error(
      `Vāgdhenu ${stage} explicitly reported failure: ` +
      `${detail || 'Unknown initialization failure.'}`
    );
  }
}

function pcmToWavBlob(samples, sampleRate = 24000, channels = 1) {
  if (!isTypedArray(samples) && !Array.isArray(samples)) {
    throw new TypeError(
      'The engine returned PCM audio in an unsupported format.'
    );
  }

  const pcm = samples instanceof Float32Array
    ? samples
    : Float32Array.from(samples, sample => Number(sample));

  if (!pcm.length) {
    throw new Error('The engine returned empty PCM audio.');
  }

  const safeRate =
    Number.isFinite(Number(sampleRate)) && Number(sampleRate) > 0
      ? Math.round(Number(sampleRate))
      : 24000;

  const safeChannels =
    Number.isFinite(Number(channels)) && Number(channels) > 0
      ? Math.round(Number(channels))
      : 1;

  const bytesPerSample = 2;
  const dataBytes = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, safeChannels, true);
  view.setUint32(24, safeRate, true);

  view.setUint32(
    28,
    safeRate * safeChannels * bytesPerSample,
    true
  );

  view.setUint16(32, safeChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;

  for (let i = 0; i < pcm.length; i += 1) {
    const value = Math.max(
      -1,
      Math.min(1, Number(pcm[i]) || 0)
    );

    view.setInt16(
      offset,
      value < 0 ? value * 0x8000 : value * 0x7fff,
      true
    );

    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function getEngineConstructor(moduleNamespace) {
  const candidates = [
    moduleNamespace?.VagdhenuWebEngine,
    moduleNamespace?.default?.VagdhenuWebEngine,
    moduleNamespace?.default,
    moduleNamespace?.Engine
  ];

  return candidates.find(
    candidate => typeof candidate === 'function'
  ) || null;
}

/**
 * Compatibility adapter for Swar-Sadhika.
 *
 * Expected public API:
 *   const engine = new VagdhenuWebEngine(null, 'wasm');
 *   await engine.setBackendMode('wasm');
 *   await engine.initOnnxSessions();
 *   const result = await engine.synthesizeInBrowser(
 *     text, options, onProgress
 *   );
 */
export class VagdhenuWebEngine {
  constructor(canvasOrBaseUrl = null, backendMode = 'wasm', config = {}) {
    // index.js may construct this adapter as new Engine(baseUrl, backendMode),
    // while prototype/audit pages may use new Engine(canvas, backendMode).
    // Do not accidentally pass a URL as the upstream canvas argument.
    let canvas = null;
    let baseUrl = config.baseUrl || config.modelId || null;

    if (canvasOrBaseUrl && typeof canvasOrBaseUrl === 'object') {
      if (typeof canvasOrBaseUrl.getContext === 'function') {
        canvas = canvasOrBaseUrl;
      } else {
        config = { ...canvasOrBaseUrl, ...config };

        canvas =
          config.canvas &&
          typeof config.canvas.getContext === 'function'
            ? config.canvas
            : null;

        baseUrl = config.baseUrl || config.modelId || baseUrl;
        backendMode = config.backendMode || config.backend || backendMode;
      }
    } else if (
      typeof canvasOrBaseUrl === 'string' &&
      canvasOrBaseUrl.trim()
    ) {
      baseUrl = canvasOrBaseUrl.trim();
    }

    this.canvas = canvas;
    this.baseUrl = baseUrl;

    this.backendMode = normalizeBackend(
      backendMode || config.backend || 'wasm'
    );

    this.sourceUrls =
      Array.isArray(config.sourceUrls) && config.sourceUrls.length
        ? [...config.sourceUrls]
        : [...VAGDHENU_SOURCE_CANDIDATES];

    this._officialModule = null;
    this._OfficialEngine = null;
    this._engine = null;
    this._moduleSourceUrl = null;
    this._moduleLoadPromise = null;
    this._initPromise = null;
    this._initialized = false;
    this._synthesisOutputValidated = false;
    this._objectUrls = new Set();
    this._lastResult = null;
  }

  getRuntimeInfo() {
    let sourceLoadedLocally = false;

    try {
      sourceLoadedLocally = Boolean(
        this._moduleSourceUrl &&
        typeof location !== 'undefined' &&
        new URL(this._moduleSourceUrl).origin === location.origin
      );
    } catch {
      sourceLoadedLocally = false;
    }

    return {
      engine: 'Vāgdhenu browser engine adapter',
      backend: this.backendMode,
      initialized: this._initialized,
      sourceUrl: this._moduleSourceUrl,
      sourceLoadedLocally,
      // Output-shape validation is not proof that neural inference occurred.
      synthesisOutputValidated: this._synthesisOutputValidated,
      // These remain unverified until upstream requests and real offline
      // inference are independently audited. Never infer them from a Blob URL.
      localInference: 'not-verified',
      cloudInferenceApi: 'not-verified',
      baseUrl: this.baseUrl || null
    };
  }

  async setBackendMode(mode) {
    const nextBackend = normalizeBackend(mode);

    if (
      this._engine &&
      typeof this._engine.setBackendMode === 'function'
    ) {
      const result = await this._engine.setBackendMode(nextBackend);

      assertInitializationSucceeded(result, 'backend selection');
    } else if (this._engine) {
      // If provider switching is unsupported, discard the old instance.
      if (typeof this._engine.dispose === 'function') {
        try {
          await this._engine.dispose();
        } catch {
          // Best-effort cleanup.
        }
      }

      this._engine = null;
    }

    this.backendMode = nextBackend;
    this._initialized = false;
    this._synthesisOutputValidated = false;
    this._initPromise = null;

    return {
      backend: this.backendMode,
      ok: true
    };
  }

  async _loadOfficialModule() {
    if (this._officialModule && this._OfficialEngine) {
      return this._officialModule;
    }

    if (this._moduleLoadPromise) {
      return this._moduleLoadPromise;
    }

    this._moduleLoadPromise = (async () => {
      const failures = [];

      for (const sourceUrl of this.sourceUrls) {
        try {
          const moduleNamespace = await import(
            /* webpackIgnore: true */ sourceUrl
          );

          const EngineConstructor =
            getEngineConstructor(moduleNamespace);

          if (!EngineConstructor) {
            throw new Error(
              'The module loaded but did not export VagdhenuWebEngine.'
            );
          }

          this._officialModule = moduleNamespace;
          this._OfficialEngine = EngineConstructor;
          this._moduleSourceUrl = sourceUrl;

          return moduleNamespace;
        } catch (error) {
          failures.push(
            `${sourceUrl}: ${asErrorMessage(error)}`
          );
        }
      }

      const details = failures
        .map((failure, index) => `${index + 1}. ${failure}`)
        .join('\n');

      throw new Error(
        'Vāgdhenu का browser engine किसी उपलब्ध स्रोत से लोड नहीं हुआ। ' +
        'यह नेटवर्क, CORS या स्रोत-उपलब्धता की विफलता हो सकती है; ' +
        'इस स्थिति में मॉडल inference नहीं चला।\n' +
        details
      );
    })();

    try {
      return await this._moduleLoadPromise;
    } finally {
      this._moduleLoadPromise = null;
    }
  }

  async _ensureEngine() {
    if (this._engine) {
      return this._engine;
    }

    await this._loadOfficialModule();

    if (!this._OfficialEngine) {
      throw new Error(
        'Vāgdhenu engine constructor was not found.'
      );
    }

    const engine = new this._OfficialEngine(
      this.canvas,
      this.backendMode,
      this.baseUrl
        ? {
            baseUrl: this.baseUrl,
            modelId: this.baseUrl
          }
        : undefined
    );

    if (!engine || typeof engine !== 'object') {
      throw new Error(
        'Vāgdhenu engine construction returned an invalid instance.'
      );
    }

    if (typeof engine.setBackendMode === 'function') {
      const backendResult =
        await engine.setBackendMode(this.backendMode);

      assertInitializationSucceeded(
        backendResult,
        'backend selection'
      );
    }

    if (typeof engine.initOnnxSessions !== 'function') {
      throw new Error(
        'The loaded Vāgdhenu source does not expose initOnnxSessions().'
      );
    }

    if (typeof engine.synthesizeInBrowser !== 'function') {
      throw new Error(
        'The loaded Vāgdhenu source does not expose synthesizeInBrowser().'
      );
    }

    // Cache only a constructed instance with the required API.
    this._engine = engine;

    return engine;
  }

  async initOnnxSessions(progressCallback) {
    if (this._initialized) {
      return {
        ok: true,
        initialized: true,
        backend: this.backendMode,
        cached: true
      };
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      const engine = await this._ensureEngine();

      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            stage: 'session-init',
            progress: 0,
            backend: this.backendMode
          });
        } catch {
          // Do not stop engine initialization because a callback failed.
        }
      }

      const result = await engine.initOnnxSessions();

      // Explicit upstream failure must never be changed into success.
      assertInitializationSucceeded(
        result,
        'session initialization'
      );

      this._initialized = true;
      this._synthesisOutputValidated = false;

      if (typeof progressCallback === 'function') {
        try {
          progressCallback({
            stage: 'session-init',
            progress: 1,
            backend: this.backendMode
          });
        } catch {
          // Do not stop the engine because a callback failed.
        }
      }

      return {
        ok: true,
        initialized: true,
        backend: this.backendMode,
        sourceUrl: this._moduleSourceUrl,
        upstreamResult: result ?? null
      };
    })();

    try {
      return await this._initPromise;
    } catch (error) {
      this._initialized = false;
      this._synthesisOutputValidated = false;

      if (
        this._engine &&
        typeof this._engine.dispose === 'function'
      ) {
        try {
          await this._engine.dispose();
        } catch {
          // Best-effort cleanup after initialization failure.
        }
      }

      this._engine = null;

      throw error;
    } finally {
      this._initPromise = null;
    }
  }

  async synthesizeInBrowser(
    text,
    options = {},
    progressCallback
  ) {
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError(
        'संस्कृत पाठ खाली है; ऑडियो बनाने के लिए पाठ दें।'
      );
    }

    if (!options || typeof options !== 'object') {
      options = {};
    }

    if (!this._initialized) {
      await this.initOnnxSessions();
    }

    const engine = await this._ensureEngine();

    if (typeof engine.synthesizeInBrowser !== 'function') {
      throw new Error(
        'Vāgdhenu synthesis method is unavailable.'
      );
    }

    const synthesisOptions = {
      meter: options.meter || 'auto',
      speed: Number.isFinite(Number(options.speed))
        ? Number(options.speed)
        : 0.9,
      noSandhi: options.noSandhi === true,
      ...options
    };

    const callerChunk =
      typeof synthesisOptions.onChunk === 'function'
        ? synthesisOptions.onChunk
        : null;

    synthesisOptions.onChunk = chunk => {
      if (callerChunk) {
        try {
          callerChunk(chunk);
        } catch (error) {
          console.warn(
            'Vāgdhenu onChunk callback failed:',
            error
          );
        }
      }
    };

    const reportProgress = value => {
      if (typeof progressCallback !== 'function') {
        return;
      }

      try {
        progressCallback(value);
      } catch (error) {
        console.warn(
          'Vāgdhenu progress callback failed:',
          error
        );
      }
    };

    reportProgress({
      stage: 'inference',
      progress: 0,
      backend: this.backendMode
    });

    const rawResult = await engine.synthesizeInBrowser(
      text,
      synthesisOptions,
      reportProgress
    );

    const normalized = await this._normalizeAudioResult(
      rawResult
    );

    // This records recognized output only. It does not prove neural inference,
    // source provenance, singing quality, or offline completeness.
    this._lastResult = normalized;
    this._synthesisOutputValidated = true;

    reportProgress({
      stage: 'complete',
      progress: 1,
      backend: this.backendMode,
      audioUrl: normalized.audioUrl
    });

    return normalized;
  }

  async _normalizeAudioResult(result) {
    if (typeof result === 'string') {
      if (
        /^(blob:|data:audio\/|https?:\/\/)/i.test(result.trim())
      ) {
        const audioUrl = normalizeAudioUrl(result);

        return {
          url: audioUrl,
          audioUrl,
          metadata: {},
          rawResult: result
        };
      }

      throw new Error(
        'Vāgdhenu ने पहचाना जाने वाला audio URL नहीं लौटाया।'
      );
    }

    if (isBlob(result)) {
      if (result.size <= 0) {
        throw new Error('Vāgdhenu returned an empty audio Blob.');
      }

      const url = URL.createObjectURL(result);
      this._objectUrls.add(url);

      return {
        url,
        audioUrl: url,
        blob: result,
        metadata: {
          mimeType: result.type || 'audio/wav'
        },
        rawResult: result
      };
    }

    if (
      result instanceof ArrayBuffer ||
      isTypedArray(result)
    ) {
      throw new Error(
        'Vāgdhenu returned raw bytes without an audio container/format. ' +
        'Refusing to label arbitrary bytes as WAV.'
      );
    }

    if (!result || typeof result !== 'object') {
      throw new Error(
        'Vāgdhenu ने ऑडियो परिणाम नहीं लौटाया।'
      );
    }

    const urlCandidate =
      result.audioUrl ||
      result.url ||
      result.wavUrl ||
      result.outputUrl ||
      result.audioSrc ||
      result.src;

    const blobCandidate =
      result.blob ||
      result.audioBlob ||
      result.wavBlob ||
      result.audioWav ||
      (isBlob(result.wav) ? result.wav : null);

    if (
      typeof urlCandidate === 'string' &&
      urlCandidate.trim()
    ) {
      const audioUrl = normalizeAudioUrl(urlCandidate);

      return {
        ...result,
        url: result.url
          ? normalizeAudioUrl(result.url)
          : audioUrl,
        audioUrl: result.audioUrl
          ? normalizeAudioUrl(result.audioUrl)
          : audioUrl,
        metadata: result.metadata || {}
      };
    }

    if (isBlob(blobCandidate)) {
      if (blobCandidate.size <= 0) {
        throw new Error('Vāgdhenu returned an empty audio Blob.');
      }

      const url = URL.createObjectURL(blobCandidate);
      this._objectUrls.add(url);

      return {
        ...result,
        url,
        audioUrl: url,
        blob: blobCandidate,
        metadata: result.metadata || {}
      };
    }

    const audioBuffer =
      result.audioBuffer || result.buffer;

    if (
      audioBuffer &&
      typeof audioBuffer.getChannelData === 'function'
    ) {
      const channelCount = Math.max(
        1,
        Number(audioBuffer.numberOfChannels) || 1
      );

      const length = Number(audioBuffer.length) || 0;

      const interleaved = new Float32Array(
        length * channelCount
      );

      const channels = Array.from(
        { length: channelCount },
        (_, channel) => audioBuffer.getChannelData(channel)
      );

      for (let frame = 0; frame < length; frame += 1) {
        for (
          let channel = 0;
          channel < channelCount;
          channel += 1
        ) {
          interleaved[frame * channelCount + channel] =
            channels[channel][frame] || 0;
        }
      }

      const blob = pcmToWavBlob(
        interleaved,
        audioBuffer.sampleRate || 24000,
        channelCount
      );

      const url = URL.createObjectURL(blob);
      this._objectUrls.add(url);

      return {
        ...result,
        url,
        audioUrl: url,
        blob,
        metadata: {
          ...(result.metadata || {}),
          sampleRate: audioBuffer.sampleRate,
          channels: channelCount
        }
      };
    }

    const pcm =
      result.pcm ||
      result.samples ||
      result.audioData ||
      result.waveform;

    if (isTypedArray(pcm) || Array.isArray(pcm)) {
      const sampleFormat = String(
        result.format ||
        result.audioFormat ||
        'float32'
      ).toLowerCase();

      if (
        !['float32', 'f32', 'pcm-f32', 'float'].includes(sampleFormat) &&
        !(pcm instanceof Float32Array)
      ) {
        throw new Error(
          `Unsupported PCM sample format: ${sampleFormat}`
        );
      }

      const blob = pcmToWavBlob(
        pcm,
        result.sampleRate || result.sr || 24000,
        result.channels || 1
      );

      const url = URL.createObjectURL(blob);
      this._objectUrls.add(url);

      return {
        ...result,
        url,
        audioUrl: url,
        blob,
        metadata: result.metadata || {}
      };
    }

    throw new Error(
      'Vāgdhenu का synthesis call पूरा हुआ, लेकिन परिणाम में ' +
      'पहचाना जाने वाला ऑडियो URL/Blob/PCM नहीं मिला। ' +
      `वापस मिली properties: ${
        Object.keys(result).join(', ') || '(none)'
      }`
    );
  }

  async dispose() {
    if (
      this._engine &&
      typeof this._engine.dispose === 'function'
    ) {
      try {
        await this._engine.dispose();
      } catch (error) {
        console.warn(
          'Vāgdhenu dispose failed:',
          error
        );
      }
    }

    for (const objectUrl of this._objectUrls) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore cleanup errors.
      }
    }

    this._objectUrls.clear();
    this._engine = null;
    this._initialized = false;
    this._synthesisOutputValidated = false;
    this._initPromise = null;
    this._lastResult = null;
  }
}

export default VagdhenuWebEngine;
