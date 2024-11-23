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

export async function extractTableData(info: DomInfo, tableSelector: string) {
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
  const labels = Array.from(tableHeader.querySelectorAll('th')).map((th) => {
    const text = th.textContent?.trim();
    if (!text) {
      throw new Error('Invalid table header');
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

    data.push({
      index,
      data: fieldValues,
    });
  });

  return { labels, data };
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
