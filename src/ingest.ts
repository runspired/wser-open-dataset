import { FIRST_RACE_YEAR, NEXT_YEAR, throwIfAnyErrors } from './-utils';
import { fetchSourcesForYear } from './fetch-sources-for-year';
import { styleText } from 'node:util';

export async function ingest() {
  const promises = [];
  console.log(
    `\nIngesting data for years ${styleText('cyan', String(FIRST_RACE_YEAR))} to ${styleText('cyan', String(NEXT_YEAR))}\n\n`,
  );
  for (let year = FIRST_RACE_YEAR; year <= NEXT_YEAR; year++) {
    promises.push(fetchSourcesForYear(year));
  }

  await throwIfAnyErrors(
    promises,
    (errors) =>
      `Failed to ingest all data. ${errors.length} years have failures.`,
    true,
  );

  console.log('\n🎉 Data ingestion complete!\n\n');
}
