/* Swar-Sadhika test-only service worker.
   Never copy these changes to anujadha. */

const SHELL_CACHE = 'swar-sadhika-shell-v3';
const REMOTE_CACHE = 'swar-sadhika-remote-runtime-v1';
const MODEL_CACHE = 'swar-sadhika-vagdhenu-models-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './index.js',
  './vagdhenu-onnx.js',
  './vagdhenu-text.js',
  './pronunciation-learning.js',
  './model-cache.js'
];

function isModelRequest(url) {
  return url.hostname === 'huggingface.co' &&
    /^\/gnumanth\/sanskrit-tts-(wasm|onnx)\/resolve\/main\//
      .test(url.pathname);
}

function isRuntimeRequest(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (
    host === 'h3manth.com' &&
    path.startsWith('/ai/sanskrit-tts/')
  ) return true;

  if (
    host === 'hemanth.github.io' &&
    path.startsWith('/sanskrit-tts-web/')
  ) return true;

  if (
    host === 'raw.githubusercontent.com' &&
    path.startsWith('/hemanth/sanskrit-tts-web/')
  ) return true;

  if (
    ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net']
      .includes(host) &&
    (
      path.includes('/gh/hemanth/sanskrit-tts-web/') ||
      /\/npm\/onnxruntime-web(?:@[^/]+)?\//
        .test(path)
    )
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

  const type = String(
    response.headers.get('content-type') || ''
  ).toLowerCase();

  const path = new URL(request.url).pathname;

  if (
    type.includes('text/html') &&
    /\.(js|mjs|wasm|onnx|bin)$/.test(path)
  ) return false;

  return true;
}

async function cacheResponse(cache, request, response) {
  if (!isCacheableResponse(request, response)) return;

  try {
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn(
      '[Swar-Sadhika SW] Cache write failed:',
      request.url,
      error
    );
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);

    // Install only after the required local app shell is available.
    await cache.addAll(SHELL_FILES);

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // Retire old shell versions, but preserve model/runtime caches.
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

  if (url.origin === self.location.origin) {
    // Network-first: show updated GitHub Pages files.
    // Use the cached copy when the network is unavailable.
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);

      try {
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

  if (isModelRequest(url)) {
    // Large model weights: cache-first to avoid repeat downloads.
    event.respondWith((async () => {
      const cache = await caches.open(MODEL_CACHE);

      const cached = await cache.match(request, {
        ignoreSearch: true
      });

      if (cached) return cached;

      const response = await fetch(request);

      await cacheResponse(cache, request, response);

      return response;
    })());

    return;
  }

  if (isRuntimeRequest(url)) {
    // Refresh runtime source online; use cached source offline.
    event.respondWith((async () => {
      const cache = await caches.open(REMOTE_CACHE);

      try {
        const response = await fetch(request);

        await cacheResponse(cache, request, response);

        return response;
      } catch (error) {
        const cached = await cache.match(request, {
          ignoreSearch: true
        });

        if (cached) return cached;

        throw error;
      }
    })());
  }
});

self.addEventListener('message', event => {
  if (
    event.data?.type !== 'SWAR_SADHIKA_CACHE_STATUS'
  ) return;

  event.waitUntil((async () => {
    const keys = await caches.keys();

    event.ports?.[0]?.postMessage({
      type: 'SWAR_SADHIKA_CACHE_STATUS_RESULT',
      caches: keys.filter(key =>
        key.startsWith('swar-sadhika-')
      )
    });
  })());
});
