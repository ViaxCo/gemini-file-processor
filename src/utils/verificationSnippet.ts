export interface VerificationSnippetResult {
  originalSnippet: string;
  processedSnippet: string;
  similarity: number; // 0..1 (Jaccard on unique words)
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Extract ending snippets and compute a light-weight similarity score.
 * Defaults align with project brainstorming: last ~250 chars, unique-word Jaccard.
 */
export function generateVerificationSnippet(
  original: string,
  processed: string,
  tailLength: number = 250,
): VerificationSnippetResult {
  const originalSnippet = original.slice(Math.max(0, original.length - tailLength));
  const processedSnippet = processed.slice(Math.max(0, processed.length - tailLength));

  const o = normalize(originalSnippet);
  const p = normalize(processedSnippet);

  const setOf = (s: string): Set<string> => new Set(s.split(/\s+/).filter(Boolean));
  const a = setOf(o);
  const b = setOf(p);
  if (a.size === 0 || b.size === 0) {
    return { originalSnippet, processedSnippet, similarity: 0 };
  }

  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  return { originalSnippet, processedSnippet, similarity: jaccard };
}
