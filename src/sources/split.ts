import { isSkippedYear } from '../-utils';
import { makeUrl } from './-shared';

export function fetchSplitData(year: number, force = false): Promise<void> {
  return _fetchSplitData(year, force);
}

async function _fetchSplitData(year: number, force = false): Promise<void> {
  if (isSkippedYear(year, 'split')) {
    return;
  }

  // early return as we haven't finished implementing
  // split extraction.
  return;

  // we always serve from cache unless asked to force generate
  const path = `./.data-cache/raw/${year}/split.json`;
  const file = Bun.file(path);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    return;
  }

  const url = makeUrl('split', year);
  const response = await fetch(url);
  const txtData = await response.text();

  const lines = txtData.split('\n');
  const title = lines.shift()!;
  const headers = [lines.shift()!.split('\t'), lines.shift()!.split('\t')];
  const runners = [];
  for (let i = 0; i < lines.length; i += 2) {
    runners.push([lines[i].split('\t'), lines[i + 1].split('\t')]);
  }
  const data = {
    title,
    headers,
    runners,
  };

  console.log({
    title,
    headers,
  });

  for (const runner of data.runners) {
    console.log('\n\n-----------\n\n');
    console.log(runner[0]);
    console.log(runner[1]);
  }

  throw new Error('Not implemented');
}
