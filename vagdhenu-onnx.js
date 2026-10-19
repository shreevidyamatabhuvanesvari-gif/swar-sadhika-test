/**
 * Swar-Sadhika — original local Vāgdhenu ONNX runtime bridge
 *
 * Path: vendor/vagdhenu-upstream/vagdhenu-onnx.js
 *
 * This file is an original implementation of the browser runtime bridge. It
 * does not copy the upstream browser-engine source. It uses the published
 * Vāgdhenu ONNX model artifacts and ONNX Runtime Web, both executed in this
 * browser tab. No cloud TTS/inference API is called and no synthetic/fallback
 * audio is emitted when the model pipeline fails.
 *
 * Public API expected by the parent adapter:
 *   new VagdhenuWebEngine(null, 'wasm' | 'webgpu')
 *   await engine.setBackendMode(mode)
 *   await engine.initOnnxSessions(progressCallback)
 *   await engine.synthesizeInBrowser(text, options, progressCallback)
 *   await engine.dispose()
 *
 * Runtime/model downloads are performed over HTTPS on first use. The test
 * repository's service worker caches matching model/runtime requests where
 * browser storage permits. Offline behavior still requires a prior complete
 * download/cache and must be tested on the target Android device.
 */

import * as TextModule from '../../vagdhenu-text.js';

export const VAGDHENU_ENGINE_VERSION = '1.2.0-model-matched-bank-fallback';

/** Languages accepted by the Swar-Sadhika text-preparation bridge. */
export const SUPPORTED_TEXT_LANGUAGES = Object.freeze([
  'vedic-sanskrit',
  'sanskrit',
  'hindi'
]);

export const VAGDHENU_SAMPLE_RATE = 24000;

export const VAGDHENU_ASSET_FILES = Object.freeze({
  conditioner: 'vagdhenu_cond_q8.onnx',
  dit: 'vagdhenu_dit_step_q8.onnx',
  vocoder: 'vagdhenu_vocos_q8.onnx',
  bank: 'baked_bank.json',
  bankBinary: 'baked_bank.bin'
});

const ORT_VERSION = '1.23.2';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_REPOSITORIES = Object.freeze({
  wasm: 'https://huggingface.co/gnumanth/sanskrit-tts-wasm/resolve/main/',
  onnx: 'https://huggingface.co/gnumanth/sanskrit-tts-onnx/resolve/main/'
});

const RUNTIME_CACHE_NAME = 'swar-sadhika-remote-runtime-v1';
const MODEL_CACHE_NAME = 'swar-sadhika-vagdhenu-models-v1';
const MAX_TEXT_CHARS = 12000;
const MAX_AUDIO_SAMPLES = VAGDHENU_SAMPLE_RATE * 180;
const DEFAULT_NFE = 7;
const MEL_CHANNELS = 100;
const VOCAB_SIZE = 1039;

let runtimePromise = null;

function messageOf(error) {
  if (error instanceof Error) return error.message;
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

function throwCoded(message, code, details = undefined, cause = undefined) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'VagdhenuRuntimeError';
  error.code = code;

  if (details !== undefined) error.details = details;

  throw error;
}

function emit(callback, detail) {
  if (typeof callback !== 'function') return;

  try {
    callback(Object.freeze({
      at: new Date().toISOString(),
      ...detail
    }));
  } catch (error) {
    console.warn('[Swar-Sadhika] progress callback failed:', error);
  }
}

function normalizeBackend(value) {
  const backend = String(value || 'wasm').trim().toLowerCase();

  if (backend === 'webgpu') return 'onnx';

  if (backend !== 'wasm' && backend !== 'onnx') {
    throwCoded(
      `असमर्थित backend "${backend}"। "wasm" या "onnx" चुनें।`,
      'INVALID_BACKEND'
    );
  }

  return backend;
}

function getModelBase(backend) {
  return MODEL_REPOSITORIES[normalizeBackend(backend)];
}

function isHtmlResponse(response) {
  return String(response?.headers?.get('content-type') || '')
    .toLowerCase()
    .includes('text/html');
}

function isUsableAssetResponse(response) {
  return Boolean(
    response &&
    response.status === 200 &&
    response.ok &&
    response.type !== 'opaque' &&
    !isHtmlResponse(response)
  );
}

async function fetchChecked(url, label, { cache = 'default' } = {}) {
  const parsedUrl = new URL(url);
  const isModelHost = /(^|\.)huggingface\.co$/i.test(parsedUrl.hostname);
  const cacheName = isModelHost ? MODEL_CACHE_NAME : RUNTIME_CACHE_NAME;
  let response = null;

  // Validate cached entries before using them. A stale opaque response, an
  // HTML error page, or a non-200 response is not a usable model/runtime file.
  if (typeof caches !== 'undefined' && !isModelHost) {
    try {
      const assetCache = await caches.open(cacheName);
      const cached = await assetCache.match(url, { ignoreSearch: true });

      if (cached && isUsableAssetResponse(cached)) {
        response = cached;
      } else if (cached) {
        console.warn(
          `[Swar-Sadhika] Invalid cached ${label}; deleting and retrying network:`,
          url,
          {
            status: cached.status,
            type: cached.type,
            contentType: cached.headers?.get('content-type') || ''
          }
        );

        try {
          await assetCache.delete(url);
        } catch {
          /* best-effort cleanup */
        }
      }
    } catch (error) {
      console.warn(
        `[Swar-Sadhika] Cache lookup for ${label} failed; trying network:`,
        error
      );
    }
  } else if (isModelHost) {
    // Do not bypass model-cache.js integrity metadata by reading model bytes
    // directly from Cache Storage. A controlling service worker may return a
    // verified cached response; otherwise this request goes to the network.
  }

  if (!response) {
    try {
      response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache
      });
    } catch (error) {
      throwCoded(
        `${label}: फ़ाइल प्राप्त नहीं हुई। नेटवर्क, CORS या पहले से भरा हुआ स्थानीय cache जाँचें। (${messageOf(error)})`,
        'ASSET_FETCH_FAILED',
        { url, label },
        error
      );
    }
  }

  if (response?.type === 'opaque') {
    throwCoded(
      `${label}: प्रतिक्रिया Opaque है; HTTP स्थिति और headers सत्यापित नहीं किए जा सकते। CORS अनुरोध जाँचें।`,
      'ASSET_OPAQUE_RESPONSE',
      { url, label, responseType: response.type }
    );
  }

  if (!response || !response.ok || response.status !== 200) {
    throwCoded(
      `${label}: HTTP ${response?.status ?? 'unknown'}; अपेक्षित HTTP 200।`,
      'ASSET_HTTP_ERROR',
      {
        url,
        status: response?.status ?? null,
        responseType: response?.type ?? null,
        label
      }
    );
  }

  if (isHtmlResponse(response)) {
    throwCoded(
      `${label}: सर्वर ने फ़ाइल के बजाय HTML लौटाया; मॉडल/runtime लोड नहीं हुआ।`,
      'ASSET_CONTENT_TYPE_ERROR',
      {
        url,
        label,
        contentType: response.headers.get('content-type')
      }
    );
  }

  // Persist validated CORS-readable responses explicitly. If the first visit
  // is not yet controlled by the service worker, this still attempts to cache
  // a response. A cache-write failure does not invalidate a valid network file.
  if (typeof caches !== 'undefined' && !isModelHost) {
    try {
      const assetCache = await caches.open(cacheName);
      await assetCache.put(url, response.clone());
    } catch (error) {
      console.warn(
        `[Swar-Sadhika] ${label} डाउनलोड हुआ, लेकिन local Cache Storage में नहीं लिखा जा सका:`,
        error
      );
    }
  }

  return response;
}

async function loadOrtRuntime() {
  if (globalThis.ort?.InferenceSession && globalThis.ort?.Tensor) {
    configureOrt(globalThis.ort);
    return globalThis.ort;
  }

  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !document.head) {
      reject(new Error('ONNX Runtime Web को browser document/head चाहिए।'));
      return;
    }

    const runtimeUrl = `${ORT_BASE}ort.all.min.js`;

    let existing = document.querySelector(
      `script[data-swar-ort="${ORT_VERSION}"]`
    );

    // A script element created by an older bridge version has no recorded
    // loading state, so its request mode cannot be trusted. Recreate it rather
    // than accidentally reusing a no-cors request already in progress.
    if (
      existing &&
      !existing.dataset.swarOrtState &&
      existing.src &&
      !(globalThis.ort?.InferenceSession && globalThis.ort?.Tensor)
    ) {
      existing.remove();
      existing = null;
    }

    let settled = false;
    let timeoutId = null;

    const cleanup = script => {
      if (timeoutId !== null) clearTimeout(timeoutId);

      if (script) {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      }
    };

    const fail = (error, script) => {
      if (settled) return;

      settled = true;

      if (script) {
        script.dataset.swarOrtState = 'error';

        // A failed element would otherwise poison every retry on this page.
        try {
          script.remove();
        } catch {
          /* best-effort cleanup */
        }
      }

      cleanup(script);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const finish = script => {
      if (settled) return;

      if (globalThis.ort?.InferenceSession && globalThis.ort?.Tensor) {
        settled = true;

        if (script) script.dataset.swarOrtState = 'loaded';

        cleanup(script);

        try {
          configureOrt(globalThis.ort);
          resolve(globalThis.ort);
        } catch (error) {
          reject(error);
        }

        return;
      }

      fail(
        new Error(
          'ONNX Runtime script का load event आया, लेकिन आवश्यक ort.InferenceSession और ort.Tensor APIs उपलब्ध नहीं हैं।'
        ),
        script
      );
    };

    function onLoad(event) {
      finish(event.currentTarget);
    }

    function onError(event) {
      const script = event.currentTarget;

      fail(
        new Error(
          `ONNX Runtime Web ${ORT_VERSION} लोड नहीं हुआ: ${runtimeUrl}. ` +
          'जाँचें कि अनुरोध CORS mode में है, CDN उपलब्ध है और Service Worker वास्तविक प्रतिक्रिया लौटा रहा है।'
        ),
        script
      );
    }

    const script = existing || document.createElement('script');
    script.async = true;
    script.dataset.swarOrt = ORT_VERSION;

    // This must be set BEFORE src. It makes the cross-origin classic-script
    // request use CORS mode rather than no-cors, allowing the Service Worker
    // to inspect and cache a readable CDN response. The CDN must still provide
    // a valid Access-Control-Allow-Origin response header.
    script.crossOrigin = 'anonymous';

    // Mark the state on our script so subsequent initialization attempts can
    // diagnose an already failed/loaded element instead of waiting forever.
    const previousState = script.dataset.swarOrtState || '';

    if (previousState === 'error') {
      fail(
        new Error(`पहले का ONNX Runtime script load विफल था: ${runtimeUrl}`),
        script
      );
      return;
    }

    if (previousState === 'loaded') {
      finish(script);
      return;
    }

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    // A script may have completed before listeners were attached. Check the
    // global immediately; if it is absent, the timeout below prevents a
    // permanently pending initialization promise.
    if (globalThis.ort?.InferenceSession && globalThis.ort?.Tensor) {
      finish(script);
      return;
    }

    timeoutId = setTimeout(() => {
      fail(
        new Error(
          `ONNX Runtime Web ${ORT_VERSION} के load की प्रतीक्षा समय-सीमा समाप्त हुई। ` +
          'Network/CORS त्रुटि, Service Worker और CDN request जाँचें।'
        ),
        script
      );
    }, 45000);

    if (!existing) {
      script.src = runtimeUrl;
      script.dataset.swarOrtState = 'loading';
      document.head.appendChild(script);
    }
  }).catch(error => {
    runtimePromise = null;

    throwCoded(
      `ONNX Runtime शुरू नहीं हुआ: ${messageOf(error)}`,
      'ORT_RUNTIME_UNAVAILABLE',
      {
        url: `${ORT_BASE}ort.all.min.js`,
        version: ORT_VERSION
      },
      error
    );
  });

  return runtimePromise;
}

function configureOrt(ort) {
  try {
    ort.env.logLevel = 'warning';
    ort.env.wasm.wasmPaths = ORT_BASE;

    // A single WASM thread is the safest default for Android WebViews and does
    // not require cross-origin isolation/SharedArrayBuffer.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
  } catch (error) {
    console.warn(
      '[Swar-Sadhika] Could not set every ORT runtime option:',
      error
    );
  }
}

function canonicalMeter(value) {
  const input = String(value || 'auto').trim().toLowerCase();

  if (!input || input === 'auto') return 'anustubh';

  try {
    const key = TextModule.detectMeterKey?.(input);
    if (key) return key;
  } catch {
    /* use normalized spelling */
  }

  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '') || 'anustubh';
}

function toSlp1(text) {
  try {
    const alignment = TextModule.alignSlp1?.(text);
    if (alignment?.slp1) return String(alignment.slp1);
  } catch {
    /* use original Sanskrit string; tokenizer will validate it */
  }

  return String(text);
}

/**
 * Resolve the requested language without changing the user's source text.
 * Pass options.language as "vedic-sanskrit", "sanskrit", or "hindi" to
 * choose explicitly. "auto" detects explicit Vedic accent marks and a small
 * set of high-confidence Hindi function words; ordinary Devanagari text is
 * treated as Sanskrit because script alone cannot distinguish the languages.
 */
function normalizeTextLanguage(value, input = '') {
  const raw = String(value ?? 'auto').trim().toLowerCase();

  const aliases = new Map([
    ['vedic', 'vedic-sanskrit'],
    ['vedicsanskrit', 'vedic-sanskrit'],
    ['vedic-sanskrit', 'vedic-sanskrit'],
    ['sa-vedic', 'vedic-sanskrit'],
    ['वैदिक', 'vedic-sanskrit'],
    ['वैदिक संस्कृत', 'vedic-sanskrit'],
    ['sanskrit', 'sanskrit'],
    ['sa', 'sanskrit'],
    ['sa-deva', 'sanskrit'],
    ['संस्कृत', 'sanskrit'],
    ['hindi', 'hindi'],
    ['hi', 'hindi'],
    ['hi-deva', 'hindi'],
    ['हिंदी', 'hindi'],
    ['हिन्दी', 'hindi'],
    ['', 'auto'],
    ['auto', 'auto']
  ]);

  const requested = aliases.get(raw);

  if (requested === undefined) {
    throwCoded(
      `असमर्थित पाठ-भाषा "${value}"। वैदिक संस्कृत, संस्कृत, हिंदी या auto चुनें।`,
      'UNSUPPORTED_TEXT_LANGUAGE',
      {
        requested: value,
        supported: [...SUPPORTED_TEXT_LANGUAGES, 'auto']
      }
    );
  }

  if (requested !== 'auto') return requested;

  const text = String(input ?? '');

  if (/[\u0951-\u0954\u1CD0-\u1CFF\uA8E0-\uA8FF]/u.test(text)) {
    return 'vedic-sanskrit';
  }

  // Script is not enough to separate Hindi and Sanskrit. This conservative
  // heuristic only marks Hindi when common Hindi function words are present.
  if (/(?:^|\s)(?:है|हैं|था|थी|थे|को|की|के|का|और|में|से|पर|यह|वह|नहीं|करता|करती|करते)(?=$|\s|[।॥,;:!?])/u.test(text)) {
    return 'hindi';
  }

  return 'sanskrit';
}

/**
 * Choose only a representation that the loaded model vocabulary can tokenize.
 * The source text is never rewritten in the editor or discarded from metadata.
 * Native Devanagari is tried first; SLP1 is a standards-based fallback. No
 * conversion to an unrelated script and no guessed token IDs are used.
 */
function prepareLanguageInput(sourceText, requestedLanguage, tokenToId) {
  const original = String(sourceText ?? '').replace(/\r\n?/g, '\n').trim();

  if (!original) {
    throwCoded('कृपया पाठ लिखें।', 'EMPTY_TEXT');
  }

  const language = normalizeTextLanguage(requestedLanguage, original);
  const clean = TextModule.prepareTtsTextWithoutMutation?.(original) ?? original;
  const slp1 = toSlp1(clean);
  const candidates = [];

  const addCandidate = (representation, text) => {
    const value = String(text ?? '').normalize('NFC');

    if (value && !candidates.some(item => item.text === value)) {
      candidates.push({ representation, text: value });
    }
  };

  // Vedic accents are preserved in both candidates. If the model has no token
  // for an accent, report that fact instead of silently deleting the accent.
  addCandidate('native-devanagari-or-input', clean);
  addCandidate('slp1', slp1);

  const failures = [];

  for (const candidate of candidates) {
    try {
      const tokenIds = vocabularyTokenize(
        candidate.text,
        tokenToId,
        { strict: true }
      );

      return Object.freeze({
        original,
        clean,
        language,
        slp1,
        modelInputText: candidate.text,
        inputRepresentation: candidate.representation,
        tokenIds
      });
    } catch (error) {
      failures.push({
        representation: candidate.representation,
        code: error?.code || 'TOKENIZATION_FAILED',
        message: messageOf(error)
      });
    }
  }

  throwCoded(
    `लोड किए गए मॉडल की vocabulary में ${language === 'vedic-sanskrit' ? 'वैदिक संस्कृत' : language === 'hindi' ? 'हिंदी' : 'संस्कृत'} पाठ को सुरक्षित रूप से tokenize करने के लिए आवश्यक tokens नहीं मिले। मूल पाठ/वैदिक चिह्न हटाए नहीं गए; अनुमानित token IDs का उपयोग नहीं हुआ।`,
    'LANGUAGE_TOKENS_UNAVAILABLE',
    {
      language,
      original,
      candidates: failures,
      vocabularySize: tokenToId?.size ?? 0
    }
  );
}

function walkObjects(root, visitor, path = [], seen = new Set(), depth = 0) {
  if (!root || typeof root !== 'object' || depth > 18 || seen.has(root)) return;

  seen.add(root);
  visitor(root, path);

  if (Array.isArray(root)) {
    for (let i = 0; i < root.length; i += 1) {
      walkObjects(root[i], visitor, [...path, i], seen, depth + 1);
    }
  } else {
    for (const [key, value] of Object.entries(root)) {
      walkObjects(value, visitor, [...path, key], seen, depth + 1);
    }
  }
}

function entriesToVocabulary(entries) {
  const map = new Map();

  if (
    Array.isArray(entries) &&
    entries.every(item => typeof item === 'string')
  ) {
    entries.forEach((token, id) => map.set(token, id));
    return map;
  }

  if (
    Array.isArray(entries) &&
    entries.every(item => item && typeof item === 'object')
  ) {
    for (const item of entries) {
      const token = item.token ?? item.text ?? item.symbol ?? item.phoneme;
      const id = item.id ?? item.index ?? item.token_id;

      if (typeof token === 'string' && Number.isInteger(Number(id))) {
        map.set(token, Number(id));
      }
    }

    if (map.size) return map;
  }

  if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
    const values = Object.values(entries);

    if (values.length && values.every(value => Number.isInteger(Number(value)))) {
      for (const [token, id] of Object.entries(entries)) {
        map.set(token, Number(id));
      }

      return map;
    }

    if (
      values.length &&
      values.every(value => typeof value === 'string') &&
      Object.keys(entries).every(key => /^\d+$/.test(key))
    ) {
      for (const [id, token] of Object.entries(entries)) {
        map.set(token, Number(id));
      }

      return map;
    }
  }

  return map;
}

function findVocabulary(bank) {
  const candidates = [];
  const namedVocabularyKey = /^(vocab|vocabulary|token_to_id|token2id|phoneme_vocab|phoneme_to_id|tokens|phoneme_to_idx|symbol_to_id|token2idx|stoi)$/i;
  const vocabularyContext = /vocab|token|phoneme|symbol|phone|stoi|idx_to_token|id_to_token/i;

  walkObjects(bank, (node, path) => {
    const keyContext = path.map(String).join('.').toLowerCase();

    // Form A: ordered token list. Prefer a vocabulary-related path, but also
    // retain unlabelled lists as low-confidence candidates for schema variants.
    if (
      Array.isArray(node) &&
      node.length > 100 &&
      node.every(item => typeof item === 'string')
    ) {
      candidates.push({
        map: entriesToVocabulary(node),
        score: vocabularyContext.test(keyContext) ? 5 : 1,
        path: keyContext || '<root-array>'
      });
    }

    if (node && !Array.isArray(node) && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        const pathLabel = [...path.map(String), key].join('.');
        const map = entriesToVocabulary(value);
        if (map.size <= 100) continue;

        if (namedVocabularyKey.test(key)) {
          candidates.push({ map, score: 12, path: pathLabel });
          continue;
        }

        // Form B: token -> integer ID mapping under a differently named key.
        // Require a large map, unique IDs, and plausible IDs within model range;
        // this avoids treating arbitrary numeric metadata as a vocabulary.
        if (
          value && typeof value === 'object' && !Array.isArray(value) &&
          map.size === Object.keys(value).length &&
          new Set(map.values()).size === map.size &&
          [...map.values()].every(id => Number.isInteger(id) && id >= 0 && id < VOCAB_SIZE) &&
          [...map.keys()].some(token => /[\p{L}\p{M}]/u.test(token))
        ) {
          candidates.push({
            map,
            score: vocabularyContext.test(pathLabel.toLowerCase()) ? 8 : 3,
            path: pathLabel
          });
        }
      }
    }
  });

  // A valid vocabulary must fit the model's 1,039-entry embedding table.
  // Filter out unrelated arrays/maps with numeric IDs outside that range.
  const valid = candidates.filter(candidate =>
    candidate.map.size > 100 &&
    [...candidate.map.values()].every(id => Number.isInteger(id) && id >= 0 && id < VOCAB_SIZE)
  );
  valid.sort((a, b) => b.score - a.score || b.map.size - a.map.size);

  const candidate = valid[0];
  if (!candidate) {
    // Diagnostic only: this field is present in the user's bank, but its
    // 0..2544 IDs do not fit the model bridge's declared 0..1038 range.
    // Do not reinterpret it as the model vocabulary or renumber IDs blindly.
    const charMap = bank?.vocab_char_map;
    const charMapValues = charMap && typeof charMap === 'object' && !Array.isArray(charMap)
      ? Object.values(charMap)
      : [];
    const charMapIds = charMapValues.filter(Number.isInteger);
    const charMapDiagnostic = charMapIds.length
      ? {
          path: 'vocab_char_map',
          entries: charMapValues.length,
          integerIds: charMapIds.length,
          uniqueIds: new Set(charMapIds).size,
          minId: Math.min(...charMapIds),
          maxId: Math.max(...charMapIds),
          expectedModelIdRange: `0..${VOCAB_SIZE - 1}`,
          compatibleWithDeclaredModelRange: charMapIds.every(id => id >= 0 && id < VOCAB_SIZE)
        }
      : null;

    throwCoded(
      charMapDiagnostic
        ? `baked_bank.json लोड हुई, लेकिन इसकी vocab_char_map में ${charMapDiagnostic.entries} प्रविष्टियाँ और ID सीमा ${charMapDiagnostic.minId}–${charMapDiagnostic.maxId} है; इस इंजन को 1,039-token मॉडल vocabulary (ID 0–${VOCAB_SIZE - 1}) चाहिए। इस मानचित्र को बिना आधिकारिक tokenizer/model mapping के बदलना सुरक्षित नहीं है।`
        : 'baked_bank.json लोड हुई, लेकिन इंजन की 1,039-token मॉडल vocabulary सुरक्षित रूप से नहीं मिली। अनुमानित token IDs का उपयोग नहीं किया गया।',
      'BANK_VOCABULARY_UNAVAILABLE',
      {
        expectedVocabularySize: VOCAB_SIZE,
        charMap: charMapDiagnostic,
        candidates: candidates.map(item => ({
          path: item.path,
          size: item.map.size,
          minId: item.map.size ? Math.min(...item.map.values()) : null,
          maxId: item.map.size ? Math.max(...item.map.values()) : null
        }))
      }
    );
  }

  return { tokenToId: candidate.map, source: candidate.path };
}

/**
 * Require a complete, one-to-one token-ID map for the declared 1,039-entry
 * model vocabulary. Range-only validation can accidentally accept a partial
 * or duplicate map and silently tokenize text incorrectly.
 */
function validateModelVocabulary(vocabulary, label, url) {
  const map = vocabulary?.tokenToId;
  const ids = map instanceof Map ? [...map.values()] : [];
  const uniqueIds = new Set(ids);
  const expectedIds = ids.length === VOCAB_SIZE && uniqueIds.size === VOCAB_SIZE &&
    ids.every(id => Number.isInteger(id) && id >= 0 && id < VOCAB_SIZE);

  if (!map || map.size !== VOCAB_SIZE || !expectedIds) {
    throwCoded(
      `${label}: vocabulary को मॉडल के पूरे ${VOCAB_SIZE}-token ID मानचित्र से मिलान नहीं किया जा सका। आकार ${map?.size ?? 0}, अलग IDs ${uniqueIds.size}; अपेक्षित ID सीमा 0–${VOCAB_SIZE - 1} है।`,
      'BANK_VOCABULARY_SHAPE_MISMATCH',
      {
        url,
        label,
        expectedVocabularySize: VOCAB_SIZE,
        actualVocabularySize: map?.size ?? 0,
        uniqueIdCount: uniqueIds.size,
        minId: ids.length ? Math.min(...ids) : null,
        maxId: ids.length ? Math.max(...ids) : null
      }
    );
  }

  return true;
}

/**
 * Load a bank JSON candidate and require a vocabulary compatible with the
 * model bridge before the candidate can be used. The official model bank is
 * attempted first; the app-root copy is only a validated fallback.
 */
async function loadBankJsonCandidate(url, label) {
  const response = await fetchChecked(url, label);
  let bank;

  try {
    bank = await response.json();
  } catch (error) {
    throwCoded(
      `${label}: JSON parse नहीं हुआ।`,
      'BANK_JSON_INVALID',
      { url, label },
      error
    );
  }

  if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
    throwCoded(
      `${label}: JSON का root object अपेक्षित प्रारूप में नहीं है।`,
      'BANK_JSON_SCHEMA_INVALID',
      { url, label }
    );
  }

  const vocabulary = findVocabulary(bank);
  if (!vocabulary?.tokenToId?.size) {
    throwCoded('Token vocabulary खाली है।', 'BANK_VOCABULARY_EMPTY', { url, label });
  }
  validateModelVocabulary(vocabulary, label, url);

  return { bank, vocabulary, url, label };
}

/**
 * A bank JSON may point into baked_bank.bin. Reject the pair if any explicit
 * byte_offset + byte_length range falls outside the binary file. This is a
 * structural guard, not a cryptographic integrity check.
 */
function validateBankBinaryReferences(bank, binaryByteLength, label) {
  const invalid = [];

  walkObjects(bank, (node, path) => {
    if (!node || Array.isArray(node) || typeof node !== 'object') return;

    const offset = node.byte_offset;
    const length = node.byte_length;

    if (!Number.isInteger(offset) || !Number.isInteger(length)) return;

    if (offset < 0 || length <= 0 || offset + length > binaryByteLength) {
      invalid.push({
        path: path.map(String).join('.') || '<root>',
        byteOffset: offset,
        byteLength: length,
        binaryByteLength
      });
    }
  });

  if (invalid.length) {
    throwCoded(
      `${label}: JSON में दिए गए ${invalid.length} binary byte-range संदर्भ baked_bank.bin की सीमा से बाहर हैं; यह JSON/bin जोड़ी असंगत हो सकती है।`,
      'BANK_BINARY_REFERENCE_MISMATCH',
      { invalidReferences: invalid.slice(0, 10), invalidCount: invalid.length }
    );
  }

  return true;
}

function findMeterRecord(bank, meterKey) {
  const key = canonicalMeter(meterKey);

  const directContainers = [
    bank?.meters,
    bank?.vṛttas,
    bank?.vrttas,
    bank?.prosody,
    bank?.templates,
    bank?.references,
    bank?.bank
  ];

  for (const container of directContainers) {
    if (!container || typeof container !== 'object') continue;

    for (const [name, record] of Object.entries(container)) {
      if (canonicalMeter(name) === key && record && typeof record === 'object') {
        return { record, path: name };
      }
    }
  }

  const matches = [];

  walkObjects(bank, (node, path) => {
    if (!node || Array.isArray(node) || typeof node !== 'object') return;

    const name =
      node.meter ??
      node.name ??
      node.key ??
      node.chandas ??
      node.vritta ??
      node.vṛtta;

    const hasReference = Object.keys(node).some(field =>
      /mel|template|reference|offset|start|shape|length|frames|prosody/i.test(field)
    );

    if (name != null && canonicalMeter(name) === key && hasReference) {
      matches.push({ record: node, path: path.join('.') });
    }
  });

  if (matches.length) return matches[0];

  // The published bank is documented to include Anuṣṭubh and a default/meter
  // map. If the requested label is unknown, use Anuṣṭubh only when an explicit
  // Anuṣṭubh record can be found; never fabricate a prosody vector.
  if (key !== 'anustubh') return findMeterRecord(bank, 'anustubh');

  return null;
}

function collectNumericArray(value, maxDepth = 8) {
  if (maxDepth < 0 || value == null) return null;

  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value, Number).filter(Number.isFinite);
  }

  if (Array.isArray(value)) {
    if (
      value.length &&
      value.every(item => typeof item === 'number' && Number.isFinite(item))
    ) {
      return value;
    }

    for (const item of value) {
      const found = collectNumericArray(item, maxDepth - 1);
      if (found && found.length) return found;
    }

    return null;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/vocab|token|id|name|meter|key|offset|length|shape/i.test(key)) {
        continue;
      }

      if (/mel|template|reference|feature|prosody|data|values|embedding|tensor/i.test(key)) {
        const found = collectNumericArray(child, maxDepth - 1);
        if (found && found.length) return found;
      }
    }

    for (const child of Object.values(value)) {
      const found = collectNumericArray(child, maxDepth - 1);
      if (found && found.length) return found;
    }
  }

  return null;
}

function halfToFloat(bits) {
  const sign = (bits & 0x8000) ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x03ff;

  if (exponent === 0) return sign * Math.pow(2, -14) * (fraction / 1024);
  if (exponent === 31) return fraction ? NaN : sign * Infinity;

  return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

function readTemplateFromBinary(record, bankBytes) {
  if (!record || !bankBytes || bankBytes.byteLength < 2) return null;

  const offsetRaw =
    record.byteOffset ??
    record.offsetBytes ??
    record.offset ??
    record.start;

  const byteLengthRaw =
    record.byteLength ??
    record.lengthBytes ??
    record.numelBytes;

  const countRaw =
    record.numel ??
    record.count ??
    record.length ??
    record.size;

  if (!Number.isFinite(Number(offsetRaw))) return null;

  let byteOffset = Number(offsetRaw);

  if (
    record.byteOffset == null &&
    record.offsetBytes == null &&
    byteOffset < bankBytes.byteLength / 2
  ) {
    // The bank's documented storage is FP16; an unlabelled `offset` is treated
    // as a half-element index unless metadata explicitly says byteOffset.
    byteOffset *= 2;
  }

  let count = Number(countRaw);

  if (
    Number.isFinite(Number(byteLengthRaw)) &&
    Number(byteLengthRaw) > 0
  ) {
    // The packed bank is IEEE-754 FP16: each sample occupies two bytes.
    count = Number(byteLengthRaw) / 2;
  }

  if (!Number.isFinite(count) || count <= 0) {
    const shape = record.shape ?? record.dims ?? record.dimensions;

    if (
      Array.isArray(shape) &&
      shape.length &&
      shape.every(n => Number.isFinite(Number(n)) && Number(n) > 0)
    ) {
      count = shape.reduce((product, n) => product * Number(n), 1);
    }
  }

  if (!Number.isFinite(count) || count <= 0) return null;

  const start = Math.max(0, Math.floor(byteOffset));
  const end = Math.min(bankBytes.byteLength, start + Math.floor(count) * 2);

  if (end <= start) return null;

  const view = new DataView(bankBytes);
  const result = [];

  for (let offset = start; offset + 1 < end; offset += 2) {
    result.push(halfToFloat(view.getUint16(offset, true)));
  }

  return result.length ? result : null;
}

function findUnknownTemplateRecord(bank, meterKey) {
  const found = findMeterRecord(bank, meterKey);
  if (found) return found;

  // Some manifests are arrays keyed by an enclosing record rather than a
  // `meter` property. Find a direct named entry from the recursively tracked path.
  const wanted = canonicalMeter(meterKey);
  let output = null;

  walkObjects(bank, (node, path) => {
    if (output || !node || Array.isArray(node) || typeof node !== 'object') {
      return;
    }

    const pathNames = path
      .filter(item => typeof item === 'string')
      .map(canonicalMeter);

    if (
      pathNames.includes(wanted) &&
      Object.keys(node).some(key => /offset|template|mel|reference|shape/i.test(key))
    ) {
      output = { record: node, path: path.join('.') };
    }
  });

  return output;
}

function shapeOf(meta) {
  const value = meta?.shape ?? meta?.dimensions ?? meta?.dims ?? [];
  return Array.isArray(value) ? value.map(item => item) : [];
}

function resolvedShape(
  meta,
  { tokenCount = 1, frames = 128, melChannels = MEL_CHANNELS, latentShape = null } = {}
) {
  const raw = shapeOf(meta);
  if (!raw.length) return [];

  const name = String(meta?.name || '').toLowerCase();

  const result = raw.map((dim, index) => {
    if (typeof dim === 'number' && Number.isFinite(dim) && dim > 0) {
      return Math.floor(dim);
    }

    const label = String(dim || '').toLowerCase();

    if (/batch|^b$/.test(label) || index === 0) return 1;
    if (/token|text|sequence|seq|length|position/.test(label)) {
      return Math.max(1, tokenCount);
    }
    if (/frame|time|step|duration/.test(label)) return Math.max(1, frames);
    if (/channel|mel_bins|n_mels/.test(label)) return melChannels;
    if (latentShape && latentShape[index] > 0) return latentShape[index];
    if (raw.length === 1) return Math.max(1, tokenCount);
    if (index === raw.length - 1) return Math.max(1, frames);
    if (index === 1 && /mel|spec|latent|sample|hidden|cond|feature/.test(name)) {
      return melChannels;
    }

    return 1;
  });

  if (result.some(dim => !Number.isInteger(dim) || dim < 1)) {
    throw new Error(`Invalid dynamic tensor shape: ${JSON.stringify(raw)}.`);
  }

  const numel = result.reduce((a, b) => a * b, 1);

  if (!Number.isSafeInteger(numel) || numel > 30_000_000) {
    throw new Error(`Model input shape is too large: ${result.join('×')} (${numel} values).`);
  }

  return result;
}

function product(shape) {
  return shape.reduce((a, b) => a * b, 1);
}

function typedArrayFor(type, valuesOrLength) {
  const values = typeof valuesOrLength === 'number' ? null : valuesOrLength;
  const length = values ? values.length : valuesOrLength;
  const source = values || null;
  const lower = String(type || 'float32').toLowerCase();

  let Constructor;

  if (lower.includes('int64') || lower === 'long') {
    Constructor = BigInt64Array;
  } else if (lower.includes('uint64')) {
    Constructor = BigInt64Array;
  } else if (lower.includes('uint32')) {
    Constructor = Uint32Array;
  } else if (lower.includes('int32')) {
    Constructor = Int32Array;
  } else if (lower.includes('uint16')) {
    Constructor = Uint16Array;
  } else if (lower.includes('int16')) {
    Constructor = Int16Array;
  } else if (lower.includes('uint8') || lower === 'bool') {
    Constructor = Uint8Array;
  } else if (lower.includes('int8')) {
    Constructor = Int8Array;
  } else if (lower.includes('float64') || lower === 'double') {
    Constructor = Float64Array;
  } else {
    Constructor = Float32Array;
  }

  if (!source) return new Constructor(length);

  if (Constructor === BigInt64Array) {
    return BigInt64Array.from(
      source,
      item => BigInt(Math.trunc(Number(item) || 0))
    );
  }

  return Constructor.from(source, item => Number(item) || 0);
}

function makeTensor(ort, meta, values, shape) {
  const type = String(meta?.type || 'float32').toLowerCase();
  const data = typedArrayFor(type, values);
  const dims = Array.isArray(shape) ? shape : [];

  if (product(dims) !== data.length) {
    throw new Error(
      `Input ${meta?.name || '(unnamed)'}: ${data.length} values do not match dimensions ${dims.join('×')}.`
    );
  }

  const tensorType =
    type === 'double' ? 'float64' :
    type === 'long' ? 'int64' :
    type;

  return new ort.Tensor(tensorType, data, dims);
}

function resizeFlat(source, length, { mode = 'linear' } = {}) {
  if (!source || !source.length) return new Float32Array(length);

  if (source.length === length) {
    return Float32Array.from(source, value => Number(value) || 0);
  }

  const out = new Float32Array(length);

  if (length === 1) {
    out[0] = Number(source[0]) || 0;
    return out;
  }

  for (let i = 0; i < length; i += 1) {
    const position = i * (source.length - 1) / (length - 1);

    if (mode === 'nearest') {
      out[i] = Number(source[Math.round(position)]) || 0;
    } else {
      const left = Math.floor(position);
      const right = Math.min(source.length - 1, left + 1);
      const frac = position - left;

      out[i] =
        (Number(source[left]) || 0) * (1 - frac) +
        (Number(source[right]) || 0) * frac;
    }
  }

  return out;
}

function copyTensorWithShape(ort, sourceTensor, targetMeta, targetShape) {
  if (!sourceTensor?.data) return null;

  const expected = product(targetShape);
  let data = sourceTensor.data;

  if (data.length !== expected) {
    // Dynamic time axes may differ between hemistich and model graph. Resampling
    // is allowed only for float features (mel/conditioning), never token IDs.
    const sourceType = String(sourceTensor.type || '').toLowerCase();
    const targetType = String(targetMeta?.type || 'float32').toLowerCase();

    if (!sourceType.includes('float') || !targetType.includes('float')) {
      return null;
    }

    data = resizeFlat(data, expected);
  }

  return makeTensor(ort, targetMeta, data, targetShape);
}

function vocabularyTokenize(inputText, tokenToId, { strict = false } = {}) {
  const tokens = [...tokenToId.keys()]
    .filter(token => token && token !== '<pad>' && token !== '[PAD]')
    .sort((a, b) => Array.from(b).length - Array.from(a).length);

  if (!tokens.length) {
    throwCoded('Token vocabulary खाली है।', 'BANK_VOCABULARY_EMPTY');
  }

  const unknownId =
    tokenToId.get('<unk>') ??
    tokenToId.get('[UNK]') ??
    tokenToId.get('UNK') ??
    tokenToId.get('<UNK>');

  const points = Array.from(String(inputText ?? '').normalize('NFC'));
  const ids = [];
  let index = 0;

  while (index < points.length) {
    if (/\s/u.test(points[index])) {
      index += 1;
      continue;
    }

    let matched = null;

    for (const token of tokens) {
      const tokenPoints = Array.from(token.normalize('NFC'));

      if (index + tokenPoints.length > points.length) continue;

      let okay = true;

      for (let j = 0; j < tokenPoints.length; j += 1) {
        if (points[index + j] !== tokenPoints[j]) {
          okay = false;
          break;
        }
      }

      if (okay) {
        matched = token;
        break;
      }
    }

    if (matched !== null) {
      ids.push(tokenToId.get(matched));
      index += Array.from(matched.normalize('NFC')).length;
      continue;
    }

    const current = points[index];

    // Ignore only punctuation separators; never discard letters, phonemes,
    // combining/vedic marks or digits without explicit vocabulary support.
    if (/[|।॥,.;:!?\-–—()[\]{}]/u.test(current)) {
      index += 1;
      continue;
    }

    if (!strict && unknownId !== undefined) {
      ids.push(unknownId);
      index += 1;
      continue;
    }

    throwCoded(
      `मॉडल vocabulary में अक्षर/phoneme "${current}" नहीं मिला। अनुमानित token ID का उपयोग नहीं किया गया।`,
      'TOKEN_NOT_IN_VOCABULARY',
      {
        character: current,
        index,
        input: points.slice(Math.max(0, index - 12), index + 24).join('')
      }
    );
  }

  if (!ids.length) {
    throwCoded('पाठ से कोई model token नहीं बना।', 'TOKENIZATION_EMPTY');
  }

  return ids;
}

function rankOf(tensor) {
  return Array.isArray(tensor?.dims) ? tensor.dims.length : 0;
}

function safeTensorNames(session, side) {
  const list = side === 'input' ? session.inputMetadata : session.outputMetadata;

  if (Array.isArray(list)) return list.map(meta => meta.name);

  return side === 'input'
    ? [...(session.inputNames || [])]
    : [...(session.outputNames || [])];
}

function metadataFor(session, side) {
  const listed = side === 'input' ? session.inputMetadata : session.outputMetadata;

  if (Array.isArray(listed) && listed.length) return listed;

  const names = safeTensorNames(session, side);

  return names.map(name => ({
    name,
    type: 'float32',
    shape: []
  }));
}

function roleFor(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');

  if (/token|phoneme|input_ids|text_ids|^ids$/.test(n)) return 'tokens';
  if (/position_ids|positions|^pos$/.test(n)) return 'positions';
  if (/length|len|seq_len|token_count/.test(n)) return 'length';
  if (/attention_mask|text_mask|token_mask|mask/.test(n)) return 'mask';
  if (/time|timestep|sigma|^t$|flow_step/.test(n)) return 'time';
  if (/mel|spectrogram|reference|prosody|template|bank|style/.test(n)) return 'reference';
  if (/latent|sample|noise|^x$|input_mel|hidden_state/.test(n)) return 'latent';
  if (/cond|context|embedding|text_enc|encoder|condition/.test(n)) return 'condition';
  if (/audio|wave|pcm|waveform/.test(n)) return 'audio';

  return 'unknown';
}

function bestOutputTensor(outputMap, inputMeta) {
  const outputItems = Object.entries(outputMap || {}).filter(
    ([, tensor]) => tensor?.data && ArrayBuffer.isView(tensor.data)
  );

  if (!outputItems.length) return null;

  const target = String(inputMeta?.name || '').toLowerCase();
  const aliases = target.split(/[^a-z0-9]+/).filter(part => part.length > 2);

  const named = outputItems.find(([name]) => {
    const lower = name.toLowerCase();
    return lower === target || aliases.some(alias => lower.includes(alias));
  });

  if (named) return named[1];

  const role = roleFor(target);

  const preferred = outputItems.find(([name, tensor]) => {
    const outRole = roleFor(name);

    return (
      (role === 'condition' &&
        ['condition', 'reference'].includes(outRole) &&
        rankOf(tensor) >= 2) ||
      (role === 'mask' && outRole === 'mask') ||
      (role === 'latent' && rankOf(tensor) >= 2)
    );
  });

  if (preferred) return preferred[1];

  return outputItems.find(([, tensor]) => rankOf(tensor) >= 2)?.[1] ||
    outputItems[0][1];
}

function deterministicRandom(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shapeTemplateToInput(values, meta, shape) {
  const targetN = product(shape);
  return resizeFlat(values, targetN);
}

function resolveBankTemplate(bank, bankBytes, meter) {
  const selected =
    findUnknownTemplateRecord(bank, meter) ||
    findUnknownTemplateRecord(bank, 'anustubh');

  if (!selected) {
    throwCoded(
      `baked_bank.json में "${meter}" या Anuṣṭubh reference नहीं मिला।`,
      'BANK_TEMPLATE_UNAVAILABLE',
      { meter }
    );
  }

  let values = collectNumericArray(selected.record);

  if ((!values || !values.length) && bankBytes) {
    values = readTemplateFromBinary(selected.record, bankBytes);
  }

  if (!values || !values.length) {
    // Some formats separate the `meters` index from a top-level packed tensor.
    const rootCandidate = collectNumericArray(bank);

    if (rootCandidate?.length > MEL_CHANNELS * 8) {
      values = rootCandidate;
    }
  }

  if (!values || !values.length) {
    throwCoded(
      `"${selected.path}" reference record मिला, लेकिन उसमें mel data या valid FP16 offset/length नहीं मिला।`,
      'BANK_TEMPLATE_DATA_UNAVAILABLE',
      {
        meter,
        recordPath: selected.path,
        keys: Object.keys(selected.record || {})
      }
    );
  }

  return {
    values: Float32Array.from(
      values,
      number => Number.isFinite(Number(number)) ? Number(number) : 0
    ),
    record: selected.record,
    path: selected.path
  };
}

function templateTensorForMeta(ort, meta, template, context) {
  const shape = resolvedShape(meta, context);
  const values = shapeTemplateToInput(template.values, meta, shape);

  return makeTensor(ort, meta, values, shape);
}

function onesForMeta(ort, meta, context, amount = 1) {
  const shape = resolvedShape(meta, context);
  const size = product(shape);

  return makeTensor(ort, meta, new Array(size).fill(amount), shape);
}

function scalarForMeta(ort, meta, value, context) {
  const shape = resolvedShape(meta, context);
  const size = Math.max(1, product(shape));

  return makeTensor(ort, meta, new Array(size).fill(value), shape);
}

function createWavBlob(samples, sampleRate = VAGDHENU_SAMPLE_RATE) {
  if (
    !(samples instanceof Float32Array) &&
    !ArrayBuffer.isView(samples) &&
    !Array.isArray(samples)
  ) {
    throwCoded('Vocoder ने Float32 PCM नहीं लौटाया।', 'INVALID_PCM');
  }

  const pcm = Float32Array.from(samples, value => Number(value) || 0);

  if (!pcm.length || pcm.length > MAX_AUDIO_SAMPLES) {
    throwCoded(
      `अमान्य PCM आकार: ${pcm.length} samples।`,
      'INVALID_PCM_LENGTH'
    );
  }

  let peak = 0;
  let sumSq = 0;

  for (let i = 0; i < pcm.length; i += 1) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    pcm[i] = v;
    peak = Math.max(peak, Math.abs(v));
    sumSq += v * v;
  }

  const rms = Math.sqrt(sumSq / pcm.length);

  if (peak < 1e-5 || rms < 1e-6) {
    throwCoded(
      'Vocoder output लगभग मौन है; इसे सफल गायन नहीं माना गया।',
      'SILENT_AUDIO',
      { samples: pcm.length, peak, rms }
    );
  }

  const bytesPerSample = 2;
  const dataLength = pcm.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const write = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;

  for (let i = 0; i < pcm.length; i += 1) {
    const value = pcm[i];

    view.setInt16(
      offset,
      value < 0 ? value * 0x8000 : value * 0x7fff,
      true
    );

    offset += 2;
  }

  return {
    blob: new Blob([buffer], { type: 'audio/wav' }),
    pcm,
    peak,
    rms
  };
}

function extractAudioTensor(outputs) {
  const entries = Object.entries(outputs || {}).filter(
    ([, tensor]) => tensor?.data && ArrayBuffer.isView(tensor.data)
  );

  if (!entries.length) {
    throwCoded(
      'Vocos model ने कोई typed tensor output नहीं लौटाया।',
      'VOCODER_OUTPUT_MISSING'
    );
  }

  const ranked = entries.sort((a, b) => {
    const roleA = roleFor(a[0]) === 'audio' ? 1 : 0;
    const roleB = roleFor(b[0]) === 'audio' ? 1 : 0;

    return roleB - roleA || b[1].data.length - a[1].data.length;
  });

  const [name, tensor] = ranked[0];

  if (!tensor.data.length) {
    throwCoded(
      `Vocoder output "${name}" खाली है।`,
      'VOCODER_OUTPUT_EMPTY'
    );
  }

  return {
    name,
    tensor,
    samples: Float32Array.from(tensor.data, Number)
  };
}

function modelSummary(session) {
  const summarize = list =>
    (Array.isArray(list) ? list : []).map(meta => ({
      name: meta.name,
      type: meta.type || 'unknown',
      shape: Array.isArray(meta.shape) ? [...meta.shape] : [],
      isTensor: meta.isTensor !== false
    }));

  return Object.freeze({
    inputs: summarize(session?.inputMetadata),
    outputs: summarize(session?.outputMetadata),
    inputNames: [...(session?.inputNames || [])],
    outputNames: [...(session?.outputNames || [])]
  });
}

function normalizeOptions(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};

  const requestedMeter = String(
    opts.meterKey ?? opts.meter ?? 'auto'
  ).trim();

  const meter =
    (!requestedMeter || requestedMeter.toLowerCase() === 'auto')
      ? 'auto'
      : canonicalMeter(requestedMeter);

  const nfe = Number(opts.nfe ?? DEFAULT_NFE);
  const cfg = Number(opts.cfg ?? 3.0);
  const speed = Number(opts.speed ?? 0.9);
  const seed = Number(opts.seed ?? 60);
  const swaySamplingCoef = Number(opts.swaySamplingCoef ?? -1);

  if (!Number.isInteger(nfe) || nfe < 1 || nfe > 24) {
    throwCoded('nfe 1 से 24 के बीच पूर्णांक होना चाहिए।', 'INVALID_NFE');
  }

  if (!Number.isFinite(cfg) || cfg < 0 || cfg > 20) {
    throwCoded('cfg 0 से 20 के बीच होना चाहिए।', 'INVALID_CFG');
  }

  if (!Number.isFinite(speed) || speed < 0.3 || speed > 2) {
    throwCoded('speed 0.3 से 2 के बीच होना चाहिए।', 'INVALID_SPEED');
  }

  if (!Number.isInteger(seed) || seed < 0 || seed > 0x7fffffff) {
    throwCoded(
      'seed non-negative 32-bit integer होना चाहिए।',
      'INVALID_SEED'
    );
  }

  if (
    !Number.isFinite(swaySamplingCoef) ||
    swaySamplingCoef < -2 ||
    swaySamplingCoef > 2
  ) {
    throwCoded(
      'swaySamplingCoef -2 से 2 के बीच होना चाहिए।',
      'INVALID_SWAY_COEF'
    );
  }

  const language = opts.language ?? opts.lang ?? 'auto';

  // Validate the explicit setting here; auto detection is resolved with text.
  normalizeTextLanguage(language, '');

  return {
    meter,
    nfe,
    cfg,
    speed,
    seed,
    swaySamplingCoef,
    language,
    noSandhi: Boolean(opts.noSandhi)
  };
}

export class VagdhenuWebEngine {
  constructor(canvas = null, backendMode = 'wasm', config = {}) {
    if (
      canvas &&
      typeof canvas === 'object' &&
      !('getContext' in canvas) &&
      (
        canvas.backend ||
        canvas.backendMode ||
        canvas.allowProviderFallback !== undefined
      )
    ) {
      config = canvas;
      canvas = config.canvas || null;
      backendMode = config.backendMode || config.backend || backendMode;
    }

    this.canvas = canvas;
    this.config = { allowProviderFallback: true, ...config };
    this.backendMode = normalizeBackend(
      backendMode || this.config.backend || 'wasm'
    );

    this.provider = this.backendMode === 'wasm' ? 'wasm' : 'webgpu';
    this.isWarmedUp = false;
    this._ort = null;
    this._sessions = null;
    this._bank = null;
    this._bankBytes = null;
    this._vocabulary = null;
    this._bankSource = null;
    this._initPromise = null;
    this._disposed = false;
    this._urls = new Set();
    this._lastInference = null;
    this._lastError = null;
  }

  getRuntimeInfo() {
    return Object.freeze({
      engine: 'Swar-Sadhika original Vāgdhenu ONNX bridge',
      version: VAGDHENU_ENGINE_VERSION,
      supportedTextLanguages: [...SUPPORTED_TEXT_LANGUAGES],
      acceptedLanguageOption: 'options.language (vedic-sanskrit | sanskrit | hindi | auto)',
      backend: this.backendMode,
      provider: this.provider,
      initialized: Boolean(this._sessions),
      modelsLoaded: Boolean(
        this._sessions &&
        this._sessions.conditioner &&
        this._sessions.dit &&
        this._sessions.vocoder
      ),
      modelSignatures: this._sessions
        ? {
            conditioner: modelSummary(this._sessions.conditioner),
            dit: modelSummary(this._sessions.dit),
            vocoder: modelSummary(this._sessions.vocoder)
          }
        : null,
      vocabularyLoaded: Boolean(this._vocabulary?.tokenToId?.size),
      referenceBankLoaded: Boolean(this._bank && this._bankBytes),
      bankSource: this._bankSource || null,
      lastInference: this._lastInference,
      lastError: this._lastError,
      remoteTtsApi: false,
      localInferenceVerified: Boolean(
        this._lastInference?.modelStagesCompleted
      ),
      offlineInferenceVerified: false,
      runtimeUrl: `${ORT_BASE}ort.all.min.js`,
      modelRepository: getModelBase(this.backendMode)
    });
  }

  async setBackendMode(mode) {
    this._assertActive();

    const backend = normalizeBackend(mode);

    if (backend === this.backendMode) {
      return { ok: true, backend, unchanged: true };
    }

    await this._releaseSessions();

    this.backendMode = backend;
    this.provider = backend === 'wasm' ? 'wasm' : 'webgpu';
    this.isWarmedUp = false;
    this._bank = null;
    this._bankBytes = null;
    this._vocabulary = null;
    this._bankSource = null;

    return { ok: true, backend, unchanged: false };
  }

  _assertActive() {
    if (this._disposed) {
      throwCoded(
        'इस engine instance को dispose किया जा चुका है।',
        'ENGINE_DISPOSED'
      );
    }
  }

  async _loadBank(progressCallback) {
    const base = getModelBase(this.backendMode);

    emit(progressCallback, {
      stage: 'bank',
      progress: 0.02,
      message: 'आधिकारिक मॉडल bank और उसके अनुरूप token vocabulary लोड हो रही है।'
    });

    const officialBankUrl = new URL(VAGDHENU_ASSET_FILES.bank, base).href;
    const localBankUrl = new URL('../../baked_bank.json', import.meta.url).href;
    const binaryUrl = new URL(VAGDHENU_ASSET_FILES.bankBinary, base).href;

    // The model JSON and binary bank must come from the same repository
    // whenever possible. Download concurrently to avoid unnecessary delay.
    const [binaryOutcome, officialOutcome] = await Promise.allSettled([
      fetchChecked(binaryUrl, VAGDHENU_ASSET_FILES.bankBinary),
      loadBankJsonCandidate(officialBankUrl, 'आधिकारिक मॉडल baked_bank.json')
    ]);

    if (binaryOutcome.status === 'rejected') {
      throw binaryOutcome.reason;
    }

    const bankBytes = await binaryOutcome.value.arrayBuffer();
    if (bankBytes.byteLength < 1024) {
      throwCoded(
        `baked_bank.bin बहुत छोटा है (${bankBytes.byteLength} bytes)।`,
        'BANK_BINARY_INVALID',
        { url: binaryUrl, byteLength: bankBytes.byteLength }
      );
    }

    const failures = [];
    let selected = null;

    if (officialOutcome.status === 'fulfilled') {
      try {
        validateBankBinaryReferences(
          officialOutcome.value.bank,
          bankBytes.byteLength,
          'आधिकारिक मॉडल baked_bank.json'
        );
        selected = {
          ...officialOutcome.value,
          source: 'official-model-repository'
        };
      } catch (error) {
        failures.push({
          source: 'official-model-repository',
          code: error?.code || 'BANK_VALIDATION_FAILED',
          message: messageOf(error)
        });
      }
    } else {
      failures.push({
        source: 'official-model-repository',
        code: officialOutcome.reason?.code || 'BANK_FETCH_FAILED',
        message: messageOf(officialOutcome.reason)
      });
    }

    // The app-root copy is a recovery path only, never an unconditional
    // override. It must contain a recognized 1,039-ID vocabulary and its
    // explicit binary offsets must fit the already-loaded official bank.
    if (!selected) {
      try {
        const localCandidate = await loadBankJsonCandidate(
          localBankUrl,
          'स्थानीय fallback baked_bank.json'
        );
        validateBankBinaryReferences(
          localCandidate.bank,
          bankBytes.byteLength,
          'स्थानीय fallback baked_bank.json'
        );
        selected = { ...localCandidate, source: 'validated-local-fallback' };
      } catch (error) {
        failures.push({
          source: 'validated-local-fallback',
          code: error?.code || 'LOCAL_BANK_VALIDATION_FAILED',
          message: messageOf(error),
          details: error?.details
        });
      }
    }

    if (!selected) {
      throwCoded(
        'आधिकारिक और स्थानीय दोनों baked_bank.json विकल्प मॉडल vocabulary के साथ सत्यापित नहीं हो सके। अनुमानित token IDs इस्तेमाल नहीं किए गए और synthesis रोक दी गई।',
        'BANK_VOCABULARY_UNAVAILABLE',
        {
          modelRepository: base,
          expectedVocabularySize: VOCAB_SIZE,
          attemptedSources: failures
        }
      );
    }

    this._bank = selected.bank;
    this._bankBytes = bankBytes;
    this._vocabulary = selected.vocabulary;
    this._bankSource = selected.source;

    emit(progressCallback, {
      stage: 'bank',
      progress: 0.06,
      message: `Prosody bank तैयार (${selected.vocabulary.tokenToId.size} vocabulary entries; स्रोत: ${selected.source === 'official-model-repository' ? 'आधिकारिक मॉडल रिपॉज़िटरी' : 'सत्यापित स्थानीय fallback'})।`
    });
  }

  async _createSession(key, fileName, progressCallback, index, total) {
    const base = getModelBase(this.backendMode);
    const url = new URL(fileName, base).href;

    emit(progressCallback, {
      stage: 'model-session',
      progress: 0.06 + 0.18 * (index / total),
      model: key,
      message: `ONNX model session बन रहा है: ${fileName}`
    });

    const providers = this.backendMode === 'onnx' ? ['webgpu'] : ['wasm'];

    try {
      return await this._ort.InferenceSession.create(url, {
        executionProviders: providers,
        graphOptimizationLevel: 'all',
        executionMode: 'sequential',
        logSeverityLevel: 3
      });
    } catch (firstError) {
      if (
        this.backendMode === 'onnx' &&
        this.config.allowProviderFallback !== false
      ) {
        console.warn(
          `[Swar-Sadhika] WebGPU session failed for ${fileName}; retrying with WASM.`,
          firstError
        );

        emit(progressCallback, {
          stage: 'provider-fallback',
          progress: 0.06 + 0.18 * (index / total),
          model: key,
          message: `WebGPU उपलब्ध नहीं; ${fileName} को WASM पर आज़माया जा रहा है।`
        });

        try {
          const session = await this._ort.InferenceSession.create(url, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            executionMode: 'sequential',
            logSeverityLevel: 3
          });

          this.provider = 'wasm-fallback';

          return session;
        } catch (fallbackError) {
          throwCoded(
            `${fileName}: WebGPU और WASM दोनों पर session नहीं बना।`,
            'MODEL_SESSION_FAILED',
            {
              model: key,
              url,
              backend: this.backendMode,
              webgpuError: messageOf(firstError),
              wasmError: messageOf(fallbackError)
            },
            fallbackError
          );
        }
      }

      throwCoded(
        `${fileName}: ONNX session नहीं बना (${messageOf(firstError)})`,
        'MODEL_SESSION_FAILED',
        { model: key, url, backend: this.backendMode },
        firstError
      );
    }
  }

  async initOnnxSessions(progressCallback = null) {
    this._assertActive();

    if (
      progressCallback != null &&
      typeof progressCallback !== 'function'
    ) {
      throwCoded(
        'progressCallback function होना चाहिए।',
        'INVALID_CALLBACK'
      );
    }

    if (this._sessions) {
      return {
        ok: true,
        initialized: true,
        provider: this.provider,
        cached: true,
        signatures: this.getRuntimeInfo().modelSignatures
      };
    }

    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      emit(progressCallback, {
        stage: 'runtime',
        progress: 0,
        message: `ONNX Runtime Web ${ORT_VERSION} शुरू हो रहा है।`
      });

      this._ort = await loadOrtRuntime();
      await this._loadBank(progressCallback);

      const names = [
        ['conditioner', VAGDHENU_ASSET_FILES.conditioner],
        ['dit', VAGDHENU_ASSET_FILES.dit],
        ['vocoder', VAGDHENU_ASSET_FILES.vocoder]
      ];

      const opened = {};

      try {
        for (let i = 0; i < names.length; i += 1) {
          const [key, file] = names[i];

          opened[key] = await this._createSession(
            key,
            file,
            progressCallback,
            i,
            names.length
          );

          const summary = modelSummary(opened[key]);

          if (!summary.inputs.length || !summary.outputs.length) {
            throwCoded(
              `${file}: ONNX Runtime ने वास्तविक input/output metadata नहीं दिया।`,
              'MODEL_SIGNATURE_MISSING',
              { model: key, summary }
            );
          }

          emit(progressCallback, {
            stage: 'model-session',
            progress: 0.24 + 0.23 * ((i + 1) / names.length),
            model: key,
            message: `${file}: ${summary.inputs.length} inputs और ${summary.outputs.length} outputs मिले।`
          });
        }

        this._sessions = opened;
        this.isWarmedUp = true;

        const info = this.getRuntimeInfo();

        emit(progressCallback, {
          stage: 'ready',
          progress: 0.48,
          provider: this.provider,
          message: 'तीनों ONNX sessions और prosody bank लोड हुए; वास्तविक text-to-audio inference अभी अलग से चलेगा।'
        });

        return {
          ok: true,
          initialized: true,
          provider: this.provider,
          signatures: info.modelSignatures,
          vocabularyEntries: this._vocabulary.tokenToId.size
        };
      } catch (error) {
        await Promise.all(
          Object.values(opened).map(session =>
            session?.release?.().catch(() => {})
          )
        );

        this._sessions = null;
        this.isWarmedUp = false;

        this._lastError = {
          stage: 'initialization',
          code: error.code || 'INITIALIZATION_FAILED',
          message: messageOf(error)
        };

        throw error;
      }
    })();

    try {
      return await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  _prepareText(sourceText, options) {
    const original = String(sourceText ?? '')
      .replace(/\r\n?/g, '\n')
      .trim();

    if (!original) {
      throwCoded(
        'कृपया वैदिक संस्कृत, संस्कृत या हिंदी पाठ लिखें।',
        'EMPTY_TEXT'
      );
    }

    if (original.length > MAX_TEXT_CHARS) {
      throwCoded(
        `पाठ बहुत लंबा है (${original.length} characters); कृपया एक श्लोक/छोटा खंड दें।`,
        'TEXT_TOO_LONG'
      );
    }

    const prepared = prepareLanguageInput(
      original,
      options?.language ?? options?.lang ?? 'auto',
      this._vocabulary.tokenToId
    );

    const scan =
      TextModule.analyzeVerse?.(prepared.clean, { meter: options?.meter }) ??
      null;

    const meter =
      options?.meter === 'anustubh' && scan?.meter?.key
        ? canonicalMeter(scan.meter.key)
        : options?.meter;

    const pieces = TextModule.preparePieces?.(prepared.clean, { meter }) ?? [];

    return {
      ...prepared,
      tokenIds: prepared.tokenIds,
      meter,
      scansion: scan,
      pieces
    };
  }

  _getTemplate(meter) {
    return resolveBankTemplate(this._bank, this._bankBytes, meter);
  }

  _conditionerFeeds(meta, context, tokenIds, template) {
    const feeds = {};
    const missing = [];

    for (const input of metadataFor(this._sessions.conditioner, 'input')) {
      const role = roleFor(input.name);

      if (role === 'tokens') {
        const shape = resolvedShape(input, {
          ...context,
          tokenCount: tokenIds.length
        });

        const values = new Array(product(shape));

        for (let i = 0; i < values.length; i += 1) {
          values[i] = tokenIds[Math.min(i, tokenIds.length - 1)];
        }

        feeds[input.name] = makeTensor(this._ort, input, values, shape);
      } else if (role === 'positions') {
        const shape = resolvedShape(input, {
          ...context,
          tokenCount: tokenIds.length
        });

        feeds[input.name] = makeTensor(
          this._ort,
          input,
          Array.from({ length: product(shape) }, (_, i) => i),
          shape
        );
      } else if (role === 'length') {
        feeds[input.name] = scalarForMeta(
          this._ort,
          input,
          tokenIds.length,
          context
        );
      } else if (role === 'mask') {
        feeds[input.name] = onesForMeta(
          this._ort,
          input,
          { ...context, tokenCount: tokenIds.length },
          1
        );
      } else if (role === 'reference') {
        feeds[input.name] = templateTensorForMeta(
          this._ort,
          input,
          template,
          context
        );
      } else {
        // Some export graphs call token IDs
        // For graphs where the name is generic, the integer tensor is likely
        // the token sequence, while rank-3 float tensors are reference features.
        if (
          /int|uint|long|bool/i.test(String(input.type || '')) &&
          shapeOf(input).length >= 1
        ) {
          const shape = resolvedShape(input, {
            ...context,
            tokenCount: tokenIds.length
          });

          const values = Array.from(
            { length: product(shape) },
            (_, i) => tokenIds[Math.min(i, tokenIds.length - 1)]
          );

          feeds[input.name] = makeTensor(this._ort, input, values, shape);
        } else if (
          shapeOf(input).length >= 3 &&
          /float/i.test(String(input.type || ''))
        ) {
          feeds[input.name] = templateTensorForMeta(
            this._ort,
            input,
            template,
            context
          );
        } else if (/speed|pace/i.test(input.name)) {
          feeds[input.name] = scalarForMeta(
            this._ort,
            input,
            context.speed || 0.9,
            context
          );
        } else {
          missing.push({
            name: input.name,
            type: input.type,
            shape: shapeOf(input),
            role
          });
        }
      }
    }

    if (missing.length) {
      throwCoded(
        'Conditioner graph के कुछ inputs अर्थपूर्ण रूप से map नहीं हो सके; कोई मनगढ़ंत tensor नहीं दिया गया।',
        'CONDITIONER_INPUT_CONTRACT_UNKNOWN',
        {
          missing,
          available: metadataFor(this._sessions.conditioner, 'input').map(item => ({
            name: item.name,
            type: item.type,
            shape: shapeOf(item)
          }))
        }
      );
    }

    return feeds;
  }

  _pickLatentInput() {
    const inputs = metadataFor(this._sessions.dit, 'input');

    const ranked = inputs
      .map(meta => ({
        meta,
        role: roleFor(meta.name),
        rank: shapeOf(meta).length
      }))
      .filter(item =>
        item.rank >= 2 &&
        /float/i.test(String(item.meta.type || 'float32'))
      );

    return (
      ranked.find(item => item.role === 'latent')?.meta ||
      ranked.find(item =>
        /^(x|sample|noise|latents?)$/i.test(item.meta.name)
      )?.meta ||
      ranked[0]?.meta ||
      null
    );
  }

  _conditionTensorFor(
    inputMeta,
    conditionerOutputs,
    context,
    { unconditional = false } = {}
  ) {
    const shape = resolvedShape(inputMeta, context);
    const exact = conditionerOutputs?.[inputMeta.name];

    let source = exact;

    if (!source) source = bestOutputTensor(conditionerOutputs, inputMeta);

    if (unconditional) {
      const size = product(shape);
      return makeTensor(this._ort, inputMeta, new Array(size).fill(0), shape);
    }

    if (source) {
      const copied = copyTensorWithShape(this._ort, source, inputMeta, shape);
      if (copied) return copied;
    }

    return null;
  }

  _ditFeeds(
    latentMeta,
    latentTensor,
    t,
    conditionerOutputs,
    context,
    { unconditional = false } = {}
  ) {
    const feeds = {};
    const missing = [];

    for (const input of metadataFor(this._sessions.dit, 'input')) {
      const role = roleFor(input.name);
      const name = String(input.name || '').toLowerCase();

      if (
        input.name === latentMeta.name ||
        role === 'latent' ||
        /^(x|sample|noise|latents?)$/i.test(name)
      ) {
        const shape = resolvedShape(input, {
          ...context,
          latentShape: latentTensor.dims,
          frames: latentTensor.dims.at(-1) || context.frames
        });

        const tensor = copyTensorWithShape(
          this._ort,
          latentTensor,
          input,
          shape
        );

        if (!tensor) {
          missing.push({
            name: input.name,
            type: input.type,
            shape,
            role,
            reason: 'latent shape/type mismatch'
          });
        } else {
          feeds[input.name] = tensor;
        }
      } else if (role === 'time') {
        feeds[input.name] = scalarForMeta(this._ort, input, t, context);
      } else if (role === 'length') {
        feeds[input.name] = scalarForMeta(
          this._ort,
          input,
          latentTensor.dims.at(-1) || context.frames,
          context
        );
      } else if (role === 'mask') {
        const cond = unconditional
          ? null
          : this._conditionTensorFor(input, conditionerOutputs, context);

        feeds[input.name] = cond || onesForMeta(this._ort, input, context, 1);
      } else if (role === 'condition' || role === 'reference') {
        const tensor = this._conditionTensorFor(
          input,
          conditionerOutputs,
          context,
          { unconditional }
        );

        if (!tensor) {
          missing.push({
            name: input.name,
            type: input.type,
            shape: shapeOf(input),
            role,
            reason: 'no compatible conditioner output'
          });
        } else {
          feeds[input.name] = tensor;
        }
      } else {
        const sameName = conditionerOutputs?.[input.name];

        const tensor = sameName
          ? copyTensorWithShape(
              this._ort,
              sameName,
              input,
              resolvedShape(input, context)
            )
          : null;

        if (tensor) {
          feeds[input.name] = tensor;
        } else {
          missing.push({
            name: input.name,
            type: input.type,
            shape: shapeOf(input),
            role,
            reason: 'input name is not mapped to a known semantic role'
          });
        }
      }
    }

    if (missing.length) {
      throwCoded(
        'DiT graph के वास्तविक inputs उपलब्ध metadata से सुरक्षित रूप से map नहीं हो सके।',
        'DIT_INPUT_CONTRACT_UNKNOWN',
        {
          missing,
          inputs: metadataFor(this._sessions.dit, 'input').map(item => ({
            name: item.name,
            type: item.type,
            shape: shapeOf(item)
          })),
          conditionerOutputs: Object.keys(conditionerOutputs || {})
        }
      );
    }

    return feeds;
  }

  _chooseVelocity(outputs, latentTensor) {
    const entries = Object.entries(outputs || {}).filter(
      ([, tensor]) => tensor?.data && ArrayBuffer.isView(tensor.data)
    );

    if (!entries.length) {
      throwCoded('DiT ने कोई typed tensor output नहीं लौटाया।', 'DIT_OUTPUT_MISSING');
    }

    const named = entries.find(([name]) =>
      /velocity|flow|v_pred|model_output|noise_pred|predicted_noise|sample|latent|out/i.test(name)
    );

    const candidates = entries.filter(
      ([, tensor]) => tensor.data.length === latentTensor.data.length
    );

    const picked =
      (named && named[1].data.length === latentTensor.data.length ? named : null) ||
      candidates.sort((a, b) => b[1].data.length - a[1].data.length)[0];

    if (!picked) {
      throwCoded(
        'DiT output का आकार latent से मेल नहीं खाता; flow update असुरक्षित होगा।',
        'DIT_OUTPUT_SHAPE_MISMATCH',
        {
          latentDims: latentTensor.dims,
          latentLength: latentTensor.data.length,
          outputs: entries.map(([name, tensor]) => ({
            name,
            dims: tensor.dims,
            length: tensor.data.length
          }))
        }
      );
    }

    return {
      name: picked[0],
      tensor: picked[1],
      values: Float32Array.from(picked[1].data, Number)
    };
  }

  _makeInitialNoise(meta, context, seed) {
    const shape = resolvedShape(meta, context);
    const count = product(shape);
    const random = deterministicRandom(seed);
    const values = new Float32Array(count);

    // Gaussian noise via Box–Muller, generated locally and deterministically.
    for (let i = 0; i < count; i += 2) {
      const u1 = Math.max(random(), 1e-7);
      const u2 = random();
      const radius = Math.sqrt(-2 * Math.log(u1));

      values[i] = radius * Math.cos(2 * Math.PI * u2);

      if (i + 1 < count) {
        values[i + 1] = radius * Math.sin(2 * Math.PI * u2);
      }
    }

    return makeTensor(this._ort, meta, values, shape);
  }

  async _runConditioner(
    context,
    tokenIds,
    template,
    progressCallback,
    index,
    total
  ) {
    const session = this._sessions.conditioner;
    const feeds = this._conditionerFeeds(null, context, tokenIds, template);

    emit(progressCallback, {
      stage: 'conditioner',
      progress: 0.48 + 0.08 * (index / total),
      message: `खंड ${index + 1}/${total}: text/prosody conditioning चल रहा है।`
    });

    let outputs;

    try {
      outputs = await session.run(feeds);
    } catch (error) {
      throwCoded(
        `Conditioner inference विफल: ${messageOf(error)}`,
        'CONDITIONER_INFERENCE_FAILED',
        { inputs: Object.keys(feeds) },
        error
      );
    }

    if (!outputs || !Object.keys(outputs).length) {
      throwCoded('Conditioner ने कोई output नहीं लौटाया।', 'CONDITIONER_OUTPUT_EMPTY');
    }

    return outputs;
  }

  async _runDiffusion(
    context,
    conditionerOutputs,
    progressCallback,
    segmentIndex,
    segmentCount
  ) {
    const session = this._sessions.dit;
    const latentMeta = this._pickLatentInput();

    if (!latentMeta) {
      throwCoded(
        'DiT graph में पहचानने योग्य floating-point latent input नहीं मिला।',
        'DIT_LATENT_INPUT_MISSING',
        {
          inputs: metadataFor(session, 'input').map(item => ({
            name: item.name,
            type: item.type,
            shape: shapeOf(item)
          }))
        }
      );
    }

    const latentShape = resolvedShape(latentMeta, context);

    const latentInput = this._makeInitialNoise(
      latentMeta,
      { ...context, latentShape },
      context.seed + segmentIndex * 104729
    );

    let latent = latentInput;

    const metaNames = metadataFor(session, 'input').map(item => item.name);

    const hasConditionInput = metadataFor(session, 'input').some(item =>
      ['condition', 'reference'].includes(roleFor(item.name))
    );

    const useGuidance = context.cfg > 0 && hasConditionInput;

    const flowTimes = Array.from(
      { length: context.nfe + 1 },
      (_, index) => {
        const base = index / context.nfe;

        // Sway sampling used by flow-matching TTS systems: retain endpoints while
        // allocating more integration resolution to the curved portions of time.
        const shifted =
          base +
          context.swaySamplingCoef *
            (Math.cos(Math.PI * base / 2) - 1 + base);

        return Math.min(1, Math.max(0, shifted));
      }
    );

    for (let step = 0; step < context.nfe; step += 1) {
      const t = flowTimes[step];

      const conditionalFeeds = this._ditFeeds(
        latentMeta,
        latent,
        t,
        conditionerOutputs,
        {
          ...context,
          latentShape,
          frames: latent.dims.at(-1) || context.frames
        }
      );

      let conditional;

      try {
        conditional = this._chooseVelocity(
          await session.run(conditionalFeeds),
          latent
        );
      } catch (error) {
        if (error?.code) throw error;

        throwCoded(
          `DiT flow-step ${step + 1}/${context.nfe} विफल: ${messageOf(error)}`,
          'DIT_INFERENCE_FAILED',
          {
            step: step + 1,
            nfe: context.nfe,
            inputNames: metaNames
          },
          error
        );
      }

      let velocity = conditional.values;

      if (useGuidance) {
        const unconditionalFeeds = this._ditFeeds(
          latentMeta,
          latent,
          t,
          conditionerOutputs,
          {
            ...context,
            latentShape,
            frames: latent.dims.at(-1) || context.frames
          },
          { unconditional: true }
        );

        let unconditional;

        try {
          unconditional = this._chooseVelocity(
            await session.run(unconditionalFeeds),
            latent
          );
        } catch (error) {
          throwCoded(
            `Classifier-free guidance का unconditioned pass विफल: ${messageOf(error)}`,
            'DIT_GUIDANCE_FAILED',
            { step: step + 1 },
            error
          );
        }

        const guided = new Float32Array(velocity.length);

        for (let i = 0; i < guided.length; i += 1) {
          guided[i] =
            unconditional.values[i] +
            context.cfg * (conditional.values[i] - unconditional.values[i]);
        }

        velocity = guided;
      }

      const nextData = new Float32Array(latent.data.length);
      const dt = Math.max(0, flowTimes[step + 1] - flowTimes[step]);

      for (let i = 0; i < nextData.length; i += 1) {
        nextData[i] = Number(latent.data[i]) + velocity[i] * dt;
      }

      latent = new this._ort.Tensor(
        'float32',
        nextData,
        [...latent.dims]
      );

      emit(progressCallback, {
        stage: 'flow-matching',
        progress:
          0.56 +
          0.28 *
            ((segmentIndex + (step + 1) / context.nfe) / segmentCount),
        segment: segmentIndex + 1,
        segmentCount,
        step: step + 1,
        nfe: context.nfe,
        message: `Flow-matching ${step + 1}/${context.nfe} · खंड ${segmentIndex + 1}/${segmentCount}`
      });
    }

    return latent;
  }

  _vocoderFeeds(melTensor, context) {
    const feeds = {};
    const missing = [];

    for (const input of metadataFor(this._sessions.vocoder, 'input')) {
      const role = roleFor(input.name);

      if (
        role === 'latent' ||
        role === 'reference' ||
        /^(mel|spec|spectrogram|features|x)$/i.test(input.name)
      ) {
        const shape = resolvedShape(input, {
          ...context,
          latentShape: melTensor.dims,
          frames: melTensor.dims.at(-1) || context.frames
        });

        const tensor = copyTensorWithShape(
          this._ort,
          melTensor,
          input,
          shape
        );

        if (tensor) {
          feeds[input.name] = tensor;
        } else {
          missing.push({
            name: input.name,
            role,
            shape,
            reason: 'final mel shape mismatch'
          });
        }
      } else if (role === 'length') {
        feeds[input.name] = scalarForMeta(
          this._ort,
          input,
          melTensor.dims.at(-1) || context.frames,
          context
        );
      } else if (role === 'mask') {
        feeds[input.name] = onesForMeta(this._ort, input, context, 1);
      } else {
        missing.push({
          name: input.name,
          type: input.type,
          shape: shapeOf(input),
          role
        });
      }
    }

    if (missing.length) {
      throwCoded(
        'Vocos graph के inputs अंतिम mel tensor से मेल नहीं खाते।',
        'VOCODER_INPUT_CONTRACT_UNKNOWN',
        {
          missing,
          inputs: metadataFor(this._sessions.vocoder, 'input').map(item => ({
            name: item.name,
            type: item.type,
            shape: shapeOf(item)
          }))
        }
      );
    }

    return feeds;
  }

  async _runVocoder(melTensor, context, progressCallback, index, total) {
    emit(progressCallback, {
      stage: 'vocoder',
      progress: 0.86 + 0.04 * (index / total),
      message: `खंड ${index + 1}/${total}: 24 kHz waveform बन रहा है।`
    });

    let outputs;

    try {
      outputs = await this._sessions.vocoder.run(
        this._vocoderFeeds(melTensor, context)
      );
    } catch (error) {
      throwCoded(
        `Vocos vocoder inference विफल: ${messageOf(error)}`,
        'VOCODER_INFERENCE_FAILED',
        undefined,
        error
      );
    }

    return extractAudioTensor(outputs);
  }

  _splitForSynthesis(text, meter) {
    let padas = [];

    try {
      padas = TextModule.splitPadas?.(text) || [];
    } catch {
      /* use one segment */
    }

    padas = padas
      .map(item => String(item).trim())
      .filter(Boolean);

    // A traditional four-pāda verse is synthesized as two hemistichs. For an
    // unknown/short form, keep the entire user passage together to avoid
    // forcing a meter or silently deleting any text.
    if (padas.length >= 4) {
      const first = padas.slice(0, 2).join(' । ');
      const second = padas.slice(2, 4).join(' । ');
      const extra = padas.slice(4);

      return [
        first,
        second,
        ...(extra.length ? [extra.join(' । ')] : [])
      ].filter(Boolean);
    }

    return [text];
  }

  async synthesizeInBrowser(text, options = {}, progressCallback = null) {
    this._assertActive();

    const source = Array.isArray(text)
      ? text.map(String).join('\n')
      : String(text ?? '');

    const opts = normalizeOptions(options);

    if (!this._sessions) {
      await this.initOnnxSessions(progressCallback);
    }

    const startedAt = performance.now();

    const normalized =
      TextModule.prepareTtsTextWithoutMutation?.(source) ?? source.trim();

    if (!normalized) {
      throwCoded('पाठ खाली है।', 'EMPTY_TEXT');
    }

    if (normalized.length > MAX_TEXT_CHARS) {
      throwCoded(
        `पाठ ${MAX_TEXT_CHARS} characters से अधिक है।`,
        'TEXT_TOO_LONG'
      );
    }

    const language = normalizeTextLanguage(opts.language, normalized);
    const scan = TextModule.analyzeVerse?.(normalized) ?? null;

    let meter = opts.meter;

    if (!meter || meter === 'auto') {
      const meterValue =
        scan?.meter?.key ??
        scan?.meter?.name ??
        scan?.meter ??
        scan?.chandas;

      const detected = TextModule.detectMeterKey?.(meterValue);
      meter = detected || 'anustubh';
    }

    const segments = this._splitForSynthesis(normalized, meter);

    if (!segments.length) {
      throwCoded(
        'पाठ को गायन खंडों में विभाजित नहीं किया जा सका।',
        'TEXT_SEGMENTATION_FAILED'
      );
    }

    const template = this._getTemplate(meter);
    const segmentsPcm = [];
    const stageEvidence = [];

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];

      const preparedSegment = prepareLanguageInput(
        segment,
        language,
        this._vocabulary.tokenToId
      );

      const tokenIds = preparedSegment.tokenIds;

      const frames = Math.max(
        64,
        Math.min(4096, Math.ceil(tokenIds.length * 8 / opts.speed))
      );

      const context = {
        meter,
        nfe: opts.nfe,
        cfg: opts.cfg,
        speed: opts.speed,
        seed: opts.seed + index,
        swaySamplingCoef: opts.swaySamplingCoef,
        tokenCount: tokenIds.length,
        frames,
        melChannels: MEL_CHANNELS,
        noSandhi: opts.noSandhi
      };

      const conditionerOutputs = await this._runConditioner(
        context,
        tokenIds,
        template,
        progressCallback,
        index,
        segments.length
      );

      const finalMel = await this._runDiffusion(
        context,
        conditionerOutputs,
        progressCallback,
        index,
        segments.length
      );

      const audioResult = await this._runVocoder(
        finalMel,
        context,
        progressCallback,
        index,
        segments.length
      );

      if (!audioResult.samples.length) {
        throwCoded(
          `खंड ${index + 1} का waveform खाली है।`,
          'EMPTY_SEGMENT_AUDIO'
        );
      }

      segmentsPcm.push(audioResult.samples);

      stageEvidence.push({
        segment: index + 1,
        language,
        inputRepresentation: preparedSegment.inputRepresentation,
        tokenCount: tokenIds.length,
        melDims: [...finalMel.dims],
        vocoderOutputName: audioResult.name,
        audioSamples: audioResult.samples.length,
        peak: Math.max(
          ...audioResult.samples
            .slice(0, Math.min(8192, audioResult.samples.length))
            .map(value => Math.abs(Number(value) || 0))
        )
      });
    }

    const silenceFrames =
      segmentsPcm.length > 1
        ? Math.round(VAGDHENU_SAMPLE_RATE * 0.12)
        : 0;

    const totalSamples =
      segmentsPcm.reduce((sum, samples) => sum + samples.length, 0) +
      silenceFrames * Math.max(0, segmentsPcm.length - 1);

    if (totalSamples > MAX_AUDIO_SAMPLES) {
      throwCoded(
        'संयुक्त ऑडियो 180 सेकंड से अधिक है। कृपया पाठ को छोटे भागों में दें।',
        'AUDIO_TOO_LONG',
        { totalSamples }
      );
    }

    const pcm = new Float32Array(totalSamples);
    let position = 0;

    segmentsPcm.forEach((samples, index) => {
      pcm.set(samples, position);
      position += samples.length;

      if (index !== segmentsPcm.length - 1 && silenceFrames) {
        position += silenceFrames;
      }
    });

    const wav = createWavBlob(pcm, VAGDHENU_SAMPLE_RATE);
    const url = URL.createObjectURL(wav.blob);

    this._urls.add(url);

    const elapsedMs = Math.round(performance.now() - startedAt);

    this._lastInference = Object.freeze({
      at: new Date().toISOString(),
      elapsedMs,
      backend: this.backendMode,
      provider: this.provider,
      language,
      modelStagesCompleted:
        ['conditioner', 'dit-flow-matching', 'vocos'].every(
          stage => stageEvidence.length > 0
        ),
      segments: stageEvidence,
      sampleRate: VAGDHENU_SAMPLE_RATE,
      samples: pcm.length,
      durationSeconds: Number(
        (pcm.length / VAGDHENU_SAMPLE_RATE).toFixed(3)
      ),
      peak: wav.peak,
      rms: wav.rms,
      note: 'Model graph outputs were processed into a WAV container. Listening/phoneme quality and offline mode require device-level verification.'
    });

    this._lastError = null;
    this.provider = this.provider || (
      this.backendMode === 'wasm' ? 'wasm' : 'webgpu'
    );

    emit(progressCallback, {
      stage: 'complete',
      progress: 1,
      message: `मॉडल inference ने ${this._lastInference.durationSeconds}s ऑडियो बनाया। इसे सुनकर उच्चारण और गुणवत्ता जाँचें।`,
      elapsedMs,
      durationSeconds: this._lastInference.durationSeconds
    });

    return {
      url,
      audioUrl: url,
      blob: wav.blob,
      wav: wav.blob,
      pcm,
      sampleRate: VAGDHENU_SAMPLE_RATE,
      metadata: {
        engine: VAGDHENU_ENGINE_VERSION,
        backend: this.backendMode,
        provider: this.provider,
        meter,
        language,
        originalText: normalized,
        modelInputText: segments
          .map(segment =>
            prepareLanguageInput(
              segment,
              language,
              this._vocabulary.tokenToId
            ).modelInputText
          )
          .join('\n'),
        inputRepresentations: [
          ...new Set(stageEvidence.map(item => item.inputRepresentation))
        ],
        elapsedMs,
        durationSeconds: this._lastInference.durationSeconds,
        modelStages: ['conditioner', 'dit-flow-matching', 'vocos'],
        segmentCount: segments.length,
        verifiedOffline: false
      },
      evidence: this._lastInference
    };
  }

  async _releaseSessions() {
    if (this._sessions) {
      await Promise.all(
        Object.values(this._sessions).map(session => {
          try {
            return session?.release?.().catch(() => {});
          } catch {
            return Promise.resolve();
          }
        })
      );
    }

    this._sessions = null;
    this._initPromise = null;
    this.isWarmedUp = false;
  }

  async dispose() {
    if (this._disposed) return;

    await this._releaseSessions();

    for (const url of this._urls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* release best-effort */
      }
    }

    this._urls.clear();
    this._bank = null;
    this._bankBytes = null;
    this._vocabulary = null;
    this._bankSource = null;
    this._ort = null;
    this._disposed = true;
  }
}

export default VagdhenuWebEngine;
