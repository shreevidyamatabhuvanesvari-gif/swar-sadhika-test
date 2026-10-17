/*
 * Swar-Sadhika — test-only service worker
 *
 * IMPORTANT:
 * Apply this file only to the swar-sadhika-test repository.
 * Never copy it into the anujadha main application.
 *
 * Responsibilities:
 * - Cache the same-origin application shell and local engine modules.
 * - Keep model-cache names aligned with model-cache.js.
 * - Serve cached model files only when verification metadata is present.
 * - Never promote an unverified model response into the model cache.
 * - Cache only validated HTTP 200 ONNX Runtime Web assets.
 * - Reject invalid or opaque cached runtime responses.
 * - Block the known legacy remote engine-source fallbacks.
 *
 * IMPORTANT LIMITATION:
 * A Service Worker cache hit does not prove successful ONNX inference,
 * successful audio generation, or correct Sanskrit pronunciation.
 */

'use strict';

const SHELL_CACHE = 'swar-sadhika-shell-v5';
const REMOTE_CACHE = 'swar-sadhika-remote-runtime-v1';
const MODEL_CACHE = 'swar-sadhika-vagdhenu-models-v1';
const MODEL_META_CACHE = 'swar-sadhika-vagdhenu-models-meta-v2';

const ORT_VERSION = '1.23.2';

const REQUIRED_MODEL_FILES = new Set([
  'vagdhenu_cond_q8.onnx',
  'vagdhenu_dit_step_q8.onnx',
  'vagdhenu_vocos_q8.onnx',
  'baked_bank.bin',
  'baked_bank.json'
]);

const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './index.js',
  './vagdhenu-onnx.js',
  './vendor/vagdhenu-upstream/vagdhenu-onnx.js',
  './vagdhenu-text.js',
  './pronunciation-learning.js',
  './model-cache.js'
];

/* -------------------------------------------------------------------------- */
/* Model request recognition                                                  */
/* -------------------------------------------------------------------------- */

function parseModelRequest(url) {
  if (url.hostname.toLowerCase() !== 'huggingface.co') {
    return null;
  }

  const match = url.pathname.match(
    /^\/gnumanth\/sanskrit-tts-(wasm|onnx)\/resolve\/main\/([^/]+)$/
  );

  if (!match) {
    return null;
  }

  const backend = match[1];
  let file;

  try {
    file = decodeURIComponent(match[2]);
  } catch {
    return null;
  }

  if (!REQUIRED_MODEL_FILES.has(file)) {
    return null;
  }

  return { backend, file };
}

/* -------------------------------------------------------------------------- */
/* ONNX Runtime CDN request recognition                                       */
/* -------------------------------------------------------------------------- */

function isPinnedOrtRuntimeRequest(url) {
  const host = url.hostname.toLowerCase();

  const allowedHosts = [
    'cdn.jsdelivr.net',
    'fastly.jsdelivr.net',
    'gcore.jsdelivr.net'
  ];

  if (!allowedHosts.includes(host)) {
    return false;
  }

  /*
   * Only permit assets from the pinned ONNX Runtime Web version.
   * Examples include:
   *   ort.all.min.js
   *   ort-wasm-simd-threaded.wasm
   *
   * Do not cache an unpinned version or unrelated executable code.
   */
  const pattern = new RegExp(
    '^/npm/onnxruntime-web@' +
      ORT_VERSION.replace(/\./g, '\\.') +
      '/dist/.+\\.(?:js|mjs|wasm)$',
    'i'
  );

  return pattern.test(url.pathname);
}

/* -------------------------------------------------------------------------- */
/* Block known legacy remote engine-source fallbacks                          */
/* -------------------------------------------------------------------------- */

function isLegacyRemoteEngineSource(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (
    host === 'hemanth.github.io' &&
    path.startsWith('/sanskrit-tts-web/')
  ) {
    return true;
  }

  if (
    host === 'h3manth.com' &&
    path.startsWith('/ai/sanskrit-tts/')
  ) {
    return true;
  }

  if (
    host === 'raw.githubusercontent.com' &&
    path.startsWith('/hemanth/sanskrit-tts-web/')
  ) {
    return true;
  }

  if (
    [
      'cdn.jsdelivr.net',
      'fastly.jsdelivr.net',
      'gcore.jsdelivr.net'
    ].includes(host) &&
    path.includes('/gh/hemanth/sanskrit-tts-web/')
  ) {
    return true;
  }

  if (
    host === 'esm.sh' &&
    path.startsWith('/gh/hemanth/sanskrit-tts-web')
  ) {
    return true;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Response validation and caching                                            */
/* -------------------------------------------------------------------------- */

function isCacheableResponse(request, response) {
  if (
    !response ||
    !response.ok ||
    response.status !== 200 ||
    response.type === 'opaque'
  ) {
    return false;
  }

  const contentType = String(
    response.headers.get('content-type') || ''
  ).toLowerCase();

  const path = new URL(request.url).pathname.toLowerCase();

  /*
   * Prevent an HTML error page or site fallback from being cached as
   * JavaScript, WebAssembly, ONNX, binary model data, or JSON.
   */
  if (
    contentType.includes('text/html') &&
    /\.(?:js|mjs|wasm|onnx|bin|json)$/.test(path)
  ) {
    return false;
  }

  return true;
}

async function cacheResponse(cache, request, response) {
  if (!isCacheableResponse(request, response)) {
    return false;
  }

  try {
    await cache.put(request, response.clone());
    return true;
  } catch (error) {
    console.warn(
      '[Swar-Sadhika SW] Cache write failed:',
      request.url,
      error
    );

    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Verified model metadata                                                    */
/* -------------------------------------------------------------------------- */

function metadataKeyForBackend(backend) {
  /*
   * Must match model-cache.js:
   * new URL(`./.swar-sadhika-model-cache-${backend}.json`, import.meta.url)
   */
  return new URL(
    `./.swar-sadhika-model-cache-${backend}.json`,
    self.registration.scope
  ).href;
}

async function readVerifiedModelRecord(backend, file) {
  let metaCache;

  try {
    metaCache = await caches.open(MODEL_META_CACHE);
  } catch {
    return null;
  }

  let response;

  try {
    response = await metaCache.match(
      metadataKeyForBackend(backend)
    );
  } catch {
    return null;
  }

  if (!response || response.status !== 200) {
    return null;
  }

  let metadata;

  try {
    metadata = await response.json();
  } catch {
    return null;
  }

  if (
    metadata?.schema !== 2 ||
    metadata?.backend !== backend ||
    !/^[a-f0-9]{40,64}$/i.test(
      String(metadata?.activeRevision || '')
    )
  ) {
    return null;
  }

  const record = metadata.artifacts?.[file];

  if (
    !record ||
    record.verified !== true ||
    record.revision !== metadata.activeRevision ||
    !Number.isSafeInteger(Number(record.bytes)) ||
    Number(record.bytes) <= 0 ||
    !['sha256', 'git-sha1'].includes(record.algorithm) ||
    !/^[a-f0-9]{40,64}$/i.test(
      String(record.expectedDigest || '')
    )
  ) {
    return null;
  }

  if (
    (
      record.algorithm === 'sha256' &&
      !/^[a-f0-9]{64}$/i.test(
        String(record.expectedDigest || '')
      )
    ) ||
    (
      record.algorithm === 'git-sha1' &&
      !/^[a-f0-9]{40}$/i.test(
        String(record.expectedDigest || '')
      )
    )
  ) {
    return null;
  }

  return {
    revision: metadata.activeRevision,
    bytes: Number(record.bytes),
    algorithm: record.algorithm,
    expectedDigest: record.expectedDigest
  };
}

/* -------------------------------------------------------------------------- */
/* Return only model responses backed by verification metadata                */
/* -------------------------------------------------------------------------- */

async function verifiedCachedModelResponse(request, modelInfo) {
  const verifiedRecord = await readVerifiedModelRecord(
    modelInfo.backend,
    modelInfo.file
  );

  if (!verifiedRecord) {
    return null;
  }

  let cache;

  try {
    cache = await caches.open(MODEL_CACHE);
  } catch {
    return null;
  }

  let cached;

  try {
    cached = await cache.match(request, {
      ignoreSearch: true
    });
  } catch {
    return null;
  }

  if (
    !cached ||
    cached.status !== 200 ||
    cached.type === 'opaque'
  ) {
    return null;
  }

  /*
   * The downloader stores the verified byte length in metadata.
   * If the cached response exposes Content-Length, compare it with
   * the previously verified length.
   */
  const contentLength = Number(
    cached.headers.get('content-length') || 0
  );

  if (
    contentLength > 0 &&
    contentLength !== verifiedRecord.bytes
  ) {
    console.warn(
      '[Swar-Sadhika SW] Cached model length does not match verification metadata:',
      modelInfo.file,
      {
        expectedBytes: verifiedRecord.bytes,
        cachedContentLength: contentLength
      }
    );

    return null;
  }

  /*
   * model-cache.js is responsible for hashing the full downloaded
   * artifact and recording verified=true. The Service Worker checks
   * that the corresponding verification metadata exists.
   */
  return cached;
}

/* -------------------------------------------------------------------------- */
/* Standard diagnostic response                                               */
/* -------------------------------------------------------------------------- */

function offlineUnavailableResponse(message, status = 503) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'SWAR_SADHIKA_OFFLINE_ASSET_UNAVAILABLE',
      message
    }),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);

    /*
     * Install only when all listed same-origin files are available.
     * If a required file is missing, installation should fail rather
     * than publishing an incomplete application shell.
     */
    await cache.addAll(SHELL_FILES);

    await self.skipWaiting();
  })());
});

/* -------------------------------------------------------------------------- */
/* Activate                                                                   */
/* -------------------------------------------------------------------------- */

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    /*
     * Remove obsolete shell caches but preserve:
     * - verified model files
     * - model verification metadata
     * - pinned ONNX Runtime Web assets
     */
    await Promise.all(
      keys
        .filter(key =>
          key.startsWith('swar-sadhika-shell-') &&
          key !== SHELL_CACHE
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

/* -------------------------------------------------------------------------- */
/* Fetch                                                                      */
/* -------------------------------------------------------------------------- */

self.addEventListener('fetch', event => {
  const request = event.request;

  if (
    request.method !== 'GET' ||
    request.headers.has('range')
  ) {
    return;
  }

  const url = new URL(request.url);

  /* ------------------------------------------------------------------------ */
  /* Legacy external engine modules                                           */
  /* ------------------------------------------------------------------------ */

  if (isLegacyRemoteEngineSource(url)) {
    event.respondWith(
      Promise.resolve(
        offlineUnavailableResponse(
          'बाहरी Vāgdhenu engine source इस परीक्षण ऐप में अवरुद्ध है। ' +
          'सत्यापित same-origin vendor module का उपयोग करें।',
          403
        )
      )
    );

    return;
  }

  /* ------------------------------------------------------------------------ */
  /* Same-origin application shell                                            */
  /* ------------------------------------------------------------------------ */

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);

      try {
        /*
         * Network-first strategy:
         * Use the deployed file when available and refresh the cache
         * only if the response passes validation.
         */
        const response = await fetch(request);

        await cacheResponse(
          cache,
          request,
          response
        );

        return response;
      } catch (error) {
        const cached = await cache.match(request);

        if (cached) {
          return cached;
        }

        if (request.mode === 'navigate') {
          const root = new URL(
            './',
            self.registration.scope
          ).href;

          const index = new URL(
            './index.html',
            self.registration.scope
          ).href;

          const fallback =
            await cache.match(root) ||
            await cache.match(index);

          if (fallback) {
            return fallback;
          }
        }

        throw error;
      }
    })());

    return;
  }

  /* ------------------------------------------------------------------------ */
  /* Hugging Face model files                                                 */
  /* ------------------------------------------------------------------------ */

  const modelInfo = parseModelRequest(url);

  if (modelInfo) {
    event.respondWith((async () => {
      /*
       * Never serve a model merely because bytes exist in Cache Storage.
       * model-cache.js must have recorded integrity-verification metadata.
       */
      const cached = await verifiedCachedModelResponse(
        request,
        modelInfo
      );

      if (cached) {
        return cached;
      }

      try {
        /*
         * Do not cache resolve/main responses here.
         * model-cache.js is responsible for pinning the revision,
         * downloading, hashing, and promoting verified model artifacts.
         */
        const response = await fetch(request);

        if (!isCacheableResponse(request, response)) {
          console.error(
            '[Swar-Sadhika SW] Invalid model response:',
            request.url,
            {
              status: response?.status,
              type: response?.type,
              contentType:
                response?.headers?.get('content-type') || ''
            }
          );

          return offlineUnavailableResponse(
            `मॉडल संसाधन ${modelInfo.file} से वैध HTTP 200 सामग्री नहीं मिली।`,
            502
          );
        }

        return response;
      } catch (error) {
        console.error(
          '[Swar-Sadhika SW] Model request failed:',
          request.url,
          error
        );

        return offlineUnavailableResponse(
          `मॉडल ${modelInfo.file} के लिए सत्यापित ऑफ़लाइन प्रति उपलब्ध नहीं है। ` +
          'पहली बार आवश्यक मॉडल डाउनलोड करें और अखंडता-जाँच पूरी होने दें।',
          503
        );
      }
    })());

    return;
  }

  /* ------------------------------------------------------------------------ */
  /* Pinned ONNX Runtime Web CDN assets                                       */
  /* ------------------------------------------------------------------------ */

  if (isPinnedOrtRuntimeRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(REMOTE_CACHE);

      /*
       * Validate an existing cache entry before using it.
       * Delete invalid or opaque cached entries and attempt a fresh fetch.
       */
      let cached = null;

      try {
        cached = await cache.match(request, {
          ignoreSearch: false
        });
      } catch (error) {
        console.warn(
          '[Swar-Sadhika SW] Could not read ORT cache entry:',
          request.url,
          error
        );
      }

      if (cached) {
        if (isCacheableResponse(request, cached)) {
          return cached;
        }

        console.warn(
          '[Swar-Sadhika SW] Invalid cached ORT response; deleting it:',
          request.url,
          {
            status: cached.status,
            type: cached.type,
            contentType:
              cached.headers?.get('content-type') || ''
          }
        );

        try {
          await cache.delete(request);
        } catch (error) {
          console.warn(
            '[Swar-Sadhika SW] Could not delete invalid ORT cache entry:',
            request.url,
            error
          );
        }
      }

      try {
        const response = await fetch(request);

        /*
         * An opaque response does not expose its HTTP status or headers.
         * Do not cache it or claim that it is verified.
         *
         * Pass through the actual browser response rather than replacing
         * it with a fabricated status response. Check request.mode in
         * the console: a script intended to use CORS should use
         * script.crossOrigin = 'anonymous' before assigning script.src.
         */
        if (response?.type === 'opaque') {
          console.warn(
            '[Swar-Sadhika SW] ORT response is opaque; not caching it:',
            request.url,
            {
              requestMode: request.mode,
              requestDestination: request.destination,
              responseType: response.type,
              responseStatus: response.status
            }
          );

          return response;
        }

        /*
         * Return the real HTTP response when validation fails so that
         * actual CDN statuses such as 403 or 404 are not hidden.
         */
        if (!isCacheableResponse(request, response)) {
          console.error(
            '[Swar-Sadhika SW] ORT response validation failed:',
            request.url,
            {
              status: response?.status,
              type: response?.type,
              contentType:
                response?.headers?.get('content-type') || ''
            }
          );

          return response;
        }

        /*
         * Cache only a validated HTTP 200 response that is not opaque.
         * A cache-write failure must not discard a valid network response.
         */
        await cacheResponse(
          cache,
          request,
          response
        );

        return response;
      } catch (error) {
        const reason =
          error instanceof Error && error.message
            ? error.message
            : String(error || 'Unknown error');

        console.error(
          '[Swar-Sadhika SW] ORT network fetch failed:',
          request.url,
          {
            requestMode: request.mode,
            requestDestination: request.destination,
            error
          }
        );

        return offlineUnavailableResponse(
          'ONNX Runtime Web नेटवर्क अनुरोध विफल हुआ: ' +
          reason +
          '. नेटवर्क, CORS नीति और CDN उपलब्धता जाँचें। ' +
          'पहली बार उपयोग करते समय Runtime डाउनलोड होना आवश्यक है।',
          503
        );
      }
    })());

    return;
  }
});

/* -------------------------------------------------------------------------- */
/* Cache status message                                                       */
/* -------------------------------------------------------------------------- */

self.addEventListener('message', event => {
  if (
    event.data?.type !== 'SWAR_SADHIKA_CACHE_STATUS'
  ) {
    return;
  }

  event.waitUntil((async () => {
    const keys = await caches.keys();

    const modelAssets = await caches
      .open(MODEL_CACHE)
      .catch(() => null);

    const modelMeta = await caches
      .open(MODEL_META_CACHE)
      .catch(() => null);

    const modelEntries = modelAssets
      ? await modelAssets.keys().catch(() => [])
      : [];

    const metadataEntries = modelMeta
      ? await modelMeta.keys().catch(() => [])
      : [];

    event.ports?.[0]?.postMessage({
      type: 'SWAR_SADHIKA_CACHE_STATUS_RESULT',

      shellCache: SHELL_CACHE,
      modelCache: MODEL_CACHE,
      modelMetadataCache: MODEL_META_CACHE,
      remoteRuntimeCache: REMOTE_CACHE,

      modelCacheEntryCount: modelEntries.length,
      modelMetadataEntryCount: metadataEntries.length,

      caches: keys.filter(key =>
        key.startsWith('swar-sadhika-')
      ),

      note:
        'कैश में प्रविष्टियाँ मौजूद होना यह प्रमाणित नहीं करता ' +
        'कि सभी पाँच मॉडल फ़ाइलें सत्यापित हैं, ONNX inference सफल है, ' +
        'या ऑडियो सफलतापूर्वक तैयार होकर बजता है।'
    });
  })());
});
