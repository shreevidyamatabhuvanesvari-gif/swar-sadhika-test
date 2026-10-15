/**
 * Swar-Sadhika — browser UI controller for the Vāgdhenu singing adapter.
 *
 * Expected local files in the same directory:
 *   index.html, index.js, vagdhenu-onnx.js, vagdhenu-text.js
 *
 * This file is an interface/controller, not an audio model. It never substitutes
 * browser SpeechSynthesis or fabricated audio for the Vāgdhenu inference result.
 */

const APP_VERSION = '1.0.0';
const ENGINE_MODULE_URL = new URL('./index.js', import.meta.url).href;

const SELECTORS = Object.freeze({
  text: [
    '#verse', '#sanskritText', '#chantText', '#mantraText', '#shlokaText',
    '#inputText', '#textInput', '#text', '#verseInput', '#chant-input',
    'textarea[data-role="chant-text"]', 'textarea[name="text"]',
    'textarea[name="verse"]', 'textarea'
  ],
  generate: [
    '#generate', '#generateBtn', '#synthesize', '#synthesizeBtn',
    '#sing', '#singBtn', '#createAudio', '#createAudioBtn',
    '[data-action="generate"]', '[data-action="synthesize"]', '[data-action="sing"]'
  ],
  initialize: [
    '#initBtn', '#initializeBtn', '#initializeEngine', '#loadEngine',
    '[data-action="initialize-engine"]'
  ],
  status: ['#status', '#engineStatus', '#statusText', '#synthesisStatus', '[data-role="status"]'],
  progress: ['#progress', '#progressBar', '#synthesisProgress', '[data-role="progress"]'],
  audio: ['#audio', '#audioPlayer', '#resultAudio', '#generatedAudio', 'audio[data-role="result"]'],
  download: ['#download', '#downloadBtn', '#downloadAudio', '#downloadWav', '[data-action="download"]'],
  resultActions: ['#result-actions', '#resultActions', '#audioActions', '[data-role="result-actions"]'],
  diagnostics: ['#diagnostics-text', '#diagnosticsText', '#errorDetails', 'pre[data-role="diagnostics"]'],
  diagnosticsWrap: ['#diagnostics', '#diagnosticsPanel', 'details[data-role="diagnostics"]'],
  backend: ['#backend', '#backendMode', '#backendSelect', '#engineBackend', 'select[name="backend"]'],
  meter: ['#meter', '#metre', '#chhanda', '#meterSelect', '#chhandaSelect', 'select[name="meter"]'],
  speed: ['#speed', '#singingSpeed', '#rate', '#speedSelect', 'input[name="speed"]'],
  noSandhi: ['#noSandhi', '#no-sandhi', 'input[name="noSandhi"]'],
  pause: ['#pauseAudio', '#pauseBtn', '#pause', '[data-action="pause-audio"]'],
  stop: ['#stopAudio', '#stopBtn', '#stop', '[data-action="stop-audio"]'],
  addQueue: ['#addToQueue', '#addQueueBtn', '[data-action="queue-add"]'],
  playQueue: ['#playQueue', '#playQueueBtn', '[data-action="queue-play"]'],
  clearQueue: ['#clearQueue', '#clearQueueBtn', '[data-action="queue-clear"]'],
  queue: ['#queueList', '#chantQueue', '[data-role="queue"]']
});

const state = {
  engineModule: null,
  engine: null,
  backend: 'wasm',
  initialized: false,
  initializing: false,
  synthesizing: false,
  runToken: 0,
  currentResult: null,
  currentAudioUrl: null,
  audioObjectUrls: new Set(),
  queue: [],
  queueIndex: -1,
  queueRunning: false,
  lastError: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function firstMatch(keys) {
  for (const selector of keys) {
    const element = $(selector);
    if (element) return element;
  }
  return null;
}

function findByButtonText(words) {
  const buttons = $$('button, input[type="button"], input[type="submit"]');
  return buttons.find((button) => {
    const text = `${button.textContent || ''} ${button.value || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
    return words.some((word) => text.includes(word));
  }) || null;
}

function makeEl(tag, attrs = {}, text = '') {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'dataset' && value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        element.dataset[k] = String(v);
      });
    } else if (key in element && key !== 'style') {
      element[key] = value;
    } else {
      element.setAttribute(key, String(value));
    }
  }

  if (text) element.textContent = text;
  return element;
}

function injectFallbackUi() {
  const host = $('main') || $('#app') || $('#swar-sadhika-app') || document.body;
  const root = makeEl('section', {
    id: 'swar-sadhika-runtime-ui',
    className: 'ss-runtime-panel'
  });

  root.innerHTML = `
    <style>
      #swar-sadhika-runtime-ui{box-sizing:border-box;max-width:820px;margin:18px auto;padding:clamp(14px,4vw,24px);border:1px solid #d7c9b5;border-radius:18px;background:#fffaf2;color:#29231d;font:16px/1.6 system-ui,-apple-system,sans-serif;box-shadow:0 10px 28px #35220c12}
      #swar-sadhika-runtime-ui *{box-sizing:border-box}#swar-sadhika-runtime-ui h2{margin:0 0 6px;font-size:1.35rem}#swar-sadhika-runtime-ui p{margin:5px 0 12px}
      #swar-sadhika-runtime-ui label{display:block;font-weight:650;margin:12px 0 5px}#swar-sadhika-runtime-ui textarea,#swar-sadhika-runtime-ui select,#swar-sadhika-runtime-ui input[type=number]{width:100%;padding:11px;border:1px solid #cbbca8;border-radius:10px;font:inherit;background:#fff;color:#29231d}
      #swar-sadhika-runtime-ui textarea{min-height:155px;line-height:1.9}#swar-sadhika-runtime-ui .ss-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#swar-sadhika-runtime-ui .ss-actions{display:flex;flex-wrap:wrap;gap:9px;margin:15px 0}
      #swar-sadhika-runtime-ui button,#swar-sadhika-runtime-ui a.ss-button{border:0;border-radius:10px;padding:10px 15px;background:#583e2b;color:white;font:inherit;font-weight:650;text-decoration:none;cursor:pointer}
      #swar-sadhika-runtime-ui button:disabled{opacity:.55;cursor:not-allowed}#swar-sadhika-runtime-ui #ss-status{padding:10px 12px;background:#f3eadb;border-radius:10px;overflow-wrap:anywhere}#swar-sadhika-runtime-ui #ss-status[data-kind=error]{background:#ffeded;color:#8b1f1f}#swar-sadhika-runtime-ui #ss-status[data-kind=ok]{background:#e8f6e9;color:#14532d}
      #swar-sadhika-runtime-ui progress{width:100%;height:10px}#swar-sadhika-runtime-ui audio{display:block;width:100%;margin:14px 0}#swar-sadhika-runtime-ui .ss-muted{font-size:.88rem;color:#6e6357}#swar-sadhika-runtime-ui details{margin-top:12px}#swar-sadhika-runtime-ui pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem}
      @media(max-width:520px){#swar-sadhika-runtime-ui .ss-grid{grid-template-columns:1fr}}
    </style>
    <h2>स्वर-साधिका</h2>
    <p>संस्कृत श्लोक, मन्त्र, स्तोत्र अथवा ऋचा के लिए Vāgdhenu गायन इंजन।</p>
    <label for="ss-text">पाठ</label>
    <textarea id="ss-text" data-role="chant-text" spellcheck="false" placeholder="यहाँ संस्कृत पाठ लिखें या चिपकाएँ…">ॐ नमः शिवाय॥</textarea>
    <div class="ss-grid">
      <div>
        <label for="ss-meter">छन्द / मीटर</label>
        <select id="ss-meter">
          <option value="auto">स्वचालित (auto)</option>
          <option value="anushtubh">अनुष्टुप्</option>
          <option value="gayatri">गायत्री</option>
          <option value="trishtubh">त्रिष्टुप्</option>
          <option value="jagati">जगती</option>
        </select>
      </div>
      <div>
        <label for="ss-backend">इंजन backend</label>
        <select id="ss-backend">
          <option value="wasm">WASM (व्यापक संगतता)</option>
          <option value="webgpu">WebGPU (संगत डिवाइस पर)</option>
        </select>
      </div>
      <div>
        <label for="ss-speed">गति (speed): <span id="ss-speed-value">0.9</span></label>
        <input id="ss-speed" type="range" min="0.55" max="1.25" step="0.05" value="0.9">
      </div>
      <div>
        <label><input id="ss-no-sandhi" type="checkbox"> सन्धि-प्रक्रिया न करें</label>
        <p class="ss-muted">यह विकल्प इंजन को उपलब्ध कराया जाएगा; इसका प्रभाव upstream मॉडल पर निर्भर है।</p>
      </div>
    </div>
    <div class="ss-actions">
      <button id="ss-init" type="button">इंजन तैयार करें</button>
      <button id="ss-generate" type="button">गायन ऑडियो बनाएँ</button>
      <button id="ss-add-queue" type="button">Queue में जोड़ें</button>
      <button id="ss-play-queue" type="button">Queue चलाएँ</button>
      <button id="ss-clear-queue" type="button">Queue साफ़ करें</button>
    </div>
    <div id="ss-status" role="status" aria-live="polite" data-kind="info">इंजन अभी आरम्भ नहीं हुआ है।</div>
    <progress id="ss-progress" max="100" value="0" aria-label="प्रक्रिया की प्रगति"></progress>
    <audio id="ss-audio" controls preload="metadata" hidden></audio>
    <div class="ss-actions">
      <a id="ss-download" class="ss-button" href="#" download="swar-sadhika-chant.wav" hidden>WAV डाउनलोड करें</a>
      <button id="ss-pause" type="button" disabled>विराम</button>
      <button id="ss-stop" type="button" disabled>रोकें</button>
    </div>
    <p class="ss-muted">पहली बार मॉडल/Runtime डाउनलोड होने में इंटरनेट और पर्याप्त समय लग सकता है। यह UI मॉडल-गायन का दावा तभी करेगी जब इंजन वास्तविक ऑडियो परिणाम लौटाएगा।</p>
    <details id="ss-diagnostics-wrap">
      <summary>तकनीकी विवरण</summary>
      <pre id="ss-diagnostics"></pre>
    </details>
    <h3>गायन Queue</h3>
    <ol id="ss-queue"></ol>`;

  host.appendChild(root);
}

function resolveDom() {
  let text = firstMatch(SELECTORS.text);
  let generate = firstMatch(SELECTORS.generate) || findByButtonText([
    'गायन ऑडियो', 'generate audio', 'synthesize', 'sing now', 'chant', 'गायन बनाएँ'
  ]);

  if (!text || !generate) {
    injectFallbackUi();
  }

  const result = {
    root: $('#swar-sadhika-runtime-ui') || $('main') || document.body,
    text: firstMatch(SELECTORS.text) || $('#ss-text'),
    generate: firstMatch(SELECTORS.generate) || $('#ss-generate') || findByButtonText([
      'गायन ऑडियो', 'generate audio', 'synthesize', 'sing now', 'chant', 'गायन बनाएँ'
    ]),
    initialize: firstMatch(SELECTORS.initialize) || $('#ss-init'),
    status: firstMatch(SELECTORS.status) || $('#ss-status'),
    progress: firstMatch(SELECTORS.progress) || $('#ss-progress'),
    audio: firstMatch(SELECTORS.audio) || $('#ss-audio'),
    download: firstMatch(SELECTORS.download) || $('#ss-download'),
    resultActions: firstMatch(SELECTORS.resultActions),
    diagnostics: firstMatch(SELECTORS.diagnostics) || $('#ss-diagnostics'),
    diagnosticsWrap: firstMatch(SELECTORS.diagnosticsWrap) || $('#ss-diagnostics-wrap'),
    backend: firstMatch(SELECTORS.backend) || $('#ss-backend'),
    meter: firstMatch(SELECTORS.meter) || $('#ss-meter'),
    speed: firstMatch(SELECTORS.speed) || $('#ss-speed'),
    noSandhi: firstMatch(SELECTORS.noSandhi) || $('#ss-no-sandhi'),
    pause: firstMatch(SELECTORS.pause) || $('#ss-pause'),
    stop: firstMatch(SELECTORS.stop) || $('#ss-stop'),
    addQueue: firstMatch(SELECTORS.addQueue) || $('#ss-add-queue'),
    playQueue: firstMatch(SELECTORS.playQueue) || $('#ss-play-queue'),
    clearQueue: firstMatch(SELECTORS.clearQueue) || $('#ss-clear-queue'),
    queue: firstMatch(SELECTORS.queue) || $('#ss-queue'),
    speedValue: $('#ss-speed-value')
  };

  return result;
}

const dom = typeof document !== 'undefined' ? resolveDom() : {};

function errorMessage(error) {
  if (error instanceof Error) return error.message;

  try {
    return String(error);
  } catch {
    return 'अज्ञात त्रुटि';
  }
}

function setStatus(message, kind = 'info') {
  if (!dom.status) return;

  dom.status.textContent = String(message ?? '');

  if (dom.status.dataset) {
    dom.status.dataset.kind = kind;
  }

  dom.status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

function setDiagnostics(error, extra = '') {
  if (!dom.diagnostics) return;

  const stack = error instanceof Error && error.stack ? `\n\n${error.stack}` : '';
  dom.diagnostics.textContent = [errorMessage(error), extra, stack].filter(Boolean).join('\n');

  if (dom.diagnosticsWrap) {
    dom.diagnosticsWrap.hidden = false;

    if ('open' in dom.diagnosticsWrap) {
      dom.diagnosticsWrap.open = true;
    }
  }
}

function clearDiagnostics() {
  if (dom.diagnostics) {
    dom.diagnostics.textContent = '';
  }

  if (dom.diagnosticsWrap && 'open' in dom.diagnosticsWrap) {
    dom.diagnosticsWrap.open = false;
  }
}

function setProgress(value) {
  if (!dom.progress) return;

  const raw = Number(value);
  if (!Number.isFinite(raw)) return;

  const percent = Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));

  if (dom.progress.tagName?.toLowerCase() === 'progress') {
    dom.progress.max = 100;
    dom.progress.value = percent;
  } else {
    dom.progress.style.width = `${percent}%`;
    dom.progress.setAttribute('aria-valuemin', '0');
    dom.progress.setAttribute('aria-valuemax', '100');
    dom.progress.setAttribute('aria-valuenow', String(Math.round(percent)));
  }
}

function updateControls() {
  if (dom.initialize) {
    dom.initialize.disabled = state.initializing || state.synthesizing || state.initialized;
  }

  if (dom.generate) {
    dom.generate.disabled = state.initializing || state.synthesizing;
  }

  if (dom.addQueue) {
    dom.addQueue.disabled = !dom.text || !String(dom.text.value || '').trim();
  }

  if (dom.playQueue) {
    dom.playQueue.disabled = state.queueRunning || state.queue.length === 0;
  }

  if (dom.clearQueue) {
    dom.clearQueue.disabled = state.queueRunning || state.queue.length === 0;
  }

  if (dom.pause) {
    dom.pause.disabled = !dom.audio || dom.audio.paused || !dom.audio.currentSrc;
  }

  if (dom.stop) {
    dom.stop.disabled = !dom.audio || (
      !dom.audio.currentSrc && !state.synthesizing && !state.queueRunning
    );
  }

  if (dom.backend) {
    dom.backend.disabled = state.initializing || state.synthesizing;
  }
}

function progressCallback(info) {
  if (!info || typeof info !== 'object') return;

  if (Number.isFinite(Number(info.progress))) {
    setProgress(info.progress);
  }

  const stage = String(info.stage || '').toLowerCase();

  const messages = {
    'session-init': 'गायन इंजन और मॉडल सत्र तैयार हो रहे हैं…',
    'model-download': 'मॉडल फ़ाइलें लोड/डाउनलोड हो रही हैं…',
    'inference': 'संस्कृत पाठ से ऑडियो बनाया जा रहा है…',
    'complete': 'ऑडियो परिणाम तैयार है।'
  };

  if (info.message) {
    setStatus(String(info.message));
  } else if (messages[stage]) {
    setStatus(messages[stage]);
  }
}

async function loadEngineModule() {
  if (state.engineModule) {
    return state.engineModule;
  }

  setStatus('स्थानीय ./index.js adapter लोड हो रहा है…');

  const moduleNamespace = await import(ENGINE_MODULE_URL);

  const Engine = moduleNamespace.VagdhenuWebEngine
    || moduleNamespace.default?.VagdhenuWebEngine
    || moduleNamespace.default
    || moduleNamespace.Engine;

  if (typeof Engine !== 'function') {
    throw new Error(
      `./index.js से VagdhenuWebEngine constructor नहीं मिला। उपलब्ध exports: ${Object.keys(moduleNamespace).join(', ') || '(कोई नहीं)'}`
    );
  }

  state.engineModule = moduleNamespace;
  state.EngineConstructor = Engine;

  return moduleNamespace;
}

async function ensureEngineInitialized(forceInit = true) {
  if (state.initialized && state.engine) {
    return state.engine;
  }

  if (state.initializing) {
    while (state.initializing) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (state.initialized && state.engine) {
      return state.engine;
    }
  }

  state.initializing = true;
  updateControls();
  clearDiagnostics();
  setProgress(0);

  try {
    await loadEngineModule();

    const requestedBackend = String(dom.backend?.value || state.backend || 'wasm').toLowerCase();
    state.backend = requestedBackend === 'onnx' ? 'webgpu' : requestedBackend;

    if (!state.engine) {
      state.engine = new state.EngineConstructor(null, state.backend);
    } else if (
      typeof state.engine.setBackendMode === 'function'
      && state.backend !== state.engine.backendMode
    ) {
      await state.engine.setBackendMode(state.backend);
      state.initialized = false;
    }

    if (typeof state.engine.setBackendMode === 'function') {
      await state.engine.setBackendMode(state.backend);
    }

    if (typeof state.engine.initOnnxSessions !== 'function') {
      throw new Error('इंजन में initOnnxSessions() उपलब्ध नहीं है। सही ./index.js adapter की जाँच करें।');
    }

    if (typeof state.engine.synthesizeInBrowser !== 'function') {
      throw new Error('इंजन में synthesizeInBrowser() उपलब्ध नहीं है; वास्तविक ऑडियो बनाया नहीं जा सकता।');
    }

    if (forceInit || !state.initialized) {
      setStatus('वास्तविक मॉडल/ONNX sessions आरम्भ हो रहे हैं… इसमें समय लग सकता है।');

      const initResult = await state.engine.initOnnxSessions(progressCallback);

      if (initResult && initResult.ok === false) {
        throw new Error('इंजन ने ONNX initialization को सफल नहीं बताया।');
      }
    }

    state.initialized = true;
    setProgress(100);
    setStatus(`गायन इंजन तैयार है (${state.backend.toUpperCase()}).`, 'ok');

    return state.engine;
  } catch (error) {
    state.initialized = false;
    state.lastError = error;

    setStatus(`इंजन तैयार नहीं हुआ: ${errorMessage(error)}`, 'error');
    setDiagnostics(error, `Adapter URL: ${ENGINE_MODULE_URL}`);

    throw error;
  } finally {
    state.initializing = false;
    updateControls();
  }
}

function readSynthesisOptions() {
  const meterRaw = String(dom.meter?.value || 'auto').trim();
  const speedRaw = Number(dom.speed?.value ?? 0.9);

  const options = {
    meter: meterRaw || 'auto',
    speed: Number.isFinite(speedRaw) ? Math.min(1.5, Math.max(0.1, speedRaw)) : 0.9,
    noSandhi: Boolean(dom.noSandhi?.checked)
  };

  // Keep original input text untouched; the adapter handles its own validation.
  return options;
}

function getInputText() {
  const raw = String(dom.text?.value ?? '');

  if (!raw.trim()) {
    throw new Error('कृपया पहले संस्कृत श्लोक, मन्त्र, स्तोत्र या ऋचा का पाठ लिखें।');
  }

  if (raw.length > 200000) {
    throw new RangeError('पाठ 200,000 UTF-16 units से अधिक है; कृपया इसे छोटे भागों में बाँटें।');
  }

  return raw;
}

function getResultUrl(result) {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return '';

  const url = result.audioUrl
    || result.url
    || result.wavUrl
    || result.outputUrl
    || result.audioSrc
    || result.src;

  return typeof url === 'string' ? url : '';
}

function revealResultControls() {
  if (dom.audio) dom.audio.hidden = false;
  if (dom.download) dom.download.hidden = false;
  if (dom.resultActions) dom.resultActions.hidden = false;
}

function setAudioResult(result, shouldAutoplay = false) {
  const url = getResultUrl(result);

  if (!url) {
    throw new Error(
      'इंजन ने पहचानने योग्य audioUrl/URL नहीं लौटाया। ऑडियो परिणाम की संरचना जाँचें; कोई नकली WAV नहीं बनाई गई।'
    );
  }

  state.currentResult = result;
  state.currentAudioUrl = url;

  if (dom.audio) {
    dom.audio.pause();
    dom.audio.src = url;
    dom.audio.load();
    dom.audio.hidden = false;
    dom.audio.onplay = updateControls;
    dom.audio.onpause = updateControls;
    dom.audio.onended = handleAudioEnded;

    dom.audio.onerror = () => {
      setStatus(
        'ऑडियो परिणाम मिला, लेकिन ब्राउज़र इसे चला नहीं सका। परिणाम का codec/URL जाँचें।',
        'error'
      );
      updateControls();
    };
  }

  if (dom.download) {
    dom.download.href = url;
    dom.download.download = 'swar-sadhika-chant.wav';
    dom.download.hidden = false;
    dom.download.setAttribute('aria-label', 'तैयार गायन ऑडियो डाउनलोड करें');
  }

  revealResultControls();

  if (shouldAutoplay && dom.audio) {
    const playPromise = dom.audio.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((error) => {
        setStatus(
          `ऑडियो बन गया है, लेकिन स्वचालित playback अवरुद्ध हुआ। Audio player पर Play दबाएँ। (${errorMessage(error)})`,
          'info'
        );
      });
    }
  }

  updateControls();
}

async function synthesizeText(text, { autoplay = false, keepQueueRun = false } = {}) {
  const token = ++state.runToken;

  state.synthesizing = true;
  state.lastError = null;

  updateControls();
  setProgress(0);
  clearDiagnostics();
  setStatus('गायन इंजन तैयार किया जा रहा है…');

  try {
    const engine = await ensureEngineInitialized(true);

    if (token !== state.runToken) return null;

    setStatus('संस्कृत पाठ का वास्तविक ऑडियो inference चल रहा है…');

    const options = readSynthesisOptions();
    const result = await engine.synthesizeInBrowser(text, options, progressCallback);

    if (token !== state.runToken) return null;

    const url = getResultUrl(result);

    if (!url) {
      throw new Error('Vāgdhenu परिणाम में audioUrl/URL नहीं मिला।');
    }

    setAudioResult(result, autoplay);
    setProgress(100);
    setStatus('ऑडियो सफलतापूर्वक तैयार हुआ। नीचे सुनें या डाउनलोड करें।', 'ok');

    return result;
  } catch (error) {
    state.lastError = error;

    setStatus(`ऑडियो नहीं बन पाया: ${errorMessage(error)}`, 'error');
    setDiagnostics(
      error,
      'जाँचें: index.js, vagdhenu-onnx.js, vagdhenu-text.js, runtime/model files, network/CORS और backend compatibility.'
    );

    throw error;
  } finally {
    state.synthesizing = false;
    updateControls();

    if (!keepQueueRun && !state.queueRunning) {
      setProgress(state.currentResult ? 100 : 0);
    }
  }
}

async function onGenerateClick() {
  if (state.synthesizing) return;

  try {
    const text = getInputText();
    await synthesizeText(text);
  } catch (error) {
    // Errors are already rendered in the status and diagnostics panel.
    console.error('[Swar-Sadhika] synthesis failed:', error);
  }
}

async function onInitializeClick() {
  try {
    await ensureEngineInitialized(true);
  } catch (error) {
    console.error('[Swar-Sadhika] engine initialization failed:', error);
  }
}

function renderQueue() {
  if (!dom.queue) return;

  dom.queue.replaceChildren();

  if (!state.queue.length) {
    const empty = makeEl(
      'li',
      {},
      'Queue खाली है। पहले पाठ लिखें और “Queue में जोड़ें” दबाएँ।'
    );

    dom.queue.appendChild(empty);
  } else {
    state.queue.forEach((item, index) => {
      const li = makeEl('li');

      li.textContent = `${index + 1}. ${item.text.slice(0, 120)}${item.text.length > 120 ? '…' : ''}`;

      if (index === state.queueIndex && state.queueRunning) {
        li.setAttribute('aria-current', 'true');
      }

      const remove = makeEl(
        'button',
        { type: 'button', className: 'ss-queue-remove' },
        'हटाएँ'
      );

      remove.style.marginInlineStart = '8px';

      remove.addEventListener('click', () => {
        if (state.queueRunning) return;

        state.queue.splice(index, 1);

        if (state.queueIndex >= state.queue.length) {
          state.queueIndex = state.queue.length - 1;
        }

        renderQueue();
        updateControls();
      });

      li.appendChild(remove);
      dom.queue.appendChild(li);
    });
  }

  updateControls();
}

function addCurrentTextToQueue() {
  try {
    const text = getInputText();
    const duplicate = state.queue.some((entry) => entry.text === text);

    if (duplicate) {
      setStatus('यही पाठ Queue में पहले से मौजूद है।', 'info');
      return;
    }

    state.queue.push({ text, addedAt: Date.now() });

    renderQueue();
    setStatus(`Queue में पाठ जोड़ा गया। कुल आइटम: ${state.queue.length}`, 'ok');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  }
}

function clearQueue() {
  if (state.queueRunning) return;

  state.queue = [];
  state.queueIndex = -1;

  renderQueue();
  setStatus('Queue साफ़ कर दी गई।', 'info');
}

async function playQueue() {
  if (state.queueRunning || !state.queue.length) return;

  state.queueRunning = true;
  state.queueIndex = 0;

  updateControls();

  try {
    while (state.queueRunning && state.queueIndex < state.queue.length) {
      const item = state.queue[state.queueIndex];

      renderQueue();

      setStatus(
        `Queue ${state.queueIndex + 1}/${state.queue.length}: ऑडियो बनाया जा रहा है…`
      );

      const result = await synthesizeText(item.text, {
        autoplay: false,
        keepQueueRun: true
      });

      if (!state.queueRunning) break;

      if (!result || !dom.audio) {
        throw new Error('Queue playback के लिए ऑडियो player उपलब्ध नहीं है।');
      }

      await waitForAudioEnded(dom.audio);

      if (state.queueRunning) {
        state.queueIndex += 1;
      }
    }

    if (state.queueRunning) {
      setStatus('Queue के सभी ऑडियो आइटम पूरे हो गए।', 'ok');
    }
  } catch (error) {
    setStatus(`Queue रुक गई: ${errorMessage(error)}`, 'error');
    setDiagnostics(error);
  } finally {
    state.queueRunning = false;
    state.queueIndex = -1;

    renderQueue();
    updateControls();
  }
}

function waitForAudioEnded(audio) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      document.removeEventListener('swar-sadhika-stop-queue', onStop);
    };

    const finish = (fn) => {
      if (settled) return;

      settled = true;
      cleanup();
      fn();
    };

    const onEnded = () => finish(resolve);
    const onError = () => finish(() => reject(new Error('ऑडियो playback में त्रुटि आई।')));
    const onStop = () => finish(resolve);

    audio.addEventListener('ended', onEnded, { once: true });
    audio.addEventListener('error', onError, { once: true });

    document.addEventListener('swar-sadhika-stop-queue', onStop, { once: true });

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((error) => finish(() => reject(error)));
    }
  });
}

function handleAudioEnded() {
  updateControls();

  if (!state.queueRunning) {
    setStatus('ऑडियो playback पूरा हुआ।', 'ok');
  }
}

function pauseAudio() {
  if (!dom.audio) return;

  if (!dom.audio.paused) {
    dom.audio.pause();

    if (state.queueRunning) {
      setStatus('Queue ऑडियो विराम पर है; Play दबाकर फिर सुनें।');
    } else {
      setStatus('ऑडियो विराम पर है।');
    }
  } else if (dom.audio.currentSrc) {
    const promise = dom.audio.play();

    if (promise && typeof promise.catch === 'function') {
      promise.catch((error) => {
        setStatus(`Playback फिर शुरू नहीं हुआ: ${errorMessage(error)}`, 'error');
      });
    }
  }

  updateControls();
}

function stopAudio() {
  state.runToken += 1; // Ignore any inference result that finishes after the user stops.
  state.queueRunning = false;

  document.dispatchEvent(new Event('swar-sadhika-stop-queue'));

  if (dom.audio) {
    dom.audio.pause();

    try {
      dom.audio.currentTime = 0;
    } catch {
      // Metadata may not be loaded yet.
    }
  }

  if (state.synthesizing) {
    setStatus(
      'Playback/Queue रोक दी गई। वर्तमान model inference adapter में cancellable नहीं है; उसका परिणाम UI में लागू नहीं होगा।'
    );
  } else {
    setStatus('ऑडियो playback रोक दी गई।');
  }

  updateControls();
}

function updateSpeedLabel() {
  if (dom.speedValue && dom.speed) {
    dom.speedValue.textContent = String(
      Number(dom.speed.value).toFixed(2).replace(/0$/, '')
    );
  }
}

function bindEvents() {
  dom.generate?.addEventListener('click', onGenerateClick);
  dom.initialize?.addEventListener('click', onInitializeClick);
  dom.addQueue?.addEventListener('click', addCurrentTextToQueue);
  dom.playQueue?.addEventListener('click', playQueue);
  dom.clearQueue?.addEventListener('click', clearQueue);
  dom.pause?.addEventListener('click', pauseAudio);
  dom.stop?.addEventListener('click', stopAudio);
  dom.speed?.addEventListener('input', updateSpeedLabel);

  dom.backend?.addEventListener('change', async () => {
    const nextBackend = String(dom.backend.value || 'wasm').toLowerCase();

    state.backend = nextBackend === 'onnx' ? 'webgpu' : nextBackend;
    state.initialized = false;

    if (state.engine && typeof state.engine.setBackendMode === 'function') {
      try {
        await state.engine.setBackendMode(state.backend);

        setStatus(
          `Backend ${state.backend.toUpperCase()} चुना गया। अगली synthesis से पहले sessions पुनः आरम्भ होंगे।`
        );
      } catch (error) {
        setStatus(`Backend बदला नहीं जा सका: ${errorMessage(error)}`, 'error');
        setDiagnostics(error);
      }
    } else {
      setStatus(`Backend ${state.backend.toUpperCase()} अगली engine initialization पर लागू होगा।`);
    }

    updateControls();
  });

  dom.text?.addEventListener('input', updateControls);
  dom.audio?.addEventListener('play', updateControls);
  dom.audio?.addEventListener('pause', updateControls);
  dom.audio?.addEventListener('ended', updateControls);
  dom.audio?.addEventListener('error', updateControls);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dom.audio && !dom.audio.paused) {
      // Do not unexpectedly stop background audio; mobile browsers manage this.
    }
  });
}

function exposeDebugApi() {
  // Read-only state visibility for audit pages/devtools; no model internals exposed.
  Object.defineProperty(window, 'SwarSadhikaApp', {
    configurable: true,
    value: Object.freeze({
      version: APP_VERSION,

      getStatus: () => Object.freeze({
        initialized: state.initialized,
        initializing: state.initializing,
        synthesizing: state.synthesizing,
        backend: state.backend,
        queueLength: state.queue.length,
        queueRunning: state.queueRunning,
        hasAudioResult: Boolean(state.currentAudioUrl),
        lastError: state.lastError ? errorMessage(state.lastError) : null
      }),

      initialize: onInitializeClick,
      synthesize: onGenerateClick,
      stop: stopAudio
    })
  });
}

function boot() {
  if (!dom.text || !dom.generate) {
    console.error(
      '[Swar-Sadhika] UI controls could not be resolved. Add a textarea and a generate button or let the fallback UI render.'
    );
    return;
  }

  if (dom.backend?.value) {
    state.backend = String(dom.backend.value).toLowerCase();
  }

  updateSpeedLabel();
  renderQueue();
  bindEvents();
  updateControls();
  setProgress(0);

  setStatus('तैयार है। इंजन प्रारम्भ करने या गायन ऑडियो बनाने के लिए ऊपर का बटन दबाएँ।');

  exposeDebugApi();

  console.info(
    `[Swar-Sadhika] app.js ${APP_VERSION} loaded; engine will initialize on user action.`
  );
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
