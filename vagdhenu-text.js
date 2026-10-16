
/**
 * Swar-Sadhika — Sanskrit / Devanagari text utilities
 * File: swar-sadhika-test/vagdhenu-text.js
 * Native ES module. Text-processing only; this is not an AI model or TTS engine.
 * Source text, conjuncts, and Vedic marks are preserved by default.
 * Meter and syllable information is explicitly heuristic, never a guarantee.
 */

export const VAGDHENU_TEXT_VERSION = '1.0.0';
export const TEXT_MODULE_VERSION = VAGDHENU_TEXT_VERSION;

const MAX_TEXT_LENGTH = 200_000;
const VEDIC_LABELS = new Map([
  ['\u0951', 'Devanagari stress sign Udatta'],
  ['\u0952', 'Devanagari stress sign Anudatta'],
  ['\u0953', 'Devanagari grave accent'],
  ['\u0954', 'Devanagari acute accent']
]);
const CONSONANT = /^[\u0915-\u0939\u0958-\u095F\u0978-\u097F]$/u;
const INDEPENDENT_VOWEL = /^[\u0905-\u0914\u0960\u0961]$/u;
const MATRAS = new Set(Array.from('\u093E\u093F\u0940\u0941\u0942\u0943\u0944\u0946\u0947\u0948\u094A\u094B\u094C\u094E\u094F\u0962\u0963'));
const SHORT_MATRAS = new Set(['\u093F', '\u0941', '\u0943', '\u0962']);
const LONG_MATRAS = new Set(['\u093E', '\u0940', '\u0942', '\u0944', '\u0947', '\u0948', '\u094B', '\u094C', '\u0963']);
const SHORT_VOWELS = new Set(['अ', 'इ', 'उ', 'ऋ', 'ऌ', 'ऎ', 'ऒ']);
const LONG_VOWELS = new Set(['आ', 'ई', 'ऊ', 'ॠ', 'ॡ', 'ए', 'ऐ', 'ओ', 'औ']);

function codePointName(ch) {
  const n = ch.codePointAt(0);
  return `U+${n.toString(16).toUpperCase().padStart(n <= 0xffff ? 4 : 6, '0')}`;
}
function isConsonant(ch) { return CONSONANT.test(ch); }
function isIndependentVowel(ch) { return INDEPENDENT_VOWEL.test(ch); }
function isMatra(ch) { return MATRAS.has(ch); }
function isVedicCandidate(ch) {
  const cp = ch.codePointAt(0);
  return VEDIC_LABELS.has(ch) || (cp >= 0x1cd0 && cp <= 0x1cff) || (cp >= 0xa8e0 && cp <= 0xa8ff);
}

/** Normalize line endings only; do not remove accents, punctuation, or conjuncts. */
export function normalizeSanskritText(input, options = {}) {
  options = options && typeof options === 'object' ? options : {};
  let text;
  if (typeof input === 'string') text = input;
  else if (Array.isArray(input) && input.every(part => typeof part === 'string')) text = input.join('\n');
  else throw new TypeError('Input must be a string or an array of strings.');

  text = text.replace(/\r\n?/g, '\n');
  const limit = Number.isInteger(options.maxLength) && options.maxLength > 0 ? options.maxLength : MAX_TEXT_LENGTH;
  if (text.length > limit) throw new RangeError(`Input exceeds the maximum allowed length (${limit}).`);
  if (text.includes('\u0000')) throw new TypeError('Input contains a NUL character (U+0000).');
  return text;
}

/** Prepare text for an engine without modifying the original input. */
export function prepareTtsTextWithoutMutation(input) {
  return normalizeSanskritText(input).trim();
}

/** Unicode normalization is opt-in because it can change code-point sequences. */
export function normalizeUnicodeText(input, form = 'NFC') {
  if (!['NFC', 'NFD', 'NFKC', 'NFKD'].includes(form)) {
    throw new TypeError('form must be NFC, NFD, NFKC, or NFKD.');
  }
  return normalizeSanskritText(input).normalize(form);
}

/** Input validation is structural only; it does not certify Sanskrit grammar. */
export function validateSanskritText(input, options = {}) {
  const errors = [];
  const warnings = [];
  let text = '';
  try {
    text = normalizeSanskritText(input, options);
  } catch (error) {
    return Object.freeze({ valid: false, errors: Object.freeze([error.message]), warnings: Object.freeze([]), characterCount: 0 });
  }

  if (!text.trim()) errors.push('Text is empty or whitespace-only.');
  if (text.includes('\uFFFD')) warnings.push('Text contains U+FFFD replacement characters; inspect the source encoding.');
  if (text.trim() && !/[\u0900-\u097f\uA8E0-\uA8FF]/u.test(text)) {
    warnings.push('No Devanagari-block character found; the input may use IAST or another script.');
  }

  let isolatedSurrogates = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
      else isolatedSurrogates++;
    } else if (c >= 0xdc00 && c <= 0xdfff) isolatedSurrogates++;
  }
  if (isolatedSurrogates) warnings.push(`Found ${isolatedSurrogates} isolated UTF-16 surrogate code unit(s).`);

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    characterCount: Array.from(text).length,
    utf16Length: text.length,
    containsDevanagari: /[\u0900-\u097f\uA8E0-\uA8FF]/u.test(text),
    containsVedicMarks: detectVedicMarks(text).hasVedicMarks
  });
}

/** Detect known Devanagari accents and characters in Vedic/extended blocks. */
export function detectVedicMarks(input) {
  const text = normalizeSanskritText(input);
  const marks = [];
  const seen = new Set();
  for (const character of text) {
    if (!isVedicCandidate(character)) continue;
    const codePoint = codePointName(character);
    seen.add(codePoint);
    const cp = character.codePointAt(0);
    marks.push(Object.freeze({
      character,
      codePoint,
      decimalCodePoint: cp,
      label: VEDIC_LABELS.get(character) ||
        (cp >= 0x1cd0 && cp <= 0x1cff ? 'Vedic Extensions block character; exact subtype not mapped' :
         cp >= 0xa8e0 && cp <= 0xa8ff ? 'Devanagari Extended character; exact role requires specialist validation' :
         'Vedic/Sanskrit accent candidate; exact function not mapped')
    }));
  }
  return Object.freeze({
    hasVedicMarks: marks.length > 0,
    count: marks.length,
    uniqueCount: seen.size,
    marks: Object.freeze(marks),
    note: 'Unicode detection only; it does not validate a mark against a specific Vedic recension.'
  });
}

function classifyCharacter(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x0900 && cp <= 0x097f) return 'devanagari';
  if (cp >= 0xa8e0 && cp <= 0xa8ff) return 'devanagari-extended';
  if (cp >= 0x1cd0 && cp <= 0x1cff) return 'vedic-extension';
  if ((cp >= 0x0966 && cp <= 0x096f) || (cp >= 0x30 && cp <= 0x39)) return 'digit';
  if (/\s/u.test(ch)) return 'whitespace';
  if (/\p{M}/u.test(ch)) return 'combining-mark';
  if (/\p{P}/u.test(ch) || /\p{S}/u.test(ch)) return 'punctuation-or-symbol';
  if (cp >= 0x20 && cp <= 0x7e) return 'latin-ascii';
  return 'other';
}

/** Return a Unicode inventory without deleting or altering any character. */
export function recognizeDevanagariCharacters(input) {
  const text = normalizeSanskritText(input);
  const counts = new Map();
  for (const ch of text) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  const inventory = Array.from(counts, ([character, count]) => Object.freeze({
    character,
    codePoint: codePointName(character),
    count,
    category: classifyCharacter(character)
  })).sort((a, b) => a.codePoint.localeCompare(b.codePoint));

  return Object.freeze({
    characterCount: Array.from(text).length,
    uniqueCharacterCount: inventory.length,
    inventory: Object.freeze(inventory),
    devanagariCharacters: Object.freeze(inventory.filter(x => x.category === 'devanagari')),
    vedicCandidates: Object.freeze(inventory.filter(x => x.category === 'vedic-extension' || x.category === 'devanagari-extended')),
    digits: Object.freeze(inventory.filter(x => x.category === 'digit')),
    outsideCommonBlocks: Object.freeze(inventory.filter(x => x.category === 'other')),
    note: 'Character inventory is not a grammar or pronunciation verdict.'
  });
}

/** Split text by explicit lines; preserve empty lines only when requested. */
export function splitIntoLines(input, options = {}) {
  const lines = normalizeSanskritText(input, options).split('\n');
  return Object.freeze(options.keepEmpty ? lines : lines.filter(line => line.trim()));
}

/** Split at provided line, danda, or sentence boundaries; no sandhi/spelling changes. */
export function segmentText(input, options = {}) {
  const text = normalizeSanskritText(input, options);
  const mode = options.mode || 'sentence';
  const keepEmpty = Boolean(options.keepEmpty);
  if (mode === 'line') return splitIntoLines(text, { keepEmpty });
  if (!['sentence', 'pada', 'sentence-or-pada'].includes(mode)) {
    throw new TypeError('mode must be line, sentence, pada, or sentence-or-pada.');
  }

  const result = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      if (keepEmpty) result.push('');
      continue;
    }
    const endings = mode === 'pada' ? /[।॥]/u : /[।॥!?]+|[.!?]+/u;
    let start = 0;
    const characters = Array.from(line);
    for (let i = 0; i < characters.length; i++) {
      if (!endings.test(characters[i])) continue;
      const part = characters.slice(start, i + 1).join('').trim();
      if (part) result.push(part);
      start = i + 1;
    }
    const tail = characters.slice(start).join('').trim();
    if (tail) result.push(tail);
  }
  return Object.freeze(result);
}

/** Tokenize words and punctuation conservatively, retaining original token text. */
export function tokenizeSanskrit(input) {
  const text = normalizeSanskritText(input);
  const matches = text.match(/[\p{L}\p{M}\p{N}\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]+|[^\s]/gu) || [];
  return Object.freeze(matches.map((token, index) => Object.freeze({
    index,
    text: token,
    kind: /^[।॥]+$/u.test(token) ? 'danda' :
      /^[०-९0-9]+$/u.test(token) ? 'number' :
      /^\p{L}[\p{L}\p{M}\p{N}]*$/u.test(token) ? 'word' : 'punctuation-or-mixed',
    codePoints: Array.from(token).length,
    hasDevanagari: /[\u0900-\u097f\uA8E0-\uA8FF]/u.test(token),
    hasVedicMarks: detectVedicMarks(token).hasVedicMarks
  })));
}

/**
 * Approximate vowel-nucleus counting for Devanagari. It intentionally does not
 * claim full phonological syllabification or correct laghu/guru scansion.
 */
export function countSyllables(input) {
  const text = normalizeSanskritText(input);
  const chars = Array.from(text);
  const syllables = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isIndependentVowel(ch)) {
      const length = LONG_VOWELS.has(ch) ? 'long' : SHORT_VOWELS.has(ch) ? 'short' : 'uncertain';
      syllables.push(Object.freeze({
        index: syllables.length,
        nucleus: ch,
        sourceIndex: i,
        kind: 'independent-vowel',
        length,
        quantity: length === 'long' ? 'guru-by-vowel' : length === 'short' ? 'laghu-candidate' : 'unknown'
      }));
      continue;
    }
    if (!isConsonant(ch)) continue;

    let j = i + 1;
    if (j < chars.length && chars[j] === '\u093c') j++;
    if (j < chars.length && chars[j] === '\u094d') continue;

    const matra = j < chars.length && isMatra(chars[j]) ? chars[j] : null;
    const length = matra ? LONG_MATRAS.has(matra) ? 'long' : SHORT_MATRAS.has(matra) ? 'short' : 'uncertain' : 'short';
    syllables.push(Object.freeze({
      index: syllables.length,
      nucleus: matra || 'अ (inherent-vowel candidate)',
      sourceIndex: i,
      kind: matra ? 'dependent-vowel' : 'inherent-a',
      length,
      quantity: length === 'long' ? 'guru-by-vowel' : length === 'short' ? 'laghu-candidate' : 'unknown'
    }));
  }
  return Object.freeze({
    count: syllables.length,
    syllables: Object.freeze(syllables),
    method: 'approximate Devanagari vowel-nucleus count',
    confidence: 'approximate',
    warnings: Object.freeze([
      'Conjuncts, consonant clusters, anusvāra, visarga, and recitation conventions may affect metrical scansion.',
      'The returned labels are not a complete or authoritative guru/laghu analysis.'
    ])
  });
}

function splitForProsody(input) {
  const text = normalizeSanskritText(input).trim();
  if (!text) return [];
  return text.split(/\n+|(?<=[।॥])/u).map(p => p.trim()).filter(Boolean);
}

/** Analyze a verse and return the stable shape expected by index.js. */
export function analyzeVerse(input, options = {}) {
  const text = normalizeSanskritText(input, options);
  const validation = validateSanskritText(text, options);
  const vedicMarks = detectVedicMarks(text);
  const characters = recognizeDevanagariCharacters(text);
  const tokens = tokenizeSanskrit(text);
  const padas = splitForProsody(text).map((pada, index) => {
    const scan = countSyllables(pada);
    return Object.freeze({
      index,
      text: pada,
      estimatedSyllableCount: scan.count,
      syllables: scan.syllables,
      method: scan.method,
      confidence: scan.confidence
    });
  });

  const counts = padas.map(p => p.estimatedSyllableCount);
  const candidates = [];
  if (padas.length === 4 && counts.every(n => n === 8)) {
    candidates.push(Object.freeze({
      name: 'अनुष्टुप्-वर्ग का संभावित छंद', confidence: 'low',
      basis: 'चार स्पष्ट खंडों में लगभग 8 vowel nuclei प्रति खंड',
      note: 'केवल संख्या से शास्त्रीय छंद सिद्ध नहीं होता; गुरु-लघु और पाद-नियम जाँच आवश्यक हैं।'
    }));
  } else if (padas.length === 4 && counts.every(n => n === 11)) {
    candidates.push(Object.freeze({
      name: 'त्रिष्टुप्-वर्ग का संभावित छंद', confidence: 'low',
      basis: 'चार स्पष्ट खंडों में लगभग 11 vowel nuclei प्रति खंड',
      note: 'यह केवल एक प्रारम्भिक संकेत है, प्रामाणिक छंद-निर्धारण नहीं।'
    }));
  } else if (padas.length === 4 && counts.every(n => n === 12)) {
    candidates.push(Object.freeze({
      name: 'जगती-वर्ग का संभावित छंद', confidence: 'low',
      basis: 'चार स्पष्ट खंडों में लगभग 12 vowel nuclei प्रति खंड',
      note: 'यह केवल एक प्रारम्भिक संकेत है, प्रामाणिक छंद-निर्धारण नहीं।'
    }));
  }

  const meter = Object.freeze(candidates.length ? {
    name: candidates[0].name,
    confidence: 'low',
    candidates: Object.freeze(candidates),
    exactIdentification: false
  } : {
    name: 'अनिर्धारित',
    confidence: 0,
    candidates: Object.freeze([]),
    exactIdentification: false,
    note: 'विश्वसनीय छंद-पहचान के लिए प्रमाणित पाद-विभाजन और गुरु-लघु/गण नियम आवश्यक हैं।'
  });

  const warnings = [...validation.warnings];
  if (!validation.valid) warnings.push(...validation.errors);
  if (vedicMarks.hasVedicMarks) warnings.push('वैदिक चिह्न मौजूद हैं; उनकी शाखा-विशिष्ट शुद्धता प्रमाणित नहीं हुई।');
  if (characters.outsideCommonBlocks.length) warnings.push('कुछ वर्ण सामान्य सूची से बाहर हैं; कोई वर्ण स्वतः हटाया नहीं गया।');

  return Object.freeze({
    text,
    normalizedText: text,
    validation,
    meter,
    candidates: meter.candidates,
    padas: Object.freeze(padas),
    estimatedSyllableCount: padas.reduce((sum, p) => sum + p.estimatedSyllableCount, 0),
    vedicMarks,
    characters,
    tokens,
    warnings: Object.freeze(Array.from(new Set(warnings))),
    sourceTextPreserved: true,
    exactPronunciationVerified: false,
    note: 'यह केवल पाठ-विश्लेषण है; यह AI singing, उच्चारण की शुद्धता, या model inference का प्रमाण नहीं है।'
  });
}

export const analyzeSanskritText = analyzeVerse;

/** Exact-key lookup against a caller-supplied, verified dictionary; none is fabricated here. */
export function lookupSanskritTerms(input, dictionary = null) {
  const text = normalizeSanskritText(input);
  const words = text.match(/[\p{L}\p{M}\p{N}\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]+/gu) || [];
  if (!(dictionary instanceof Map) && (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary))) {
    return Object.freeze({
      available: false,
      matches: Object.freeze([]),
      unmatchedWords: Object.freeze([...new Set(words)]),
      note: 'कोई सत्यापित शब्दकोश इस मॉड्यूल में bundled नहीं है। Map या plain object देने पर exact-key lookup होगा।'
    });
  }
  const matches = [];
  const unmatchedWords = [];
  const seen = new Set();
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    const exists = dictionary instanceof Map ? dictionary.has(word) : Object.prototype.hasOwnProperty.call(dictionary, word);
    if (!exists) unmatchedWords.push(word);
    else matches.push(Object.freeze({ term: word, entry: dictionary instanceof Map ? dictionary.get(word) : dictionary[word] }));
  }
  return Object.freeze({
    available: true,
    matches: Object.freeze(matches),
    unmatchedWords: Object.freeze(unmatchedWords),
    note: 'यह exact-key lookup है; रूप-विज्ञान, संधि-विच्छेद और अर्थ की पुष्टि नहीं करता।'
  });
}

/** Compare original and candidate after the module's line-ending normalization only. */
export function compareTextPreservation(original, candidate) {
  const source = normalizeSanskritText(original);
  const output = normalizeSanskritText(candidate);
  const sourceMarks = detectVedicMarks(source);
  const outputMarks = detectVedicMarks(output);
  return Object.freeze({
    identicalAfterLineEndingNormalization: source === output,
    sourceLength: Array.from(source).length,
    candidateLength: Array.from(output).length,
    sourceHasVedicMarks: sourceMarks.hasVedicMarks,
    candidateHasVedicMarks: outputMarks.hasVedicMarks,
    sourceVedicCodePoints: Object.freeze(sourceMarks.marks.map(m => m.codePoint)),
    candidateVedicCodePoints: Object.freeze(outputMarks.marks.map(m => m.codePoint)),
    note: source === output ? 'Texts match after line-ending normalization.' : 'Texts differ; inspect before recitation or synthesis.'
  });
}



// ---------------------------------------------------------------------------
// Self-contained Vāgdhenu-compatible text helpers.
// These are original local implementations, not a verbatim copy of upstream.
// They use no packages, network requests, or external services.
// ---------------------------------------------------------------------------

const SLP1_VOWEL_TO_DEVA = Object.freeze({
  a: 'अ', A: 'आ', i: 'इ', I: 'ई', u: 'उ', U: 'ऊ',
  f: 'ऋ', F: 'ॠ', x: 'ऌ', X: 'ॡ', e: 'ए', E: 'ऐ', o: 'ओ', O: 'औ'
});
const SLP1_VOWEL_TO_MATRA = Object.freeze({
  a: '', A: 'ा', i: 'ि', I: 'ी', u: 'ु', U: 'ू',
  f: 'ृ', F: 'ॄ', x: 'ॢ', X: 'ॣ', e: 'े', E: 'ै', o: 'ो', O: 'ौ'
});
const SLP1_CONSONANT_TO_DEVA = Object.freeze({
  k: 'क', K: 'ख', g: 'ग', G: 'घ', N: 'ङ',
  c: 'च', C: 'छ', j: 'ज', J: 'झ', Y: 'ञ',
  w: 'ट', W: 'ठ', q: 'ड', Q: 'ढ', R: 'ण',
  t: 'त', T: 'थ', d: 'द', D: 'ध', n: 'न',
  p: 'प', P: 'फ', b: 'ब', B: 'भ', m: 'म',
  y: 'य', r: 'र', l: 'ल', v: 'व', S: 'श', z: 'ष', s: 'स', h: 'ह', L: 'ळ'
});
const DEVA_CONSONANT_TO_SLP1 = Object.freeze({
  क:'k', ख:'K', ग:'g', घ:'G', ङ:'N', च:'c', छ:'C', ज:'j', झ:'J', ञ:'Y',
  ट:'w', ठ:'W', ड:'q', ढ:'Q', ण:'R', त:'t', थ:'T', द:'d', ध:'D', न:'n',
  प:'p', फ:'P', ब:'b', भ:'B', म:'m', य:'y', र:'r', ल:'l', व:'v', श:'S', ष:'z', स:'s', ह:'h', ळ:'L',
  क़:'k', ख़:'K', ग़:'g', ज़:'j', ड़:'q', ढ़:'Q', फ़:'P', य़:'y'
});
const DEVA_VOWEL_TO_SLP1 = Object.freeze({
  अ:'a', आ:'A', इ:'i', ई:'I', उ:'u', ऊ:'U', ऋ:'f', ॠ:'F', ऌ:'x', ॡ:'X', ए:'e', ऐ:'E', ओ:'o', औ:'O'
});
const DEVA_MATRA_TO_SLP1 = Object.freeze({
  'ा':'A', 'ि':'i', 'ी':'I', 'ु':'u', 'ू':'U', 'ृ':'f', 'ॄ':'F', 'ॢ':'x', 'ॣ':'X', 'े':'e', 'ै':'E', 'ो':'o', 'ौ':'O'
});
const DEVA_VIRAMA = '्';
const DEVA_NUKTA = '़';
const DEVA_MARKS = new Set(['ं','ँ','ः','॑','॒','॓','॔','ॕ','ॖ','ॗ','᳐','᳑','᳒','᳓','᳔','᳕','᳖','᳗','᳘','᳙','᳚','᳛','᳜','᳝','᳞','᳟','᳠','᳡','᳢','᳣','᳤','᳥','᳦','᳧','᳨','ᳩ','ᳪ','ᳫ','ᳬ','᳭','ᳮ','ᳯ','ᳰ','ᳱ']);
const SLP1_KNOWN_METERS = Object.freeze({
  anustubh: 'anustubh', anushtubh: 'anustubh', anushtup: 'anustubh', anustup: 'anustubh',
  vasantatilaka: 'vasantatilaka', vasantatilakā: 'vasantatilaka',
  shardulavikridita: 'shardulavikridita', shardulavikriditā: 'shardulavikridita',
  sragdhara: 'sragdhara', sragdharā: 'sragdhara',
  malini: 'malini', mālinī: 'malini', upajati: 'upajati', upajāti: 'upajati',
  vamsastha: 'vamsastha', vaṃśastha: 'vamsastha', vamshastha: 'vamsastha',
  drutavilambita: 'drutavilambita', mandakranta: 'mandakranta', mandākrāntā: 'mandakranta',
  sikharini: 'sikharini', śikhariṇī: 'sikharini', bhujangaprayata: 'bhujangaprayata',
  indravajra: 'indravajra', upendravajra: 'upendravajra', rathoddhata: 'rathoddhata',
  praharshini: 'praharshini', harini: 'harini', pushpitagra: 'pushpitagra',
  jagati: 'jagati', tristubh: 'tristubh', trishtubh: 'tristubh'
});

function isSlp1Vowel(ch) { return Object.prototype.hasOwnProperty.call(SLP1_VOWEL_TO_DEVA, ch); }
function isSlp1Consonant(ch) { return Object.prototype.hasOwnProperty.call(SLP1_CONSONANT_TO_DEVA, ch); }
function isDevanagariScriptText(text) { return /[\u0900-\u097f\uA8E0-\uA8FF\u1CD0-\u1CFF]/u.test(text); }
function isDevaConsonant(ch) { return Object.prototype.hasOwnProperty.call(DEVA_CONSONANT_TO_SLP1, ch); }
function isDevaVowelMark(ch) { return Object.prototype.hasOwnProperty.call(DEVA_MATRA_TO_SLP1, ch); }
function isAttachableMark(ch) { return /\p{M}/u.test(ch) || DEVA_MARKS.has(ch); }
function stripDiacriticsForKey(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().trim();
}

/** Convert SLP1 phonemic transliteration to Devanagari; Devanagari input is returned unchanged. */
export function toDeva(input) {
  const source = normalizeSanskritText(input).normalize('NFC');
  if (isDevanagariScriptText(source)) return source;
  const chars = Array.from(source);
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (isSlp1Vowel(ch)) {
      out += SLP1_VOWEL_TO_DEVA[ch];
      continue;
    }
    if (isSlp1Consonant(ch)) {
      const next = chars[i + 1];
      out += SLP1_CONSONANT_TO_DEVA[ch];
      if (isSlp1Vowel(next)) {
        out += SLP1_VOWEL_TO_MATRA[next];
        i += 1;
      } else {
        out += DEVA_VIRAMA;
      }
      continue;
    }
    if (ch === 'M') { out += 'ं'; continue; }
    if (ch === 'H') { out += 'ः'; continue; }
    if (ch === '~') { out += 'ँ'; continue; }
    if (ch === "'") { out += 'ऽ'; continue; }
    if (ch === '|') {
      if (chars[i + 1] === '|') { out += '॥'; i += 1; }
      else out += '।';
      continue;
    }
    out += ch;
  }
  return out;
}

/** Split Devanagari text into orthographic akṣara/syllable clusters. Whitespace and punctuation are not counted. */
export function aksharas(input) {
  const text = normalizeSanskritText(input).normalize('NFC');
  const chars = Array.from(text);
  const result = [];
  const isDevaConsonantChar = ch => /^[\u0915-\u0939\u0958-\u095f\u0978-\u097f]$/u.test(ch);
  const isDevaIndependentVowel = ch => /^[\u0904-\u0914\u0960\u0961]$/u.test(ch);
  const isDevaMatraChar = ch => /^[\u093e-\u094c\u094e\u094f\u0962\u0963]$/u.test(ch);
  const isStandaloneDevaMark = ch => /^[\u0900-\u0903\u093a\u093b\u093d\u0940\u094d\u0951-\u0957\u1cd0-\u1cff\ua8e0-\ua8ff]$/u.test(ch);
  const skipPunctuation = ch => /\s/u.test(ch) || /^[।॥|,.;:!?()[\]{}“”‘’"'—–…।॥]+$/u.test(ch);

  for (let i = 0; i < chars.length;) {
    const ch = chars[i];
    if (skipPunctuation(ch)) { i += 1; continue; }
    if (isDevaIndependentVowel(ch)) {
      let token = ch; i += 1;
      while (i < chars.length && isAttachableMark(chars[i])) token += chars[i++];
      result.push(token); continue;
    }
    if (isDevaConsonantChar(ch)) {
      let token = ch; i += 1;
      if (i < chars.length && chars[i] === DEVA_NUKTA) token += chars[i++];
      while (i < chars.length && chars[i] === DEVA_VIRAMA) {
        token += chars[i++];
        if (i < chars.length && isDevaConsonantChar(chars[i])) {
          token += chars[i++];
          if (i < chars.length && chars[i] === DEVA_NUKTA) token += chars[i++];
        } else break;
      }
      if (i < chars.length && isDevaMatraChar(chars[i])) token += chars[i++];
      while (i < chars.length && (isAttachableMark(chars[i]) || isStandaloneDevaMark(chars[i]))) {
        if (chars[i] === DEVA_VIRAMA) break;
        token += chars[i++];
      }
      result.push(token); continue;
    }
    if (isAttachableMark(ch) || isStandaloneDevaMark(ch)) {
      result.push(ch); i += 1; continue;
    }
    if (/\p{L}/u.test(ch) || /\p{S}/u.test(ch) || /\p{N}/u.test(ch)) result.push(ch);
    i += 1;
  }
  return result;
}

/** Return the number of akṣara clusters produced by aksharas(). */
export function nAksharas(input) { return aksharas(input).length; }

/** True when the last significant Devanagari character is a virāma/halant. */
export function endsHalant(input) {
  const chars = Array.from(normalizeSanskritText(input).trimEnd());
  while (chars.length && isAttachableMark(chars[chars.length - 1]) && chars[chars.length - 1] !== DEVA_VIRAMA) {
    chars.pop();
  }
  return chars.length > 0 && chars[chars.length - 1] === DEVA_VIRAMA;
}

/**
 * Split a verse into up to four padas. Explicit danda/line boundaries take
 * priority; when a conventional two-hemistich verse is supplied, each half is
 * split near its akṣara midpoint at a word boundary. This is a practical
 * heuristic, not a proof of Sanskrit metre.
 */
export function splitPadas(input) {
  const source = normalizeSanskritText(input).trim();
  if (!source) return [];
  const sections = source
    .replace(/॥/gu, '\n§DOUBLE_DANDA§\n')
    .replace(/।/gu, '\n§DANDA§\n')
    .replace(/\|\|?/gu, '\n§DANDA§\n')
    .split(/(?:\n|§DOUBLE_DANDA§|§DANDA§)+/u)
    .map(part => part.trim())
    .filter(Boolean);

  const splitAtApproximateMidpoint = part => {
    const words = part.split(/\s+/u).filter(Boolean);
    if (words.length < 2) return [part];
    const weights = words.map(word => nAksharas(word));
    const total = weights.reduce((sum, n) => sum + n, 0);
    if (total < 2) return [part];
    let cumulative = 0;
    let bestIndex = 1;
    let bestDistance = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      cumulative += weights[i - 1];
      const distance = Math.abs(cumulative - total / 2);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = i; }
    }
    return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')].filter(Boolean);
  };

  if (sections.length >= 4) return sections;
  if (sections.length === 2) {
    const result = sections.flatMap(splitAtApproximateMidpoint);
    return result.length ? result : sections;
  }
  if (sections.length === 3) return sections;

  const words = sections[0].split(/\s+/u).filter(Boolean);
  if (words.length < 4) return sections;
  const weights = words.map(word => nAksharas(word));
  const total = weights.reduce((sum, n) => sum + n, 0);
  const result = [];
  let start = 0;
  let consumed = 0;
  for (let part = 1; part <= 3; part += 1) {
    const target = total * part / 4;
    let best = start + 1;
    let bestDistance = Infinity;
    let running = consumed;
    const maxEnd = words.length - (4 - part);
    for (let end = start + 1; end <= maxEnd; end += 1) {
      running += weights[end - 1];
      const distance = Math.abs(running - target);
      if (distance < bestDistance) { bestDistance = distance; best = end; }
      if (running > target && distance > bestDistance) break;
    }
    result.push(words.slice(start, best).join(' '));
    consumed = weights.slice(0, best).reduce((sum, n) => sum + n, 0);
    start = best;
  }
  result.push(words.slice(start).join(' '));
  return result.filter(Boolean);
}

/** Normalize common metre labels to local model-bank-style keys. Unknown names return null. */
export function detectMeterKey(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const explicit = input.meterKey ?? input.meter ?? input.chandas ?? input.name;
    if (explicit != null) return detectMeterKey(String(explicit));
    return null;
  }
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const normalized = stripDiacriticsForKey(raw)
    .replace(/[āĀ]/gu, 'a').replace(/[īĪ]/gu, 'i').replace(/[ūŪ]/gu, 'u')
    .replace(/[ṛṚ]/gu, 'r').replace(/[ṃṁ]/gu, 'm').replace(/[ḥḤ]/gu, 'h')
    .replace(/[^a-z0-9]+/gu, '');
  if (SLP1_KNOWN_METERS[normalized]) return SLP1_KNOWN_METERS[normalized];
  const devanagariAliases = [
    [/अनुष्टुभ्|अनुष्टुप्/u, 'anustubh'], [/वसन्ततिलका|वसंततिलका/u, 'vasantatilaka'],
    [/शार्दूलविक्रीडित/u, 'shardulavikridita'], [/स्रग्धरा/u, 'sragdhara'],
    [/मालिनी/u, 'malini'], [/उपजाति/u, 'upajati'], [/वंशस्थ/u, 'vamsastha'],
    [/द्रुतविलम्बित/u, 'drutavilambita'], [/मन्दाक्रान्ता/u, 'mandakranta'],
    [/शिखरिणी/u, 'sikharini'], [/भुजङ्गप्रयात|भुजंगप्रयात/u, 'bhujangaprayata'],
    [/इन्द्रवज्रा/u, 'indravajra'], [/उपेन्द्रवज्रा/u, 'upendravajra'],
    [/रथोद्धता/u, 'rathoddhata'], [/प्रहर्षिणी/u, 'praharshini'], [/हरिणी/u, 'harini'],
    [/पुष्पिताग्रा/u, 'pushpitagra'], [/जगती/u, 'jagati'], [/त्रिष्टुभ्|त्रिष्टुप्/u, 'tristubh']
  ];
  for (const [pattern, key] of devanagariAliases) if (pattern.test(raw)) return key;
  return null;
}

function devaToSlp1(input) {
  const chars = Array.from(normalizeSanskritText(input).normalize('NFC'));
  let output = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (Object.prototype.hasOwnProperty.call(DEVA_VOWEL_TO_SLP1, ch)) { output += DEVA_VOWEL_TO_SLP1[ch]; continue; }
    if (isDevaConsonant(ch)) {
      output += DEVA_CONSONANT_TO_SLP1[ch] || ch;
      if (chars[i + 1] === DEVA_NUKTA) i += 1;
      if (chars[i + 1] === DEVA_VIRAMA) { i += 1; continue; }
      if (isDevaVowelMark(chars[i + 1])) { output += DEVA_MATRA_TO_SLP1[chars[i + 1]]; i += 1; }
      else output += 'a';
      continue;
    }
    if (ch === 'ं') { output += 'M'; continue; }
    if (ch === 'ः') { output += 'H'; continue; }
    if (ch === 'ँ') { output += '~'; continue; }
    if (ch === 'ऽ') { output += "'"; continue; }
    if (ch === '।') { output += '|'; continue; }
    if (ch === '॥') { output += '||'; continue; }
    output += ch;
  }
  return output;
}

function slp1Units(input) {
  const text = String(input ?? '').trim();
  const chars = Array.from(text);
  const units = [];
  let current = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (/\s/u.test(ch) || /^[|.,;:!?]+$/u.test(ch)) {
      if (current) { units.push(current); current = ''; }
      continue;
    }
    if ((ch === 'M' || ch === 'H' || ch === '~') && !current && units.length) {
      units[units.length - 1] += ch;
      continue;
    }
    current += ch;
    if (isSlp1Vowel(ch)) { units.push(current); current = ''; }
  }
  if (current) units.push(current);
  return units;
}

/**
 * Align a Devanagari string with its SLP1 form. With one argument the script
 * is detected and the other representation is generated. The result exposes
 * per-akṣara pairs and a length-mismatch flag rather than silently truncating.
 */
export function alignSlp1(input, slp1Input = undefined) {
  const first = normalizeSanskritText(input);
  let deva;
  let slp1;
  if (slp1Input !== undefined && slp1Input !== null) {
    deva = first;
    slp1 = String(slp1Input);
  } else if (isDevanagariScriptText(first)) {
    deva = first;
    slp1 = devaToSlp1(first);
  } else {
    slp1 = first;
    deva = toDeva(first);
  }
  const devaUnits = aksharas(deva);
  const phoneticUnits = slp1Units(slp1);
  const aligned = Array.from({ length: Math.max(devaUnits.length, phoneticUnits.length) }, (_, index) => Object.freeze({
    index,
    devanagari: devaUnits[index] ?? null,
    slp1: phoneticUnits[index] ?? null,
    exactPairAvailable: index < devaUnits.length && index < phoneticUnits.length
  }));
  return Object.freeze({
    devanagari: deva,
    slp1,
    devanagariAksharas: Object.freeze(devaUnits),
    slp1Units: Object.freeze(phoneticUnits),
    aligned: Object.freeze(aligned),
    lengthAligned: devaUnits.length === phoneticUnits.length,
    note: 'Akṣara-to-SLP1 alignment is heuristic; validate on conjuncts, Vedic accents, and special phonemes before using it as model-token alignment.'
  });
}

/**
 * Calculate a per-akṣara repetition-depth heuristic. Each entry is the longest
 * shared initial character sequence with the immediately preceding unit (0 if
 * there is no shared prefix). It is descriptive metadata, not a model tensor.
 */
export function repDepths(input) {
  const source = normalizeSanskritText(input);
  const rawUnits = isDevanagariScriptText(source) ? aksharas(source).map(unit => devaToSlp1(unit)) : slp1Units(source);
  const units = rawUnits.map(unit => String(unit).replace(/[^a-zA-Z]/gu, '').toLowerCase());
  const depths = units.map((unit, index) => {
    if (index === 0 || !unit || !units[index - 1]) return 0;
    const previous = units[index - 1];
    let depth = 0;
    const limit = Math.min(unit.length, previous.length);
    while (depth < limit && unit[depth] === previous[depth]) depth += 1;
    return depth;
  });
  return depths;
}

/**
 * Create deterministic per-pada records for a local caller. Original Unicode
 * syllable text and combining marks are not transliterated; padas are trimmed
 * and danda/line delimiters are used as segmentation boundaries. The function
 * does not synthesize audio, and its shape is this module's local contract.
 * Upstream internal ABI compatibility must be tested separately.
 */
export function preparePieces(input, options = {}) {
  const sourceText = normalizeSanskritText(input);
  const opts = options && typeof options === 'object' ? options : {};
  const requestedMeter = opts.meterKey ?? opts.meter ?? 'auto';
  const meterKey = requestedMeter === 'auto' ? null : detectMeterKey(requestedMeter);
  const padas = splitPadas(sourceText);
  return padas.map((text, index) => Object.freeze({
    index,
    text,
    slp1: devaToSlp1(text),
    aksharaCount: nAksharas(text),
    endsHalant: endsHalant(text),
    meterKey,
    devanagariTextUnmodified: true
  }));
}

/** Deterministic utility tests. These do not run the AI model or ONNX Runtime. */
export function runTextModuleSelfTests() {
  const tests = [];
  const input = 'अग्निमीळे पुरोहितं॑ यज्ञस्य देवम्।';
  tests.push({ name: 'preserves Vedic accent', pass: prepareTtsTextWithoutMutation(input) === input && input.includes('॑') });
  tests.push({ name: 'normalizes CRLF and CR', pass: normalizeSanskritText('एकः\r\nद्वितीयः\rतृतीयः') === 'एकः\nद्वितीयः\nतृतीयः' });
  tests.push({ name: 'detects Udatta sign', pass: detectVedicMarks('अग्निमीळे॑').marks.some(m => m.codePoint === 'U+0951') });
  tests.push({ name: 'rejects empty input', pass: validateSanskritText('').valid === false });
  const report = analyzeVerse('वागर्थाविव संपृक्तौ वागर्थप्रतिपत्तये ।\nजगतः पितरौ वन्दे पार्वतीपरमेश्वरौ ॥');
  tests.push({ name: 'analyzeVerse returns compatible meter field', pass: Boolean(report && report.meter && Array.isArray(report.padas)) });
  tests.push({ name: 'all nine compatibility exports are callable', pass: [preparePieces, splitPadas, toDeva, nAksharas, aksharas, repDepths, endsHalant, alignSlp1, detectMeterKey].every(fn => typeof fn === 'function') });
  tests.push({ name: 'SLP1 transliteration of namaste', pass: toDeva('namaste') === 'नमस्ते' });
  tests.push({ name: 'Devanagari input is preserved by toDeva', pass: toDeva('अग्निमीळे॑') === 'अग्निमीळे॑' });
  tests.push({ name: 'akshara count excludes whitespace and danda', pass: nAksharas('रामः ।') === 2 });
  tests.push({ name: 'endsHalant detects trailing virama', pass: endsHalant('तत्') && !endsHalant('ततः') });
  tests.push({ name: 'meter alias normalization', pass: detectMeterKey('अनुष्टुप्') === 'anustubh' && detectMeterKey('not-a-real-meter') === null });
  tests.push({ name: 'preparePieces returns text records without transliterating them', pass: preparePieces('नमः शिवाय ।', { meter: 'auto' }).every(piece => piece.devanagariTextUnmodified && typeof piece.text === 'string') });
  tests.push({ name: 'preparePieces retains Vedic combining marks', pass: preparePieces('अग्निमीळे॑ यज्ञस्य । देवम् ॥').map(piece => piece.text).join(' ').includes('॑') });
  tests.push({ name: 'splitPadas returns four quarters for a standard two-hemistich sample', pass: splitPadas('वागर्थाविव संपृक्तौ वागर्थप्रतिपत्तये । जगतः पितरौ वन्दे पार्वतीपरमेश्वरौ ॥').length === 4 });
  const failed = tests.filter(test => !test.pass);
  return Object.freeze({
    ok: failed.length === 0,
    passed: tests.length - failed.length,
    failed: failed.length,
    tests: Object.freeze(tests.map(test => Object.freeze(test))),
    note: 'Utility tests only. Model inference, singing quality, Sanskrit pronunciation, and ONNX Runtime are not tested here.'
  });
}

const VagdhenuText = Object.freeze({
  version: VAGDHENU_TEXT_VERSION,
  normalizeSanskritText,
  normalizeUnicodeText,
  prepareTtsTextWithoutMutation,
  validateSanskritText,
  detectVedicMarks,
  recognizeDevanagariCharacters,
  splitIntoLines,
  segmentText,
  tokenizeSanskrit,
  countSyllables,
  analyzeVerse,
  analyzeSanskritText,
  lookupSanskritTerms,
  compareTextPreservation,
  preparePieces,
  splitPadas,
  toDeva,
  nAksharas,
  aksharas,
  repDepths,
  endsHalant,
  alignSlp1,
  detectMeterKey,
  runTextModuleSelfTests
});

export default VagdhenuText;
