export const FIRST_RACE_YEAR = 1974;
export const FIRST_SUPPORTED_YEAR = 2013;
export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth();
export const NOVEMBER = 10;
export const NEXT_YEAR =
  CURRENT_MONTH < NOVEMBER ? CURRENT_YEAR : CURRENT_YEAR + 1;
export const FIRST_WAITLIST_YEAR = 2017;
export const LAST_SPLIT_XLS_YEAR = 2013;
export const FIRST_SPLIT_XLS_YEAR = 2004;
export const FIRST_SPLIT_XLSX_YEAR = 2014;
export const FIRST_SPLIT_TXT_YEAR = 1986;
export const LAST_SPLIT_TXT_YEAR = 2007;
export const PayloadType = Symbol();
/**
 * NOTES:
 *
 * due to the COVID19 Pandemic:
 * the 2020 race was cancelled
 * the 2020 lottery was rolled over to the 2021 race
 *   however this entrants list is still published and
 *   so we still collect the data in case it is useful
 * the 2020 waitlist became the 2021 waitlist
 *
 * ...
 *
 * the 2008 race was cancelled due to wildfires
 *
 * ...
 *
 * the 1975 race had no finishers (1 starter)
 */
export const SKIPPED_APPLICANT_YEARS = [2021];
export const SKIPPED_WAITLIST_YEARS = [2020];
export const SKIPPED_SPLIT_YEARS = [2008, 2020];
export const SKIPPED_ENTRANTS_YEARS: number[] = [
  // 2020 // see note above for why we still collect this data
];
export const SKIPPED_FINISHERS_YEARS = [1975, 2008, 2020];
export type SourceType =
  | 'finisher'
  | 'entrant'
  | 'applicant'
  | 'waitlist'
  | 'split'
  | 'live';

export function isSkippedYear(year: number, type: SourceType) {
  switch (type) {
    case 'applicant':
      return (
        year < FIRST_SUPPORTED_YEAR || SKIPPED_APPLICANT_YEARS.includes(year)
      );
    case 'entrant':
      return (
        year < FIRST_SUPPORTED_YEAR || SKIPPED_ENTRANTS_YEARS.includes(year)
      );
    case 'waitlist':
      return (
        year < FIRST_WAITLIST_YEAR || SKIPPED_WAITLIST_YEARS.includes(year)
      );
    case 'split':
      // return year !== CURRENT_YEAR;
      return year < FIRST_SPLIT_XLS_YEAR || SKIPPED_SPLIT_YEARS.includes(year);
    //return year < FIRST_SPLIT_TXT_YEAR || SKIPPED_SPLIT_YEARS.includes(year);
    case 'finisher':
      return SKIPPED_FINISHERS_YEARS.includes(year);
    case 'live':
      return year !== CURRENT_YEAR && year !== NEXT_YEAR;
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}

function logErrors(errors: PromiseRejectedResult[] | Error[], depth = 1) {
  const prefix = (depth === 1 ? '🔺' : '·').padStart(depth, '\t');

  for (const error of errors) {
    console.log(error);
    // @ts-expect-error
    const message = error.message || error.reason?.message;
    // @ts-expect-error
    const nested = error.errors || error.reason?.errors;
    // @ts-expect-error
    console.log(`${prefix} ${error.reason.message}`);
    if (nested) {
      logErrors(nested, depth + 1);
      console.log('\n');
    }
  }
}

export async function throwIfAnyErrors<T>(
  promises: Promise<T>[],
  message: (errors: PromiseRejectedResult[]) => string,
  log = true,
) {
  const results = await Promise.allSettled(promises);
  const errors = results.filter((result) => result.status === 'rejected');
  if (errors.length > 0) {
    if (log) logErrors(errors);
    const error = new Error(message(errors));
    if (!log) {
      // @ts-expect-error we are intentionally adding a property to the error
      error.errors = errors;
    }
    throw error;
  }
}

export async function GET(url: string) {
  const urlWithoutProtocol =
    url.replace(/^https?:\/\//, '').replaceAll('/', '_') + '.cached.txt';
  const filePath = `./.fetch-cache/${urlWithoutProtocol}`;
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (exists) {
    console.log(`\t📦  Using .fetch-cache for: ${url}`);
    return new Response(file.stream());
  }
  const response = await fetch(url);
  console.log(`\t🔗  Fetching: ${url}`);
  if (response.ok && response.status < 300) {
    const content = await response.text();
    await Bun.write(file, content);
    return new Response(file.stream());
  }

  return response;
}

export function throwIfHttpError(response: Response) {
  if (response.status >= 400) {
    throw new Error(
      `RequestError: [${response.status}] ${response.url} ${response.statusText}`,
    );
  }
}
