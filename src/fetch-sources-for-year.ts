import { fetchApplicantData } from './sources/applicant';
import { fetchWaitlistData } from './sources/waitlist';
import {
  CURRENT_YEAR,
  FIRST_WAITLIST_YEAR,
  isSkippedYear,
  NEXT_YEAR,
} from './-utils';
import { fetchLatestLiveLotteryResults } from './sources/live';
import { asError } from './sources/-shared';
import { fetchEntrantsData } from './sources/entrants';
import { fetchFinishersData } from './sources/finishers';

export async function fetchSourcesForYear(
  year: number,
  force = false,
): Promise<void> {
  const promises = [];

  if (!isSkippedYear(year, 'applicants')) {
    promises.push(fetchApplicantData(year, force));
  }

  if (!isSkippedYear(year, 'entrants')) {
    promises.push(fetchEntrantsData(year, force));
  }

  if (!isSkippedYear(year, 'finishers')) {
    promises.push(fetchFinishersData(year, force));
    // TODO fetch full result set from ??
    // TODO fetch split data promises.push(fetchSplitData(year, force));
  }

  if (!isSkippedYear(year, 'waitlist') && year >= FIRST_WAITLIST_YEAR) {
    promises.push(fetchWaitlistData(year, force));
  }

  if (year === CURRENT_YEAR || year === NEXT_YEAR) {
    try {
      // only fetch the latest lottery results if the year is the current year
      // or the upcoming year.
      await fetchLatestLiveLotteryResults(year);
    } catch (error: unknown) {
      console.log(`\t⚠️ ${asError(error).message}`);
    }
  }

  const results = await Promise.allSettled(promises);
  const errors = results.filter((result) => result.status === 'rejected');
  if (errors.length > 0) {
    console.error('Errors:', errors);
    throw new Error(
      `Failed to fetch all data for ${year}, ${errors.length} tasks failed.`,
    );
  }
}
