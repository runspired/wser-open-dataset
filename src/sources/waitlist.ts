import {
  extractTableData,
  getHtmlIfNeeded,
  inverseMap,
  ticketsToYears,
} from './-shared';

type WaitlistResult = {
  data: Waitlist;
  included: WaitlistEntrant[];
};

type Waitlist = {
  type: 'waitlist';
  id: string;
  attributes: {
    year: number;
  };
  relationships: {
    applicants: {
      data: Array<{ type: 'waitlist-entrant'; id: string }>;
    };
  };
};

type WaitlistEntrant = {
  type: 'waitlist-entrant';
  id: string;
  attributes: {
    order: number;
    status: string | null;
    firstName: string;
    lastName: string;
    gender: string;
    age: string | null;
    city: string;
    state: string;
    country: string;
    tickets: number;
    years: number;
    bib: string | null;
  };
};

type EntrantField = keyof WaitlistEntrant['attributes'];

const FieldMappingDict = {
  order: 'Order',
  status: 'Status',
  firstName: ['First Name', 'First'],
  lastName: ['Last Name', 'Last'],
  gender: 'Gender',
  age: 'Age',
  city: 'City',
  state: 'State',
  country: 'Country',
  tickets: ['Tickets', 'Ticket Count'],
  years: ['Years', 'Years In Lottery', 'Years in Lottery'],
  bib: 'Bib',
};

const InverseFieldMap = inverseMap(FieldMappingDict);

function isNumberField(
  field: EntrantField,
): field is 'order' | 'years' | 'tickets' {
  return field === 'order' || field === 'years' || field === 'tickets';
}
function isAllowedBlank(
  field: EntrantField,
): field is 'status' | 'age' | 'bib' {
  return field === 'status' || field === 'age' || field === 'bib';
}

function scaffoldEntrant(year: number, index: number): WaitlistEntrant {
  return {
    type: 'waitlist-entrant',
    id: `${year}:${index}`,
    attributes: {
      order: 0,
      status: null,
      firstName: '',
      lastName: '',
      gender: '',
      age: null,
      city: '',
      state: '',
      country: '',
      tickets: 0,
      years: 0,
      bib: null,
    },
  };
}

export async function fetchWaitlistData(
  year: number,
  force = false,
): Promise<WaitlistResult> {
  const info = await getHtmlIfNeeded<WaitlistResult>(
    `https://www.wser.org/${String(year)}-wait-list/`,
    `./.data-cache/raw/${year}/wait-list.json`,
    force,
  );

  if (info.data) {
    return info.data;
  }

  const rawJson = await extractTableData(info, '#content table');
  const entrants: WaitlistEntrant[] = [];
  const entrantRefs: Array<{ type: 'waitlist-entrant'; id: string }> = [];
  const result: WaitlistResult = {
    data: {
      type: 'waitlist',
      id: `${year}`,
      attributes: {
        year,
      },
      relationships: {
        applicants: {
          data: entrantRefs,
        },
      },
    },
    included: entrants,
  };

  const labels = rawJson.labels.map((text) => {
    const label = InverseFieldMap.get(text) ?? null;

    if (!label) {
      throw new Error(`Invalid label: ${text}`);
    }
    return label;
  });

  for (let rowIndex = 0; rowIndex < rawJson.data.length; rowIndex++) {
    const row = rawJson.data[rowIndex];
    const { index, data } = row;

    // generate the entrant object
    const entrant = scaffoldEntrant(year, index);

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const label = labels[i];

      if (!value && isAllowedBlank(label)) {
        entrant.attributes[label] = null;
        continue;
      }

      if (!value) {
        throw new Error(
          `Missing value for field ${label} in cell ${i} on row ${index} in year ${year}`,
        );
      }

      if (isNumberField(label)) {
        entrant.attributes[label] = Number(value);
        continue;
      }

      entrant.attributes[label] = value;
    }

    // fix the years field
    if (entrant.attributes.years === 0) {
      entrant.attributes.years = ticketsToYears(entrant.attributes.tickets);
    }

    const { type, id } = entrant;
    entrants.push(entrant);
    entrantRefs.push({ type, id });
  }

  await Bun.write(info.file, JSON.stringify(result, null, 2));

  return result;
}
