
/**
 * Swar-Sadhika machine-readable Sanskrit brain.
 * Combines source-preserving linguistic analysis with exact model-vocabulary
 * token IDs supplied by the initialized local singing engine.
 * This module does not fabricate vocabulary IDs or synthesize audio itself.
 */

import {
  normalizeSanskritText,
  analyzeVerse,
  tokenizeSanskrit,
  recognizeDevanagariCharacters,
  detectVedicMarks,
  preparePieces
} from './vagdhenu-text.js';

export const SWAR_SADHIKA_BRAIN_SCHEMA =
  'swar-sadhika-brain/v1';

export const SWAR_SADHIKA_KNOWLEDGE_SCHEMA =
  'swar-sadhika-knowledge-index/v1';


/**
 * Load the machine-readable Sanskrit knowledge index.
 */
export async function loadKnowledgeIndex(
  url = new URL(
    './sanskrit-knowledge-index.json',
    import.meta.url
  ).href
) {
  const response = await fetch(url, {
    cache: 'no-cache'
  });

  if (!response.ok) {
    throw new Error(
      `ज्ञान-सूचकांक लोड नहीं हुआ (HTTP ${response.status}).`
    );
  }

  const index = await response.json();

  if (
    index?.schema !== SWAR_SADHIKA_KNOWLEDGE_SCHEMA ||
    !Array.isArray(index.files) ||
    !Array.isArray(index.segments)
  ) {
    throw new Error(
      'ज्ञान-सूचकांक का schema अमान्य है।'
    );
  }

  return index;
}


/**
 * Search source-derived Sanskrit knowledge segments.
 * Search results are references, not proof of textual correctness.
 */
export function searchKnowledgeIndex(
  index,
  query,
  limit = 12
) {
  if (
    index?.schema !== SWAR_SADHIKA_KNOWLEDGE_SCHEMA ||
    !Array.isArray(index.segments)
  ) {
    return [];
  }

  const q = normalizeSanskritText(
    String(query ?? '')
  )
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('sa');

  if (!q) {
    return index.segments.slice(
      0,
      Math.max(0, limit)
    );
  }

  const terms = [
    ...new Set(
      (
        q.match(
          /[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF]+/gu
        ) || []
      ).filter(Boolean)
    )
  ];

  const scored = [];

  for (const segment of index.segments) {
    const text = String(
      segment.text ?? ''
    )
      .normalize('NFC')
      .toLocaleLowerCase('sa');

    const source = String(
      segment.source_path ?? ''
    );

    let score = text.includes(q) ? 100 : 0;

    for (const term of terms) {
      const words = Array.isArray(segment.tokens)
        ? segment.tokens
        : [];

      if (
        words.some(
          word =>
            String(word)
              .normalize('NFC')
              .toLocaleLowerCase('sa') === term
        )
      ) {
        score += 10;
      } else if (text.includes(term)) {
        score += 2;
      }
    }

    if (score) {
      scored.push({
        score,
        segment: { ...segment },
        source
      });
    }
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.source.localeCompare(b.source)
  );

  return scored
    .slice(0, Math.max(0, limit))
    .map(item => item.segment);
}


/**
 * Split text into grapheme clusters where supported.
 */
function graphemes(text) {
  if (
    typeof Intl !== 'undefined' &&
    typeof Intl.Segmenter === 'function'
  ) {
    return [
      ...new Intl.Segmenter('sa', {
        granularity: 'grapheme'
      }).segment(text)
    ].map(item => item.segment);
  }

  // Fallback preserves Unicode code points,
  // but may split a combining grapheme.
  return Array.from(text);
}


/**
 * Perform linguistic analysis before model inference.
 *
 * This function does not invent model token IDs.
 */
export function analyzeSanskritForBrain(
  input,
  options = {}
) {
  const sourceText = normalizeSanskritText(input);

  const analysis = analyzeVerse(
    sourceText,
    options
  );

  const tokens = tokenizeSanskrit(
    sourceText
  ).map(token =>
    Object.freeze({
      index: token.index,
      text: token.text,
      kind: token.kind,

      codePoints: Array.from(
        token.text
      ).map(character =>
        `U+${character
          .codePointAt(0)
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')}`
      ),

      graphemes: graphemes(token.text),

      hasVedicMarks: token.hasVedicMarks
    })
  );

  const characters =
    recognizeDevanagariCharacters(sourceText);

  const vedicMarks =
    detectVedicMarks(sourceText);

  const pieces = preparePieces(
    sourceText,
    {
      meter: options.meter ?? 'auto'
    }
  );

  return Object.freeze({
    schema: SWAR_SADHIKA_BRAIN_SCHEMA,

    sourceText,

    sourceTextPreserved:
      analysis.sourceTextPreserved === true,

    textAnalysis: Object.freeze({
      validation: analysis.validation,
      tokens: Object.freeze(tokens),
      padas: analysis.padas,
      pieces,
      estimatedSyllableCount:
        analysis.estimatedSyllableCount,
      meter: analysis.meter,
      characterInventory: characters,
      vedicMarks,
      warnings: analysis.warnings
    }),

    // Actual model signal is not available
    // until the initialized engine is called.
    modelSignal: null,

    state:
      'LINGUISTIC_ANALYSIS_READY_MODEL_SIGNAL_PENDING',

    limitations: Object.freeze([
      'वर्ण/अक्षर विभाजन और छन्द अनुमान अपने-आप शुद्ध उच्चारण प्रमाणित नहीं करते।',
      'वास्तविक model token IDs केवल लोड की गई मॉडल vocabulary से लिए जा सकते हैं।',
      'मशीनी संकेत बन जाना सुनाई देने वाले गायन या उसकी गुणवत्ता का प्रमाण नहीं है।'
    ])
  });
}


/**
 * Connect linguistic analysis to the initialized singing engine.
 *
 * The engine must implement:
 *   engine.analyzeInput(text, options)
 *
 * The returned model signal must preserve the exact source text.
 */
export async function buildSwarSadhikaMachineBrain(
  engine,
  input,
  options = {},
  knowledgeIndex = null
) {
  if (
    !engine ||
    typeof engine.analyzeInput !== 'function'
  ) {
    throw new TypeError(
      'Initialized singing engine with analyzeInput() is required for real model token IDs.'
    );
  }

  const linguistic =
    analyzeSanskritForBrain(input, options);

  const modelSignal = await engine.analyzeInput(
    linguistic.sourceText,
    options
  );

  if (
    !modelSignal ||
    modelSignal.sourceText !== linguistic.sourceText
  ) {
    throw new Error(
      'Text source mismatch: machine signal refused.'
    );
  }

  const knowledgeMatches = knowledgeIndex
    ? searchKnowledgeIndex(
        knowledgeIndex,
        linguistic.sourceText,
        12
      )
    : [];

  return Object.freeze({
    schema: SWAR_SADHIKA_BRAIN_SCHEMA,

    sourceText: linguistic.sourceText,

    sourceTextPreserved: true,

    textAnalysis: linguistic.textAnalysis,

    knowledgeMatches:
      Object.freeze(knowledgeMatches),

    knowledgeIndexEvidence: Object.freeze({
      loaded: Boolean(knowledgeIndex),

      sourceCount: Number(
        knowledgeIndex?.file_count || 0
      ),

      segmentCount: Number(
        knowledgeIndex?.segment_count || 0
      ),

      note:
        'Knowledge-index matches are source references for review; model token IDs still come only from the loaded model vocabulary.'
    }),

    modelSignal,

    state: 'MACHINE_SIGNAL_READY_FOR_ENGINE',

    limitations: linguistic.limitations
  });
}


/**
 * Serialize the complete machine-brain result as JSON.
 */
export function machineBrainJSON(brain) {
  return JSON.stringify(brain, null, 2);
}
