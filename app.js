/**
 * Swar-Sadhika — AI singing panel integration for the supplied index.html.
 *
 * Scope:
 * - Only extends #panel-ai.
 * - Does not replace the existing Browser TTS, queue, photo/video,
 *   fullscreen or Canvas recording controller.
 * - Does not generate fake audio or use Browser TTS as AI singing.
 *
 * Expected engine contract from ./index.js:
 *   VagdhenuWebEngine
 *   engine.setBackendMode(mode)       (where supported)
 *   engine.initOnnxSessions(progress)
 *   engine.synthesizeInBrowser(text, options, progress)
 *
 * Static syntax validation is not proof of successful model inference.
 */

const INDEX_MODULE_URL = new URL('./index.js', import.meta.url).href;
const MAX_INPUT_LENGTH = 200_000;

const appState = {
  module: null,
  Engine: null,
  engine: null,
  backend: 'wasm',
  engineBackend: null,
  initializedBackend: null,
  initPromise: null,
  busy: false,
  runToken: 0,
  audioUrl: null,
  ownsAudioUrl: false,
  lastResult: null,
  lastError: null
};

const $ = (selector, root = document) => root.querySelector(selector);

function element(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      node.className = value;
    } else if (key === 'dataset' && value && typeof value === 'object') {
      for (const [name, data] of Object.entries(value)) {
        node.dataset[name] = String(data);
      }
    } else if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, String(value));
    }
  }

  if (text) node.textContent = text;
  return node;
}

/* Add controls only to the existing AI panel. */
function addAiControls() {
  const panelBody = $('#panel-ai .panel-body');

  if (!panelBody) {
    console.error(
      '[Swar-Sadhika AI] #panel-ai .panel-body नहीं मिला।'
    );
    return false;
  }

  if ($('#ss-ai-runtime')) return true;

  const wrapper = element('section', {
    id: 'ss-ai-runtime',
    className: 'panel'
  });

  wrapper.style.marginTop = '14px';

  wrapper.innerHTML = `
    <div class="panel-head">
      <h2>वास्तविक AI गायन — इंजन नियंत्रण</h2>
      <p>
        यह पैनल मौजूदा स्टूडियो और Browser Voice को नहीं बदलता।
        वास्तविक मॉडल inference और ऑडियो परिणाम अलग से जाँचे जाएँगे।
      </p>
    </div>

    <div class="panel-body">
      <div class="field">
        <label for="ss-ai-text">संस्कृत / वैदिक पाठ</label>
        <textarea
          id="ss-ai-text"
          lang="sa-Deva"
          spellcheck="false"
          maxlength="200000"
        >ॐ नमः शिवाय॥</textarea>
        <div class="hint">
          मूल इनपुट को trim या पुनर्लेखित किए बिना इंजन को भेजा जाएगा।
          केवल खाली पाठ और निर्धारित अधिकतम लंबाई की जाँच की जाती है।
        </div>
      </div>

      <div class="two-col">
        <div class="field">
          <label for="ss-ai-backend">Inference backend</label>
          <select id="ss-ai-backend">
            <option value="wasm">WASM</option>
            <option value="webgpu">WebGPU</option>
          </select>
        </div>

        <div class="field">
          <label for="ss-ai-meter">छन्द / meter</label>
          <select id="ss-ai-meter">
            <option value="auto">स्वचालित (auto)</option>
            <option value="anushtubh">अनुष्टुप्</option>
            <option value="gayatri">गायत्री</option>
            <option value="trishtubh">त्रिष्टुप्</option>
            <option value="jagati">जगती</option>
          </select>
        </div>

        <div class="field">
          <label for="ss-ai-speed">
            गति: <output id="ss-ai-speed-value">0.90</output>
          </label>
          <input
            id="ss-ai-speed"
            type="range"
            min="0.55"
            max="1.25"
            step="0.05"
            value="0.90"
          >
        </div>

        <div class="field">
          <label class="check-row" for="ss-ai-no-sandhi">
            <input id="ss-ai-no-sandhi" type="checkbox">
            सन्धि-प्रक्रिया न करें
          </label>
          <p class="hint">
            इसका प्रभाव upstream इंजन के वास्तविक व्यवहार पर निर्भर है।
          </p>
        </div>
      </div>

      <div class="btn-row" style="margin:10px 0">
        <button class="btn secondary" id="ss-ai-copy-studio" type="button">
          Studio पाठ यहाँ लाएँ
        </button>
        <button class="btn secondary" id="ss-ai-init" type="button">
          इंजन आरम्भ करें
        </button>
        <button class="btn primary" id="ss-ai-generate" type="button">
          AI गायन ऑडियो बनाएँ
        </button>
        <button class="btn danger" id="ss-ai-stop" type="button" disabled>
          परिणाम / Playback रोकें
        </button>
      </div>

      <div
        id="ss-ai-status"
        class="status warn"
        role="status"
        aria-live="polite"
      >
        इंजन अभी लोड नहीं हुआ है।
      </div>

      <div class="progress-meta">
        <span>प्रक्रिया</span>
        <strong id="ss-ai-progress-label">0%</strong>
      </div>

      <div
        id="ss-ai-progress-track"
        class="progress-track"
        role="progressbar"
        aria-label="AI इंजन प्रगति"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="0"
      >
        <div id="ss-ai-progress-bar" class="progress-bar"></div>
      </div>

      <audio
        id="ss-ai-audio"
        class="media-player"
        controls
        preload="metadata"
        hidden
      ></audio>

      <div class="btn-row" style="margin-top:10px">
        <a
          id="ss-ai-download"
          class="btn secondary"
          hidden
          download="swar-sadhika-ai-chant.wav"
        >AI ऑडियो डाउनलोड करें</a>
      </div>

      <details id="ss-ai-diagnostics-wrap" style="margin-top:12px">
        <summary>तकनीकी विवरण / त्रुटि</summary>
        <pre
          id="ss-ai-diagnostics"
          style="white-space:pre-wrap;overflow-wrap:anywhere"
        ></pre>
      </details>

      <p class="hint" style="margin-top:10px">
        ऑडियो परिणाम मिलना अपने-आप महिला स्वर, मधुरता, वैदिक स्वरचिह्नों
        की शुद्धता या शास्त्रीय छन्द-पालन का प्रमाण नहीं है।
        पहली बार मॉडल और Runtime डाउनलोड करने के लिए इंटरनेट लग सकता है।
      </p>
    </div>
  `;

  panelBody.appendChild(wrapper);
  return true;
}

function setStatus(message, kind = 'warn') {
  const status = $('#ss-ai-status');
  if (!status) return;

  status.textContent = String(message ?? '');
  status.classList.remove('good', 'warn', 'bad');
  status.classList.add(kind);
  status.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
}

function setProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;

  const percent = Math.max(
    0,
    Math.min(100, number <= 1 ? number * 100 : number)
  );

  const bar = $('#ss-ai-progress-bar');
  const label = $('#ss-ai-progress-label');
  const track = $('#ss-ai-progress-track');

  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = `${Math.round(percent)}%`;

  if (track) {
    track.setAttribute(
      'aria-valuenow',
      String(Math.round(percent))
    );
  }
}

function setDiagnostics(error, extra = '') {
  const text = $('#ss-ai-diagnostics');
  const wrap = $('#ss-ai-diagnostics-wrap');

  if (text) {
    const message = error instanceof Error
      ? error.message
      : String(error);

    const stack = error instanceof Error && error.stack
      ? `\n\n${error.stack}`
      : '';

    text.textContent =
      `${message}${extra ? `\n${extra}` : ''}${stack}`;
  }

  if (wrap) {
    wrap.hidden = false;
    wrap.open = true;
  }
}

function clearDiagnostics() {
  const text = $('#ss-ai-diagnostics');
  const wrap = $('#ss-ai-diagnostics-wrap');

  if (text) text.textContent = '';
  if (wrap) wrap.open = false;
}

function updateButtons() {
  const initialized =
    Boolean(appState.engine) &&
    appState.initializedBackend === appState.backend;

  const init = $('#ss-ai-init');
  const generate = $('#ss-ai-generate');
  const stop = $('#ss-ai-stop');
  const backend = $('#ss-ai-backend');
  const text = $('#ss-ai-text');
  const audio = $('#ss-ai-audio');

  if (init) {
    init.disabled = appState.busy || initialized;
  }

  if (generate) {
    generate.disabled =
      appState.busy || !String(text?.value ?? '').trim();
  }

  if (stop) {
    const isPlaying = Boolean(audio && !audio.paused);
    stop.disabled = !appState.busy && !isPlaying;
  }

  if (backend) {
    backend.disabled = appState.busy;
  }
}

function moduleConstructor(namespace) {
  const candidates = [
    namespace?.VagdhenuWebEngine,
    namespace?.default?.VagdhenuWebEngine,
    namespace?.default,
    namespace?.Engine
  ];

  return candidates.find(
    candidate => typeof candidate === 'function'
  ) || null;
}

async function loadModule() {
  if (appState.module && appState.Engine) return;

  setStatus('स्थानीय ./index.js module लोड हो रहा है…');

  const namespace = await import(INDEX_MODULE_URL);
  const Engine = moduleConstructor(namespace);

  if (!Engine) {
    throw new Error(
      `./index.js में VagdhenuWebEngine constructor नहीं मिला। ` +
      `उपलब्ध exports: ${Object.keys(namespace).join(', ') || '(none)'}`
    );
  }

  appState.module = namespace;
  appState.Engine = Engine;
}

function reportProgress(info) {
  if (!info || typeof info !== 'object') return;

  if (Number.isFinite(Number(info.progress))) {
    setProgress(Number(info.progress));
  }

  if (info.message) {
    setStatus(String(info.message));
    return;
  }

  const stage = String(info.stage || '').toLowerCase();

  const labels = {
    'session-init': 'ONNX/model sessions आरम्भ हो रहे हैं…',
    'model-download': 'मॉडल फ़ाइलें डाउनलोड/लोड हो रही हैं…',
    'inference': 'मॉडल inference से ऑडियो बनाया जा रहा है…',
    'complete': 'इंजन ने ऑडियो परिणाम लौटाया।'
  };

  if (labels[stage]) {
    setStatus(
      labels[stage],
      stage === 'complete' ? 'good' : 'warn'
    );
  }
}

async function ensureEngine() {
  await loadModule();

  const selectedBackend = String(
    $('#ss-ai-backend')?.value || 'wasm'
  ).toLowerCase();

  if (!['wasm', 'webgpu'].includes(selectedBackend)) {
    throw new TypeError(`असमर्थित backend: ${selectedBackend}`);
  }

  if (!appState.engine) {
    appState.engine = new appState.Engine(
      null,
      selectedBackend
    );

    appState.backend = selectedBackend;
    appState.engineBackend = selectedBackend;
    appState.initializedBackend = null;
  } else if (appState.engineBackend !== selectedBackend) {
    if (typeof appState.engine.setBackendMode !== 'function') {
      throw new Error(
        'यह engine backend बदलने के लिए setBackendMode() उपलब्ध नहीं कराता। ' +
        'पृष्ठ reload करके दूसरा backend चुनें।'
      );
    }

    await appState.engine.setBackendMode(selectedBackend);

    appState.backend = selectedBackend;
    appState.engineBackend = selectedBackend;
    appState.initializedBackend = null;
  }

  if (typeof appState.engine.initOnnxSessions !== 'function') {
    throw new Error(
      'इंजन में initOnnxSessions() उपलब्ध नहीं है। index.js adapter जाँचें।'
    );
  }

  if (typeof appState.engine.synthesizeInBrowser !== 'function') {
    throw new Error(
      'इंजन में synthesizeInBrowser() उपलब्ध नहीं है। ' +
      'वास्तविक synthesis नहीं चलाई जा सकती।'
    );
  }

  return appState.engine;
}

async function initializeEngine(preserveBusy = false) {
  if (
    appState.engine &&
    appState.initializedBackend === appState.backend
  ) {
    setStatus(
      `इंजन पहले से आरम्भ है (${appState.backend.toUpperCase()})।`,
      'good'
    );
    return appState.engine;
  }

  if (appState.initPromise) {
    return appState.initPromise;
  }

  appState.busy = true;
  updateButtons();
  setProgress(0);
  clearDiagnostics();

  appState.initPromise = (async () => {
    const engine = await ensureEngine();

    setStatus(
      `${appState.backend.toUpperCase()} backend के model sessions ` +
      'तैयार हो रहे हैं… पहली बार इसमें समय लग सकता है।'
    );

    const result = await engine.initOnnxSessions(reportProgress);

    if (result && result.ok === false) {
      throw new Error(
        'इंजन ने model session initialization असफल बताया।'
      );
    }

    appState.initializedBackend = appState.backend;
    setProgress(100);

    setStatus(
      `Engine session initialization पूरा हुआ ` +
      `(${appState.backend.toUpperCase()})।`,
      'good'
    );

    return engine;
  })();

  try {
    return await appState.initPromise;
  } catch (error) {
    appState.lastError = error;

    setStatus(
      `इंजन आरम्भ नहीं हुआ: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'bad'
    );

    setDiagnostics(error, `Module URL: ${INDEX_MODULE_URL}`);
    throw error;
  } finally {
    appState.initPromise = null;

    if (!preserveBusy) {
      appState.busy = false;
    }

    updateButtons();
  }
}

/* Read the input exactly as entered; trim is used only for empty-input testing. */
function getExactInputText() {
  const raw = String($('#ss-ai-text')?.value ?? '');

  if (!raw.trim()) {
    throw new Error('AI गायन के लिए संस्कृत पाठ दर्ज करें।');
  }

  if (raw.length > MAX_INPUT_LENGTH) {
    throw new RangeError(
      `पाठ ${MAX_INPUT_LENGTH} UTF-16 units से बड़ा है।`
    );
  }

  return raw;
}

function audioBufferToWavBlob(audioBuffer) {
  const channels = Math.max(
    1,
    Number(audioBuffer.numberOfChannels) || 1
  );

  const frames = Number(audioBuffer.length) || 0;
  const sampleRate = Math.round(
    Number(audioBuffer.sampleRate) || 24000
  );

  if (
    !frames ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  ) {
    throw new Error('इंजन ने खाली या अमान्य AudioBuffer लौटाया।');
  }

  const dataBytes = frames * channels * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);

  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);

  const channelData = Array.from(
    { length: channels },
    (_, channel) => audioBuffer.getChannelData(channel)
  );

  let offset = 44;

  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = Math.max(
        -1,
        Math.min(
          1,
          Number(channelData[channel][frame]) || 0
        )
      );

      view.setInt16(
        offset,
        value < 0 ? value * 0x8000 : value * 0x7fff,
        true
      );

      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function blobLike(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function resultAudio(result) {
  if (
    typeof result === 'string' &&
    /^(blob:|data:|https?:\/\/)/i.test(result)
  ) {
    return {
      url: result,
      owned: false,
      blob: null
    };
  }

  if (blobLike(result)) {
    return {
      url: URL.createObjectURL(result),
      owned: true,
      blob: result
    };
  }

  if (!result || typeof result !== 'object') {
    throw new Error(
      'इंजन ने पहचानने योग्य audio परिणाम नहीं लौटाया।'
    );
  }

  const url =
    result.audioUrl ||
    result.url ||
    result.wavUrl ||
    result.outputUrl ||
    result.audioSrc ||
    result.src;

  if (typeof url === 'string' && url) {
    return {
      url,
      owned: false,
      blob:
        result.blob ||
        result.audioBlob ||
        result.wavBlob ||
        null
    };
  }

  const blob =
    result.blob ||
    result.audioBlob ||
    result.wavBlob ||
    result.audioWav ||
    (blobLike(result.wav) ? result.wav : null);

  if (blobLike(blob)) {
    return {
      url: URL.createObjectURL(blob),
      owned: true,
      blob
    };
  }

  const audioBuffer = result.audioBuffer || result.buffer;

  if (
    audioBuffer &&
    typeof audioBuffer.getChannelData === 'function'
  ) {
    const wav = audioBufferToWavBlob(audioBuffer);

    return {
      url: URL.createObjectURL(wav),
      owned: true,
      blob: wav
    };
  }

  throw new Error(
    'इंजन परिणाम में audioUrl, audio Blob या AudioBuffer नहीं मिला। ' +
    'कोई नकली ऑडियो नहीं बनाया गया।'
  );
}

function revokePreviousAudioUrl() {
  if (appState.ownsAudioUrl && appState.audioUrl) {
    URL.revokeObjectURL(appState.audioUrl);
  }

  appState.audioUrl = null;
  appState.ownsAudioUrl = false;
}

function applyAudioResult(result, token) {
  if (token !== appState.runToken) return;

  const audioInfo = resultAudio(result);
  const audio = $('#ss-ai-audio');
  const download = $('#ss-ai-download');

  if (!audio) {
    throw new Error(
      'AI परिणाम के लिए audio player उपलब्ध नहीं है।'
    );
  }

  revokePreviousAudioUrl();

  appState.audioUrl = audioInfo.url;
  appState.ownsAudioUrl = audioInfo.owned;
  appState.lastResult = result;

  audio.pause();
  audio.src = audioInfo.url;
  audio.hidden = false;
  audio.load();

  if (download) {
    download.href = audioInfo.url;
    download.download = 'swar-sadhika-ai-chant.wav';
    download.hidden = false;
  }

  audio.onloadedmetadata = () => {
    if (token !== appState.runToken) return;

    const duration = Number(audio.duration);

    const durationText =
      Number.isFinite(duration) && duration > 0
        ? ` अवधि लगभग ${duration.toFixed(2)} सेकंड है।`
        : '';

    setStatus(
      'मॉडल ने ऑडियो परिणाम लौटाया।' +
      durationText +
      ' Playback और उच्चारण गुणवत्ता अलग से जाँचें; ' +
      'यह महिला स्वर या शास्त्रीय शुद्धता का प्रमाण नहीं है।',
      'good'
    );
  };

  audio.onerror = () => {
    if (token !== appState.runToken) return;

    setStatus(
      'मॉडल ने परिणाम लौटाया, लेकिन browser audio player इसे पढ़ नहीं पाया। ' +
      'Codec, Blob/URL और console जाँचें।',
      'bad'
    );
  };
}

async function generateAudio() {
  if (appState.busy) return;

  const text = getExactInputText();
  const token = ++appState.runToken;

  appState.busy = true;
  appState.lastError = null;

  updateButtons();
  clearDiagnostics();
  setProgress(0);

  try {
    const engine = await initializeEngine(true);

    if (token !== appState.runToken) return;

    setStatus(
      'Vāgdhenu model inference चल रहा है। परिणाम आने तक पृष्ठ खुला रखें…'
    );

    const speedValue = Number(
      $('#ss-ai-speed')?.value ?? 0.9
    );

    const options = {
      meter: String($('#ss-ai-meter')?.value || 'auto'),
      speed: Number.isFinite(speedValue) ? speedValue : 0.9,
      noSandhi: Boolean($('#ss-ai-no-sandhi')?.checked)
    };

    const result = await engine.synthesizeInBrowser(
      text,
      options,
      reportProgress
    );

    if (token !== appState.runToken) return;

    applyAudioResult(result, token);
    setProgress(100);
  } catch (error) {
    if (token !== appState.runToken) return;

    appState.lastError = error;

    setStatus(
      `AI गायन असफल: ${
        error instanceof Error ? error.message : String(error)
      }`,
      'bad'
    );

    setDiagnostics(
      error,
      `index.js: ${INDEX_MODULE_URL}\n` +
      'जाँचें कि index.js में VagdhenuWebEngine, ' +
      'initOnnxSessions() और synthesizeInBrowser() उपलब्ध हैं।'
    );

    console.error('[Swar-Sadhika AI] synthesis failed:', error);
  } finally {
    appState.busy = false;
    updateButtons();
  }
}

async function onInitialize() {
  if (appState.busy) return;

  try {
    await initializeEngine();
  } catch (error) {
    console.error(
      '[Swar-Sadhika AI] initialization failed:',
      error
    );
  }
}

function stopResultOrPendingInference() {
  /*
   * The adapter contract does not guarantee cancellable inference.
   * This invalidates late results and stops audio playback, but does not
   * claim that an already-running model computation has been interrupted.
   */
  appState.runToken += 1;

  const audio = $('#ss-ai-audio');

  if (audio) {
    audio.pause();

    try {
      audio.currentTime = 0;
    } catch {
      // Metadata may not have loaded.
    }
  }

  if (appState.busy) {
    setStatus(
      'रोकने का अनुरोध दर्ज हुआ। यदि adapter inference cancellation नहीं देता, ' +
      'तो model computation पूरा होने तक Generate नियंत्रण बंद रहेगा; ' +
      'पुराना परिणाम लागू नहीं होगा।',
      'warn'
    );
  } else {
    setStatus('ऑडियो Playback रोक दी गई।', 'warn');
  }

  updateButtons();
}

function bindAiEvents() {
  $('#ss-ai-init')?.addEventListener(
    'click',
    onInitialize
  );

  $('#ss-ai-generate')?.addEventListener('click', () => {
    try {
      generateAudio().catch(error => {
        setStatus(
          error instanceof Error ? error.message : String(error),
          'bad'
        );
      });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : String(error),
        'bad'
      );
    }
  });

  $('#ss-ai-stop')?.addEventListener(
    'click',
    stopResultOrPendingInference
  );

  $('#ss-ai-text')?.addEventListener(
    'input',
    updateButtons
  );

  $('#ss-ai-speed')?.addEventListener('input', () => {
    const output = $('#ss-ai-speed-value');

    if (output) {
      output.textContent = Number(
        $('#ss-ai-speed').value
      ).toFixed(2);
    }
  });

  $('#ss-ai-backend')?.addEventListener('change', () => {
    if (appState.busy) return;

    appState.backend = String(
      $('#ss-ai-backend').value || 'wasm'
    );

    appState.initializedBackend = null;

    setStatus(
      `Backend ${appState.backend.toUpperCase()} चुना गया। ` +
      'अगली initialization पर लागू होगा।',
      'warn'
    );

    updateButtons();
  });

  $('#ss-ai-copy-studio')?.addEventListener('click', () => {
    const source = $('#text-input');
    const target = $('#ss-ai-text');

    if (
      !source ||
      !String(source.value || '').trim() ||
      !target
    ) {
      setStatus(
        'Studio के पाठ बॉक्स में पहले संस्कृत पाठ लिखें।',
        'warn'
      );
      return;
    }

    target.value = source.value;
    updateButtons();

    setStatus(
      'Studio का पाठ AI परीक्षण बॉक्स में कॉपी हुआ; ' +
      'मूल Studio पाठ नहीं बदला गया।',
      'good'
    );
  });

  $('#ss-ai-audio')?.addEventListener(
    'play',
    updateButtons
  );

  $('#ss-ai-audio')?.addEventListener(
    'pause',
    updateButtons
  );
}

function boot() {
  if (!addAiControls()) return;

  bindAiEvents();
  updateButtons();

  window.addEventListener('beforeunload', () => {
    const audio = $('#ss-ai-audio');

    if (audio) audio.pause();

    revokePreviousAudioUrl();
  }, { once: true });

  console.info(
    '[Swar-Sadhika AI] app.js loaded. ' +
    'AI engine user action तक initialize नहीं होगा।'
  );
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    boot,
    { once: true }
  );
} else {
  boot();
}
