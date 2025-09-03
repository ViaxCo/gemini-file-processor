export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceResult {
  score: number; // 0..1
  level: ConfidenceLevel;
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    // remove punctuation and symbols, keep letters/numbers/space
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Build character bigrams frequency map
const bigrams = (s: string): Map<string, number> => {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    map.set(g, (map.get(g) || 0) + 1);
  }
  return map;
};

const cosineSimilarity = (a: Map<string, number>, b: Map<string, number>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, v] of a) normA += v * v;
  for (const [, v] of b) normB += v * v;
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const va = a.get(k) || 0;
    const vb = b.get(k) || 0;
    dot += va * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const getConfidenceScore = (
  original: string,
  processed: string,
  tailLength: number = 250,
): ConfidenceResult => {
  // Use unique-word Jaccard similarity over the tail segments to match brainstorming intent
  const oTail = normalize(original).slice(-tailLength);
  const pTail = normalize(processed).slice(-tailLength);

  const toWordSet = (s: string): Set<string> => {
    const words = s.split(/\s+/).filter((w) => w.length > 0);
    return new Set(words);
  };

  const a = toWordSet(oTail);
  const b = toWordSet(pTail);
  if (a.size === 0 || b.size === 0) {
    return { score: 0, level: 'low' };
  }

  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  let level: ConfidenceLevel;
  if (jaccard >= 0.8) level = 'high';
  else if (jaccard >= 0.5) level = 'medium';
  else level = 'low';
  return { score: jaccard, level };
};

export const confidenceColorClass = (level: ConfidenceLevel): string => {
  switch (level) {
    case 'high':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'medium':
      return 'text-amber-600 dark:text-amber-400';
    case 'low':
    default:
      return 'text-rose-600 dark:text-rose-400';
  }
};
