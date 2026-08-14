export interface BulkRenameRules {
  findPattern: string;
  replacement: string;
  useRegex: boolean;
  replacePlusWithSpace: boolean;
  removeInputExtension: boolean;
  formatTrackTitles: boolean;
}

export const DEFAULT_BULK_RENAME_RULES: BulkRenameRules = {
  findPattern: '',
  replacement: '',
  useRegex: true,
  replacePlusWithSpace: true,
  removeInputExtension: true,
  formatTrackTitles: true,
};

const PLUS_DELIMITED_TRACK_NAME = /\+Track\+\d+\b/i;
const INPUT_EXTENSION = /\.(txt|md|docx)$/i;

export function applyBulkRenameRules(name: string, rules: BulkRenameRules): string {
  let next = name;

  if (rules.replacePlusWithSpace) {
    next = next.replace(/\+/g, ' ');
  }

  if (rules.findPattern) {
    try {
      const pattern = rules.useRegex
        ? rules.findPattern
        : rules.findPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      next = next.replace(new RegExp(pattern, 'g'), rules.replacement);
    } catch {
      // Keep the preview usable while the user edits an incomplete regular expression.
    }
  }

  if (rules.removeInputExtension) {
    next = next.replace(/\.(txt|md|docx)$/i, '');
  }

  if (rules.formatTrackTitles) {
    const track = next.match(/^(.*?)\s*(?:-\s*)?Track\s+(\d+)\b.*$/i);
    if (track) {
      const series = track[1]!.replace(/[\s-]+$/g, '').trim();
      next = `${series} - Track ${track[2]}`;
    }
  }

  return next
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[\s-]+$/g, '')
    .replace(/^[\s-]+/g, '');
}

export function getAutomaticDisplayName(name: string): string {
  if (!PLUS_DELIMITED_TRACK_NAME.test(name) || !INPUT_EXTENSION.test(name)) return name;
  return applyBulkRenameRules(name, DEFAULT_BULK_RENAME_RULES);
}
