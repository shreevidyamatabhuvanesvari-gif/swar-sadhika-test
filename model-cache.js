/**
 * Swar-Sadhika model download/cache manager.
 * Model artifacts remain outside Git history because the bundle is ~280 MB.
 * After first download, Cache Storage plus the service worker can satisfy matching
 * model requests offline. File hashes are not asserted because verified upstream
 * SHA-256 digests were not supplied; checks are HTTP/content-type/cache-presence only.
 */
export const MODEL_CACHE_NAME = 'swar-sadhika-vagdhenu-models-v1';
const ESTIMATED_TOTAL_BYTES = 280 * 1024 * 1024;
const FILES = Object.freeze([
  'vagdhenu_cond_q8.onnx',
  'vagdhenu_dit_step_q8.onnx',
  'vagdhenu_vocos_q8.onnx',
  'baked_bank.bin',
  'baked_bank.json'
]);
const REPOSITORIES = Object.freeze({
  wasm: 'https://huggingface.co/gnumanth/sanskrit-tts-wasm/resolve/main/',
  onnx: 'https://huggingface.co/gnumanth/sanskrit-tts-onnx/resolve/main/'
});

function validateBackend(backend) {
  const key = String(backend || 'wasm').trim().toLowerCase();
  if (!Object.hasOwn(REPOSITORIES, key)) {
    throw new TypeError(`Unsupported backend "${key}". Use "wasm" or "onnx".`);
  }
  return key;
}

function requireBrowserAPIs() {
  if (typeof fetch !== 'function' || !('caches' in globalThis)) {
    throw new Error('इस ब्राउज़र में Fetch API या Cache Storage उपलब्ध नहीं है। HTTPS पर ऐप खोलें।');
  }
}

function isExpectedContentType(response, file) {
  const type = String(response.headers.get('content-type') || '').toLowerCase();
  if (type.includes('text/html')) return false;
  if (file.endsWith('.json')) return type.includes('json') || type.includes('octet-stream') || !type;
  if (file.endsWith('.onnx') || file.endsWith('.bin')) {
    return type.includes('octet-stream') || type.includes('binary') || type.includes('onnx') || !type;
  }
  return true;
}

export async function getVagdhenuModelCacheStatus(backend = 'wasm') {
  requireBrowserAPIs();
  const key = validateBackend(backend);
  const cache = await caches.open(MODEL_CACHE_NAME);
  const base = REPOSITORIES[key];
  const files = [];
  for (const name of FILES) {
    const url = new URL(name, base).href;
    const response = await cache.match(url, { ignoreSearch: true });
    files.push({ file: name, url, cached: Boolean(response), bytes: Number(response?.headers.get('content-length') || 0) });
  }
  const cachedCount = files.filter(item => item.cached).length;
  return { backend: key, cacheName: MODEL_CACHE_NAME, cachedCount, total: FILES.length, complete: cachedCount === FILES.length, files };
}

export async function cacheVagdhenuModelAssets(backend = 'wasm', onProgress = null) {
  requireBrowserAPIs();
  const key = validateBackend(backend);
  if (onProgress != null && typeof onProgress !== 'function') throw new TypeError('onProgress must be a function.');
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (estimate && Number.isFinite(estimate.quota) && Number.isFinite(estimate.usage)) {
    const available = Math.max(0, estimate.quota - estimate.usage);
    if (available < ESTIMATED_TOTAL_BYTES * 0.9) {
      throw new Error(`स्थानीय स्टोरेज अनुमानित मॉडल आकार के लिए कम है। उपलब्ध ${(available / 1048576).toFixed(0)} MiB; लगभग ${(ESTIMATED_TOTAL_BYTES / 1048576).toFixed(0)} MiB की आवश्यकता हो सकती है।`);
    }
  }
  const cache = await caches.open(MODEL_CACHE_NAME);
  const base = REPOSITORIES[key];
  const details = [];
  let downloaded = 0;
  for (let i = 0; i < FILES.length; i += 1) {
    const file = FILES[i];
    const url = new URL(file, base).href;
    const cached = await cache.match(url, { ignoreSearch: true });
    if (cached) {
      details.push({ file, cached: true, bytes: Number(cached.headers.get('content-length') || 0) });
      onProgress?.({ backend: key, completed: i + 1, total: FILES.length, file, cached: true, message: `पहले से कैश है: ${file} (${i + 1}/${FILES.length})` });
      continue;
    }
    onProgress?.({ backend: key, completed: i, total: FILES.length, file, cached: false, message: `डाउनलोड हो रहा है: ${file} (${i + 1}/${FILES.length})` });
    const request = new Request(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-cache' });
    const response = await fetch(request);
    if (!response.ok || response.status !== 200) throw new Error(`${file}: डाउनलोड विफल (HTTP ${response.status}).`);
    if (!isExpectedContentType(response, file)) throw new Error(`${file}: सर्वर ने मॉडल के बजाय HTML/असंगत सामग्री लौटाई।`);
    const length = Number(response.headers.get('content-length') || 0);
    // Cache the response stream without buffering hundreds of MiB in JS memory.
    await cache.put(request, response.clone());
    const check = await cache.match(url, { ignoreSearch: true });
    if (!check || check.status !== 200) throw new Error(`${file}: कैश में डालने के बाद सत्यापन विफल हुआ।`);
    details.push({ file, cached: true, bytes: length });
    downloaded += length;
    onProgress?.({ backend: key, completed: i + 1, total: FILES.length, file, cached: true, downloadedBytes: downloaded, message: `कैश में सुरक्षित: ${file} (${i + 1}/${FILES.length})` });
  }
  const status = await getVagdhenuModelCacheStatus(key);
  if (!status.complete) return { ok: false, backend: key, message: `मॉडल कैश अधूरा है (${status.cachedCount}/${status.total})।`, ...status };
  return { ok: true, backend: key, message: `${status.total} मॉडल संसाधन Cache Storage में उपलब्ध हैं। यह सफल AI inference या ऑडियो का प्रमाण नहीं है।`, downloadedBytes: downloaded, files: details, ...status };
}

export async function clearVagdhenuModelCache() {
  if (!('caches' in globalThis)) throw new Error('Cache Storage उपलब्ध नहीं है.');
  return caches.delete(MODEL_CACHE_NAME);
}
export const VAGDHENU_MODEL_ASSET_FILES = FILES;
