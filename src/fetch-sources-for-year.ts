import { fetchApplicantData } from './sources/applicant';
import { fetchWaitlistData } from './sources/waitlist';
import { fetchLatestLiveLotteryResults } from './sources/live';
import { fetchEntrantsData } from './sources/entrants';
import { fetchFinishersData } from './sources/finishers';
import { throwIfAnyErrors } from './-utils';

export function fetchSourcesForYear(
  year: number,
  force = false,
): Promise<void> {
  return throwIfAnyErrors(
    [
      fetchApplicantData(year, force),
      fetchEntrantsData(year, force),
      fetchWaitlistData(year, force),
      fetchFinishersData(year, force),
      // TODO fetch full result set from ??
      // TODO fetch split data promises.push(fetchSplitData(year, force));
      fetchLatestLiveLotteryResults(year, force),
    ],
    (errors) =>
      `Failed to fetch all data for ${year}, ${errors.length} tasks failed.`,
    false,
  );
}
