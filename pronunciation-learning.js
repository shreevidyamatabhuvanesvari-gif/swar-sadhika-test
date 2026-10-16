/**
 * Swar-Sadhika local pronunciation reference notebook.
 * This module extracts acoustic descriptors; it does NOT train or modify AI weights.
 * Audio files are decoded locally. Video files are sampled locally for up to 20 seconds.
 * Only explicitly selected files are processed. No network requests are made here.
 */
const DB_NAME = 'swar-sadhika-pronunciation';
const DB_VERSION = 1;
const STORE = 'references';
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 180;
const MAX_VIDEO_SECONDS = 20;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('इस browser में IndexedDB उपलब्ध नहीं है।'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('स्थानीय डेटाबेस नहीं खुला।'));
  });
}
function transact(mode, operation) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try { result = operation(store); } catch (e) { db.close(); reject(e); return; }
    tx.oncomplete = () => { db.close(); resolve(result?.result ?? result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('स्थानीय डेटा ऑपरेशन विफल।')); };
  }));
}
function statsFromSamples(samples, sampleRate, channels = 1, maxSeconds = MAX_AUDIO_SECONDS) {
  const length = Math.min(samples.length, Math.floor(sampleRate * maxSeconds));
  const frame = Math.max(1024, Math.min(4096, 2 ** Math.floor(Math.log2(Math.max(1024, sampleRate * 0.04)))));
  const hop = Math.floor(frame / 2);
  const rmsValues = [], pitchValues = [];
  let peak = 0, sumSq = 0, count = 0;
  for (let i = 0; i < length; i++) { const v = samples[i] || 0; peak = Math.max(peak, Math.abs(v)); sumSq += v * v; count++; }
  let frameIndex = 0;
  for (let start = 0; start + frame < length; start += hop, frameIndex++) {
    let energy = 0;
    for (let j = 0; j < frame; j++) energy += samples[start + j] * samples[start + j];
    const rms = Math.sqrt(energy / frame); rmsValues.push(rms);
    if (rms < 0.012 || frameIndex % 3 !== 0 || start > sampleRate * 20) continue;
    const minLag = Math.max(2, Math.floor(sampleRate / 500));
    const maxLag = Math.min(Math.floor(sampleRate / 70), frame - 2);
    let bestLag = -1, bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0, a = 0, b = 0;
      for (let j = 0; j < frame - lag; j += 4) {
        const x = samples[start + j], y = samples[start + j + lag];
        corr += x * y; a += x * x; b += y * y;
      }
      const norm = corr / Math.sqrt((a || 1e-12) * (b || 1e-12));
      if (norm > bestCorr) { bestCorr = norm; bestLag = lag; }
    }
    if (bestLag > 0 && bestCorr > 0.55) pitchValues.push(sampleRate / bestLag);
  }
  const sortedPitch = pitchValues.slice().sort((a,b)=>a-b);
  const median = sortedPitch.length ? sortedPitch[Math.floor(sortedPitch.length / 2)] : null;
  const meanRms = rmsValues.length ? rmsValues.reduce((a,b)=>a+b,0)/rmsValues.length : 0;
  let quietFrames = 0; for (const v of rmsValues) if (v < 0.012) quietFrames++;
  return {
    durationSeconds: Number((length / sampleRate).toFixed(2)), sampleRate, channels,
    peakAmplitude: Number(peak.toFixed(4)), meanRms: Number(meanRms.toFixed(4)),
    quietFrameRatio: rmsValues.length ? Number((quietFrames / rmsValues.length).toFixed(3)) : null,
    estimatedPitchHzMedian: median ? Number(median.toFixed(1)) : null,
    estimatedPitchFrameCount: pitchValues.length,
    analysisFrames: rmsValues.length,
    method: 'local-signal-descriptors-v1',
    limitations: 'Pitch is a rough autocorrelation estimate from sampled frames in the first 20 seconds, not phoneme recognition, Vedic accent validation, or a singing-quality score.'
  };
}
async function decodeAudioFile(file) {
  const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtx) throw new Error('इस browser में Web Audio API उपलब्ध नहीं है।');
  const ctx = new AudioCtx();
  try {
    const buffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const duration = Math.min(decoded.duration, MAX_AUDIO_SECONDS);
    const length = Math.floor(duration * decoded.sampleRate);
    const mono = new Float32Array(length);
    const channels = decoded.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += (data[i] || 0) / channels;
    }
    return statsFromSamples(mono, decoded.sampleRate, channels, MAX_AUDIO_SECONDS);
  } finally { await ctx.close().catch(()=>{}); }
}
async function analyzeVideoFile(file, onProgress = () => {}) {
  const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtx) throw new Error('इस browser में Web Audio API उपलब्ध नहीं है।');
  const url = URL.createObjectURL(file), video = document.createElement('video'), ctx = new AudioCtx();
  video.preload = 'auto'; video.playsInline = true; video.src = url;
  let source, analyser, mute;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('वीडियो metadata पढ़ा नहीं जा सका; यह codec समर्थित न हो सकता है।'));
      video.load();
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('वीडियो अवधि उपलब्ध नहीं है।');
    source = ctx.createMediaElementSource(video); analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    mute = ctx.createGain(); mute.gain.value = 0;
    source.connect(analyser); analyser.connect(mute); mute.connect(ctx.destination);
    await ctx.resume();
    const data = new Float32Array(analyser.fftSize), captured = [];
    const target = Math.min(MAX_VIDEO_SECONDS, video.duration), start = performance.now();
    await video.play();
    while (video.currentTime < target && !video.ended) {
      analyser.getFloatTimeDomainData(data);
      let rms = 0; for (let i=0;i<data.length;i++) rms += data[i]*data[i];
      captured.push(Math.sqrt(rms/data.length));
      onProgress(Math.min(99, Math.round(video.currentTime / target * 100)));
      if (performance.now() - start > (target * 1800 + 5000)) break;
      await new Promise(r => setTimeout(r, 80));
    }
    video.pause();
    const voiced = captured.filter(x => x >= 0.012);
    const meanRms = captured.length ? captured.reduce((a,b)=>a+b,0)/captured.length : 0;
    return {
      durationSeconds: Number(Math.min(video.currentTime, target).toFixed(2)), sampleRate: ctx.sampleRate, channels: 1,
      peakAmplitude: null, meanRms: Number(meanRms.toFixed(4)), quietFrameRatio: captured.length ? Number((1 - voiced.length/captured.length).toFixed(3)) : null,
      estimatedPitchHzMedian: null, estimatedPitchFrameCount: 0, analysisFrames: captured.length,
      method: 'local-video-rms-sampling-v1',
      limitations: `वीडियो से केवल ${Math.min(MAX_VIDEO_SECONDS, video.duration).toFixed(0)} सेकंड का RMS/शांत-खंड नमूना लिया गया; इस पथ में pitch estimation, phoneme recognition या Vedic accent validation नहीं है.`
    };
  } finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); await ctx.close().catch(()=>{}); }
}
export async function analyzeSelectedFile(file, text, onProgress) {
  if (!(file instanceof Blob)) throw new TypeError('पहले स्थानीय ऑडियो या वीडियो फ़ाइल चुनें।');
  if (file.size > MAX_FILE_BYTES) throw new Error('फ़ाइल 80 MB से बड़ी है; छोटी फ़ाइल चुनें।');
  if (!String(text || '').trim()) throw new Error('रिकॉर्डिंग से संबंधित शुद्ध संस्कृत पाठ लिखें।');
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name || '');
  const features = isVideo ? await analyzeVideoFile(file, onProgress) : await decodeAudioFile(file);
  return {
    text: String(text), fileName: String(file.name || 'local-media'), fileType: String(file.type || 'unknown'), fileSize: file.size,
    mediaKind: isVideo ? 'video' : 'audio', features, createdAt: new Date().toISOString(), schemaVersion: 1,
    note: 'स्थानीय विश्लेषण-मेमोरी; यह मॉडल के weights को प्रशिक्षित/बदलती नहीं है।'
  };
}
export async function saveReference(record) {
  return transact('readwrite', store => store.add(record));
}
export async function listReferences() {
  return transact('readonly', store => store.getAll()).then(rows => rows || []);
}
export async function deleteReference(id) {
  return transact('readwrite', store => store.delete(Number(id)));
}
export async function clearReferences() {
  return transact('readwrite', store => store.clear());
}
export async function exportReferences() {
  const rows = await listReferences();
  return new Blob([JSON.stringify({schemaVersion:1, exportedAt:new Date().toISOString(), records:rows}, null, 2)], {type:'application/json'});
}
