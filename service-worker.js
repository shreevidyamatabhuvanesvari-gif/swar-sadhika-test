/* Swar-Sadhika test-only service worker. Cache Storage is device/browser-local. */
const SHELL_CACHE = 'swar-sadhika-shell-v2';
const REMOTE_CACHE = 'swar-sadhika-remote-runtime-v1';
const MODEL_CACHE = 'swar-sadhika-vagdhenu-models-v1';
const SHELL_FILES = [
  './', './index.html', './app.js', './index.js', './vagdhenu-onnx.js',
  './vagdhenu-text.js', './pronunciation-learning.js', './model-cache.js'
];

function isModelRequest(url) {
  return url.hostname === 'huggingface.co' &&
    /^\/gnumanth\/sanskrit-tts-(wasm|onnx)\/resolve\/main\//.test(url.pathname);
}

function isRuntimeRequest(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host === 'h3manth.com' && path.startsWith('/ai/sanskrit-tts/')) return true;
  if (host === 'hemanth.github.io' && path.startsWith('/sanskrit-tts-web/')) return true;
  if (host === 'raw.githubusercontent.com' && path.startsWith('/hemanth/sanskrit-tts-web/')) return true;

  if (
    ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net'].includes(host) &&
    (
      path.includes('/gh/hemanth/sanskrit-tts-web/') ||
      /\/npm\/onnxruntime-web(?:@[^/]+)?\//.test(path)
    )
  ) {
    return true;
  }

  if (host === 'esm.sh' && path.startsWith('/gh/hemanth/sanskrit-tts-web')) return true;

  return false;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key.startsWith('swar-sadhika-shell-') && key !== SHELL_CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });

      if (cached) return cached;

      const response = await fetch(request);

      if (response.ok && response.status === 200) {
        try {
          await cache.put(request, response.clone());
        } catch (_) {
          // A failed cache write must not prevent the network response.
        }
      }

      return response;
    })());

    return;
  }

  if (!isModelRequest(url) && !isRuntimeRequest(url)) return;

  event.respondWith((async () => {
    const cacheName = isModelRequest(url) ? MODEL_CACHE : REMOTE_CACHE;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch: true });

    if (cached) return cached;

    const response = await fetch(request);
    const type = String(response.headers.get('content-type') || '').toLowerCase();

    const wrongHtml =
      type.includes('text/html') &&
      /\.(js|mjs|wasm|onnx|bin)$/.test(url.pathname);

    if (
      response.ok &&
      response.status === 200 &&
      response.type !== 'opaque' &&
      !wrongHtml
    ) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn(
          '[Swar-Sadhika SW] Runtime/model cache failed:',
          url.href,
          error
        );
      }
    }

    return response;
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SWAR_SADHIKA_CACHE_STATUS') return;

  event.waitUntil((async () => {
    const keys = await caches.keys();

    event.ports?.[0]?.postMessage({
      type: 'SWAR_SADHIKA_CACHE_STATUS_RESULT',
      caches: keys.filter(key => key.startsWith('swar-sadhika-'))
    });
  })());
});
