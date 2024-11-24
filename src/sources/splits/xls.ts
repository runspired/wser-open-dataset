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
import { styleText } from 'util';
import xlsx from 'node-xlsx';

export async function processXlsFileForSplits(context: SplitContext) {
  return;
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

  const buffer = await response.arrayBuffer();
  const sheets = xlsx.parse(Buffer.from(buffer));
  const { data: rows } = sheets[0];

  const headers = rows.shift()!.map((header: string) => {
    assert(
      `Expected header to be a string, but got ${typeof header}`,
      typeof header === 'string',
    );
    const value = header.trim();
    return FieldInverses.get(value) ?? value;
  });

  if (rows[0][0] === 'Place') {
    console.log({ headers, headers2: rows[0] });
  }

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
    let firstDateEncountered: Date | null = null;
    let dateRelativeStartTime: number | null = null;
    const officialStartTime = new Date(OfficialStarts[year]).getTime();
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const field = row[j];

      if (header in labels) {
        runner.attributes[header] = extractFieldData(
          // @\ts-expect-error CellValue is typed as DateConstructor instead of Date
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
