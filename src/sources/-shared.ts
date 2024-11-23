import type { BunFile } from 'bun';
import { JSDOM } from 'jsdom';

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
  data: null;
  html: JSDOM;
  raw: string;
};

type Info<T> =
  | {
      file: BunFile;
      url: string;
      path: string;
      exists: boolean;
      forceGenerate: boolean;
      data: T;
      html: null;
      raw: null;
    }
  | DomInfo;

export async function extractTableData(
  info: DomInfo,
  tableSelector: string,
): Promise<{
  labels: string[];
  data: { index: number; data: string[] }[];
}> {
  const { html, raw, url } = info;

  const table = html.window.document.querySelector(`${tableSelector} tbody`);
  const tableHeader = html.window.document.querySelector(
    `${tableSelector} thead tr:nth-child(1)`,
  );

  if (!table) {
    console.log(html.window.document.querySelector(tableSelector));
    console.log({ html: raw });
    throw new Error(
      `Unable to find table body "${tableSelector} tbody" for ${url}`,
    );
  }

  if (!tableHeader) {
    console.log({ html: raw });
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

export async function getHtmlIfNeeded<T>(
  url: string,
  path: string,
  force: boolean,
): Promise<Info<T>> {
  // we always serve from cache unless asked to force generate
  const file = Bun.file(path);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    const data = (await file.json()) as T;
    return {
      file,
      url,
      path,
      exists,
      forceGenerate,
      data,
      html: null,
      raw: null,
    };
  }

  const response = await fetch(url);
  const data = await response.text();
  const html = new JSDOM(data);

  return {
    file,
    url,
    path,
    exists,
    forceGenerate,
    data: null,
    html,
    raw: data,
  };
}

export function asError(error: unknown): Error {
  return error as unknown as Error;
}

export function inverseMap<T extends Record<string, string | string[]>>(
  source: T,
): Map<string, keyof T> {
  const InverseFieldMap = new Map<string, keyof T>();
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        InverseFieldMap.set(v, key as keyof T);
      }
    } else {
      InverseFieldMap.set(value as string, key as keyof T);
    }
  }

  return InverseFieldMap;
}
