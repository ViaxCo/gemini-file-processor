const TRACK_TITLE = /^(.*?)\s*(?:-\s*)?\bTrack\s+(\d+)\b.*$/i;
const INPUT_EXTENSION = /\.(?:txt|md|docx)$/i;

function parseTrack(displayName: string) {
  const name = displayName.trim().replace(INPUT_EXTENSION, '');
  const match = name.match(TRACK_TITLE);
  if (!match) return;

  const title = match[1]!
    .replace(/[\s-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return;

  return {
    title,
    key: title.toLowerCase(),
    trackNumber: Number(match[2]),
  };
}

function moveUploadedLast(indices: number[], isUploaded: (index: number) => boolean) {
  const notUploaded: number[] = [];
  const uploaded: number[] = [];

  for (const index of indices) {
    if (isUploaded(index)) uploaded.push(index);
    else notUploaded.push(index);
  }

  return [...notUploaded, ...uploaded];
}

export function groupFilesBySeries(
  files: Array<{ index: number; displayName: string }>,
  isUploaded: (index: number) => boolean = () => false,
) {
  const series = new Map<string, { id: string; title: string; tracks: Array<[number, number]> }>();
  const ungrouped: number[] = [];

  for (const file of files) {
    const track = parseTrack(file.displayName);
    if (!track) {
      ungrouped.push(file.index);
      continue;
    }

    const group = series.get(track.key) ?? {
      id: `series:${track.key}`,
      title: track.title,
      tracks: [],
    };
    group.tracks.push([track.trackNumber, file.index]);
    series.set(track.key, group);
  }

  const groups = [...series.values()]
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
    )
    .map(({ tracks, ...group }) => ({
      ...group,
      indices: moveUploadedLast(
        [...tracks]
          .sort(([trackA, indexA], [trackB, indexB]) => trackA - trackB || indexA - indexB)
          .map(([, index]) => index),
        isUploaded,
      ),
      isUngrouped: false,
    }));

  if (ungrouped.length > 0) {
    groups.push({
      id: 'ungrouped',
      title: 'Ungrouped Files',
      indices: moveUploadedLast(ungrouped, isUploaded),
      isUngrouped: true,
    });
  }

  return groups;
}
