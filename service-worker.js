/*
 * Swar-Sadhika test-only service worker.
 * IMPORTANT: apply only to swar-sadhika-test; never copy into anujadha.
 *
 * Responsibilities:
 * - Cache the local application shell, including the vendored engine entry.
 * - Keep the model cache name aligned with model-cache.js.
 * - Serve Hugging Face resolve/main model requests from cache only when the
 *   model-cache.js verification metadata confirms the exact artifact/revision.
 * - Never promote an unverified model response into the model cache here.
 * - Cache only the pinned ONNX Runtime Web distribution as remote runtime.
 * - Prevent previously used remote Vāgdhenu engine-source fallbacks from being
 *   loaded as executable code. The same-origin vendor module is preferred.
 *
 * A service worker cache hit does not prove ONNX inference or audio quality.
 */

'use strict';

const SHELL_CACHE = 'swar-sadhika-shell-v4';
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

function parseModelRequest(url) {
  if (url.hostname.toLowerCase() !== 'huggingface.co') {
    return null;
  }

  const match = url.pathname.match(
    /^\/gnumanth\/sanskrit-tts-(wasm|onnx)\/resolve\/main\/([^/]+)$/
  );

  if (!match) return null;

  const backend = match[1];
  const file = decodeURIComponent(match[2]);

  if (!REQUIRED_MODEL_FILES.has(file)) return null;

  return { backend, file };
}

function isPinnedOrtRuntimeRequest(url) {
  const host = url.hostname.toLowerCase();

  if (![
    'cdn.jsdelivr.net',
    'fastly.jsdelivr.net',
    'gcore.jsdelivr.net'
  ].includes(host)) {
    return false;
  }

  // Only cache the exact ONNX Runtime Web version used by the local engine.
  // This excludes unpinned CDN paths and unrelated executable code.
  return new RegExp(
    `/npm/onnxruntime-web@${ORT_VERSION.replace(/\./g, '\\.')}\\/dist\\/.+\\.(?:js|mjs|wasm)$`,
    'i'
  ).test(url.pathname);
}

function isLegacyRemoteEngineSource(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (
    host === 'hemanth.github.io' &&
    path.startsWith('/sanskrit-tts-web/')
  ) return true;

  if (
    host === 'h3manth.com' &&
    path.startsWith('/ai/sanskrit-tts/')
  ) return true;

  if (
    host === 'raw.githubusercontent.com' &&
    path.startsWith('/hemanth/sanskrit-tts-web/')
  ) return true;

  if (
    ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net']
      .includes(host) &&
    path.includes('/gh/hemanth/sanskrit-tts-web/')
  ) return true;

  if (
    host === 'esm.sh' &&
    path.startsWith('/gh/hemanth/sanskrit-tts-web')
  ) return true;

  return false;
}

function isCacheableResponse(request, response) {
  if (
    !response ||
    !response.ok ||
    response.status !== 200 ||
    response.type === 'opaque'
  ) return false;

  const contentType = String(
    response.headers.get('content-type') || ''
  ).toLowerCase();

  const path = new URL(request.url).pathname.toLowerCase();

  if (
    contentType.includes('text/html') &&
    /\.(?:js|mjs|wasm|onnx|bin|json)$/.test(path)
  ) return false;

  return true;
}

async function cacheResponse(cache, request, response) {
  if (!isCacheableResponse(request, response)) return false;

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

function metadataKeyForBackend(backend) {
  // Must match model-cache.js:
  // new URL(`./.swar-sadhika-model-cache-${backend}.json`, import.meta.url)
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
    response = await metaCache.match(metadataKeyForBackend(backend));
  } catch {
    return null;
  }

  if (!response || response.status !== 200) return null;

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
  ) return null;

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
  ) return null;

  if (
    (
      record.algorithm === 'sha256' &&
      !/^[a-f0-9]{64}$/i.test(record.expectedDigest)
    ) ||
    (
      record.algorithm === 'git-sha1' &&
      !/^[a-f0-9]{40}$/i.test(record.expectedDigest)
    )
  ) return null;

  return {
    revision: metadata.activeRevision,
    bytes: Number(record.bytes),
    algorithm: record.algorithm,
    expectedDigest: record.expectedDigest
  };
}

async function verifiedCachedModelResponse(request, modelInfo) {
  const verifiedRecord = await readVerifiedModelRecord(
    modelInfo.backend,
    modelInfo.file
  );

  if (!verifiedRecord) return null;

  const cache = await caches.open(MODEL_CACHE);
  let cached;

  try {
    cached = await cache.match(request, { ignoreSearch: true });
  } catch {
    return null;
  }

  if (
    !cached ||
    cached.status !== 200 ||
    cached.type === 'opaque'
  ) return null;

  // The downloader records the exact byte length after hashing the received
  // stream. If Cache Storage preserves a Content-Length header, compare it.
  const contentLength = Number(
    cached.headers.get('content-length') || 0
  );

  if (
    contentLength > 0 &&
    contentLength !== verifiedRecord.bytes
  ) {
    console.warn(
      '[Swar-Sadhika SW] Cached model length no longer matches verification metadata:',
      modelInfo.file
    );
    return null;
  }

  // The model-cache module hashes the full download before recording
  // verified=true. This check binds the cache entry to that verified revision.
  return cached;
}

function offlineUnavailableResponse(message, status = 503) {
  return new Response(JSON.stringify({
    ok: false,
    error: 'SWAR_SADHIKA_OFFLINE_ASSET_UNAVAILABLE',
    message
  }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);

    // Install only when all required same-origin app files are available.
    // A missing vendor engine file intentionally fails installation rather
    // than publishing a shell that cannot resolve its declared local module.
    await cache.addAll(SHELL_FILES);

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // Retire old shell caches after this version is installed. Preserve model,
    // verified-model-metadata and pinned runtime caches across deployments.
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

self.addEventListener('fetch', event => {
  const request = event.request;

  if (
    request.method !== 'GET' ||
    request.headers.has('range')
  ) return;

  const url = new URL(request.url);

  // Only the vetted same-origin vendored module should provide the engine.
  // Block the known historical upstream executable-source fallbacks until
  // their redistribution/license and provenance are independently approved.
  if (isLegacyRemoteEngineSource(url)) {
    event.respondWith(Promise.resolve(offlineUnavailableResponse(
      'बाहरी Vāgdhenu engine source इस परीक्षण ऐप में अवरुद्ध है। सत्यापित same-origin vendor module का उपयोग करें।',
      403
    )));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);

      try {
        // Network-first refreshes ordinary app files on GitHub Pages.
        const response = await fetch(request);
        await cacheResponse(cache, request, response);
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;

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

          if (fallback) return fallback;
        }

        throw error;
      }
    })());

    return;
  }

  const modelInfo = parseModelRequest(url);

  if (modelInfo) {
    event.respondWith((async () => {
      // Never serve a model simply because bytes happen to exist in Cache
      // Storage. model-cache.js must confirm that this exact artifact was
      // downloaded, integrity-checked and revision-bound.
      const cached = await verifiedCachedModelResponse(
        request,
        modelInfo
      );

      if (cached) return cached;

      try {
        // Do not cache a resolve/main network response here. model-cache.js is
        // responsible for pinned revision downloads, hashing and cache promotion.
        const response = await fetch(request);

        if (!isCacheableResponse(request, response)) {
          return offlineUnavailableResponse(
            `मॉडल संसाधन ${modelInfo.file} से वैध HTTP 200 सामग्री नहीं मिली।`,
            502
          );
        }

        return response;
      } catch {
        return offlineUnavailableResponse(
          `मॉडल ${modelInfo.file} के लिए सत्यापित ऑफ़लाइन प्रति उपलब्ध नहीं है। पहली बार आवश्यक मॉडल डाउनलोड करें और अखंडता-जाँच पूरी होने दें।`,
          503
        );
      }
    })());

    return;
  }

  if (isPinnedOrtRuntimeRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(REMOTE_CACHE);
      const cached = await cache.match(request, {
        ignoreSearch: false
      });

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (!isCacheableResponse(request, response)) {
          return offlineUnavailableResponse(
            'ONNX Runtime Web resource की HTTP response वैध नहीं है।',
            502
          );
        }

        await cacheResponse(cache, request, response);
        return response;
      } catch {
        return offlineUnavailableResponse(
          'ONNX Runtime Web की आवश्यक JS/WASM फ़ाइल कैश में नहीं है। पहली बार runtime डाउनलोड करें।',
          503
        );
      }
    })());
  }
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SWAR_SADHIKA_CACHE_STATUS') return;

  event.waitUntil((async () => {
    const keys = await caches.keys();

    const modelAssets = await caches.open(MODEL_CACHE).catch(() => null);
    const modelMeta = await caches.open(MODEL_META_CACHE).catch(() => null);

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
      caches: keys.filter(key => key.startsWith('swar-sadhika-')),
      note:
        'Cache entry counts alone do not prove that all five model assets are verified or that ONNX inference/audio playback succeeds.'
    });
  })());
});
