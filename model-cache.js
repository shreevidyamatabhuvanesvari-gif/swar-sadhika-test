/**
 * Swar-Sadhika model download/cache manager.
 *
 * Responsibilities:
 * - Resolve one immutable Hugging Face model revision per download run.
 * - Download only the five expected Vāgdhenu artifacts.
 * - Verify each artifact against Hugging Face file metadata:
 *   SHA-256 for LFS/Xet assets, or Git-blob SHA-1 for small Git-stored assets.
 * - Record verification/revision metadata separately from the asset cache.
 * - Keep the exact resolve/main/<filename> cache keys expected by the
 *   current app/service worker, while fetching bytes from the pinned commit.
 * - Never report cache presence alone as verified model availability.
 *
 * This module does not prove successful ONNX inference or audio playback.
 */

export const MODEL_CACHE_NAME = 'swar-sadhika-vagdhenu-models-v1';

const META_CACHE_NAME = 'swar-sadhika-vagdhenu-models-meta-v2';

const REQUIRED_FILES = Object.freeze([
  'vagdhenu_cond_q8.onnx',
  'vagdhenu_dit_step_q8.onnx',
  'vagdhenu_vocos_q8.onnx',
  'baked_bank.bin',
  'baked_bank.json'
]);

const REPOSITORIES = Object.freeze({
  wasm: 'gnumanth/sanskrit-tts-wasm',
  onnx: 'gnumanth/sanskrit-tts-onnx'
});

const HF_ORIGIN = 'https://huggingface.co';
const MAX_SMALL_GIT_BLOB_BYTES = 2 * 1024 * 1024;
const STORAGE_HEADROOM_RATIO = 1.08;

function reportProgress(callback, detail) {
  if (typeof callback !== 'function') return;

  try {
    callback(detail);
  } catch (error) {
    console.warn(
      '[Swar-Sadhika] model-cache progress callback failed:',
      error
    );
  }
}

function validateBackend(backend) {
  const key = String(backend || 'wasm').trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(REPOSITORIES, key)) {
    throw new TypeError(
      `Unsupported backend "${key}". Use "wasm" or "onnx".`
    );
  }

  return key;
}

function requireBrowserAPIs() {
  if (
    typeof fetch !== 'function' ||
    typeof caches === 'undefined'
  ) {
    throw new Error(
      'इस ब्राउज़र में Fetch API या Cache Storage उपलब्ध नहीं है। HTTPS पर ऐप खोलें।'
    );
  }
}

function artifactUrl(backend, file) {
  return new URL(
    file,
    `${HF_ORIGIN}/${REPOSITORIES[backend]}/resolve/main/`
  ).href;
}

function pinnedArtifactUrl(repo, revision, file) {
  return `${HF_ORIGIN}/${repo}/resolve/${encodeURIComponent(revision)}/${file}`;
}

function metadataKey(backend) {
  // Synthetic same-origin key for Cache Storage only.
  // This URL is never requested from the network.
  return new URL(
    `./.swar-sadhika-model-cache-${backend}.json`,
    import.meta.url
  ).href;
}

function normalizeHex(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^sha256:/, '')
    .replace(/^sha-256:/, '')
    .replace(/^sha1:/, '');
}

function isHex(value, length) {
  return new RegExp(`^[a-f0-9]{${length}}$`, 'i')
    .test(String(value || ''));
}

function extractIntegrity(fileInfo) {
  const lfs = fileInfo?.lfs || {};

  const candidates = [
    lfs.oid,
    lfs.sha256,
    fileInfo?.sha256,
    fileInfo?.oid
  ];

  for (const candidate of candidates) {
    const normalized = normalizeHex(candidate);

    if (isHex(normalized, 64)) {
      return {
        algorithm: 'sha256',
        value: normalized
      };
    }
  }

  const blobId = normalizeHex(
    fileInfo?.blobId || fileInfo?.blob_id
  );

  const size = Number(
    fileInfo?.size ?? lfs.size ?? 0
  );

  // Git-blob SHA-1 is accepted only for small ordinary Git files.
  // Large model assets must provide a SHA-256 identity.
  if (
    isHex(blobId, 40) &&
    size > 0 &&
    size <= MAX_SMALL_GIT_BLOB_BYTES
  ) {
    return {
      algorithm: 'git-sha1',
      value: blobId
    };
  }

  return null;
}

function exactSize(fileInfo) {
  const size = Number(
    fileInfo?.size ?? fileInfo?.lfs?.size
  );

  return Number.isSafeInteger(size) && size >= 0
    ? size
    : null;
}

function isExpectedContentType(response, file) {
  const type = String(
    response.headers.get('content-type') || ''
  ).toLowerCase();

  if (type.includes('text/html')) return false;

  if (file.endsWith('.json')) {
    // Hugging Face/CDN layers may serve a genuine JSON artifact as text/plain.
    // Do not reject on MIME alone: the pinned-revision integrity check below
    // still verifies the exact bytes, and the runtime separately JSON-parses it.
    return (
      type.includes('json') ||
      type.includes('octet-stream') ||
      type.includes('text/plain') ||
      !type
    );
  }

  if (file.endsWith('.onnx') || file.endsWith('.bin')) {
    return (
      type.includes('octet-stream') ||
      type.includes('binary') ||
      type.includes('onnx') ||
      !type
    );
  }

  return false;
}

function parseRepoFileInfo(repoInfo, file) {
  const siblings = Array.isArray(repoInfo?.siblings)
    ? repoInfo.siblings
    : [];

  const info = siblings.find(
    item => item?.rfilename === file || item?.path === file
  );

  if (!info) {
    throw new Error(
      `Hugging Face model repository में आवश्यक फ़ाइल नहीं मिली: ${file}`
    );
  }

  const integrity = extractIntegrity(info);

  if (!integrity) {
    throw new Error(
      `${file}: मॉडल की सत्यापित SHA-256/Git-blob पहचान उपलब्ध नहीं है; ` +
      'बिना integrity metadata के फ़ाइल को स्वीकार नहीं किया गया।'
    );
  }

  const size = exactSize(info);

  if (size == null || size <= 0) {
    throw new Error(
      `${file}: स्रोत से सही फ़ाइल आकार नहीं मिला।`
    );
  }

  return {
    file,
    size,
    integrity
  };
}

async function fetchRepoManifest(backend) {
  const repo = REPOSITORIES[backend];
  const url = `${HF_ORIGIN}/api/models/${repo}?blobs=true`;

  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-cache'
    });
  } catch (error) {
    throw new Error(
      `Hugging Face model manifest नहीं मिल पाया: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Hugging Face model manifest विफल (HTTP ${response.status})।`
    );
  }

  const info = await response.json();
  const revision = String(info?.sha || '').trim();

  if (!/^[a-f0-9]{40,64}$/i.test(revision)) {
    throw new Error(
      'Hugging Face API ने immutable commit revision नहीं लौटाया।'
    );
  }

  const files = REQUIRED_FILES.map(
    file => parseRepoFileInfo(info, file)
  );

  return {
    repo,
    revision,
    files,
    fetchedAt: new Date().toISOString()
  };
}

async function openMetaCache() {
  return caches.open(META_CACHE_NAME);
}

async function readStoredMetadata(backend) {
  const cache = await openMetaCache();
  const response = await cache.match(metadataKey(backend));

  if (!response) {
    return {
      schema: 2,
      backend,
      activeRevision: null,
      artifacts: {}
    };
  }

  try {
    const stored = await response.json();

    if (
      stored?.schema !== 2 ||
      stored?.backend !== backend ||
      !stored?.artifacts
    ) {
      return {
        schema: 2,
        backend,
        activeRevision: null,
        artifacts: {}
      };
    }

    return stored;
  } catch {
    return {
      schema: 2,
      backend,
      activeRevision: null,
      artifacts: {}
    };
  }
}

async function writeStoredMetadata(backend, metadata) {
  const cache = await openMetaCache();

  const body = JSON.stringify({
    ...metadata,
    schema: 2,
    backend,
    updatedAt: new Date().toISOString()
  });

  await cache.put(
    metadataKey(backend),
    new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    })
  );
}

function artifactRecordMatches(record, revision, fileInfo) {
  return Boolean(
    record &&
    record.verified === true &&
    record.revision === revision &&
    record.algorithm === fileInfo.integrity.algorithm &&
    record.expectedDigest === fileInfo.integrity.value &&
    Number(record.bytes) === fileInfo.size
  );
}

async function gitBlobSha1(chunks, size) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-1 उपलब्ध नहीं है।');
  }

  const prefix = new TextEncoder().encode(`blob ${size}\0`);
  const total = prefix.byteLength + size;
  const bytes = new Uint8Array(total);

  bytes.set(prefix, 0);

  let offset = prefix.byteLength;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const digest = await crypto.subtle.digest('SHA-1', bytes);

  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

// Incremental SHA-256 implementation. This avoids buffering the 190+ MB
// DiT weight file in one JavaScript ArrayBuffer on Android devices.
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function rotr(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

class StreamingSha256 {
  constructor() {
    this.h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);

    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.bytes = 0;
    this.done = false;
  }

  update(input) {
    if (this.done) {
      throw new Error('SHA-256 already finalized.');
    }

    const data = input instanceof Uint8Array
      ? input
      : new Uint8Array(input);

    this.bytes += data.byteLength;

    let offset = 0;

    if (this.bufferLength) {
      const take = Math.min(
        64 - this.bufferLength,
        data.byteLength
      );

      this.buffer.set(
        data.subarray(0, take),
        this.bufferLength
      );

      this.bufferLength += take;
      offset += take;

      if (this.bufferLength === 64) {
        this._block(this.buffer, 0);
        this.bufferLength = 0;
      }
    }

    while (offset + 64 <= data.byteLength) {
      this._block(data, offset);
      offset += 64;
    }

    if (offset < data.byteLength) {
      this.buffer.set(data.subarray(offset), 0);
      this.bufferLength = data.byteLength - offset;
    }

    return this;
  }

  _block(data, offset) {
    const view = new DataView(
      data.buffer,
      data.byteOffset + offset,
      64
    );

    const w = new Uint32Array(64);

    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(i * 4, false);
    }

    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];

      const s0 =
        rotr(x, 7) ^
        rotr(x, 18) ^
        (x >>> 3);

      const s1 =
        rotr(y, 17) ^
        rotr(y, 19) ^
        (y >>> 10);

      w[i] = (
        w[i - 16] +
        s0 +
        w[i - 7] +
        s1
      ) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = this.h;

    for (let i = 0; i < 64; i++) {
      const S1 =
        rotr(e, 6) ^
        rotr(e, 11) ^
        rotr(e, 25);

      const ch = (e & f) ^ (~e & g);

      const t1 = (
        h + S1 + ch + SHA256_K[i] + w[i]
      ) >>> 0;

      const S0 =
        rotr(a, 2) ^
        rotr(a, 13) ^
        rotr(a, 22);

      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    this.h[0] = (this.h[0] + a) >>> 0;
    this.h[1] = (this.h[1] + b) >>> 0;
    this.h[2] = (this.h[2] + c) >>> 0;
    this.h[3] = (this.h[3] + d) >>> 0;
    this.h[4] = (this.h[4] + e) >>> 0;
    this.h[5] = (this.h[5] + f) >>> 0;
    this.h[6] = (this.h[6] + g) >>> 0;
    this.h[7] = (this.h[7] + h) >>> 0;
  }

  digestHex() {
    if (this.done) {
      throw new Error('SHA-256 already finalized.');
    }

    const bitLength = this.bytes * 8;

    this.buffer[this.bufferLength++] = 0x80;

    if (this.bufferLength > 56) {
      this.buffer.fill(0, this.bufferLength);
      this._block(this.buffer, 0);
      this.bufferLength = 0;
    }

    this.buffer.fill(0, this.bufferLength, 56);

    const view = new DataView(this.buffer.buffer);

    view.setUint32(
      56,
      Math.floor(bitLength / 0x100000000),
      false
    );

    view.setUint32(60, bitLength >>> 0, false);

    this._block(this.buffer, 0);
    this.done = true;

    return [...this.h]
      .map(word => word.toString(16).padStart(8, '0'))
      .join('');
  }
}

async function readAndVerifyResponse(response, fileInfo, onChunk) {
  if (!response.body?.getReader) {
    throw new Error(
      `${fileInfo.file}: streaming response उपलब्ध नहीं है; ` +
      'सुरक्षित low-memory integrity जाँच नहीं हो सकती।'
    );
  }

  const reader = response.body.getReader();
  const expected = fileInfo.integrity;

  const sha256 = expected.algorithm === 'sha256'
    ? new StreamingSha256()
    : null;

  const smallChunks = expected.algorithm === 'git-sha1'
    ? []
    : null;

  let bytes = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      if (!(value instanceof Uint8Array)) {
        throw new Error(
          `${fileInfo.file}: डाउनलोड stream ने अनपेक्षित chunk लौटाया।`
        );
      }

      bytes += value.byteLength;

      if (sha256) {
        sha256.update(value);
      } else {
        if (bytes > MAX_SMALL_GIT_BLOB_BYTES) {
          throw new Error(
            `${fileInfo.file}: Git-blob SHA-1 verification के लिए फ़ाइल सुरक्षित सीमा से बड़ी है।`
          );
        }

        smallChunks.push(value.slice());
      }

      onChunk?.(bytes);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Best-effort cleanup.
    }
  }

  if (fileInfo.size != null && bytes !== fileInfo.size) {
    throw new Error(
      `${fileInfo.file}: आकार मेल नहीं खाता ` +
      `(प्राप्त ${bytes} bytes; अपेक्षित ${fileInfo.size})।`
    );
  }

  const actual = sha256
    ? sha256.digestHex()
    : await gitBlobSha1(smallChunks, bytes);

  if (actual !== expected.value) {
    throw new Error(
      `${fileInfo.file}: ${expected.algorithm} अखंडता जाँच विफल हुई। ` +
      'फ़ाइल कैश के लिए स्वीकार नहीं की गई।'
    );
  }

  return {
    bytes,
    digest: actual,
    algorithm: expected.algorithm
  };
}

async function makeStatus(backend, manifest = null) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const stored = await readStoredMetadata(backend);
  const repo = REPOSITORIES[backend];
  const files = [];

  for (const file of REQUIRED_FILES) {
    const url = artifactUrl(backend, file);
    let response = null;

    try {
      response = await cache.match(url, { ignoreSearch: true });
    } catch {
      // Report absent if Cache Storage lookup fails.
    }

    const record = stored.artifacts?.[file] || null;

    const currentFileInfo = manifest?.files?.find(
      item => item.file === file
    ) || null;

    const matchesCurrentManifest = currentFileInfo
      ? artifactRecordMatches(
          record,
          manifest.revision,
          currentFileInfo
        )
      : Boolean(
          record?.verified &&
          record.revision === stored.activeRevision
        );

    const present = Boolean(response && response.status === 200);
    const verified = present && matchesCurrentManifest;

    files.push({
      file,
      url,
      present,
      cached: verified,
      verified,
      revision: record?.revision || null,
      algorithm: record?.algorithm || null,
      sha256: record?.algorithm === 'sha256'
        ? record.expectedDigest
        : null,
      bytes: Number(
        record?.bytes ||
        response?.headers.get('content-length') ||
        0
      ),
      expectedBytes: currentFileInfo?.size ?? record?.bytes ?? null,
      message: !present
        ? 'कैश में नहीं है'
        : verified
          ? 'सत्यापित कैश उपलब्ध'
          : 'फ़ाइल मौजूद है, लेकिन सत्यापन metadata नहीं मिला या revision बदल चुका है'
    });
  }

  const cachedCount = files.filter(file => file.cached).length;
  const activeRevision = stored.activeRevision || null;

  return {
    backend,
    repository: repo,
    cacheName: MODEL_CACHE_NAME,
    metaCacheName: META_CACHE_NAME,
    revision: manifest?.revision || activeRevision,
    cachedCount,
    total: REQUIRED_FILES.length,
    complete: cachedCount === REQUIRED_FILES.length,
    hashVerification:
      'sha256-for-LFS/Xet; Git-blob SHA-1 for small Git files',
    files
  };
}

export async function getVagdhenuModelCacheStatus(
  backend = 'wasm'
) {
  requireBrowserAPIs();

  return makeStatus(validateBackend(backend));
}

export async function cacheVagdhenuModelAssets(
  backend = 'wasm',
  onProgress = null
) {
  requireBrowserAPIs();

  const key = validateBackend(backend);

  if (
    onProgress != null &&
    typeof onProgress !== 'function'
  ) {
    throw new TypeError('onProgress must be a function.');
  }

  let manifest;

  try {
    manifest = await fetchRepoManifest(key);
  } catch (error) {
    // Offline use is accepted only if the previously saved cache and its
    // verification metadata establish that the full model set is available.
    const offlineStatus = await makeStatus(key).catch(() => null);

    if (offlineStatus?.complete) {
      return {
        ok: true,
        offline: true,
        backend: key,
        message:
          'नेटवर्क उपलब्ध नहीं था; पहले से सत्यापित मॉडल cache पूरा है। ' +
          'मौजूदा revision की ताज़गी की जाँच नहीं हो सकी।',
        ...offlineStatus
      };
    }

    throw error;
  }

  const cache = await caches.open(MODEL_CACHE_NAME);
  const stored = await readStoredMetadata(key);

  let newlyDownloadedBytes = 0;
  let completed = 0;
  let bytesNeeded = 0;

  // Estimate only the files that are missing or do not match this revision.
  for (const fileInfo of manifest.files) {
    const old = stored.artifacts?.[fileInfo.file];
    let cached = null;

    try {
      cached = await cache.match(
        artifactUrl(key, fileInfo.file),
        { ignoreSearch: true }
      );
    } catch {
      // Treat as missing.
    }

    if (
      !(
        cached &&
        artifactRecordMatches(old, manifest.revision, fileInfo)
      )
    ) {
      bytesNeeded += fileInfo.size;
    }
  }

  const estimate = await navigator.storage?.estimate?.().catch(
    () => null
  );

  if (
    bytesNeeded > 0 &&
    estimate &&
    Number.isFinite(estimate.quota) &&
    Number.isFinite(estimate.usage)
  ) {
    const available = Math.max(
      0,
      estimate.quota - estimate.usage
    );

    const required = Math.ceil(
      bytesNeeded * STORAGE_HEADROOM_RATIO
    );

    if (available < required) {
      throw new Error(
        `स्थानीय स्टोरेज कम है। उपलब्ध ` +
        `${(available / 1048576).toFixed(0)} MiB; ` +
        `इस चरण के लिए लगभग ${(required / 1048576).toFixed(0)} MiB ` +
        'अतिरिक्त स्थान चाहिए। पुराने सत्यापित cache को पहले न हटाएँ।'
      );
    }
  }

  const nextMetadata = {
    schema: 2,
    backend: key,
    activeRevision: stored.activeRevision || null,
    artifacts: { ...(stored.artifacts || {}) },
    pendingRevision: manifest.revision,
    repository: manifest.repo
  };

  const details = [];

  for (let i = 0; i < manifest.files.length; i += 1) {
    const fileInfo = manifest.files[i];
    const file = fileInfo.file;
    const mainUrl = artifactUrl(key, file);
    const oldRecord = nextMetadata.artifacts[file];

    let cached = null;

    try {
      cached = await cache.match(
        mainUrl,
        { ignoreSearch: true }
      );
    } catch {
      // Re-fetch if lookup fails.
    }

    if (
      cached &&
      artifactRecordMatches(
        oldRecord,
        manifest.revision,
        fileInfo
      )
    ) {
      completed += 1;

      details.push({
        file,
        cached: true,
        verified: true,
        bytes: oldRecord.bytes,
        digest: oldRecord.expectedDigest,
        algorithm: oldRecord.algorithm
      });

      reportProgress(onProgress, {
        backend: key,
        completed,
        total: REQUIRED_FILES.length,
        file,
        cached: true,
        verified: true,
        revision: manifest.revision,
        message:
          `पहले से सत्यापित cache: ${file} ` +
          `(${completed}/${REQUIRED_FILES.length})`
      });

      continue;
    }

    reportProgress(onProgress, {
      backend: key,
      completed,
      total: REQUIRED_FILES.length,
      file,
      cached: false,
      verified: false,
      revision: manifest.revision,
      message:
        `स्रोत से डाउनलोड और अखंडता जाँच: ${file} ` +
        `(${i + 1}/${REQUIRED_FILES.length})`
    });

    const sourceUrl = pinnedArtifactUrl(
      manifest.repo,
      manifest.revision,
      file
    );

    let response;

    try {
      response = await fetch(
        new Request(sourceUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-cache'
        })
      );
    } catch (error) {
      throw new Error(
        `${file}: डाउनलोड असफल (` +
        `${error instanceof Error ? error.message : String(error)})`
      );
    }

    if (!response.ok || response.status !== 200) {
      throw new Error(
        `${file}: डाउनलोड विफल (HTTP ${response.status})।`
      );
    }

    if (!isExpectedContentType(response, file)) {
      throw new Error(
        `${file}: मॉडल के बजाय HTML/असंगत सामग्री मिली।`
      );
    }

    // Cache API consumes the cloned stream while the original is hashed.
    // The metadata is marked verified only after both operations succeed.
    let cacheWrite;

    try {
      cacheWrite = cache.put(mainUrl, response.clone());
    } catch (error) {
      throw new Error(
        `${file}: Cache Storage write शुरू नहीं हुई (` +
        `${error instanceof Error ? error.message : String(error)})`
      );
    }

    let verified;

    try {
      verified = await readAndVerifyResponse(
        response,
        fileInfo,
        byteCount => {
          const contentLength = fileInfo.size;

          const filePercent = Math.max(
            0,
            Math.min(
              100,
              Math.floor(byteCount / contentLength * 100)
            )
          );

          reportProgress(onProgress, {
            backend: key,
            completed,
            total: REQUIRED_FILES.length,
            file,
            cached: false,
            verified: false,
            bytes: byteCount,
            expectedBytes: contentLength,
            percent: filePercent,
            revision: manifest.revision,
            message:
              `जाँच जारी: ${file} ` +
              `(${(byteCount / 1048576).toFixed(1)}/` +
              `${(contentLength / 1048576).toFixed(1)} MiB)`
          });
        }
      );

      await cacheWrite;
    } catch (error) {
      await cache.delete(mainUrl).catch(() => false);

      throw new Error(
        `${file}: सत्यापन/कैश लेखन विफल—` +
        `${error instanceof Error ? error.message : String(error)}`
      );
    }

    const cachedCheck = await cache.match(
      mainUrl,
      { ignoreSearch: true }
    );

    if (!cachedCheck || cachedCheck.status !== 200) {
      await cache.delete(mainUrl).catch(() => false);

      throw new Error(
        `${file}: integrity सही थी, लेकिन Cache Storage में ` +
        'पुनः पढ़ने पर फ़ाइल नहीं मिली।'
      );
    }

    nextMetadata.artifacts[file] = {
      revision: manifest.revision,
      bytes: verified.bytes,
      algorithm: verified.algorithm,
      expectedDigest: fileInfo.integrity.value,
      verified: true,
      verifiedAt: new Date().toISOString()
    };

    await writeStoredMetadata(key, nextMetadata);

    completed += 1;
    newlyDownloadedBytes += verified.bytes;

    details.push({
      file,
      cached: true,
      verified: true,
      bytes: verified.bytes,
      digest: verified.digest,
      algorithm: verified.algorithm
    });

    reportProgress(onProgress, {
      backend: key,
      completed,
      total: REQUIRED_FILES.length,
      file,
      cached: true,
      verified: true,
      downloadedBytes: newlyDownloadedBytes,
      revision: manifest.revision,
      message:
        `डाउनलोड, अखंडता-जाँच और cache सत्यापन सफल: ${file} ` +
        `(${completed}/${REQUIRED_FILES.length})`
    });
  }

  // Promote the revision only after every required file is verified.
  for (const fileInfo of manifest.files) {
    if (
      !artifactRecordMatches(
        nextMetadata.artifacts[fileInfo.file],
        manifest.revision,
        fileInfo
      )
    ) {
      throw new Error(
        `मॉडल सेट अधूरा है: ${fileInfo.file} ` +
        `वर्तमान revision ${manifest.revision} से मेल नहीं खाता।`
      );
    }
  }

  nextMetadata.activeRevision = manifest.revision;
  delete nextMetadata.pendingRevision;
  nextMetadata.repository = manifest.repo;
  nextMetadata.manifestFetchedAt = manifest.fetchedAt;

  await writeStoredMetadata(key, nextMetadata);

  const status = await makeStatus(key, manifest);

  if (!status.complete) {
    throw new Error(
      `मॉडल cache अधूरा है (${status.cachedCount}/${status.total})।`
    );
  }

  return {
    ok: true,
    offline: false,
    backend: key,
    revision: manifest.revision,
    downloadedBytes: newlyDownloadedBytes,
    files: details,
    message:
      `${status.total} आवश्यक मॉडल संसाधन डाउनलोड, integrity-verified ` +
      'और Cache Storage में उपलब्ध हैं। यह सफल ONNX inference, ' +
      'सही उच्चारण या ऑडियो प्लेबैक का प्रमाण नहीं है।',
    ...status
  };
}

export async function clearVagdhenuModelCache() {
  if (typeof caches === 'undefined') {
    throw new Error('Cache Storage उपलब्ध नहीं है।');
  }

  const assetsCleared = await caches.delete(MODEL_CACHE_NAME);
  const metadataCleared = await caches.delete(META_CACHE_NAME);

  return assetsCleared || metadataCleared;
}

export const VAGDHENU_MODEL_ASSET_FILES = REQUIRED_FILES;
