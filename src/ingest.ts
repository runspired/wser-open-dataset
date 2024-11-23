import { FIRST_RACE_YEAR, NEXT_YEAR } from './-utils';
import { fetchSourcesForYear } from './fetch-sources-for-year';

export async function ingest() {
  const promises = [];
  for (let year = FIRST_RACE_YEAR; year <= NEXT_YEAR; year++) {
    promises.push(fetchSourcesForYear(year));
  }

  const results = await Promise.allSettled(promises);
  const errors = results.filter((result) => result.status === 'rejected');
  if (errors.length > 0) {
    console.error('Errors:', errors);
    throw new Error(
      `Failed to ingest all data. ${errors.length} years have failures.`,
    );
  }
}
