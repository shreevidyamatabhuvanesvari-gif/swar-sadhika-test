/**
 * Swar-Sadhika — browser-side Sanskrit chant engine facade
 *
 * Path: swar-sadhika-test/index.js
 * Module format: native JavaScript ES module (type="module").
 *
 * IMPORTANT:
 * This file is an adapter/API layer, not an AI model by itself. Actual local
 * inference requires compatible, real implementations of:
 *   - ./vagdhenu-onnx.js
 *   - ./vagdhenu-text.js
 * and the model artifacts/runtime those modules expect.
 *
 * There is no cloud TTS or API-key fallback. If a dependency is absent, the
 * operation fails explicitly instead of pretending to generate audio.
 */

const MODULE_DIRECTORY_URL = new URL('./', import.meta.url);
const ENGINE_MODULE_FILE = 'vagdhenu-onnx.js';
const TEXT_MODULE_FILE = 'vagdhenu-text.js';
const VALID_BACKENDS = new Set(['wasm', 'onnx']);

const DEFAULT_OPTIONS = Object.freeze({
  backend: 'wasm',
  meter: 'auto',
  nfe: null,
  cfg: 3.0,
  speed: 0.9,
  seed: 60,
  noSandhi: false,
  lazy: false,
  baseUrl: null,
  onProgress: null
});

let cachedRuntimeModules = null;
let cachedRuntimePromise = null;

/**
 * Error with a stable machine-readable code for the UI and automated tests.
 */
export class SwarSadhikaEngineError extends Error {
  constructor(message, code = 'ENGINE_ERROR', options = {}) {
    super(String(message), options);
    this.name = 'SwarSadhikaEngineError';
    this.code = code;

    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

function assertObject(value, name) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new SwarSadhikaEngineError(
      `${name} must be an object.`,
      'INVALID_ARGUMENT'
    );
  }
}

function normalizeBackend(value) {
  const backend = value == null
    ? 'wasm'
    : String(value).trim().toLowerCase();

  if (!VALID_BACKENDS.has(backend)) {
    throw new SwarSadhikaEngineError(
      `Unsupported backend "${backend}". Use "wasm" or "onnx".`,
      'INVALID_BACKEND'
    );
  }

  return backend;
}

function normalizeText(text) {
  if (Array.isArray(text)) {
    const parts = text.map((part) => {
      if (typeof part !== 'string') {
        throw new SwarSadhikaEngineError(
          'Every verse/pāda in an input array must be a string.',
          'INVALID_TEXT'
        );
      }

      return part.trim();
    }).filter(Boolean);

    if (!parts.length) {
      throw new SwarSadhikaEngineError(
        'Please enter a non-empty Sanskrit text.',
        'EMPTY_TEXT'
      );
    }

    return parts;
  }

  if (typeof text !== 'string') {
    throw new SwarSadhikaEngineError(
      'Input text must be a string or an array of strings.',
      'INVALID_TEXT'
    );
  }

  /*
   * Keep Devanagari, Vedic accent marks, virāma, nukta, and conjuncts intact.
   * Only normalize line endings and reject a truly empty input.
   */
  const normalized = text.replace(/\r\n?/g, '\n').trim();

  if (!normalized) {
    throw new SwarSadhikaEngineError(
      'Please enter a non-empty Sanskrit text.',
      'EMPTY_TEXT'
    );
  }

  return normalized;
}

/**
 * The public facade accepts arrays of verses/pādas, while the current
 * Vāgdhenu adapter/upstream API accepts a single string. Join array parts
 * with a line break only at the engine boundary; no punctuation is added.
 */
function toEngineInputText(text) {
  return Array.isArray(text) ? text.join('\n') : text;
}

function normalizeSynthesisOptions(options = {}) {
  assertObject(options, 'Synthesis options');

  const merged = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  merged.backend = normalizeBackend(merged.backend);

  if (merged.nfe !== null && merged.nfe !== undefined) {
    const nfe = Number(merged.nfe);

    if (!Number.isInteger(nfe) || nfe < 1 || nfe > 128) {
      throw new SwarSadhikaEngineError(
        'nfe must be an integer from 1 through 128.',
        'INVALID_OPTION'
      );
    }

    merged.nfe = nfe;
  } else {
    merged.nfe = null;
  }

  merged.cfg = Number(merged.cfg);

  if (
    !Number.isFinite(merged.cfg) ||
    merged.cfg < 0 ||
    merged.cfg > 20
  ) {
    throw new SwarSadhikaEngineError(
      'cfg must be between 0 and 20.',
      'INVALID_OPTION'
    );
  }

  merged.speed = Number(merged.speed);

  if (
    !Number.isFinite(merged.speed) ||
    merged.speed < 0.3 ||
    merged.speed > 2
  ) {
    throw new SwarSadhikaEngineError(
      'speed must be between 0.3 and 2.',
      'INVALID_OPTION'
    );
  }

  merged.seed = Number(merged.seed);

  if (
    !Number.isInteger(merged.seed) ||
    merged.seed < 0 ||
    merged.seed > 0x7fffffff
  ) {
    throw new SwarSadhikaEngineError(
      'seed must be a non-negative 32-bit integer.',
      'INVALID_OPTION'
    );
  }

  merged.noSandhi = Boolean(merged.noSandhi);
  merged.lazy = Boolean(merged.lazy);

  if (
    merged.baseUrl !== null &&
    merged.baseUrl !== undefined &&
    typeof merged.baseUrl !== 'string'
  ) {
    throw new SwarSadhikaEngineError(
      'baseUrl must be a string or null.',
      'INVALID_OPTION'
    );
  }

  for (const callbackName of ['onProgress', 'onChunk']) {
    if (
      merged[callbackName] != null &&
      typeof merged[callbackName] !== 'function'
    ) {
      throw new SwarSadhikaEngineError(
        `${callbackName} must be a function when provided.`,
        'INVALID_OPTION'
      );
    }
  }

  return merged;
}

function invokeSafely(callback, payload) {
  if (typeof callback !== 'function') return;

  try {
    callback(payload);
  } catch (error) {
    /*
     * A UI listener error must not convert successful model inference
     * into failure.
     */
    if (
      typeof console !== 'undefined' &&
      typeof console.error === 'function'
    ) {
      console.error(
        '[Swar-Sadhika] Progress/event callback failed:',
        error
      );
    }
  }
}

async function inspectLocalModule(fileName) {
  const url = new URL(fileName, MODULE_DIRECTORY_URL);
  let response;

  try {
    response = await fetch(url.href, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin'
    });

    /*
     * A few static hosts do not implement HEAD.
     * Fall back to GET in that case.
     */
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url.href, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (
        response.body &&
        typeof response.body.cancel === 'function'
      ) {
        await response.body.cancel().catch(() => {});
      }
    }
  } catch (error) {
    throw new SwarSadhikaEngineError(
      `Could not check required local file ${fileName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'DEPENDENCY_CHECK_FAILED',
      {
        cause: error,
        details: {
          file: fileName,
          url: url.href
        }
      }
    );
  }

  const contentType = (
    response.headers.get('content-type') || ''
  ).toLowerCase();

  if (!response.ok) {
    throw new SwarSadhikaEngineError(
      `Required file ${fileName} is not available (HTTP ${response.status}). Expected URL: ${url.href}`,
      'MISSING_DEPENDENCY',
      {
        details: {
          file: fileName,
          url: url.href,
          httpStatus: response.status
        }
      }
    );
  }

  if (contentType.includes('text/html')) {
    throw new SwarSadhikaEngineError(
      `${fileName} returned HTML instead of a JavaScript module. Check the GitHub Pages path/deployment. URL: ${url.href}`,
      'INVALID_DEPENDENCY_CONTENT',
      {
        details: {
          file: fileName,
          url: url.href,
          contentType
        }
      }
    );
  }

  return Object.freeze({
    file: fileName,
    url: url.href,
    status: response.status,
    contentType
  });
}

/**
 * Checks required first-party module URLs without loading model weights.
 * It does not claim that the model can run; that requires a separate inference.
 */
export async function checkLocalDependencies() {
  const results = [];
  const failures = [];

  for (const fileName of [
    ENGINE_MODULE_FILE,
    TEXT_MODULE_FILE
  ]) {
    try {
      results.push(await inspectLocalModule(fileName));
    } catch (error) {
      failures.push({
        file: fileName,
        error
      });
    }
  }

  return Object.freeze({
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    files: results,

    failures: failures.map(({ file, error }) => ({
      file,
      code: error instanceof SwarSadhikaEngineError
        ? error.code
        : 'UNKNOWN',
      message: error instanceof Error
        ? error.message
        : String(error)
    }))
  });
}

async function loadRuntimeModules({ retry = false } = {}) {
  if (cachedRuntimeModules && !retry) {
    return cachedRuntimeModules;
  }

  if (cachedRuntimePromise && !retry) {
    return cachedRuntimePromise;
  }

  cachedRuntimePromise = (async () => {
    const dependencyReport = await checkLocalDependencies();

    if (!dependencyReport.ok) {
      const detail = dependencyReport.failures
        .map((item) => item.message)
        .join('\n');

      throw new SwarSadhikaEngineError(
        `Required local engine files are missing or invalid. No fallback TTS was used.\n${detail}`,
        'DEPENDENCIES_UNAVAILABLE',
        {
          details: dependencyReport
        }
      );
    }

    let engineModule;
    let textModule;

    try {
      const engineUrl = new URL(
        ENGINE_MODULE_FILE,
        MODULE_DIRECTORY_URL
      ).href;

      const textUrl = new URL(
        TEXT_MODULE_FILE,
        MODULE_DIRECTORY_URL
      ).href;

      [engineModule, textModule] = await Promise.all([
        import(engineUrl),
        import(textUrl)
      ]);
    } catch (error) {
      throw new SwarSadhikaEngineError(
        `Local JavaScript module import failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'MODULE_IMPORT_FAILED',
        {
          cause: error,
          details: dependencyReport
        }
      );
    }

    if (
      typeof engineModule.VagdhenuWebEngine !== 'function'
    ) {
      throw new SwarSadhikaEngineError(
        `${ENGINE_MODULE_FILE} must export a VagdhenuWebEngine class/function.`,
        'ENGINE_EXPORT_MISSING'
      );
    }

    /*
     * Text helpers are needed for meter/scansion analysis.
     * Do not silently invent them.
     */
    if (typeof textModule.analyzeVerse !== 'function') {
      throw new SwarSadhikaEngineError(
        `${TEXT_MODULE_FILE} must export analyzeVerse().`,
        'TEXT_API_MISMATCH'
      );
    }

    cachedRuntimeModules = Object.freeze({
      engineModule,
      textModule,
      dependencyReport
    });

    return cachedRuntimeModules;
  })();

  try {
    return await cachedRuntimePromise;
  } catch (error) {
    cachedRuntimePromise = null;

    if (retry) {
      cachedRuntimeModules = null;
    }

    throw error;
  }
}

async function validateWavContainer(value) {
  let size;
  let headerBuffer;

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    size = value.size;
    headerBuffer = await value.slice(0, 12).arrayBuffer();
  } else if (value instanceof ArrayBuffer) {
    size = value.byteLength;
    headerBuffer = value.slice(0, 12);
  } else if (ArrayBuffer.isView(value)) {
    size = value.byteLength;
    headerBuffer = value.buffer.slice(
      value.byteOffset,
      value.byteOffset + Math.min(value.byteLength, 12)
    );
  } else {
    throw new SwarSadhikaEngineError(
      'The engine result contains an unsupported WAV representation.',
      'INVALID_WAV_RESULT'
    );
  }

  if (size < 44 || headerBuffer.byteLength < 12) {
    throw new SwarSadhikaEngineError(
      `The engine returned an audio buffer too small to be a WAV file (${size} bytes).`,
      'INVALID_WAV_RESULT'
    );
  }

  const header = new Uint8Array(headerBuffer, 0, 12);
  const riff = String.fromCharCode(...header.slice(0, 4));
  const wave = String.fromCharCode(...header.slice(8, 12));

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new SwarSadhikaEngineError(
      'The engine returned raw samples or non-WAV bytes instead of a WAV file; no fake WAV wrapper was created.',
      'INVALID_WAV_RESULT'
    );
  }
}

async function createResultUrl(result) {
  if (
    result &&
    typeof result.url === 'string' &&
    result.url.trim()
  ) {
    // The lower-level adapter returns { url, blob, audioUrl }. Inspect the
    // attached WAV bytes before trusting its already-created playback URL;
    // otherwise an arbitrary Blob could bypass this facade's WAV validation.
    const wavPayload = result.blob || result.audioBlob || result.wavBlob || result.wav;

    if (
      (typeof Blob !== 'undefined' && wavPayload instanceof Blob) ||
      wavPayload instanceof ArrayBuffer ||
      ArrayBuffer.isView(wavPayload)
    ) {
      await validateWavContainer(wavPayload);
    }

    return {
      url: result.url,
      owned: false
    };
  }

  const wav = result && result.wav;

  if (typeof Blob !== 'undefined' && wav instanceof Blob) {
    await validateWavContainer(wav);

    return {
      url: URL.createObjectURL(wav),
      owned: true
    };
  }

  if (wav instanceof ArrayBuffer || ArrayBuffer.isView(wav)) {
    await validateWavContainer(wav);

    const bytes = wav instanceof ArrayBuffer
      ? wav
      : wav.buffer.slice(
          wav.byteOffset,
          wav.byteOffset + wav.byteLength
        );

    const blob = new Blob([bytes], {
      type: 'audio/wav'
    });

    return {
      url: URL.createObjectURL(blob),
      owned: true
    };
  }

  throw new SwarSadhikaEngineError(
    'The engine returned neither a playback URL nor WAV audio data.',
    'AUDIO_RESULT_MISSING'
  );
}

function ensureSafePlaybackUrl(url) {
  let parsed;

  try {
    parsed = new URL(url, MODULE_DIRECTORY_URL);
  } catch (error) {
    throw new SwarSadhikaEngineError(
      'The engine returned an invalid audio URL.',
      'INVALID_AUDIO_URL',
      { cause: error }
    );
  }

  const validScheme = [
    'blob:',
    'data:',
    'https:',
    'http:'
  ].includes(parsed.protocol);

  if (!validScheme) {
    throw new SwarSadhikaEngineError(
      `Unsupported audio URL scheme: ${parsed.protocol}`,
      'INVALID_AUDIO_URL'
    );
  }

  if (
    parsed.protocol === 'http:' ||
    parsed.protocol === 'https:'
  ) {
    if (
      typeof location !== 'undefined' &&
      parsed.origin !== location.origin
    ) {
      throw new SwarSadhikaEngineError(
        'Remote audio URLs are refused. The engine must return locally generated audio (blob/data or same-origin URL).',
        'REMOTE_AUDIO_URL_REFUSED'
      );
    }

    if (
      typeof location !== 'undefined' &&
      location.protocol === 'https:' &&
      parsed.protocol === 'http:'
    ) {
      throw new SwarSadhikaEngineError(
        'Refusing insecure HTTP audio on an HTTPS page.',
        'INSECURE_AUDIO_URL'
      );
    }
  }

  return parsed.href;
}

/**
 * Lazy adapter that preserves the VagdhenuWebEngine interface expected by
 * the current prototype HTML, while converting absent modules into
 * understandable errors.
 *
 * It cannot replace either underlying model/runtime dependency.
 */
export class VagdhenuWebEngine {
  constructor(baseUrl = null, backendMode = 'wasm') {
    this.customBaseUrl = baseUrl;
    this.backendMode = normalizeBackend(backendMode);
    this.provider = 'not-initialized';
    this.isWarmedUp = false;
    this._impl = null;
    this._initPromise = null;
    this._disposed = false;
    this._listeners = new Map();
    this.lastDependencyReport = null;
  }

  get engine() {
    return this._impl;
  }

  _assertNotDisposed() {
    if (this._disposed) {
      throw new SwarSadhikaEngineError(
        'This engine instance has been disposed.',
        'ENGINE_DISPOSED'
      );
    }
  }

  on(eventName, callback) {
    if (
      typeof eventName !== 'string' ||
      typeof callback !== 'function'
    ) {
      throw new SwarSadhikaEngineError(
        'on(eventName, callback) requires a string and a function.',
        'INVALID_ARGUMENT'
      );
    }

    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }

    this._listeners.get(eventName).add(callback);
    return this;
  }

  off(eventName, callback) {
    this._listeners.get(eventName)?.delete(callback);
    return this;
  }

  _emit(eventName, payload) {
    const callbacks = this._listeners.get(eventName);
    if (!callbacks) return;

    for (const callback of callbacks) {
      invokeSafely(callback, payload);
    }
  }

  async _loadImplementation() {
    this._assertNotDisposed();

    if (this._impl) {
      return this._impl;
    }

    if (
      this.customBaseUrl !== null &&
      this.customBaseUrl !== undefined &&
      String(this.customBaseUrl).trim() !== ''
    ) {
      throw new SwarSadhikaEngineError(
        'A custom baseUrl is not supported by the current browser adapter. Leave baseUrl null; passing it as the adapter canvas would be incorrect.',
        'UNSUPPORTED_OPTION',
        { details: { option: 'baseUrl', supplied: String(this.customBaseUrl) } }
      );
    }

    const modules = await loadRuntimeModules();

    this.lastDependencyReport = modules.dependencyReport;

    const ActualEngine = modules.engineModule.VagdhenuWebEngine;

    // The imported browser adapter's first constructor parameter is canvas,
    // not baseUrl. The supported configuration uses no canvas.
    this._impl = new ActualEngine(
      null,
      this.backendMode
    );

    if (this._impl.provider) {
      this.provider = String(this._impl.provider);
    }

    this._emit('status', {
      stage: 'module-loaded',
      message: 'Local engine module loaded; model inference has not yet been verified.',
      progress: 0
    });

    return this._impl;
  }

  async initOnnxSessions(onProgress = null) {
    this._assertNotDisposed();

    if (
      onProgress != null &&
      typeof onProgress !== 'function'
    ) {
      throw new SwarSadhikaEngineError(
        'onProgress must be a function.',
        'INVALID_ARGUMENT'
      );
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      const impl = await this._loadImplementation();

      if (typeof impl.initOnnxSessions !== 'function') {
        throw new SwarSadhikaEngineError(
          'Underlying engine does not export initOnnxSessions().',
          'ENGINE_API_MISMATCH'
        );
      }

      const forward = (info) => {
        invokeSafely(onProgress, info);
        this._emit('progress', info);
        this._emit('status', info);
      };

      await impl.initOnnxSessions(forward);

      if (impl.provider) {
        this.provider = String(impl.provider);
      }

      this.isWarmedUp = Boolean(impl.isWarmedUp);

      return impl;
    })();

    try {
      return await this._initPromise;
    } catch (error) {
      this._initPromise = null;
      throw error;
    }
  }

  async setBackendMode(mode) {
    this._assertNotDisposed();

    const backend = normalizeBackend(mode);

    if (
      backend === this.backendMode &&
      this._impl
    ) {
      return this;
    }

    if (
      this._impl &&
      typeof this._impl.setBackendMode === 'function'
    ) {
      await this._impl.setBackendMode(backend);
    }

    this.backendMode = backend;
    this._initPromise = null;
    this.isWarmedUp = false;

    if (this._impl && this._impl.provider) {
      this.provider = String(this._impl.provider);
    }

    this._emit('status', {
      stage: 'backend-selected',
      backend,
      message: `Backend selected: ${backend}. Inference must still be run and checked.`,
      progress: 0
    });

    return this;
  }

  async synthesizeInBrowser(
    text,
    options = {},
    onProgress = null
  ) {
    this._assertNotDisposed();

    const normalizedText = normalizeText(text);

    const settings = normalizeSynthesisOptions({
      ...options,
      backend: this.backendMode
    });

    const impl = await this._loadImplementation();

    if (typeof impl.synthesizeInBrowser !== 'function') {
      throw new SwarSadhikaEngineError(
        'Underlying engine does not export synthesizeInBrowser().',
        'ENGINE_API_MISMATCH'
      );
    }

    const forwardProgress = (info) => {
      invokeSafely(onProgress, info);

      // Avoid invoking the same callback twice if passed through both channels.
      if (settings.onProgress !== onProgress) {
        invokeSafely(settings.onProgress, info);
      }

      this._emit('progress', info);
      this._emit('status', info);
    };

    const userOnChunk = settings.onChunk;

    const forwardChunk = async (chunk) => {
      this._emit('chunk', chunk);

      if (typeof userOnChunk === 'function') {
        await userOnChunk(chunk);
      }
    };

    /*
     * The underlying engine is responsible for actual browser-side inference.
     * No SpeechSynthesis, remote TTS endpoint, or synthetic success fallback
     * exists here.
     */
    const rawResult = await impl.synthesizeInBrowser(
      toEngineInputText(normalizedText),
      {
        meter: settings.meter || 'auto',
        nfe: settings.nfe,
        cfg: settings.cfg,
        speed: settings.speed,
        seed: settings.seed,
        noSandhi: settings.noSandhi,
        onChunk: forwardChunk
      },
      forwardProgress
    );

    if (
      !rawResult ||
      typeof rawResult !== 'object'
    ) {
      throw new SwarSadhikaEngineError(
        'The engine returned no result object.',
        'INVALID_ENGINE_RESULT'
      );
    }

    const output = await createResultUrl(rawResult);
    const safeUrl = ensureSafePlaybackUrl(output.url);

    if (this._impl.provider) {
      this.provider = String(this._impl.provider);
    }

    this.isWarmedUp = Boolean(this._impl.isWarmedUp);

    const result = {
      ...rawResult,
      url: safeUrl,
      provider: this.provider,
      backend: this.backendMode,
      inputText: Array.isArray(normalizedText)
        ? [...normalizedText]
        : normalizedText,
      resultUrlOwnedByAdapter: output.owned,

      /*
       * This is deliberately NOT an independently verified inference PASS.
       * A resolved method alone cannot prove pronunciation quality or
       * that the model produced a valid chant.
       */
      inferenceEvidence: Object.freeze({
        methodResolved: true,
        engineModule: ENGINE_MODULE_FILE,
        provider: this.provider,
        inferenceClaim: 'not-independently-verified',
        note: 'A returned result proves the method resolved, not that audio quality or Sanskrit pronunciation is correct.'
      }),

      play() {
        if (typeof Audio === 'undefined') {
          return null;
        }

        const player = new Audio(safeUrl);

        return player.play()
          .then(() => player)
          .catch((error) => {
            throw new SwarSadhikaEngineError(
              `Browser playback failed: ${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`,
              'AUDIO_PLAYBACK_FAILED',
              { cause: error }
            );
          });
      }
    };

    this._emit('result', result);
    return result;
  }

  async destroy() {
    if (this._disposed) return;

    this._disposed = true;

    const impl = this._impl;
    this._impl = null;
    this._initPromise = null;

    if (impl) {
      try {
        if (typeof impl.dispose === 'function') {
          await impl.dispose();
        } else if (typeof impl.destroy === 'function') {
          await impl.destroy();
        }
      } catch (error) {
        this._emit('status', {
          stage: 'dispose-warning',
          message: `Engine cleanup warning: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        });
      }
    }

    this._listeners.clear();
  }
}

/**
 * Create the public chant API.
 *
 * Example:
 * const voice = await sanskritTts({ backend: 'wasm' });
 * const result = await voice.chant(
 *   'वागर्थाविव संपृक्तौ वागर्थप्रतिपत्तये ।'
 * );
 *
 * This requires compatible local engine modules and real model artifacts.
 */
export async function sanskritTts(
  sourceOrOptions = null,
  maybeOptions = {}
) {
  let baseUrl = null;
  let options = {};

  if (typeof sourceOrOptions === 'string') {
    const selectedString = sourceOrOptions.trim().toLowerCase();

    if (VALID_BACKENDS.has(selectedString)) {
      options = {
        ...maybeOptions,
        backend: selectedString
      };
    } else {
      baseUrl = sourceOrOptions;
      options = { ...maybeOptions };
    }
  } else if (
    sourceOrOptions &&
    typeof sourceOrOptions === 'object'
  ) {
    options = { ...sourceOrOptions };
    baseUrl = options.baseUrl || options.modelId || null;
  } else if (sourceOrOptions != null) {
    throw new SwarSadhikaEngineError(
      'sanskritTts expects an options object, backend string, URL/path string, or null.',
      'INVALID_ARGUMENT'
    );
  }

  const config = normalizeSynthesisOptions({
    ...options,
    baseUrl
  });

  const engine = new VagdhenuWebEngine(
    config.baseUrl,
    config.backend
  );

  const modules = await loadRuntimeModules();

  const listeners = new Map([
    ['chunk', new Set()],
    ['progress', new Set()],
    ['status', new Set()],
    ['result', new Set()]
  ]);

  const emit = (eventName, value) => {
    for (const listener of listeners.get(eventName) || []) {
      invokeSafely(listener, value);
    }
  };

  for (const eventName of listeners.keys()) {
    engine.on(eventName, value => emit(eventName, value));
  }

  const notifyProgress = (value) => {
    invokeSafely(config.onProgress, value);
    emit('progress', value);
    emit('status', value);
  };

  if (!config.lazy) {
    await engine.initOnnxSessions(notifyProgress);
  }

  async function chant(text, perCallOptions = {}) {
    const merged = normalizeSynthesisOptions({
      ...config,
      ...perCallOptions
    });

    const input = normalizeText(text);
    const textTools = modules.textModule;
    let scansion = null;

    try {
      scansion = textTools.analyzeVerse(toEngineInputText(input));
    } catch (error) {
      /*
       * Analysis failure must not mutate the user's text or be represented
       * as a correction.
       */
      emit('status', {
        stage: 'scansion-warning',
        message: `Meter/scansion analysis unavailable: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      });
    }

    const result = await engine.synthesizeInBrowser(
      input,
      {
        meter: merged.meter || scansion?.meter?.name || 'auto',
        nfe: merged.nfe,
        cfg: merged.cfg,
        speed: merged.speed,
        seed: merged.seed,
        noSandhi: merged.noSandhi,
        onChunk: merged.onChunk
      },
      value => invokeSafely(merged.onProgress, value)
    );

    return Object.freeze({
      ...result,
      scansion,

      play() {
        if (typeof Audio === 'undefined') {
          return null;
        }

        const player = new Audio(result.url);
        return player.play().then(() => player);
      }
    });
  }

  function stream(text, perCallOptions = {}) {
    const queue = [];
    const waiters = [];
    let completed = false;
    let failure = null;

    const resolveWaiters = () => {
      while (waiters.length && (queue.length || completed)) {
        const waiter = waiters.shift();

        if (queue.length) {
          waiter.resolve({
            value: queue.shift(),
            done: false
          });
        } else if (failure) {
          waiter.reject(failure);
        } else {
          waiter.resolve({
            value: undefined,
            done: true
          });
        }
      }
    };

    const runPromise = chant(text, {
      ...perCallOptions,

      onChunk: async (chunk) => {
        if (typeof perCallOptions.onChunk === 'function') {
          await perCallOptions.onChunk(chunk);
        }

        if (waiters.length) {
          waiters.shift().resolve({
            value: chunk,
            done: false
          });
        } else {
          queue.push(chunk);
        }
      }
    }).then((result) => {
      completed = true;
      resolveWaiters();
      return result;
    }, (error) => {
      failure = error;
      completed = true;
      resolveWaiters();
      throw error;
    });

    return {
      result: runPromise,
      then: runPromise.then.bind(runPromise),
      catch: runPromise.catch.bind(runPromise),
      finally: runPromise.finally.bind(runPromise),

      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (queue.length) {
              return {
                value: queue.shift(),
                done: false
              };
            }

            if (failure) throw failure;

            if (completed) {
              return {
                value: undefined,
                done: true
              };
            }

            return new Promise((resolve, reject) => {
              waiters.push({ resolve, reject });
            });
          },

          async return() {
            /*
             * This closes the consumer iterator; inference already in
             * progress may finish.
             */
            completed = true;
            resolveWaiters();

            return {
              value: undefined,
              done: true
            };
          }
        };
      }
    };
  }

  const voice = Object.assign(
    (text, perCallOptions) => chant(text, perCallOptions),
    {
      chant,
      speak: chant,
      stream,
      engine,
      options: Object.freeze({ ...config }),

      scan(text) {
        const normalized = normalizeText(text);
        return modules.textModule.analyzeVerse(normalized);
      },

      setBackend(mode) {
        return engine.setBackendMode(mode);
      },

      on(eventName, callback) {
        if (
          typeof eventName !== 'string' ||
          typeof callback !== 'function'
        ) {
          throw new SwarSadhikaEngineError(
            'on(eventName, callback) requires a string and a function.',
            'INVALID_ARGUMENT'
          );
        }

        if (!listeners.has(eventName)) {
          listeners.set(eventName, new Set());
        }

        listeners.get(eventName).add(callback);
        return voice;
      },

      off(eventName, callback) {
        listeners.get(eventName)?.delete(callback);
        return voice;
      },

      async destroy() {
        await engine.destroy();

        for (const set of listeners.values()) {
          set.clear();
        }
      }
    }
  );

  return voice;
}

export async function createSwarSadhikaEngine(options = {}) {
  assertObject(options, 'Engine options');

  const config = normalizeSynthesisOptions(options);

  const engine = new VagdhenuWebEngine(
    config.baseUrl,
    config.backend
  );

  if (!config.lazy) {
    await engine.initOnnxSessions(config.onProgress);
  }

  return engine;
}

/**
 * Retry dependency checks after files have been added/redeployed.
 */
export async function reloadEngineModules() {
  cachedRuntimeModules = null;
  cachedRuntimePromise = null;

  return loadRuntimeModules({ retry: true });
}

export default sanskritTts;
