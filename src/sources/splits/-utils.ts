import type { BunFile } from 'bun';

export type CheckIn = {
  name: string;
  time: string | { in: string; out: string };
  position: number | null | { in: number | null; out: number | null };
};

export type Runner = {
  type: 'participant';
  id: string;
  attributes: Record<string, string | number | null | boolean | CheckIn[]>;
};

export type SplitContext = {
  year: number;
  url: string;
  response: Response;
  file: BunFile;
  path: string;
  OfficialStarts: Record<number, string>;
};

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new Error(`Expected array, but got ${typeof value}`);
}

export function extractFieldData(
  field: string | number | boolean | null | Date,
): string | number | null | boolean {
  if (field === null) {
    return null;
  }

  if (typeof field === 'string') {
    return field.trim();
  }

  if (typeof field === 'number') {
    return field;
  }

  if (typeof field === 'boolean') {
    return field;
  }

  if (field instanceof Date) {
    // this will get corrected in a second pass
    return field.toISOString();
  }

  throw new Error(`Unexpected field type: ${typeof field}`);
}

export function assert(
  message: string,
  condition: boolean,
  log?: unknown,
): asserts condition {
  if (!condition) {
    if (log !== undefined) {
      console.log(log);
    }
    throw new Error(message);
  }
}

// occasionally cell data is a time range for "in/out" of the Aide Station.
// In these cases we get a string that looks like
//  07:44:00-07:46:00
//  01:36:00---:--
//  --:-----:--
//  --:---01:36:00
//
export const TimePlaceholder = '--:--';
export function isTimeRange(timeStr: string): boolean {
  if (typeof timeStr !== 'string') {
    return false;
  }
  if (timeStr === TimePlaceholder) {
    return false;
  }
  if (timeStr.includes(TimePlaceholder)) {
    return true;
  }
  if (!timeStr.includes('-')) {
    return false;
  }
  const parts = timeStr.split('-');
  if (parts.length !== 2) {
    return false;
  }
  if (parts[0].includes(':') && parts[1].includes(':')) {
    return true;
  }
  return false;
}

export const TimeHold = '__UNKOWN__';

export function parseTimeIntoDatetime(
  timeStr: string,
  officialStartTime: number,
): string {
  if (timeStr === TimeHold) {
    return TimeHold;
  }

  let milliseconds = 0;
  const parts = timeStr.split(':');
  assert(
    `Expected at least 3 parts, but got ${parts.length} - ${timeStr}`,
    parts.length === 3 || parts.length === 4,
  );
  milliseconds += Number(parts.pop()!) * 1000; // seconds
  milliseconds += Number(parts.pop()!) * 60 * 1000; // minutes
  milliseconds += Number(parts.pop()!) * 60 * 60 * 1000; // hours
  if (parts.length > 0) {
    milliseconds += Number(parts.pop()!) * 24 * 60 * 60 * 1000; // days
  }
  return new Date(officialStartTime + milliseconds).toISOString();
}

export function getTimeRange(
  timeStr: string,
  officialStartTime: number,
): { in: string; out: string } {
  const safeSplit = timeStr.replaceAll(TimePlaceholder, TimeHold);
  const parts = safeSplit.split('-');

  if (parts[0] === '' || parts[1] === '') {
    throw new Error(`Invalid time range: ${timeStr}`);
  }

  return {
    in:
      parts[0] === TimeHold
        ? TimePlaceholder
        : parseTimeIntoDatetime(parts[0], officialStartTime),
    out:
      parts[1] === TimeHold
        ? TimePlaceholder
        : parseTimeIntoDatetime(parts[1], officialStartTime),
  };
}

export function extractTimeField(
  data: string | Date,
  startDatetime: number,
  dateRelativeStartTime: number,
  assumeMissingIsStart = false,
): string | { in: string; out: string } {
  if (data === '--:--') {
    return assumeMissingIsStart
      ? new Date(startDatetime).toISOString()
      : '--:--';
  }

  if (typeof data === 'string' && isTimeRange(data)) {
    return getTimeRange(data, startDatetime);
  }

  assert(
    `Expected data to be a Date, but got ${typeof data}`,
    data instanceof Date,
    data,
  );

  const elapsed = data.getTime() - dateRelativeStartTime;
  return new Date(startDatetime + elapsed).toISOString();
}
