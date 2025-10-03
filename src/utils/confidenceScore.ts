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

// (Removed unused bigram/cosine helpers)

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
  if (jaccard >= 0.7) level = 'high';
  else if (jaccard >= 0.4) level = 'medium';
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
