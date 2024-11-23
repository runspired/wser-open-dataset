import { fetchApplicantData } from './lottery/applicant';
import { fetchWaitlistData } from './lottery/waitlist';
import {
  CURRENT_YEAR,
  FIRST_WAITLIST_YEAR,
  isSkippedYear,
  NEXT_YEAR,
} from './-utils';
import { fetchLatestLiveLotteryResults } from './lottery/live';
import { asError } from './lottery/-shared';
import { fetchEntrantsData } from './lottery/entrants';

export async function fetchDataForYear(
  year: number,
  force = false,
): Promise<void> {
  const promises = [];

  if (!isSkippedYear(year, 'lottery')) {
    promises.push(fetchApplicantData(year, force));
  }

  if (!isSkippedYear(year, 'race')) {
    promises.push(fetchEntrantsData(year, force));
  }

  if (!isSkippedYear(year, 'results')) {
    // promises.push(fetchResultsData(year, force));
    // promises.push(fetchSplitData(year, force));
    // TODO fetch result data for each year (https://www.wser.org/results/2024-results/)
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
    throw new Error(`Failed to fetch all data for ${year}`);
  }
}
