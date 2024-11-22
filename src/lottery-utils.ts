import { JSDOM } from 'jsdom';

type Entrant = {
  id: string;
  type: 'lottery-entrant';
  attributes: {
    firstName: string;
    lastName: string;
    gender: string;
    age: string;
    state: string | null;
    country: string | null;
    qualifier: string | null;
    years: number;
    tickets: number;
  };
  relationships: {
    entrant: {
      data: { type: 'entrant', id: string } | null;
    }
  };
}
type EntrantField = keyof Entrant['attributes'] | 'id';

// on the 2^(n - 1) formula
// 1 => 1
// 2 => 2
// 4 => 3
// 8 => 4
// 16 => 5
// 32 => 6
function ticketsToYears(tickets: number): number {
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

const EntrantFieldMappingDict = {
  id: 'ID',
  firstName: 'First Name',
  lastName: 'Last Name',
  gender: 'Gender',
  age: 'Age',
  state: 'State',
  country: 'Country',
  qualifier: 'Qualifier',
  years: 'Years',
  tickets: 'Tickets'
} as const;

const EntrantFieldTransformMap = new Map(Object.entries(EntrantFieldMappingDict)) as Map<EntrantField, string>;
const EntrantFieldReverseTransformMap = new Map(Object.entries(EntrantFieldMappingDict).map(([key, value]) => [value, key])) as Map<string, EntrantField>;

function isNumberField(field: EntrantField): field is 'years' | 'tickets' {
  return field === 'years' || field === 'tickets';
}
function isAllowedBlank(field: EntrantField): field is 'country' | 'state' {
  return field === 'country' || field === 'state';
}

type YearlyLottery = {
  type: 'lottery';
  id: string;
  attributes: {
    year: number;
  };
  relationships: {
    entrants: {
      data: Array<{ type: 'lottery-entrant', id: string }>;
    }
  }
}

type LotteryResult = {
  data: YearlyLottery;
  included: Entrant[];
}

export async function fetchLotteryDataForYear(year: number, force = false): Promise<LotteryResult> {
  // we always serve from cache unless asked to force generate
  const file = Bun.file(`./raw-cache/lottery/${year}.json`);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    return await file.json() as LotteryResult;
  }

  const response = await fetch(`https://www.wser.org/lottery${String(year)}.html`);
  const data = await response.text();

  const html = new JSDOM(data);
  const table = html.window.document.querySelector('table#entrantTable tbody');
  const tableHeader = html.window.document.querySelector('table#entrantTable thead tr:nth-child(1)');

  if (!table) {
    console.log({ html: data });
    throw new Error(`Unable to find the table with lottery data for year ${year}`);
  }

  if (!tableHeader) {
    console.log({ html: data });
    throw new Error(`Unable to find the table header with lottery data for year ${year}`);
  }

  const entrants: Entrant[] = [];
  const entrantRefs: Array<{ type: 'lottery-entrant', id: string }> = [];
  const result: LotteryResult = {
    data: {
      type: 'lottery',
      id: `${year}`,
      attributes: {
        year,
      },
      relationships: {
        entrants: {
          data: entrantRefs
        }
      }
    },
    included: entrants
  }
  
  // extract the labels from the table header
  const labels = Array.from(tableHeader.querySelectorAll('th'))
    .map(th => {
      const text = th.textContent?.trim();
      if (!text) {
        throw new Error('Invalid table header');
      }
      const label = EntrantFieldReverseTransformMap.get(text) ?? (EntrantFieldTransformMap.has(text as EntrantField) ? text as EntrantField : null);
      
      if (!label) {
        throw new Error(`Invalid label: ${text}`);
      }
      return label;
  });

  // extract the entrants from the table
  table.querySelectorAll('tr').forEach((row, index) => {
    // extract the fields from the row
    const fieldValues = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());

    // generate the entrant object
    const entrant = {
      type: 'lottery-entrant',
      id: `${year}:${index}`,
      attributes: {
        firstName: '',
        lastName: '',
        gender: '',
        age: '',
        state: '',
        country: null,
        qualifier: null,
        years: 0,
        tickets: 0
      },
      relationships: {
        entrant: {
          data: null
        }
      }
    } as Entrant;

    // console.log({
    //   row: index,
    //   labels,
    //   fieldValues
    // })

    // map the fields to the labels
    labels.forEach((label, labelIndex) => {
      const value = fieldValues[labelIndex];

      if (!value && isAllowedBlank(label)) {
        entrant.attributes[label] = null;
        return;
      }

      if (!value) {
        throw new Error(`Missing value for field ${label} in cell ${labelIndex} on row ${index} in year ${year}`);
      }

      if (label === 'id') {
        entrant.relationships.entrant.data = { type: 'entrant', id: value };
        return;
      }

      if (isNumberField(label)) {
        entrant.attributes[label] = Number(value);
        return;
      }

      entrant.attributes[label] = value;
    });

    // fix the years field
    if (entrant.attributes.years === 0) {
      entrant.attributes.years = ticketsToYears(entrant.attributes.tickets);
    }

    const { type, id } = entrant;
    entrants.push(entrant);
    entrantRefs.push({ type, id });
  });

  await Bun.write(file, JSON.stringify(result, null, 2));

  return result;
}

export async function fetchLatestLotteryResults(yearHint: number, force = false) {
  // we always serve from cache unless asked to force generate
  const file = Bun.file(`./raw-cache/lottery-results/${yearHint}.json`);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    return await file.json() as LotteryResult;
  }

  const response = await fetch(`https://lottery.wser.org/`);
  const data = await response.text();

  const html = new JSDOM(data);
  const header = html.window.document.querySelector('.card-body h4');
  if (!header || header.textContent?.trim() !== 'WSER Lottery') {
    console.log({ html: data });
    throw new Error('Unable to find the header to validate date of lottery results');
  }
  const dateHeader = header.nextElementSibling;
  if (!dateHeader || dateHeader.tagName !== 'H5') {
    console.log({ html: data });
    throw new Error('Unable to find the date header to validate date of lottery results');
  }

  // extract the year from the date header
  // e.g. "December 2, 2023"
  const dateText = dateHeader.textContent?.trim();
  const year = Number(dateText?.slice(-4));

  // the yearHint is the year of the race
  // the expectedYear is the year in which the lottery occurs
  const expectedYear = yearHint - 1; 
  if (isNaN(year) || year !== expectedYear) {
    throw new Error(`Unexpected year in the date header: parsed "${year}" from "${dateText}" but expected "${expectedYear}"`);
  }

  const tables = Array.from(html.window.document.querySelectorAll('table#entrants-latest tbody'));
  const tableHeaders = Array.from(html.window.document.querySelectorAll('table#entrants-latest thead tr:nth-child(1)'));
  const [pickTable, waitlistTable] = tables;
  const [pickTableHeader, waitlistTableHeader] = tableHeaders;

  if (!pickTable) {
    console.log({ html: data });
    throw new Error(`Unable to find the table with lottery result data for year ${year}`);
  }

  if (!pickTableHeader) {
    console.log({ html: data });
    throw new Error(`Unable to find the table header with lottery result data for year ${year}`);
  }

  if (!waitlistTable) {
    console.log({ html: data });
    throw new Error(`Unable to find the table with waitlist data for year ${year}`);
  }

  if (!waitlistTableHeader) {
    console.log({ html: data });
    throw new Error(`Unable to find the table header with waitlist data for year ${year}`);
  }

  const raw = {
    entrants: [],
    waitlist: []
  };

  // extract the labels from the table headers
  const pickLabels = Array.from(pickTableHeader.querySelectorAll('th')).map(th => th.textContent?.trim());
  const waitlistLabels = Array.from(waitlistTableHeader.querySelectorAll('th')).map(th => th.textContent?.trim());

  // extract the entrants from the pick table
  pickTable.querySelectorAll('tr').forEach((row, index) => {
    const fieldValues = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());

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
    const fieldValues = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());

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
      },
      relationships: {
        entrants: {
          data: raw.entrants.map(({ id }) => ({ type: 'entrant', id }))
        },
        waitlist: {
          data: raw.waitlist.map(({ id }) => ({ type: 'waitlist-entrant', id }))
        }
      }
    },
    included: [
      ...raw.entrants,
      ...raw.waitlist
    ]
  }

  await Bun.write(file, JSON.stringify(result, null, 2));

  return result;
}