const SERIES = [
  { title: 'Bible+Doctrine+on+Sin', tracks: 12 },
  { title: 'Binding+and+Loosing', tracks: 8 },
  { title: 'In+the+Spirit+By+the+Spirit+Series+7a+-+The+Power+of+the+Holy+Spirit', tracks: 10 },
  { title: 'The+Believer+and+the+Authority+of+Christ', tracks: 6 },
  {
    title: 'Understanding+Prayer+and+the+Very+Long+Teaching+Series+Name+Used+to+Test+Wrapping',
    tracks: 9,
  },
  { title: 'Faith+for+Everyday+Life', tracks: 5 },
];

const CONTENT =
  'This is a short synthetic transcript. It tests spelling correction, queue progress, filename cleanup, and response display without private information.';

function getOrdinal(value: number) {
  const lastTwoDigits = value % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${value}th`;

  const lastDigit = value % 10;
  const suffix = lastDigit === 1 ? 'st' : lastDigit === 2 ? 'nd' : lastDigit === 3 ? 'rd' : 'th';
  return `${value}${suffix}`;
}

export function createTestFiles(count: 10 | 50 | 100): File[] {
  const files: File[] = [];
  let seriesIndex = 0;
  let track = 1;

  while (files.length < count) {
    const series = SERIES[seriesIndex % SERIES.length]!;
    const collectionNumber = Math.floor(seriesIndex / SERIES.length) + 1;
    const collection = collectionNumber > 1 ? `+Collection+${collectionNumber}` : '';
    const name = `${series.title}${collection}+Track+${track}+${getOrdinal(track)}+Jan+2024.txt`;
    files.push(
      new File([`${CONTENT}\n\nSeries ${seriesIndex + 1}, track ${track}.`], name, {
        type: 'text/plain',
      }),
    );

    track += 1;
    if (track > series.tracks) {
      seriesIndex += 1;
      track = 1;
    }
  }

  return files;
}
