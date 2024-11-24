import { FIRST_RACE_YEAR, NEXT_YEAR, throwIfAnyErrors } from './-utils';
import { fetchSourcesForYear } from './fetch-sources-for-year';

export function ingest() {
  const promises = [];
  for (let year = FIRST_RACE_YEAR; year <= NEXT_YEAR; year++) {
    promises.push(fetchSourcesForYear(year));
  }

  return throwIfAnyErrors(
    promises,
    (errors) =>
      `Failed to ingest all data. ${errors.length} years have failures.`,
    true,
  );
}
