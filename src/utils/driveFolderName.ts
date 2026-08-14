export function formatSeriesFolderName(name: string) {
  return name.trim().toUpperCase();
}

function getSeriesTitle(name: string) {
  const displayName = name.trim().replace(/\.(?:txt|md|docx)$/i, '');
  const trackTitle = displayName.match(/^(.*?)\s*(?:-\s*)?Track\s+\d+\b.*$/i);

  return (trackTitle?.[1] ?? displayName).replace(/[\s-]+$/g, '').trim();
}

export function suggestSeriesFolderName(displayNames: string[]) {
  if (displayNames.length === 0) return '';

  const seriesTitles = displayNames.map(getSeriesTitle);
  const firstTitle = seriesTitles[0];
  if (!firstTitle) return '';

  const normalizedFirstTitle = formatSeriesFolderName(firstTitle);
  return seriesTitles.every((title) => formatSeriesFolderName(title) === normalizedFirstTitle)
    ? normalizedFirstTitle
    : '';
}
