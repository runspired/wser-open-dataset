import type { SplitContext } from './-utils';

export async function processTxtFileForSplits(context: SplitContext) {
  return;
  const { url, response, year } = context;

  if (!url.endsWith('.txt')) {
    throw new Error(
      `InvalidFormat: expected the a txt file but received '${url}' for ${year}`,
    );
  }
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
