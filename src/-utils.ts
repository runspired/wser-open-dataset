export const FIRST_SUPPORTED_YEAR = 2013;
export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth();
export const NOVEMBER = 10;
export const NEXT_YEAR =
  CURRENT_MONTH <= NOVEMBER ? CURRENT_YEAR : CURRENT_YEAR + 1;
export const FIRST_WAITLIST_YEAR = 2017;

/**
 * NOTES:
 *
 * due to the COVID19 Pandemic:
 * the 2020 race was cancelled
 * the 2020 lottery was rolled over to the 2021 race
 *   however this entrants list is still published and
 *   so we still collect the data in case it is useful
 * the 2020 waitlist became the 2021 waitlist
 */
export const SKIPPED_LOTTERY_YEARS = [2021];
export const SKIPPED_WAITLIST_YEARS = [2020];
export const SKIPPED_RACE_YEARS: number[] = [
  // 2020 // see note above for why we still collect this data
];
export const SKIPPED_RESULTS_YEARS = [2020];

export function isSkippedYear(
  year: number,
  type: 'lottery' | 'race' | 'waitlist' | 'results',
) {
  switch (type) {
    case 'lottery':
      return SKIPPED_LOTTERY_YEARS.includes(year);
    case 'race':
      return SKIPPED_RACE_YEARS.includes(year);
    case 'waitlist':
      return SKIPPED_WAITLIST_YEARS.includes(year);
    case 'results':
      return SKIPPED_RESULTS_YEARS.includes(year);
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}
