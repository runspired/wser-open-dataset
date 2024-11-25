import type { BunFile } from 'bun';
import { JSDOM } from 'jsdom';
import {
  FIRST_SPLIT_XLS_YEAR,
  GET,
  isSkippedYear,
  LAST_SPLIT_XLS_YEAR,
  NEXT_YEAR,
  PayloadType,
  throwIfHttpError,
  type SourceType,
} from '../-utils';
import { styleText } from 'node:util';

// on the 2^(n - 1) formula
// 1 => 1
// 2 => 2
// 4 => 3
// 8 => 4
// 16 => 5
// 32 => 6
export function ticketsToYears(tickets: number): number {
  if (tickets === 1) {
    return 1;
  }
  let years = 1;
  while (tickets > 1) {
    tickets = tickets / 2;
    years++;
  }
  return years;
}

type DomInfo = {
  file: BunFile;
  url: string;
  path: string;
  exists: boolean;
  forceGenerate: boolean;
  html: JSDOM;
  raw: string;
};

type Info =
  | {
      file: BunFile;
      url: string;
      path: string;
      exists: boolean;
      forceGenerate: boolean;
      html: null;
      raw: null;
    }
  | DomInfo;

async function tryExtract(info: DomInfo, tableSelector: string, year: number) {
  try {
    return await extractTableData(info, tableSelector);
  } catch (error: unknown) {
    if (year === NEXT_YEAR) {
      console.log(`\t⚠️ Parse Error: ${asError(error).message}`);
      return;
    }
    throw error;
  }
}

export async function extractTableData(
  info: DomInfo,
  tableSelector: string,
): Promise<{
  labels: string[];
  data: { index: number; data: string[] }[];
}> {
  const { html, url } = info;

  const table = html.window.document.querySelector(`${tableSelector} tbody`);
  const tableHeader = html.window.document.querySelector(
    `${tableSelector} thead tr:nth-child(1)`,
  );

  if (!table) {
    // console.log(html.window.document.querySelector(tableSelector));
    throw new Error(
      `Unable to find table body "${tableSelector} tbody" for ${url}`,
    );
  }

  if (!tableHeader) {
    throw new Error(
      `Unable to find table header "${tableSelector} thead" for ${url}`,
    );
  }

  // extract the labels from the table header
  let hasNullLabels = false;
  const labels = Array.from(tableHeader.querySelectorAll('th')).map((th) => {
    const text = th.textContent?.trim();
    if (!text) {
      hasNullLabels = true;
      return null;
    }
    return text;
  });

  // extract the rows from the table
  const data = [] as { index: number; data: string[] }[];

  // extract the entrants from the table
  table.querySelectorAll('tr').forEach((row, index) => {
    // extract the fields from the row
    const fieldValues = Array.from(row.querySelectorAll('td')).map((td) =>
      td.textContent!.trim(),
    );

    if (labels.length !== fieldValues.length) {
      throw new Error(
        `BoundsError: Mismatched labels to fields on row ${index} for ${url}`,
      );
    }

    if (hasNullLabels) {
      // ensure the null labels are for empty cells
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] === null && fieldValues[i]) {
          // 1990 has a two asstericks in an empty column representing
          // runners who were originally DQ'd but later reinstated
          // we do not currently represent this fact in the dataset.
          if (
            url === 'https://www.wser.org/results/1990-results/' &&
            i === 6 &&
            fieldValues[i] === '*'
          ) {
            fieldValues[i] = '';
            continue;
          }
          throw new Error(
            `BoundsError: There is no label for the field in cell ${i} on row ${index} for ${url}`,
          );
        }
      }
    }

    data.push({
      index,
      data: fieldValues,
    });
  });

  if (!hasNullLabels) {
    return { labels: labels as string[], data };
  }

  // if we've made it this far without erring and have null labels, we can drop those indeces
  const newLabels = [] as string[];
  const removedIndeces = [] as number[];

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label !== null) {
      newLabels.push(label);
    } else {
      // unshift so that we can iterate this in reverse
      removedIndeces.unshift(i);
    }
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // the indeces are in reverse order e.g. 8 5 1
    // which makes it safe to iteratively splice them out
    // as each splice will not affect the next index to remove
    for (const index of removedIndeces) {
      const deleted = row.data.splice(index, 1);
      if (deleted[0]) {
        throw new Error(
          `BoundsError: Attempted to delete a NON-EMPTY cell ${index} with value "${deleted}" from row ${i} for ${url}`,
        );
      }
    }
  }

  return { labels: newLabels, data };
}

export async function getHtmlIfNeeded(
  url: string,
  path: string,
  force: boolean,
): Promise<Info | Response> {
  // we always serve from cache unless asked to force generate
  const file = Bun.file(path);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    return {
      file,
      url,
      path,
      exists,
      forceGenerate,
      html: null,
      raw: null,
    };
  }

  const response = await GET(url);
  // avoid erring for stats that likely just don't exist yet
  if (response.status >= 400) {
    return response;
  }
  const data = await response.text();
  const html = new JSDOM(data);

  return {
    file,
    url,
    path,
    exists,
    forceGenerate,
    html,
    raw: data,
  };
}

export function asError(error: unknown): Error {
  return error as unknown as Error;
}

export function inverseMap<T extends Record<string, string | string[]>>(
  source: T,
): Map<string, keyof T & string> {
  const InverseFieldMap = new Map<string, keyof T & string>();
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        InverseFieldMap.set(v, key as keyof T & string);
      }
    } else {
      InverseFieldMap.set(value as string, key as keyof T & string);
    }
  }

  return InverseFieldMap;
}

/**
 * Works with most tables on https://wser.org (not the subdomain tables)
 */
export type Attrs = Record<string, string | number | null>;
export type FieldsOfType<
  T extends Attrs,
  Type extends string | number | null,
> = {
  [Prop in keyof T & string]: AllowsType<T[Prop], Type> extends true
    ? Prop
    : never;
}[keyof T & string];
type OtherTypes<T> = Exclude<string | number | null, T>;
type AllowsType<V, T> = Exclude<V, OtherTypes<T>> extends never ? false : true;

type StandardTableConfig<T extends Attrs, Type extends SourceType> = {
  year: number;
  force?: boolean; // default false
  selector?: string; // default '#content table';
  type: Type;
  scaffold: () => T;
  fields: Record<keyof T & string, string | string[]>;
  allowNull: FieldsOfType<T, null>[];
  numericFields: FieldsOfType<T, number>[];
};

export type Ref<T extends string> = { type: T; id: string };
export type StandardList<T extends string> = {
  type: `${T}-list`;
  id: string;
  attributes: { year: number; source: string; accessed: string };
  relationships: { [key in `${T}s`]: { data: Ref<T>[] } };
};
export type StandardResource<T extends string, Fields extends Attrs> = {
  type: T;
  id: string;
  attributes: Fields;
};
export type StandardResponse<T extends string, Fields extends Attrs> = {
  data: StandardList<T>;
  included: StandardResource<T, Fields>[];
};

export type FinalizedConfig<
  T extends Attrs,
  Type extends SourceType,
> = Required<StandardTableConfig<T, Type>>;
const DEFAULT_STANDARD_TABLE_CONFIG = {
  force: false,
  selector: '#content table',
};
export function makeUrl(type: SourceType, year: number) {
  switch (type) {
    case 'finisher':
      return `https://www.wser.org/results/${String(year)}-results/`;
    case 'entrant':
      return `https://www.wser.org/${String(year)}-entrants-list/`;
    case 'applicant':
      return `https://www.wser.org/lottery${String(year)}.html`;
    case 'waitlist':
      return `https://www.wser.org/${String(year)}-wait-list/`;
    case 'live':
      return `https://lottery.wser.org/`;
    case 'split':
      return year > LAST_SPLIT_XLS_YEAR
        ? `https://www.wser.org/wp-content/uploads/stats/wser${String(year)}.xlsx`
        : year >= FIRST_SPLIT_XLS_YEAR
          ? `https://www.wser.org/wp-content/uploads/stats/wser${String(year)}.xls`
          : `https://www.wser.org/wp-content/uploads/stats/wser${String(year)}.txt`;
  }
}

export function scaffoldResource<T extends Attrs, Type extends SourceType>(
  config: FinalizedConfig<T, Type>,
  index: number,
): StandardResource<Type, T> {
  return {
    type: config.type,
    id: `${config.year}:${index}`,
    attributes: config.scaffold(),
  };
}

export function isNumberField<
  T extends Attrs,
  Type extends SourceType,
  Config extends FinalizedConfig<T, Type>,
>(
  config: Config,
  field: keyof T & string,
): field is Config['numericFields'][number] {
  return config.numericFields.includes(field as FieldsOfType<T, number>);
}

export function isAllowedBlank<
  T extends Attrs,
  Type extends SourceType,
  Config extends FinalizedConfig<T, Type>,
>(
  config: Config,
  field: keyof T & string,
): field is Config['allowNull'][number] {
  return config.allowNull.includes(field as FieldsOfType<T, null>);
}

export function processStandardWebsiteTable<
  T extends Attrs,
  Type extends SourceType,
>(
  setup: StandardTableConfig<T, Type>,
): Promise<void> & { [PayloadType]: StandardResponse<Type, T> } {
  return _processStandardWebsiteTable(setup) as Promise<void> & {
    [PayloadType]: StandardResponse<Type, T>;
  };
}

export async function _processStandardWebsiteTable<
  T extends Attrs,
  Type extends SourceType,
>(setup: StandardTableConfig<T, Type>): Promise<void> {
  if (isSkippedYear(setup.year, setup.type)) {
    console.log(`\t🙈 Skipping ${setup.type} for year ${setup.year}`);
    return;
  }

  const config = Object.assign(
    {},
    DEFAULT_STANDARD_TABLE_CONFIG,
    setup,
  ) as FinalizedConfig<T, Type>;
  const { year, force } = config;

  type Response = StandardResponse<Type, T>;
  type Resource = StandardResource<Type, T>;
  type R = Ref<Type>;
  const RelationshipName = `${config.type}s` as const;

  const info = await getHtmlIfNeeded(
    makeUrl(config.type, year),
    `./data/raw/${year}/${config.type}.json`,
    force,
  );

  if (info instanceof Response) {
    if (year === NEXT_YEAR) {
      console.log(
        `\t⚠️  No ${config.type}s data available at ${info.url} for year ${year}`,
      );
      return;
    }
    throwIfHttpError(info);
    return;
  }

  if (info.html === null) {
    console.log(`\t♻️ Used ${info.path} for year ${year}`);
    return;
  }

  const rawJson = await tryExtract(info, config.selector, year);
  if (!rawJson) {
    return;
  }

  const entrants: Resource[] = [];
  const entrantRefs: R[] = [];
  const result: Response = {
    data: {
      type: `${config.type}-list`,
      id: `${year}`,
      attributes: {
        year,
        source: info.url,
        accessed: new Date().toISOString(),
      },
      // @ts-expect-error typescript is not smart enough to infer this satisfies
      relationships: {
        [RelationshipName]: {
          data: entrantRefs,
        },
      },
    },
    included: entrants,
  };

  const InverseFieldMap = inverseMap(config.fields);
  const labels = rawJson.labels.map((text) => {
    const label = InverseFieldMap.get(text) ?? null;

    if (!label) {
      throw new Error(
        `Invalid label: "${text}" in year ${year} for ${config.type}`,
      );
    }
    return label;
  });

  for (let rowIndex = 0; rowIndex < rawJson.data.length; rowIndex++) {
    const row = rawJson.data[rowIndex];
    const { index, data } = row;

    // generate the entrant object
    const entrant = scaffoldResource(config, index);

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const label = labels[i];

      if (!value && isAllowedBlank(config, label)) {
        // @ts-expect-error typescript is not smart enough to infer this satisfies
        entrant.attributes[label] = null;
        continue;
      }

      if (!value) {
        throw new Error(
          `Missing value for field ${label} in cell ${i} on row ${index} in year ${year} for ${config.type}`,
        );
      }

      if (isNumberField(config, label)) {
        const num = Number(value);
        if (Number.isNaN(num)) {
          throw new Error(
            `Value ${value} for numeric field ${label} is not a number in cell ${i} on row ${index} in year ${year} for ${config.type}`,
          );
        }
        // @ts-expect-error typescript is not smart enough to infer this satisfies
        entrant.attributes[label] = num;
        continue;
      }

      // @ts-expect-error typescript is not smart enough to infer this satisfies
      entrant.attributes[label] = value;
    }

    const { type, id } = entrant;
    entrants.push(entrant);
    entrantRefs.push({ type, id });
  }

  if (entrants.length === 0) {
    console.warn(`\t⚠️ No ${config.type}s found for year ${year}`);
  }

  await Bun.write(info.file, JSON.stringify(result));
  console.log(
    `\t✅ Processed ${styleText('cyan', String(year))} ${config.type} | ${styleText('underline', styleText('gray', info.path))}`,
  );
}
