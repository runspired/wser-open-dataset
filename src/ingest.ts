import { FIRST_SUPPORTED_YEAR, NEXT_YEAR } from './-utils';
import { fetchDataForYear } from './lottery-utils';

export async function ingest() {
  const promises = [];
  for (let year = FIRST_SUPPORTED_YEAR; year <= NEXT_YEAR; year++) {
    promises.push(fetchDataForYear(year));
  }

  const results = await Promise.allSettled(promises);
  const errors = results.filter((result) => result.status === 'rejected');
  if (errors.length > 0) {
    console.error('Errors:', errors);
    throw new Error('Failed to ingest all data');
  }
}
