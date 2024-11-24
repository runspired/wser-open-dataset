import { inverseMap } from '../-shared';
import {
  asArray,
  assert,
  extractFieldData,
  extractTimeField,
  isTimeRange,
  type CheckIn,
  type Runner,
  type SplitContext,
} from './-utils';
import stream from 'node:stream';
import { styleText } from 'util';

export async function processXlsxFileForSplits(context: SplitContext) {
  const { url, response, year, file, path, OfficialStarts } = context;

  const labels = {
    overallPlace: ['Overall Place'],
    time: 'Time',
    bib: 'Bib',
    firstName: 'First Name',
    lastName: 'Last Name',
    gender: 'Gender',
    age: 'Age',
    city: 'City',
    state: 'State',
    country: 'Country',
  };
  const FieldInverses = inverseMap(labels);

  // TODO this parser does not support XLS files
  // so we should consider unifying with the XLS parser below
  // which supports both.
  const parser = await import('read-excel-file/node');
  const rows = await parser.default(
    stream.Readable.fromWeb(
      // @ts-expect-error library types are insufficient
      response.body!,
    ),
  );

  const headers = rows.shift()!.map((header) => {
    assert(
      `Expected header to be a string, but got ${typeof header}`,
      typeof header === 'string',
    );
    const value = header.trim();
    return FieldInverses.get(value) ?? value;
  });

  const data: Runner[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const runner: Runner = {
      type: 'participant',
      id: `${year}:${i}`,
      attributes: {
        timing: [],
      },
    };

    if (row.length !== headers.length) {
      throw new Error(
        `BoundsError: expected ${headers.length} columns on row ${i} but got ${row.length} for splits from the xlsx spreadsheet for year ${year}`,
      );
    }

    let checkin = null;
    // we don't know what date+time the xlsx file decided to use to encode the times
    // so we need to calculate the relative time from the first time we see
    // thiis can be challenging because time-ranges are encoded as strings not dates
    // and start time is encoded as `--:--`.
    //
    // while we will have seen "finish times" above, since they may or may-not cross
    // a date boundary its less safe to use them as the reference time.
    //
    // Our approach here is to use the first split time recorded as the reference time
    // which generally will be the top of the escarpment. This ensures that we are using
    // at least the correct "first date".
    //
    // We additionally make the presumption that the datetime is using midnight as the
    // start-time. This may turn out to not be safe but appears to be the case in the
    // data we've seen so far.
    //
    // once we have encountered a date we can go back and fix any time fields we've already
    // seen.
    let firstDateEncountered: Date | null = null;
    let dateRelativeStartTime: number | null = null;
    const officialStartTime = new Date(OfficialStarts[year]).getTime();
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const field = row[j];

      // we treat all labels that aren't in our list above as
      // aide stations: with columns alternating between time
      // and position.
      //
      // This works because the final time column is called "time"
      // and not "finish" / e.g. there are no overlapping labels.
      // however: in the xls sheets there are two columns labeled "finish"
      // and instead of ranges Aide stations have both "in" and "out"
      // columns.
      // This is why XLS is handled separately.
      // If the format diverges for xlsx in future years we may need to process by
      // year, grouping by assumptions, instead of by format.
      if (header in labels) {
        runner.attributes[header] = extractFieldData(
          // @ts-expect-error CellValue is typed as DateConstructor instead of Date
          field,
        );
      } else {
        if (!checkin) {
          if (
            !firstDateEncountered &&
            field !== '--:--' &&
            !isTimeRange(field as string)
          ) {
            firstDateEncountered = field as unknown as Date;
            assert(
              `Expected a date, but got a field of type ${typeof field}`,
              firstDateEncountered instanceof Date,
              field,
            );
            const relativeTimeString =
              firstDateEncountered.toISOString().split('T')[0] +
              'T00:00:00.000Z';
            dateRelativeStartTime = new Date(relativeTimeString).getTime();
            assert(
              `Expected a valid date to result from ${relativeTimeString}`,
              !isNaN(dateRelativeStartTime),
              relativeTimeString,
            );
          }
          checkin = {
            name: header,
            time: extractTimeField(
              field as unknown as Date,
              officialStartTime,
              dateRelativeStartTime!,
              asArray(runner.attributes.timing).length === 0,
            ),
            position: null as number | null,
          };
          asArray<CheckIn>(runner.attributes.timing).push(checkin);
        } else {
          checkin.position = field as number;
          checkin = null;
        }
      }

      // fix the time field
      for (const header of headers) {
        if (runner.attributes[header] instanceof Date) {
          runner.attributes[header] = extractTimeField(
            runner.attributes[header],
            officialStartTime,
            dateRelativeStartTime!,
          ) as string;
        }
      }
    }

    data.push(runner);
  }

  await Bun.write(
    file,
    JSON.stringify({
      data: {
        type: 'split-list',
        id: `${year}`,
        attributes: {
          year,
          source: url,
          accessed: new Date().toISOString(),
        },
        relationships: {
          splits: {
            data: data.map(({ type, id }) => ({ type, id })),
          },
        },
      },
      included: data,
    }),
  );

  console.log(
    `✅ Processed ${styleText('cyan', String(year))} split | ${styleText('underline', styleText('gray', path))}`,
  );
  return;
}
