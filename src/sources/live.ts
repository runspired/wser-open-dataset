import { JSDOM } from 'jsdom';
import { GET, isSkippedYear, PayloadType, throwIfHttpError } from '../-utils';
import { asError } from './-shared';
import { styleText } from 'util';

type LotteryPick = {
  type: 'entrant';
  id: string;
  attributes: {
    'Pick No': string;
    Name: string;
    'City/Country': string;
    Tickets: string;
  };
};

type WaitlistPick = {
  type: 'waitlist-entrant';
  id: string;
  attributes: {
    'Waitlist No': string;
    Name: string;
    'City/Country': string;
    Tickets: string;
  };
};

export type LivePayload = {
  data: {
    type: 'lottery-result';
    id: string;
    attributes: {
      year: number;
      source: string;
      accessed: string;
    };
    relationships: {
      entrants: {
        data: Array<{ type: 'entrant'; id: string }>;
      };
      waitlist: {
        data: Array<{ type: 'waitlist-entrant'; id: string }>;
      };
    };
  };
  included: Array<LotteryPick | WaitlistPick>;
};

export function fetchLatestLiveLotteryResults(
  year: number,
  force = false,
): Promise<void> & { [PayloadType]: LivePayload } {
  return _fetchLatestLiveLotteryResults(year, force) as Promise<void> & {
    [PayloadType]: LivePayload;
  };
}

async function _fetchLatestLiveLotteryResults(year: number, force = false) {
  try {
    // only fetch the latest lottery results if the year is the current year
    // or the upcoming year.
    await __fetchLatestLiveLotteryResults(year, force);
  } catch (error: unknown) {
    console.log(`\t⚠️ ${asError(error).message}`);
  }
}

async function __fetchLatestLiveLotteryResults(
  yearHint: number,
  force = false,
): Promise<void> {
  // we always serve from cache unless asked to force generate
  const path = `./.data-cache/raw/${yearHint}/live-lottery-results.json`;
  const file = Bun.file(path);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    return;
  }

  if (isSkippedYear(yearHint, 'live')) {
    return;
  }

  const response = await GET(`https://lottery.wser.org/`);
  throwIfHttpError(response);
  const data = await response.text();

  const html = new JSDOM(data);
  const header = html.window.document.querySelector('.card-body h4');
  if (!header || header.textContent?.trim() !== 'WSER Lottery') {
    throw new Error(
      'Unable to find the header to validate date of lottery results',
    );
  }
  const dateHeader = header.nextElementSibling;
  if (!dateHeader || dateHeader.tagName !== 'H5') {
    throw new Error(
      'Unable to find the date header to validate date of lottery results',
    );
  }

  // extract the year from the date header
  // e.g. "December 2, 2023"
  const dateText = dateHeader.textContent?.trim();
  const year = Number(dateText?.slice(-4));

  // the yearHint is the year of the race
  // the expectedYear is the year in which the lottery occurs
  const expectedYear = yearHint - 1;
  if (isNaN(year) || year !== expectedYear) {
    throw new Error(
      `Unexpected year in the date header for live lottery data: parsed "${year}" from "${dateText}" but expected "${expectedYear}"`,
    );
  }

  const tables = Array.from(
    html.window.document.querySelectorAll('table#entrants-latest tbody'),
  );
  const tableHeaders = Array.from(
    html.window.document.querySelectorAll(
      'table#entrants-latest thead tr:nth-child(1)',
    ),
  );
  const [pickTable, waitlistTable] = tables;
  const [pickTableHeader, waitlistTableHeader] = tableHeaders;

  if (!pickTable) {
    console.log({ html: data });
    throw new Error(
      `Unable to find the table with lottery result data for year ${year}`,
    );
  }

  if (!pickTableHeader) {
    console.log({ html: data });
    throw new Error(
      `Unable to find the table header with lottery result data for year ${year}`,
    );
  }

  if (!waitlistTable) {
    console.log({ html: data });
    throw new Error(
      `Unable to find the table with waitlist data for year ${year}`,
    );
  }

  if (!waitlistTableHeader) {
    console.log({ html: data });
    throw new Error(
      `Unable to find the table header with waitlist data for year ${year}`,
    );
  }

  const raw = {
    entrants: [],
    waitlist: [],
  };

  // extract the labels from the table headers
  const pickLabels = Array.from(pickTableHeader.querySelectorAll('th')).map(
    (th) => th.textContent?.trim(),
  );
  const waitlistLabels = Array.from(
    waitlistTableHeader.querySelectorAll('th'),
  ).map((th) => th.textContent?.trim());

  // extract the entrants from the pick table
  pickTable.querySelectorAll('tr').forEach((row, index) => {
    const fieldValues = Array.from(row.querySelectorAll('td')).map((td) =>
      td.textContent?.trim(),
    );

    const entrant = {
      type: 'entrant',
      id: `${yearHint}:${index}`,
      attributes: {},
    };

    pickLabels.forEach((label, labelIndex) => {
      const value = fieldValues[labelIndex];
      // @ts-expect-error
      entrant.attributes[label] = value;
    });

    // @ts-expect-error
    raw.entrants.push(entrant);
  });

  // extract the entrants from the waitlist table
  waitlistTable.querySelectorAll('tr').forEach((row, index) => {
    const fieldValues = Array.from(row.querySelectorAll('td')).map((td) =>
      td.textContent?.trim(),
    );

    const entrant = {
      type: 'waitlist-entrant',
      id: `${yearHint}:${index}`,
      attributes: {},
    };

    waitlistLabels.forEach((label, labelIndex) => {
      const value = fieldValues[labelIndex];
      // @ts-expect-error
      entrant.attributes[label] = value;
    });

    // @ts-expect-error
    raw.waitlist.push(entrant);
  });

  const result = {
    data: {
      type: 'lottery-result',
      id: `${yearHint}`,
      attributes: {
        year: yearHint,
        source: 'https://lottery.wser.org/',
        accessed: new Date().toISOString(),
      },
      relationships: {
        entrants: {
          data: raw.entrants.map(({ id }) => ({ type: 'entrant', id })),
        },
        waitlist: {
          data: raw.waitlist.map(({ id }) => ({
            type: 'waitlist-entrant',
            id,
          })),
        },
      },
    },
    included: [...raw.entrants, ...raw.waitlist],
  };

  await Bun.write(file, JSON.stringify(result, null, 2));
  console.log(
    `✅ Processed ${styleText('cyan', String(yearHint))} live | ${styleText('underline', styleText('gray', path))}`,
  );
}
